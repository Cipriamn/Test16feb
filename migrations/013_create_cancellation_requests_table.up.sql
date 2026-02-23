-- Migration: 013_create_cancellation_requests_table
-- Description: Create cancellation_requests and disputes tables for tracking cancellation lifecycle
-- Requirements: REQ-DB-005, REQ-DB-006, REQ-BE-023, REQ-BE-025, REQ-BE-027

-- Status enum for cancellation request lifecycle
CREATE TYPE cancellation_request_status AS ENUM ('pending', 'in_progress', 'completed', 'failed');

-- Status enum for dispute lifecycle
CREATE TYPE dispute_status AS ENUM ('submitted', 'investigating', 'resolved', 'rejected');

-- Cancellation requests table
CREATE TABLE cancellation_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
    status cancellation_request_status NOT NULL DEFAULT 'pending',
    requested_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE,
    confirmation_number VARCHAR(100),
    notes TEXT,

    -- Completed_at should only be set when status is completed or failed
    CONSTRAINT cancellation_completed_at_check CHECK (
        (status IN ('completed', 'failed') AND completed_at IS NOT NULL) OR
        (status IN ('pending', 'in_progress') AND completed_at IS NULL)
    )
);

-- Composite index for user + status queries (fetch pending cancellations for user)
CREATE INDEX idx_cancellation_requests_user_status ON cancellation_requests(user_id, status);

-- Index for subscription-based queries
CREATE INDEX idx_cancellation_requests_subscription ON cancellation_requests(subscription_id);

-- Index for requested_at ordering
CREATE INDEX idx_cancellation_requests_requested_at ON cancellation_requests(requested_at DESC);

-- Disputes table
CREATE TABLE disputes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cancellation_request_id UUID NOT NULL REFERENCES cancellation_requests(id) ON DELETE CASCADE,
    transaction_id UUID NOT NULL,  -- FK to transactions (partitioned table - date needed)
    transaction_date DATE NOT NULL,  -- Required for FK to partitioned transactions
    status dispute_status NOT NULL DEFAULT 'submitted',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP WITH TIME ZONE,

    -- FK to partitioned transactions table
    CONSTRAINT fk_disputes_transaction FOREIGN KEY (transaction_id, transaction_date)
        REFERENCES transactions(id, date) ON DELETE RESTRICT,

    -- Resolved_at should only be set when status is resolved or rejected
    CONSTRAINT dispute_resolved_at_check CHECK (
        (status IN ('resolved', 'rejected') AND resolved_at IS NOT NULL) OR
        (status IN ('submitted', 'investigating') AND resolved_at IS NULL)
    )
);

-- Index for cancellation_request_id queries
CREATE INDEX idx_disputes_cancellation_request ON disputes(cancellation_request_id);

-- Index for transaction lookups
CREATE INDEX idx_disputes_transaction ON disputes(transaction_id, transaction_date);

-- Index for status-based filtering
CREATE INDEX idx_disputes_status ON disputes(status);

-- Comments
COMMENT ON TABLE cancellation_requests IS 'Tracks subscription cancellation requests and their lifecycle';
COMMENT ON COLUMN cancellation_requests.status IS 'Lifecycle: pending → in_progress → completed/failed';
COMMENT ON COLUMN cancellation_requests.confirmation_number IS 'Vendor-provided cancellation confirmation';
COMMENT ON COLUMN cancellation_requests.notes IS 'User or system notes about the cancellation process';

COMMENT ON TABLE disputes IS 'Tracks post-cancellation charge disputes';
COMMENT ON COLUMN disputes.status IS 'Lifecycle: submitted → investigating → resolved/rejected';
COMMENT ON COLUMN disputes.transaction_date IS 'Required for FK reference to partitioned transactions table';
