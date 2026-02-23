-- Seed: 005_seed_cancellation_data
-- Description: Seed data for cancellation_requests and disputes tables
-- Creates test data covering all statuses for DB-005 testing

-- This seed uses DO block to dynamically reference existing subscriptions and transactions

DO $$
DECLARE
    -- User IDs from seed 001
    user1_id UUID := 'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d';  -- John Doe
    user2_id UUID := 'b2c3d4e5-f6a7-5b6c-9d0e-1f2a3b4c5d6e';  -- Jane Smith
    user3_id UUID := 'c3d4e5f6-a7b8-6c7d-0e1f-2a3b4c5d6e7f';  -- Mike Johnson
    user4_id UUID := 'd4e5f6a7-b8c9-7d8e-1f2a-3b4c5d6e7f8a';  -- Emma Wilson

    -- Subscription IDs (will be fetched dynamically)
    sub1 UUID;
    sub2 UUID;
    sub3 UUID;
    sub4 UUID;
    sub5 UUID;
    sub6 UUID;
    sub7 UUID;
    sub8 UUID;
    sub9 UUID;
    sub10 UUID;
    sub11 UUID;
    sub12 UUID;

    -- Transaction IDs (will be fetched dynamically)
    txn1 UUID;
    txn2 UUID;
    txn3 UUID;
    txn4 UUID;
    txn5 UUID;
    txn6 UUID;
    txn7 UUID;
    txn8 UUID;
    txn1_date DATE;
    txn2_date DATE;
    txn3_date DATE;
    txn4_date DATE;
    txn5_date DATE;
    txn6_date DATE;
    txn7_date DATE;
    txn8_date DATE;
BEGIN
    -- Fetch subscription IDs for the test user
    SELECT id INTO sub1 FROM subscriptions WHERE user_id = user1_id LIMIT 1 OFFSET 0;
    SELECT id INTO sub2 FROM subscriptions WHERE user_id = user1_id LIMIT 1 OFFSET 1;
    SELECT id INTO sub3 FROM subscriptions WHERE user_id = user1_id LIMIT 1 OFFSET 2;
    SELECT id INTO sub4 FROM subscriptions WHERE user_id = user1_id LIMIT 1 OFFSET 3;
    SELECT id INTO sub5 FROM subscriptions WHERE user_id = user1_id LIMIT 1 OFFSET 4;
    SELECT id INTO sub6 FROM subscriptions WHERE user_id = user1_id LIMIT 1 OFFSET 5;
    SELECT id INTO sub7 FROM subscriptions WHERE user_id = user1_id LIMIT 1 OFFSET 6;
    SELECT id INTO sub8 FROM subscriptions WHERE user_id = user1_id LIMIT 1 OFFSET 7;
    SELECT id INTO sub9 FROM subscriptions WHERE user_id = user1_id LIMIT 1 OFFSET 8;
    SELECT id INTO sub10 FROM subscriptions WHERE user_id = user1_id LIMIT 1 OFFSET 9;
    SELECT id INTO sub11 FROM subscriptions WHERE user_id = user1_id LIMIT 1 OFFSET 10;
    SELECT id INTO sub12 FROM subscriptions WHERE user_id = user1_id LIMIT 1 OFFSET 11;

    -- Fetch transaction IDs (need both id and date for partitioned table FK)
    SELECT id, date INTO txn1, txn1_date FROM transactions LIMIT 1 OFFSET 0;
    SELECT id, date INTO txn2, txn2_date FROM transactions LIMIT 1 OFFSET 1;
    SELECT id, date INTO txn3, txn3_date FROM transactions LIMIT 1 OFFSET 2;
    SELECT id, date INTO txn4, txn4_date FROM transactions LIMIT 1 OFFSET 3;
    SELECT id, date INTO txn5, txn5_date FROM transactions LIMIT 1 OFFSET 4;
    SELECT id, date INTO txn6, txn6_date FROM transactions LIMIT 1 OFFSET 5;
    SELECT id, date INTO txn7, txn7_date FROM transactions LIMIT 1 OFFSET 6;
    SELECT id, date INTO txn8, txn8_date FROM transactions LIMIT 1 OFFSET 7;

    -- Check if we have necessary data
    IF sub1 IS NULL OR txn1 IS NULL THEN
        RAISE NOTICE 'No subscriptions or transactions found - skipping cancellation seed data';
        RETURN;
    END IF;

    -- Insert cancellation requests with all 4 statuses
    -- Pending cancellations
    INSERT INTO cancellation_requests (id, user_id, subscription_id, status, requested_at, completed_at, confirmation_number, notes)
    VALUES
        ('ca000001-0001-0001-0001-000000000001', user1_id, sub1, 'pending', CURRENT_TIMESTAMP - INTERVAL '1 hour', NULL, NULL, 'User requested cancellation via dashboard'),
        ('ca000001-0001-0001-0001-000000000002', user1_id, sub2, 'pending', CURRENT_TIMESTAMP - INTERVAL '30 minutes', NULL, NULL, NULL),
        ('ca000001-0001-0001-0001-000000000003', user1_id, sub3, 'pending', CURRENT_TIMESTAMP - INTERVAL '2 hours', NULL, NULL, 'Auto-generated from subscription detection');

    -- In-progress cancellations
    INSERT INTO cancellation_requests (id, user_id, subscription_id, status, requested_at, completed_at, confirmation_number, notes)
    VALUES
        ('ca000001-0001-0001-0001-000000000004', user1_id, sub4, 'in_progress', CURRENT_TIMESTAMP - INTERVAL '1 day', NULL, NULL, 'Contacted vendor support'),
        ('ca000001-0001-0001-0001-000000000005', user1_id, sub5, 'in_progress', CURRENT_TIMESTAMP - INTERVAL '3 days', NULL, NULL, 'Waiting for vendor response'),
        ('ca000001-0001-0001-0001-000000000006', user1_id, sub6, 'in_progress', CURRENT_TIMESTAMP - INTERVAL '12 hours', NULL, NULL, NULL);

    -- Completed cancellations
    INSERT INTO cancellation_requests (id, user_id, subscription_id, status, requested_at, completed_at, confirmation_number, notes)
    VALUES
        ('ca000001-0001-0001-0001-000000000007', user1_id, sub7, 'completed', CURRENT_TIMESTAMP - INTERVAL '7 days', CURRENT_TIMESTAMP - INTERVAL '5 days', 'CNF-2024-00001', 'Successfully cancelled with full refund'),
        ('ca000001-0001-0001-0001-000000000008', user1_id, sub8, 'completed', CURRENT_TIMESTAMP - INTERVAL '14 days', CURRENT_TIMESTAMP - INTERVAL '10 days', 'REF-ABC-123', 'Cancelled at end of billing period'),
        ('ca000001-0001-0001-0001-000000000009', user1_id, sub9, 'completed', CURRENT_TIMESTAMP - INTERVAL '30 days', CURRENT_TIMESTAMP - INTERVAL '28 days', 'CANCEL-789XYZ', NULL);

    -- Failed cancellations
    INSERT INTO cancellation_requests (id, user_id, subscription_id, status, requested_at, completed_at, confirmation_number, notes)
    VALUES
        ('ca000001-0001-0001-0001-000000000010', user1_id, sub10, 'failed', CURRENT_TIMESTAMP - INTERVAL '5 days', CURRENT_TIMESTAMP - INTERVAL '4 days', NULL, 'Vendor requires phone call to cancel'),
        ('ca000001-0001-0001-0001-000000000011', user1_id, sub11, 'failed', CURRENT_TIMESTAMP - INTERVAL '10 days', CURRENT_TIMESTAMP - INTERVAL '8 days', NULL, 'Annual contract - early termination fee required'),
        ('ca000001-0001-0001-0001-000000000012', user1_id, sub12, 'failed', CURRENT_TIMESTAMP - INTERVAL '2 days', CURRENT_TIMESTAMP - INTERVAL '1 day', NULL, 'Account access issue - credentials expired');

    -- Insert disputes with all 4 statuses (linked to completed/failed cancellation requests)
    -- Submitted disputes
    INSERT INTO disputes (id, cancellation_request_id, transaction_id, transaction_date, status, created_at, resolved_at)
    VALUES
        ('di000001-0001-0001-0001-000000000001', 'ca000001-0001-0001-0001-000000000007', txn1, txn1_date, 'submitted', CURRENT_TIMESTAMP - INTERVAL '2 days', NULL),
        ('di000001-0001-0001-0001-000000000002', 'ca000001-0001-0001-0001-000000000008', txn2, txn2_date, 'submitted', CURRENT_TIMESTAMP - INTERVAL '1 day', NULL);

    -- Investigating disputes
    INSERT INTO disputes (id, cancellation_request_id, transaction_id, transaction_date, status, created_at, resolved_at)
    VALUES
        ('di000001-0001-0001-0001-000000000003', 'ca000001-0001-0001-0001-000000000007', txn3, txn3_date, 'investigating', CURRENT_TIMESTAMP - INTERVAL '5 days', NULL),
        ('di000001-0001-0001-0001-000000000004', 'ca000001-0001-0001-0001-000000000009', txn4, txn4_date, 'investigating', CURRENT_TIMESTAMP - INTERVAL '10 days', NULL);

    -- Resolved disputes
    INSERT INTO disputes (id, cancellation_request_id, transaction_id, transaction_date, status, created_at, resolved_at)
    VALUES
        ('di000001-0001-0001-0001-000000000005', 'ca000001-0001-0001-0001-000000000007', txn5, txn5_date, 'resolved', CURRENT_TIMESTAMP - INTERVAL '20 days', CURRENT_TIMESTAMP - INTERVAL '15 days'),
        ('di000001-0001-0001-0001-000000000006', 'ca000001-0001-0001-0001-000000000008', txn6, txn6_date, 'resolved', CURRENT_TIMESTAMP - INTERVAL '30 days', CURRENT_TIMESTAMP - INTERVAL '25 days');

    -- Rejected disputes
    INSERT INTO disputes (id, cancellation_request_id, transaction_id, transaction_date, status, created_at, resolved_at)
    VALUES
        ('di000001-0001-0001-0001-000000000007', 'ca000001-0001-0001-0001-000000000009', txn7, txn7_date, 'rejected', CURRENT_TIMESTAMP - INTERVAL '25 days', CURRENT_TIMESTAMP - INTERVAL '20 days'),
        ('di000001-0001-0001-0001-000000000008', 'ca000001-0001-0001-0001-000000000010', txn8, txn8_date, 'rejected', CURRENT_TIMESTAMP - INTERVAL '3 days', CURRENT_TIMESTAMP - INTERVAL '1 day');

    RAISE NOTICE 'Seeded 12 cancellation_requests and 8 disputes for DB-005 testing';
END $$;
