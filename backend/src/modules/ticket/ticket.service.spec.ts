import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TicketService } from './ticket.service';
import { TicketTokenUtil } from '../../common/utils/ticket-token.util';
import { ConflictException, UnprocessableEntityException } from '@nestjs/common';

describe('TicketService Scenarios', () => {
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
        if (key === 'TURNSTILE_SECRET_KEY') return 'turnstile-secret-key-2026';
        if (key === 'TICKET_HMAC_SECRET') return secret;
        return defaultVal;
      }),
    };

    service = new TicketService(prismaMock, configMock);
  });

  // Scenario 10: Invalid QR signatures are rejected
  it('Scenario 10: Invalid QR signatures are rejected with UnprocessableEntityException', async () => {
    // Generate valid payload but sign with forged wrong secret
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
      service.verifyQrTicket('turnstile-secret-key-2026', token),
    ).rejects.toThrow(UnprocessableEntityException);
  });

  // Scenario 11: Valid QR tickets for unpaid bookings are rejected
  it('Scenario 11: Valid QR tickets for unpaid bookings are rejected', async () => {
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
      seatId: 'H12',
      status: 'UNUSED',
      booking: {
        status: 'PENDING_PAYMENT',
        showtime: { movie: {}, cinema: {}, hall: {} },
        combos: [],
      },
    });

    await expect(
      service.verifyQrTicket('turnstile-secret-key-2026', token),
    ).rejects.toThrow(UnprocessableEntityException);
  });

  // Scenario 12: A ticket cannot be checked in twice
  it('Scenario 12: A ticket cannot be checked in twice', async () => {
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
      seatId: 'H12',
      status: 'CHECKED_IN',
      booking: {
        status: 'PAID',
        showtime: { movie: {}, cinema: {}, hall: {} },
        combos: [],
      },
    });

    // updateMany matches 0 rows because status is already CHECKED_IN
    prismaMock.ticket.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      service.verifyQrTicket('turnstile-secret-key-2026', token),
    ).rejects.toThrow(ConflictException);
  });

  // Scenario 13: Simultaneous check-in requests cannot both succeed
  it('Scenario 13: Simultaneous check-in requests cannot both succeed (Atomic DB conditional update)', async () => {
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
      seatId: 'H12',
      status: 'UNUSED',
      booking: {
        status: 'PAID',
        showtime: { movie: { title: 'Test Film' }, cinema: { name: 'Cinema 1' }, hall: { name: 'H1' } },
        combos: [],
      },
    });

    // First attempt succeeds (count = 1), second attempt fails (count = 0)
    prismaMock.ticket.updateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 });

    const req1 = service.verifyQrTicket('turnstile-secret-key-2026', token);
    const req2 = service.verifyQrTicket('turnstile-secret-key-2026', token);

    const [res1, res2] = await Promise.allSettled([req1, req2]);

    expect(res1.status).toBe('fulfilled');
    expect(res2.status).toBe('rejected');
    if (res2.status === 'rejected') {
      expect(res2.reason).toBeInstanceOf(ConflictException);
    }
  });
});
