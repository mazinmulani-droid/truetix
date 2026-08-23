import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

@ApiTags('Root')
@Controller()
export class AppController {
  @Get()
  @ApiOperation({ summary: 'API Root Health & Info' })
  getRoot() {
    return {
      name: 'TrueTix Film Ticket Platform API',
      status: 'online',
      version: '1.0.0',
      docs: '/api/docs',
      apiPrefix: '/api/v1',
      timestamp: new Date().toISOString(),
    };
  }
}
