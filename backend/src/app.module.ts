import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './modules/prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { CityModule } from './modules/city/city.module';
import { CinemaModule } from './modules/cinema/cinema.module';
import { MovieModule } from './modules/movie/movie.module';
import { ShowtimeModule } from './modules/showtime/showtime.module';
import { HomeModule } from './modules/home/home.module';
import { RedisModule } from './modules/redis/redis.module';
import { WebsocketModule } from './modules/websocket/websocket.module';
import { BookingModule } from './modules/booking/booking.module';
import { PaymentModule } from './modules/payment/payment.module';
import { TicketModule } from './modules/ticket/ticket.module';
import { AppController } from './app.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    PrismaModule,
    RedisModule,
    WebsocketModule,
    AuthModule,
    UsersModule,
    CityModule,
    CinemaModule,
    MovieModule,
    ShowtimeModule,
    HomeModule,
    BookingModule,
    PaymentModule,
    TicketModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
