import { DarkModeToggle } from "./DarkModeToggle";

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <header className="sticky top-0 z-40 w-full bg-background">
        <div className="container flex h-16 items-center justify-end">
          <nav>
            <DarkModeToggle />
          </nav>
        </div>
      </header>
      <main className="flex-grow flex items-center justify-center">
        <div className="container mx-auto py-6">{children}</div>
      </main>
    </div>
  );
}
