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
  @ApiOperation({ summary: 'Mock payment gateway callback handler' })
  @ApiQuery({ name: 'bookingId', required: true })
  @ApiQuery({ name: 'amount', required: true })
  @ApiQuery({ name: 'status', required: false, description: 'SUCCESS or CANCELLED' })
  @ApiQuery({ name: 'signature', required: false })
  async handleMockCallback(
    @Query('bookingId') bookingId: string,
    @Query('amount') amount: string,
    @Query('status') status = 'SUCCESS',
    @Query('signature') signature?: string,
  ) {
    if (!bookingId || !amount) {
      throw new BadRequestException('bookingId and amount are required');
    }

    if (status === 'CANCELLED' || status === 'FAILED') {
      return this.paymentService.processFailedPayment(bookingId);
    }

    return this.paymentService.processSuccessfulPayment(
      bookingId,
      Number(amount),
      signature,
      'MOCK_GATEWAY',
    );
  }

  // Backwards compatibility alias for inpay / vnpay mock gateway
  @Get('inpay/callback')
  @Get('vnpay/callback')
  @ApiOperation({ summary: 'Legacy alias for mock gateway callback' })
  async handleLegacyCallback(
    @Query('inp_ResponseCode') inpCode?: string,
    @Query('inp_TxnRef') inpRef?: string,
    @Query('inp_Amount') inpAmt?: string,
    @Query('vnp_ResponseCode') vnpCode?: string,
    @Query('vnp_TxnRef') vnpRef?: string,
    @Query('vnp_Amount') vnpAmt?: string,
  ) {
    const code = inpCode || vnpCode || '00';
    const bookingId = inpRef || vnpRef;
    const amount = inpAmt || vnpAmt;

    if (!bookingId || !amount) {
      throw new BadRequestException('Missing booking reference or amount');
    }

    if (code !== '00') {
      return this.paymentService.processFailedPayment(bookingId);
    }

    return this.paymentService.processSuccessfulPayment(
      bookingId,
      Number(amount),
      undefined,
      'MOCK_GATEWAY',
    );
  }
}
