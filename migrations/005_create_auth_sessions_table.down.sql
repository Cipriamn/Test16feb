-- Rollback: 005_create_auth_sessions_table
-- Description: Drop auth_sessions table and related objects

DROP INDEX IF EXISTS idx_auth_sessions_expires_at;
DROP INDEX IF EXISTS idx_auth_sessions_token_hash;
DROP INDEX IF EXISTS idx_auth_sessions_user_expires;
DROP TABLE IF EXISTS auth_sessions;
