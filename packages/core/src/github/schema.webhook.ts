import { z } from "zod";

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
    permissions: z.record(z.enum(["read", "write", "admin"])),
    events: z.array(z.string()),
    created_at: z.string(),
    updated_at: z.string(),
    repository_selection: z.enum(["all", "selected"]),
    suspended_at: z.string().nullable(),
    suspended_by: z.string().nullable(),
  }),
  sender: z.object({
    id: z.number(),
    login: z.string(),
    type: z.enum(["User", "Bot", "Organization"]),
    node_id: z.string(),
  }),
});

export type InstallationWebhook = z.infer<typeof installationSchema>;

export const githubWebhookHeaderSchema = z.object({
  "x-github-event": z.string(),
  "x-hub-signature-256": z.string(),
  "x-github-delivery": z.string(),
});

export type GithubWebhookHeaders = z.infer<typeof githubWebhookHeaderSchema>;
