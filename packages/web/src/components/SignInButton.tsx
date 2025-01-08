import { LogOutIcon } from "lucide-react";

import { login, logout } from "@/lib/api/auth";
import { useSession } from "@/lib/hooks/useSession";

import { GithubIcon } from "./icons/GithubIcon";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { Button } from "./ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";

export function SignInButton() {
  const session = useSession();

  const handleLogin = async () => {
    try {
      await login();
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

  if (!session.isAuthenticated) {
    return (
      <Button variant="outline" onClick={handleLogin} className="gap-2">
        <GithubIcon className="size-4" />
        Sign in
      </Button>
    );
  }

  const { user } = session;
  const initials = user.name
    ? user.name.slice(0, 2).toUpperCase()
    : user.email.slice(0, 2).toUpperCase();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative size-8 rounded-full">
          <Avatar className="size-8">
            <AvatarImage src={user.avatarUrl} alt={user.name || user.email} />
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end" forceMount>
        <DropdownMenuLabel className="p-0">
          <div className="flex items-center gap-2 p-2">
            <Avatar className="size-9">
              <AvatarImage src={user.avatarUrl} alt={user.name || user.email} />
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
            <div className="flex flex-col">
              {user.name ? (
                <p className="text-sm leading-none">{user.name}</p>
              ) : null}
              <p className="mt-1 text-xs font-normal leading-none text-muted-foreground">
                {user.email}
              </p>
            </div>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <div className="p-2">
          <Button
            variant="ghost"
            onClick={handleLogout}
            className="w-full justify-start gap-2 pl-2 text-muted-foreground hover:text-foreground"
          >
            <LogOutIcon className="size-4" />
            Sign out
          </Button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
