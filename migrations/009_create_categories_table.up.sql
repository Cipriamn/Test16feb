-- Migration: 009_create_categories_table
-- Description: Create categories table for subscription categorization
-- Requirements: REQ-DB-003, REQ-DB-004

CREATE TABLE categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,  -- NULL for default categories
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- Ensure unique category names per user (or globally for defaults)
    CONSTRAINT categories_unique_name_per_user UNIQUE NULLS NOT DISTINCT (user_id, name)
);

-- Index for fetching user's categories (including defaults)
CREATE INDEX idx_categories_user_id ON categories(user_id);

-- Index for filtering default categories
CREATE INDEX idx_categories_is_default ON categories(is_default) WHERE is_default = TRUE;

COMMENT ON TABLE categories IS 'Subscription categories - both system defaults and user-created';
COMMENT ON COLUMN categories.user_id IS 'NULL for default system categories, FK to users for custom categories';
COMMENT ON COLUMN categories.is_default IS 'TRUE for system-provided default categories';

-- Seed default categories
INSERT INTO categories (name, user_id, is_default) VALUES
    ('Entertainment', NULL, TRUE),
    ('Utilities', NULL, TRUE),
    ('Software', NULL, TRUE),
    ('Health', NULL, TRUE),
    ('Other', NULL, TRUE);
