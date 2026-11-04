import { Controller, Get, Post, Param, Body, Headers, UseGuards, Req, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiHeader } from '@nestjs/swagger';
import { TicketService } from './ticket.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@ApiTags('Tickets & QR Check-in Scanner')
@Controller('tickets')
export class TicketController {
  constructor(private readonly ticketService: TicketService) {}

  @Get('my-tickets')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'View purchased e-tickets for current authenticated user' })
  async getMyTickets(@Req() req: any) {
    return this.ticketService.getUserTickets(req.user.id);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'View e-ticket details (with ownership check)' })
  async getTicketDetail(@Req() req: any, @Param('id') id: string) {
    return this.ticketService.getTicketDetail(id, req.user.id);
  }

  @Post('verify-qr')
  @ApiOperation({ summary: 'Verify and check-in QR ticket at cinema turnstile' })
  @ApiHeader({ name: 'X-Scanner-Key', description: 'Secret Key issued to turnstile scanner device' })
  async verifyQrTicket(
    @Headers('x-scanner-key') scannerKey: string,
    @Body('qrToken') qrToken?: string,
    @Body('qrPayload') qrPayload?: string,
  ) {
    const token = qrToken || qrPayload;
    if (!token) {
      throw new BadRequestException('qrToken or qrPayload is required');
    }
    return this.ticketService.verifyQrTicket(scannerKey, token);
  }
}
