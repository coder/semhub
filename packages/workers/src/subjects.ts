import { createSubjects } from "@openauthjs/openauth";
import { z } from "zod";

export const subjects = createSubjects({
  user: z.object({
    email: z.string(),
    userId: z.string(),
    avatarUrl: z.string(),
    name: z.string(),
  }),
});
