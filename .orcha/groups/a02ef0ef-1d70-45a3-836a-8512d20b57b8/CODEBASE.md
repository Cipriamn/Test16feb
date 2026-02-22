# Codebase Documentation

## About This Project

AskTrim Authentication Service - a JWT-based authentication backend for the AskTrim subscription tracking app. It provides secure login with 2FA support (TOTP/SMS), session management with device tracking, and complete password lifecycle management.

## Tech Stack

- **Runtime**: Node.js with TypeScript
- **Framework**: Express 5.x for REST API
- **Authentication**: jsonwebtoken (JWT), bcryptjs (password hashing), speakeasy (TOTP 2FA)
- **Testing**: Jest with supertest for integration tests, ts-jest for TypeScript
- **Architecture**: Clean architecture with domain entities, application services, infrastructure providers, and API routes

## What This Branch Does

Implements BE-002 Authentication Service with 5 REST endpoints:
- `POST /api/v1/auth/login` - Email/password + OAuth login with 2FA enforcement
- `POST /api/v1/auth/logout` - Session revocation
- `POST /api/v1/auth/refresh` - Token rotation with new session
- `POST /api/v1/auth/password/change` - Password update (requires current password)
- `POST /api/v1/auth/password/reset` - Email reset link generation

## Key Files

- **`src/api/routes/auth.ts`** - All auth endpoint handlers
- **`src/application/services/AuthService.ts`** - Core auth business logic
- **`src/infrastructure/providers/TokenProvider.ts`** - JWT generation/verification
- **`src/domain/entities/AuthSession.ts`** - Session entity with device tracking
- **`openapi.yaml`** - Complete API documentation
- **`TEST-REPORT-BE-002.md`** - QA test report with sign-off
