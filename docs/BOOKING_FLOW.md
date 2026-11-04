# TrueTix End-to-End Booking Flow

## 1. High-Level Booking Sequence

```mermaid
sequenceDiagram
    autonumber
    actor Alice as User A (Browser)
    actor Bob as User B (Browser)
    participant Nest as NestJS Backend
    participant Redis as Redis (Redlock)
    participant WS as Socket.IO Gateway
    participant DB as PostgreSQL (Prisma)
    participant Gateway as Mock Payment Sandbox
    actor Staff as Cinema Scanner / Staff

    Note over Alice,Bob: 1. View Available Seats
    Alice->>Nest: GET /api/v1/showtimes/:id/seats
    Nest->>DB: Query showtime seats (status)
    Nest->>Redis: Query active seat locks
    Nest-->>Alice: Return seat matrix with live statuses

    Note over Alice,Bob: 2. Real-Time Seat Holding & Concurrency
    Alice->>Nest: POST /api/v1/bookings/hold-seat { seatIds: ['E5', 'E6'] }
    Nest->>Redis: SET lock:seat:st_1:E5 usr_alice NX EX 600
    Redis-->>Nest: OK (Acquired)
    Nest->>Redis: SET lock:seat:st_1:E6 usr_alice NX EX 600
    Redis-->>Nest: OK (Acquired)
    Nest->>WS: Broadcast seat:state_changed { E5, E6: HOLDING }
    WS-->>Bob: Real-time UI updates (E5, E6 locked with 10m TTL)
    Nest-->>Alice: Return { reservationId, expiresAt: 10 mins }

    Bob->>Nest: POST /api/v1/bookings/hold-seat { seatIds: ['E5'] }
    Nest->>Redis: SET lock:seat:st_1:E5 usr_bob NX EX 600
    Redis-->>Nest: null (Already Locked!)
    Nest-->>Bob: 409 Conflict: Seat E5 is currently reserved

    Note over Alice,Gateway: 3. Checkout & Booking Creation
    Alice->>Nest: POST /api/v1/bookings/checkout { seatIds: ['E5', 'E6'] }
    Nest->>Redis: Verify lock holder === usr_alice for E5, E6
    Nest->>DB: $transaction: Create Booking (PENDING_PAYMENT), Create Tickets
    DB-->>Nest: Committed
    Nest-->>Alice: Return { bookingId, paymentUrl }

    Note over Alice,DB: 4. Mock Payment & Finalization
    Alice->>Gateway: Open Payment Sandbox URL & Click "Simulate Success"
    Gateway->>Nest: GET /api/v1/payments/mock/callback?bookingId=bkg_1&amount=600&status=SUCCESS
    Nest->>DB: $transaction: Update Booking -> PAID, Update Seats -> SOLD
    DB-->>Nest: Committed
    Nest->>Redis: Force release Redis temporary locks
    Nest->>WS: Broadcast seat:state_changed { E5, E6: SOLD }
    WS-->>Bob: UI reflects permanently SOLD seats
    Nest-->>Alice: Redirect to /booking/success

    Note over Alice,Staff: 5. Turnstile Check-in
    Alice->>Staff: Presents Digital QR Ticket (TKT.payload.signature)
    Staff->>Nest: POST /api/v1/tickets/verify-qr { qrToken }
    Nest->>Nest: Verify HMAC-SHA256 signature with constant-time compare
    Nest->>DB: $transaction: Check ticket.booking.status === PAID & update status: UNUSED -> CHECKED_IN
    DB-->>Nest: Checked in
    Nest-->>Staff: 200 OK: Ticket Valid, Admit Customer
```

---

## 2. Redis Lock Lifecycle

1. **Acquisition (`acquireSeatLock`)**:
   - Executes atomic command: `SET lock:seat:{showtimeId}:{seatId} {userId} NX EX 600`.
   - `NX`: Only set the key if it does **not** already exist.
   - `EX 600`: Set a hard Time-To-Live (TTL) of 600 seconds (10 minutes).
2. **Multi-Seat Atomic Rollback**:
   - If User A selects seats `['A1', 'A2', 'A3']`:
   - If `A1` and `A2` succeed, but `A3` fails (held by someone else):
   - The backend immediately releases `A1` and `A2` using owner-checked Lua scripts and throws a `409 Conflict`.
   - **Guarantee**: No partial seat holds are ever left dangling.
3. **Atomic Lua Release (`releaseSeatLock`)**:
   - Uses an atomic Lua compare-and-delete script:
     ```lua
     if redis.call("get", KEYS[1]) == ARGV[1] then
       return redis.call("del", KEYS[1])
     else
       return 0
     end
     ```
   - Prevents User B from accidentally or maliciously releasing User A's seat reservation.
4. **Natural Expiration**:
   - If a customer abandons their cart, Redis automatically expires the key after 10 minutes.
   - Keyspace notifications (`__keyevent@0__:expired`) notify the WebSocket gateway to broadcast an `AVAILABLE` event to all connected clients.

---

## 3. Database Consistency & State Transitions

```
[Seat: AVAILABLE]
       │
       ▼ (User holds seat)
[Redis Lock: HOLDING (TTL 10m)]
       │
       ├───────────────────────────────────────────────┐
       ▼ (User checks out & completes payment)         ▼ (TTL expires or user cancels)
[Database: SOLD (Permanent)]                   [Seat: AVAILABLE]
```

- **PostgreSQL Source of Truth**: Redis is an ephemeral performance gatekeeper; PostgreSQL remains the ultimate permanent record for financial transactions, paid bookings, and sold seats.
- **Double-Booking Guarantee**: During checkout and payment, conditional updates ensure that a seat can never transition to `SOLD` more than once.
