# TrueTix

> A real-time movie ticketing and reservation platform engineered with Next.js, NestJS, Redis, and PostgreSQL. Built with a two-tier distributed locking architecture to prevent double-booking and race conditions during high-demand ticket sales.

[![Node Version](https://img.shields.io/badge/node-20%2B-brightgreen.svg)](https://nodejs.org)
[![NestJS](https://img.shields.io/badge/backend-NestJS%2010-red.svg)](https://nestjs.com)
[![Next.js](https://img.shields.io/badge/frontend-Next.js%2016-black.svg)](https://nextjs.org)
[![Prisma](https://img.shields.io/badge/orm-Prisma%205-blue.svg)](https://prisma.io)
[![PostgreSQL](https://img.shields.io/badge/database-PostgreSQL%2015-blue.svg)](https://postgresql.org)
[![Redis](https://img.shields.io/badge/cache-Redis%207-critical.svg)](https://redis.io)
[![Tests](https://img.shields.io/badge/tests-33%20passed-success.svg)](https://vitest.dev)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

## Overview

When thousands of users select seats for high-demand movie releases simultaneously, standard database queries fail due to race conditions between `SELECT` and `INSERT/UPDATE`. 

TrueTix addresses this with a **Two-Tier Locking Strategy**:
1. **Tier 1 (Ephemeral Holds)**: Sub-millisecond distributed locks in **Redis** (`SET lock:seat:... ownerToken NX EX 600`) hold seats for 10 minutes with zero database disk I/O.
2. **Tier 2 (Permanent Source of Truth)**: **PostgreSQL** ACID transactions and composite unique constraints (`@@unique([showtimeId, seatId])`) guarantee that seats are permanently marked `SOLD` only upon validated, idempotent payment completion.

```mermaid
flowchart TD
    UserA["User A (Browser 1)"]
    UserB["User B (Browser 2)"]
    NestAPI["NestJS Backend Authority"]
    RedisStore[("Redis Distributed Locks")]
    PostgresDB[("PostgreSQL Permanent Database")]
    Turnstile["Cinema Turnstile Scanner"]

    UserA -->|1. Hold Seat E5| NestAPI
    UserB -->|1. Hold Seat E5| NestAPI
    NestAPI -->|SET NX EX| RedisStore

    RedisStore -- "Acquired (Winner)" --> UserA
    RedisStore -- "Rejected (409 Conflict)" --> UserB

    UserA -->|2. Checkout & Mock Pay| NestAPI
    NestAPI -->|ACID Transaction| PostgresDB
    PostgresDB -- "Seats marked SOLD & Tickets Generated" --> NestAPI
    NestAPI -->|Release Lock & Broadcast SOLD| RedisStore

    UserA -->|3. Present QR Ticket| Turnstile
    Turnstile -->|Atomic Check-in| PostgresDB
```

---

## Features

- **Live Seat Map Synchronization**: Real-time interactive seat grid updated across all connected clients via Socket.IO.
- **Single Seat-Reservation Authority**: NestJS backend manages all lock state. Client UI holds zero in-memory locking state and reflects authoritative backend updates.
- **Atomic Lua Lock Release**: Locks are released using a compare-and-delete Lua script that compares the stored lock owner before deleting, preventing expired clients from releasing newly acquired locks.
- **Multi-Seat Atomic Rollback**: All-or-nothing seat selection. If any seat in a requested batch fails to lock, all previously acquired locks in that batch are instantly rolled back.
- **Idempotent Payment Sandbox**: Mock payment gateway with HMAC signature verification and atomic conditional database updates (`updateMany({ where: { id, status: 'PENDING_PAYMENT' } })`) to prevent duplicate transactions on network retries.
- **Tamper-Proof Digital Tickets**: QR tickets use standardized `TKT.<payload>.<sig>` tokens verified with `crypto.timingSafeEqual` to eliminate timing attacks.
- **Atomic Turnstile Scanner**: High-speed scanner gate endpoint for theater staff that validates tickets and checks them in atomically (`UNUSED` -> `CHECKED_IN`).
- **Authenticated WebSockets**: Handshake authentication requiring valid JWT tokens, with user identity extracted directly from verified token claims.

---

## Architecture & Documentation

Comprehensive system design documents are available in the [`docs/`](./docs) directory:

| Document | Description |
|---|---|
| 📖 [**Engineering Study Guide**](./docs/LEARN_THIS_PROJECT.md) | Comprehensive beginner-friendly walkthrough of the architecture, 7 core files, 5 request traces, and interview Q&As. |
| 📐 [**Architecture Guide**](./docs/ARCHITECTURE.md) | System components, module boundaries, and layer responsibilities. |
| 🔄 [**Booking Flow Lifecycle**](./docs/BOOKING_FLOW.md) | End-to-end API sequence diagram, lock lifecycles, and transaction states. |
| 🗄️ [**Database Schema & Constraints**](./docs/DATABASE.md) | Entity-Relationship Diagram (ERD), table definitions, and data integrity rules. |
| 🔍 [**Concurrency Deep Dive & FAQ**](./docs/CONCURRENCY_FAQ.md) | Detailed breakdown of distributed locking, Lua scripts, ACID transactions, and idempotency. |
| ⚖️ [**Engineering Decisions & Trade-offs**](./docs/DECISIONS.md) | Technical rationale and trade-offs behind stack and architecture choices. |
| 📋 [**Known Limitations & Roadmap**](./docs/KNOWN_LIMITATIONS.md) | Current architectural boundaries and future production enhancements. |

---

## Tech Stack

| Layer | Technologies |
|---|---|
| **Frontend** | Next.js 16 (App Router), React 19, Tailwind CSS, Zustand, Socket.IO Client |
| **Backend** | NestJS 10, TypeScript, Prisma ORM, Socket.IO, Passport JWT, bcrypt |
| **Database** | PostgreSQL 15 |
| **Caching & Locking** | Redis 7 (`ioredis`) |
| **Testing** | Vitest |

---

## Getting Started

### Prerequisites
- Node.js 20+
- Docker & Docker Compose (or local PostgreSQL 15 and Redis 7 instances)

### 1. Start Infrastructure (PostgreSQL & Redis)
```bash
docker compose up -d db redis
```

### 2. Backend Setup
```bash
cd backend
npm install
npm run db:push
npm run db:seed
npm run start:dev
```
- **Backend API**: `http://localhost:4000/api/v1`
- **Swagger Interactive API Docs**: `http://localhost:4000/api/docs`

### 3. Frontend Setup
```bash
cd ../frontend
npm install
npm run dev
```
- **Web App**: `http://localhost:3000`

---

## Demo Accounts & Concurrency Testing

The database seeder pre-configures test accounts (`Password123!`):

| Role | Name | Email | Password |
|---|---|---|---|
| **Customer A** | Alice Johnson | `alice@truetix.com` | `Password123!` |
| **Customer B** | Bob Smith | `bob@truetix.com` | `Password123!` |
| **Admin / Staff** | System Admin | `admin@truetix.com` | `Password123!` |

### Testing Real-Time Concurrency (2 Browsers):
1. Open [http://localhost:3000/login](http://localhost:3000/login) in Window 1 and click **Alice** to log in.
2. Open an **Incognito** window at [http://localhost:3000/login](http://localhost:3000/login) and click **Bob** to log in.
3. Both navigate to the demo showtime: [http://localhost:3000/booking/seats?showtimeId=st_demo_1](http://localhost:3000/booking/seats?showtimeId=st_demo_1).
4. Alice selects seat **E5**:
   - Seat **E5** turns amber with a lock icon in Bob's window in real time via Socket.IO.
   - If Bob clicks or requests **E5**, the backend rejects it with `409 Conflict: Seat E5 is currently reserved`.
5. Alice proceeds to checkout and completes payment on the Mock Payment Sandbox:
   - Seat **E5** transitions permanently to dark gray (**SOLD**) across all connected screens.
   - A digital QR ticket is generated.
6. Open the Turnstile Scanner at [http://localhost:3000/admin/tickets/scan](http://localhost:3000/admin/tickets/scan):
   - Scan Alice's ticket token: **ADMISSION GRANTED**.
   - Attempt to scan the same ticket again: **ACCESS DENIED: Ticket already used**.

---

## Testing

The backend includes a comprehensive automated test suite with **33 passing tests** across 6 test suites covering distributed locking, rollback, idempotency, QR verification, and concurrent race conditions:

```bash
cd backend
npm test
```

### Verified Test Results (33 Passed):
```text
✓ src/modules/booking/booking.service.spec.ts (10 tests)
  ✓ User A successfully holds an available seat with a unique reservation ID
  ✓ User B cannot hold the same seat when already held
  ✓ The reservation owner can release the seat using their reservation token
  ✓ Another reservation session cannot release that lock (Lua compare-and-delete check)
  ✓ A failed multi-seat reservation rolls back earlier locks using the reservation token
  ✓ One user with two separate reservation sessions cannot cross-release or checkout each other
  ✓ An expired reservation cannot be checked out
  ✓ An expired seat holder is null and can be re-locked by another user
  ✓ Fails safely when Redis is unavailable
  ✓ A user cannot access another user's booking (IDOR protection)

✓ src/modules/ticket/ticket.service.spec.ts (6 tests)
  ✓ Rejects tickets with invalid or forged HMAC signatures
  ✓ Rejects tickets when payload identifiers do not match the database record
  ✓ Rejects tickets for unpaid bookings
  ✓ Rejects expired tickets where showtime has ended
  ✓ A ticket cannot be checked in twice
  ✓ Simultaneous check-in requests cannot both succeed (Atomic DB conditional update)

✓ src/modules/payment/payment.service.spec.ts (6 tests)
  ✓ A successful payment marks the booking paid and seats as SOLD
  ✓ Repeated payment callbacks return idempotent cached success without re-executing transitions
  ✓ Rejects payment callback when signature is missing
  ✓ Rejects payment callback when signature is forged or invalid
  ✓ Rejects payment callback when amount does not match expected booking total
  ✓ Payment seat update count mismatch triggers transaction rollback

✓ src/modules/redis/redis.service.spec.ts (6 tests)
  ✓ Throws ServiceUnavailableException when Redis is offline
  ✓ Successfully acquires lock when seat is available (SET NX EX)
  ✓ Returns false when lock is already held by someone else
  ✓ Releases lock using Lua script when owner matches
  ✓ Fails to release lock when Lua script owner does not match
  ✓ Force releases lock on payment completion

✓ src/modules/websocket/websocket.gateway.spec.ts (4 tests)
  ✓ Unauthenticated WebSocket connection without token is immediately rejected and disconnected
  ✓ Rejects connection when token verification fails
  ✓ Successfully authenticates connection and stores user identity from verified JWT token
  ✓ WebSocket Gateway does not independently mutate seat locks (REST is the single authority)

✓ src/modules/booking/booking.concurrency.spec.ts (1 test)
  ✓ Two users attempt to reserve the exact same seat simultaneously: Exactly one succeeds

Test Files  6 passed (6)
     Tests  33 passed (33)
```

---

## License

This project is licensed under the MIT License.
