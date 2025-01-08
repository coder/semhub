import { createSubjects } from "@openauthjs/openauth/subject";
import { z } from "zod";

export const subjects = createSubjects({
  user: z.object({
    id: z.string(),
    email: z.string(),
    avatarUrl: z.string().url(),
    name: z.string().nullable(),
  }),
});

export type User = z.infer<typeof subjects.user>;
