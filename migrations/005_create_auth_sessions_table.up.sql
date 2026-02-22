-- Migration: 005_create_auth_sessions_table
-- Description: Create auth_sessions table for session management
-- Requirements: REQ-BE-002, REQ-NFR-007, REQ-BE-047

CREATE TABLE auth_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    -- Store hash of token, not token itself (security best practice)
    token_hash VARCHAR(64) NOT NULL,
    device_info JSONB,
    ip_address INET,
    location VARCHAR(255),
    -- Tokens expire after 24 hours per REQ-NFR-007
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_auth_sessions_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE,

    -- Token hash must be unique
    CONSTRAINT auth_sessions_token_hash_unique UNIQUE (token_hash)
);

-- Composite index for finding active sessions by user (session management, logout all)
CREATE INDEX idx_auth_sessions_user_expires ON auth_sessions(user_id, expires_at);

-- Index for token validation during authentication
CREATE INDEX idx_auth_sessions_token_hash ON auth_sessions(token_hash);

-- Index for cleanup job to remove expired sessions
CREATE INDEX idx_auth_sessions_expires_at ON auth_sessions(expires_at)
    WHERE expires_at < CURRENT_TIMESTAMP;

COMMENT ON TABLE auth_sessions IS 'Active user authentication sessions for device management';
COMMENT ON COLUMN auth_sessions.token_hash IS 'SHA-256 hash of session token - never store raw token';
COMMENT ON COLUMN auth_sessions.device_info IS 'JSON with user agent, device type, OS, browser';
COMMENT ON COLUMN auth_sessions.expires_at IS 'Session expiration (24h for access, 30d for refresh)';
