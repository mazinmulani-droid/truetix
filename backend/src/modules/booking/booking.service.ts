import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { WebsocketGateway } from '../websocket/websocket.gateway';
import { PaymentService } from '../payment/payment.service';
import { HoldSeatDto } from './dto/hold-seat.dto';
import { CheckoutBookingDto } from './dto/checkout-booking.dto';
import { ConfigService } from '@nestjs/config';
import { TicketTokenUtil } from '../../common/utils/ticket-token.util';
import * as crypto from 'crypto';

@Injectable()
export class BookingService {
  private readonly logger = new Logger(BookingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
    private readonly websocketGateway: WebsocketGateway,
    private readonly paymentService: PaymentService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Temporarily holds seats using atomic Redis distributed locks (10-minute TTL).
   *
   * Key Engineering Mechanisms:
   * 1. Unique Reservation ID: Generates a cryptographically random session token (res_<uuid>)
   *    so different tabs/sessions belonging to the same user have distinct ownership.
   * 2. Duplicate Detection: Rejects duplicate seat IDs in the same request.
   * 3. Database Pre-Validation: Verifies that all seats exist and are neither SOLD nor BLOCKED.
   * 4. Atomic Acquisition: Uses SET lock:seat:{showtimeId}:{seatId} {reservationId} NX EX 600.
   * 5. Multi-Seat Atomic Rollback: If any seat in a requested batch fails to acquire,
   *    all previously acquired seats are rolled back via atomic Lua compare-and-delete.
   */
  async holdSeats(userId: string, dto: HoldSeatDto) {
    const showtimeId = dto.showtimeId;
    const seatIds = dto.seatIds || [];

    if (!showtimeId || seatIds.length === 0) {
      throw new BadRequestException('Please provide showtimeId and a list of seatIds');
    }

    // Reject duplicate seat IDs in the batch
    if (new Set(seatIds).size !== seatIds.length) {
      throw new BadRequestException('Duplicate seat IDs provided');
    }

    const showtime = await this.prisma.showtime.findUnique({ where: { id: showtimeId } });
    if (!showtime) {
      throw new NotFoundException(`Showtime ID not found: ${showtimeId}`);
    }

    if (new Date(showtime.startTime) < new Date()) {
      throw new BadRequestException('This showtime has already started or ended. Booking is unavailable.');
    }

    // Verify seat existence and status from PostgreSQL database before attempting Redis lock
    const existingSeats = await this.prisma.showtimeSeat.findMany({
      where: {
        showtimeId,
        seatId: { in: seatIds },
      },
    });

    if (existingSeats.length !== seatIds.length) {
      throw new NotFoundException('Some selected seats do not exist in this showtime');
    }

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
          message: `Seat ${seat.seatId} is currently blocked for venue maintenance.`,
        });
      }
    }

    // Generate a unique reservation session token
    const reservationId = `res_${crypto.randomUUID()}`;
    const lockedSeats: string[] = [];

    // Attempt atomic lock acquisition for each seat in the requested batch
    for (const seatId of seatIds) {
      const acquired = await this.redisService.acquireSeatLock(showtimeId, seatId, reservationId, 600);
      if (!acquired) {
        // Rollback: Atomically release all seats previously acquired in this attempt
        for (const locked of lockedSeats) {
          await this.redisService.releaseSeatLock(showtimeId, locked, reservationId);
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

    // Broadcast seat status update to all connected Socket.IO clients in the room
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
   * Releases temporarily held seats.
   * Uses an atomic Lua compare-and-delete script in Redis so that locks are ONLY deleted
   * if the stored token matches the provided reservationId.
   */
  async releaseSeats(userId: string, dto: HoldSeatDto) {
    const { showtimeId, seatIds = [], reservationId } = dto;

    if (!reservationId) {
      throw new BadRequestException('reservationId is required to release seats');
    }

    const releasedSeats: string[] = [];
    if (showtimeId && seatIds.length > 0) {
      for (const seatId of seatIds) {
        const released = await this.redisService.releaseSeatLock(showtimeId, seatId, reservationId);
        if (released) {
          releasedSeats.push(seatId);
          this.websocketGateway.broadcastSeatState(showtimeId, seatId, 'AVAILABLE', null, null);
        }
      }
    }
    return { success: true, releasedSeats };
  }

  /**
   * Completes checkout and creates a PENDING_PAYMENT booking.
   *
   * Key Engineering Mechanisms:
   * 1. Strict Reservation Ownership: Validates in Redis that every seat lock is actively held
   *    by the specific reservationId. Rejects if expired or belonging to another session.
   * 2. PostgreSQL ACID Transaction: Verifies showtime validity, checks seats are neither SOLD nor BLOCKED,
   *    computes order total, creates Booking, and issues tamper-proof digital tickets with HMAC-SHA256 signatures.
   * 3. HMAC-Signed Payment URL: Generates signature via PaymentService so the mock sandbox can securely verify it.
   */
  async checkout(userId: string, dto: CheckoutBookingDto) {
    const { showtimeId, seatIds, reservationId } = dto;

    if (!showtimeId || !seatIds || seatIds.length === 0) {
      throw new BadRequestException('showtimeId and seatIds are required');
    }

    if (!reservationId) {
      throw new BadRequestException('reservationId is required for checkout');
    }

    // 1. Strict reservation ownership verification in Redis
    for (const seatId of seatIds) {
      const lockHolder = await this.redisService.getSeatLockHolder(showtimeId, seatId);
      if (!lockHolder || lockHolder !== reservationId) {
        throw new ConflictException({
          code: 'SEAT_LOCK_EXPIRED_OR_NOT_OWNED',
          message: `Seat ${seatId} hold has expired or does not belong to this reservation session. Please reselect your seats.`,
        });
      }
    }

    return this.prisma.$transaction(async (tx) => {
      // 2. Verify showtime existence and scheduling
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

      // 3. PostgreSQL sanity check: verify seats exist and are neither SOLD nor BLOCKED in the database
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
          throw new ConflictException({
            code: 'SEAT_ALREADY_SOLD',
            message: `Seat ${seat.seatId} has already been purchased by another customer`,
          });
        }
        if (seat.status === 'BLOCKED') {
          throw new ConflictException({
            code: 'SEAT_BLOCKED',
            message: `Seat ${seat.seatId} is currently blocked for venue maintenance`,
          });
        }
        if (seat.status !== 'AVAILABLE' && seat.status !== 'HOLDING') {
          throw new ConflictException({
            code: 'SEAT_NOT_AVAILABLE',
            message: `Seat ${seat.seatId} is not available for purchase`,
          });
        }
      }

      // 4. Calculate ticket order total
      let ticketTotal = 0;
      seats.forEach((seat) => {
        const price = Math.round(showtime.basePrice * (seat.priceModifier || 1.0));
        ticketTotal += price;
      });

      const finalAmount = ticketTotal;

      // 5. Create Booking record in PostgreSQL with status PENDING_PAYMENT
      const booking = await tx.booking.create({
        data: {
          userId,
          showtimeId,
          totalAmount: finalAmount,
          status: 'PENDING_PAYMENT',
          paymentMethod: 'MOCK_GATEWAY',
        },
      });

      // 6. Generate Mock Payment Sandbox URL with valid HMAC signature
      const frontendUrl = this.configService.get<string>('FRONTEND_URL', 'http://localhost:3000');
      const signature = this.paymentService.generatePaymentSignature(booking.id, finalAmount);
      const paymentUrl = `${frontendUrl}/payment/mock-gateway?bookingId=${booking.id}&amount=${finalAmount}&signature=${signature}`;

      await tx.booking.update({
        where: { id: booking.id },
        data: { paymentUrl },
      });

      // 7. Generate electronic tickets with HMAC-SHA256 signatures
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

      return {
        bookingId: booking.id,
        status: 'PENDING_PAYMENT',
        totalAmount: finalAmount,
        paymentMethod: 'MOCK_GATEWAY',
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
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get booking details with ownership verification (IDOR protection)
   */
  async getBookingById(userId: string, bookingId: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        showtime: {
          include: { movie: true, cinema: true, hall: true },
        },
        tickets: true,
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
