-- Rollback: 003_create_consents_table
-- Description: Drop consents table and related objects

DROP INDEX IF EXISTS idx_consents_version;
DROP INDEX IF EXISTS idx_consents_user_id;
DROP TABLE IF EXISTS consents;
