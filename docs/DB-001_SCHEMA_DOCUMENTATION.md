# DB-001: User and Identity Schema Documentation

**Version:** 1.0
**Created:** 2026-02-22
**Requirements:** REQ-BE-001 through REQ-BE-007, REQ-NFR-004, REQ-NFR-006, REQ-NFR-007

---

## Overview

This schema implements the database layer for the Identity & Access bounded context, supporting:
- User registration and profile management
- Multi-provider authentication (email/password, Google OAuth, Facebook OAuth)
- Two-factor authentication (SMS and TOTP)
- Session management with device tracking
- Terms and privacy consent tracking

## Entity Relationship Diagram

```
┌─────────────────────┐
│       users         │
├─────────────────────┤
│ id (PK, UUID)       │
│ email (UNIQUE, IDX) │
│ name                │
│ phone               │
│ address             │
│ timezone            │
│ profile_photo_url   │
│ created_at          │
│ updated_at          │
└─────────┬───────────┘
          │
          │ ON DELETE CASCADE
          │
    ┌─────┴─────┬─────────────┬──────────────┐
    ▼           ▼             ▼              ▼
┌────────────┐ ┌──────────┐ ┌──────────────┐ ┌─────────────┐
│credentials │ │ consents │ │two_factor_   │ │auth_sessions│
├────────────┤ ├──────────┤ │    auth      │ ├─────────────┤
│id (PK)     │ │id (PK)   │ ├──────────────┤ │id (PK)      │
│user_id(FK) │ │user_id   │ │id (PK)       │ │user_id (FK) │
│provider    │ │(FK)      │ │user_id (FK)  │ │token_hash   │
│password_   │ │terms_    │ │method        │ │device_info  │
│  hash      │ │version   │ │secret (ENC)  │ │ip_address   │
│oauth_      │ │accepted_ │ │backup_codes  │ │location     │
│provider_id │ │  at      │ │  (ENC)       │ │expires_at   │
│created_at  │ └──────────┘ │enabled       │ │created_at   │
└────────────┘              │created_at    │ └─────────────┘
                            └──────────────┘
```

---

## Tables

### 1. users

Primary table for user accounts.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK, DEFAULT uuid_generate_v4() | Unique identifier |
| `email` | VARCHAR(255) | NOT NULL, UNIQUE, CHECK (email format) | Login identifier |
| `name` | VARCHAR(255) | | Display name |
| `phone` | VARCHAR(50) | | Phone number for 2FA/contact |
| `address` | TEXT | | User address |
| `timezone` | VARCHAR(50) | DEFAULT 'UTC' | For localized notifications |
| `profile_photo_url` | TEXT | | Avatar URL |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Account creation |
| `updated_at` | TIMESTAMPTZ | NOT NULL, auto-updated | Last modification |

**Indexes:**
- `idx_users_email` on `email` - Fast authentication lookups

**Triggers:**
- `update_users_updated_at` - Auto-updates `updated_at` on row changes

---

### 2. credentials

Authentication credentials supporting multiple providers per user.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK | Unique identifier |
| `user_id` | UUID | FK → users, ON DELETE CASCADE | Owner |
| `provider` | ENUM('email','google','facebook') | NOT NULL | Auth provider |
| `password_hash` | VARCHAR(72) | | bcrypt hash (12+ rounds) |
| `oauth_provider_id` | VARCHAR(255) | | External OAuth user ID |
| `created_at` | TIMESTAMPTZ | NOT NULL | Credential creation |

**Constraints:**
- `credentials_auth_check` - Ensures password_hash XOR oauth_provider_id based on provider
- `credentials_user_provider_unique` - One credential per provider per user

**Indexes:**
- `idx_credentials_user_id` on `user_id` - Find all auth methods for user
- `idx_credentials_oauth_lookup` on `(provider, oauth_provider_id)` - OAuth login lookups

---

### 3. consents

Tracks user acceptance of terms and privacy policies.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK | Unique identifier |
| `user_id` | UUID | FK → users, ON DELETE CASCADE | User who consented |
| `terms_version` | VARCHAR(20) | NOT NULL | Version string (e.g., "1.0") |
| `accepted_at` | TIMESTAMPTZ | NOT NULL | Consent timestamp |

**Constraints:**
- `consents_user_version_unique` - One record per user per version

**Indexes:**
- `idx_consents_user_id` on `user_id` - Find user's consent history
- `idx_consents_version` on `terms_version` - Find users on specific version

---

### 4. two_factor_auth

Two-factor authentication configuration with encrypted secrets.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK | Unique identifier |
| `user_id` | UUID | FK → users, ON DELETE CASCADE | Owner |
| `method` | ENUM('sms','totp') | NOT NULL | 2FA method |
| `secret` | BYTEA | NOT NULL | **AES-256 encrypted** TOTP secret or phone |
| `backup_codes` | BYTEA | NOT NULL | **AES-256 encrypted** JSON array of codes |
| `enabled` | BOOLEAN | NOT NULL, DEFAULT false | Active status |
| `created_at` | TIMESTAMPTZ | NOT NULL | Setup timestamp |

**Constraints:**
- `two_factor_auth_user_method_unique` - One config per method per user

**Indexes:**
- `idx_two_factor_auth_user_id` on `user_id` - Find user's 2FA settings
- `idx_two_factor_auth_enabled` on `(user_id, enabled)` WHERE enabled=true - Auth checks

**Encryption Notes:**
- `secret` and `backup_codes` must be encrypted at application level using AES-256
- Use key management service (AWS KMS, HashiCorp Vault) for encryption keys
- Never log or expose decrypted values

---

### 5. auth_sessions

Active authentication sessions for device management.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK | Session identifier |
| `user_id` | UUID | FK → users, ON DELETE CASCADE | Session owner |
| `token_hash` | VARCHAR(64) | NOT NULL, UNIQUE | SHA-256 of session token |
| `device_info` | JSONB | | Device/browser metadata |
| `ip_address` | INET | | Client IP |
| `location` | VARCHAR(255) | | Geo-location (city, country) |
| `expires_at` | TIMESTAMPTZ | NOT NULL | Session expiration |
| `created_at` | TIMESTAMPTZ | NOT NULL | Session creation |

**Indexes:**
- `idx_auth_sessions_user_expires` on `(user_id, expires_at)` - Session management, logout all
- `idx_auth_sessions_token_hash` on `token_hash` - Token validation
- `idx_auth_sessions_expires_at` on `expires_at` WHERE < NOW() - Cleanup jobs

**Security Notes:**
- Store SHA-256 hash of token, never the raw token
- Token expiration: 24h for access tokens, 30d for refresh tokens (REQ-NFR-007)

---

## Cascade Delete Behavior

When a user is deleted, all related records are automatically removed:

```
DELETE FROM users WHERE id = 'xxx'
  → credentials (all auth methods)
  → consents (all accepted terms)
  → two_factor_auth (all 2FA configs)
  → auth_sessions (all active sessions)
```

This supports REQ-BE-005 (Account Deletion) with complete data removal.

---

## Security Requirements Compliance

| Requirement | Implementation |
|------------|----------------|
| REQ-NFR-004 (AES-256 at rest) | `secret` and `backup_codes` stored as encrypted BYTEA |
| REQ-NFR-006 (bcrypt 12+ rounds) | `password_hash` uses bcrypt with 12+ cost factor |
| REQ-NFR-007 (Token expiration) | `expires_at` column enforces 24h/30d limits |

---

## Query Patterns & Performance

### Authentication Flow
```sql
-- Fast email lookup for login
SELECT id, email FROM users WHERE email = $1;

-- Get credentials by user
SELECT * FROM credentials WHERE user_id = $1;

-- Check enabled 2FA (uses partial index)
SELECT * FROM two_factor_auth
WHERE user_id = $1 AND enabled = true;
```

### Session Management
```sql
-- Validate session token
SELECT s.*, u.email FROM auth_sessions s
JOIN users u ON s.user_id = u.id
WHERE s.token_hash = $1 AND s.expires_at > NOW();

-- Get user's active sessions
SELECT * FROM auth_sessions
WHERE user_id = $1 AND expires_at > NOW()
ORDER BY created_at DESC;

-- Logout all devices
DELETE FROM auth_sessions WHERE user_id = $1;
```

### Cleanup Job
```sql
-- Remove expired sessions (uses partial index)
DELETE FROM auth_sessions WHERE expires_at < NOW();
```

---

## Migration Files

| File | Description |
|------|-------------|
| `001_create_users_table.up.sql` | Create users table with indexes and trigger |
| `001_create_users_table.down.sql` | Rollback users table |
| `002_create_credentials_table.up.sql` | Create credentials with auth constraints |
| `002_create_credentials_table.down.sql` | Rollback credentials |
| `003_create_consents_table.up.sql` | Create consents table |
| `003_create_consents_table.down.sql` | Rollback consents |
| `004_create_two_factor_auth_table.up.sql` | Create 2FA with encryption columns |
| `004_create_two_factor_auth_table.down.sql` | Rollback 2FA |
| `005_create_auth_sessions_table.up.sql` | Create sessions with indexes |
| `005_create_auth_sessions_table.down.sql` | Rollback sessions |

---

## Seed Data

`seeds/001_seed_test_users.sql` provides:
- 6 test users with varying profile completeness
- Multiple credential types (email, Google, Facebook)
- Consent records for different terms versions
- 2FA configurations (enabled/disabled)
- Active and expired sessions
- User specifically for cascade delete testing

---

## Performance Considerations

1. **Email Index**: Unique B-tree index on `users.email` ensures O(log n) lookups
2. **Composite Session Index**: `(user_id, expires_at)` optimizes "show my sessions" queries
3. **Partial Indexes**: Only index enabled 2FA and expired sessions where needed
4. **UUID Primary Keys**: Distributed-system friendly, no central sequence bottleneck
5. **JSONB for Device Info**: Flexible schema for varying device metadata

---

## Extension Requirements

The schema requires these PostgreSQL extensions:
- `uuid-ossp` - UUID generation
- `pgcrypto` - Encryption functions (for 2FA secrets)
