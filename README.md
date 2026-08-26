# Node.js Ledger API

[![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![Express.js](https://img.shields.io/badge/Express.js-000000?style=for-the-badge&logo=express&logoColor=white)](https://expressjs.com/)
[![MongoDB](https://img.shields.io/badge/MongoDB-4EA94B?style=for-the-badge&logo=mongodb&logoColor=white)](https://www.mongodb.com/)

A scalable, secure backend REST API designed for processing and tracking financial transactions using a double-entry ledger architecture. This system provides a robust foundation for e-commerce platforms, digital wallets, or enterprise fintech applications that require precise state management of digital assets.

## Table of Contents
- [Architecture & Features](#architecture--features)
- [System Requirements](#system-requirements)
- [Installation & Setup](#installation--setup)
- [API Reference](#api-reference)
- [Security Implementations](#security-implementations)
- [License](#license)

## Architecture & Features

This API is built using a standard Model-View-Controller (MVC) architecture to ensure modularity and maintainability. 

- **Double-Entry Ledger Engine**: Ensures atomic and accurate transaction logging.
- **Wallet & Account Management**: Dynamic creation and real-time balance retrieval for digital accounts.
- **Role-Based Access Control (RBAC)**: Distinguishes between standard clients and administrative system users for sensitive operations (e.g., initial fund injection).
- **Stateless Authentication**: Session management via JSON Web Tokens (JWT) coupled with a token invalidation strategy.
- **Asynchronous Event Handling**: Integrated transactional email service via SMTP.

## System Requirements

- Node.js (v14.x or higher recommended)
- MongoDB (Local instance or Atlas cluster)
- SMTP Server credentials (for email services)

## Installation & Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd backend-ledger
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure Environment Variables**
   Create a `.env` file in the root directory using the provided template:
   ```bash
   cp .env.example .env
   ```
   Update the `.env` file with your specific database URI, JWT secret, and SMTP configuration.

4. **Initialize the Server**
   To start the application in development mode:
   ```bash
   npm run dev
   ```
   The API will initialize and bind to `http://localhost:3000` by default.

## API Reference

### Authentication Services (`/api/auth`)
| Method | Endpoint | Description | Authentication |
|--------|----------|-------------|----------------|
| POST | `/register` | Register a new client entity | None |
| POST | `/login` | Authenticate and retrieve JWT | None |
| POST | `/logout` | Invalidate active session token | Required |

### Account Services (`/api/accounts`)
| Method | Endpoint | Description | Authentication |
|--------|----------|-------------|----------------|
| POST | `/` | Provision a new financial account | Required |
| GET | `/` | Retrieve all accounts for the authenticated client | Required |
| GET | `/balance/:accountId` | Retrieve real-time balance for a specific account | Required |

### Transaction Services (`/api/transactions`)
| Method | Endpoint | Description | Authentication |
|--------|----------|-------------|----------------|
| POST | `/` | Execute a standard fund transfer | Required |
| POST | `/system/initial-funds` | Inject operational funds | Required (System Admin) |

## Security Implementations

- **Password Cryptography**: Passwords are mathematically hashed and salted using `bcryptjs` prior to database persistence.
- **Token Blacklisting**: Implementing a persistence-based token blacklist to immediately revoke compromised or expired JWTs on logout.
- **Protected Routes**: Custom middleware interceptors validate JWT signatures and verify authorization levels before granting endpoint access.

## License

Distributed under the ISC License.
