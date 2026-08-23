import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import * as express from 'express';
import { join } from 'path';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Phục vụ các tập tin ảnh được upload tĩnh tại /uploads
  app.use('/uploads', express.static(join(process.cwd(), 'uploads')));

  // Set Global API Prefix (except root /)
  app.setGlobalPrefix('api/v1', {
    exclude: ['/'],
  });

  // CORS Policy
  app.enableCors({
    origin: true,
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
  console.log(`🚀 TrueTix Backend Server running on http://0.0.0.0:${port}`);
  console.log(`📚 Swagger API Docs available at http://0.0.0.0:${port}/api/docs`);
}

bootstrap();
