import { LogOutIcon } from "lucide-react";

import { login, logout } from "@/lib/api/auth";
import { useSession } from "@/lib/api/useSession";

import { GithubIcon } from "./icons/GithubIcon";
import { Button } from "./ui/button";

export function SignInButton() {
  const { isAuthenticated, isLoading } = useSession();
  console.log({ isAuthenticated, isLoading });

  const handleLogin = async () => {
    try {
      const redirectUrl = await login();
      window.location.href = redirectUrl;
    } catch (error) {
      console.error("Login failed:", error);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  if (isLoading) {
    return (
      <Button variant="outline" disabled>
        Loading...
      </Button>
    );
  }

  return (
    <>
      {!isAuthenticated ? (
        <Button variant="outline" onClick={handleLogin} className="gap-2">
          <GithubIcon className="size-4" />
          Sign in
        </Button>
      ) : (
        <Button variant="ghost" onClick={handleLogout} className="gap-2">
          <LogOutIcon className="size-4" />
          Sign out
        </Button>
      )}
    </>
  );
}
