import {
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

/**
 * RedisService manages ephemeral seat reservations using single-instance Redis distributed locking.
 *
 * Key Concepts:
 * 1. SET lock:seat:{showtimeId}:{seatId} {reservationId} NX EX 600
 *    - NX: Only set if the key does not already exist (guarantees mutual exclusion).
 *    - EX 600: Automatically expires the lock after 10 minutes (prevents deadlocks from abandoned sessions).
 * 2. Atomic Lua Compare-and-Delete:
 *    - Safely releases a lock only if the stored reservation token matches the requester.
 * 3. Authority & Failure Policy:
 *    - Redis is the single authority for temporary holds.
 *    - If Redis is unavailable, requests fail safely with ServiceUnavailableException.
 *    - We never silently fall back to process-local in-memory locks.
 */
@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis | null = null;
  private subClient: Redis | null = null;
  private isConnected = false;

  // Atomic Compare-And-Delete Lua script: deletes lock only if stored owner token matches ARGV[1]
  private readonly LUA_COMPARE_AND_DELETE = `
    if redis.call("get", KEYS[1]) == ARGV[1] then
      return redis.call("del", KEYS[1])
    else
      return 0
    end
  `;

  private onSeatExpiredCallback: ((showtimeId: string, seatId: string) => void) | null = null;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    const host = this.configService.get<string>('REDIS_HOST', 'localhost');
    const port = this.configService.get<number>('REDIS_PORT', 6379);

    try {
      this.client = new Redis({
        host,
        port,
        maxRetriesPerRequest: 1,
        retryStrategy: (times) => {
          if (times > 3) {
            this.logger.error(`Redis connection failed after ${times} attempts. Distributed locking is offline.`);
            return null;
          }
          return Math.min(times * 100, 1000);
        },
        lazyConnect: true,
      });

      this.client
        .connect()
        .then(() => {
          this.isConnected = true;
          this.logger.log(`Connected to Redis at ${host}:${port}`);
          this.setupKeyspaceSubscriber(host, port);
        })
        .catch((err) => {
          this.isConnected = false;
          this.logger.error(`Redis connection failed: ${err.message}. Seat locking is unavailable.`);
        });
    } catch (error: any) {
      this.isConnected = false;
      this.logger.error(`Redis initialization error: ${error.message}`);
    }
  }

  setSeatExpiredCallback(cb: (showtimeId: string, seatId: string) => void) {
    this.onSeatExpiredCallback = cb;
  }

  private setupKeyspaceSubscriber(host: string, port: number) {
    try {
      this.subClient = new Redis({ host, port, lazyConnect: true });
      this.subClient
        .connect()
        .then(() => {
          this.client?.config('SET', 'notify-keyspace-events', 'Ex').catch(() => {});
          this.subClient?.subscribe('__keyevent@0__:expired').catch(() => {});

          this.subClient?.on('message', (channel, message) => {
            if (channel === '__keyevent@0__:expired' && message.startsWith('lock:seat:')) {
              const parts = message.split(':');
              if (parts.length >= 4 && this.onSeatExpiredCallback) {
                const showtimeId = parts[2];
                const seatId = parts[3];
                this.onSeatExpiredCallback(showtimeId, seatId);
              }
            }
          });
        })
        .catch(() => {});
    } catch {
      // Keyspace notifications are an optional enhancement; main locking does not depend on it
    }
  }

  onModuleDestroy() {
    this.client?.disconnect();
    this.subClient?.disconnect();
  }

  /**
   * Asserts that Redis is actively connected.
   * Throws ServiceUnavailableException if Redis is down so requests fail safely.
   */
  private assertRedisAvailable(): Redis {
    if (!this.isConnected || !this.client) {
      throw new ServiceUnavailableException('Redis distributed locking service is unavailable');
    }
    return this.client;
  }

  /**
   * Atomically acquires a distributed seat lock:
   * SET lock:seat:{showtimeId}:{seatId} {ownerToken} NX EX {ttlSeconds}
   *
   * @param showtimeId ID of the showtime
   * @param seatId Identifier of the seat (e.g. "E5")
   * @param ownerToken Unique reservation session token
   * @param ttlSeconds Lock timeout in seconds (default: 600s / 10 minutes)
   * @returns true if lock was acquired, false if seat is already locked
   */
  async acquireSeatLock(
    showtimeId: string,
    seatId: string,
    ownerToken: string,
    ttlSeconds = 600,
  ): Promise<boolean> {
    const client = this.assertRedisAvailable();
    const key = `lock:seat:${showtimeId}:${seatId}`;
    const res = await client.set(key, ownerToken, 'EX', ttlSeconds, 'NX');
    return res === 'OK';
  }

  /**
   * Atomically releases a seat lock using a Lua script (compare-and-delete).
   * Deletes the key ONLY if the stored value matches ownerToken.
   *
   * @returns true if the lock was owned and deleted, false otherwise
   */
  async releaseSeatLock(showtimeId: string, seatId: string, ownerToken: string): Promise<boolean> {
    const client = this.assertRedisAvailable();
    const key = `lock:seat:${showtimeId}:${seatId}`;
    const res = await client.eval(this.LUA_COMPARE_AND_DELETE, 1, key, ownerToken);
    return res === 1;
  }

  /**
   * Unconditional lock release for system-level payment finalization.
   * Used strictly after PostgreSQL transaction commits and marks the seat as SOLD.
   */
  async forceReleaseSeatLock(showtimeId: string, seatId: string): Promise<boolean> {
    const client = this.assertRedisAvailable();
    const key = `lock:seat:${showtimeId}:${seatId}`;
    await client.del(key);
    return true;
  }

  /**
   * Retrieves the current owner token of a seat lock, or null if unreserved/expired.
   */
  async getSeatLockHolder(showtimeId: string, seatId: string): Promise<string | null> {
    const client = this.assertRedisAvailable();
    const key = `lock:seat:${showtimeId}:${seatId}`;
    return await client.get(key);
  }

  /**
   * Retrieves remaining TTL in seconds for a seat lock.
   * Returns -2 if key does not exist.
   */
  async getSeatLockTtl(showtimeId: string, seatId: string): Promise<number> {
    const client = this.assertRedisAvailable();
    const key = `lock:seat:${showtimeId}:${seatId}`;
    return await client.ttl(key);
  }

  /**
   * Helper for unit tests to directly set connection state
   */
  setConnectedForTesting(status: boolean, mockClient?: any) {
    this.isConnected = status;
    if (mockClient) {
      this.client = mockClient;
    }
  }
}
