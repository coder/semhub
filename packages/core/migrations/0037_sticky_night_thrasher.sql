-- DANGER: if this works, need to empty the table and redo embeddings
TRUNCATE TABLE "issue_embeddings";
ALTER TABLE "issue_embeddings" ALTER COLUMN "embedding" SET DATA TYPE vector(256);
