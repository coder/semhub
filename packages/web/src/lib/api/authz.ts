const githubAppName = import.meta.env.VITE_GITHUB_APP_NAME;

if (!githubAppName) {
  throw new Error("VITE_GITHUB_APP_NAME is not set");
}

export const authorizePrivateRepos = async () => {
  // TODO: add redirect url in state
  const url = `https://github.com/apps/${githubAppName}/installations/new`;
  window.open(url, "_blank");
};
