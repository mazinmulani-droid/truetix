import { Controller, Post, Get, Body, Param, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { BookingService } from './booking.service';
import { HoldSeatDto } from './dto/hold-seat.dto';
import { CheckoutBookingDto } from './dto/checkout-booking.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@ApiTags('Booking & Seat Holding')
@Controller('bookings')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class BookingController {
  constructor(private readonly bookingService: BookingService) {}

  @Post('hold-seat')
  @ApiOperation({ summary: 'Hold seats temporarily with Redis Redlock (10-minute TTL)' })
  async holdSeat(@Req() req: any, @Body() dto: HoldSeatDto) {
    return this.bookingService.holdSeats(req.user.id, dto);
  }

  @Post('release-seat')
  @ApiOperation({ summary: 'Release temporarily held seats (authenticated owner only)' })
  async releaseSeat(@Req() req: any, @Body() dto: HoldSeatDto) {
    return this.bookingService.releaseSeats(req.user.id, dto);
  }

  @Post('checkout')
  @ApiOperation({ summary: 'Initialize checkout and create movie booking record' })
  async checkout(@Req() req: any, @Body() dto: CheckoutBookingDto) {
    return this.bookingService.checkout(req.user.id, dto);
  }

  @Get('my-bookings')
  @ApiOperation({ summary: 'Get current user booking history' })
  async getMyBookings(@Req() req: any) {
    return this.bookingService.getUserBookings(req.user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get booking details by ID (with ownership check)' })
  async getBookingDetail(@Req() req: any, @Param('id') id: string) {
    return this.bookingService.getBookingById(req.user.id, id);
  }
}
