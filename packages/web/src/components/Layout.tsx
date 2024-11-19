import { DarkModeToggle } from "./DarkModeToggle";

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="backdrop-blur-s sticky top-0 z-40 w-full bg-background/80">
        <div className="flex h-16 w-full items-center justify-end px-4">
          <nav>
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
