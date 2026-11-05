import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RedisService } from './redis.service';
import { ServiceUnavailableException } from '@nestjs/common';

describe('RedisService Tests', () => {
  let service: RedisService;
  let configMock: any;
  let mockRedisClient: any;

  beforeEach(() => {
    configMock = {
      get: vi.fn((key: string, defaultVal: any) => {
        if (key === 'REDIS_HOST') return 'localhost';
        if (key === 'REDIS_PORT') return 6379;
        return defaultVal;
      }),
    };

    service = new RedisService(configMock);
    mockRedisClient = {
      set: vi.fn(),
      eval: vi.fn(),
      del: vi.fn(),
      get: vi.fn(),
      ttl: vi.fn(),
      publish: vi.fn(),
    };
  });

  it('Throws ServiceUnavailableException when Redis is offline', async () => {
    // Service is not connected
    service.setConnectedForTesting(false);

    await expect(service.acquireSeatLock('st_1', 'A1', 'res_123')).rejects.toThrow(
      ServiceUnavailableException,
    );
    await expect(service.releaseSeatLock('st_1', 'A1', 'res_123')).rejects.toThrow(
      ServiceUnavailableException,
    );
    await expect(service.getSeatLockHolder('st_1', 'A1')).rejects.toThrow(
      ServiceUnavailableException,
    );
  });

  it('Successfully acquires lock when seat is available (SET NX EX)', async () => {
    service.setConnectedForTesting(true, mockRedisClient);
    mockRedisClient.set.mockResolvedValue('OK');

    const result = await service.acquireSeatLock('st_1', 'A1', 'res_123', 600);

    expect(result).toBe(true);
    expect(mockRedisClient.set).toHaveBeenCalledWith(
      'lock:seat:st_1:A1',
      'res_123',
      'EX',
      600,
      'NX',
    );
  });

  it('Returns false when lock is already held by someone else', async () => {
    service.setConnectedForTesting(true, mockRedisClient);
    mockRedisClient.set.mockResolvedValue(null);

    const result = await service.acquireSeatLock('st_1', 'A1', 'res_456', 600);

    expect(result).toBe(false);
  });

  it('Releases lock using Lua script when owner matches', async () => {
    service.setConnectedForTesting(true, mockRedisClient);
    mockRedisClient.eval.mockResolvedValue(1);

    const result = await service.releaseSeatLock('st_1', 'A1', 'res_123');

    expect(result).toBe(true);
    expect(mockRedisClient.eval).toHaveBeenCalledWith(
      expect.stringContaining('redis.call("get", KEYS[1]) == ARGV[1]'),
      1,
      'lock:seat:st_1:A1',
      'res_123',
    );
  });

  it('Fails to release lock when Lua script owner does not match', async () => {
    service.setConnectedForTesting(true, mockRedisClient);
    mockRedisClient.eval.mockResolvedValue(0);

    const result = await service.releaseSeatLock('st_1', 'A1', 'res_imposter');

    expect(result).toBe(false);
  });

  it('Force releases lock on payment completion', async () => {
    service.setConnectedForTesting(true, mockRedisClient);
    mockRedisClient.del.mockResolvedValue(1);

    const result = await service.forceReleaseSeatLock('st_1', 'A1');

    expect(result).toBe(true);
    expect(mockRedisClient.del).toHaveBeenCalledWith('lock:seat:st_1:A1');
  });
});
