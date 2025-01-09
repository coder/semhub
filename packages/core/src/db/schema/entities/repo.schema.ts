import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

import { repos } from "./repo.sql";

export const createRepoSchema = createInsertSchema(repos, {
  htmlUrl: z.string().url(),
}).omit({
  id: true,
});

export type CreateRepo = z.infer<typeof createRepoSchema>;

// Add select schema for use in search results
export const selectRepoForSearchSchema = createSelectSchema(repos)
  .pick({
    name: true,
    ownerLogin: true,
    htmlUrl: true,
    lastSyncedAt: true,
  })
  .transform((repo) => ({
    repoName: repo.name,
    repoOwnerName: repo.ownerLogin,
    repoUrl: repo.htmlUrl,
    repoLastSyncedAt: repo.lastSyncedAt,
  }));

export type SelectRepoForSearch = z.infer<typeof selectRepoForSearchSchema>;
