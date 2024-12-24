import { Link } from "@tanstack/react-router";

import { useSession } from "../lib/hooks/useSession";
import { DarkModeToggle } from "./DarkModeToggle";
import { SignInButton } from "./SignInButton";

export function Navbar() {
  const { isAuthenticated } = useSession();

  return (
    <div className="flex h-16 w-full items-center justify-between px-4">
      <div className="flex items-center gap-2">
        <Link to="/" className="text-lg font-semibold">
          SemHub
        </Link>
      </div>
      <nav className="flex items-center gap-4">
        {isAuthenticated && (
          <Link
            to="/repos"
            className="rounded-md px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground"
          >
            My Repos
          </Link>
        )}
        <SignInButton />
        <DarkModeToggle />
      </nav>
    </div>
  );
}
