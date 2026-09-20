# Enterprise Node.js Ledger API

[![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![Express.js](https://img.shields.io/badge/Express.js-000000?style=for-the-badge&logo=express&logoColor=white)](https://expressjs.com/)
[![MongoDB](https://img.shields.io/badge/MongoDB-4EA94B?style=for-the-badge&logo=mongodb&logoColor=white)](https://www.mongodb.com/)
[![Redis](https://img.shields.io/badge/Redis-DC382D?style=for-the-badge&logo=redis&logoColor=white)](https://redis.io/)

A highly scalable, secure, and performant REST API designed for processing and tracking financial transactions using a double entry ledger architecture. This system is heavily optimized for high concurrency, making it a robust foundation for e-commerce platforms, digital wallets, or enterprise fintech applications.

## Table of Contents
- [Architecture & Features](#architecture--features)
- [System Requirements](#system-requirements)
- [Installation & Setup](#installation--setup)
- [API Reference](#api-reference)
- [Security & Concurrency Implementations](#security--concurrency-implementations)
- [License](#license)

## Architecture & Features

This API utilizes an advanced, decoupled micro-architecture designed to prevent bottlenecks and ensure mathematically perfect state management.

- **Double Entry Ledger Engine**: Ensures completely accurate transaction logging. Every transfer strictly records balanced `DEBIT` and `CREDIT` entries.
- **Strict Ledger Immutability**: All ledger entries are write-only. Mongoose schema-level middleware strictly blocks and errors on any update or delete operations (`updateOne`, `updateMany`, `findOneAndUpdate`, `deleteOne`, `deleteMany`, `remove`, `findOneAndDelete`, `findOneAndReplace`).
- **Account State & Lifecycle Management**: Accounts support lifecycle statuses (`ACTIVE`, `FROZEN`, `CLOSED`) and default currencies (`INR`). Transaction processing strictly mandates that both source and destination accounts are in an `ACTIVE` state.
- **Background Event Queues (BullMQ)**: Transaction and registration notification emails are asynchronously offloaded to Redis queues with automatic retry mechanisms (3 attempts with 5-second backoff), reducing API response times.
- **Double-Entry Rollups (Snapshots Queue)**: Heavily optimize `getBalance()` lookups using a Read-Through Redis cache (1800s TTL), backed by point-in-time database Snapshots. On cache miss, the system fetches a pre-calculated snapshot and only aggregates subsequent entries. Background workers asynchronously calculate new snapshots every 100 new ledger entries without blocking API threads.
- **Daily Global Ledger Audit (CRON)**: An automated BullMQ repeatable job that runs every night at midnight (`0 0 * * *`) to aggregate the entire database and mathematically verify that `Sum(Total Credits) === Sum(Total Debits)`, raising a critical alert on any integrity mismatch.

## System Requirements

- Node.js (v18.x or higher)
- Redis server running locally or externally
- MongoDB Replica Set (A Replica Set is strictly required for MongoDB Transactions)

## Installation & Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd backend-ledger
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Configure Environment Variables**
   Create a `.env` file in the root directory:
   ```bash
   cp .env.example .env
   ```
   Ensure you provide a valid `MONGO_URI` that points to a replica set, `REDIS_URL`, `JWT_SECRET`, and your email OAuth2 credentials.

4. **Start the Development Server**
   ```bash
   npm run dev
   ```
   The API will initialize and bind to `http://localhost:3000`.

## API Reference

> **Authentication**: For protected routes, pass the JWT token either via the `token` HTTP cookie or the `Authorization: Bearer <token>` request header.

---

### Authentication Services (`/api/auth`)
| Method | Endpoint | Description | Authentication | Rate Limited |
|--------|----------|-------------|----------------|--------------|
| POST | `/register` | Register a new client entity (`email`, `password`, `name`) | None | Yes (10 req/min) |
| POST | `/login` | Authenticate and retrieve JWT (`email`, `password`) | None | Yes (10 req/min) |
| POST | `/logout` | Invalidate active session token (blacklists in Redis) | Required | Yes (10 req/min) |

---

### Account Services (`/api/accounts`)
| Method | Endpoint | Description | Authentication |
|--------|----------|-------------|----------------|
| POST | `/` | Provision a new financial account for authenticated user | Required |
| GET | `/` | Retrieve all accounts for the authenticated client | Required |
| GET | `/balance/:accountId` | Retrieve real-time balance for a specific account | Required |

---

### Idempotency Services (`/api/idempotency-key`)
| Method | Endpoint | Description | Authentication |
|--------|----------|-------------|----------------|
| GET | `/` | Generate a single-use UUIDv4 idempotency key (24-hour TTL) | Required |

---

### Transaction Services (`/api/transactions`)

All transaction mutation endpoints enforce **Idempotency** and **Rate Limiting**.

* **Required Header:** `Idempotency-Key: <key>`
* **Required Body Property:** `idempotencyKey: "<key>"`

| Method | Endpoint | Description | Authentication | Rate Limited |
|--------|----------|-------------|----------------|--------------|
| POST | `/` | Execute a standard fund transfer | Required | Yes (10 req/min) |
| POST | `/system/initial-funds` | Inject operational funds from system user | Required (System User) | Yes (10 req/min) |

#### Request Payloads

* **Standard Transfer (`POST /api/transactions`)**:
  ```json
  {
    "fromAccount": "60d0fe4f5311236168a109ca",
    "toAccount": "60d0fe4f5311236168a109cb",
    "amount": 250.00,
    "idempotencyKey": "a93e3dc1-12f5-485a-ba3e-953eb1947b19"
  }
  ```

* **Initial Operational Funds (`POST /api/transactions/system/initial-funds`)**:
  ```json
  {
    "toAccount": "60d0fe4f5311236168a109cb",
    "amount": 10000.00,
    "idempotencyKey": "a93e3dc1-12f5-485a-ba3e-953eb1947b20"
  }
  ```
  *(The source account is automatically selected from the authenticated system administrator account).*

---

## Security & Concurrency Implementations

This API implements top-tier security and distributed systems principles to handle high traffic environments:

- **Distributed Mutex Locking (Redlock)**: Utilizes the Redlock algorithm to wrap transaction boundaries in thread-safe distributed locks across affected account IDs (`lock:account:<id>`). Locks are acquired in deterministic alphabetical order with retry jitter to prevent deadlocks and overdraft race conditions under high concurrency.
- **Pessimistic Concurrency Control (ACID)**: All financial writes (atomic Ledger insertions and Transaction status changes) are executed within MongoDB `session.startTransaction()`, guaranteeing all-or-nothing rollback on any failure.
- **Two-Tier Idempotency Key Pipeline**: The system verifies single-use idempotency keys (`pending` ➔ `in_progress` ➔ `completed`) via dedicated middleware and controller caching. Duplicate requests return stored responses and prevent duplicate charges. Unused keys expire automatically in MongoDB after 24 hours.
- **Append-Only Immutable Ledger**: Financial entries cannot be altered, patched, or removed under any circumstance; any updates or deletions trigger immediate rejection via pre-execution database hooks.
- **IP Rate Limiting (Redis)**: Sensitive routes (Authentication and Transactions) are throttled via an IP-based fixed-window limiter in Redis (10 requests / 60 seconds) returning HTTP `429 Too Many Requests`.
- **High Performance Token Blacklisting**: JWT invalidation on logout is processed in milliseconds using Redis `EX` expiration flags matching the token's remaining lifetime.
- **Dual Authentication Extraction**: Supports credentials extracted from either HTTP cookies (`token`) or the `Authorization: Bearer <token>` header.
- **Password Cryptography**: Passwords are securely hashed with a salt factor of 10 using `bcryptjs`.

## License

Distributed under the ISC License.

