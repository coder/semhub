/*
Changes vector storage to PLAIN if vector operation is in hot path (which it is for Semhub):
- this only works if your row size is within PG page limit of 8KB
- you cannot increase page limit beyond 8KB for index
- to check row size, run:
select pg_column_size(issue_embeddings.*) as rowsize_in_bytes from issue_embeddings where id = 'random_row_id';

If there is already data in the table, you must run `VACUUM FULL issue_embeddings` separately

Not included in this migration because it needs to run outside transaction block

When running VACUUM FULL:
- Check to ensure there is sufficient free disk space (2x current size is a good rule of thumb)
- Connect to Supabase via Direct URL + might need IPv4 add-on to connect using client
- Maybe increase instance size


So commands to run are:
SET maintenance_work_mem = '3GB'; -- should be less than 1/4 of total RAM
VACUUM FULL issue_embeddings;
SET statement_timeout = '120 min'; -- default of 2 min in Supabase
SET maintenance_work_mem = DEFAULT;
SET statement_timeout = DEFAULT;
*/

ALTER TABLE issue_embeddings ALTER COLUMN embedding SET STORAGE PLAIN;
