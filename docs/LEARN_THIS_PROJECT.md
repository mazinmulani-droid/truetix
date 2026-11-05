# TrueTix — SDE Interview Study Guide & Technical Walkthrough

> **Purpose**: A concise, plain-English study guide covering the TrueTix architecture, core double-booking prevention mechanisms, code traces, and the top 15 interview questions. Written for clear explainability during a technical SDE interview.

---

## 1. Architecture Overview

TrueTix is built as a **clean, reliable modular monolith**:

- **Frontend**: Next.js 16 (App Router), React 19, Zustand (lightweight client state), Tailwind CSS.
- **Backend**: NestJS 10 (TypeScript), modular structure with controllers, services, and dependency injection.
- **Primary Database**: PostgreSQL 15 via Prisma ORM for persistent data (users, movies, showtimes, bookings, tickets).
- **In-Memory Cache & Distributed Locks**: Redis 7 via `ioredis` for ephemeral 10-minute seat holds.
- **Real-Time Synchronization**: Socket.IO gateway with room-based pub/sub (`showtime:{id}`) for live seat-state broadcasts.
- **Security**: JWT authentication, bcrypt password hashing, constant-time HMAC-SHA256 signature verification for payments and QR tickets.

```text
Browser Client (Next.js / Zustand)
   │               ▲
   │ HTTP REST     │ Socket.IO (seat:state_changed)
   ▼               │
NestJS API (Single Source of Authority)
   ├── Redis (SET NX EX 600)  ──> Sub-millisecond temporary seat holds
   └── PostgreSQL (Prisma)     ──> ACID transactions for confirmed bookings & tickets
```

---

## 2. How Seat Holding Works (Step-by-Step)

When a user clicks "Hold Seats" on the auditorium seat matrix:

1. **Client Action**: The frontend sends `POST /api/v1/bookings/hold-seat` with `{ showtimeId, seatIds: ['E5', 'E6'] }` and the user's JWT in `Authorization: Bearer <token>`.
2. **Controller Layer**: `BookingController` verifies the JWT via `JwtAuthGuard` and extracts `userId`.
3. **Pre-Validation**: `BookingService.holdSeats` validates:
   - No duplicate seat IDs in the requested array (`new Set(seatIds).size === seatIds.length`).
   - The showtime exists in PostgreSQL and has not already started or ended.
   - All requested seats exist and are currently neither `SOLD` nor `BLOCKED` in PostgreSQL.
4. **Session Token Generation**: The server generates a unique reservation token: `reservationId = res_<uuid>`.
5. **Atomic Redis Acquisition**: For each seat in the batch, the backend executes:
   ```text
   SET lock:seat:{showtimeId}:{seatId} {reservationId} EX 600 NX
   ```
   - `NX`: Only sets if the key does not already exist (mutual exclusion).
   - `EX 600`: Sets TTL to exactly 10 minutes (600 seconds).
6. **Multi-Seat Atomic Rollback**: If any seat fails to lock (e.g. `E5` succeeded but `E6` was held by someone else), the backend catches the failure, calls an atomic Lua script to delete all seats acquired so far in that batch, and throws `409 Conflict`.
7. **WebSocket Broadcast**: `WebsocketGateway.broadcastSeatState()` emits `seat:state_changed` (`status: HOLDING`) to the Socket.IO room `showtime:{id}`.
8. **Client Response**: Returns `{ reservationId, showtimeId, heldSeats, expiresAt, ttlSeconds: 600 }`.

---

## 3. Why Redis Over Database for Temporary Holds?

| Feature | Redis In-Memory Hold | Database Row Locking (`SELECT FOR UPDATE`) |
|---|---|---|
| **Speed** | Sub-millisecond (< 1 ms in memory) | 10–50 ms (disk I/O, WAL logging, table locks) |
| **Throughput** | Handles 100,000+ ops/sec easily | Degrades quickly under concurrent connection pool contention |
| **Automatic Expiration** | Native key TTL (`EX 600`) evicts expired locks automatically | Requires a background cron job polling DB tables every minute |
| **Database Load** | 0 disk writes during browsing/abandoned sessions | Database write amplification from thousands of abandoned carts |

---

## 4. Why Redis Isn't Enough on Its Own

Redis is an in-memory datastore. Relying solely on Redis for ticket sales introduces severe risks:

1. **Data Volatility**: If Redis restarts or runs out of memory, unpersisted keys can be evicted or lost.
2. **Split-Brain & Consistency**: Redis does not provide ACID relational guarantees across complex multi-table entities (users, showtimes, financial records, digital tickets).
3. **Financial Auditability**: Accounting and ticket audits require an immutable, durable ledger on disk.
4. **PostgreSQL as Permanent Authority**: In TrueTix, Redis is strictly a temporary traffic filter for ephemeral 10-minute holds. The moment payment is verified, PostgreSQL permanently records the seat as `SOLD` inside an ACID transaction. If Redis crashes after payment, PostgreSQL remains the undisputed source of truth.

---

## 5. How Double Booking is Prevented (The 3-Layer Defense)

```text
Layer 1: Redis Distributed Lock (SET NX EX)
         └─ Blocks concurrent clicks in-memory in sub-millisecond time.
Layer 2: PostgreSQL ACID Conditional Transaction
         └─ Atomic updateMany with status: PENDING_PAYMENT -> PAID and seat status check.
Layer 3: Database Composite Unique Constraints
         └─ @@unique([showtimeId, seatId]) physically rejects duplicate seat records at the storage engine.
```

1. **Layer 1 (Pre-Payment)**: Redis `SET NX` acts as the first gatekeeper. If Alice and Bob click `E5` at the same millisecond, Redis processes commands sequentially on its event loop. Exactly one gets `OK`; the other receives `null` and is rejected with `409 Conflict`.
2. **Layer 2 (Checkout & Payment)**: During payment callback processing, `PaymentService` runs inside a PostgreSQL transaction (`$transaction`):
   ```sql
   UPDATE bookings SET status = 'PAID' WHERE id = :id AND status = 'PENDING_PAYMENT';
   UPDATE showtime_seats SET status = 'SOLD' WHERE showtime_id = :stId AND seat_id IN (:seats) AND status IN ('AVAILABLE', 'HOLDING');
   ```
   Crucially, this query only transitions seats from `AVAILABLE` or `HOLDING` state, rejecting `BLOCKED` and already `SOLD` seats. If the number of updated seats does not match the expected ticket count, the transaction rolls back immediately.
3. **Layer 3 (Database Constraint)**: Even if application logic failed, the database schema enforces `@@unique([showtimeId, seatId])`, preventing duplicate records.

---

## 6. What Happens When Checkout Succeeds

1. User clicks **"Confirm & Proceed to Pay"** on `/booking/checkout`.
2. Backend verifies in Redis that every seat lock is actively held by the user's `reservationId`.
3. In a PostgreSQL `$transaction`:
   - Checks that the showtime has not ended.
   - Computes total price (`basePrice * priceModifier`).
   - Creates a `Booking` record with `status: PENDING_PAYMENT`.
   - Generates digital `Ticket` records with cryptographic HMAC QR tokens (`TKT.<payload>.<sig>`).
   - Generates an HMAC signature for the payment sandbox URL.
4. User completes the payment on `/payment/mock-gateway`.
5. Gateway calls `GET /api/v1/payments/mock/callback?bookingId=...&amount=...&signature=...`.
6. `PaymentService.processSuccessfulPayment`:
   - Validates the HMAC signature with `crypto.timingSafeEqual`.
   - **Idempotency Check**: If already `PAID`, returns cached success immediately without running queries.
   - Inside a PostgreSQL `$transaction`: updates `Booking` to `PAID`, updates seats to `SOLD`.
   - Post-commit: releases the Redis temporary locks via `forceReleaseSeatLock` and broadcasts `SOLD` via Socket.IO.

---

## 7. What Happens When Checkout Fails or Expires

### Case A: User Abandons the Reservation
- The 10-minute Redis TTL (`EX 600`) expires.
- Redis automatically deletes `lock:seat:{showtimeId}:{seatId}`.
- If the user later attempts checkout, `BookingService` checks `getSeatLockHolder()`, finds `null`, and returns `409 Conflict: Seat hold has expired`.
- The frontend detects the expired code and prompts the user to reselect seats.

### Case B: Payment is Cancelled or Fails
- The user clicks "Cancel Payment" on the sandbox gateway.
- Gateway calls `/payments/mock/callback?bookingId=...&amount=...&status=CANCELLED&signature=...`.
- `PaymentService.processFailedPayment` requires and verifies the HMAC cryptographic signature, checks that the booking is not already `PAID`, validates that the amount matches `booking.totalAmount`, transitions status from `PENDING_PAYMENT` to `CANCELLED`, releases Redis seat locks, and broadcasts `AVAILABLE` to all connected clients via Socket.IO. Anyone attempting to forge a cancellation request without a valid HMAC signature is rejected with `400 Bad Request`.

---

## 8. How Mock Payment Works (HMAC-SHA256)

### Why Use a Mock Gateway for an Interview Project?
1. Real Stripe or Razorpay webhooks require public HTTPS tunneling (e.g. ngrok), active bank accounts, and fragile external dependencies that can fail during a live interview demo.
2. A custom mock gateway demonstrates that you understand the underlying cryptographic architecture used by real gateways: **asymmetric/HMAC webhook signatures and idempotent callback processing**.

### Implementation Details:
- **Signature Creation**:
  ```ts
  crypto.createHmac('sha256', PAYMENT_HMAC_SECRET).update(`${bookingId}:${amount}`).digest('hex');
  ```
- **Constant-Time Verification**:
  ```ts
  crypto.timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expectedSignature, 'hex'));
  ```
  Prevents side-channel timing attacks where an attacker measures response times byte-by-byte to forge valid signatures.

---

## 9. How QR Tickets Work

Instead of generating image files and uploading them to S3 or storing large blobs in PostgreSQL, TrueTix generates stateless, tamper-proof signed tokens:

```text
TKT.<base64url(payload)>.<base64url(HMAC-SHA256(payload, secret))>
```

### Payload Structure:
```json
{
  "ticketId": "uuid-1234",
  "bookingId": "bkg-5678",
  "showtimeId": "st_demo_1",
  "seatId": "E5",
  "userId": "usr_alice",
  "exp": 1740000000
}
```

### Why This Design?
1. **Stateless**: The frontend renders the QR code dynamically on canvas using `qrcode.react`. Zero image storage costs.
2. **Offline-Verifiable**: Gate turnstiles can verify the signature and expiry offline using the shared secret without calling the database.
3. **Tamper-Proof**: If an attendee modifies the seat from standard `E5` to VIP `A1`, the HMAC signature fails verification.

---

## 10. How QR Verification Prevents Reuse

When an attendee scans their QR ticket at the cinema gate:

1. **Endpoint**: `POST /api/v1/tickets/verify-qr` (protected by `JwtAuthGuard` + `RolesGuard` for `Role.ADMIN` and `Role.SCANNER`).
2. **Cryptographic Validation**: Recomputes HMAC signature and checks showtime expiry.
3. **Database Consistency**: Validates that all 5 identifiers (`ticketId`, `bookingId`, `showtimeId`, `seatId`, `userId`) match the database record and that the booking is `PAID`.
4. **Atomic Conditional Check-in**:
   ```ts
   const result = await tx.ticket.updateMany({
     where: { id: ticket.id, status: 'UNUSED' },
     data: { status: 'CHECKED_IN' },
   });
   if (result.count === 0) {
     throw new ConflictException('This ticket has already been verified and checked in');
   }
   ```
   If two turnstiles scan the same QR code at the exact same fraction of a second, exactly one update succeeds (`count: 1`). The other gets `count: 0` and is rejected immediately.

---

## 11. Engineering Trade-offs Made

| Decision | Trade-off | Justification |
|---|---|---|
| **Single Redis Instance** over Redis Cluster | No multi-master consensus | Eliminates complex cluster orchestration; perfect for single-server or local demonstration. |
| **Mock Gateway** over Live Stripe | No live credit cards | Eliminates network tunneling (ngrok) and external account dependencies during interviews. |
| **Modular Monolith** over Microservices | No network microservice boundaries | Avoids distributed tracing, network latency, and gRPC complexity while maintaining clean separation of concerns. |
| **Stateless QR Tokens** over S3 Image Storage | Computation over storage | Eliminates AWS S3 credentials and bucket configuration; tickets render client-side in SVG/Canvas. |

---

## 12. What Would Change in a High-Scale Production System?

If scaling TrueTix to handle national flash sales (e.g. 50,000 requests/sec):

1. **Distributed Consensus**: Use Redis Sentinel for high-availability failover or Redlock across 3 independent Redis nodes.
2. **Event Queue**: Introduce RabbitMQ or Apache Kafka to buffer checkout requests into an asynchronous FIFO queue during peak traffic spikes.
3. **Database Read Replicas**: Route catalog browsing queries (`GET /movies`, `GET /cinemas`) to PostgreSQL read replicas, reserving the primary database for booking transactions.
4. **WebSocket Multi-Node Adapter**: Add `@socket.io/redis-adapter` so Socket.IO instances share room events across a Kubernetes cluster via Redis Pub/Sub.

---

## 13. Top 15 SDE Interview Questions & Direct Answers

### Q1: What is the primary problem TrueTix solves?
**Answer**: It prevents double-booking in high-concurrency movie ticket reservations using a two-tier locking model: sub-millisecond ephemeral holds in Redis with 10-minute TTLs, backed by PostgreSQL ACID transactions for final ticket purchases.

### Q2: How does Redis prevent two users from locking the same seat?
**Answer**: It uses `SET lock:seat:{showtimeId}:{seatId} {reservationId} EX 600 NX`. Because Redis executes commands sequentially on a single-threaded event loop, the `NX` flag guarantees mutual exclusion atomically.

### Q3: Why generate a unique reservation ID instead of using the user ID?
**Answer**: Session isolation. A single user might have two browser tabs open. A cryptographically random `reservationId` guarantees that each reservation attempt has independent ownership and cannot accidentally release or checkout another tab's seats.

### Q4: Why can't you release a Redis seat lock with a simple `DEL` command?
**Answer**: To prevent deleting another user's lock. If Alice's lock expires at second 600 and Bob acquires the seat at second 601, an unconditional `DEL` from Alice's delayed request would delete Bob's lock. We use an atomic Lua script that compares the stored token before deleting.

### Q5: How are multi-seat reservations rolled back if one seat fails?
**Answer**: If a user requests `[E5, E6]` and `E6` is already locked, `BookingService` catches the conflict, loops through previously acquired seats (`E5`), deletes them via the Lua script, broadcasts `AVAILABLE` to WebSockets, and throws `409 Conflict`.

### Q6: What happens if Redis crashes?
**Answer**: `RedisService.assertRedisAvailable()` throws `ServiceUnavailableException`. We fail safely with a clean 503 error rather than falling back to in-memory maps, which cannot synchronize across server processes and would cause double-booking.

### Q7: How is payment callback idempotency guaranteed?
**Answer**: Two checks: (1) If `booking.status === 'PAID'`, we immediately return success. (2) We run an atomic conditional database update: `updateMany({ where: { id, status: 'PENDING_PAYMENT' }, data: { status: 'PAID' } })`. Only the first concurrent callback modifies a row; retries modify 0 rows and return safely.

### Q8: What if payment succeeds in PostgreSQL, but Redis lock release fails?
**Answer**: PostgreSQL is the permanent authority. The seat is permanently marked `SOLD` in PostgreSQL. Even if the post-commit Redis release fails, the Redis key will naturally expire via its TTL within minutes, and any future checkout attempt will be blocked by PostgreSQL.

### Q9: How do digital QR tickets prevent counterfeiting?
**Answer**: Each ticket contains an HMAC-SHA256 signature (`TKT.<payload>.<sig>`). Modifying any data inside the QR payload invalidates the signature. The server verifies the signature using `crypto.timingSafeEqual`.

### Q10: How does turnstile scanning prevent double check-in?
**Answer**: Inside a database transaction, it runs `updateMany({ where: { id: ticket.id, status: 'UNUSED' }, data: { status: 'CHECKED_IN' } })`. If scanned twice simultaneously, exactly one turnstile gets `count === 1`; the other gets `count === 0` and is rejected with `409 Conflict`.

### Q11: Why is `crypto.timingSafeEqual` used instead of `===`?
**Answer**: Standard string comparison (`===`) returns early on the first mismatched byte, exposing timing differences that attackers can measure to brute-force valid signatures. `timingSafeEqual` always compares in constant time.

### Q12: How do WebSockets maintain state consistency with REST APIs?
**Answer**: WebSockets do not modify state directly. REST services (`BookingService`, `PaymentService`) are the single authority. When a state change is committed, the service calls `WebsocketGateway.broadcastSeatState()` to notify all clients in room `showtime:{id}`.

### Q13: How are WebSocket connections authenticated?
**Answer**: During the Socket.IO connection handshake, `handleConnection` extracts the JWT from `client.handshake.auth.token`, verifies it with `JwtService`, and attaches the decoded user payload to socket data. Unauthenticated sockets are disconnected immediately.

### Q14: How does Prisma handle database transactions?
**Answer**: Using `prisma.$transaction(async (tx) => { ... })`. It wraps all enclosed queries in a PostgreSQL `BEGIN` / `COMMIT` block. If any error is thrown, Prisma automatically issues a `ROLLBACK`.

### Q15: What is the benefit of a modular monolith for this application?
**Answer**: It groups bounded domains (Booking, Payment, Ticket, Auth) into clean, decoupled NestJS modules while sharing a single deployment unit and database transaction boundary. This eliminates microservice network overhead and distributed consensus complexity.

---

## 14. File Cheat Sheet: Where Each Piece of Logic Lives

| File | Purpose & Responsibilities |
|---|---|
| `backend/src/modules/booking/booking.service.ts` | Coordinates seat holding, multi-seat rollback, Redis ownership validation, and checkout transaction. |
| `backend/src/modules/booking/booking.controller.ts` | Authenticated REST endpoints: `/hold-seat`, `/release-seat`, `/checkout`, `/my-bookings`. |
| `backend/src/modules/redis/redis.service.ts` | Atomic distributed locking (`SET NX EX`), Lua compare-and-delete script, connection health check. |
| `backend/src/modules/payment/payment.controller.ts` | Unified callback `/payments/mock/callback` enforcing cryptographic HMAC signature validation on payment success and cancellation. |
| `backend/src/modules/payment/payment.service.ts` | HMAC payment signature generation/validation, idempotent payment callback processing, post-commit lock cleanup. |
| `backend/src/modules/ticket/ticket.service.ts` | HMAC QR token verification, showtime expiry check, atomic conditional ticket check-in (`UNUSED` -> `CHECKED_IN`). |
| `backend/src/common/utils/ticket-token.util.ts` | Standardized `TKT.<payload>.<sig>` token encoding, decoding, and timing-safe signature verification. |
| `backend/src/modules/websocket/websocket.gateway.ts` | Socket.IO connection handshake authentication, room management (`showtime:{id}`), and state broadcasting. |
| `backend/prisma/schema.prisma` | PostgreSQL relational schema: `User`, `Movie`, `Cinema`, `Hall`, `Showtime`, `ShowtimeSeat`, `Booking`, `Ticket`. |
| `frontend/src/store/useBookingStore.ts` | Zustand client state: selected seats, reservation ID, TTL expiration, subtotal calculation. |
| `frontend/src/app/booking/seats/page.tsx` | Interactive auditorium seat grid, live Socket.IO listeners, real-time lock badges, 10-minute countdown. |
| `frontend/src/app/payment/mock-gateway/page.tsx` | Simulated payment sandbox with QR payload, HMAC signature check, and success/cancel simulator buttons. |
| `frontend/src/app/admin/tickets/scan/page.tsx` | Camera and manual QR ticket scanner with role-protected turnstile check-in API. |
