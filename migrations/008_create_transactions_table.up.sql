-- Migration: 008_create_transactions_table
-- Description: Create transactions table with monthly partitioning for Plaid transaction data
-- Requirements: REQ-DB-002, REQ-BE-010

-- Create partitioned transactions table
CREATE TABLE transactions (
    id UUID NOT NULL DEFAULT uuid_generate_v4(),
    connection_id UUID NOT NULL,
    account_id UUID NOT NULL,
    transaction_id VARCHAR(100) NOT NULL,  -- Plaid transaction identifier
    amount DECIMAL(15, 4) NOT NULL,        -- Supports up to 15 digits, 4 decimal places for precision
    currency CHAR(3) NOT NULL,             -- ISO 4217 currency code (e.g., USD, EUR, GBP)
    date DATE NOT NULL,                    -- Transaction date (partition key)
    merchant_name VARCHAR(255),
    description TEXT,
    category VARCHAR(100),                 -- Plaid category
    pending BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- Primary key must include partition key
    PRIMARY KEY (id, date),

    -- Foreign keys (note: partition-wise FKs require referencing non-partitioned tables)
    CONSTRAINT fk_transactions_connection FOREIGN KEY (connection_id)
        REFERENCES connections(id) ON DELETE CASCADE,
    CONSTRAINT fk_transactions_account FOREIGN KEY (account_id)
        REFERENCES financial_accounts(id) ON DELETE CASCADE,

    -- Currency validation (ISO 4217 - 3 uppercase letters)
    CONSTRAINT transactions_currency_iso4217 CHECK (currency ~ '^[A-Z]{3}$')
) PARTITION BY RANGE (date);

-- Create initial partitions (current month + 3 months ahead + 12 months back)
-- Partitions named: transactions_YYYY_MM
DO $$
DECLARE
    start_date DATE;
    end_date DATE;
    partition_name TEXT;
    partition_start DATE;
    partition_end DATE;
BEGIN
    -- Start 12 months ago, end 3 months in future
    start_date := DATE_TRUNC('month', CURRENT_DATE - INTERVAL '12 months');
    end_date := DATE_TRUNC('month', CURRENT_DATE + INTERVAL '4 months');

    partition_start := start_date;
    WHILE partition_start < end_date LOOP
        partition_name := 'transactions_' || TO_CHAR(partition_start, 'YYYY_MM');
        partition_end := partition_start + INTERVAL '1 month';

        EXECUTE format(
            'CREATE TABLE %I PARTITION OF transactions FOR VALUES FROM (%L) TO (%L)',
            partition_name,
            partition_start,
            partition_end
        );

        partition_start := partition_end;
    END LOOP;
END $$;

-- Create default partition for out-of-range dates
CREATE TABLE transactions_default PARTITION OF transactions DEFAULT;

-- Unique constraint on Plaid transaction_id (global uniqueness across partitions)
-- Note: In partitioned tables, unique indexes must include partition key
CREATE UNIQUE INDEX idx_transactions_plaid_id_date ON transactions(transaction_id, date);

-- Composite index for connection + date range queries (most common access pattern)
CREATE INDEX idx_transactions_connection_date ON transactions(connection_id, date DESC);

-- Index for account-based queries
CREATE INDEX idx_transactions_account_date ON transactions(account_id, date DESC);

-- Index for pending transaction filtering
CREATE INDEX idx_transactions_pending ON transactions(pending) WHERE pending = TRUE;

-- Index for merchant analysis
CREATE INDEX idx_transactions_merchant ON transactions(merchant_name) WHERE merchant_name IS NOT NULL;

-- Index for category filtering
CREATE INDEX idx_transactions_category ON transactions(category) WHERE category IS NOT NULL;

-- Comments
COMMENT ON TABLE transactions IS 'Raw transaction data from Plaid, partitioned monthly by date';
COMMENT ON COLUMN transactions.transaction_id IS 'Plaid unique transaction identifier';
COMMENT ON COLUMN transactions.amount IS 'Transaction amount with 4 decimal precision for currency conversion';
COMMENT ON COLUMN transactions.currency IS 'ISO 4217 currency code (e.g., USD, EUR, GBP, JPY)';
COMMENT ON COLUMN transactions.date IS 'Transaction date - partition key';
COMMENT ON COLUMN transactions.category IS 'Plaid transaction category';
COMMENT ON COLUMN transactions.pending IS 'Whether transaction is pending (not yet posted)';

-- Function to create future partitions (for maintenance jobs)
CREATE OR REPLACE FUNCTION create_transactions_partition(target_date DATE)
RETURNS TEXT AS $$
DECLARE
    partition_name TEXT;
    partition_start DATE;
    partition_end DATE;
BEGIN
    partition_start := DATE_TRUNC('month', target_date);
    partition_end := partition_start + INTERVAL '1 month';
    partition_name := 'transactions_' || TO_CHAR(partition_start, 'YYYY_MM');

    -- Check if partition already exists
    IF EXISTS (
        SELECT 1 FROM pg_class WHERE relname = partition_name
    ) THEN
        RETURN 'Partition ' || partition_name || ' already exists';
    END IF;

    EXECUTE format(
        'CREATE TABLE %I PARTITION OF transactions FOR VALUES FROM (%L) TO (%L)',
        partition_name,
        partition_start,
        partition_end
    );

    RETURN 'Created partition: ' || partition_name;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION create_transactions_partition IS 'Creates a monthly partition for transactions table. Call monthly via cron/pg_cron.';
