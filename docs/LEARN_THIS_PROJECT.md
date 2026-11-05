# TrueTix — Engineering Study Guide & System Design Breakdown

> **Purpose**: A clear, beginner-friendly walkthrough of the TrueTix architecture, core booking workflows, key files, code traces, and technical concepts. Designed to help you understand every part of the project and explain it confidently.

---

## 1. Project Overview

### What is TrueTix?
TrueTix is a real-time movie ticket reservation and cinema management system. 

### Why Does It Exist? (The Core Engineering Problem)
In ticketing systems, flash sales, or ride-sharing apps, many users often try to book the exact same resource (like seat **E5**) at the exact same fraction of a second.

If you only use naive database queries:
1. User A checks if seat E5 is available (`SELECT status FROM seats WHERE id = 'E5'`) -> DB says **AVAILABLE**.
2. User B simultaneously checks seat E5 -> DB also says **AVAILABLE**.
3. User A books E5 -> DB updates to **SOLD**.
4. User B books E5 -> DB also updates to **SOLD**.
👉 **Result**: **Double-booking catastrophe** (two customers show up with tickets for the same seat).

### How TrueTix Solves This: Two-Tier Locking
TrueTix eliminates double-booking with two complementary layers:
1. **Tier 1 (Ephemeral In-Memory Holds in Redis)**:
   - Sub-millisecond distributed locks (`SET lock:seat:{showtimeId}:{seatId} {reservationId} NX EX 600`).
   - If User A clicks first, Redis atomically reserves E5 for 10 minutes.
   - If User B clicks a split-second later, Redis rejects the request with HTTP 409 Conflict.
   - Zero database disk I/O during rapid seat browsing.
2. **Tier 2 (Permanent Source of Truth in PostgreSQL)**:
   - When User A completes payment, an ACID transaction (`$transaction`) marks the seat permanently `SOLD` and generates digital HMAC QR tickets.
   - Database unique constraints (`@@unique([showtimeId, seatId])`) guarantee data integrity forever.

---

## 2. High-Level Architecture

```mermaid
flowchart TD
    subgraph Client["Client Browser"]
        NextApp["Next.js 16 Web App (React 19, Zustand)"]
    end

    subgraph Backend["NestJS Backend (Single Authority)"]
        REST["REST API Controllers (/api/v1)"]
        WS["Socket.IO Gateway (JWT Authenticated)"]
        BookingSvc["BookingService"]
        PaymentSvc["PaymentService"]
        TicketSvc["TicketService"]
        RedisSvc["RedisService"]
    end

    subgraph Storage["Storage & Cache Layer"]
        RedisDB[("Redis 7 (In-Memory Key-Value & TTL)")]
        PostgresDB[("PostgreSQL 15 (ACID Relational DB)")]
    end

    NextApp <-->|HTTP REST Requests (Axios)| REST
    NextApp <-->|Real-Time Status Updates| WS

    REST --> BookingSvc
    REST --> PaymentSvc
    REST --> TicketSvc

    BookingSvc --> RedisSvc
    BookingSvc --> PostgresDB
    PaymentSvc --> PostgresDB
    PaymentSvc --> RedisSvc
    TicketSvc --> PostgresDB

    RedisSvc <-->|SET NX EX / Lua Eval| RedisDB
```

---

## 3. The Main Booking Flow (Step-by-Step)

The core journey follows a clean 10-step lifecycle:

```text
1. Login
   ↓
2. Browse Movies & Select Showtime
   ↓
3. View Live Seat Matrix
   ↓
4. Select Seats & Hold via REST (/bookings/hold-seat)
   ↓
5. Redis Atomically Acquires Locks (NX EX 600) & Assigns reservationId
   ↓
6. Socket.IO Broadcasts HOLDING to Other Connected Users
   ↓
7. Checkout Order (/bookings/checkout) with Verified reservationId
   ↓
8. Mock Payment Gateway Sandbox (/payments/mock/callback with HMAC signature)
   ↓
9. PostgreSQL Transaction: Mark Booking PAID, Seats SOLD, Force Release Redis Lock
   ↓
10. Turnstile Gate Scanner: Verify HMAC QR Token & Atomic Check-in
```

---

## 4. The 7 Core Source Files You Must Know

### 1. `backend/src/modules/booking/booking.controller.ts`
- **What it does**: Exposes authenticated REST endpoints for seat operations.
- **Important routes**:
  - `POST /api/v1/bookings/hold-seat`: Takes `{ showtimeId, seatIds }`, calls `BookingService.holdSeats`.
  - `POST /api/v1/bookings/release-seat`: Takes `{ showtimeId, seatIds, reservationId }`, calls `BookingService.releaseSeats`.
  - `POST /api/v1/bookings/checkout`: Takes `{ showtimeId, seatIds, reservationId }`, calls `BookingService.checkout`.
  - `GET /api/v1/bookings/my-bookings`: Fetches the authenticated user's past bookings.
- **Interview Key**: The controller does no business logic. It extracts `req.user.id` from the verified JWT and delegates to `BookingService`.

### 2. `backend/src/modules/booking/booking.service.ts`
- **What it does**: The brain of the booking system. Coordinates Redis locks and PostgreSQL database transactions.
- **Important functions**:
  - `holdSeats(userId, dto)`:
    - Generates a unique `reservationId` (`res_<uuid>`).
    - Loops through requested seats and calls `redisService.acquireSeatLock`.
    - **Multi-Seat Rollback**: If any seat in the batch fails to lock, it immediately calls `releaseSeatLock` on all seats locked so far in that batch and throws `409 Conflict`.
    - Returns `{ reservationId, showtimeId, heldSeats, expiresAt, ttlSeconds }`.
  - `releaseSeats(userId, dto)`:
    - Passes `reservationId` to `redisService.releaseSeatLock`.
    - Broadcasts `AVAILABLE` if the Lua script confirmed deletion.
  - `checkout(userId, dto)`:
    - Verifies that every seat in `seatIds` is actively held by `reservationId` in Redis.
    - Inside `prisma.$transaction`: verifies showtime is valid, checks seats are not already sold, creates `Booking` record (`PENDING_PAYMENT`), creates `Ticket` records with HMAC QR tokens, and generates mock payment URL.
- **Interview Key**: Explain the multi-seat rollback and why `reservationId` is checked before starting the database transaction.

### 3. `backend/src/modules/redis/redis.service.ts`
- **What it does**: Direct interface to Redis for distributed seat locks.
- **Important functions**:
  - `acquireSeatLock(showtimeId, seatId, ownerToken, ttlSeconds = 600)`:
    - Executes `client.set(key, ownerToken, 'EX', ttlSeconds, 'NX')`.
    - Returns `true` if acquired, `false` if already occupied.
  - `releaseSeatLock(showtimeId, seatId, ownerToken)`:
    - Executes the atomic Lua script. Only deletes the key if its value equals `ownerToken`.
  - `forceReleaseSeatLock(showtimeId, seatId)`:
    - Deletes the key after payment confirmation.
- **Interview Key**: If Redis is offline, it throws `ServiceUnavailableException`. It never silently switches to local memory in production.

### 4. `backend/src/modules/payment/payment.service.ts`
- **What it does**: Simulates a real-world payment gateway (like Stripe or Razorpay) using HMAC signatures and handles idempotent payment callbacks.
- **Important functions**:
  - `generatePaymentSignature(bookingId, amount)`: Creates HMAC-SHA256 signature using `PAYMENT_HMAC_SECRET`.
  - `verifyPaymentSignature(bookingId, amount, signature)`: Validates signature using `crypto.timingSafeEqual`.
  - `processSuccessfulPayment(bookingId, paidAmount, signature)`:
    - Requires non-empty signature and matches expected amount.
    - **Idempotency**: If `booking.status === 'PAID'`, returns cached success immediately without modifying data.
    - In `prisma.$transaction`: updates `Booking` status to `PAID`, transitions `ShowtimeSeat` status to `SOLD`, and validates that the updated seat count equals the expected ticket count.
    - Post-commit: calls `redisService.forceReleaseSeatLock` and broadcasts `SOLD` via Socket.IO.
- **Interview Key**: Why is idempotency important? Payment gateways frequently retry webhooks if network packets drop. Idempotency guarantees multiple calls do not result in double charges or duplicate tickets.

### 5. `backend/src/common/utils/ticket-token.util.ts`
- **What it does**: Generates and verifies digitally signed QR tokens: `TKT.<payloadBase64>.<signatureBase64>`.
- **Important functions**:
  - `generateToken(payload, secret)`: Creates HMAC-SHA256 signature over base64url payload.
  - `verifyToken(token, secret)`: Recomputes signature and compares using `crypto.timingSafeEqual`.
- **Interview Key**: Explain why `timingSafeEqual` is used instead of standard `===` (to prevent side-channel timing attacks).

### 6. `backend/src/modules/ticket/ticket.service.ts`
- **What it does**: Handles ticket retrieval and turnstile scanner validation at the cinema gates.
- **Important function**:
  - `verifyQrTicket(scannerKey, qrToken)`:
    - Validates `X-Scanner-Key` header.
    - Decodes QR token and checks showtime expiration.
    - Compares all 5 payload identifiers (`ticketId`, `bookingId`, `showtimeId`, `seatId`, `userId`) against the PostgreSQL database record.
    - Confirms parent booking is `PAID`.
    - **Atomic Check-in**: Runs `updateMany({ where: { id: ticket.id, status: 'UNUSED' }, data: { status: 'CHECKED_IN' } })`. If `count === 0`, throws `409 Conflict: Ticket already used`.
- **Interview Key**: Atomic conditional update prevents two people from entering the gate with the same ticket simultaneously.

### 7. `backend/src/modules/websocket/websocket.gateway.ts`
- **What it does**: Real-time Socket.IO communication.
- **Important functions**:
  - `handleConnection(client)`: Extracts JWT from handshake auth/headers and validates it with `JwtService`. Rejects unauthenticated connections.
  - `handleJoinShowtime(client, { showtimeId })`: Joins socket to room `showtime:{showtimeId}`.
  - `broadcastSeatState(showtimeId, seatId, status, heldByUserId, expiresAt)`: Sends `seat:state_changed` event to everyone in the room.
- **Interview Key**: The WebSocket gateway does NOT acquire locks or change database state directly. REST is the single authority; WebSockets only broadcast confirmed state changes.

---

## 5. Five Request Traces (Code Walkthrough)

### Trace 1: User Login
```text
1. Client sends POST /api/v1/auth/login with { email, password }.
2. AuthController receives request → calls AuthService.login().
3. AuthService queries User by email from PostgreSQL via Prisma.
4. bcrypt.compare(password, user.password) checks hashed password.
5. JwtService signs an access token containing { sub: user.id, email, role }.
6. Response returns { accessToken, user: { id, email, fullName, role } }.
```

### Trace 2: Hold Seats
```text
1. Client sends POST /api/v1/bookings/hold-seat with { showtimeId: 'st_1', seatIds: ['E5', 'E6'] }.
2. BookingController extracts userId from verified JWT → calls BookingService.holdSeats().
3. BookingService generates unique reservationId = 'res_uuid'.
4. Checks PostgreSQL: ensures neither seat is marked SOLD or BLOCKED.
5. Loop 1: Calls RedisService.acquireSeatLock('st_1', 'E5', 'res_uuid', 600).
   - Redis executes SET lock:seat:st_1:E5 res_uuid EX 600 NX → Returns OK.
6. Loop 2: Calls RedisService.acquireSeatLock('st_1', 'E6', 'res_uuid', 600).
   - Redis executes SET lock:seat:st_1:E6 res_uuid EX 600 NX → Returns OK.
7. Calls WebsocketGateway.broadcastSeatState('st_1', 'E5'/'E6', 'HOLDING').
8. Returns { reservationId: 'res_uuid', heldSeats: ['E5', 'E6'], expiresAt, ttlSeconds: 600 }.
```

### Trace 3: Checkout
```text
1. Client sends POST /api/v1/bookings/checkout with { reservationId: 'res_uuid', showtimeId: 'st_1', seatIds: ['E5', 'E6'], paymentMethod: 'MOCK_GATEWAY' }.
2. BookingService checks Redis: verifies getSeatLockHolder('st_1', 'E5') === 'res_uuid'.
3. Starts Prisma $transaction:
   - Verifies showtime exists and has not ended.
   - Calculates ticket total: basePrice * priceModifier.
   - Creates Booking record in PostgreSQL with status PENDING_PAYMENT.
   - Formulates paymentUrl pointing to /payment/mock-gateway?bookingId=...
   - Generates Tickets with signed tokens: TKT.<payloadBase64>.<signatureBase64>.
4. Returns { bookingId, status: 'PENDING_PAYMENT', totalAmount, paymentUrl }.
```

### Trace 4: Mock Payment Callback
```text
1. Client or simulated gateway sends GET /api/v1/payments/mock/callback?bookingId=...&amount=500&signature=...
2. PaymentController calls PaymentService.processSuccessfulPayment().
3. Validates HMAC signature with crypto.timingSafeEqual().
4. Checks booking status:
   - If already PAID → returns cached success (Idempotent).
5. Starts Prisma $transaction:
   - updateMany({ where: { id: bookingId, status: 'PENDING_PAYMENT' }, data: { status: 'PAID' } }).
   - updateMany showtime_seats to SOLD.
   - Asserts updated seat count === ticket count (rolls back if mismatch).
6. Post-Commit:
   - RedisService.forceReleaseSeatLock releases temporary keys.
   - WebsocketGateway broadcasts SOLD to room showtime:st_1.
7. Returns { success: true, message: 'Payment processed successfully' }.
```

### Trace 5: Turnstile QR Verification
```text
1. Scanner device sends POST /api/v1/tickets/verify-qr with Header X-Scanner-Key and Body { qrToken }.
2. TicketController calls TicketService.verifyQrTicket().
3. TicketTokenUtil.verifyToken() decodes token and verifies HMAC-SHA256 signature.
4. Checks showtime has not ended.
5. In Prisma $transaction:
   - Queries Ticket record: verifies payload bookingId, seatId, showtimeId, and userId match.
   - Confirms booking.status === 'PAID'.
   - Atomic conditional update: updateMany({ where: { id: ticket.id, status: 'UNUSED' }, data: { status: 'CHECKED_IN' } }).
   - If count === 0 → throws ConflictException('Ticket already used').
6. Returns { verified: true, movieTitle, cinemaName, seatId, status: 'CHECKED_IN' }.
```

---

## 6. Key Concepts Explained Simply

### 1. Race Condition
- **Simple Example**: Two people reach for the last piece of pizza at the exact same millisecond. If neither checks before grabbing, they collide.
- **In TrueTix**: Two users click seat **E5** at the same time. Redis `SET NX` acts as the referee: only the first hand gets the pizza; the second is stopped.

### 2. Atomicity
- **Simple Example**: A light switch. It is either ON or OFF. It cannot be half-on.
- **In TrueTix**: An operation that completes completely or not at all. A database transaction or a Redis `SET NX` cannot partially succeed.

### 3. Redis `SET NX EX`
- **NX**: "Not eXists" — only create the key if it doesn't already exist.
- **EX**: "Expire" — automatically delete the key after $N$ seconds.
- **Why combined?**: Combining check, create, and expiration into one single command ensures no other process can squeeze between the check and the set.

### 4. Lua Compare-and-Delete
- **Problem**: User A's 10-minute hold expires at second 600. At second 601, User B locks the seat. At second 602, User A's slow browser sends a delete request. A regular `DEL` would delete User B's lock!
- **Solution**: A Lua script runs inside Redis atomically:
  ```lua
  if redis.call("get", KEYS[1]) == ARGV[1] then
    return redis.call("del", KEYS[1])
  else
    return 0
  end
  ```
  It only deletes the lock if the stored `reservationId` matches the requester's token.

### 5. Database Transaction (ACID)
- A group of database queries that succeed together or fail together. If marking seats as `SOLD` fails, creating the booking and ticket records is rolled back automatically.

### 6. Unique Constraint
- A database rule (e.g. `@@unique([showtimeId, seatId])`). The database will physically reject any attempt to insert a duplicate seat row for the same showtime.

### 7. Idempotency
- **Simple Example**: Pressing the elevator button. Pressing it once calls the elevator. Pressing it ten more times doesn't call ten elevators.
- **In TrueTix**: If a payment gateway retries a webhook callback 3 times, TrueTix processes it once on the first call and returns the same successful response for calls 2 and 3 without duplicating tickets or seat records.

### 8. JWT (JSON Web Token)
- A signed digital passport (`header.payload.signature`) carried by the client in the `Authorization: Bearer <token>` header. The server verifies the signature to know who the user is without querying the database on every request.

### 9. HMAC (Hash-based Message Authentication Code)
- A cryptographic checksum computed using a secret key. If anyone alters the ticket payload (e.g. changing seat `E5` to VIP seat `A1`), the signature becomes invalid and the scanner rejects it.

### 10. WebSocket Room
- A named channel (e.g. `showtime:st_demo_1`). When Alice selects seat E5, the server only notifies users inside that specific movie room, rather than blasting all users on the site.

---

## 7. 15 Realistic Interview Questions & Answers

### Q1: What is the main problem TrueTix is designed to solve?
- **Beginner Answer**: It prevents double-booking in a movie ticketing app when multiple people click the same seat at the same time.
- **Technical Answer**: TrueTix resolves high-concurrency race conditions during ticket sales using a two-tier locking architecture: sub-millisecond ephemeral distributed locks in Redis with automatic TTL expiration, backed by PostgreSQL ACID transactions with composite unique constraints.
- **Likely Follow-up**: *"Why not just use PostgreSQL row-level locks?"*
  - *Response*: High-traffic seat selection involves thousands of users browsing and holding seats. Doing row-level locks (`SELECT FOR UPDATE`) on PostgreSQL would exhaust database connection pools and cause disk I/O bottlenecks. Redis handles millions of operations per second completely in memory.

### Q2: How does Redis prevent two users from locking the same seat?
- **Beginner Answer**: It uses a special `SET` command that only works if the seat key doesn't already exist.
- **Technical Answer**: It uses Redis `SET lock:seat:{showtimeId}:{seatId} {reservationId} NX EX 600`. Because Redis processes commands sequentially on a single-threaded event loop, the `NX` (Not eXists) condition guarantees mutual exclusion atomically without lock contention.
- **Likely Follow-up**: *"What happens if the user closes their browser and never checks out?"*
  - *Response*: The `EX 600` flag automatically expires the key after 10 minutes (TTL). Redis evicts the key and the seat automatically becomes available again without needing a cron job.

### Q3: Why do you need a unique reservation ID instead of using the user's ID as the lock owner?
- **Beginner Answer**: So that if a user opens two browser tabs, one tab doesn't accidentally mess up or release the other tab's seats.
- **Technical Answer**: A user ID represents a persistent user identity, not an isolated transaction attempt. Generating a cryptographically random `reservationId` per hold attempt provides session isolation, ensuring that multiple tabs or consecutive reservation attempts by the same user have distinct ownership and cannot cross-release or checkout each other's seats.
- **Likely Follow-up**: *"Where is the reservation ID verified?"*
  - *Response*: It is stored as the value of the Redis lock, returned to the client, and verified during checkout. If the lock in Redis no longer matches that reservation ID, checkout is rejected.

### Q4: Why can't you release a lock using a simple `DEL` command?
- **Beginner Answer**: If your time ran out and someone else grabbed the seat, you might delete their lock by mistake.
- **Technical Answer**: Unconditional deletion creates a race condition with TTL expiration. If User A's lock expires and User B immediately acquires it, an unconditional `DEL` from User A's delayed request would delete User B's new lock. We use an atomic Lua compare-and-delete script that checks that the stored token matches the requester before deleting.
- **Likely Follow-up**: *"Why does it have to be a Lua script?"*
  - *Response*: A Lua script executes atomically inside Redis. No other command can run in between the `GET` check and the `DEL` execution.

### Q5: How does TrueTix handle multi-seat reservations if one seat fails?
- **Beginner Answer**: If you select 3 seats and the 3rd one is taken, it cancels the first 2 so you don't end up with partial seats.
- **Technical Answer**: We implement atomic rollback. If a user requests `[A1, A2, A3]` and `A3` fails to lock, `BookingService` catches the failure, loops through all seats acquired in that batch (`[A1, A2]`), releases them via atomic Lua scripts, broadcasts their `AVAILABLE` state to WebSockets, and throws HTTP 409 Conflict.

### Q6: What happens if Redis crashes?
- **Beginner Answer**: The system fails safely with an error message instead of letting people book without locks.
- **Technical Answer**: In `RedisService`, if the connection is offline, `assertRedisAvailable()` throws `ServiceUnavailableException`. We intentionally avoid falling back to process-local in-memory maps in production because local maps cannot synchronize across multiple server instances and would lead to split-brain double-booking.

### Q7: How do you guarantee payment callback idempotency?
- **Beginner Answer**: If the bank calls the webhook twice, we check if the booking is already paid and return success without doing the work again.
- **Technical Answer**: First, if `booking.status === 'PAID'`, we return immediately. Second, we use an atomic conditional database update: `updateMany({ where: { id: bookingId, status: 'PENDING_PAYMENT' }, data: { status: 'PAID' } })`. If two callbacks arrive simultaneously, exactly one updates 1 row; the other updates 0 rows and is safely handled without duplicate ticket generation.

### Q8: What happens if payment succeeds in the database, but Redis fails to release the lock?
- **Beginner Answer**: PostgreSQL is the real source of truth, so the customer still owns their ticket.
- **Technical Answer**: Database updates and Redis deletions cannot be part of a single distributed two-phase commit without heavy overhead. In TrueTix, PostgreSQL is the permanent authority. The Redis lock is released post-commit inside a `try/catch`. Even if Redis release fails, the Redis TTL will naturally expire within minutes, and any checkout attempt on that seat will be blocked by PostgreSQL where the seat is permanently marked `SOLD`.

### Q9: How do you prevent ticket counterfeiting and reuse at cinema gates?
- **Beginner Answer**: Tickets have a secret HMAC signature that can't be faked, and the database marks them checked in so they can't be scanned twice.
- **Technical Answer**: Tickets contain a standardized HMAC-SHA256 signature (`TKT.<payload>.<sig>`) verified using `crypto.timingSafeEqual`. During turnstile verification, the system checks that the parent booking is `PAID`, verifies all 5 payload identifiers against the database, and executes an atomic conditional update: `updateMany({ where: { id, status: 'UNUSED' }, data: { status: 'CHECKED_IN' } })`. If two turnstiles scan the same ticket at the same millisecond, only one update succeeds.

### Q10: Why use `crypto.timingSafeEqual` for signatures?
- **Beginner Answer**: Because standard `===` stops comparing as soon as it sees a wrong character, which hackers can measure to guess the signature.
- **Technical Answer**: Standard string comparison (`===`) returns early on the first mismatched byte, creating measurable timing discrepancies (side-channel timing attacks). `crypto.timingSafeEqual` always compares all bytes in constant time regardless of where mismatches occur.

### Q11: How do WebSockets stay in sync with the database and Redis?
- **Beginner Answer**: The WebSocket server doesn't make booking decisions itself; it just broadcasts what the REST API tells it to broadcast.
- **Technical Answer**: REST is the single authority for state mutations. When `BookingService` or `PaymentService` successfully mutates state in Redis or PostgreSQL, it calls `WebsocketGateway.broadcastSeatState()` which emits a `seat:state_changed` event to the specific `showtime:{id}` room.

### Q12: How are WebSocket connections secured?
- **Beginner Answer**: The client has to send a valid JWT login token when connecting, otherwise it gets disconnected immediately.
- **Technical Answer**: During the Socket.IO connection handshake, `handleConnection` extracts the JWT from `handshake.auth.token` or the `Authorization` header and validates it using `JwtService`. If invalid or absent, the socket is disconnected immediately with an `auth_error` event.

### Q13: Why did you choose Next.js and NestJS?
- **Beginner Answer**: Next.js is great for building fast React web apps, and NestJS provides a clean, organized backend structure with TypeScript and dependency injection.
- **Technical Answer**: Next.js provides App Router with Server-Side Rendering (SSR) for fast initial movie discovery and SEO, while NestJS provides an enterprise-grade modular architecture with strict TypeScript types, declarative decorators, and built-in dependency injection, making services easily testable and maintainable.

### Q14: How does Prisma handle transactions?
- **Beginner Answer**: It wraps multiple database queries in a `$transaction` function so that if any query fails, everything is undone.
- **Technical Answer**: `prisma.$transaction(async (tx) => { ... })` starts a PostgreSQL transaction with `BEGIN` and commits with `COMMIT`. If any exception is thrown within the closure, Prisma automatically issues a `ROLLBACK`, guaranteeing database consistency.

### Q15: What are the main limitations of this architecture and how would you scale it?
- **Beginner Answer**: Right now it uses a single Redis instance and a simulated payment gateway. In a huge company, you would use Redis cluster and real payment webhooks.
- **Technical Answer**:
  1. *Distributed Caching*: Currently uses single-instance Redis. In multi-region production, we would use a Redis Cluster with replicas or Redlock consensus.
  2. *Payment Gateway*: Uses an HMAC-verified sandbox simulator. Production requires actual Stripe/Razorpay webhooks with asynchronous event queues.
  3. *WebSocket Scaling*: Currently single-node. Scaling WebSockets horizontally across multiple instances requires a Redis Socket.IO adapter (`@socket.io/redis-adapter`) to share room events across nodes.

---

## 8. Current Limitations & Production Roadmap

| Area | Current Implementation | Production Improvement |
|---|---|---|
| **Redis Deployment** | Single Redis instance | Redis Sentinel or Redis Cluster with replicas for high availability |
| **Payment Gateway** | HMAC-signed mock sandbox | Live Stripe/Razorpay/VNPay integration with webhook retry queues |
| **WebSocket Scaling** | Single-node in-memory adapter | Redis Pub/Sub Socket.IO adapter for multi-instance horizontal scaling |
| **Turnstile Offline Mode** | Requires backend connection | Local gate turnstiles can verify HMAC signatures offline and sync check-ins in batches |

---

## 9. What You Can Safely Skip for This Interview

To save you precious study time, **do NOT waste time memorizing or worrying about these non-essential parts**:

1. **Complex Loyalty & CGV Card Wallets**: Removed from the core booking path. All transactions use the clean Mock Gateway flow.
2. **Advanced Analytics Aggregations**: The admin dashboard has basic metric counts; you don't need to study complex OLAP or big data pipelines.
3. **Dynamic Hall Matrix Builder**: Standard halls use pre-configured matrix layouts; you don't need to explain drag-and-drop grid builders.
4. **Third-Party OAuth Internals**: Standard JWT email/password authentication is the interview focus; skip OAuth 2.0 PKCE internals.
5. **Microservices / Kubernetes / Kafka**: TrueTix is deliberately designed as a clean, highly reliable modular monolith. If asked, explain that a modular monolith is simpler to operate, faster to deploy, and avoids distributed network latency for this scale.
