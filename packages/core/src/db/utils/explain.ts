import type { SQLWrapper } from "drizzle-orm";
import { sql } from "drizzle-orm";

import type { DbClient } from "@/db";

export const explainAnalyze = async <T extends SQLWrapper>(
  db: DbClient,
  query: T,
) => {
  const debugResult = await db.execute(sql`EXPLAIN ANALYZE ${query.getSQL()}`);
  // Process each row first to handle vectors
  const processedRows = debugResult.map((row) => {
    const plan = row["QUERY PLAN"];
    if (typeof plan === "string" && plan.includes("[") && plan.includes(",")) {
      const vectorMatch = plan.match(/\[([-\d.,e\s]+)\]/);
      if (vectorMatch) {
        const vectorStr = vectorMatch[0];
        const count = (vectorStr.match(/,/g) || []).length + 1;
        return {
          "QUERY PLAN": plan.replace(
            vectorStr,
            `[Vector with ${count} dimensions]`,
          ),
        };
      }
    }
    return row;
  });
  // Then concatenate the processed results
  const queryPlan = processedRows.map((row) => row["QUERY PLAN"]).join("\n");
  // eslint-disable-next-line no-console
  console.debug(JSON.stringify({ "QUERY PLAN": queryPlan }, null, 2));
  return await query;
};
