# CLAUDE.md — Backend Guidelines & Architecture

This document provides isolated context, development conventions, directory layout, database locking protocols, and command cheat sheets for developers working inside the `/backend` directory.

---

## 1. Tech Stack Overview

| Layer | Technology |
| --- | --- |
| **Framework** | NestJS 10, TypeScript (Strict Mode) |
| **Database** | PostgreSQL 15 |
| **ORM** | Prisma 5 |
| **Distributed Caching & Locks** | Redis 7 (`ioredis`, atomic Lua compare-and-delete) |
| **Payment Gateway** | Mock Payment Gateway (Sandbox simulation flow) |
| **QR Code / Security** | Standardized `TKT.<payload>.<sig>` with timing-safe HMAC-SHA256 |
| **Real-time Gateway** | WebSockets via Socket.IO Server (JWT authenticated) |
| **Testing** | Vitest (19 automated tests covering all 15 scenarios + concurrency test) |
| **Security & Crypto** | JWT, Passport.js, bcrypt, `crypto.timingSafeEqual` |

---

## 2. Directory Architecture

```
backend/
├── prisma/
│   ├── schema.prisma        # PostgreSQL database models, relationships, and constraints
│   └── seed.ts              # Database seeder (Admin, Alice, Bob, Cinemas, Movies, Showtimes)
├── src/
│   ├── common/              # Ticket token utilities, guards, decorators, error filters
│   ├── modules/
│   │   ├── auth/            # JWT authentication & bcrypt password hashing
│   │   ├── booking/         # Seat holds, multi-seat rollback, checkout & concurrency tests
│   │   ├── cinema/          # Cinema, hall, and room layout models
│   │   ├── payment/         # Mock payment gateway sandbox & idempotent webhooks
│   │   ├── redis/           # Atomic SET NX EX and Lua compare-and-delete scripts
│   │   ├── ticket/          # QR token generation & atomic turnstile check-in
│   │   └── websocket/       # Authenticated Socket.IO gateway & live seat status sync
│   ├── app.module.ts        # Root module assembling domain features
│   └── main.ts              # Application bootstrap & env validation
└── vitest.config.ts         # Test runner configuration
```

---

## 3. Concurrency & Locking Directives

1. **Two-Tier Locking Strategy**:
   - **Tier 1 (Redis Temporary Holds)**: `SET lock:seat:{showtimeId}:{seatId} {userId} NX EX 600`.
   - **Tier 2 (Postgres ACID Transactions)**: When payment succeeds, mark booking as `PAID` and insert `ShowtimeSeat` rows with composite constraint `@@unique([showtimeId, seatId])`.
2. **Never Use Unconditional DEL**:
   - Always release seat locks using the atomic Lua compare-and-delete script (`releaseSeatLock`) to prevent deleting another user's lock if TTL expired.
3. **Multi-Seat Atomic Rollback**:
   - If user requests `[S1, S2, S3]` and `S3` fails, immediately release `S1` and `S2` using Lua. Never leave partial holds.
4. **Payment Idempotency**:
   - Check webhook signature with HMAC.
   - Use atomic conditional database updates: `updateMany({ where: { id: bookingId, status: 'PENDING_PAYMENT' }, data: { status: 'PAID' } })`.
5. **Turnstile Atomic Check-in**:
   - Verify HMAC token with `crypto.timingSafeEqual`.
   - Ensure booking is `PAID`.
   - Atomically transition ticket status: `updateMany({ where: { id, status: 'UNUSED' }, data: { status: 'CHECKED_IN' } })`.

---

## 4. Helpful Commands

```bash
npm install                    # Install dependencies
npm run db:push                # Sync schema with PostgreSQL
npm run db:seed                # Seed test users and cinema demo data
npm run start:dev              # Start NestJS dev server (http://localhost:4000)
npm run build                  # Compile production bundle
npm test                       # Run Vitest test suite (19 tests)
```
