import { MonitorCogIcon, MoonIcon, SunIcon } from "lucide-react";

import { useThemeToggle } from "@/lib/hooks/useThemeToggle";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface DarkModeToggleProps {
  onToggleCountChange: () => void;
}

export function DarkModeToggle({ onToggleCountChange }: DarkModeToggleProps) {
  const { ThemeIcon, handleThemeChange } = useThemeToggle();

  const setThemeAndNotify = (newTheme: string) => {
    onToggleCountChange();
    handleThemeChange(newTheme);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon">
          <ThemeIcon className="size-[1.2rem] animate-in fade-in" />
          <span className="sr-only">Toggle theme</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => setThemeAndNotify("light")}>
          <SunIcon className="mr-2 size-4" />
          <span>Light</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setThemeAndNotify("dark")}>
          <MoonIcon className="mr-2 size-4" />
          <span>Dark</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setThemeAndNotify("system")}>
          <MonitorCogIcon className="mr-2 size-4" />
          <span>System</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
