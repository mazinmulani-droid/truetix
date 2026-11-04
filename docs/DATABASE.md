# TrueTix Database Design & Schema Reference

## 1. Entity-Relationship Diagram (ERD)

```mermaid
erDiagram
    User ||--o{ Booking : "places"
    User ||--o{ RefreshToken : "owns"
    User ||--o{ UserVoucher : "holds"
    User ||--o{ MovieReview : "writes"

    City ||--o{ Cinema : "contains"
    Cinema ||--o{ Hall : "houses"
    Cinema ||--o{ Showtime : "schedules"
    Hall ||--o{ Showtime : "hosts"
    Movie ||--o{ Showtime : "screens"

    Showtime ||--o{ ShowtimeSeat : "configures"
    Showtime ||--o{ Booking : "includes"

    Booking ||--o{ Ticket : "generates"
    Booking ||--o{ BookingCombo : "contains"
    Combo ||--o{ BookingCombo : "referenced_in"
    Voucher ||--o{ Booking : "applies_to"
    Voucher ||--o{ UserVoucher : "belongs_to"

    User {
        string id PK
        string email UK
        string password
        string fullName
        enum role
        int points
        int cgvCardBalance
    }

    Movie {
        string id PK
        string title
        int durationMinutes
        enum status
        enum ageRating
    }

    Showtime {
        string id PK
        string movieId FK
        string cinemaId FK
        string hallId FK
        datetime startTime
        datetime endTime
        int basePrice
    }

    ShowtimeSeat {
        string id PK
        string showtimeId FK
        string seatId
        string row
        int col
        enum type
        enum status
        float priceModifier
    }

    Booking {
        string id PK
        string userId FK
        string showtimeId FK
        int totalAmount
        enum status
        string paymentMethod
        string paymentUrl
    }

    Ticket {
        string id PK
        string bookingId FK
        string seatId
        string qrToken
        enum status
    }
```

---

## 2. Important Tables & Schema Design

### `showtime_seats`
- Represents an individual seat instance for a specific showtime.
- **Composite Unique Index**: `@@unique([showtimeId, seatId])` ensures that for any given showtime, a seat identifier (e.g. `H12`) exists exactly once in the table.
- **Statuses**: `AVAILABLE`, `HOLDING`, `SOLD`, `BLOCKED`.

### `bookings`
- Records the customer order header.
- **Statuses**:
  - `PENDING_PAYMENT`: Initial order created; awaiting gateway confirmation.
  - `PAID`: Payment validated and finalized.
  - `CANCELLED`: Payment failed or cancelled by user.
  - `EXPIRED`: Payment time window expired.

### `tickets`
- Digital ticket record with encrypted/signed QR payload.
- **Statuses**:
  - `UNUSED`: Valid and ready for admission.
  - `CHECKED_IN`: Scanned and admitted at cinema turnstile.
  - `CANCELLED`: Booking was cancelled or refunded.

---

## 3. Database Constraints & Idempotency Rules

1. **Composite Uniqueness on Seats**:
   - `@@unique([showtimeId, seatId])` prevents inserting duplicate seats for a showtime.
2. **Atomic Status Update on Check-in**:
   - Updates `status` from `UNUSED` to `CHECKED_IN` conditionally using `updateMany({ where: { id, status: 'UNUSED' }, data: { status: 'CHECKED_IN' } })`.
   - If two scanner requests arrive concurrently, the first updates 1 row; the second matches 0 rows and is rejected.
3. **Atomic Payment Finalization**:
   - Updates `Booking` from `PENDING_PAYMENT` to `PAID` conditionally. Repeated callbacks or concurrent race conditions update 0 rows on subsequent attempts, guaranteeing financial idempotency.
