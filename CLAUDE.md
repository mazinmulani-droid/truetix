# CLAUDE.md — Root Project Instructions & Engineering Guidelines

Welcome to **TrueTix — Real-Time Movie Ticket Platform**. This document serves as the global single-source-of-truth for project structure, module communication conventions, system architecture, and engineering principles.

---

## 1. Project Overview & Core Mission

**TrueTix** is an interview-focused, high-concurrency movie ticketing platform built to demonstrate senior SDE-level engineering concepts. The primary technical story is **preventing race conditions and double-booking in a real-time reservation system**.

### Key Architectural Pillars:
1. **Two-Tier Locking Model**:
   - **Tier 1 (Ephemeral Holds)**: Redis distributed locks (`SET lock:seat:{showtimeId}:{seatId} {userId} NX EX 600`) with atomic Lua compare-and-delete release.
   - **Tier 2 (Permanent Source of Truth)**: PostgreSQL ACID transactions with composite unique constraints (`@@unique([showtimeId, seatId])`).
2. **Single Seat-Reservation Authority**: NestJS backend manages all lock state. The frontend has **zero** in-memory seat-locking stores and syncs live state via Socket.IO.
3. **Multi-Seat Atomic Rollback**: All-or-nothing seat selection. If any seat in a requested batch fails to lock, all previously acquired locks in that batch are instantly released via Lua scripts.
4. **Payment Idempotency**: Mock payment callback validates HMAC signatures and executes atomic conditional updates (`updateMany({ where: { id, status: 'PENDING_PAYMENT' } })`) so duplicate webhooks never produce duplicate tickets or database corruption.
5. **Tamper-Proof Turnstile Verification**: QR ticket verification using standardized `TKT.<payload>.<sig>` tokens with `crypto.timingSafeEqual` and atomic check-ins (`UNUSED` -> `CHECKED_IN`).
6. **Authenticated WebSockets**: Socket.IO connections require valid JWT tokens; socket identities are extracted directly from verified token claims.

---

## 2. Directory Architecture

```
truetix/
├── README.md                                                   # Complete setup, architecture & concurrency demo
├── CLAUDE.md                                                   # Global project conventions & guidelines
├── PROJECT-DETAIL.md                                           # Detailed functional & technical spec
├── API-CONTRACT.md                                             # REST & WebSocket API specification
├── docs/                                                       # Technical interview documentation suite
│   ├── ARCHITECTURE.md                                         # System architecture & Mermaid diagrams
│   ├── BOOKING_FLOW.md                                         # End-to-end booking flow lifecycle
│   ├── DATABASE.md                                             # ERD & schema consistency constraints
│   ├── INTERVIEW_GUIDE.md                                      # SDE interview Q&A defense guide
│   ├── DECISIONS.md                                            # Technical decisions & trade-offs
│   └── KNOWN_LIMITATIONS.md                                    # System boundaries & production roadmap
├── frontend/                                                   # Next.js 16 (App Router), React 19, Tailwind CSS, Zustand, Socket.IO Client
│   ├── src/app/                                                # Pages: Discovery, Seats, Combos, Checkout, Payment Sandbox, Tickets
│   ├── src/components/                                         # UI components & seat matrix
│   └── src/stores/                                             # Zustand client state (auth, booking)
└── backend/                                                    # NestJS 10, TypeScript, Prisma 5, PostgreSQL 15, Redis 7
    ├── prisma/                                                 # Prisma schema & seed script
    ├── src/common/                                             # Token utilities, guards, decorators
    └── src/modules/                                            # Core domain modules:
        ├── auth/                                               # JWT authentication & bcrypt password hashing
        ├── booking/                                            # Seat holds, release, checkout & concurrency tests
        ├── payment/                                            # Mock payment gateway & idempotent webhooks
        ├── ticket/                                             # QR token generation & atomic turnstile check-in
        ├── redis/                                              # Atomic locks & Lua compare-and-delete scripts
        └── websocket/                                          # Authenticated real-time seat status gateway
```

---

## 3. Technology Stack Boundaries

To keep the project clean, maintainable, and defensible in technical interviews, strictly observe these constraints:
- **Preserve**: Next.js 16 (App Router), React 19, Zustand, NestJS 10, TypeScript, PostgreSQL 15, Prisma 5, Redis 7 (ioredis), Socket.IO, JWT + bcrypt, Swagger.
- **Do NOT introduce**: Kafka, Kubernetes, microservices, MongoDB, GraphQL, or migrate Next.js to Vite.
- **Maintain Single Authority**: Never re-introduce in-memory lock state on the frontend. NestJS + Redis is the single authority.

---

## 4. Key Engineering Workflows

### 1. Redis Lock Acquisition (`SET NX EX`)
```typescript
// Key pattern: lock:seat:{showtimeId}:{seatId}
const acquired = await this.redis.set(key, ownerToken, 'EX', ttlSeconds, 'NX');
return acquired === 'OK';
```

### 2. Atomic Lua Lock Release (Compare-and-Delete)
```lua
if redis.call("get", KEYS[1]) == ARGV[1] then
    return redis.call("del", KEYS[1])
else
    return 0
end
```

### 3. Payment Finalization ($transaction)
```typescript
await this.prisma.$transaction(async (tx) => {
  const updated = await tx.booking.updateMany({
    where: { id: bookingId, status: 'PENDING_PAYMENT' },
    data: { status: 'PAID' },
  });
  if (updated.count === 0) return; // Idempotent no-op

  // Persist sold seats & generate HMAC tickets
  ...
});
```

---

## 5. Helpful Commands

### Infrastructure (Docker)
```bash
docker compose up -d db redis   # Start PostgreSQL 15 & Redis 7
docker compose down             # Stop containers
```

### Backend (NestJS)
```bash
cd backend
npm install                     # Install dependencies
npm run db:push                 # Sync Prisma schema to PostgreSQL
npm run db:seed                 # Seed test accounts & cinema data
npm run start:dev               # Start dev server (http://localhost:4000)
npm test                        # Run full test suite (19 passed)
```

### Frontend (Next.js)
```bash
cd frontend
npm install                     # Install dependencies
npm run dev                     # Start Next.js dev server (http://localhost:3000)
npm run build                   # Build production bundle
```
