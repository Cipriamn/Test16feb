-- Rollback: 002_create_credentials_table
-- Description: Drop credentials table and related objects

DROP INDEX IF EXISTS idx_credentials_oauth_lookup;
DROP INDEX IF EXISTS idx_credentials_user_id;
DROP TABLE IF EXISTS credentials;
DROP TYPE IF EXISTS auth_provider;
