import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BookingService } from './booking.service';
import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';

describe('BookingService Scenarios', () => {
  let service: BookingService;
  let prismaMock: any;
  let redisMock: any;
  let websocketMock: any;
  let configMock: any;

  beforeEach(() => {
    prismaMock = {
      showtime: { findUnique: vi.fn() },
      showtimeSeat: { findMany: vi.fn().mockResolvedValue([]), updateMany: vi.fn() },
      booking: { create: vi.fn(), update: vi.fn(), findUnique: vi.fn() },
      ticket: { createMany: vi.fn() },
      user: { findUnique: vi.fn(), update: vi.fn() },
      combo: { findMany: vi.fn().mockResolvedValue([]) },
      voucher: { findUnique: vi.fn() },
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
    configMock = {
      get: vi.fn().mockReturnValue('mock-secret'),
    };

    service = new BookingService(prismaMock, redisMock, websocketMock, configMock);
  });

  // Scenario 1: User A successfully holds an available seat
  it('Scenario 1: User A successfully holds an available seat', async () => {
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
    expect(redisMock.acquireSeatLock).toHaveBeenCalledWith('st_456', 'A1', 'usr_alice', 600);
    expect(websocketMock.broadcastSeatState).toHaveBeenCalledWith(
      'st_456',
      'A1',
      'HOLDING',
      'usr_alice',
      expect.any(String),
    );
  });

  // Scenario 2: User B cannot hold the same seat
  it('Scenario 2: User B cannot hold the same seat when already held', async () => {
    prismaMock.showtime.findUnique.mockResolvedValue({
      id: 'st_456',
      startTime: new Date(Date.now() + 3600 * 1000),
    });
    // Seat A1 lock acquisition fails because User A holds it
    redisMock.acquireSeatLock.mockResolvedValue(false);

    await expect(
      service.holdSeats('usr_bob', {
        showtimeId: 'st_456',
        seatIds: ['A1'],
      }),
    ).rejects.toThrow(ConflictException);
  });

  // Scenario 3: The lock owner can release the seat
  it('Scenario 3: The lock owner can release the seat', async () => {
    // Lua script returns true when ownerToken matches
    redisMock.releaseSeatLock.mockResolvedValue(true);

    const res = await service.releaseSeats('usr_alice', {
      showtimeId: 'st_456',
      seatIds: ['A1'],
    });

    expect(res.releasedSeats).toEqual(['A1']);
    expect(redisMock.releaseSeatLock).toHaveBeenCalledWith('st_456', 'A1', 'usr_alice');
    expect(websocketMock.broadcastSeatState).toHaveBeenCalledWith('st_456', 'A1', 'AVAILABLE', null, null);
  });

  // Scenario 4: Another user cannot release that lock
  it('Scenario 4: Another user cannot release that lock', async () => {
    // Lua script returns false because Bob does not match Alice's ownerToken in Redis
    redisMock.releaseSeatLock.mockResolvedValue(false);

    const res = await service.releaseSeats('usr_bob', {
      showtimeId: 'st_456',
      seatIds: ['A1'],
    });

    // Seat A1 was NOT released because Bob is not the owner
    expect(res.releasedSeats).toEqual([]);
    expect(websocketMock.broadcastSeatState).not.toHaveBeenCalled();
  });

  // Scenario 5: A failed multi-seat reservation rolls back earlier locks
  it('Scenario 5: A failed multi-seat reservation rolls back earlier locks', async () => {
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

    // Verify A1 was rolled back
    expect(redisMock.releaseSeatLock).toHaveBeenCalledWith('st_456', 'A1', 'usr_alice');
    expect(websocketMock.broadcastSeatState).toHaveBeenCalledWith('st_456', 'A1', 'AVAILABLE');
  });

  // Scenario 6: An expired reservation cannot be checked out
  it('Scenario 6: An expired reservation cannot be checked out', async () => {
    // Redis returns null because TTL expired or key does not exist
    redisMock.getSeatLockHolder.mockResolvedValue(null);

    await expect(
      service.checkout('usr_alice', {
        showtimeId: 'st_456',
        seatIds: ['A1'],
        paymentMethod: 'MOCK_GATEWAY',
      }),
    ).rejects.toThrow(ConflictException);
  });

  // Scenario 7: An expired seat becomes available (Redis TTL expiry)
  it('Scenario 7: An expired seat holder is null and can be re-locked', async () => {
    redisMock.getSeatLockHolder.mockResolvedValue(null);
    const holder = await redisMock.getSeatLockHolder('st_456', 'A1');
    expect(holder).toBeNull();

    // Now another user can acquire it
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

  // Scenario 15: A user cannot access another user's booking
  it("Scenario 15: A user cannot access another user's booking", async () => {
    prismaMock.booking.findUnique.mockResolvedValue({
      id: 'bkg_123',
      userId: 'usr_alice',
      showtime: { movie: {}, cinema: {}, hall: {} },
      tickets: [],
      combos: [],
    });

    // Bob attempts to fetch Alice's booking
    await expect(service.getBookingById('usr_bob', 'bkg_123')).rejects.toThrow(ForbiddenException);
  });
});
