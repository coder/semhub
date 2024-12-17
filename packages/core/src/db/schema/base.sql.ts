import { text, timestamp } from "drizzle-orm/pg-core";
import { ulid } from "ulidx";

export function timestamptz(name: string) {
  return timestamp(name, { precision: 6, withTimezone: true });
}

// comprehensive list of all tables
const prefixes = {
  repos: "rep",
  issues: "iss",
  comments: "cmt",
  labels: "lbl",
  issue_embeddings: "iss_emb",
  users: "usr",
} as const;

function createId(prefix: keyof typeof prefixes): string {
  return [prefixes[prefix], ulid()].join("_");
}

const getIdColumn = (tableName: keyof typeof prefixes) =>
  text("id")
    .primaryKey()
    .$defaultFn(() => createId(tableName));

const timestamps = {
  createdAt: timestamptz("created_at").defaultNow().notNull(),
  updatedAt: timestamptz("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
};

export const getBaseColumns = (tableName: keyof typeof prefixes) => ({
  id: getIdColumn(tableName),
  ...timestamps,
});

export const getTimestampColumns = () => ({
  ...timestamps,
});
