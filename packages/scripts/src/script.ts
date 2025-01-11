import { unstuckIssueEmbeddings } from "@/core/embedding";

import { getDeps } from "./deps";

const { db, closeConnection } = await getDeps();
await unstuckIssueEmbeddings(db);
await closeConnection();
