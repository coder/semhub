import { login } from "@/lib/api/auth";

import { GithubIcon } from "./icons/GithubIcon";
import { Button } from "./ui/button";

export function LoginButton() {
  const handleLogin = async () => {
    try {
      await login();
    } catch (error) {
      console.error("Login failed:", error);
    }
  };

  return (
    <Button variant="outline" onClick={handleLogin} className="gap-2">
      <GithubIcon className="size-4" />
      Sign in
    </Button>
  );
}
