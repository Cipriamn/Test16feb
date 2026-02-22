# DB-002: Financial Connection Schema Documentation

## Overview

This document describes the database schema for storing Plaid financial connections and linked bank accounts.

## Tables

### connections

Stores Plaid connection metadata with encrypted access tokens.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK, DEFAULT uuid_generate_v4() | Unique identifier |
| user_id | UUID | FK → users(id) ON DELETE CASCADE, NOT NULL | Owner of the connection |
| institution_id | VARCHAR(100) | NOT NULL | Plaid institution identifier |
| institution_name | VARCHAR(255) | NOT NULL | Human-readable institution name |
| access_token | BYTEA | NOT NULL | AES-256 encrypted Plaid access token |
| status | connection_status | NOT NULL, DEFAULT 'active' | Connection state (active/failed/disconnected) |
| last_sync_at | TIMESTAMPTZ | NULL | Last successful data sync from Plaid |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT CURRENT_TIMESTAMP | Record creation time |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT CURRENT_TIMESTAMP | Last update time (auto-updated via trigger) |

### financial_accounts

Stores financial accounts linked via Plaid connections.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK, DEFAULT uuid_generate_v4() | Unique identifier |
| connection_id | UUID | FK → connections(id) ON DELETE CASCADE, NOT NULL | Parent connection |
| account_id | VARCHAR(100) | NOT NULL | Plaid account identifier |
| account_type | account_type | NOT NULL | Account type (checking/savings/credit) |
| mask | VARCHAR(10) | NULL | Last 4 digits of account number |
| name | VARCHAR(255) | NOT NULL | Account display name |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT CURRENT_TIMESTAMP | Record creation time |

## Enums

### connection_status
- `active` - Connection is working normally
- `failed` - Connection requires user re-authentication
- `disconnected` - User disconnected the connection

### account_type
- `checking` - Checking/current account
- `savings` - Savings account
- `credit` - Credit card account

## Indexes

| Index | Table | Columns | Purpose |
|-------|-------|---------|---------|
| idx_connections_user_id_status | connections | (user_id, status) | Fast lookup of user connections by status |
| idx_connections_institution_id | connections | (institution_id) | Find connections by institution |
| idx_financial_accounts_connection_id | financial_accounts | (connection_id) | Fast lookup of accounts by connection |

## Constraints

| Constraint | Table | Type | Description |
|------------|-------|------|-------------|
| connections_pkey | connections | PRIMARY KEY | Unique connection ID |
| connections_user_id_fkey | connections | FOREIGN KEY | References users.id with CASCADE delete |
| financial_accounts_pkey | financial_accounts | PRIMARY KEY | Unique account ID |
| financial_accounts_connection_id_fkey | financial_accounts | FOREIGN KEY | References connections.id with CASCADE delete |
| financial_accounts_connection_account_unique | financial_accounts | UNIQUE | Prevents duplicate Plaid accounts per connection |

## Cascade Behavior

- Deleting a **user** cascades to delete all their **connections**
- Deleting a **connection** cascades to delete all linked **financial_accounts**

## Encryption Strategy

### access_token Field

The `access_token` column stores Plaid access tokens encrypted with AES-256.

#### Encryption Method

Using PostgreSQL's `pgcrypto` extension with `pgp_sym_encrypt`:

```sql
-- Encrypt before insert
INSERT INTO connections (user_id, institution_id, institution_name, access_token, ...)
VALUES (
    user_uuid,
    'ins_3',
    'Chase',
    pgp_sym_encrypt('plaid-access-token', 'encryption_key'),
    ...
);

-- Decrypt after select
SELECT
    pgp_sym_decrypt(access_token, 'encryption_key') as decrypted_token
FROM connections
WHERE id = connection_uuid;
```

#### Key Management

| Environment | Strategy |
|-------------|----------|
| Development | Environment variable `DB_ENCRYPTION_KEY` |
| Production | AWS KMS, HashiCorp Vault, or similar key management service |

**Best Practices:**
1. Never store encryption keys in source code
2. Rotate keys periodically (implement key versioning)
3. Use separate keys per environment
4. Audit key access
5. Application-layer encryption preferred over database-layer for production

#### Encryption Parameters

- **Algorithm**: AES-256 (via pgcrypto's `cipher-algo=aes256`)
- **Key Length**: 256 bits (32 bytes minimum)
- **Storage Format**: BYTEA (binary)

### Application-Level Encryption (Recommended for Production)

For production deployments, consider application-level encryption:

```typescript
// Example: Node.js with AES-256-GCM
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

function encrypt(plaintext: string, key: Buffer): Buffer {
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, key, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return Buffer.concat([iv, authTag, encrypted]);
}

function decrypt(ciphertext: Buffer, key: Buffer): string {
    const iv = ciphertext.subarray(0, IV_LENGTH);
    const authTag = ciphertext.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
    const encrypted = ciphertext.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    return decipher.update(encrypted) + decipher.final('utf8');
}
```

## Migration Files

- `006_create_connections_table.up.sql` - Create connections table
- `006_create_connections_table.down.sql` - Drop connections table
- `007_create_financial_accounts_table.up.sql` - Create financial_accounts table
- `007_create_financial_accounts_table.down.sql` - Drop financial_accounts table

## Seed Data

Test data in `seeds/002_seed_connections.sql`:
- 9 connections across 4 users (multiple connections per user)
- 15 financial accounts linked to connections
- Various connection statuses (active, failed, disconnected)
- All account types represented (checking, savings, credit)

## Performance Considerations

1. **Composite index on (user_id, status)**: Optimized for common query pattern
2. **No artificial limit on connections per user**: Users can have unlimited connections
3. **Query target**: Fetch all connections for user in <50ms
