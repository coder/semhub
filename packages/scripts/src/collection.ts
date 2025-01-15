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
  // populate collections for prod
  const [editorCollectionId] = await db
    .select({ id: publicCollections.id })
    .from(publicCollections)
    .where(eq(publicCollections.name, "editor"));
  if (!editorCollectionId) {
    throw new Error("Editor collection not found");
  }
  const [frontendCollectionId] = await db
    .select({ id: publicCollections.id })
    .from(publicCollections)
    .where(eq(publicCollections.name, "frontend"));
  if (!frontendCollectionId) {
    throw new Error("Frontend collection not found");
  }
  const [languagesCollectionId] = await db
    .select({ id: publicCollections.id })
    .from(publicCollections)
    .where(eq(publicCollections.name, "languages"));
  if (!languagesCollectionId) {
    throw new Error("Languages collection not found");
  }
  const [terminalCollectionId] = await db
    .select({ id: publicCollections.id })
    .from(publicCollections)
    .where(eq(publicCollections.name, "terminal"));
  if (!terminalCollectionId) {
    throw new Error("Terminal collection not found");
  }
  if (currStage !== "prod") {
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
    const terminalRepos = await db
      .select()
      .from(repos)
      .where(
        or(
          eq(repos.name, "terminal"),
          eq(repos.name, "iTerm2"),
          eq(repos.name, "ghostty"),
          eq(repos.name, "kitty"),
          eq(repos.name, "zellij"),
          eq(repos.name, "alacritty"),
          eq(repos.name, "wezterm"),
          eq(repos.name, "xterm.js"),
          eq(repos.name, "Warp"),
          eq(repos.name, "tabby"),
          eq(repos.name, "waveterm"),
        ),
      );
    await db
      .insert(publicCollectionsToRepos)
      .values(
        terminalRepos.map((repo) => ({
          collectionId: terminalCollectionId.id,
          repoId: repo.id,
        })),
      )
      .onConflictDoNothing();
    console.log(`Added ${terminalRepos.length} repos to terminal collection`);
    const editorRepos = await db
      .select()
      .from(repos)
      .where(
        or(
          eq(repos.name, "vscode"),
          eq(repos.name, "coder"),
          eq(repos.name, "emacs"),
          eq(repos.name, "vscodium"),
          eq(repos.name, "vim"),
          eq(repos.name, "helix"),
          eq(repos.name, "notepad-plus-plus"),
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
    const languagesRepos = await db
      .select()
      .from(repos)
      .where(
        or(
          eq(repos.name, "TypeScript"),
          eq(repos.name, "node"),
          eq(repos.name, "rust"),
          eq(repos.name, "go"),
          eq(repos.name, "swift"),
          eq(repos.name, "cpython"),
          eq(repos.name, "kotlin"),
          eq(repos.name, "php-src"),
          eq(repos.name, "ruby"),
          eq(repos.name, "elixir"),
        ),
      );
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
    const frontendRepos = await db
      .select()
      .from(repos)
      .where(
        or(
          eq(repos.name, "react"),
          eq(repos.name, "next.js"),
          eq(repos.name, "svelte"),
          eq(repos.name, "astro"),
          eq(repos.name, "solid"),
          eq(repos.name, "angular"),
          eq(repos.name, "vue"),
          eq(repos.name, "qwik"),
        ),
      );
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
  }
} catch (e) {
  console.error(e);
} finally {
  await closeConnection();
}
