import { DarkModeToggle } from "./DarkModeToggle";

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="sticky top-0 z-40 w-full bg-background">
        <div className="container flex h-16 items-center justify-end">
          <nav>
            <DarkModeToggle />
          </nav>
        </div>
      </header>
      <main className="flex grow items-center justify-center">
        <div className="container mx-auto py-6">{children}</div>
      </main>
    </div>
  );
}
