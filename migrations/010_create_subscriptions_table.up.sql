-- Migration: 010_create_subscriptions_table
-- Description: Create subscriptions table for tracking user subscriptions
-- Requirements: REQ-DB-003, REQ-BE-013, REQ-BE-015, REQ-BE-017, REQ-BE-018, REQ-BE-019

-- Frequency enum for billing cycles
CREATE TYPE subscription_frequency AS ENUM ('monthly', 'annual', 'custom');

-- Status enum for subscription lifecycle
CREATE TYPE subscription_status AS ENUM ('active', 'inactive', 'cancelled');

CREATE TABLE subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    connection_id UUID REFERENCES connections(id) ON DELETE SET NULL,  -- NULL for manual subscriptions
    account_id UUID REFERENCES financial_accounts(id) ON DELETE SET NULL,  -- NULL for manual subscriptions
    name VARCHAR(255) NOT NULL,
    merchant_name VARCHAR(255),
    amount DECIMAL(15, 4) NOT NULL,
    currency CHAR(3) NOT NULL DEFAULT 'USD',
    frequency subscription_frequency NOT NULL DEFAULT 'monthly',
    next_billing_date DATE,
    status subscription_status NOT NULL DEFAULT 'active',
    category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    is_manual BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- Currency validation (ISO 4217)
    CONSTRAINT subscriptions_currency_iso4217 CHECK (currency ~ '^[A-Z]{3}$'),
    -- Amount must be positive
    CONSTRAINT subscriptions_amount_positive CHECK (amount > 0)
);

-- Composite index for user + status queries (most common access pattern)
CREATE INDEX idx_subscriptions_user_status ON subscriptions(user_id, status);

-- Index for upcoming billing date queries (reminders, forecasting)
CREATE INDEX idx_subscriptions_next_billing_date ON subscriptions(next_billing_date)
    WHERE next_billing_date IS NOT NULL AND status = 'active';

-- Index for category-based filtering
CREATE INDEX idx_subscriptions_category_id ON subscriptions(category_id);

-- Index for connection-based queries (subscription detection)
CREATE INDEX idx_subscriptions_connection_id ON subscriptions(connection_id)
    WHERE connection_id IS NOT NULL;

-- Trigger to auto-update updated_at
CREATE TRIGGER update_subscriptions_updated_at
    BEFORE UPDATE ON subscriptions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Comments
COMMENT ON TABLE subscriptions IS 'User subscriptions - both auto-detected and manually created';
COMMENT ON COLUMN subscriptions.connection_id IS 'Plaid connection if auto-detected, NULL for manual subscriptions';
COMMENT ON COLUMN subscriptions.frequency IS 'Billing cycle: monthly, annual, or custom';
COMMENT ON COLUMN subscriptions.status IS 'Lifecycle state: active → inactive → cancelled';
COMMENT ON COLUMN subscriptions.is_manual IS 'TRUE if manually created by user, FALSE if auto-detected';
COMMENT ON COLUMN subscriptions.next_billing_date IS 'Predicted next billing date for reminders';
