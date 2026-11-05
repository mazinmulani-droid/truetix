import { Controller, Get, Post, Body, Query, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { PaymentService } from './payment.service';

@ApiTags('Payment Gateways (Mock Sandbox)')
@Controller('payments')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @Post('mock/create-url')
  @ApiOperation({ summary: 'Create signed mock payment gateway URL and QR code' })
  async createMockPaymentUrl(@Body() body: { bookingId: string; amount: number }) {
    if (!body?.bookingId || body.amount === undefined) {
      throw new BadRequestException('bookingId and amount are required');
    }
    return this.paymentService.createMockPaymentUrl(body.bookingId, Number(body.amount));
  }

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

    if (status === 'CANCELLED' || status === 'FAILED') {
      return this.paymentService.processFailedPayment(bookingId);
    }

    if (!signature) {
      throw new BadRequestException('signature is required');
    }

    return this.paymentService.processSuccessfulPayment(
      bookingId,
      Number(amount),
      signature,
      'MOCK_GATEWAY',
    );
  }
}
