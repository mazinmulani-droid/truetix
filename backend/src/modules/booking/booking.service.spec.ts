import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BookingService } from './booking.service';
import { ConflictException, ForbiddenException, NotFoundException, ServiceUnavailableException, BadRequestException } from '@nestjs/common';

describe('BookingService Tests', () => {
  let service: BookingService;
  let prismaMock: any;
  let redisMock: any;
  let websocketMock: any;
  let paymentMock: any;
  let configMock: any;

  beforeEach(() => {
    prismaMock = {
      showtime: { findUnique: vi.fn() },
      showtimeSeat: {
        findMany: vi.fn().mockImplementation(({ where }) => {
          const seatIds = where?.seatId?.in || [];
          return Promise.resolve(
            seatIds.map((s: string) => ({ seatId: s, status: 'AVAILABLE', priceModifier: 1.0 })),
          );
        }),
        updateMany: vi.fn(),
      },
      booking: { create: vi.fn(), update: vi.fn(), findUnique: vi.fn() },
      ticket: { createMany: vi.fn() },
      user: { findUnique: vi.fn(), update: vi.fn() },
      $transaction: vi.fn((cb) => cb(prismaMock)),
    };
    redisMock = {
      acquireSeatLock: vi.fn(),
      releaseSeatLock: vi.fn(),
      getSeatLockHolder: vi.fn(),
      forceReleaseSeatLock: vi.fn(),
    };
    websocketMock = {
      broadcastSeatState: vi.fn(),
    };
    paymentMock = {
      generatePaymentSignature: vi.fn().mockReturnValue('mock_sig_hex_12345'),
      verifyPaymentSignature: vi.fn().mockReturnValue(true),
    };
    configMock = {
      get: vi.fn((key: string, defaultVal: string) => {
        if (key === 'FRONTEND_URL') return 'http://localhost:3000';
        if (key === 'TICKET_HMAC_SECRET') return 'truetix_hmac_qr_secret_key_2026';
        return defaultVal;
      }),
    };

    service = new BookingService(prismaMock, redisMock, websocketMock, paymentMock, configMock);
  });

  it('User A successfully holds an available seat with a unique reservation ID', async () => {
    prismaMock.showtime.findUnique.mockResolvedValue({
      id: 'st_456',
      startTime: new Date(Date.now() + 3600 * 1000),
    });
    redisMock.acquireSeatLock.mockResolvedValue(true);

    const res = await service.holdSeats('usr_alice', {
      showtimeId: 'st_456',
      seatIds: ['A1'],
    });

    expect(res.heldSeats).toEqual(['A1']);
    expect(res.ttlSeconds).toBe(600);
    expect(res.reservationId).toMatch(/^res_/);
    expect(redisMock.acquireSeatLock).toHaveBeenCalledWith('st_456', 'A1', res.reservationId, 600);
    expect(websocketMock.broadcastSeatState).toHaveBeenCalledWith(
      'st_456',
      'A1',
      'HOLDING',
      'usr_alice',
      expect.any(String),
    );
  });

  it('User B cannot hold the same seat when already held', async () => {
    prismaMock.showtime.findUnique.mockResolvedValue({
      id: 'st_456',
      startTime: new Date(Date.now() + 3600 * 1000),
    });
    redisMock.acquireSeatLock.mockResolvedValue(false);

    await expect(
      service.holdSeats('usr_bob', {
        showtimeId: 'st_456',
        seatIds: ['A1'],
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('The reservation owner can release the seat using their reservation token', async () => {
    redisMock.releaseSeatLock.mockResolvedValue(true);

    const res = await service.releaseSeats('usr_alice', {
      showtimeId: 'st_456',
      seatIds: ['A1'],
      reservationId: 'res_owner_123',
    });

    expect(res.releasedSeats).toEqual(['A1']);
    expect(redisMock.releaseSeatLock).toHaveBeenCalledWith('st_456', 'A1', 'res_owner_123');
    expect(websocketMock.broadcastSeatState).toHaveBeenCalledWith('st_456', 'A1', 'AVAILABLE', null, null);
  });

  it('releaseSeats strictly requires reservationId', async () => {
    await expect(
      service.releaseSeats('usr_alice', {
        showtimeId: 'st_456',
        seatIds: ['A1'],
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('Another reservation session cannot release that lock (Lua compare-and-delete check)', async () => {
    redisMock.releaseSeatLock.mockResolvedValue(false);

    const res = await service.releaseSeats('usr_bob', {
      showtimeId: 'st_456',
      seatIds: ['A1'],
      reservationId: 'res_wrong_token',
    });

    expect(res.releasedSeats).toEqual([]);
    expect(websocketMock.broadcastSeatState).not.toHaveBeenCalled();
  });

  it('A failed multi-seat reservation rolls back earlier locks using the reservation token', async () => {
    prismaMock.showtime.findUnique.mockResolvedValue({
      id: 'st_456',
      startTime: new Date(Date.now() + 3600 * 1000),
    });
    // Seat A1 succeeds, Seat A2 fails
    redisMock.acquireSeatLock
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false);
    redisMock.releaseSeatLock.mockResolvedValue(true);

    await expect(
      service.holdSeats('usr_alice', {
        showtimeId: 'st_456',
        seatIds: ['A1', 'A2'],
      }),
    ).rejects.toThrow(ConflictException);

    // Verify A1 was rolled back with the same reservationId that was used to lock it
    expect(redisMock.releaseSeatLock).toHaveBeenCalledWith('st_456', 'A1', expect.stringMatching(/^res_/));
    expect(websocketMock.broadcastSeatState).toHaveBeenCalledWith('st_456', 'A1', 'AVAILABLE');
  });

  it('One user with two separate reservation sessions cannot cross-release or checkout each other', async () => {
    redisMock.getSeatLockHolder.mockResolvedValue('res_session_A');

    await expect(
      service.checkout('usr_alice', {
        reservationId: 'res_session_B',
        showtimeId: 'st_456',
        seatIds: ['A1'],
        paymentMethod: 'MOCK_GATEWAY',
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('Checkout strictly enforces reservationId and rejects userId as alternative', async () => {
    redisMock.getSeatLockHolder.mockResolvedValue('usr_alice'); // Redis has userId, but checkout requires reservationId

    await expect(
      service.checkout('usr_alice', {
        reservationId: 'res_alice_123',
        showtimeId: 'st_456',
        seatIds: ['A1'],
        paymentMethod: 'MOCK_GATEWAY',
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('Checkout strictly rejects BLOCKED seats', async () => {
    redisMock.getSeatLockHolder.mockResolvedValue('res_valid_123');
    prismaMock.showtime.findUnique.mockResolvedValue({
      id: 'st_456',
      startTime: new Date(Date.now() + 3600 * 1000),
    });
    prismaMock.showtimeSeat.findMany.mockResolvedValue([
      { seatId: 'A1', status: 'BLOCKED', priceModifier: 1.0 },
    ]);

    await expect(
      service.checkout('usr_alice', {
        reservationId: 'res_valid_123',
        showtimeId: 'st_456',
        seatIds: ['A1'],
        paymentMethod: 'MOCK_GATEWAY',
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('An expired reservation cannot be checked out', async () => {
    redisMock.getSeatLockHolder.mockResolvedValue(null);

    await expect(
      service.checkout('usr_alice', {
        reservationId: 'res_alice_123',
        showtimeId: 'st_456',
        seatIds: ['A1'],
        paymentMethod: 'MOCK_GATEWAY',
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('An expired seat holder is null and can be re-locked by another user', async () => {
    redisMock.getSeatLockHolder.mockResolvedValue(null);
    const holder = await redisMock.getSeatLockHolder('st_456', 'A1');
    expect(holder).toBeNull();

    redisMock.acquireSeatLock.mockResolvedValue(true);
    prismaMock.showtime.findUnique.mockResolvedValue({
      id: 'st_456',
      startTime: new Date(Date.now() + 3600 * 1000),
    });

    const res = await service.holdSeats('usr_bob', {
      showtimeId: 'st_456',
      seatIds: ['A1'],
    });
    expect(res.heldSeats).toEqual(['A1']);
  });

  it('Fails safely when Redis is unavailable', async () => {
    prismaMock.showtime.findUnique.mockResolvedValue({
      id: 'st_456',
      startTime: new Date(Date.now() + 3600 * 1000),
    });
    redisMock.acquireSeatLock.mockRejectedValue(
      new ServiceUnavailableException('Redis distributed locking service is unavailable'),
    );

    await expect(
      service.holdSeats('usr_alice', {
        showtimeId: 'st_456',
        seatIds: ['A1'],
      }),
    ).rejects.toThrow(ServiceUnavailableException);
  });

  it("A user cannot access another user's booking (IDOR protection)", async () => {
    prismaMock.booking.findUnique.mockResolvedValue({
      id: 'bkg_123',
      userId: 'usr_alice',
      showtime: { movie: {}, cinema: {}, hall: {} },
      tickets: [],
    });

    await expect(service.getBookingById('usr_bob', 'bkg_123')).rejects.toThrow(ForbiddenException);
  });
});
