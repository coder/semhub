import { LogOutIcon } from "lucide-react";
import { useEffect, useState } from "react";

import {
  authClient,
  handleCallback,
  isAuthenticated,
  logout,
} from "@/lib/auth";
import { githubLogin } from "@/workers/auth/auth.constant";

import { GithubIcon } from "./icons/GithubIcon";
import { Button } from "./ui/button";

export function SignInButton() {
  const [isLoggedIn, setIsLoggedIn] = useState(() => {
    return localStorage.getItem("isLoggedIn") === "true";
  });

  useEffect(() => {
    // Check if we're handling a callback
    if (location.search.includes("code=")) {
      handleCallback().then((success) => {
        if (success) {
          setIsLoggedIn(true);
          localStorage.setItem("isLoggedIn", "true");
        }
      });
    } else {
      const authStatus = isAuthenticated();
      setIsLoggedIn(authStatus);
      localStorage.setItem("isLoggedIn", authStatus.toString());
    }
  }, []);

  const handleLogin = async () => {
    const { challenge, url } = await authClient.authorize(
      location.origin,
      "code",
      {
        pkce: true,
        provider: githubLogin.provider,
      },
    );
    sessionStorage.setItem("challenge", JSON.stringify(challenge));
    location.href = url;
  };

  const handleLogout = () => {
    logout();
    setIsLoggedIn(false);
    localStorage.setItem("isLoggedIn", "false");
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
