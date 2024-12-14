import { Repo } from "@/core/repo";
import { getDeps } from "@/deps";

const { db } = getDeps();

try {
  const repo = await Repo.getNextEnqueuedRepo(db);
  console.log(repo);
} catch (e) {
  console.error(e);
}
