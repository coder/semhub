import { DarkModeToggle } from "./DarkModeToggle";
import { Button } from "./ui/button";
import { authClient } from "@/lib/auth";
import { GithubIcon, LogOutIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { handleCallback, isAuthenticated, logout } from "@/lib/auth";

export function Layout({ children }: { children: React.ReactNode }) {
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
    const { challenge, url } = await authClient.authorize(location.origin, "code", {
      pkce: true,
      provider: "github",
    });
    sessionStorage.setItem("challenge", JSON.stringify(challenge));
    location.href = url;
  };

  const handleLogout = () => {
    logout();
    setIsLoggedIn(false);
  };

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="w-full bg-background/80">
        <div className="flex h-16 w-full items-center justify-between px-4">
          <div className="flex items-center gap-2">
            {!isLoggedIn ? (
              <Button
                variant="outline"
                onClick={handleLogin}
                className="gap-2"
              >
                <GithubIcon className="size-4" />
                Sign in with GitHub
              </Button>
            ) : (
              <Button
                variant="ghost"
                onClick={handleLogout}
                className="gap-2"
              >
                <LogOutIcon className="size-4" />
                Sign out
              </Button>
            )}
          </div>
          <nav className="flex items-center gap-2">
            <DarkModeToggle />
          </nav>
        </div>
      </header>
      <main className="flex-1">
        <div className="py-6">{children}</div>
      </main>
    </div>
  );
}
