import { MonitorCogIcon, MoonIcon, SunIcon } from "lucide-react";
import { useTheme } from "next-themes";
import { useCallback } from "react";

import { Button } from "@/components/ui/button";

export function DarkModeToggle() {
  const { theme, setTheme } = useTheme();

  const handleThemeChange = useCallback(() => {
    const nextTheme =
      theme === "system" ? "light" : theme === "light" ? "dark" : "system";
    setTheme(nextTheme);
  }, [theme, setTheme]);

  return (
    <Button variant="ghost" size="icon" onClick={handleThemeChange}>
      {theme === "light" && (
        <SunIcon className="size-[1.2rem] animate-in fade-in" />
      )}
      {theme === "dark" && (
        <MoonIcon className="size-[1.2rem] animate-in fade-in" />
      )}
      {theme === "system" && (
        <MonitorCogIcon className="size-[1.2rem] animate-in fade-in" />
      )}
      <span className="sr-only">Toggle theme</span>
    </Button>
  );
}
