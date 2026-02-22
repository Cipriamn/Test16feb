-- Migration: 008_create_transactions_table (rollback)
-- Description: Drop transactions table and all partitions

-- Drop the partition creation function
DROP FUNCTION IF EXISTS create_transactions_partition(DATE);

-- Drop the partitioned table (cascades to all partitions and indexes)
DROP TABLE IF EXISTS transactions CASCADE;
