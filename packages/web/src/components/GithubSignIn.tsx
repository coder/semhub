import { LogOutIcon } from "lucide-react";
import { useEffect, useState } from "react";

import {
  authClient,
  handleCallback,
  isAuthenticated,
  logout,
} from "@/lib/auth";

import { GithubIcon } from "./icons/GithubIcon";
import { Button } from "./ui/button";

export function GithubSignIn() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    // Check if we're handling a callback
    if (location.search.includes("code=")) {
      handleCallback().then((success) => {
        if (success) {
          setIsLoggedIn(true);
        }
      });
    } else {
      setIsLoggedIn(isAuthenticated());
    }
  }, []);

  const handleLogin = async () => {
    const { challenge, url } = await authClient.authorize(
      location.origin,
      "code",
      {
        pkce: true,
        provider: "github",
      },
    );
    sessionStorage.setItem("challenge", JSON.stringify(challenge));
    location.href = url;
  };

  const handleLogout = () => {
    logout();
    setIsLoggedIn(false);
  };

  return (
    <>
      {!isLoggedIn ? (
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
