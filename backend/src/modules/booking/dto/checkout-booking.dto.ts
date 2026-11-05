import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsInt, IsNotEmpty, IsOptional, IsString, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class ComboOrderItemDto {
  @ApiProperty({ example: 'cmb_01', description: 'Combo package ID' })
  @IsString()
  @IsNotEmpty()
  comboId: string;

  @ApiProperty({ example: 1, description: 'Quantity' })
  @IsInt()
  @Min(1)
  quantity: number;
}

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

  @ApiProperty({ type: [ComboOrderItemDto], required: false, description: 'Optional F&B snack combo add-ons' })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ComboOrderItemDto)
  comboIds?: ComboOrderItemDto[];

  @ApiProperty({ example: 'DISCOUNT10', required: false, description: 'Optional discount voucher code' })
  @IsOptional()
  @IsString()
  voucherCode?: string;
}
