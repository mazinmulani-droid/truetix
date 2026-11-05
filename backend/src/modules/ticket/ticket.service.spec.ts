import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TicketService } from './ticket.service';
import { TicketTokenUtil } from '../../common/utils/ticket-token.util';
import { ConflictException, UnprocessableEntityException } from '@nestjs/common';

describe('TicketService Tests', () => {
  let service: TicketService;
  let prismaMock: any;
  let configMock: any;
  const secret = 'truetix_hmac_qr_secret_key_2026';

  beforeEach(() => {
    prismaMock = {
      ticket: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
      },
      $transaction: vi.fn((cb) => cb(prismaMock)),
    };
    configMock = {
      get: vi.fn((key: string, defaultVal: string) => {
        if (key === 'TICKET_HMAC_SECRET') return secret;
        return defaultVal;
      }),
    };

    service = new TicketService(prismaMock, configMock);
  });

  it('Rejects tickets with invalid or forged HMAC signatures', async () => {
    const token = TicketTokenUtil.generateToken(
      {
        ticketId: 'tkt_001',
        bookingId: 'bkg_123',
        showtimeId: 'st_456',
        seatId: 'H12',
        userId: 'usr_789',
      },
      'attacker-forged-secret-key',
    );

    await expect(
      service.verifyQrTicket(token),
    ).rejects.toThrow(UnprocessableEntityException);
  });

  it('Rejects tickets when payload identifiers do not match the database record', async () => {
    const token = TicketTokenUtil.generateToken(
      {
        ticketId: 'tkt_001',
        bookingId: 'bkg_WRONG',
        showtimeId: 'st_456',
        seatId: 'H12',
        userId: 'usr_789',
      },
      secret,
    );

    prismaMock.ticket.findUnique.mockResolvedValue({
      id: 'tkt_001',
      bookingId: 'bkg_REAL',
      seatId: 'H12',
      status: 'UNUSED',
      booking: {
        userId: 'usr_789',
        showtimeId: 'st_456',
        status: 'PAID',
        showtime: { movie: {}, cinema: {}, hall: {} },
      },
    });

    await expect(
      service.verifyQrTicket(token),
    ).rejects.toThrow(UnprocessableEntityException);
  });

  it('Rejects tickets for unpaid bookings', async () => {
    const token = TicketTokenUtil.generateToken(
      {
        ticketId: 'tkt_001',
        bookingId: 'bkg_123',
        showtimeId: 'st_456',
        seatId: 'H12',
        userId: 'usr_789',
      },
      secret,
    );

    // Booking status is PENDING_PAYMENT (unpaid)
    prismaMock.ticket.findUnique.mockResolvedValue({
      id: 'tkt_001',
      bookingId: 'bkg_123',
      seatId: 'H12',
      status: 'UNUSED',
      booking: {
        userId: 'usr_789',
        showtimeId: 'st_456',
        status: 'PENDING_PAYMENT',
        showtime: { movie: {}, cinema: {}, hall: {} },
      },
    });

    await expect(
      service.verifyQrTicket(token),
    ).rejects.toThrow(UnprocessableEntityException);
  });

  it('Rejects expired tickets where showtime has ended', async () => {
    const pastTimestamp = Math.floor(Date.now() / 1000) - 3600; // 1 hour ago
    const token = TicketTokenUtil.generateToken(
      {
        ticketId: 'tkt_001',
        bookingId: 'bkg_123',
        showtimeId: 'st_456',
        seatId: 'H12',
        userId: 'usr_789',
        exp: pastTimestamp,
      },
      secret,
    );

    await expect(
      service.verifyQrTicket(token),
    ).rejects.toThrow(UnprocessableEntityException);
  });

  it('A ticket cannot be checked in twice', async () => {
    const token = TicketTokenUtil.generateToken(
      {
        ticketId: 'tkt_001',
        bookingId: 'bkg_123',
        showtimeId: 'st_456',
        seatId: 'H12',
        userId: 'usr_789',
      },
      secret,
    );

    prismaMock.ticket.findUnique.mockResolvedValue({
      id: 'tkt_001',
      bookingId: 'bkg_123',
      seatId: 'H12',
      status: 'CHECKED_IN',
      booking: {
        userId: 'usr_789',
        showtimeId: 'st_456',
        status: 'PAID',
        showtime: { movie: {}, cinema: {}, hall: {} },
      },
    });

    // updateMany matches 0 rows because status is already CHECKED_IN
    prismaMock.ticket.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      service.verifyQrTicket(token),
    ).rejects.toThrow(ConflictException);
  });

  it('Simultaneous check-in requests cannot both succeed (Atomic DB conditional update)', async () => {
    const token = TicketTokenUtil.generateToken(
      {
        ticketId: 'tkt_001',
        bookingId: 'bkg_123',
        showtimeId: 'st_456',
        seatId: 'H12',
        userId: 'usr_789',
      },
      secret,
    );

    prismaMock.ticket.findUnique.mockResolvedValue({
      id: 'tkt_001',
      bookingId: 'bkg_123',
      seatId: 'H12',
      status: 'UNUSED',
      booking: {
        userId: 'usr_789',
        showtimeId: 'st_456',
        status: 'PAID',
        showtime: { movie: { title: 'Test Film' }, cinema: { name: 'Cinema 1' }, hall: { name: 'H1' } },
      },
    });

    // First attempt succeeds (count = 1), second attempt fails (count = 0)
    prismaMock.ticket.updateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 });

    const req1 = service.verifyQrTicket(token);
    const req2 = service.verifyQrTicket(token);

    const [res1, res2] = await Promise.allSettled([req1, req2]);

    expect(res1.status).toBe('fulfilled');
    expect(res2.status).toBe('rejected');
    if (res2.status === 'rejected') {
      expect(res2.reason).toBeInstanceOf(ConflictException);
    }
  });
});
