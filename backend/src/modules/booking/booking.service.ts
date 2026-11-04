import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { WebsocketGateway } from '../websocket/websocket.gateway';
import { HoldSeatDto } from './dto/hold-seat.dto';
import { CheckoutBookingDto } from './dto/checkout-booking.dto';
import { ConfigService } from '@nestjs/config';
import { TicketTokenUtil } from '../../common/utils/ticket-token.util';
import * as crypto from 'crypto';

@Injectable()
export class BookingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
    private readonly websocketGateway: WebsocketGateway,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Temporarily hold seats with Redis Redlock (10-minute TTL)
   * If any seat fails to acquire, atomically roll back previously acquired seats.
   */
  async holdSeats(userId: string, dto: HoldSeatDto) {
    const showtimeId = dto.showtimeId;
    const seatIds = dto.seatIds || [];

    if (!showtimeId || seatIds.length === 0) {
      throw new BadRequestException('Please provide showtimeId and a list of seatIds');
    }

    const showtime = await this.prisma.showtime.findUnique({ where: { id: showtimeId } });
    if (!showtime) {
      throw new NotFoundException(`Showtime ID not found: ${showtimeId}`);
    }

    if (new Date(showtime.startTime) < new Date()) {
      throw new BadRequestException('This showtime has already started or ended. Booking is unavailable.');
    }

    // Verify seat status from PostgreSQL database before holding
    const existingSeats = await this.prisma.showtimeSeat.findMany({
      where: {
        showtimeId,
        seatId: { in: seatIds },
      },
    });

    for (const seat of existingSeats) {
      if (seat.status === 'SOLD') {
        throw new ConflictException({
          code: 'SEAT_ALREADY_SOLD',
          message: `Seat ${seat.seatId} has already been sold. Please select another seat.`,
        });
      }
      if (seat.status === 'BLOCKED') {
        throw new ConflictException({
          code: 'SEAT_BLOCKED',
          message: `Seat ${seat.seatId} is currently blocked`,
        });
      }
    }

    const lockedSeats: string[] = [];

    // Attempt to acquire distributed lock for each seat
    for (const seatId of seatIds) {
      const acquired = await this.redisService.acquireSeatLock(showtimeId, seatId, userId, 600);
      if (!acquired) {
        // Rollback all seats acquired in this batch using atomic compare-and-delete
        for (const locked of lockedSeats) {
          await this.redisService.releaseSeatLock(showtimeId, locked, userId);
          this.websocketGateway.broadcastSeatState(showtimeId, locked, 'AVAILABLE');
        }
        throw new ConflictException({
          code: 'SEAT_ALREADY_HELD',
          message: `Seat ${seatId} is currently reserved by another customer`,
          details: [{ field: 'seatId', issue: `Lock key lock:seat:${showtimeId}:${seatId} exists in Redis` }],
        });
      }
      lockedSeats.push(seatId);
    }

    const expiresAt = new Date(Date.now() + 600 * 1000).toISOString();
    const reservationId = `res_${userId.substring(0, 8)}_${Date.now()}`;

    // Broadcast seat status update to Socket.IO clients
    lockedSeats.forEach((seatId) => {
      this.websocketGateway.broadcastSeatState(showtimeId, seatId, 'HOLDING', userId, expiresAt);
    });

    return {
      reservationId,
      showtimeId,
      heldSeats: lockedSeats,
      expiresAt,
      ttlSeconds: 600,
    };
  }

  /**
   * Release temporarily held seats
   * Uses Lua script to ensure users can only release seats they own
   */
  async releaseSeats(userId: string, dto: HoldSeatDto) {
    const { showtimeId, seatIds = [] } = dto;
    const releasedSeats: string[] = [];

    if (showtimeId && seatIds.length > 0) {
      for (const seatId of seatIds) {
        const released = await this.redisService.releaseSeatLock(showtimeId, seatId, userId);
        if (released) {
          releasedSeats.push(seatId);
          this.websocketGateway.broadcastSeatState(showtimeId, seatId, 'AVAILABLE', null, null);
        }
      }
    }
    return { success: true, releasedSeats };
  }

  /**
   * Checkout ticket and F&B order
   * Verifies reservation ownership and expiry in Redis before creating booking in PostgreSQL.
   */
  async checkout(userId: string, dto: CheckoutBookingDto) {
    const { showtimeId, seatIds, paymentMethod, comboIds, voucherCode, pointsToUse = 0 } = dto;

    if (!showtimeId || !seatIds || seatIds.length === 0) {
      throw new BadRequestException('showtimeId and seatIds are required');
    }

    // 1. Verify reservation ownership and expiry in Redis
    for (const seatId of seatIds) {
      const lockHolder = await this.redisService.getSeatLockHolder(showtimeId, seatId);
      if (lockHolder !== userId) {
        throw new ConflictException({
          code: 'SEAT_LOCK_EXPIRED_OR_NOT_OWNED',
          message: `Seat ${seatId} hold has expired or is not reserved by you. Please select your seats again.`,
        });
      }
    }

    return this.prisma.$transaction(async (tx) => {
      // 2. Verify showtime
      const showtime = await tx.showtime.findUnique({
        where: { id: showtimeId },
        include: { movie: true, cinema: true, hall: true },
      });
      if (!showtime) {
        throw new NotFoundException('Showtime does not exist');
      }

      if (new Date(showtime.startTime) < new Date()) {
        throw new BadRequestException('This showtime has already started or ended. Cannot complete checkout.');
      }

      // 3. Lock check in PostgreSQL
      const seats = await tx.showtimeSeat.findMany({
        where: {
          showtimeId,
          seatId: { in: seatIds },
        },
      });

      if (seats.length !== seatIds.length) {
        throw new NotFoundException('Some selected seats do not exist in this showtime');
      }

      for (const seat of seats) {
        if (seat.status === 'SOLD') {
          throw new ConflictException(`Seat ${seat.seatId} has already been purchased by another customer`);
        }
      }

      // 4. Calculate tickets total
      let ticketTotal = 0;
      seats.forEach((seat) => {
        const price = Math.round(showtime.basePrice * (seat.priceModifier || 1.0));
        ticketTotal += price;
      });

      // 5. Calculate F&B Combos total
      let comboTotal = 0;
      const comboRecordsToInsert: { comboId: string; quantity: number; price: number }[] = [];

      if (comboIds && comboIds.length > 0) {
        const comboDbList = await tx.combo.findMany({
          where: { id: { in: comboIds.map((c) => c.comboId) }, status: 'ACTIVE' },
        });

        for (const item of comboIds) {
          const combo = comboDbList.find((c) => c.id === item.comboId);
          if (combo) {
            comboTotal += combo.price * item.quantity;
            comboRecordsToInsert.push({ comboId: combo.id, quantity: item.quantity, price: combo.price });
          }
        }
      }

      let grandTotal = ticketTotal + comboTotal;
      let discountAmount = 0;
      let appliedVoucherId: string | undefined = undefined;

      // 6. Apply discount voucher
      if (voucherCode) {
        const voucher = await tx.voucher.findUnique({ where: { code: voucherCode.toUpperCase() } });
        if (voucher && voucher.status === 'ACTIVE' && new Date() <= voucher.expiresAt) {
          if (grandTotal >= voucher.minOrderValue) {
            if (voucher.discountType === 'FIXED_AMOUNT') {
              discountAmount += voucher.discountValue;
            } else if (voucher.discountType === 'PERCENTAGE') {
              let calc = Math.round((grandTotal * voucher.discountValue) / 100);
              if (voucher.maxDiscountAmount && calc > voucher.maxDiscountAmount) {
                calc = voucher.maxDiscountAmount;
              }
              discountAmount += calc;
            }
            appliedVoucherId = voucher.id;
          }
        }
      }

      // 7. Apply loyalty reward points
      const user = await tx.user.findUnique({ where: { id: userId } });
      if (!user) throw new NotFoundException('User does not exist');

      let pointsUsed = 0;
      if (pointsToUse > 0) {
        if (user.points < pointsToUse) {
          throw new BadRequestException('Insufficient loyalty points');
        }
        const pointDiscount = pointsToUse * 1000;
        discountAmount += pointDiscount;
        pointsUsed = pointsToUse;
      }

      // Ensure total after discount >= 0
      const finalAmount = Math.max(0, grandTotal - discountAmount);

      // 8. Payment method processing
      let bookingStatus: 'PENDING_PAYMENT' | 'PAID' = 'PENDING_PAYMENT';
      let paymentUrl: string | undefined = undefined;

      if (paymentMethod === 'CGV_CARD') {
        if (user.cgvCardBalance < finalAmount) {
          throw new BadRequestException('Insufficient card wallet balance');
        }
        // Deduct from card wallet
        await tx.user.update({
          where: { id: userId },
          data: {
            cgvCardBalance: { decrement: finalAmount },
            points: { decrement: pointsUsed },
          },
        });
        await tx.cGVCardTransaction.create({
          data: {
            userId,
            amount: finalAmount,
            type: 'SPEND',
            description: `Payment for movie tickets showtime ${showtime.id}`,
          },
        });
        bookingStatus = 'PAID';
      } else {
        // Standard Mock Gateway URL
        const mockHost = this.configService.get<string>('MOCK_VNPAY_HOST', 'http://localhost:4000');
        paymentUrl = `${mockHost}/api/v1/payments/mock/gateway?bookingId=TEMP&amount=${finalAmount}`;
      }

      // 9. Calculate rewards points
      const pointsEarned = Math.floor(finalAmount / 1000);

      // 10. Create Booking record
      const booking = await tx.booking.create({
        data: {
          userId,
          showtimeId,
          totalAmount: finalAmount,
          discountAmount,
          cgvPointsUsed: pointsUsed,
          cgvPointsEarned: pointsEarned,
          voucherId: appliedVoucherId,
          status: bookingStatus,
          paymentMethod,
          paymentUrl,
        },
      });

      // Update payment URL with real booking id
      if (paymentUrl && paymentUrl.includes('TEMP')) {
        paymentUrl = paymentUrl.replace('TEMP', booking.id);
        await tx.booking.update({
          where: { id: booking.id },
          data: { paymentUrl },
        });
      }

      // 11. Create BookingCombo records
      if (comboRecordsToInsert.length > 0) {
        await tx.bookingCombo.createMany({
          data: comboRecordsToInsert.map((c) => ({
            bookingId: booking.id,
            comboId: c.comboId,
            quantity: c.quantity,
            price: c.price,
          })),
        });
      }

      // 12. Create electronic tickets with standardized HMAC-SHA256 QR tokens
      const hmacSecret = this.configService.get<string>('TICKET_HMAC_SECRET', 'truetix_hmac_qr_secret_key_2026');
      const ticketRecordsToInsert = seatIds.map((seatId) => {
        const ticketId = crypto.randomUUID();
        const expUnix = Math.floor(new Date(showtime.endTime).getTime() / 1000);
        const qrToken = TicketTokenUtil.generateToken(
          {
            ticketId,
            bookingId: booking.id,
            showtimeId,
            seatId,
            userId,
            exp: expUnix,
          },
          hmacSecret,
        );

        return {
          id: ticketId,
          bookingId: booking.id,
          seatId,
          qrToken,
          status: 'UNUSED' as const,
        };
      });

      await tx.ticket.createMany({
        data: ticketRecordsToInsert,
      });

      // 13. If immediately paid (e.g. CGV_CARD), mark seats as SOLD in DB and release Redis lock
      if (bookingStatus === 'PAID') {
        await tx.showtimeSeat.updateMany({
          where: { showtimeId, seatId: { in: seatIds } },
          data: { status: 'SOLD' },
        });

        for (const seatId of seatIds) {
          await this.redisService.forceReleaseSeatLock(showtimeId, seatId);
          this.websocketGateway.broadcastSeatState(showtimeId, seatId, 'SOLD');
        }
      }

      return {
        bookingId: booking.id,
        status: bookingStatus,
        totalAmount: finalAmount,
        discountAmount,
        pointsEarned,
        paymentMethod,
        paymentUrl,
      };
    });
  }

  /**
   * Get user booking history
   */
  async getUserBookings(userId: string) {
    return this.prisma.booking.findMany({
      where: { userId },
      include: {
        showtime: {
          include: { movie: true, cinema: true, hall: true },
        },
        tickets: true,
        combos: { include: { combo: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get booking details with ownership verification
   */
  async getBookingById(userId: string, bookingId: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        showtime: {
          include: { movie: true, cinema: true, hall: true },
        },
        tickets: true,
        combos: { include: { combo: true } },
      },
    });

    if (!booking) {
      throw new NotFoundException(`Booking ID not found: ${bookingId}`);
    }

    if (booking.userId !== userId) {
      throw new ForbiddenException('You do not have permission to view this booking');
    }

    return booking;
  }
}
