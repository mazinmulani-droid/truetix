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
      this.logger.log(`Redis Keyspace Notification: Seat ${seatId} showtime ${showtimeId} lock expired. Broadcast AVAILABLE.`);
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

  @SubscribeMessage('seat:select')
  async handleSeatSelect(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { showtimeId: string; seatId: string },
  ) {
    if (!data?.showtimeId || !data?.seatId) return;
    // Derive user identity strictly from verified JWT token
    const userId = client.data?.user?.sub;
    if (!userId) {
      client.emit('seat:error', { code: 'UNAUTHORIZED', message: 'User not authenticated' });
      return;
    }

    const locked = await this.redisService.acquireSeatLock(data.showtimeId, data.seatId, userId, 600);

    if (locked) {
      const expiresAt = new Date(Date.now() + 600 * 1000).toISOString();
      const payload = {
        showtimeId: data.showtimeId,
        seatId: data.seatId,
        status: 'HOLDING',
        heldByUserId: userId,
        expiresAt,
      };
      this.server.to(`showtime:${data.showtimeId}`).emit('seat:state_changed', payload);
    } else {
      client.emit('seat:error', {
        code: 'SEAT_ALREADY_HELD',
        message: `Seat ${data.seatId} is currently reserved by another customer`,
      });
    }
  }

  @SubscribeMessage('seat:deselect')
  async handleSeatDeselect(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { showtimeId: string; seatId: string },
  ) {
    if (!data?.showtimeId || !data?.seatId) return;
    // Derive user identity strictly from verified JWT token
    const userId = client.data?.user?.sub;
    if (!userId) {
      return;
    }

    // Atomic Lua release ensuring only the owner can release the lock
    const released = await this.redisService.releaseSeatLock(data.showtimeId, data.seatId, userId);
    if (released) {
      const payload = {
        showtimeId: data.showtimeId,
        seatId: data.seatId,
        status: 'AVAILABLE',
        heldByUserId: null,
        expiresAt: null,
      };
      this.server.to(`showtime:${data.showtimeId}`).emit('seat:state_changed', payload);
    }
  }

  /**
   * Broadcast seat state to all clients in the showtime room
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
