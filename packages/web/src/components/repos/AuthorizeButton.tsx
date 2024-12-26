import { authorizePrivateRepos } from "@/lib/api/authz";

import { Button } from "../ui/button";

export function AuthorizeButton() {
  const handleAuthorize = async () => {
    try {
      await authorizePrivateRepos();
    } catch (error) {
      console.error("Private repo authorization failed:", error);
    }
  };

  return (
    <Button variant="authorize" onClick={handleAuthorize}>
      Authorize
    </Button>
  );
}
