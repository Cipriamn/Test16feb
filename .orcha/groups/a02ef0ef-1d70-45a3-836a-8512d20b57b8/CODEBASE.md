# Codebase Documentation

## About This Project

AskTrim Backend Services - subscription tracking backend with JWT-based authentication, profile management, connection lifecycle, and transaction sync. Supports secure login with 2FA (TOTP/SMS), profile CRUD with email verification, soft/hard delete with 7-day grace period, financial institution connections via Plaid, and bulk transaction syncing with deduplication.

## Tech Stack

- **Runtime**: Node.js + TypeScript
- **Framework**: Express 5.x REST API
- **Auth**: jsonwebtoken, bcryptjs, speakeasy (TOTP)
- **External**: Plaid integration for financial connections and transaction sync
- **Testing**: Jest + supertest (91.41% coverage, 244 tests)
- **Architecture**: Clean architecture - domain/application/infrastructure layers with domain events

## What This Branch Does

Implements BE-002 (Auth), BE-003 (Profile), BE-005 (Connections), and BE-006 (Transaction Sync):
- **Auth**: Login, logout, refresh, password change/reset, 2FA enforcement
- **Profile**: GET/PATCH profile, email verification, DELETE with 7-day grace, undelete, Plaid revocation
- **Connections**: List, manual refresh, disconnect with confirmation, daily auto-sync, domain events
- **Transaction Sync**: Initial 90-day sync, incremental daily sync, bulk insert, deduplication by plaidTransactionId, pagination >500 txn, foreign currency support, TransactionsSynced event

## Key Files

- `src/application/services/TransactionSyncService.ts` - Core sync logic (90-day initial, incremental, retry, pagination)
- `src/api/routes/transactions.ts` - POST /sync, GET list, GET by ID
- `src/infrastructure/repositories/TransactionRepository.ts` - Bulk insert with deduplication
- `src/domain/entities/Transaction.ts` - Transaction entity with foreign currency fields
- `docs/openapi/transactions.yaml` - API documentation
- `docs/test-report-be-006.md` - QA sign-off for transaction sync
