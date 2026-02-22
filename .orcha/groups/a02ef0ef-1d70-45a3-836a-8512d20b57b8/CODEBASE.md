# Codebase Documentation

## About This Project

AskTrim Backend Services - subscription tracking backend with JWT-based authentication, profile management, and account lifecycle. Supports secure login with 2FA (TOTP/SMS), profile CRUD with email verification, and soft/hard delete with 7-day grace period.

## Tech Stack

- **Runtime**: Node.js + TypeScript
- **Framework**: Express 5.x REST API
- **Auth**: jsonwebtoken, bcryptjs, speakeasy (TOTP)
- **Testing**: Jest + supertest (94.11% coverage, 160 tests)
- **Architecture**: Clean architecture - domain/application/infrastructure layers

## What This Branch Does

Implements BE-002 (Auth) and BE-003 (Profile):
- **Auth**: Login, logout, refresh, password change/reset, 2FA enforcement
- **Profile**: GET/PATCH profile, email verification, DELETE with 7-day grace, undelete, Plaid revocation, scheduled hard delete

## Key Files

- `src/api/routes/profile.ts` - Profile endpoint handlers
- `src/application/services/ProfileService.ts` - Profile/deletion logic
- `src/infrastructure/providers/PlaidProvider.ts` - Financial connections
- `src/infrastructure/providers/EmailProvider.ts` - Email notifications
- `src/infrastructure/repositories/UserRepository.ts` - User persistence, soft/hard delete
- `docs/openapi/profile.yaml` - OpenAPI spec
- `docs/test-report-be-003.md` - QA sign-off
