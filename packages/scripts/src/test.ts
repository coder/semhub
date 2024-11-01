import { closeConnection } from "@semhub/core/db";
import { Embedding } from "@semhub/core/embedding";

try {
  await Embedding.sync();
} catch (error) {
  console.error("error:", error);
} finally {
  await closeConnection();
}
