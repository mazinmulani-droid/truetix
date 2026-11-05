import {
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { TicketTokenUtil } from '../../common/utils/ticket-token.util';

@Injectable()
export class TicketService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  async getUserTickets(userId: string) {
    const tickets = await this.prisma.ticket.findMany({
      where: { booking: { userId } },
      include: {
        booking: {
          include: {
            showtime: {
              include: { movie: true, cinema: true, hall: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return tickets.map((t) => ({
      ticketId: t.id,
      seatId: t.seatId,
      status: t.status,
      qrToken: t.qrToken,
      movieTitle: t.booking.showtime.movie.title,
      posterUrl: t.booking.showtime.movie.posterUrl,
      cinemaName: t.booking.showtime.cinema.name,
      hallName: t.booking.showtime.hall.name,
      startTime: t.booking.showtime.startTime,
      endTime: t.booking.showtime.endTime,
      bookingStatus: t.booking.status,
    }));
  }

  async getTicketDetail(id: string, userId: string) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id },
      include: {
        booking: {
          include: {
            showtime: {
              include: { movie: true, cinema: true, hall: true },
            },
          },
        },
      },
    });

    if (!ticket || ticket.booking.userId !== userId) {
      throw new NotFoundException(`Ticket ID not found: ${id}`);
    }

    return ticket;
  }

  /**
   * Scanner turnstile validation endpoint (POST /tickets/verify-qr)
   *
   * Key Security & Correctness Controls:
   * 1. Role-Based Access: Protected by JwtAuthGuard + RolesGuard (Role.ADMIN, Role.SCANNER).
   * 2. Timing-Safe Cryptographic Signature: Verifies HMAC-SHA256 signature using crypto.timingSafeEqual.
   * 3. Comprehensive Payload Validation: Verifies that ticketId, bookingId, showtimeId, seatId,
   *    and userId all match the database records exactly.
   * 4. Expiry Check: Rejects tickets if the showtime has ended.
   * 5. Paid Verification: Tickets belonging to unpaid or cancelled bookings are denied entry.
   * 6. Atomic Conditional Check-in: Uses updateMany with WHERE status = 'UNUSED'
   *    so simultaneous scans at turnstiles cannot both admit the customer.
   */
  async verifyQrTicket(qrToken: string) {
    const hmacSecret = this.configService.get<string>('TICKET_HMAC_SECRET', 'truetix_hmac_qr_secret_key_2026');
    const payload = TicketTokenUtil.verifyToken(qrToken, hmacSecret);

    if (
      !payload ||
      !payload.ticketId ||
      !payload.bookingId ||
      !payload.showtimeId ||
      !payload.seatId ||
      !payload.userId
    ) {
      throw new UnprocessableEntityException({
        code: 'INVALID_HMAC_SIGNATURE',
        message: 'Invalid HMAC signature or ticket payload is missing required identifiers',
      });
    }

    // Expiration check
    const nowUnix = Math.floor(Date.now() / 1000);
    if (payload.exp && nowUnix > payload.exp) {
      throw new UnprocessableEntityException({
        code: 'TICKET_EXPIRED',
        message: 'Ticket has expired as the showtime has ended',
      });
    }

    return this.prisma.$transaction(async (tx) => {
      const ticket = await tx.ticket.findUnique({
        where: { id: payload.ticketId },
        include: {
          booking: {
            include: {
              showtime: { include: { movie: true, hall: true, cinema: true } },
              user: { select: { fullName: true, email: true } },
            },
          },
        },
      });

      if (!ticket) {
        throw new NotFoundException('Ticket does not exist in database');
      }

      // Assert all payload identifiers match the database record exactly
      if (
        ticket.bookingId !== payload.bookingId ||
        ticket.seatId !== payload.seatId ||
        ticket.booking.showtimeId !== payload.showtimeId ||
        ticket.booking.userId !== payload.userId
      ) {
        throw new UnprocessableEntityException({
          code: 'TICKET_DATA_MISMATCH',
          message: 'Ticket payload identifiers do not match the database record',
        });
      }

      // Check payment status - tickets for unpaid bookings cannot be admitted
      if (ticket.booking.status !== 'PAID') {
        throw new UnprocessableEntityException({
          code: 'BOOKING_NOT_PAID',
          message: 'Cannot check in ticket for an unpaid booking',
        });
      }

      // Atomic conditional update to prevent double check-in under race conditions
      const updateResult = await tx.ticket.updateMany({
        where: {
          id: ticket.id,
          status: 'UNUSED',
        },
        data: {
          status: 'CHECKED_IN',
        },
      });

      if (updateResult.count === 0) {
        throw new ConflictException({
          code: 'TICKET_ALREADY_USED',
          message: 'This ticket has already been verified and checked in',
        });
      }

      return {
        verified: true,
        ticketId: ticket.id,
        movieTitle: ticket.booking.showtime.movie.title,
        cinemaName: ticket.booking.showtime.cinema.name,
        hallName: ticket.booking.showtime.hall.name,
        seatId: ticket.seatId,
        status: 'CHECKED_IN',
        checkedInAt: new Date(),
        customerName: ticket.booking.user?.fullName,
      };
    });
  }
}
