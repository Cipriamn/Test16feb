-- Migration: 012_seed_subscriptions_data
-- Description: Seed test data for subscriptions testing
-- Note: This depends on existing test users, connections, and accounts from prior seeds

-- Get category IDs for reference
DO $$
DECLARE
    cat_entertainment UUID;
    cat_utilities UUID;
    cat_software UUID;
    cat_health UUID;
    cat_other UUID;
    test_user_id UUID;
    test_connection_id UUID;
    test_account_id UUID;
BEGIN
    -- Fetch default category IDs
    SELECT id INTO cat_entertainment FROM categories WHERE name = 'Entertainment' AND is_default = TRUE LIMIT 1;
    SELECT id INTO cat_utilities FROM categories WHERE name = 'Utilities' AND is_default = TRUE LIMIT 1;
    SELECT id INTO cat_software FROM categories WHERE name = 'Software' AND is_default = TRUE LIMIT 1;
    SELECT id INTO cat_health FROM categories WHERE name = 'Health' AND is_default = TRUE LIMIT 1;
    SELECT id INTO cat_other FROM categories WHERE name = 'Other' AND is_default = TRUE LIMIT 1;

    -- Get test user (assuming at least one exists from prior migrations)
    SELECT id INTO test_user_id FROM users LIMIT 1;
    SELECT id INTO test_connection_id FROM connections WHERE user_id = test_user_id LIMIT 1;
    SELECT id INTO test_account_id FROM financial_accounts WHERE connection_id = test_connection_id LIMIT 1;

    -- If no test data exists, create minimal test user/connection/account
    IF test_user_id IS NULL THEN
        INSERT INTO users (email, name) VALUES ('test-subscriptions@example.com', 'Subscription Test User')
        RETURNING id INTO test_user_id;
    END IF;

    IF test_connection_id IS NULL THEN
        INSERT INTO connections (user_id, institution_id, institution_name, access_token, status)
        VALUES (test_user_id, 'ins_test_001', 'Test Bank', pgp_sym_encrypt('test_access_token', 'test_key'), 'active')
        RETURNING id INTO test_connection_id;
    END IF;

    IF test_account_id IS NULL THEN
        INSERT INTO financial_accounts (connection_id, account_id, account_type, name, mask)
        VALUES (test_connection_id, 'test_account_001', 'checking', 'Test Checking', '1234')
        RETURNING id INTO test_account_id;
    END IF;

    -- Insert test subscriptions (25 total across various statuses and currencies)

    -- Active subscriptions (15)
    INSERT INTO subscriptions (user_id, connection_id, account_id, name, merchant_name, amount, currency, frequency, next_billing_date, status, category_id, is_manual)
    VALUES
        -- Entertainment subscriptions
        (test_user_id, test_connection_id, test_account_id, 'Netflix Premium', 'Netflix Inc', 22.99, 'USD', 'monthly', CURRENT_DATE + INTERVAL '5 days', 'active', cat_entertainment, FALSE),
        (test_user_id, test_connection_id, test_account_id, 'Spotify Family', 'Spotify AB', 16.99, 'USD', 'monthly', CURRENT_DATE + INTERVAL '12 days', 'active', cat_entertainment, FALSE),
        (test_user_id, test_connection_id, test_account_id, 'Disney+', 'Disney Streaming', 13.99, 'USD', 'monthly', CURRENT_DATE + INTERVAL '3 days', 'active', cat_entertainment, FALSE),
        (test_user_id, test_connection_id, test_account_id, 'YouTube Premium', 'Google LLC', 13.99, 'USD', 'monthly', CURRENT_DATE + INTERVAL '20 days', 'active', cat_entertainment, FALSE),

        -- Software subscriptions
        (test_user_id, test_connection_id, test_account_id, 'GitHub Pro', 'GitHub Inc', 4.00, 'USD', 'monthly', CURRENT_DATE + INTERVAL '7 days', 'active', cat_software, FALSE),
        (test_user_id, test_connection_id, test_account_id, 'Adobe Creative Cloud', 'Adobe Inc', 54.99, 'USD', 'monthly', CURRENT_DATE + INTERVAL '15 days', 'active', cat_software, FALSE),
        (test_user_id, test_connection_id, test_account_id, 'Microsoft 365', 'Microsoft', 9.99, 'USD', 'monthly', CURRENT_DATE + INTERVAL '2 days', 'active', cat_software, FALSE),
        (test_user_id, test_connection_id, test_account_id, 'JetBrains All Products', 'JetBrains', 249.00, 'USD', 'annual', CURRENT_DATE + INTERVAL '45 days', 'active', cat_software, FALSE),

        -- Utilities subscriptions
        (test_user_id, NULL, NULL, 'Electric Bill', 'City Power Co', 120.00, 'USD', 'monthly', CURRENT_DATE + INTERVAL '10 days', 'active', cat_utilities, TRUE),
        (test_user_id, NULL, NULL, 'Internet Service', 'Comcast', 79.99, 'USD', 'monthly', CURRENT_DATE + INTERVAL '8 days', 'active', cat_utilities, TRUE),
        (test_user_id, NULL, NULL, 'Phone Plan', 'Verizon', 85.00, 'USD', 'monthly', CURRENT_DATE + INTERVAL '1 day', 'active', cat_utilities, TRUE),

        -- Health subscriptions
        (test_user_id, test_connection_id, test_account_id, 'Gym Membership', 'Planet Fitness', 24.99, 'USD', 'monthly', CURRENT_DATE + INTERVAL '6 days', 'active', cat_health, FALSE),
        (test_user_id, NULL, NULL, 'Meditation App', 'Headspace', 69.99, 'USD', 'annual', CURRENT_DATE + INTERVAL '90 days', 'active', cat_health, TRUE),

        -- Foreign currency subscriptions
        (test_user_id, test_connection_id, test_account_id, 'UK News Subscription', 'The Guardian', 11.99, 'GBP', 'monthly', CURRENT_DATE + INTERVAL '14 days', 'active', cat_other, FALSE),
        (test_user_id, test_connection_id, test_account_id, 'EU Cloud Storage', 'Hetzner', 4.15, 'EUR', 'monthly', CURRENT_DATE + INTERVAL '9 days', 'active', cat_software, FALSE);

    -- Inactive subscriptions (5)
    INSERT INTO subscriptions (user_id, connection_id, account_id, name, merchant_name, amount, currency, frequency, next_billing_date, status, category_id, is_manual)
    VALUES
        (test_user_id, test_connection_id, test_account_id, 'HBO Max', 'Warner Bros', 15.99, 'USD', 'monthly', NULL, 'inactive', cat_entertainment, FALSE),
        (test_user_id, test_connection_id, test_account_id, 'Hulu', 'Hulu LLC', 17.99, 'USD', 'monthly', NULL, 'inactive', cat_entertainment, FALSE),
        (test_user_id, NULL, NULL, 'Old Magazine', 'Magazine Corp', 5.99, 'USD', 'monthly', NULL, 'inactive', cat_other, TRUE),
        (test_user_id, test_connection_id, test_account_id, 'Dropbox Plus', 'Dropbox Inc', 11.99, 'USD', 'monthly', NULL, 'inactive', cat_software, FALSE),
        (test_user_id, test_connection_id, test_account_id, 'Apple Music', 'Apple Inc', 10.99, 'USD', 'monthly', NULL, 'inactive', cat_entertainment, FALSE);

    -- Cancelled subscriptions (5)
    INSERT INTO subscriptions (user_id, connection_id, account_id, name, merchant_name, amount, currency, frequency, next_billing_date, status, category_id, is_manual)
    VALUES
        (test_user_id, test_connection_id, test_account_id, 'Amazon Prime', 'Amazon', 139.00, 'USD', 'annual', NULL, 'cancelled', cat_other, FALSE),
        (test_user_id, test_connection_id, test_account_id, 'Peacock', 'NBCUniversal', 11.99, 'USD', 'monthly', NULL, 'cancelled', cat_entertainment, FALSE),
        (test_user_id, NULL, NULL, 'Newspaper', 'NYT', 17.00, 'USD', 'monthly', NULL, 'cancelled', cat_other, TRUE),
        (test_user_id, test_connection_id, test_account_id, 'Audible', 'Amazon', 14.95, 'USD', 'monthly', NULL, 'cancelled', cat_entertainment, FALSE),
        (test_user_id, test_connection_id, test_account_id, 'Kindle Unlimited', 'Amazon', 11.99, 'USD', 'monthly', NULL, 'cancelled', cat_entertainment, FALSE);

    RAISE NOTICE 'Seeded 25 test subscriptions for user %', test_user_id;
END $$;

-- Create a second test user with custom categories and subscriptions
DO $$
DECLARE
    second_user_id UUID;
    custom_cat_gaming UUID;
    custom_cat_education UUID;
    cat_software UUID;
BEGIN
    -- Create second test user
    INSERT INTO users (email, name) VALUES ('test-subscriptions-2@example.com', 'Second Test User')
    RETURNING id INTO second_user_id;

    -- Create custom categories for this user
    INSERT INTO categories (name, user_id, is_default) VALUES ('Gaming', second_user_id, FALSE)
    RETURNING id INTO custom_cat_gaming;

    INSERT INTO categories (name, user_id, is_default) VALUES ('Education', second_user_id, FALSE)
    RETURNING id INTO custom_cat_education;

    SELECT id INTO cat_software FROM categories WHERE name = 'Software' AND is_default = TRUE LIMIT 1;

    -- Add subscriptions with custom categories (manual only, no connection)
    INSERT INTO subscriptions (user_id, name, merchant_name, amount, currency, frequency, next_billing_date, status, category_id, is_manual)
    VALUES
        (second_user_id, 'Xbox Game Pass', 'Microsoft', 14.99, 'USD', 'monthly', CURRENT_DATE + INTERVAL '4 days', 'active', custom_cat_gaming, TRUE),
        (second_user_id, 'PlayStation Plus', 'Sony', 17.99, 'USD', 'monthly', CURRENT_DATE + INTERVAL '11 days', 'active', custom_cat_gaming, TRUE),
        (second_user_id, 'Nintendo Online', 'Nintendo', 3.99, 'USD', 'monthly', CURRENT_DATE + INTERVAL '18 days', 'active', custom_cat_gaming, TRUE),
        (second_user_id, 'Coursera Plus', 'Coursera', 59.00, 'USD', 'monthly', CURRENT_DATE + INTERVAL '25 days', 'active', custom_cat_education, TRUE),
        (second_user_id, 'Udemy Subscription', 'Udemy', 29.99, 'USD', 'monthly', CURRENT_DATE + INTERVAL '16 days', 'active', custom_cat_education, TRUE),
        (second_user_id, 'Figma Professional', 'Figma Inc', 15.00, 'USD', 'monthly', CURRENT_DATE + INTERVAL '5 days', 'active', cat_software, TRUE);

    RAISE NOTICE 'Seeded 6 test subscriptions with custom categories for user %', second_user_id;
END $$;
