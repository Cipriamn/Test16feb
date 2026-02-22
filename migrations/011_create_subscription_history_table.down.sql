-- Rollback: 011_create_subscription_history_table
-- Description: Remove subscription_history table

DROP TABLE IF EXISTS subscription_history CASCADE;
