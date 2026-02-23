-- Migration: 013_create_cancellation_requests_table (rollback)
-- Description: Drop cancellation_requests and disputes tables

-- Drop tables (order matters due to FK)
DROP TABLE IF EXISTS disputes CASCADE;
DROP TABLE IF EXISTS cancellation_requests CASCADE;

-- Drop enums
DROP TYPE IF EXISTS dispute_status;
DROP TYPE IF EXISTS cancellation_request_status;
