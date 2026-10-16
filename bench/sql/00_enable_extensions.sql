-- Optional: enables query timing aggregation if the server was started with
-- shared_preload_libraries including pg_stat_statements (often not set on
-- the stock postgres:16-alpine image — safe to ignore errors).
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'pg_stat_statements not available (ok for alpine defaults): %', SQLERRM;
END $$;
