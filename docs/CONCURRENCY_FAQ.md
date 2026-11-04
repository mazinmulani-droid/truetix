# TrueTix Technical Deep Dive & Concurrency FAQ

This document addresses key architectural questions, distributed concurrency mechanisms, and system design rationales across the TrueTix codebase.

---

### Q1: What is the core problem TrueTix solves?
**Answer**:
TrueTix solves the **concurrency race condition and double-booking problem** in a high-demand movie ticket booking system. In movie ticketing or flash-sale systems, thousands of users might attempt to click and reserve the exact same seat at the exact same second. TrueTix prevents double-booking using a two-tier locking strategy: an ephemeral, sub-millisecond distributed lock in Redis for 10-minute temporary holds, backed by atomic ACID transactions in PostgreSQL for permanent sales.

---

### Q2: Why use Redis when you already have PostgreSQL?
**Answer**:
- **What this project implements**:
  - Redis operates entirely in-memory with sub-millisecond latency. Acquiring a lock via Redis `SET NX EX` is fast and does not incur disk I/O.
  - If 10,000 users click seats during a popular movie launch, running pessimistic table or row locks on PostgreSQL would saturate connection pools and slow down the database.
  - Redis holds ephemeral locks for 10 minutes. If a user abandons checkout, Redis automatically evicts the key via its TTL without needing periodic cleanup SQL batch jobs.
  - PostgreSQL is reserved for the final source of truth: paid bookings and sold seats.
- **Production Extension**: In multi-region deployments, a Redis Redlock cluster with quorum consensus across multiple independent Redis nodes would prevent single-node failover split-brain locks.

---

### Q3: What is Redis `SET key value NX EX ttl` and why is it critical?
**Answer**:
- **What this project implements**:
  - `NX` stands for "Not eXists" — the key is created only if it does not already exist. If it exists, the command returns `null`/`nil`.
  - `EX` sets a timeout in seconds after which Redis automatically deletes the key.
  - Doing `GET` then `SET` in two separate commands creates a race condition. Redis `SET ... NX EX` executes atomically inside Redis's single-threaded event loop, guaranteeing that between two concurrent requests, exactly one will acquire the lock.
- **Key Format in TrueTix**: `lock:seat:{showtimeId}:{seatId}` where the value is the authenticated `userId`.

---

### Q4: Why must lock release use a Lua script instead of `DEL`?
**Answer**:
- **What this project implements**:
  - If User A holds a seat for 10 minutes, and their network stalls so their lock expires at second 600, User B might acquire that same seat at second 601.
  - If User A's delayed request finally arrives and calls an unconditional `DEL lock:seat:...`, User A would accidentally delete User B's brand new lock!
  - To prevent this, TrueTix releases locks using an atomic Lua script:
    ```lua
    if redis.call("get", KEYS[1]) == ARGV[1] then
      return redis.call("del", KEYS[1])
    else
      return 0
    end
    ```
  - This checks that the owner token matches the requester before deleting.

---

### Q5: What happens if a user selects 3 seats, but the 3rd seat fails to lock?
**Answer**:
- **What this project implements**:
  - In `BookingService.holdSeats`, the system loops through the requested seats.
  - If seat 1 and seat 2 are acquired, but seat 3 fails (because another user grabbed it), TrueTix immediately rolls back seats 1 and 2 by calling `releaseSeatLock` with the user's token and broadcasting `AVAILABLE`.
  - The request returns `409 Conflict`.
  - **Guarantee**: No customer is left in a partial-reservation state.

---

### Q6: What happens if two users click the same seat at the exact same millisecond?
**Answer**:
- **What this project implements**:
  - Both requests hit `BookingService.holdSeats`.
  - Both invoke `redisService.acquireSeatLock(showtimeId, seatId, userId, 600)`.
  - Redis processes the two `SET NX` commands sequentially.
  - The first command succeeds and returns `OK`. The user gets `{ reservationId, heldSeats: ['E5'], ttlSeconds: 600 }`.
  - The second command fails and returns `null`. The second user immediately receives `409 Conflict: Seat E5 is currently reserved by another customer`.
  - This exact scenario is verified in automated concurrency tests (`booking.concurrency.spec.ts`).

---

### Q7: What is Idempotency and why is it vital in the payment workflow?
**Answer**:
- **What this project implements**:
  - Payment gateways often retry webhooks and callbacks if the network drops or acknowledgment is delayed.
  - If a gateway calls our callback endpoint twice for the same booking, a naive system might increment loyalty points twice or generate duplicate tickets.
  - TrueTix achieves idempotency at two layers:
    1. Fast check: If `booking.status === 'PAID'`, it immediately returns `success: true` with an idempotent notification.
    2. Atomic database conditional update:
       ```typescript
       const updateResult = await tx.booking.updateMany({
         where: { id: bookingId, status: 'PENDING_PAYMENT' },
         data: { status: 'PAID' },
       });
       ```
    - If two callbacks execute concurrently, exactly one will update 1 row (`count === 1`). The other updates 0 rows and exits safely without running duplicate side-effects.

---

### Q8: How are QR tickets secured and verified at turnstiles?
**Answer**:
- **What this project implements**:
  - TrueTix generates QR tokens in the format `TKT.<payloadBase64>.<signatureBase64>`.
  - The signature is calculated using **HMAC-SHA256** using an environment secret key.
  - During turnstile verification (`POST /tickets/verify-qr`):
    1. Turnstile device presents an authorized `X-Scanner-Key` header.
    2. Signature is verified using **timing-safe comparison** (`crypto.timingSafeEqual`) to prevent side-channel timing attacks.
    3. The system queries PostgreSQL inside an ACID transaction to verify that the booking is `PAID` (unpaid tickets are rejected).
    4. An atomic conditional update `updateMany({ where: { id: ticket.id, status: 'UNUSED' }, data: { status: 'CHECKED_IN' } })` ensures that two turnstiles scanning the same ticket simultaneously cannot both admit the customer.

---

### Q9: How is WebSocket communication authenticated?
**Answer**:
- **What this project implements**:
  - Clients connecting to Socket.IO must supply a JWT bearer token in `client.handshake.auth.token`.
  - The `WebsocketGateway` validates the token against `JWT_SECRET`. Unauthenticated connections are rejected and disconnected immediately.
  - The user identity is extracted strictly from the verified JWT claims (`client.data.user.sub`), never from client-supplied event payloads.
  - Seat deselect events verify lock ownership via Lua before broadcasting release.

---

### Q10: What happens if Redis crashes?
**Answer**:
- **What this project implements**:
  - `RedisService` includes an in-memory fallback store with active TTL expiration sweeps so local testing continues even without a running Redis server.
- **Production Defense**:
  - In a production environment, Redis would be deployed as a high-availability Redis Sentinel or Redis Cluster with replica nodes and automatic failover.
  - If Redis completely fails, the system can fallback to PostgreSQL row-level locks (`SELECT ... FOR UPDATE`), accepting higher latency to preserve consistency.

---

### Q11: What are the project's limitations?
**Answer**:
- Single-instance Redis locking is used rather than distributed multi-master Redlock algorithm across independent data centers.
- The payment gateway is a sandboxed mock simulator rather than an integrated banking merchant processor like Stripe or Razorpay webhook secrets.
- Seat map layouts are stored as JSON room matrices rather than dynamic CAD coordinates.
