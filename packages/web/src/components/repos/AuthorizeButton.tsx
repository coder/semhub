import { Settings2Icon } from "lucide-react";

import { authorizePrivateRepos } from "@/lib/api/authz";

import { Button } from "../ui/button";

export function AuthorizeButton({
  hasValidInstallation,
}: {
  hasValidInstallation: boolean;
}) {
  const handleAuthorize = async () => {
    try {
      await authorizePrivateRepos();
    } catch (error) {
      console.error("Private repo authorization failed:", error);
    }
  };
  return hasValidInstallation ? (
    <Button variant="secondary" onClick={handleAuthorize}>
      <Settings2Icon className="mr-2 size-4" />
      Configure
    </Button>
  ) : (
    <Button variant="authorize" onClick={handleAuthorize}>
      Authorize
    </Button>
  );
}
