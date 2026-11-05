import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WebsocketGateway } from './websocket.gateway';

describe('WebsocketGateway Tests', () => {
  let gateway: WebsocketGateway;
  let redisMock: any;
  let jwtMock: any;
  let configMock: any;

  beforeEach(() => {
    redisMock = {
      setSeatExpiredCallback: vi.fn(),
    };
    jwtMock = {
      verify: vi.fn(),
    };
    configMock = {
      get: vi.fn().mockReturnValue('truetix_jwt_super_secret_key_2026'),
    };

    gateway = new WebsocketGateway(redisMock, jwtMock, configMock);
  });

  it('Unauthenticated WebSocket connection without token is immediately rejected and disconnected', () => {
    const socketMock: any = {
      id: 'sock_unauth_1',
      handshake: {
        auth: {},
        headers: {},
      },
      emit: vi.fn(),
      disconnect: vi.fn(),
      data: {},
    };

    gateway.handleConnection(socketMock);

    expect(socketMock.emit).toHaveBeenCalledWith('auth_error', { message: 'Authentication required' });
    expect(socketMock.disconnect).toHaveBeenCalledWith(true);
    expect(socketMock.data.user).toBeUndefined();
  });

  it('Rejects connection when token verification fails', () => {
    const socketMock: any = {
      id: 'sock_invalid_1',
      handshake: {
        auth: { token: 'invalid_garbage_token' },
      },
      emit: vi.fn(),
      disconnect: vi.fn(),
      data: {},
    };

    jwtMock.verify.mockImplementation(() => {
      throw new Error('jwt malformed');
    });

    gateway.handleConnection(socketMock);

    expect(socketMock.emit).toHaveBeenCalledWith('auth_error', { message: 'Invalid token' });
    expect(socketMock.disconnect).toHaveBeenCalledWith(true);
    expect(socketMock.data.user).toBeUndefined();
  });

  it('Successfully authenticates connection and stores user identity from verified JWT token', () => {
    const socketMock: any = {
      id: 'sock_valid_1',
      handshake: {
        auth: { token: 'valid.jwt.token' },
      },
      emit: vi.fn(),
      disconnect: vi.fn(),
      data: {},
    };

    jwtMock.verify.mockReturnValue({ sub: 'user_123', email: 'user@example.com', role: 'CUSTOMER' });

    gateway.handleConnection(socketMock);

    expect(socketMock.disconnect).not.toHaveBeenCalled();
    expect(socketMock.data.user).toEqual({ sub: 'user_123', email: 'user@example.com', role: 'CUSTOMER' });
  });

  it('WebSocket Gateway does not independently mutate seat locks (REST is the single authority)', () => {
    // Assert that the gateway does not expose seat:select / seat:deselect mutation methods
    expect((gateway as any).handleSeatSelect).toBeUndefined();
    expect((gateway as any).handleSeatDeselect).toBeUndefined();
  });
});
