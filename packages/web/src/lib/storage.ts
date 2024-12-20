const STORAGE_KEYS = {
  AUTH_STATUS: "auth_status",
} as const;

export const storage = {
  getAuthStatus: () =>
    localStorage.getItem(STORAGE_KEYS.AUTH_STATUS) === "true",
  setAuthStatus: (status: boolean) =>
    localStorage.setItem(STORAGE_KEYS.AUTH_STATUS, String(status)),
  clearAuthStatus: () => localStorage.removeItem(STORAGE_KEYS.AUTH_STATUS),
};
