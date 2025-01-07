import { eq, or } from "@/core/db";
import { publicCollectionsToRepos } from "@/core/db/schema/entities/public-collection-to-repo.sql";
import { publicCollections } from "@/core/db/schema/entities/public-collection.sql";
import { repos } from "@/core/db/schema/entities/repo.sql";
import { getDeps } from "@/deps";

const collections = ["editor", "terminal", "frontend", "languages"];

const { db, currStage, closeConnection } = getDeps();

try {
  for (const collection of collections) {
    await db
      .insert(publicCollections)
      .values({
        name: collection,
      })
      .onConflictDoNothing();
  }
  if (currStage !== "prod") {
    const [editorCollectionId] = await db
      .select({ id: publicCollections.id })
      .from(publicCollections)
      .where(eq(publicCollections.name, "editor"));
    if (!editorCollectionId) {
      throw new Error("Editor collection not found");
    }
    const editorRepos = await db
      .select()
      .from(repos)
      .where(
        or(
          eq(repos.ownerLogin, "coder"),
          eq(repos.name, "vscode"),
          eq(repos.name, "cursor"),
        ),
      );
    await db
      .insert(publicCollectionsToRepos)
      .values(
        editorRepos.map((repo) => ({
          collectionId: editorCollectionId.id,
          repoId: repo.id,
        })),
      )
      .onConflictDoNothing();
    console.log(`Added ${editorRepos.length} repos to editor collection`);
    const [frontendCollectionId] = await db
      .select({ id: publicCollections.id })
      .from(publicCollections)
      .where(eq(publicCollections.name, "frontend"));
    if (!frontendCollectionId) {
      throw new Error("Frontend collection not found");
    }
    const frontendRepos = await db
      .select()
      .from(repos)
      .where(or(eq(repos.ownerLogin, "vercel"), eq(repos.ownerLogin, "vuejs")));
    await db
      .insert(publicCollectionsToRepos)
      .values(
        frontendRepos.map((repo) => ({
          collectionId: frontendCollectionId.id,
          repoId: repo.id,
        })),
      )
      .onConflictDoNothing();
    console.log(`Added ${frontendRepos.length} repos to frontend collection`);
    const [languagesCollectionId] = await db
      .select({ id: publicCollections.id })
      .from(publicCollections)
      .where(eq(publicCollections.name, "languages"));
    if (!languagesCollectionId) {
      throw new Error("Languages collection not found");
    }
    const languagesRepos = await db
      .select()
      .from(repos)
      .where(or(eq(repos.name, "node"), eq(repos.name, "TypeScript")));
    await db
      .insert(publicCollectionsToRepos)
      .values(
        languagesRepos.map((repo) => ({
          collectionId: languagesCollectionId.id,
          repoId: repo.id,
        })),
      )
      .onConflictDoNothing();
    console.log(`Added ${languagesRepos.length} repos to languages collection`);
  } else {
    // populate collections for prod
  }
} catch (e) {
  console.error(e);
} finally {
  await closeConnection();
}
