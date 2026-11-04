# TrueTix Known Limitations

To maintain absolute technical integrity during an engineering review, this document lists current architectural boundaries and intentional trade-offs.

---

### 1. Ephemeral In-Memory Fallback vs Redis Cluster
- **Current State**: Redis is configured for single-node operation with an internal in-memory Map fallback in `RedisService` for local development.
- **Limitation**: In a multi-node backend without an external Redis instance, the fallback in-memory store cannot synchronize across horizontal NestJS instances.
- **Production Solution**: Deploy a managed Redis Cluster or Redis Sentinel with Redlock algorithm across at least 3 master nodes.

### 2. Mock Payment Gateway
- **Current State**: Payments are processed through an internal sandboxed mock gateway (`/payment/mock-gateway`) using simulated HMAC signatures.
- **Limitation**: Does not integrate live external third-party merchant APIs (e.g. Stripe Webhooks or Razorpay Checkout).
- **Production Solution**: Implement Stripe Webhook signature verification (`stripe.webhooks.constructEvent`) with dedicated raw body parser.

### 3. OAuth 2.0 Provider Verification Disabled
- **Current State**: The legacy `/auth/oauth` endpoint has been disabled because genuine Google/Apple token signature verification was missing.
- **Limitation**: Users must authenticate using email and password.
- **Production Solution**: Integrate `@nestjs/passport` with `passport-google-oauth20` and verify the `id_token` against Google public certs via `google-auth-library`.

### 4. Keyspace Expiration Timing Jitter
- **Current State**: Seat release upon expiration relies on Redis keyspace notifications (`notify-keyspace-events Ex`).
- **Limitation**: Redis evicts expired keys passively on access or actively in small background batches, which may occasionally delay the `expired` notification by 1–2 seconds under heavy memory load.
- **Production Solution**: A lightweight periodic sweep or dead-letter schedule can complement keyspace events.

### 5. Deprioritised Complex Loyalty Points & Multi-Payment Providers
- **Current State**: Incomplete VietQR/Napas/VNPAY integrations and complex point deductions were deprioritised to keep the core booking flow 100% reliable and easy to defend.
- **Limitation**: Does not support split tender or complex dynamic loyalty redemption rules during checkout.
- **Production Solution**: Build a dedicated ledger service for points and multi-tender split payments.

### 6. Deprioritised Advanced Analytics
- **Current State**: Analytics relies on straightforward PostgreSQL queries in `AnalyticsService` rather than an OLAP data warehouse.
- **Limitation**: Not designed for massive historical analytical queries spanning millions of showtimes.
- **Production Solution**: Export transactional CDC events via Debezium to ClickHouse or BigQuery for analytical dashboards.
