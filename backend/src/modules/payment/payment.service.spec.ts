import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PaymentService } from './payment.service';
import { BadRequestException } from '@nestjs/common';

describe('PaymentService Scenarios', () => {
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
      user: {
        update: vi.fn(),
      },
      userVoucher: {
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

  // Scenario 8: A successful payment marks the booking paid
  it('Scenario 8: A successful payment marks the booking paid and seats as SOLD', async () => {
    const bookingId = 'bkg_1001';
    const amount = 500;
    const signature = service.generatePaymentSignature(bookingId, amount);

    prismaMock.booking.findUnique.mockResolvedValue({
      id: bookingId,
      status: 'PENDING_PAYMENT',
      totalAmount: amount,
      showtimeId: 'st_123',
      userId: 'usr_alice',
      cgvPointsEarned: 10,
      cgvPointsUsed: 0,
      tickets: [{ seatId: 'A1' }, { seatId: 'A2' }],
    });

    // Atomic update updates 1 record
    prismaMock.booking.updateMany.mockResolvedValue({ count: 1 });

    const result = await service.processSuccessfulPayment(bookingId, amount, signature);

    expect(result.success).toBe(true);
    expect(prismaMock.booking.updateMany).toHaveBeenCalledWith({
      where: { id: bookingId, status: 'PENDING_PAYMENT' },
      data: { status: 'PAID', paymentMethod: 'MOCK_GATEWAY' },
    });
    // Check that seats were transitioned to SOLD
    expect(prismaMock.showtimeSeat.updateMany).toHaveBeenCalledWith({
      where: { showtimeId: 'st_123', seatId: { in: ['A1', 'A2'] } },
      data: { status: 'SOLD' },
    });
    // Redis lock force-released
    expect(redisMock.forceReleaseSeatLock).toHaveBeenCalledWith('st_123', 'A1');
    expect(redisMock.forceReleaseSeatLock).toHaveBeenCalledWith('st_123', 'A2');
  });

  // Scenario 9: Repeated payment callbacks do not create duplicates (Idempotency)
  it('Scenario 9: Repeated payment callbacks do not create duplicates or increment points twice', async () => {
    const bookingId = 'bkg_1001';
    const amount = 500;
    const signature = service.generatePaymentSignature(bookingId, amount);

    // Initial state: booking is ALREADY PAID
    prismaMock.booking.findUnique.mockResolvedValue({
      id: bookingId,
      status: 'PAID',
      totalAmount: amount,
      showtimeId: 'st_123',
      userId: 'usr_alice',
      tickets: [{ seatId: 'A1' }],
    });

    const result = await service.processSuccessfulPayment(bookingId, amount, signature);

    // Safely returns success with idempotent message
    expect(result.success).toBe(true);
    expect(result.message).toContain('idempotent');

    // Crucial: $transaction was NOT executed again, no double point updates or seat updates!
    expect(prismaMock.booking.updateMany).not.toHaveBeenCalled();
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });

  it('Rejects payment callback when amount does not match expected booking total', async () => {
    const bookingId = 'bkg_1001';

    prismaMock.booking.findUnique.mockResolvedValue({
      id: bookingId,
      status: 'PENDING_PAYMENT',
      totalAmount: 500,
      tickets: [],
    });

    // Attacker sends amount 1 instead of 500
    await expect(service.processSuccessfulPayment(bookingId, 1)).rejects.toThrow(
      BadRequestException,
    );
  });
});
