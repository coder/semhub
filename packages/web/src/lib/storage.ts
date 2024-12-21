const STORAGE_KEYS = {
  AUTH_STATUS: "auth_status",
  USER_DATA: "user_data",
} as const;

// todo: inherit typing
type UserData = {
  id: string;
  email: string;
};

export const storage = {
  getAuthStatus: () =>
    localStorage.getItem(STORAGE_KEYS.AUTH_STATUS) === "true",
  setAuthStatus: (status: boolean) =>
    localStorage.setItem(STORAGE_KEYS.AUTH_STATUS, String(status)),
  clearAuthStatus: () => localStorage.removeItem(STORAGE_KEYS.AUTH_STATUS),

  getUserData: () => {
    const data = localStorage.getItem(STORAGE_KEYS.USER_DATA);
    // TODO: proper parsing?
    return data ? (JSON.parse(data) as UserData) : null;
  },
  setUserData: (userData: UserData) =>
    localStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(userData)),
  clearUserData: () => localStorage.removeItem(STORAGE_KEYS.USER_DATA),
};
