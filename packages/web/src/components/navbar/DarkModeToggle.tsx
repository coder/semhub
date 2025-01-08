import { useThemeToggle } from "@/lib/hooks/useThemeToggle";
import { Button } from "@/components/ui/button";

export function DarkModeToggle() {
  const { ThemeIcon, handleThemeChange } = useThemeToggle();

  return (
    <Button variant="ghost" size="icon" onClick={handleThemeChange}>
      <ThemeIcon className="size-[1.2rem] animate-in fade-in" />
      <span className="sr-only">Toggle theme</span>
    </Button>
  );
}
