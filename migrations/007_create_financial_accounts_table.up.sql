-- Migration: 007_create_financial_accounts_table
-- Description: Create financial_accounts table for linked bank accounts
-- Requirements: REQ-DB-001, REQ-BE-008, REQ-BE-011

-- Account type enum
CREATE TYPE account_type AS ENUM ('checking', 'savings', 'credit');

CREATE TABLE financial_accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    connection_id UUID NOT NULL REFERENCES connections(id) ON DELETE CASCADE,
    account_id VARCHAR(100) NOT NULL,  -- Plaid account identifier
    account_type account_type NOT NULL,
    mask VARCHAR(10),  -- Last 4 digits of account number
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- Ensure unique Plaid account per connection
    CONSTRAINT financial_accounts_connection_account_unique UNIQUE (connection_id, account_id)
);

-- Index for fetching accounts by connection
CREATE INDEX idx_financial_accounts_connection_id ON financial_accounts(connection_id);

COMMENT ON TABLE financial_accounts IS 'Financial accounts linked via Plaid connections';
COMMENT ON COLUMN financial_accounts.account_id IS 'Plaid account identifier';
COMMENT ON COLUMN financial_accounts.mask IS 'Last 4 digits of account number for display';
