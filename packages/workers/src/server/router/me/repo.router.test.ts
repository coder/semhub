// Mock data for development
export const MOCK_REPOS = [
  {
    id: "1",
    ownerName: "facebook",
    name: "react",
    ownerAvatarUrl: "https://avatars.githubusercontent.com/u/69631?v=4",
    htmlUrl: "https://github.com/facebook/react",
    isPrivate: false,
    initStatus: "completed",
    syncStatus: "ready",
    lastSyncedAt: new Date("2024-01-22T10:00:00Z"), // recent
    issueLastUpdatedAt: new Date("2024-01-22T22:00:00Z"), // more recent
    repoSubscribedAt: new Date("2024-01-20T08:00:00Z"),
  },
  {
    id: "2",
    ownerName: "vercel",
    name: "next.js",
    ownerAvatarUrl: "https://avatars.githubusercontent.com/u/14985020?v=4",
    htmlUrl: "https://github.com/vercel/next.js",
    isPrivate: true,
    initStatus: "error",
    syncStatus: "error",
    lastSyncedAt: new Date("2024-01-20T15:30:00Z"), // few days ago
    issueLastUpdatedAt: new Date("2024-01-19T12:00:00Z"), // older
    repoSubscribedAt: new Date("2024-01-18T14:30:00Z"),
  },
  {
    id: "3",
    ownerName: "microsoft",
    name: "typescript",
    ownerAvatarUrl: "https://avatars.githubusercontent.com/u/6154722?v=4",
    htmlUrl: "https://github.com/microsoft/typescript",
    isPrivate: false,
    initStatus: "in_progress",
    syncStatus: "ready",
    lastSyncedAt: null,
    issueLastUpdatedAt: null,
    repoSubscribedAt: new Date("2024-01-21T16:45:00Z"),
  },
  {
    id: "4",
    ownerName: "opensearch",
    name: "opensearch",
    ownerAvatarUrl: "https://avatars.githubusercontent.com/u/78443756?v=4",
    htmlUrl: "https://github.com/opensearch/opensearch",
    isPrivate: true,
    initStatus: "ready",
    syncStatus: "ready",
    lastSyncedAt: null,
    issueLastUpdatedAt: null,
    repoSubscribedAt: new Date("2024-01-22T09:15:00Z"),
  },
  {
    id: "5",
    ownerName: "google",
    name: "golang",
    ownerAvatarUrl: "https://avatars.githubusercontent.com/u/1342004?v=4",
    htmlUrl: "https://github.com/google/golang",
    isPrivate: false,
    initStatus: "completed",
    syncStatus: "error",
    lastSyncedAt: new Date("2024-01-21T23:59:59Z"),
    issueLastUpdatedAt: new Date("2024-01-21T18:30:00Z"),
    repoSubscribedAt: new Date("2024-01-19T11:20:00Z"),
  },
  {
    id: "6",
    ownerName: "rust-lang",
    name: "rust",
    ownerAvatarUrl: "https://avatars.githubusercontent.com/u/5430905?v=4",
    htmlUrl: "https://github.com/rust-lang/rust",
    isPrivate: false,
    initStatus: "completed",
    syncStatus: "in_progress",
    lastSyncedAt: new Date("2024-01-22T11:30:00Z"),
    issueLastUpdatedAt: new Date("2024-01-22T11:25:00Z"),
    repoSubscribedAt: new Date("2024-01-20T13:40:00Z"),
  },
  {
    id: "7",
    ownerName: "denoland",
    name: "deno",
    ownerAvatarUrl: "https://avatars.githubusercontent.com/u/42048915?v=4",
    htmlUrl: "https://github.com/denoland/deno",
    isPrivate: false,
    initStatus: "completed",
    syncStatus: "queued",
    lastSyncedAt: new Date("2024-01-22T11:45:00Z"),
    issueLastUpdatedAt: new Date("2024-01-22T11:40:00Z"),
    repoSubscribedAt: new Date("2024-01-21T15:10:00Z"),
  },
];
