# DB-003: Transaction Schema Documentation

## Overview

The transactions table stores raw transaction data from Plaid for subscription detection and analytics. It uses **monthly partitioning by date** for optimal query performance on large datasets.

## Schema

### Table: `transactions`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | NOT NULL, DEFAULT uuid_generate_v4() | Primary key (composite with date) |
| `connection_id` | UUID | NOT NULL, FK -> connections | Reference to Plaid connection |
| `account_id` | UUID | NOT NULL, FK -> financial_accounts | Reference to financial account |
| `transaction_id` | VARCHAR(100) | NOT NULL, UNIQUE with date | Plaid transaction identifier |
| `amount` | DECIMAL(15, 4) | NOT NULL | Transaction amount (4 decimal precision) |
| `currency` | CHAR(3) | NOT NULL, CHECK ISO 4217 | Currency code (USD, EUR, GBP, etc.) |
| `date` | DATE | NOT NULL | Transaction date (partition key) |
| `merchant_name` | VARCHAR(255) | NULL | Merchant or payee name |
| `description` | TEXT | NULL | Full transaction description |
| `category` | VARCHAR(100) | NULL | Plaid transaction category |
| `pending` | BOOLEAN | NOT NULL DEFAULT FALSE | Whether transaction is pending |
| `created_at` | TIMESTAMP WITH TIME ZONE | NOT NULL DEFAULT CURRENT_TIMESTAMP | Record creation timestamp |

### Constraints

- **Primary Key**: `(id, date)` - Composite to support partitioning
- **Foreign Key**: `connection_id` -> `connections(id)` ON DELETE CASCADE
- **Foreign Key**: `account_id` -> `financial_accounts(id)` ON DELETE CASCADE
- **Unique**: `(transaction_id, date)` - Plaid transaction uniqueness per partition
- **Check**: `currency` matches `^[A-Z]{3}$` (ISO 4217)

### Indexes

| Index Name | Columns | Type | Purpose |
|------------|---------|------|---------|
| `idx_transactions_plaid_id_date` | `(transaction_id, date)` | Unique | Ensure Plaid ID uniqueness |
| `idx_transactions_connection_date` | `(connection_id, date DESC)` | B-tree | Fast date-range queries per connection |
| `idx_transactions_account_date` | `(account_id, date DESC)` | B-tree | Account-specific queries |
| `idx_transactions_pending` | `(pending)` WHERE `pending = TRUE` | Partial | Filter pending transactions |
| `idx_transactions_merchant` | `(merchant_name)` WHERE `NOT NULL` | Partial | Merchant analysis |
| `idx_transactions_category` | `(category)` WHERE `NOT NULL` | Partial | Category filtering |

## Partitioning Strategy

### Design Rationale

Monthly partitioning was chosen because:

1. **Query patterns**: Most queries filter by date ranges (last 30/90/365 days)
2. **Data growth**: ~10K-100K transactions/user/year, partitions keep tables manageable
3. **Maintenance**: Easy to drop old partitions for data retention
4. **Performance**: Partition pruning eliminates scanning irrelevant data

### Partition Naming Convention

```
transactions_YYYY_MM
```

Examples:
- `transactions_2025_01` - January 2025
- `transactions_2025_02` - February 2025
- `transactions_default` - Catches out-of-range dates

### Initial Partitions

The migration creates:
- 12 months of historical partitions (past year)
- Current month partition
- 3 months of future partitions
- Default partition for edge cases

### Partition Maintenance

#### Creating Future Partitions

Use the helper function monthly (via cron/pg_cron):

```sql
-- Create partition for a specific month
SELECT create_transactions_partition('2025-06-01');

-- Create next month's partition
SELECT create_transactions_partition(DATE_TRUNC('month', CURRENT_DATE + INTERVAL '1 month'));
```

Recommended: Run monthly on the 1st to create 2-3 months ahead.

#### Dropping Old Partitions

For data retention (e.g., keep 2 years):

```sql
-- Drop partitions older than 2 years
DROP TABLE transactions_2023_01;
DROP TABLE transactions_2023_02;
-- etc.
```

**Warning**: Always verify data backup before dropping partitions.

#### Monitoring Partition Sizes

```sql
SELECT
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname || '.' || tablename)) AS size
FROM pg_tables
WHERE tablename LIKE 'transactions%'
ORDER BY pg_total_relation_size(schemaname || '.' || tablename) DESC;
```

### Partition Pruning

PostgreSQL automatically prunes partitions for queries with date filters:

```sql
-- Only scans transactions_2025_02
EXPLAIN ANALYZE
SELECT * FROM transactions
WHERE date >= '2025-02-01' AND date < '2025-03-01';

-- Scans multiple partitions (last 3 months)
EXPLAIN ANALYZE
SELECT * FROM transactions
WHERE date >= CURRENT_DATE - INTERVAL '90 days';
```

## Query Patterns

### Common Queries (Optimized)

```sql
-- Get recent transactions for a connection (uses composite index)
SELECT * FROM transactions
WHERE connection_id = 'uuid-here'
  AND date >= CURRENT_DATE - INTERVAL '30 days'
ORDER BY date DESC;

-- Get all transactions for an account in a date range
SELECT * FROM transactions
WHERE account_id = 'uuid-here'
  AND date BETWEEN '2025-01-01' AND '2025-01-31'
ORDER BY date DESC;

-- Find pending transactions
SELECT * FROM transactions
WHERE pending = TRUE
  AND date >= CURRENT_DATE - INTERVAL '7 days';

-- Subscription detection: recurring merchants
SELECT merchant_name, COUNT(*), AVG(amount)
FROM transactions
WHERE connection_id = 'uuid-here'
  AND date >= CURRENT_DATE - INTERVAL '365 days'
GROUP BY merchant_name
HAVING COUNT(*) >= 3;
```

### Bulk Insert Pattern

For optimal performance with bulk inserts:

```sql
-- Use COPY for large inserts (fastest)
COPY transactions (connection_id, account_id, transaction_id, amount, currency, date, ...)
FROM '/path/to/data.csv' WITH (FORMAT csv, HEADER);

-- Or batched inserts with explicit partition targeting
INSERT INTO transactions_2025_02 (...)
SELECT ... FROM staging_table
WHERE date >= '2025-02-01' AND date < '2025-03-01';
```

## Currency Handling

### Supported Currencies

All ISO 4217 3-letter codes are supported:

| Currency | Description | Typical Precision |
|----------|-------------|-------------------|
| USD | US Dollar | 2 decimals |
| EUR | Euro | 2 decimals |
| GBP | British Pound | 2 decimals |
| JPY | Japanese Yen | 0 decimals |
| CAD | Canadian Dollar | 2 decimals |
| ... | Any ISO 4217 | Varies |

### Amount Precision

The `DECIMAL(15, 4)` type supports:
- Up to 15 total digits
- 4 decimal places for currency conversion precision
- Range: -99,999,999,999.9999 to 99,999,999,999.9999

### Currency Queries

```sql
-- Group by currency
SELECT currency, COUNT(*), SUM(amount)
FROM transactions
WHERE connection_id = 'uuid-here'
GROUP BY currency;
```

## Migration Details

### Up Migration (008_create_transactions_table.up.sql)

1. Creates partitioned `transactions` table
2. Generates initial monthly partitions (12 past + 3 future)
3. Creates default partition
4. Adds indexes on each partition
5. Creates helper function for future partitions

### Down Migration (008_create_transactions_table.down.sql)

1. Drops helper function
2. Drops partitioned table (cascades to all partitions and indexes)

## Performance Considerations

### Expected Performance

| Operation | Expected Time | Notes |
|-----------|---------------|-------|
| Single partition query | <100ms | With index |
| 3-month range query | <500ms | 3 partitions scanned |
| Bulk insert 10K rows | <5s | Single partition |
| Full table scan | Varies | Avoid in production |

### Optimization Tips

1. **Always include date filter** - Enables partition pruning
2. **Use connection_id + date** - Primary access pattern
3. **Batch inserts by month** - Reduces partition switching
4. **Monitor partition sizes** - Rebalance if needed

## Related Tables

- `connections` - Parent for connection_id FK
- `financial_accounts` - Parent for account_id FK
- `subscriptions` (future) - Will reference transactions for detection
