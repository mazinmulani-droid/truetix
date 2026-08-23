import { IsEmail, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class OAuthLoginDto {
  @IsEmail({}, { message: 'Invalid email address' })
  @IsNotEmpty({ message: 'Email cannot be empty' })
  email: string;

  @IsNotEmpty({ message: 'Full name cannot be empty' })
  @IsString()
  fullName: string;

  @IsOptional()
  @IsString()
  avatar?: string;

  @IsOptional()
  @IsString()
  provider?: string;

  @IsOptional()
  @IsString()
  googleId?: string;
}
