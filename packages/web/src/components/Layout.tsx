import { DarkModeToggle } from "./DarkModeToggle";
import { SignInButton } from "./SignInButton";

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="w-full bg-background/80">
        <div className="flex h-16 w-full items-center justify-between px-4">
          <div className="flex items-center gap-2">
            {/* Left side content can go here */}
          </div>
          <nav className="flex items-center gap-4">
            <SignInButton />
            <DarkModeToggle />
          </nav>
        </div>
      </header>
      <main className="flex-1">
        <div className="py-6">{children}</div>
      </main>
    </div>
  );
}
