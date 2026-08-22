# TrueTix - Film Ticket Platform

TrueTix is a modern, high-concurrency, full-stack movie ticketing and theater management platform designed to deliver a seamless booking experience and robust theater operations.

---

## 🌟 Key Features

### 🎬 Customer Experience
- **Dynamic Movie Catalog**: Browse movies by status (*Now Showing*, *Coming Soon*), genres, formats (2D, 3D, IMAX, 4DX), and age ratings.
- **Interactive Real-Time Seat Picker**:
  - Live seat matrix rendering with customizable seating tiers (Standard, VIP, Couple / Sweetbox, Accessible).
  - Real-time WebSocket synchronization reflecting live locks and bookings across users.
  - Automatic 10-minute transient reservation lock powered by Redis.
- **F&B Combos & Add-ons**: Add concession combos and items dynamically calculated into the order total.
- **Vouchers & Loyalty Rewards**: Apply discount vouchers, earn and redeem membership points.
- **Mock Payment & QR Tickets**: Instant HMAC-SHA256 secured QR ticket generation with mock payment gateway integration.
- **User Dashboard**: View active bookings, historical receipts, and renderable QR check-in passes.

### 🏢 Theater Operations & Admin CMS
- **Cinema Cluster & Hall Management**: Manage multiple cinema chains, cities, halls, and projection equipment.
- **Dynamic Hall Matrix Builder**: Configure irregular seating grids, aisle gaps, and pricing modifiers.
- **Showtime Scheduler Matrix**: Conflict-detection engine ensuring no overlapping showtimes and adequate buffer times.
- **Turnstile QR Check-in Scanner**: High-speed QR verification endpoint (< 50ms) for validation at theater gates.
- **Analytics & Reporting Dashboard**: Real-time revenue metrics, occupancy rates, and peak booking trends.

---

## 🛠️ Tech Stack

### Frontend
- **Framework**: Next.js 15 (App Router), React 19, TypeScript
- **Styling**: Tailwind CSS, Shadcn UI
- **State Management**: Zustand
- **Real-Time**: Socket.io Client
- **Utilities**: Lucide Icons, Date-fns, Sonner, QRCode.react

### Backend
- **Framework**: NestJS 10, TypeScript
- **Database & ORM**: PostgreSQL 16, Prisma ORM
- **Cache & Concurrency**: Redis 7, Redlock (Distributed Locking)
- **Real-Time Protocol**: WebSockets / Socket.io
- **Security & Auth**: Passport.js, JWT, Bcrypt, HMAC-SHA256 Token Validation
- **Testing**: Vitest, Supertest

### DevOps & Infrastructure
- **Containerization**: Docker, Docker Compose

---

## 🚀 Getting Started

### Prerequisites
- Node.js (v20+ LTS recommended)
- Docker & Docker Compose
- PostgreSQL & Redis (or use Docker Compose)

### 1. Clone & Setup
```bash
git clone https://github.com/mazinmulani-droid/truetix.git
cd truetix
```

### 2. Start Services via Docker Compose
```bash
docker compose up -d
```

### 3. Backend Setup
```bash
cd backend
npm install
npx prisma generate
npx prisma db push
npx prisma db seed
npm run start:dev
```

### 4. Frontend Setup
```bash
cd ../frontend
npm install
npm run dev
```

The application will be accessible at:
- **Frontend**: `http://localhost:3000`
- **Backend API**: `http://localhost:4000` (or configured port)

---

## 📄 License
This project is licensed under the MIT License.
