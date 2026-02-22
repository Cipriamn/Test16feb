-- Rollback: 004_create_two_factor_auth_table
-- Description: Drop two_factor_auth table and related objects

DROP INDEX IF EXISTS idx_two_factor_auth_enabled;
DROP INDEX IF EXISTS idx_two_factor_auth_user_id;
DROP TABLE IF EXISTS two_factor_auth;
DROP TYPE IF EXISTS twofa_method;
