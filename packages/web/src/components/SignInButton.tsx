import { LogOutIcon } from "lucide-react";
import { useState } from "react";

import { login, logout } from "@/lib/api/auth";

import { GithubIcon } from "./icons/GithubIcon";
import { Button } from "./ui/button";

export function SignInButton() {
  const [isLoggedIn, setIsLoggedIn] = useState(() => {
    return localStorage.getItem("isLoggedIn") === "true";
  });

  const handleLogin = async () => {
    try {
      const redirectUrl = await login();
      localStorage.setItem("isLoggedIn", "true");
      setIsLoggedIn(true);
      window.location.href = redirectUrl;
    } catch (error) {
      console.error("Login failed:", error);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      localStorage.setItem("isLoggedIn", "false");
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
