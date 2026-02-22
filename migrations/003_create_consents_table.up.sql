-- Migration: 003_create_consents_table
-- Description: Create consents table for terms and privacy policy acceptance
-- Requirements: REQ-BE-007

CREATE TABLE consents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    terms_version VARCHAR(20) NOT NULL,
    accepted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_consents_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE,

    -- Track each version acceptance separately
    CONSTRAINT consents_user_version_unique UNIQUE (user_id, terms_version)
);

-- Index for checking user's consent history
CREATE INDEX idx_consents_user_id ON consents(user_id);

-- Index for finding users who accepted a specific version
CREATE INDEX idx_consents_version ON consents(terms_version);

COMMENT ON TABLE consents IS 'Record of user consent to Terms of Service and Privacy Policy';
COMMENT ON COLUMN consents.terms_version IS 'Version string of terms accepted (e.g., "1.0", "2024-01")';
COMMENT ON COLUMN consents.accepted_at IS 'Timestamp when user accepted terms - immutable for audit';
