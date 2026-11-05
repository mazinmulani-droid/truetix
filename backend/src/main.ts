import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  // Validate critical security environment variables on startup
  const criticalSecrets = [
    'JWT_SECRET',
    'JWT_REFRESH_SECRET',
    'TICKET_HMAC_SECRET',
    'PAYMENT_HMAC_SECRET',
  ];

  for (const secret of criticalSecrets) {
    if (!process.env[secret]) {
      if (process.env.NODE_ENV === 'production') {
        throw new Error(`CRITICAL: Mandatory security environment variable [${secret}] is not set!`);
      } else {
        logger.warn(`Security Notice: [${secret}] is not set in environment. Using development default.`);
      }
    }
  }

  const app = await NestFactory.create(AppModule);

  // Set Global API Prefix (except root /)
  app.setGlobalPrefix('api/v1', {
    exclude: ['/'],
  });

  // CORS Policy: restrict to configured FRONTEND_URL in production, allow localhost in development
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  app.enableCors({
    origin: process.env.NODE_ENV === 'production' ? [frontendUrl] : true,
    credentials: true,
  });

  // Global Validation Pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Global Interceptor & Filter
  app.useGlobalInterceptors(new TransformInterceptor());
  app.useGlobalFilters(new AllExceptionsFilter());

  // Swagger Documentation Setup
  const config = new DocumentBuilder()
    .setTitle('TrueTix Film Ticket Platform API Docs')
    .setDescription('Official API Documentation for TrueTix Film Ticket Booking Platform')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT || 4000;
  await app.listen(port, '0.0.0.0');
  logger.log(`🚀 TrueTix Backend Server running on http://0.0.0.0:${port}`);
  logger.log(`📚 Swagger API Docs available at http://0.0.0.0:${port}/api/docs`);
}

bootstrap();
