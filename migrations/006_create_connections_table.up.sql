-- Migration: 006_create_connections_table
-- Description: Create connections table for Plaid financial connections
-- Requirements: REQ-DB-001, REQ-BE-008, REQ-BE-009

-- Status enum for connection state
CREATE TYPE connection_status AS ENUM ('active', 'failed', 'disconnected');

CREATE TABLE connections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    institution_id VARCHAR(100) NOT NULL,
    institution_name VARCHAR(255) NOT NULL,
    -- access_token stored encrypted using pgcrypto AES-256
    -- Application must encrypt before insert and decrypt after select
    -- Format: pgp_sym_encrypt(token, encryption_key, 'cipher-algo=aes256')
    access_token BYTEA NOT NULL,
    status connection_status NOT NULL DEFAULT 'active',
    last_sync_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Composite index for fetching user connections by status
CREATE INDEX idx_connections_user_id_status ON connections(user_id, status);

-- Index for finding connections by institution
CREATE INDEX idx_connections_institution_id ON connections(institution_id);

-- Trigger to auto-update updated_at
CREATE TRIGGER update_connections_updated_at
    BEFORE UPDATE ON connections
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE connections IS 'Plaid financial institution connections';
COMMENT ON COLUMN connections.access_token IS 'Plaid access token - MUST be encrypted with AES-256 before storage';
COMMENT ON COLUMN connections.status IS 'Connection status: active, failed, or disconnected';
COMMENT ON COLUMN connections.last_sync_at IS 'Last successful data sync from Plaid';
