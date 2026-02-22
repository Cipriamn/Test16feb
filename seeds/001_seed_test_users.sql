-- Seed Data: Test Users for Identity & Access Context
-- Description: 5+ test users with credentials, consents, 2FA, and sessions
-- Note: In production, use application-level encryption for 2FA secrets.
--       These seeds use placeholder encrypted data for testing structure only.

-- Test encryption key (DO NOT USE IN PRODUCTION)
-- Application should use proper key management (AWS KMS, Vault, etc.)

-- ============================================================================
-- USERS (5 test users with varying profiles)
-- ============================================================================

INSERT INTO users (id, email, name, phone, address, timezone, profile_photo_url, created_at, updated_at)
VALUES
    -- User 1: Full profile, email auth, 2FA enabled
    ('a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d', 'john.doe@example.com', 'John Doe',
     '+1-555-123-4567', '123 Main St, New York, NY 10001', 'America/New_York',
     'https://storage.example.com/avatars/john-doe.jpg',
     '2025-01-15 10:30:00+00', '2025-02-20 14:45:00+00'),

    -- User 2: Minimal profile, Google OAuth
    ('b2c3d4e5-f6a7-5b6c-9d0e-1f2a3b4c5d6e', 'jane.smith@gmail.com', 'Jane Smith',
     NULL, NULL, 'America/Los_Angeles', NULL,
     '2025-02-01 08:00:00+00', '2025-02-01 08:00:00+00'),

    -- User 3: Facebook OAuth user with partial profile
    ('c3d4e5f6-a7b8-6c7d-0e1f-2a3b4c5d6e7f', 'mike.johnson@facebook.example', 'Mike Johnson',
     '+1-555-987-6543', NULL, 'America/Chicago', NULL,
     '2025-01-20 16:20:00+00', '2025-02-18 09:30:00+00'),

    -- User 4: International user with full profile
    ('d4e5f6a7-b8c9-7d8e-1f2a-3b4c5d6e7f8a', 'emma.wilson@example.co.uk', 'Emma Wilson',
     '+44-20-7946-0958', '10 Downing St, London, UK', 'Europe/London',
     'https://storage.example.com/avatars/emma-wilson.png',
     '2024-12-01 12:00:00+00', '2025-02-15 18:00:00+00'),

    -- User 5: New user, minimal data
    ('e5f6a7b8-c9d0-8e9f-2a3b-4c5d6e7f8a9b', 'newuser@example.com', NULL,
     NULL, NULL, 'UTC', NULL,
     '2025-02-21 22:00:00+00', '2025-02-21 22:00:00+00'),

    -- User 6: Test user for cascade delete testing
    ('f6a7b8c9-d0e1-9f0a-3b4c-5d6e7f8a9b0c', 'cascade.test@example.com', 'Cascade Test User',
     '+1-555-000-0000', '999 Test Ave', 'America/Denver', NULL,
     '2025-02-01 00:00:00+00', '2025-02-01 00:00:00+00');

-- ============================================================================
-- CREDENTIALS (various auth methods)
-- ============================================================================

-- Bcrypt hashes generated with cost factor 12 (these are example hashes)
-- In production, use proper bcrypt library to generate hashes

INSERT INTO credentials (id, user_id, provider, password_hash, oauth_provider_id, created_at)
VALUES
    -- User 1: Email/password auth
    ('11111111-1111-1111-1111-111111111111', 'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d',
     'email', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.qNsGpXXXXXXXXX', NULL,
     '2025-01-15 10:30:00+00'),

    -- User 2: Google OAuth
    ('22222222-2222-2222-2222-222222222222', 'b2c3d4e5-f6a7-5b6c-9d0e-1f2a3b4c5d6e',
     'google', NULL, 'google-oauth-id-123456789',
     '2025-02-01 08:00:00+00'),

    -- User 3: Facebook OAuth
    ('33333333-3333-3333-3333-333333333333', 'c3d4e5f6-a7b8-6c7d-0e1f-2a3b4c5d6e7f',
     'facebook', NULL, 'facebook-oauth-id-987654321',
     '2025-01-20 16:20:00+00'),

    -- User 4: Email + Google (multiple auth methods)
    ('44444444-4444-4444-4444-444444444444', 'd4e5f6a7-b8c9-7d8e-1f2a-3b4c5d6e7f8a',
     'email', '$2b$12$ABCDEFGHIJKLMNOPQRSTUVwxyz1234567890ABCDEFGHIJ', NULL,
     '2024-12-01 12:00:00+00'),
    ('44444444-5555-5555-5555-555555555555', 'd4e5f6a7-b8c9-7d8e-1f2a-3b4c5d6e7f8a',
     'google', NULL, 'google-oauth-emma-wilson',
     '2025-01-10 14:00:00+00'),

    -- User 5: Email auth (new user)
    ('55555555-5555-5555-5555-555555555555', 'e5f6a7b8-c9d0-8e9f-2a3b-4c5d6e7f8a9b',
     'email', '$2b$12$ZYXWVUTSRQPONMLKJIHGFEdcba0987654321ZYXWVUTSRQPO', NULL,
     '2025-02-21 22:00:00+00'),

    -- User 6: Email auth (cascade test)
    ('66666666-6666-6666-6666-666666666666', 'f6a7b8c9-d0e1-9f0a-3b4c-5d6e7f8a9b0c',
     'email', '$2b$12$CascadeTestPasswordHashForDeletionTesting12345', NULL,
     '2025-02-01 00:00:00+00');

-- ============================================================================
-- CONSENTS (terms acceptance records)
-- ============================================================================

INSERT INTO consents (id, user_id, terms_version, accepted_at)
VALUES
    -- User 1: Accepted v1.0 and later v1.1
    ('aaaa1111-1111-1111-1111-111111111111', 'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d',
     '1.0', '2025-01-15 10:30:00+00'),
    ('aaaa1111-2222-2222-2222-222222222222', 'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d',
     '1.1', '2025-02-01 00:00:00+00'),

    -- User 2: v1.1 only
    ('bbbb2222-2222-2222-2222-222222222222', 'b2c3d4e5-f6a7-5b6c-9d0e-1f2a3b4c5d6e',
     '1.1', '2025-02-01 08:00:00+00'),

    -- User 3: v1.0 only (needs to accept new terms)
    ('cccc3333-3333-3333-3333-333333333333', 'c3d4e5f6-a7b8-6c7d-0e1f-2a3b4c5d6e7f',
     '1.0', '2025-01-20 16:20:00+00'),

    -- User 4: All versions
    ('dddd4444-4444-4444-4444-444444444444', 'd4e5f6a7-b8c9-7d8e-1f2a-3b4c5d6e7f8a',
     '1.0', '2024-12-01 12:00:00+00'),
    ('dddd4444-5555-5555-5555-555555555555', 'd4e5f6a7-b8c9-7d8e-1f2a-3b4c5d6e7f8a',
     '1.1', '2025-02-01 00:00:00+00'),

    -- User 5: Latest version
    ('eeee5555-5555-5555-5555-555555555555', 'e5f6a7b8-c9d0-8e9f-2a3b-4c5d6e7f8a9b',
     '1.1', '2025-02-21 22:00:00+00'),

    -- User 6: For cascade testing
    ('ffff6666-6666-6666-6666-666666666666', 'f6a7b8c9-d0e1-9f0a-3b4c-5d6e7f8a9b0c',
     '1.0', '2025-02-01 00:00:00+00');

-- ============================================================================
-- TWO_FACTOR_AUTH (encrypted 2FA configurations)
-- ============================================================================

-- Note: In production, encrypt with application-level AES-256
-- Using pgp_sym_encrypt for demonstration (placeholder key 'test_encryption_key')

INSERT INTO two_factor_auth (id, user_id, method, secret, backup_codes, enabled, created_at)
VALUES
    -- User 1: TOTP enabled
    ('2fa11111-1111-1111-1111-111111111111', 'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d',
     'totp',
     pgp_sym_encrypt('JBSWY3DPEHPK3PXP', 'test_encryption_key')::bytea,
     pgp_sym_encrypt('["ABC123","DEF456","GHI789","JKL012","MNO345","PQR678","STU901","VWX234"]', 'test_encryption_key')::bytea,
     true, '2025-01-20 11:00:00+00'),

    -- User 4: SMS 2FA enabled
    ('2fa44444-4444-4444-4444-444444444444', 'd4e5f6a7-b8c9-7d8e-1f2a-3b4c5d6e7f8a',
     'sms',
     pgp_sym_encrypt('+44-20-7946-0958', 'test_encryption_key')::bytea,
     pgp_sym_encrypt('["UK1234","UK5678","UK9012","UK3456","UK7890","UK2345","UK6789","UK0123"]', 'test_encryption_key')::bytea,
     true, '2025-01-15 09:00:00+00'),

    -- User 4: TOTP also configured but disabled
    ('2fa44444-5555-5555-5555-555555555555', 'd4e5f6a7-b8c9-7d8e-1f2a-3b4c5d6e7f8a',
     'totp',
     pgp_sym_encrypt('HXDMVJECJJWSRB3H', 'test_encryption_key')::bytea,
     pgp_sym_encrypt('["EM1111","EM2222","EM3333","EM4444","EM5555","EM6666","EM7777","EM8888"]', 'test_encryption_key')::bytea,
     false, '2025-02-10 15:00:00+00'),

    -- User 6: For cascade testing
    ('2fa66666-6666-6666-6666-666666666666', 'f6a7b8c9-d0e1-9f0a-3b4c-5d6e7f8a9b0c',
     'totp',
     pgp_sym_encrypt('CASCADETESTSECRET', 'test_encryption_key')::bytea,
     pgp_sym_encrypt('["CAS001","CAS002","CAS003","CAS004","CAS005","CAS006","CAS007","CAS008"]', 'test_encryption_key')::bytea,
     true, '2025-02-01 00:00:00+00');

-- ============================================================================
-- AUTH_SESSIONS (active sessions)
-- ============================================================================

INSERT INTO auth_sessions (id, user_id, token_hash, device_info, ip_address, location, expires_at, created_at)
VALUES
    -- User 1: Multiple active sessions
    ('sess1111-1111-1111-1111-111111111111', 'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d',
     'a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef12345678',
     '{"device": "iPhone 15 Pro", "os": "iOS 17.3", "browser": "Safari", "app_version": "2.1.0"}',
     '203.0.113.42', 'New York, NY, USA',
     '2025-02-23 10:30:00+00', '2025-02-22 10:30:00+00'),

    ('sess1111-2222-2222-2222-222222222222', 'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d',
     'b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456789a',
     '{"device": "MacBook Pro", "os": "macOS 14.3", "browser": "Chrome 121"}',
     '203.0.113.100', 'New York, NY, USA',
     '2025-02-23 08:00:00+00', '2025-02-22 08:00:00+00'),

    -- User 2: Single mobile session
    ('sess2222-2222-2222-2222-222222222222', 'b2c3d4e5-f6a7-5b6c-9d0e-1f2a3b4c5d6e',
     'c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456789abc',
     '{"device": "Pixel 8", "os": "Android 14", "browser": "Chrome Mobile", "app_version": "2.1.0"}',
     '198.51.100.55', 'Los Angeles, CA, USA',
     '2025-02-23 15:00:00+00', '2025-02-22 15:00:00+00'),

    -- User 4: Sessions from multiple locations
    ('sess4444-4444-4444-4444-444444444444', 'd4e5f6a7-b8c9-7d8e-1f2a-3b4c5d6e7f8a',
     'd4e5f6789012345678901234567890abcdef1234567890abcdef123456789abcde',
     '{"device": "iPad Pro", "os": "iPadOS 17.3", "browser": "Safari"}',
     '51.195.149.220', 'London, UK',
     '2025-02-23 18:00:00+00', '2025-02-22 18:00:00+00'),

    -- User 6: For cascade testing
    ('sess6666-6666-6666-6666-666666666666', 'f6a7b8c9-d0e1-9f0a-3b4c-5d6e7f8a9b0c',
     'f6a7b8c9d0e12345678901234567890abcdef1234567890abcdef123456789abcd',
     '{"device": "Test Device", "os": "Test OS", "browser": "Test Browser"}',
     '10.0.0.1', 'Test Location',
     '2025-02-23 00:00:00+00', '2025-02-22 00:00:00+00'),

    -- Expired session (for cleanup testing)
    ('sess0000-0000-0000-0000-000000000000', 'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d',
     'expired0123456789012345678901234567890abcdef1234567890abcdef1234567',
     '{"device": "Old Phone", "os": "iOS 16.0", "browser": "Safari"}',
     '203.0.113.1', 'New York, NY, USA',
     '2025-02-01 00:00:00+00', '2025-01-01 00:00:00+00');

-- ============================================================================
-- Verification queries (for testing seed data)
-- ============================================================================

-- Uncomment to verify counts after seeding:
-- SELECT 'users' as table_name, COUNT(*) as count FROM users
-- UNION ALL SELECT 'credentials', COUNT(*) FROM credentials
-- UNION ALL SELECT 'consents', COUNT(*) FROM consents
-- UNION ALL SELECT 'two_factor_auth', COUNT(*) FROM two_factor_auth
-- UNION ALL SELECT 'auth_sessions', COUNT(*) FROM auth_sessions;
