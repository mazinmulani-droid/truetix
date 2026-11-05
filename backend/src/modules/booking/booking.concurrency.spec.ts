import { describe, it, expect, beforeEach } from 'vitest';
import { BookingService } from './booking.service';
import { RedisService } from '../redis/redis.service';
import { ConfigService } from '@nestjs/config';

describe('Concurrency Test: Concurrent Seat Reservation (Double Booking Prevention)', () => {
  let bookingService: BookingService;
  let redisService: RedisService;
  let prismaMock: any;
  let websocketMock: any;
  let configService: ConfigService;
  let redisStorage: Map<string, string>;

  beforeEach(() => {
    configService = new ConfigService();
    redisService = new RedisService(configService);

    // Simulate an atomic Redis engine to test concurrent SET NX semantics
    redisStorage = new Map<string, string>();
    const mockRedisClient = {
      set: async (key: string, val: string, ex: string, ttl: number, nx: string) => {
        // Atomic NX check
        if (redisStorage.has(key)) {
          return null;
        }
        redisStorage.set(key, val);
        return 'OK';
      },
      get: async (key: string) => redisStorage.get(key) || null,
      eval: async (script: string, numKeys: number, key: string, token: string) => {
        if (redisStorage.get(key) === token) {
          redisStorage.delete(key);
          return 1;
        }
        return 0;
      },
      del: async (key: string) => {
        redisStorage.delete(key);
        return 1;
      },
    };

    redisService.setConnectedForTesting(true, mockRedisClient);

    prismaMock = {
      showtime: {
        findUnique: async () => ({
          id: 'st_concurrency_1',
          startTime: new Date(Date.now() + 3600 * 1000),
        }),
      },
      showtimeSeat: {
        findMany: async () => [],
      },
    };

    websocketMock = {
      broadcastSeatState: () => {},
    };

    bookingService = new BookingService(
      prismaMock as any,
      redisService,
      websocketMock as any,
      configService,
    );
  });

  it('Two users attempt to reserve the exact same seat simultaneously: Exactly one succeeds', async () => {
    const showtimeId = 'st_concurrency_1';
    const seatId = 'E5';

    // Alice and Bob send requests concurrently at the same time
    const requestAlice = bookingService.holdSeats('user_alice', {
      showtimeId,
      seatIds: [seatId],
    });

    const requestBob = bookingService.holdSeats('user_bob', {
      showtimeId,
      seatIds: [seatId],
    });

    const results = await Promise.allSettled([requestAlice, requestBob]);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');

    // EXACTLY ONE user must succeed
    expect(fulfilled.length).toBe(1);

    // EXACTLY ONE user must be rejected with Conflict
    expect(rejected.length).toBe(1);

    const winner = (fulfilled[0] as PromiseFulfilledResult<any>).value;
    expect(winner.heldSeats).toEqual([seatId]);
    expect(winner.reservationId).toBeTruthy();

    const loser = (rejected[0] as PromiseRejectedResult).reason;
    expect(loser.message).toContain('currently reserved by another customer');

    // Verify in Redis store that the lock is held by the winner's reservation ID
    const currentHolder = await redisService.getSeatLockHolder(showtimeId, seatId);
    expect(currentHolder).toBe(winner.reservationId);
  });
});
