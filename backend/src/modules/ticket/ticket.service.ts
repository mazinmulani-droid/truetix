import {
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
  UnauthorizedException,
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
            combos: {
              include: { combo: true },
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
      combos: t.booking.combos,
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
            combos: {
              include: { combo: true },
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
   * Scanner turnstile validation (POST /tickets/verify-qr)
   * Enforces:
   * 1. Valid scanner API secret key
   * 2. Timing-safe HMAC-SHA256 signature verification
   * 3. Ticket existence and valid booking payment status (PAID only)
   * 4. Atomic conditional check-in preventing duplicate/concurrent entry
   */
  async verifyQrTicket(scannerKey: string, qrToken: string) {
    const expectedKey = this.configService.get<string>('TURNSTILE_SECRET_KEY', 'turnstile-secret-key-2026');
    if (!scannerKey || scannerKey !== expectedKey) {
      throw new UnauthorizedException('Invalid X-Scanner-Key header');
    }

    const hmacSecret = this.configService.get<string>('TICKET_HMAC_SECRET', 'truetix_hmac_qr_secret_key_2026');
    const payload = TicketTokenUtil.verifyToken(qrToken, hmacSecret);

    if (!payload || !payload.ticketId) {
      throw new UnprocessableEntityException({
        code: 'INVALID_HMAC_SIGNATURE',
        message: 'Invalid HMAC signature or ticket data has been modified',
      });
    }

    // Expiry check
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
              combos: { include: { combo: true } },
              user: { select: { fullName: true, email: true } },
            },
          },
        },
      });

      if (!ticket) {
        throw new NotFoundException('Ticket does not exist in database');
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
        combos: ticket.booking.combos.map((c) => ({
          name: c.combo.title,
          quantity: c.quantity,
        })),
      };
    });
  }
}
