import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsNotEmpty, IsString } from 'class-validator';

export class CheckoutBookingDto {
  @ApiProperty({ example: 'res_a1b2c3d4-e5f6-7890', description: 'Unique reservation session ID returned from hold-seats' })
  @IsString()
  @IsNotEmpty()
  reservationId: string;

  @ApiProperty({ example: 'st_456', description: 'Showtime ID' })
  @IsString()
  @IsNotEmpty()
  showtimeId: string;

  @ApiProperty({ example: ['E5', 'E6'], description: 'List of reserved seat IDs' })
  @IsArray()
  @IsString({ each: true })
  seatIds: string[];

  @ApiProperty({ example: 'MOCK_GATEWAY', description: 'Payment method (MOCK_GATEWAY)' })
  @IsString()
  @IsNotEmpty()
  paymentMethod: string;
}
