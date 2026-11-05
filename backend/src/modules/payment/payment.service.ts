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

/**
 * PaymentService handles mock payment gateway simulation and idempotent callback processing.
 *
 * NOTE FOR CODE REVIEW / INTERVIEWS:
 * The HMAC signature generated and verified here is a simulation mechanism for a sandbox/mock
 * payment gateway, illustrating how real gateways (Stripe, Razorpay, VNPay) use cryptographic
 * webhooks to verify caller authenticity.
 */
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
   * Generates a tamper-proof simulated signature for mock payment sandbox validation
   */
  generatePaymentSignature(bookingId: string, amount: number): string {
    return crypto
      .createHmac('sha256', this.getPaymentSecret())
      .update(`${bookingId}:${amount}`)
      .digest('hex');
  }

  /**
   * Verifies payment signature using constant-time comparison to prevent timing attacks
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
   * Creates a mock payment gateway URL with QR payload and simulated HMAC signature
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
    const frontendUrl = this.configService.get<string>('FRONTEND_URL', 'http://localhost:3000');
    const paymentUrl = `${frontendUrl}/payment/mock-gateway?bookingId=${bookingId}&amount=${amount}&signature=${signature}`;

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
   * Processes a successful payment callback idempotently:
   * 1. Validates that signature is non-empty and cryptographically valid.
   * 2. Validates that booking exists and paid amount matches expected total.
   * 3. Validates booking state (PENDING_PAYMENT). If already PAID, returns cached success.
   * 4. In an isolated PostgreSQL transaction ($transaction):
   *    - Conditionally updates Booking from PENDING_PAYMENT to PAID.
   *    - Marks all associated seats as SOLD in showtime_seats.
   *    - Asserts that updated seat count equals expected ticket count; rolls back if mismatch.
   * 5. Post-commit:
   *    - Force releases temporary Redis locks and broadcasts SOLD to connected WebSockets.
   *    - If Redis fails post-commit, PostgreSQL remains authoritative.
   */
  async processSuccessfulPayment(
    bookingId: string,
    paidAmount: number,
    signature: string,
    paymentMethod = 'MOCK_GATEWAY',
  ) {
    // 1. Mandatory non-empty signature requirement
    if (!signature || typeof signature !== 'string' || signature.trim() === '') {
      throw new BadRequestException('Payment provider signature is required');
    }

    // 2. Validate booking existence
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: { tickets: true },
    });

    if (!booking) {
      throw new NotFoundException(`Booking not found: ${bookingId}`);
    }

    // 3. Idempotency: If already paid, safely return current record without re-running transactions
    if (booking.status === 'PAID') {
      this.logger.log(`Booking ${bookingId} already marked PAID. Returning idempotent success.`);
      return { success: true, data: booking, message: 'Booking already paid (idempotent)' };
    }

    if (booking.status === 'CANCELLED' || booking.status === 'EXPIRED') {
      throw new BadRequestException(`Cannot process payment for ${booking.status.toLowerCase()} booking`);
    }

    // 4. Validate expected amount
    if (Number(paidAmount) !== Number(booking.totalAmount)) {
      throw new BadRequestException(
        `Payment amount mismatch: expected ${booking.totalAmount}, got ${paidAmount}`,
      );
    }

    // 5. Verify cryptographic signature
    if (!this.verifyPaymentSignature(bookingId, paidAmount, signature)) {
      throw new BadRequestException('Invalid payment provider signature');
    }

    // 6. Atomic Database Transaction
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

      // Mark all booked seats as permanently SOLD in PostgreSQL
      const seatIds = booking.tickets.map((t) => t.seatId);
      if (seatIds.length > 0) {
        const seatUpdateResult = await tx.showtimeSeat.updateMany({
          where: {
            showtimeId: booking.showtimeId,
            seatId: { in: seatIds },
            status: { not: 'SOLD' },
          },
          data: { status: 'SOLD' },
        });

        // Ensure every seat was successfully transitioned. If mismatch, roll back entire transaction.
        if (seatUpdateResult.count !== seatIds.length) {
          throw new ConflictException(
            `Seat finalization mismatch: expected ${seatIds.length} seats, updated ${seatUpdateResult.count}`,
          );
        }
      }

      const finalRecord = await tx.booking.findUnique({
        where: { id: bookingId },
        include: { tickets: true },
      });

      if (!finalRecord) throw new NotFoundException('Booking not found after update');
      return finalRecord;
    });

    // 7. Post-Transaction: Force release Redis temporary locks & broadcast real-time SOLD state
    // Wrapped in try/catch so if Redis is temporarily unreachable, PostgreSQL remains the authority
    try {
      for (const t of updatedBooking.tickets) {
        await this.redisService.forceReleaseSeatLock(updatedBooking.showtimeId, t.seatId);
        this.websocketGateway.broadcastSeatState(updatedBooking.showtimeId, t.seatId, 'SOLD');
      }
    } catch (err: any) {
      this.logger.warn(`Post-commit Redis lock cleanup failed: ${err.message}. PostgreSQL remains authoritative.`);
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
    try {
      for (const t of booking.tickets) {
        await this.redisService.forceReleaseSeatLock(booking.showtimeId, t.seatId);
        this.websocketGateway.broadcastSeatState(booking.showtimeId, t.seatId, 'AVAILABLE');
      }
    } catch (err: any) {
      this.logger.warn(`Failed to release seat locks on payment cancellation: ${err.message}`);
    }

    return { success: true, message: 'Booking marked as cancelled and seats released' };
  }
}
