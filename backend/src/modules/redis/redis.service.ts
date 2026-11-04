import { Injectable, OnModuleDestroy, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis | null = null;
  private subClient: Redis | null = null;
  private isConnected = false;

  // In-memory fallback map for development/testing when Redis is unreachable
  private readonly memoryStore = new Map<string, { value: string; expiresAt: number }>();

  // Atomic Compare-And-Delete Lua script: deletes lock only if stored owner token matches ARGV[1]
  private readonly LUA_COMPARE_AND_DELETE = `
    if redis.call("get", KEYS[1]) == ARGV[1] then
      return redis.call("del", KEYS[1])
    else
      return 0
    end
  `;

  private onSeatExpiredCallback: ((showtimeId: string, seatId: string) => void) | null = null;
  private fallbackInterval: NodeJS.Timeout | null = null;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    const host = this.configService.get<string>('REDIS_HOST', 'localhost');
    const port = this.configService.get<number>('REDIS_PORT', 6379);

    try {
      this.client = new Redis({
        host,
        port,
        retryStrategy: (times) => {
          if (times > 3) {
            this.logger.warn('Falling back to In-Memory store because Redis connection could not be established');
            return null;
          }
          return Math.min(times * 100, 2000);
        },
        lazyConnect: true,
      });

      this.client.connect().then(() => {
        this.isConnected = true;
        this.logger.log(`Connected to Redis at ${host}:${port}`);
        this.setupKeyspaceSubscriber(host, port);
      }).catch((err) => {
        this.logger.warn(`Redis connection failed: ${err.message}. Using In-Memory fallback store.`);
        this.setupFallbackInterval();
      });
    } catch (error) {
      this.logger.warn('Using In-Memory fallback store for Redis');
      this.setupFallbackInterval();
    }
  }

  setSeatExpiredCallback(cb: (showtimeId: string, seatId: string) => void) {
    this.onSeatExpiredCallback = cb;
  }

  private setupKeyspaceSubscriber(host: string, port: number) {
    try {
      this.subClient = new Redis({ host, port, lazyConnect: true });
      this.subClient.connect().then(() => {
        // Enable keyspace notifications for expired keys (Ex)
        this.client?.config('SET', 'notify-keyspace-events', 'Ex').catch(() => {});
        this.subClient?.subscribe('__keyevent@0__:expired').catch(() => {});
        
        this.subClient?.on('message', (channel, message) => {
          if (channel === '__keyevent@0__:expired' && message.startsWith('lock:seat:')) {
            const parts = message.split(':');
            if (parts.length >= 4) {
              const showtimeId = parts[2];
              const seatId = parts[3];
              if (this.onSeatExpiredCallback) {
                this.onSeatExpiredCallback(showtimeId, seatId);
              }
            }
          }
        });
      }).catch(() => {});
    } catch (e) {}
  }

  private setupFallbackInterval() {
    if (this.fallbackInterval) return;
    this.fallbackInterval = setInterval(() => {
      const now = Date.now();
      for (const [key, data] of this.memoryStore.entries()) {
        if (data.expiresAt <= now) {
          this.memoryStore.delete(key);
          if (key.startsWith('lock:seat:')) {
            const parts = key.split(':');
            if (parts.length >= 4 && this.onSeatExpiredCallback) {
              this.onSeatExpiredCallback(parts[2], parts[3]);
            }
          }
        }
      }
    }, 1000);
  }

  onModuleDestroy() {
    this.client?.disconnect();
    this.subClient?.disconnect();
    if (this.fallbackInterval) {
      clearInterval(this.fallbackInterval);
    }
  }

  /**
   * Atomically acquires a distributed seat lock:
   * SET lock:seat:{showtimeId}:{seatId} {ownerToken} NX EX {ttlSeconds}
   */
  async acquireSeatLock(showtimeId: string, seatId: string, ownerToken: string, ttlSeconds = 600): Promise<boolean> {
    const key = `lock:seat:${showtimeId}:${seatId}`;
    if (this.isConnected && this.client) {
      const res = await this.client.set(key, ownerToken, 'EX', ttlSeconds, 'NX');
      return res === 'OK';
    }

    // Fallback In-Memory logic
    const now = Date.now();
    const existing = this.memoryStore.get(key);
    if (existing && existing.expiresAt > now) {
      return false;
    }
    this.memoryStore.set(key, { value: ownerToken, expiresAt: now + ttlSeconds * 1000 });
    return true;
  }

  /**
   * Atomically releases a seat lock using a Lua script (compare-and-delete).
   * Deletes the key ONLY if the stored value matches ownerToken.
   */
  async releaseSeatLock(showtimeId: string, seatId: string, ownerToken: string): Promise<boolean> {
    const key = `lock:seat:${showtimeId}:${seatId}`;
    if (this.isConnected && this.client) {
      const res = await this.client.eval(this.LUA_COMPARE_AND_DELETE, 1, key, ownerToken);
      return res === 1;
    }

    const existing = this.memoryStore.get(key);
    if (!existing) {
      return true;
    }
    if (existing.value === ownerToken) {
      this.memoryStore.delete(key);
      return true;
    }
    return false;
  }

  /**
   * Unconditional release for system-level finalization (e.g. after booking is confirmed PAID in PostgreSQL)
   */
  async forceReleaseSeatLock(showtimeId: string, seatId: string): Promise<boolean> {
    const key = `lock:seat:${showtimeId}:${seatId}`;
    if (this.isConnected && this.client) {
      await this.client.del(key);
      return true;
    }
    this.memoryStore.delete(key);
    return true;
  }

  /**
   * Retrieves the current holder of a seat lock
   */
  async getSeatLockHolder(showtimeId: string, seatId: string): Promise<string | null> {
    const key = `lock:seat:${showtimeId}:${seatId}`;
    if (this.isConnected && this.client) {
      return await this.client.get(key);
    }
    const existing = this.memoryStore.get(key);
    if (existing && existing.expiresAt > Date.now()) {
      return existing.value;
    }
    return null;
  }

  /**
   * Retrieves remaining TTL in seconds for a seat lock
   */
  async getSeatLockTtl(showtimeId: string, seatId: string): Promise<number> {
    const key = `lock:seat:${showtimeId}:${seatId}`;
    if (this.isConnected && this.client) {
      return await this.client.ttl(key);
    }
    const existing = this.memoryStore.get(key);
    if (existing && existing.expiresAt > Date.now()) {
      return Math.max(0, Math.floor((existing.expiresAt - Date.now()) / 1000));
    }
    return -2;
  }

  /**
   * Pub/Sub broadcast
   */
  async publish(channel: string, message: string): Promise<number> {
    if (this.isConnected && this.client) {
      return await this.client.publish(channel, message);
    }
    return 0;
  }
}
