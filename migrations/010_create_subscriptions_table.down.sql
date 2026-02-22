-- Rollback: 010_create_subscriptions_table
-- Description: Remove subscriptions table and related types

DROP TRIGGER IF EXISTS update_subscriptions_updated_at ON subscriptions;
DROP TABLE IF EXISTS subscriptions CASCADE;
DROP TYPE IF EXISTS subscription_status;
DROP TYPE IF EXISTS subscription_frequency;
