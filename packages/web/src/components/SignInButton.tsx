import { LogOutIcon } from "lucide-react";
import { useEffect, useState } from "react";

import { isAuthenticated, login, logout } from "@/lib/api";

import { GithubIcon } from "./icons/GithubIcon";
import { Button } from "./ui/button";

export function SignInButton() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    // Check auth status on mount
    isAuthenticated().then(setIsLoggedIn);
  }, []);

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
      setIsLoggedIn(false);
    } catch (error) {
      console.error("Logout failed:", error);
    }
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
