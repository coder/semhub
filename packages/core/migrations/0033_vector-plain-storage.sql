/*
pg (or pgvector?) uses EXTENDED storage by default for for all columns bigger than 2KB

Changes vector storage to PLAIN if vector operation is in hot path (which it is for SemHub):
- this only works if your row size is within PG page limit of 8KB
- you cannot increase page limit beyond 8KB for index

To check row size, run:
select pg_column_size(issue_embeddings.*) as rowsize_in_bytes from issue_embeddings where id = 'random_row_id';

To see your column storage type, run:
select att.attname,
       case att.attstorage
          when 'p' then 'plain'
          when 'm' then 'main'
          when 'e' then 'external'
          when 'x' then 'extended'
       end as attstorage
from pg_attribute att
  join pg_class tbl on tbl.oid = att.attrelid
  join pg_namespace ns on tbl.relnamespace = ns.oid
where tbl.relname = 'issue_embeddings'
  and ns.nspname = 'public'
  and not att.attisdropped;

If there is already data in the table, you must run `VACUUM FULL issue_embeddings` separately. Not included in this migration because it needs to run outside transaction block

When running VACUUM FULL:
- Check to ensure there is sufficient free disk space (2x current size is a good rule of thumb)
- Connect to Supabase via Direct URL + might need IPv4 add-on to connect using client
- Maybe increase instance size

So commands to run are:
SET maintenance_work_mem = '1GB';
SET statement_timeout = '120min';
VACUUM FULL issue_embeddings;
SET maintenance_work_mem = DEFAULT;
SET statement_timeout = DEFAULT;

To see running vacuum query, run:
- SELECT query, query_start, state FROM pg_stat_activity WHERE query LIKE '%VACUUM%';
- SELECT * FROM pg_stat_progress_cluster;

When done:
- disable IPv4 add-on
- test new search speed

*/

ALTER TABLE issue_embeddings ALTER COLUMN embedding SET STORAGE PLAIN;
