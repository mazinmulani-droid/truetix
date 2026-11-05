import { describe, it, expect, beforeEach } from 'vitest';
import { BookingService } from './booking.service';
import { RedisService } from '../redis/redis.service';
import { ConfigService } from '@nestjs/config';

describe('Concurrency & Race Conditions — Seat Reservation', () => {
  let bookingService: BookingService;
  let redisService: RedisService;
  let prismaMock: any;
  let websocketMock: any;
  let paymentMock: any;
  let configService: ConfigService;

  beforeEach(() => {
    configService = new ConfigService({
      REDIS_URL: 'redis://localhost:6379',
      FRONTEND_URL: 'http://localhost:3000',
      TICKET_HMAC_SECRET: 'truetix_hmac_qr_secret_key_2026',
    });

    redisService = new RedisService(configService);

    // Create an atomic in-memory mock client implementing atomic SET NX EX semantics
    const store = new Map<string, { value: string; expiry: number }>();
    const mockRedisClient: any = {
      set: async (key: string, value: string, ...args: any[]) => {
        const hasNx = args.includes('NX');
        let ttlSeconds = 600;
        const exIdx = args.indexOf('EX');
        if (exIdx !== -1 && typeof args[exIdx + 1] === 'number') {
          ttlSeconds = args[exIdx + 1];
        }
        const now = Date.now();
        const existing = store.get(key);
        if (hasNx && existing && existing.expiry > now) {
          return null; // Key exists and not expired -> SET NX fails
        }
        store.set(key, { value, expiry: now + ttlSeconds * 1000 });
        return 'OK';
      },
      get: async (key: string) => {
        const now = Date.now();
        const existing = store.get(key);
        if (!existing || existing.expiry <= now) {
          store.delete(key);
          return null;
        }
        return existing.value;
      },
      del: async (key: string) => {
        return store.delete(key) ? 1 : 0;
      },
      eval: async (script: string, numKeys: number, key: string, expectedVal: string) => {
        const now = Date.now();
        const existing = store.get(key);
        if (existing && existing.expiry > now && existing.value === expectedVal) {
          store.delete(key);
          return 1;
        }
        return 0;
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
        findMany: async () => [{ seatId: 'E5', status: 'AVAILABLE', priceModifier: 1.0 }],
      },
    };

    websocketMock = {
      broadcastSeatState: () => {},
    };

    paymentMock = {
      generatePaymentSignature: () => 'sig_mock',
      verifyPaymentSignature: () => true,
    };

    bookingService = new BookingService(
      prismaMock as any,
      redisService,
      websocketMock as any,
      paymentMock as any,
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
  });
});
