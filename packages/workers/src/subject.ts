import { createSubjects } from "@openauthjs/openauth";
import { z } from "zod";

export const subjects = createSubjects({
  user: z.object({
    userID: z.string(),
  }),
});
