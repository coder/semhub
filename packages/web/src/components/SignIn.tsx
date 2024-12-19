import { LogOutIcon } from "lucide-react";

import { authClient, useSession } from "@/lib/auth-client";

import { GithubIcon } from "./icons/GithubIcon";
import { Button } from "./ui/button";

export function SignIn() {
  const { data: session, isPending } = useSession();
  const handleLogin = async () => {
    try {
      await authClient.signIn.social({
        provider: "github",
        callbackURL: "/dashboard",
      });
    } catch (error) {
      console.error("Login failed:", error);
    }
  };

  const handleLogout = async () => {
    try {
      await authClient.signOut({
        fetchOptions: {
          onSuccess: () => {
            window.location.href = "/login";
          },
        },
      });
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  if (isPending) {
    return (
      <Button variant="outline" disabled className="gap-2">
        <GithubIcon className="size-4" />
        Loading...
      </Button>
    );
  }

  return (
    <>
      {!session ? (
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
