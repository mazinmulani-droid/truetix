import * as crypto from 'crypto';

export interface TicketPayload {
  ticketId: string;
  bookingId: string;
  showtimeId: string;
  seatId: string;
  userId: string;
  exp?: number;
}

export class TicketTokenUtil {
  /**
   * Generates a signed QR token with standard format: TKT.<payloadBase64>.<signatureBase64>
   */
  static generateToken(payload: TicketPayload, secret: string): string {
    const payloadJson = JSON.stringify(payload);
    const payloadBase64 = Buffer.from(payloadJson, 'utf-8').toString('base64url');
    const signature = crypto
      .createHmac('sha256', secret)
      .update(payloadBase64)
      .digest('base64url');
    return `TKT.${payloadBase64}.${signature}`;
  }

  /**
   * Verifies and decodes a signed QR token using timing-safe signature comparison.
   * Returns decoded payload or null if invalid or tampered.
   */
  static verifyToken(token: string, secret: string): TicketPayload | null {
    if (!token || typeof token !== 'string') return null;
    const parts = token.split('.');
    if (parts.length !== 3 || parts[0] !== 'TKT') {
      return null;
    }

    const payloadBase64 = parts[1];
    const signature = parts[2];

    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(payloadBase64)
      .digest('base64url');

    // Timing-safe comparison to prevent side-channel timing attacks
    const sigBuffer = Buffer.from(signature, 'utf-8');
    const expectedBuffer = Buffer.from(expectedSignature, 'utf-8');

    if (sigBuffer.length !== expectedBuffer.length) {
      return null;
    }

    if (!crypto.timingSafeEqual(sigBuffer, expectedBuffer)) {
      return null;
    }

    try {
      const payloadJson = Buffer.from(payloadBase64, 'base64url').toString('utf-8');
      const payload = JSON.parse(payloadJson) as TicketPayload;
      return payload;
    } catch {
      return null;
    }
  }
}
