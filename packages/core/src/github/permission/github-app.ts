import { type Permissions } from "../schema.webhook";

// this file tracks the current permissions requested by SemHub Github App
// however, the actual permissions are configured via UI on GitHub

export const CURRENT_REQUESTED_PERMISSIONS: Permissions = {
  issues: "read",
  contents: "read",
  metadata: "read",
  discussions: "read",
  pull_requests: "read",
} as const;
