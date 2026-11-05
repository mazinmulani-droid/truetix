import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PaymentService } from './payment.service';
import { BadRequestException, ConflictException } from '@nestjs/common';

describe('PaymentService Tests', () => {
  let service: PaymentService;
  let prismaMock: any;
  let configMock: any;
  let websocketMock: any;
  let redisMock: any;

  beforeEach(() => {
    prismaMock = {
      booking: {
        findUnique: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
      },
      showtimeSeat: {
        updateMany: vi.fn(),
      },
      $transaction: vi.fn(async (cb) => cb(prismaMock)),
    };

    configMock = {
      get: vi.fn((key: string, defaultVal: string) => {
        if (key === 'PAYMENT_HMAC_SECRET') return 'truetix_mock_payment_secret_2026';
        if (key === 'FRONTEND_URL') return 'http://localhost:3000';
        return defaultVal;
      }),
    };

    websocketMock = {
      broadcastSeatState: vi.fn(),
    };

    redisMock = {
      forceReleaseSeatLock: vi.fn().mockResolvedValue(true),
    };

    service = new PaymentService(prismaMock, configMock, websocketMock, redisMock);
  });

  it('A successful payment marks the booking paid and seats as SOLD', async () => {
    const bookingId = 'bkg_1001';
    const amount = 500;
    const signature = service.generatePaymentSignature(bookingId, amount);

    prismaMock.booking.findUnique.mockResolvedValue({
      id: bookingId,
      status: 'PENDING_PAYMENT',
      totalAmount: amount,
      showtimeId: 'st_123',
      userId: 'usr_alice',
      tickets: [{ seatId: 'A1' }, { seatId: 'A2' }],
    });

    prismaMock.booking.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.showtimeSeat.updateMany.mockResolvedValue({ count: 2 });

    const result = await service.processSuccessfulPayment(bookingId, amount, signature);

    expect(result.success).toBe(true);
    expect(prismaMock.booking.updateMany).toHaveBeenCalledWith({
      where: { id: bookingId, status: 'PENDING_PAYMENT' },
      data: { status: 'PAID', paymentMethod: 'MOCK_GATEWAY' },
    });
    expect(prismaMock.showtimeSeat.updateMany).toHaveBeenCalledWith({
      where: { showtimeId: 'st_123', seatId: { in: ['A1', 'A2'] }, status: { not: 'SOLD' } },
      data: { status: 'SOLD' },
    });
    // Post-commit Redis lock cleanup
    expect(redisMock.forceReleaseSeatLock).toHaveBeenCalledWith('st_123', 'A1');
    expect(redisMock.forceReleaseSeatLock).toHaveBeenCalledWith('st_123', 'A2');
  });

  it('Repeated payment callbacks return idempotent cached success without re-executing transitions', async () => {
    const bookingId = 'bkg_1001';
    const amount = 500;
    const signature = service.generatePaymentSignature(bookingId, amount);

    // Initial state: booking is already PAID
    prismaMock.booking.findUnique.mockResolvedValue({
      id: bookingId,
      status: 'PAID',
      totalAmount: amount,
      showtimeId: 'st_123',
      userId: 'usr_alice',
      tickets: [{ seatId: 'A1' }],
    });

    const result = await service.processSuccessfulPayment(bookingId, amount, signature);

    expect(result.success).toBe(true);
    expect(result.message).toContain('idempotent');

    // Database transaction was NOT executed again
    expect(prismaMock.booking.updateMany).not.toHaveBeenCalled();
    expect(prismaMock.showtimeSeat.updateMany).not.toHaveBeenCalled();
  });

  it('Rejects payment callback when signature is missing', async () => {
    const bookingId = 'bkg_1001';
    await expect(service.processSuccessfulPayment(bookingId, 500, '')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('Rejects payment callback when signature is forged or invalid', async () => {
    const bookingId = 'bkg_1001';
    prismaMock.booking.findUnique.mockResolvedValue({
      id: bookingId,
      status: 'PENDING_PAYMENT',
      totalAmount: 500,
      tickets: [],
    });

    await expect(
      service.processSuccessfulPayment(bookingId, 500, 'forged_fake_signature_12345678'),
    ).rejects.toThrow(BadRequestException);
  });

  it('Rejects payment callback when amount does not match expected booking total', async () => {
    const bookingId = 'bkg_1001';
    const correctSignature = service.generatePaymentSignature(bookingId, 1);

    prismaMock.booking.findUnique.mockResolvedValue({
      id: bookingId,
      status: 'PENDING_PAYMENT',
      totalAmount: 500,
      tickets: [],
    });

    // Attacker sends amount 1 instead of 500
    await expect(service.processSuccessfulPayment(bookingId, 1, correctSignature)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('Payment seat update count mismatch triggers transaction rollback', async () => {
    const bookingId = 'bkg_1001';
    const amount = 500;
    const signature = service.generatePaymentSignature(bookingId, amount);

    prismaMock.booking.findUnique.mockResolvedValue({
      id: bookingId,
      status: 'PENDING_PAYMENT',
      totalAmount: amount,
      showtimeId: 'st_123',
      userId: 'usr_alice',
      tickets: [{ seatId: 'A1' }, { seatId: 'A2' }],
    });

    prismaMock.booking.updateMany.mockResolvedValue({ count: 1 });
    // Only 1 seat updated when 2 expected (mismatch)
    prismaMock.showtimeSeat.updateMany.mockResolvedValue({ count: 1 });

    await expect(service.processSuccessfulPayment(bookingId, amount, signature)).rejects.toThrow(
      ConflictException,
    );
  });
});
