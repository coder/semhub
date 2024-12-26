import { z } from "zod";

/* NOTE: use https://github.com/octokit/webhooks somehow in the future */

export const permissionLevelSchema = z.enum(["read", "write", "admin"]);
export type PermissionLevel = z.infer<typeof permissionLevelSchema>;

export const permissionsSchema = z.record(permissionLevelSchema);
export type Permissions = z.infer<typeof permissionsSchema>;

export const repositorySchema = z.object({
  id: z.number(),
  node_id: z.string(),
  name: z.string(),
  full_name: z.string(),
  private: z.boolean(),
});

export const senderSchema = z.object({
  id: z.number(),
  login: z.string(),
  type: z.enum(["User", "Bot", "Organization"]),
  node_id: z.string(),
  html_url: z.string(),
});

export type Sender = z.infer<typeof senderSchema>;

// payload example: https://github.com/octokit/webhooks/issues/939#issuecomment-2169485000
export const installationSchema = z.object({
  action: z.enum([
    "created",
    "deleted",
    "suspend",
    "unsuspend",
    "new_permissions_accepted",
  ]),
  installation: z.object({
    id: z.number(),
    account: z.object({
      id: z.number(),
      login: z.string(),
      type: z.enum(["User", "Organization"]),
      node_id: z.string(),
      avatar_url: z.string().optional(),
      html_url: z.string(),
    }),
    app_id: z.number(),
    target_type: z.enum(["User", "Organization"]),
    permissions: permissionsSchema,
    events: z.array(z.string()),
    created_at: z.string(),
    updated_at: z.string(),
    repository_selection: z.enum(["all", "selected"]),
    suspended_at: z.string().nullable(),
    suspended_by: z.string().nullable(),
  }),
  repositories: z.array(repositorySchema),
  sender: senderSchema,
});

export type InstallationWebhook = z.infer<typeof installationSchema>;

export const githubWebhookHeaderSchema = z.object({
  "x-github-event": z.string(),
  "x-hub-signature-256": z.string(),
  "x-github-delivery": z.string(),
});

export type GithubWebhookHeaders = z.infer<typeof githubWebhookHeaderSchema>;

export const installationRepositoriesSchema = z.object({
  action: z.enum(["added", "removed"]),
  installation: z.object({
    id: z.number(),
    account: z.object({
      login: z.string(),
      id: z.number(),
      node_id: z.string(),
      type: z.enum(["User", "Organization"]),
    }),
  }),
  repository_selection: z.enum(["all", "selected"]),
  repositories_added: z.array(repositorySchema),
  repositories_removed: z.array(repositorySchema),
  sender: senderSchema,
});

export type InstallationRepositoriesWebhook = z.infer<
  typeof installationRepositoriesSchema
>;

export const githubAppAuthorizationSchema = z.object({
  action: z.enum(["revoked"]),
  sender: senderSchema,
});

export type GithubAppAuthorizationWebhook = z.infer<
  typeof githubAppAuthorizationSchema
>;
