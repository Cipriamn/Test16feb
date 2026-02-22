-- Migration: 011_create_subscription_history_table
-- Description: Create subscription_history table linking subscriptions to transactions
-- Requirements: REQ-DB-004, REQ-BE-019

CREATE TABLE subscription_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
    transaction_id UUID,  -- FK handled separately due to partitioned table
    amount DECIMAL(15, 4) NOT NULL,
    charged_at TIMESTAMP WITH TIME ZONE NOT NULL,

    -- For referential integrity with partitioned transactions table,
    -- we use the date to match the partition key
    transaction_date DATE,

    CONSTRAINT subscription_history_amount_positive CHECK (amount > 0)
);

-- Index for fetching history by subscription (most common query)
CREATE INDEX idx_subscription_history_subscription_id ON subscription_history(subscription_id);

-- Index for time-based queries
CREATE INDEX idx_subscription_history_charged_at ON subscription_history(charged_at DESC);

-- Index for transaction lookup
CREATE INDEX idx_subscription_history_transaction_id ON subscription_history(transaction_id)
    WHERE transaction_id IS NOT NULL;

-- Comments
COMMENT ON TABLE subscription_history IS 'Historical record of subscription charges linked to transactions';
COMMENT ON COLUMN subscription_history.transaction_id IS 'Reference to transactions table (partitioned)';
COMMENT ON COLUMN subscription_history.transaction_date IS 'Transaction date for partition-aware joins';
COMMENT ON COLUMN subscription_history.amount IS 'Actual charged amount (may differ from subscription amount)';
COMMENT ON COLUMN subscription_history.charged_at IS 'Timestamp when charge occurred';
