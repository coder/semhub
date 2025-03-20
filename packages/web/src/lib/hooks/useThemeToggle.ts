import { MonitorCogIcon, MoonIcon, SunIcon } from "lucide-react";
import { useTheme } from "next-themes";
import { useCallback } from "react";

export function useThemeToggle() {
  const { theme, setTheme } = useTheme();

  const handleThemeChange = useCallback(
    (newTheme?: string) => {
      if (newTheme) {
        setTheme(newTheme);
      } else {
        const nextTheme =
          theme === "system" ? "light" : theme === "light" ? "dark" : "system";
        setTheme(nextTheme);
      }
    },
    [theme, setTheme],
  );

  const ThemeIcon =
    theme === "light" ? SunIcon : theme === "dark" ? MoonIcon : MonitorCogIcon;

  const themeText =
    theme === "light" ? "Light" : theme === "dark" ? "Dark" : "System";

  return {
    theme,
    themeText,
    ThemeIcon,
    handleThemeChange,
  };
}
