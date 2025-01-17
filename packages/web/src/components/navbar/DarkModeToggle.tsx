import { useThemeToggle } from "@/lib/hooks/useThemeToggle";
import { Button } from "@/components/ui/button";

interface DarkModeToggleProps {
  onToggleCountChange: () => void;
}

export function DarkModeToggle({ onToggleCountChange }: DarkModeToggleProps) {
  const { ThemeIcon, handleThemeChange } = useThemeToggle();

  const handleClick = () => {
    onToggleCountChange();
    handleThemeChange();
  };

  return (
    <Button variant="ghost" size="icon" onClick={handleClick}>
      <ThemeIcon className="size-[1.2rem] animate-in fade-in" />
      <span className="sr-only">Toggle theme</span>
    </Button>
  );
}
