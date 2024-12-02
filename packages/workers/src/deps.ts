import { Resource } from "sst";

import { createDb } from "@/core/db";
import { createOpenAIClient } from "@/core/openai";

const dbConfig = {
  connectionString: Resource.Supabase.databaseUrl,
  isProd: Resource.App.stage === "prod",
};
const { db } = createDb(dbConfig);

const openai = createOpenAIClient(Resource.OPENAI_API_KEY.value);

export { db, openai };
