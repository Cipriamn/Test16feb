-- Rollback: 006_create_connections_table

DROP TRIGGER IF EXISTS update_connections_updated_at ON connections;
DROP TABLE IF EXISTS connections;
DROP TYPE IF EXISTS connection_status;
