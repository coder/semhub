import { selectIssuesForEmbeddingCron } from "@/core/embedding";

import { getDeps } from "./deps";

const { db, closeConnection } = await getDeps();
await selectIssuesForEmbeddingCron(db, 100);
await closeConnection();
