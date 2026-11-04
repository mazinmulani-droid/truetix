import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { WebsocketGateway } from '../websocket/websocket.gateway';
import { RedisService } from '../redis/redis.service';
import * as QRCode from 'qrcode';
import * as crypto from 'crypto';

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly websocketGateway: WebsocketGateway,
    private readonly redisService: RedisService,
  ) {}

  private getPaymentSecret(): string {
    return this.configService.get<string>('PAYMENT_HMAC_SECRET', 'truetix_mock_payment_secret_2026');
  }

  /**
   * Generates a tamper-proof simulated signature for mock payment validation
   */
  generatePaymentSignature(bookingId: string, amount: number): string {
    return crypto
      .createHmac('sha256', this.getPaymentSecret())
      .update(`${bookingId}:${amount}`)
      .digest('hex');
  }

  /**
   * Verifies payment signature using timing-safe comparison
   */
  verifyPaymentSignature(bookingId: string, amount: number, signature: string): boolean {
    if (!signature) return false;
    const expected = this.generatePaymentSignature(bookingId, amount);
    const sigBuf = Buffer.from(signature, 'hex');
    const expBuf = Buffer.from(expected, 'hex');
    if (sigBuf.length !== expBuf.length) return false;
    return crypto.timingSafeEqual(sigBuf, expBuf);
  }

  /**
   * Creates a mock payment gateway URL with QR payload and simulated signature
   */
  async createMockPaymentUrl(bookingId: string, amount: number) {
    const booking = await this.prisma.booking.findUnique({ where: { id: bookingId } });
    if (!booking) {
      throw new NotFoundException(`Booking not found: ${bookingId}`);
    }

    if (booking.status === 'PAID') {
      throw new BadRequestException('Booking is already paid');
    }

    const signature = this.generatePaymentSignature(bookingId, amount);
    const mockHost = this.configService.get<string>('FRONTEND_URL', 'http://localhost:3000');
    const paymentUrl = `${mockHost}/payment/mock-gateway?bookingId=${bookingId}&amount=${amount}&signature=${signature}`;

    const qrPayload = `TRUETIX_PAY:${bookingId}:${amount}:${signature.substring(0, 8)}`;
    const qrDataUrl = await QRCode.toDataURL(qrPayload);

    await this.prisma.booking.update({
      where: { id: bookingId },
      data: { paymentUrl },
    });

    return {
      bookingId,
      amount,
      signature,
      paymentUrl,
      qrPayload,
      qrDataUrl,
    };
  }

  /**
   * Atomically and idempotently processes successful payment callback:
   * 1. Validates booking existence and expected amount.
   * 2. Verifies HMAC provider signature.
   * 3. Uses atomic conditional update (WHERE status = 'PENDING_PAYMENT') to prevent race conditions.
   * 4. Updates booking -> PAID and seats -> SOLD in a database transaction.
   * 5. Releases Redis locks and broadcasts SOLD via Socket.IO.
   */
  async processSuccessfulPayment(bookingId: string, paidAmount: number, signature?: string, paymentMethod = 'MOCK_GATEWAY') {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: { tickets: true },
    });

    if (!booking) {
      throw new NotFoundException(`Booking not found: ${bookingId}`);
    }

    // Idempotency: If already paid, safely return current state without re-executing points/seats
    if (booking.status === 'PAID') {
      this.logger.log(`Booking ${bookingId} already marked PAID. Returning idempotent success.`);
      return { success: true, booking, message: 'Booking already paid (idempotent)' };
    }

    if (booking.status === 'CANCELLED' || booking.status === 'EXPIRED') {
      throw new BadRequestException(`Cannot process payment for ${booking.status.toLowerCase()} booking`);
    }

    // Validate expected amount
    if (Number(paidAmount) !== Number(booking.totalAmount)) {
      throw new BadRequestException(
        `Payment amount mismatch: expected ${booking.totalAmount}, got ${paidAmount}`,
      );
    }

    // Verify simulated signature if provided
    if (signature && !this.verifyPaymentSignature(bookingId, paidAmount, signature)) {
      throw new BadRequestException('Invalid payment provider signature');
    }

    // Atomic Database Transaction with conditional update
    const updatedBooking = await this.prisma.$transaction(async (tx) => {
      // Atomic conditional update ensures only ONE concurrent callback can succeed
      const updateResult = await tx.booking.updateMany({
        where: {
          id: bookingId,
          status: 'PENDING_PAYMENT',
        },
        data: {
          status: 'PAID',
          paymentMethod,
        },
      });

      if (updateResult.count === 0) {
        // Concurrently processed by another worker
        const current = await tx.booking.findUnique({
          where: { id: bookingId },
          include: { tickets: true },
        });
        if (current?.status === 'PAID') {
          return current;
        }
        throw new ConflictException('Booking is no longer pending payment');
      }

      // Fetch updated booking
      const b = await tx.booking.findUnique({
        where: { id: bookingId },
        include: { tickets: true },
      });

      if (!b) throw new NotFoundException('Booking not found');

      // Mark all booked seats as permanently SOLD in PostgreSQL
      const seatIds = b.tickets.map((t) => t.seatId);
      if (seatIds.length > 0) {
        await tx.showtimeSeat.updateMany({
          where: {
            showtimeId: b.showtimeId,
            seatId: { in: seatIds },
          },
          data: { status: 'SOLD' },
        });
      }

      // Reward points update
      const netPointsChange = b.cgvPointsEarned - b.cgvPointsUsed;
      if (netPointsChange > 0) {
        await tx.user.update({
          where: { id: b.userId },
          data: {
            points: { increment: netPointsChange },
          },
        });
      }

      // Mark voucher as used if applicable
      if (b.voucherId) {
        await tx.userVoucher.updateMany({
          where: {
            userId: b.userId,
            voucherId: b.voucherId,
            isUsed: false,
          },
          data: {
            isUsed: true,
            usedAt: new Date(),
          },
        });
      }

      return b;
    });

    // Post-transaction: Force release Redis temporary locks & broadcast real-time SOLD state
    for (const t of updatedBooking.tickets) {
      await this.redisService.forceReleaseSeatLock(updatedBooking.showtimeId, t.seatId);
      this.websocketGateway.broadcastSeatState(updatedBooking.showtimeId, t.seatId, 'SOLD');
    }

    return {
      success: true,
      data: updatedBooking,
      message: 'Payment processed successfully',
    };
  }

  /**
   * Handle failed or cancelled payment
   */
  async processFailedPayment(bookingId: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: { tickets: true },
    });

    if (!booking) {
      throw new NotFoundException(`Booking not found: ${bookingId}`);
    }

    if (booking.status === 'PAID') {
      return { success: false, message: 'Cannot cancel an already paid booking' };
    }

    await this.prisma.booking.updateMany({
      where: { id: bookingId, status: 'PENDING_PAYMENT' },
      data: { status: 'CANCELLED' },
    });

    // Release Redis seat locks so seats become available again
    for (const t of booking.tickets) {
      await this.redisService.forceReleaseSeatLock(booking.showtimeId, t.seatId);
      this.websocketGateway.broadcastSeatState(booking.showtimeId, t.seatId, 'AVAILABLE');
    }

    return { success: true, message: 'Booking marked as cancelled and seats released' };
  }
}
