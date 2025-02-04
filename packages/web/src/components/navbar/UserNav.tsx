import { LogOutIcon } from "lucide-react";

import { logout } from "@/lib/api/auth";
import { useThemeToggle } from "@/lib/hooks/useThemeToggle";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { User } from "@/workers/auth/subjects";

export function UserNav({ user }: { user: User }) {
  const { ThemeIcon, themeText, handleThemeChange } = useThemeToggle();

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

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
        <div className="flex flex-col gap-1 p-2">
          <Button
            variant="ghost"
            onClick={() => handleThemeChange()}
            className="w-full justify-start gap-2 pl-2 text-muted-foreground hover:text-foreground"
          >
            <ThemeIcon className="size-4" />
            {themeText}
          </Button>
          <Button
            variant="ghost"
            onClick={handleLogout}
            className="w-full justify-start gap-2 pl-2 text-muted-foreground hover:text-foreground"
          >
            <LogOutIcon className="size-4" />
            Sign Out
          </Button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
