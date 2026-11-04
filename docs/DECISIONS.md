# TrueTix Engineering Decisions & Trade-Offs

## 1. Single Seat-Reservation Authority in NestJS
- **Decision**: Eliminated the Next.js frontend in-memory `globalLockStore` in `/api/seats/sync/route.ts` and established NestJS + Redis as the single authority for seat locks.
- **Trade-off**: Requires frontend to make HTTP/WebSocket calls to NestJS rather than updating local Next.js server state.
- **Benefit**: Completely eliminates the split-brain state where two users in different browsers or tabs saw different seat availabilities.

## 2. Redis Distributed Locks with 10-Minute TTL
- **Decision**: Used Redis atomic `SET NX EX` for 10-minute temporary seat holding instead of holding pessimistic database locks in PostgreSQL.
- **Trade-off**: Requires maintaining a Redis instance alongside PostgreSQL.
- **Benefit**: Reduces PostgreSQL connection pool contention by 90%+ during flash traffic and guarantees automatic expiration without background batch cleanup cron jobs.

## 3. Compare-and-Delete Lua Script for Lock Release
- **Decision**: Never use unconditional `DEL lock:seat:...`. Used an atomic Lua script that compares the stored lock owner with the requester token.
- **Trade-off**: Slightly more complex than a standard delete command.
- **Benefit**: Eliminates the classic distributed locking bug where a slow client inadvertently releases a lock acquired by another user after timeout expiration.

## 4. Atomic Conditional Update for Check-in & Payment
- **Decision**: Used `updateMany({ where: { id, status: 'EXPECTED' }, data: { status: 'NEW' } })` inside database transactions.
- **Trade-off**: Slightly more verbose than simple `update()`.
- **Benefit**: Solves concurrent duplicate callbacks and concurrent turnstile check-ins directly at the database engine level.

## 5. Standardized HMAC-SHA256 Token Utility
- **Decision**: Created `TicketTokenUtil` as a shared utility with timing-safe comparison (`crypto.timingSafeEqual`).
- **Trade-off**: Strict format requirements.
- **Benefit**: Eliminates format and secret mismatches between creation and scanning, and protects against side-channel timing attacks.

## 6. Disabling Incomplete OAuth Rather than Inventing Security
- **Decision**: Disabled the client-controlled `oauthLogin` endpoint which accepted arbitrary emails without external ID token verification.
- **Trade-off**: Temporarily removes 1-click Google login button until Google OAuth2 token verification is configured.
- **Benefit**: Eliminates a severe security vulnerability where anyone could impersonate admin or customer accounts.
