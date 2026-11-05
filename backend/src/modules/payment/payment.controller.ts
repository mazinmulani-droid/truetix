import { Controller, Get, Query, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { PaymentService } from './payment.service';

@ApiTags('Payment Gateways (Mock Sandbox)')
@Controller('payments')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @Get('mock/callback')
  @ApiOperation({ summary: 'Mock payment gateway callback handler with HMAC validation' })
  @ApiQuery({ name: 'bookingId', required: true })
  @ApiQuery({ name: 'amount', required: true })
  @ApiQuery({ name: 'status', required: false, description: 'SUCCESS or CANCELLED' })
  @ApiQuery({ name: 'signature', required: true, description: 'Cryptographic signature from payment gateway' })
  async handleMockCallback(
    @Query('bookingId') bookingId: string,
    @Query('amount') amount: string,
    @Query('signature') signature: string,
    @Query('status') status = 'SUCCESS',
  ) {
    if (!bookingId || !amount) {
      throw new BadRequestException('bookingId and amount are required');
    }

    if (!signature) {
      throw new BadRequestException('signature is required');
    }

    const numericAmount = Number(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      throw new BadRequestException('amount must be a valid positive number');
    }

    if (status === 'CANCELLED' || status === 'FAILED') {
      return this.paymentService.processFailedPayment(bookingId, numericAmount, signature);
    }

    return this.paymentService.processSuccessfulPayment(
      bookingId,
      numericAmount,
      signature,
      'MOCK_GATEWAY',
    );
  }
}
