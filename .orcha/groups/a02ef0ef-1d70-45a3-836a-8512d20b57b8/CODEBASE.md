# Codebase Documentation

## About This Project

AskTrim Backend Services - subscription tracking backend with JWT-based authentication, profile management, and connection lifecycle management. Supports secure login with 2FA (TOTP/SMS), profile CRUD with email verification, soft/hard delete with 7-day grace period, and financial institution connection management via Plaid integration.

## Tech Stack

- **Runtime**: Node.js + TypeScript
- **Framework**: Express 5.x REST API
- **Auth**: jsonwebtoken, bcryptjs, speakeasy (TOTP)
- **External**: Plaid integration for financial connections
- **Testing**: Jest + supertest (93.43% coverage, 208 tests)
- **Architecture**: Clean architecture - domain/application/infrastructure layers with domain events

## What This Branch Does

Implements BE-002 (Auth), BE-003 (Profile), and BE-005 (Connection Lifecycle):
- **Auth**: Login, logout, refresh, password change/reset, 2FA enforcement
- **Profile**: GET/PATCH profile, email verification, DELETE with 7-day grace, undelete, Plaid revocation
- **Connections**: List connections, manual refresh with sync status, disconnect with confirmation, daily auto-sync job, domain events (ConnectionDisconnected), security event logging

## Key Files

- `src/api/routes/connections.ts` - Connection endpoint handlers (list, refresh, disconnect)
- `src/application/services/ConnectionService.ts` - Connection sync and disconnect logic
- `src/domain/entities/Connection.ts` - Connection entity with status tracking
- `src/domain/events/DomainEvents.ts` - ConnectionDisconnected domain event
- `src/infrastructure/providers/PlaidProvider.ts` - Plaid sync and token revocation
- `src/infrastructure/providers/AlertProvider.ts` - Sync failure alerts
- `docs/test-report-be-005.md` - QA sign-off for connection lifecycle
