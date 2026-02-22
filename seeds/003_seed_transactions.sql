-- Seed Data: Transactions for DB-003
-- Description: Test transactions across multiple accounts with varied currencies
-- Generates 1000+ transactions for performance testing

-- ============================================================================
-- TRANSACTIONS (1000+ across multiple accounts and currencies)
-- ============================================================================

-- Helper: Generate transactions for a specific account
-- Uses generate_series to create bulk data efficiently

-- John Doe's Chase Checking (USD) - 200 transactions over 6 months
INSERT INTO transactions (id, connection_id, account_id, transaction_id, amount, currency, date, merchant_name, description, category, pending, created_at)
SELECT
    uuid_generate_v4(),
    'c0001111-1111-1111-1111-111111111111'::UUID,
    'fa001111-1111-1111-1111-111111111111'::UUID,
    'plaid_txn_chase_' || LPAD(n::TEXT, 6, '0'),
    CASE
        WHEN n % 10 = 0 THEN -2500.00  -- Rent/mortgage
        WHEN n % 7 = 0 THEN ROUND((RANDOM() * 200 + 50)::NUMERIC, 2)  -- Deposits
        WHEN n % 5 = 0 THEN -ROUND((RANDOM() * 100 + 20)::NUMERIC, 2)  -- Groceries
        WHEN n % 3 = 0 THEN -ROUND((RANDOM() * 50 + 5)::NUMERIC, 2)   -- Small purchases
        ELSE -ROUND((RANDOM() * 150 + 10)::NUMERIC, 2)  -- General spending
    END,
    'USD',
    CURRENT_DATE - (n || ' days')::INTERVAL,
    CASE
        WHEN n % 10 = 0 THEN 'Property Management LLC'
        WHEN n % 7 = 0 THEN 'Direct Deposit - Employer'
        WHEN n % 5 = 0 THEN (ARRAY['Whole Foods', 'Trader Joes', 'Safeway', 'Kroger', 'Costco'])[1 + (n % 5)]
        WHEN n % 3 = 0 THEN (ARRAY['Starbucks', 'Amazon', 'Target', 'Uber', 'Netflix'])[1 + (n % 5)]
        ELSE (ARRAY['Shell Gas', 'Home Depot', 'Best Buy', 'Apple Store', 'CVS Pharmacy'])[1 + (n % 5)]
    END,
    'Transaction ' || n || ' - automated seed data',
    CASE
        WHEN n % 10 = 0 THEN 'Rent'
        WHEN n % 7 = 0 THEN 'Income'
        WHEN n % 5 = 0 THEN 'Groceries'
        WHEN n % 3 = 0 THEN 'Shopping'
        ELSE 'General'
    END,
    n < 3,  -- First 3 transactions are pending
    CURRENT_TIMESTAMP - (n || ' days')::INTERVAL
FROM generate_series(1, 200) AS n;

-- John Doe's Chase Savings (USD) - 50 transactions
INSERT INTO transactions (id, connection_id, account_id, transaction_id, amount, currency, date, merchant_name, description, category, pending, created_at)
SELECT
    uuid_generate_v4(),
    'c0001111-1111-1111-1111-111111111111'::UUID,
    'fa001111-1111-2222-2222-222222222222'::UUID,
    'plaid_txn_chase_sav_' || LPAD(n::TEXT, 6, '0'),
    CASE
        WHEN n % 4 = 0 THEN ROUND((RANDOM() * 500 + 100)::NUMERIC, 2)  -- Savings deposit
        ELSE -ROUND((RANDOM() * 200 + 50)::NUMERIC, 2)  -- Withdrawal
    END,
    'USD',
    CURRENT_DATE - (n * 3 || ' days')::INTERVAL,
    CASE
        WHEN n % 4 = 0 THEN 'Transfer from Checking'
        ELSE 'Transfer to Checking'
    END,
    'Savings transfer ' || n,
    'Transfer',
    FALSE,
    CURRENT_TIMESTAMP - (n * 3 || ' days')::INTERVAL
FROM generate_series(1, 50) AS n;

-- John Doe's BofA Checking (USD) - 150 transactions
INSERT INTO transactions (id, connection_id, account_id, transaction_id, amount, currency, date, merchant_name, description, category, pending, created_at)
SELECT
    uuid_generate_v4(),
    'c0001111-2222-2222-2222-222222222222'::UUID,
    'fa001111-2222-1111-1111-111111111111'::UUID,
    'plaid_txn_bofa_' || LPAD(n::TEXT, 6, '0'),
    CASE
        WHEN n % 8 = 0 THEN ROUND((RANDOM() * 3000 + 2000)::NUMERIC, 2)  -- Paycheck
        WHEN n % 6 = 0 THEN -ROUND((RANDOM() * 500 + 100)::NUMERIC, 2)  -- Bills
        ELSE -ROUND((RANDOM() * 100 + 10)::NUMERIC, 2)  -- Daily spending
    END,
    'USD',
    CURRENT_DATE - (n || ' days')::INTERVAL,
    CASE
        WHEN n % 8 = 0 THEN 'ACME Corp Payroll'
        WHEN n % 6 = 0 THEN (ARRAY['Comcast', 'AT&T', 'PG&E', 'Water Utility', 'Insurance Co'])[1 + (n % 5)]
        ELSE (ARRAY['Chipotle', 'McDonalds', 'Subway', 'Panera', 'Local Restaurant'])[1 + (n % 5)]
    END,
    'BofA transaction ' || n,
    CASE
        WHEN n % 8 = 0 THEN 'Income'
        WHEN n % 6 = 0 THEN 'Bills & Utilities'
        ELSE 'Food & Drink'
    END,
    n < 2,
    CURRENT_TIMESTAMP - (n || ' days')::INTERVAL
FROM generate_series(1, 150) AS n;

-- John Doe's BofA Credit Card (USD) - 100 transactions
INSERT INTO transactions (id, connection_id, account_id, transaction_id, amount, currency, date, merchant_name, description, category, pending, created_at)
SELECT
    uuid_generate_v4(),
    'c0001111-2222-2222-2222-222222222222'::UUID,
    'fa001111-2222-3333-3333-333333333333'::UUID,
    'plaid_txn_bofa_cc_' || LPAD(n::TEXT, 6, '0'),
    CASE
        WHEN n % 15 = 0 THEN ROUND((RANDOM() * 1000 + 500)::NUMERIC, 2)  -- Payment
        ELSE -ROUND((RANDOM() * 200 + 20)::NUMERIC, 2)  -- Purchase
    END,
    'USD',
    CURRENT_DATE - (n || ' days')::INTERVAL,
    CASE
        WHEN n % 15 = 0 THEN 'Payment - Thank You'
        ELSE (ARRAY['Amazon.com', 'Apple.com', 'Google Services', 'Steam', 'Spotify'])[1 + (n % 5)]
    END,
    'Credit card ' || CASE WHEN n % 15 = 0 THEN 'payment' ELSE 'purchase' END || ' ' || n,
    CASE
        WHEN n % 15 = 0 THEN 'Payment'
        ELSE 'Shopping'
    END,
    n < 5,
    CURRENT_TIMESTAMP - (n || ' days')::INTERVAL
FROM generate_series(1, 100) AS n;

-- Jane Smith's Capital One Checking (USD) - 120 transactions
INSERT INTO transactions (id, connection_id, account_id, transaction_id, amount, currency, date, merchant_name, description, category, pending, created_at)
SELECT
    uuid_generate_v4(),
    'c0002222-1111-1111-1111-111111111111'::UUID,
    'fa002222-1111-1111-1111-111111111111'::UUID,
    'plaid_txn_cap1_' || LPAD(n::TEXT, 6, '0'),
    CASE
        WHEN n % 14 = 0 THEN ROUND((RANDOM() * 4000 + 3000)::NUMERIC, 2)  -- Paycheck
        WHEN n % 7 = 0 THEN -ROUND((RANDOM() * 300 + 100)::NUMERIC, 2)  -- Large purchase
        ELSE -ROUND((RANDOM() * 80 + 10)::NUMERIC, 2)  -- Small purchase
    END,
    'USD',
    CURRENT_DATE - (n || ' days')::INTERVAL,
    CASE
        WHEN n % 14 = 0 THEN 'TechCorp Inc Payroll'
        WHEN n % 7 = 0 THEN (ARRAY['Macys', 'Nordstrom', 'Bloomingdales', 'Sephora', 'REI'])[1 + (n % 5)]
        ELSE (ARRAY['Lyft', 'DoorDash', 'Grubhub', 'Instacart', 'Postmates'])[1 + (n % 5)]
    END,
    'Capital One transaction ' || n,
    CASE
        WHEN n % 14 = 0 THEN 'Income'
        WHEN n % 7 = 0 THEN 'Shopping'
        ELSE 'Food & Drink'
    END,
    n < 2,
    CURRENT_TIMESTAMP - (n || ' days')::INTERVAL
FROM generate_series(1, 120) AS n;

-- Jane Smith's Discover Credit (USD) - 80 transactions
INSERT INTO transactions (id, connection_id, account_id, transaction_id, amount, currency, date, merchant_name, description, category, pending, created_at)
SELECT
    uuid_generate_v4(),
    'c0002222-2222-2222-2222-222222222222'::UUID,
    'fa002222-2222-1111-1111-111111111111'::UUID,
    'plaid_txn_discover_' || LPAD(n::TEXT, 6, '0'),
    CASE
        WHEN n % 20 = 0 THEN ROUND((RANDOM() * 800 + 400)::NUMERIC, 2)  -- Payment
        ELSE -ROUND((RANDOM() * 150 + 25)::NUMERIC, 2)  -- Purchase
    END,
    'USD',
    CURRENT_DATE - (n || ' days')::INTERVAL,
    CASE
        WHEN n % 20 = 0 THEN 'Autopay Payment'
        ELSE (ARRAY['Booking.com', 'Hotels.com', 'Airbnb', 'Delta Airlines', 'United Airlines'])[1 + (n % 5)]
    END,
    'Discover ' || CASE WHEN n % 20 = 0 THEN 'payment' ELSE 'travel expense' END || ' ' || n,
    CASE
        WHEN n % 20 = 0 THEN 'Payment'
        ELSE 'Travel'
    END,
    n < 3,
    CURRENT_TIMESTAMP - (n || ' days')::INTERVAL
FROM generate_series(1, 80) AS n;

-- Emma Wilson's Barclays Current (GBP) - 150 transactions with British Pounds
INSERT INTO transactions (id, connection_id, account_id, transaction_id, amount, currency, date, merchant_name, description, category, pending, created_at)
SELECT
    uuid_generate_v4(),
    'c0004444-1111-1111-1111-111111111111'::UUID,
    'fa004444-1111-1111-1111-111111111111'::UUID,
    'plaid_txn_barclays_' || LPAD(n::TEXT, 6, '0'),
    CASE
        WHEN n % 14 = 0 THEN ROUND((RANDOM() * 3000 + 2500)::NUMERIC, 2)  -- Salary
        WHEN n % 10 = 0 THEN -ROUND((RANDOM() * 1200 + 800)::NUMERIC, 2)  -- Rent
        WHEN n % 5 = 0 THEN -ROUND((RANDOM() * 100 + 20)::NUMERIC, 2)  -- Groceries
        ELSE -ROUND((RANDOM() * 50 + 5)::NUMERIC, 2)  -- Daily spending
    END,
    'GBP',
    CURRENT_DATE - (n || ' days')::INTERVAL,
    CASE
        WHEN n % 14 = 0 THEN 'Employer Ltd - Salary'
        WHEN n % 10 = 0 THEN 'Landlord Properties'
        WHEN n % 5 = 0 THEN (ARRAY['Tesco', 'Sainsburys', 'ASDA', 'Morrisons', 'Waitrose'])[1 + (n % 5)]
        ELSE (ARRAY['Costa Coffee', 'Pret A Manger', 'Boots', 'WH Smith', 'Greggs'])[1 + (n % 5)]
    END,
    'UK transaction ' || n,
    CASE
        WHEN n % 14 = 0 THEN 'Income'
        WHEN n % 10 = 0 THEN 'Rent'
        WHEN n % 5 = 0 THEN 'Groceries'
        ELSE 'Shopping'
    END,
    n < 2,
    CURRENT_TIMESTAMP - (n || ' days')::INTERVAL
FROM generate_series(1, 150) AS n;

-- Emma Wilson's Barclays Savings (GBP) - 30 transactions
INSERT INTO transactions (id, connection_id, account_id, transaction_id, amount, currency, date, merchant_name, description, category, pending, created_at)
SELECT
    uuid_generate_v4(),
    'c0004444-1111-1111-1111-111111111111'::UUID,
    'fa004444-1111-2222-2222-222222222222'::UUID,
    'plaid_txn_barclays_sav_' || LPAD(n::TEXT, 6, '0'),
    CASE
        WHEN n % 3 = 0 THEN ROUND((RANDOM() * 400 + 200)::NUMERIC, 2)  -- Deposit
        ELSE -ROUND((RANDOM() * 150 + 50)::NUMERIC, 2)  -- Withdrawal
    END,
    'GBP',
    CURRENT_DATE - (n * 5 || ' days')::INTERVAL,
    'Transfer',
    'Savings account ' || CASE WHEN n % 3 = 0 THEN 'deposit' ELSE 'withdrawal' END,
    'Transfer',
    FALSE,
    CURRENT_TIMESTAMP - (n * 5 || ' days')::INTERVAL
FROM generate_series(1, 30) AS n;

-- Test cascade user's transactions (for testing) - 100 transactions across 2 accounts
INSERT INTO transactions (id, connection_id, account_id, transaction_id, amount, currency, date, merchant_name, description, category, pending, created_at)
SELECT
    uuid_generate_v4(),
    'c0006666-1111-1111-1111-111111111111'::UUID,
    'fa006666-1111-1111-1111-111111111111'::UUID,
    'plaid_txn_test1_' || LPAD(n::TEXT, 6, '0'),
    -ROUND((RANDOM() * 100 + 10)::NUMERIC, 2),
    'USD',
    CURRENT_DATE - (n || ' days')::INTERVAL,
    'Test Merchant ' || (n % 10),
    'Test transaction ' || n,
    'Test',
    FALSE,
    CURRENT_TIMESTAMP - (n || ' days')::INTERVAL
FROM generate_series(1, 50) AS n;

INSERT INTO transactions (id, connection_id, account_id, transaction_id, amount, currency, date, merchant_name, description, category, pending, created_at)
SELECT
    uuid_generate_v4(),
    'c0006666-2222-2222-2222-222222222222'::UUID,
    'fa006666-2222-1111-1111-111111111111'::UUID,
    'plaid_txn_test2_cc_' || LPAD(n::TEXT, 6, '0'),
    -ROUND((RANDOM() * 200 + 20)::NUMERIC, 2),
    'USD',
    CURRENT_DATE - (n || ' days')::INTERVAL,
    'Test CC Merchant ' || (n % 10),
    'Test credit transaction ' || n,
    'Test',
    FALSE,
    CURRENT_TIMESTAMP - (n || ' days')::INTERVAL
FROM generate_series(1, 50) AS n;

-- Additional currencies: EUR transactions for international testing (20 transactions)
INSERT INTO transactions (id, connection_id, account_id, transaction_id, amount, currency, date, merchant_name, description, category, pending, created_at)
SELECT
    uuid_generate_v4(),
    'c0004444-1111-1111-1111-111111111111'::UUID,
    'fa004444-1111-1111-1111-111111111111'::UUID,
    'plaid_txn_barclays_eur_' || LPAD(n::TEXT, 6, '0'),
    -ROUND((RANDOM() * 200 + 50)::NUMERIC, 2),
    'EUR',
    CURRENT_DATE - (n * 7 || ' days')::INTERVAL,
    (ARRAY['Carrefour', 'Zara', 'Lidl', 'Aldi Sud', 'Media Markt'])[1 + (n % 5)],
    'European purchase ' || n,
    'Shopping',
    FALSE,
    CURRENT_TIMESTAMP - (n * 7 || ' days')::INTERVAL
FROM generate_series(1, 20) AS n;

-- Additional currencies: JPY transactions for international testing (20 transactions)
INSERT INTO transactions (id, connection_id, account_id, transaction_id, amount, currency, date, merchant_name, description, category, pending, created_at)
SELECT
    uuid_generate_v4(),
    'c0004444-1111-1111-1111-111111111111'::UUID,
    'fa004444-1111-1111-1111-111111111111'::UUID,
    'plaid_txn_barclays_jpy_' || LPAD(n::TEXT, 6, '0'),
    -ROUND((RANDOM() * 20000 + 1000)::NUMERIC, 0),  -- JPY typically no decimals
    'JPY',
    CURRENT_DATE - (n * 10 || ' days')::INTERVAL,
    (ARRAY['Uniqlo', 'Seven Eleven JP', 'Muji', 'Daiso', 'Don Quijote'])[1 + (n % 5)],
    'Japan purchase ' || n,
    'Shopping',
    FALSE,
    CURRENT_TIMESTAMP - (n * 10 || ' days')::INTERVAL
FROM generate_series(1, 20) AS n;

-- Additional currencies: CAD transactions (30 transactions)
INSERT INTO transactions (id, connection_id, account_id, transaction_id, amount, currency, date, merchant_name, description, category, pending, created_at)
SELECT
    uuid_generate_v4(),
    'c0001111-1111-1111-1111-111111111111'::UUID,
    'fa001111-1111-1111-1111-111111111111'::UUID,
    'plaid_txn_chase_cad_' || LPAD(n::TEXT, 6, '0'),
    -ROUND((RANDOM() * 150 + 30)::NUMERIC, 2),
    'CAD',
    CURRENT_DATE - (n * 6 || ' days')::INTERVAL,
    (ARRAY['Tim Hortons', 'Canadian Tire', 'Shoppers Drug Mart', 'Hudson Bay', 'Roots'])[1 + (n % 5)],
    'Canadian purchase ' || n,
    'Shopping',
    FALSE,
    CURRENT_TIMESTAMP - (n * 6 || ' days')::INTERVAL
FROM generate_series(1, 30) AS n;

-- ============================================================================
-- Verification queries
-- ============================================================================

-- Uncomment to verify counts after seeding:
-- SELECT 'Total transactions' as metric, COUNT(*) as value FROM transactions
-- UNION ALL
-- SELECT 'USD transactions', COUNT(*) FROM transactions WHERE currency = 'USD'
-- UNION ALL
-- SELECT 'GBP transactions', COUNT(*) FROM transactions WHERE currency = 'GBP'
-- UNION ALL
-- SELECT 'EUR transactions', COUNT(*) FROM transactions WHERE currency = 'EUR'
-- UNION ALL
-- SELECT 'JPY transactions', COUNT(*) FROM transactions WHERE currency = 'JPY'
-- UNION ALL
-- SELECT 'CAD transactions', COUNT(*) FROM transactions WHERE currency = 'CAD'
-- UNION ALL
-- SELECT 'Pending transactions', COUNT(*) FROM transactions WHERE pending = TRUE;

-- Verify partitioning:
-- SELECT
--     tableoid::regclass AS partition_name,
--     COUNT(*) AS row_count,
--     MIN(date) AS min_date,
--     MAX(date) AS max_date
-- FROM transactions
-- GROUP BY tableoid
-- ORDER BY partition_name;
