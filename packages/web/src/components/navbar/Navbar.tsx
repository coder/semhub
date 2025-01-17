import { Link } from "@tanstack/react-router";

import { useSession } from "@/lib/hooks/useSession";
import { DarkModeToggle } from "@/components/navbar/DarkModeToggle";
import { LoginButton } from "@/components/navbar/LoginButton";
import { UserNav } from "@/components/navbar/UserNav";

export function Navbar() {
  const { isAuthenticated, user } = useSession();

  return (
    <div className="flex h-16 w-full items-center justify-between px-4">
      <div className="flex items-center gap-2">
        <Link to="/" className="flex items-center">
          <h1 className="flex items-center font-serif text-2xl dark:hidden">
            <span className="text-blue-600">Sem</span>
            <span className="text-orange-500">Hub</span>
            <span className="animate-cursor-slow text-blue-600">_</span>
          </h1>
          <h1 className="hidden items-center font-sans text-2xl dark:flex">
            <span className="font-semibold text-white">Sem</span>
            <span className="rounded-lg bg-[#F0931B] font-semibold text-black">
              Hub
            </span>
          </h1>
        </Link>
      </div>
      <nav className="flex items-center gap-4">
        {isAuthenticated ? (
          <>
            <Link
              to="/repos"
              className="rounded-md px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground"
            >
              My Repos
            </Link>
            <UserNav user={user} />
          </>
        ) : (
          <>
            <LoginButton />
            <DarkModeToggle />
          </>
        )}
      </nav>
    </div>
  );
}
