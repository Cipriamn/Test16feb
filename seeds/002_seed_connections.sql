-- Seed Data: Financial Connections for DB-002
-- Description: Test connections and financial accounts with multiple connections per user
-- Note: access_token encrypted with pgp_sym_encrypt for testing (use proper key management in production)

-- Test encryption key (DO NOT USE IN PRODUCTION)
-- Application should use AWS KMS, HashiCorp Vault, or similar

-- ============================================================================
-- CONNECTIONS (multiple connections per user)
-- ============================================================================

INSERT INTO connections (id, user_id, institution_id, institution_name, access_token, status, last_sync_at, created_at, updated_at)
VALUES
    -- User 1 (John Doe): 3 connections - Chase, Bank of America, Wells Fargo
    ('c0001111-1111-1111-1111-111111111111', 'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d',
     'ins_3', 'Chase',
     pgp_sym_encrypt('access-sandbox-1111-chase-token-for-john-doe', 'db_encryption_key_v1'),
     'active', '2025-02-22 10:00:00+00',
     '2025-01-20 09:00:00+00', '2025-02-22 10:00:00+00'),

    ('c0001111-2222-2222-2222-222222222222', 'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d',
     'ins_4', 'Bank of America',
     pgp_sym_encrypt('access-sandbox-2222-bofa-token-for-john-doe', 'db_encryption_key_v1'),
     'active', '2025-02-22 09:30:00+00',
     '2025-01-25 14:00:00+00', '2025-02-22 09:30:00+00'),

    ('c0001111-3333-3333-3333-333333333333', 'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d',
     'ins_5', 'Wells Fargo',
     pgp_sym_encrypt('access-sandbox-3333-wf-token-for-john-doe', 'db_encryption_key_v1'),
     'failed', '2025-02-20 08:00:00+00',
     '2025-02-01 10:00:00+00', '2025-02-21 08:00:00+00'),

    -- User 2 (Jane Smith): 2 connections - Capital One, Discover
    ('c0002222-1111-1111-1111-111111111111', 'b2c3d4e5-f6a7-5b6c-9d0e-1f2a3b4c5d6e',
     'ins_128026', 'Capital One',
     pgp_sym_encrypt('access-sandbox-4444-cap1-token-for-jane-smith', 'db_encryption_key_v1'),
     'active', '2025-02-22 11:00:00+00',
     '2025-02-05 16:00:00+00', '2025-02-22 11:00:00+00'),

    ('c0002222-2222-2222-2222-222222222222', 'b2c3d4e5-f6a7-5b6c-9d0e-1f2a3b4c5d6e',
     'ins_2', 'Discover',
     pgp_sym_encrypt('access-sandbox-5555-discover-token-for-jane', 'db_encryption_key_v1'),
     'active', '2025-02-22 10:45:00+00',
     '2025-02-10 11:00:00+00', '2025-02-22 10:45:00+00'),

    -- User 4 (Emma Wilson): 2 connections - Barclays, HSBC (UK banks)
    ('c0004444-1111-1111-1111-111111111111', 'd4e5f6a7-b8c9-7d8e-1f2a-3b4c5d6e7f8a',
     'ins_uk_barclays', 'Barclays',
     pgp_sym_encrypt('access-sandbox-uk-6666-barclays-token-for-emma', 'db_encryption_key_v1'),
     'active', '2025-02-22 14:00:00+00',
     '2025-01-05 10:00:00+00', '2025-02-22 14:00:00+00'),

    ('c0004444-2222-2222-2222-222222222222', 'd4e5f6a7-b8c9-7d8e-1f2a-3b4c5d6e7f8a',
     'ins_uk_hsbc', 'HSBC UK',
     pgp_sym_encrypt('access-sandbox-uk-7777-hsbc-token-for-emma', 'db_encryption_key_v1'),
     'disconnected', NULL,
     '2025-01-10 12:00:00+00', '2025-02-15 16:00:00+00'),

    -- User 6 (Cascade Test): 2 connections for cascade delete testing
    ('c0006666-1111-1111-1111-111111111111', 'f6a7b8c9-d0e1-9f0a-3b4c-5d6e7f8a9b0c',
     'ins_test1', 'Test Bank 1',
     pgp_sym_encrypt('access-test-cascade-token-1', 'db_encryption_key_v1'),
     'active', '2025-02-22 00:00:00+00',
     '2025-02-01 00:00:00+00', '2025-02-22 00:00:00+00'),

    ('c0006666-2222-2222-2222-222222222222', 'f6a7b8c9-d0e1-9f0a-3b4c-5d6e7f8a9b0c',
     'ins_test2', 'Test Bank 2',
     pgp_sym_encrypt('access-test-cascade-token-2', 'db_encryption_key_v1'),
     'active', '2025-02-22 00:00:00+00',
     '2025-02-01 00:00:00+00', '2025-02-22 00:00:00+00');

-- ============================================================================
-- FINANCIAL_ACCOUNTS (linked to connections)
-- ============================================================================

INSERT INTO financial_accounts (id, connection_id, account_id, account_type, mask, name, created_at)
VALUES
    -- John Doe's Chase accounts (2 accounts)
    ('fa001111-1111-1111-1111-111111111111', 'c0001111-1111-1111-1111-111111111111',
     'plaid_acct_chase_checking_001', 'checking', '4521', 'Chase Total Checking',
     '2025-01-20 09:00:00+00'),
    ('fa001111-1111-2222-2222-222222222222', 'c0001111-1111-1111-1111-111111111111',
     'plaid_acct_chase_savings_001', 'savings', '7832', 'Chase Savings',
     '2025-01-20 09:00:00+00'),

    -- John Doe's Bank of America accounts (3 accounts)
    ('fa001111-2222-1111-1111-111111111111', 'c0001111-2222-2222-2222-222222222222',
     'plaid_acct_bofa_checking_001', 'checking', '9012', 'BofA Advantage Checking',
     '2025-01-25 14:00:00+00'),
    ('fa001111-2222-2222-2222-222222222222', 'c0001111-2222-2222-2222-222222222222',
     'plaid_acct_bofa_savings_001', 'savings', '3456', 'BofA Savings',
     '2025-01-25 14:00:00+00'),
    ('fa001111-2222-3333-3333-333333333333', 'c0001111-2222-2222-2222-222222222222',
     'plaid_acct_bofa_credit_001', 'credit', '1234', 'BofA Cash Rewards Credit Card',
     '2025-01-25 14:00:00+00'),

    -- John Doe's Wells Fargo account (1 account, but connection failed)
    ('fa001111-3333-1111-1111-111111111111', 'c0001111-3333-3333-3333-333333333333',
     'plaid_acct_wf_checking_001', 'checking', '5678', 'Wells Fargo Everyday Checking',
     '2025-02-01 10:00:00+00'),

    -- Jane Smith's Capital One accounts
    ('fa002222-1111-1111-1111-111111111111', 'c0002222-1111-1111-1111-111111111111',
     'plaid_acct_cap1_checking_001', 'checking', '8901', 'Capital One 360 Checking',
     '2025-02-05 16:00:00+00'),
    ('fa002222-1111-2222-2222-222222222222', 'c0002222-1111-1111-1111-111111111111',
     'plaid_acct_cap1_savings_001', 'savings', '2345', 'Capital One 360 Savings',
     '2025-02-05 16:00:00+00'),

    -- Jane Smith's Discover credit card
    ('fa002222-2222-1111-1111-111111111111', 'c0002222-2222-2222-2222-222222222222',
     'plaid_acct_discover_credit_001', 'credit', '6789', 'Discover it Cash Back',
     '2025-02-10 11:00:00+00'),

    -- Emma Wilson's Barclays accounts (UK)
    ('fa004444-1111-1111-1111-111111111111', 'c0004444-1111-1111-1111-111111111111',
     'plaid_acct_barclays_current_001', 'checking', '7890', 'Barclays Current Account',
     '2025-01-05 10:00:00+00'),
    ('fa004444-1111-2222-2222-222222222222', 'c0004444-1111-1111-1111-111111111111',
     'plaid_acct_barclays_savings_001', 'savings', '4567', 'Barclays Instant Saver',
     '2025-01-05 10:00:00+00'),

    -- Emma Wilson's HSBC account (disconnected)
    ('fa004444-2222-1111-1111-111111111111', 'c0004444-2222-2222-2222-222222222222',
     'plaid_acct_hsbc_current_001', 'checking', '1357', 'HSBC Advance Account',
     '2025-01-10 12:00:00+00'),

    -- Cascade Test User accounts
    ('fa006666-1111-1111-1111-111111111111', 'c0006666-1111-1111-1111-111111111111',
     'plaid_acct_test1_checking', 'checking', '0001', 'Test Account 1',
     '2025-02-01 00:00:00+00'),
    ('fa006666-1111-2222-2222-222222222222', 'c0006666-1111-1111-1111-111111111111',
     'plaid_acct_test1_savings', 'savings', '0002', 'Test Account 2',
     '2025-02-01 00:00:00+00'),
    ('fa006666-2222-1111-1111-111111111111', 'c0006666-2222-2222-2222-222222222222',
     'plaid_acct_test2_credit', 'credit', '0003', 'Test Credit Card',
     '2025-02-01 00:00:00+00');

-- ============================================================================
-- Verification queries
-- ============================================================================

-- Uncomment to verify counts after seeding:
-- SELECT 'connections' as table_name, COUNT(*) as count FROM connections
-- UNION ALL SELECT 'financial_accounts', COUNT(*) FROM financial_accounts;

-- Verify users with multiple connections:
-- SELECT u.email, COUNT(c.id) as connection_count
-- FROM users u
-- LEFT JOIN connections c ON u.id = c.user_id
-- GROUP BY u.id, u.email
-- HAVING COUNT(c.id) > 0
-- ORDER BY connection_count DESC;
