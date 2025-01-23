import { z } from "zod";

import {
  INVALID_REPO_MESSAGE,
  validateAndExtractGithubOwnerAndRepo,
} from "@/core/github/schema.validation";

// Schema for form validation (used by TanStack Form)
// need to maintain separate schema because transform is not supported
// https://github.com/TanStack/form/issues/418
export const githubRepoFormSchema = z.object({
  input: z.string().refine((val) => {
    return (
      val
        // adding these so validation doesn't kick in too early
        .replace("https://github.com/", "")
        .replace("www.github.com/", "")
        .replace("github.com/", "")
        .replace("github", "").length <= 5
        ? true
        : validateAndExtractGithubOwnerAndRepo(val) !== null
    );
  }, INVALID_REPO_MESSAGE),
});

// Schema for submission (with transform)
export const githubRepoSubmitSchema = z
  .object({
    input: z.string(),
  })
  .transform((data, ctx) => {
    const result = validateAndExtractGithubOwnerAndRepo(data.input, ctx);
    if (!result) return z.NEVER;
    return result;
  });
