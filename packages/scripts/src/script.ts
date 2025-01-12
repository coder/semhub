import { selectIssuesForEmbeddingCron } from "@/core/embedding";

import { getDeps } from "./deps";

const { db, closeConnection } = await getDeps();
await selectIssuesForEmbeddingCron({ db, numIssues: 100, intervalInHours: 12 });
await closeConnection();
