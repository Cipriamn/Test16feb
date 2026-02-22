# Codebase Documentation

## About This Project

AskTrim Backend Services - a subscription tracking backend providing JWT-based authentication, profile management, and account lifecycle features. The service supports secure login with 2FA (TOTP/SMS), profile CRUD with email verification, and account deletion with 7-day grace period.

## Tech Stack

- **Runtime**: Node.js with TypeScript
- **Framework**: Express 5.x for REST API
- **Authentication**: jsonwebtoken (JWT), bcryptjs (password hashing), speakeasy (TOTP 2FA)
- **Testing**: Jest with supertest for integration tests (94% coverage)
- **Architecture**: Clean architecture - domain entities, application services, infrastructure providers, API routes

## What This Branch Does

Implements BE-002 (Authentication) and BE-003 (Profile Management) services:
- **Auth**: Login, logout, refresh tokens, password change/reset with 2FA enforcement
- **Profile**: GET/PATCH user profile, email change verification, account deletion with 7-day grace period, undelete capability, Plaid connection revocation, hard delete after grace period

## Key Files

- **`src/api/routes/profile.ts`** - Profile CRUD endpoint handlers
- **`src/application/services/ProfileService.ts`** - Profile business logic, deletion lifecycle
- **`src/infrastructure/providers/PlaidProvider.ts`** - Financial connection management
- **`src/infrastructure/providers/EmailProvider.ts`** - Email verification and notifications
- **`docs/openapi/profile.yaml`** - Profile API documentation
- **`docs/test-report-be-003.md`** - QA test report with sign-off
