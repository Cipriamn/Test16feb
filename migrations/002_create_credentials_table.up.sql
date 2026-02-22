-- Migration: 002_create_credentials_table
-- Description: Create credentials table for authentication methods
-- Requirements: REQ-BE-001, REQ-BE-002, REQ-BE-004, REQ-NFR-006

CREATE TYPE auth_provider AS ENUM ('email', 'google', 'facebook');

CREATE TABLE credentials (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    provider auth_provider NOT NULL,
    -- password_hash stores bcrypt hash (minimum 12 rounds per REQ-NFR-006)
    -- bcrypt output is always 60 chars, stored as-is (already salted and secure)
    password_hash VARCHAR(72),
    oauth_provider_id VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_credentials_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE,

    -- Ensure either password_hash (for email) or oauth_provider_id (for OAuth) is set
    CONSTRAINT credentials_auth_check CHECK (
        (provider = 'email' AND password_hash IS NOT NULL AND oauth_provider_id IS NULL) OR
        (provider IN ('google', 'facebook') AND oauth_provider_id IS NOT NULL AND password_hash IS NULL)
    ),

    -- One credential per provider per user
    CONSTRAINT credentials_user_provider_unique UNIQUE (user_id, provider)
);

-- Index for fast lookup by user_id (finding all auth methods for a user)
CREATE INDEX idx_credentials_user_id ON credentials(user_id);

-- Index for OAuth lookups
CREATE INDEX idx_credentials_oauth_lookup ON credentials(provider, oauth_provider_id)
    WHERE oauth_provider_id IS NOT NULL;

COMMENT ON TABLE credentials IS 'User authentication credentials (email/password or OAuth)';
COMMENT ON COLUMN credentials.password_hash IS 'bcrypt hash with 12+ rounds - DO NOT store plaintext';
COMMENT ON COLUMN credentials.oauth_provider_id IS 'External provider user ID for OAuth flows';
