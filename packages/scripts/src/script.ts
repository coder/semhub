import { generateBodySummary } from "@/core/summary";

import { getDeps } from "./deps";

const { openai } = await getDeps();
try {
  const result = await generateBodySummary(
    "We need basic workspace creation for our Alpha that will allow minimum needed functionality and so our team can use it for dogfooding.    This epic focuses on the essential UI, CLI and API for Workspace Creation in V2 Alpha",
    openai,
  );
  console.log(result);
} catch (e) {
  console.error(e);
}
