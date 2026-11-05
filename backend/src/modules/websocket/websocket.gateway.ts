import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { OnModuleInit, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { RedisService } from '../redis/redis.service';

/**
 * WebsocketGateway handles real-time bi-directional communication with clients.
 *
 * ARCHITECTURAL PRINCIPLE:
 * The gateway does NOT mutate booking or seat state. REST BookingService is the sole authority
 * for holding, releasing, and checking out seats. The gateway strictly handles:
 * 1. Connection authentication via JWT handshakes.
 * 2. Room subscriptions (showtime:{id}).
 * 3. Broadcasting state transitions triggered by authoritative backend services.
 */
@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
@Injectable()
export class WebsocketGateway implements OnGatewayConnection, OnGatewayDisconnect, OnModuleInit {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(WebsocketGateway.name);

  constructor(
    private readonly redisService: RedisService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  onModuleInit() {
    this.redisService.setSeatExpiredCallback((showtimeId, seatId) => {
      this.logger.log(`Seat ${seatId} showtime ${showtimeId} lock expired. Broadcasting AVAILABLE.`);
      this.broadcastSeatState(showtimeId, seatId, 'AVAILABLE');
    });
  }

  handleConnection(client: Socket) {
    const rawToken =
      client.handshake.auth?.token ||
      (client.handshake.headers?.authorization
        ? client.handshake.headers.authorization.replace(/^Bearer\s+/i, '')
        : null);

    if (!rawToken) {
      this.logger.warn(`Rejecting unauthenticated socket connection: ${client.id}`);
      client.emit('auth_error', { message: 'Authentication required' });
      client.disconnect(true);
      return;
    }

    try {
      const jwtSecret = this.configService.get<string>('JWT_SECRET', 'truetix_jwt_super_secret_key_2026');
      const payload = this.jwtService.verify(rawToken, { secret: jwtSecret });
      client.data.user = payload;
      this.logger.log(`Authenticated Socket connected: ${client.id} (user: ${payload.sub})`);
    } catch (err: any) {
      this.logger.warn(`Socket authentication failed for ${client.id}: ${err.message}`);
      client.emit('auth_error', { message: 'Invalid token' });
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Socket disconnected: ${client.id}`);
  }

  @SubscribeMessage('join:showtime')
  handleJoinShowtime(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { showtimeId: string },
  ) {
    if (!data?.showtimeId) return;
    const room = `showtime:${data.showtimeId}`;
    client.join(room);
    this.logger.log(`Client ${client.id} joined showtime room: ${room}`);
  }

  /**
   * Authoritative broadcast method called by BookingService and PaymentService.
   * Broadcasts seat state transitions (AVAILABLE, HOLDING, SOLD) to all clients in the showtime room.
   */
  broadcastSeatState(
    showtimeId: string,
    seatId: string,
    status: string,
    heldByUserId: string | null = null,
    expiresAt: string | null = null,
  ) {
    if (!this.server) return;
    this.server.to(`showtime:${showtimeId}`).emit('seat:state_changed', {
      showtimeId,
      seatId,
      status,
      heldByUserId,
      expiresAt,
    });
  }
}
