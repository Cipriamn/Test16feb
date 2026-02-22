-- Rollback: 012_seed_subscriptions_data
-- Description: Remove seeded subscription test data

-- Delete test users (cascades to subscriptions, custom categories)
DELETE FROM users WHERE email IN ('test-subscriptions@example.com', 'test-subscriptions-2@example.com');

-- Note: Default categories are NOT deleted here; they are managed by migration 009
