import { MonitorCogIcon, MoonIcon, SunIcon } from "lucide-react";
import { useTheme } from "next-themes";
import { useCallback, useEffect, useRef } from "react";

import { useAudio } from "@/hooks/useAudio";
import { Button } from "@/components/ui/button";

export function DarkModeToggle() {
  const { theme, setTheme, systemTheme } = useTheme();
  const audio = useAudio("/sounds/dark-mode.mp3");
  const prevThemeRef = useRef(theme);
  const prevSystemThemeRef = useRef(systemTheme);

  useEffect(() => {
    const wasInDarkMode =
      prevThemeRef.current === "dark" ||
      (prevThemeRef.current === "system" &&
        prevSystemThemeRef.current === "dark");
    const isInDarkMode =
      theme === "dark" || (theme === "system" && systemTheme === "dark");

    if (!wasInDarkMode && isInDarkMode) {
      audio.play().catch(console.error);
    }

    prevThemeRef.current = theme;
    prevSystemThemeRef.current = systemTheme;
  }, [theme, systemTheme, audio]);

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
