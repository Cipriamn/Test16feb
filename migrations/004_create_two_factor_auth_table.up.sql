-- Migration: 004_create_two_factor_auth_table
-- Description: Create two_factor_auth table for 2FA configuration
-- Requirements: REQ-BE-003, REQ-NFR-004

CREATE TYPE twofa_method AS ENUM ('sms', 'totp');

CREATE TABLE two_factor_auth (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    method twofa_method NOT NULL,
    -- Secret encrypted using pgcrypto with AES-256 (REQ-NFR-004)
    -- Application must encrypt before insert and decrypt after select
    -- Stored as bytea to hold encrypted binary data
    secret BYTEA NOT NULL,
    -- Backup codes also encrypted with AES-256
    -- Stored as encrypted JSON array of codes
    backup_codes BYTEA NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_two_factor_auth_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE,

    -- One 2FA config per method per user
    CONSTRAINT two_factor_auth_user_method_unique UNIQUE (user_id, method)
);

-- Index for finding 2FA settings by user
CREATE INDEX idx_two_factor_auth_user_id ON two_factor_auth(user_id);

-- Index for finding enabled 2FA by user (authentication check)
CREATE INDEX idx_two_factor_auth_enabled ON two_factor_auth(user_id, enabled)
    WHERE enabled = true;

COMMENT ON TABLE two_factor_auth IS 'Two-factor authentication configuration per user';
COMMENT ON COLUMN two_factor_auth.secret IS 'AES-256 encrypted TOTP secret or SMS phone number';
COMMENT ON COLUMN two_factor_auth.backup_codes IS 'AES-256 encrypted JSON array of one-time backup codes';
COMMENT ON COLUMN two_factor_auth.enabled IS 'Whether 2FA is currently active for this method';
