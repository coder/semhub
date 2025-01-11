-- Changes vector storage to PLAIN for better performance on vector operations
ALTER TABLE issue_embeddings ALTER COLUMN embedding SET STORAGE PLAIN;

-- NB must run `VACUUM FULL issue_embeddings` separately if there is already data in the table
-- not included here because it needs to run outside transaction block
-- When running VACUUM FULL:
-- - Check to ensure there is sufficient free disk space
-- - Connect to Supabase via Direct URL (to prevent timeout)
-- - Might need to get IPv4 add-on and increase instance size
-- - Consider increasing maintenance_work_mem for faster HNSW index rebuild:

-- SET maintenance_work_mem = '3GB'; -- should be less than 1/4 of total RAM
-- VACUUM FULL issue_embeddings;
-- SET statement_timeout = '120 min'; -- default of 2 min in Supabase
-- SET maintenance_work_mem = DEFAULT;
-- SET statement_timeout = DEFAULT;
