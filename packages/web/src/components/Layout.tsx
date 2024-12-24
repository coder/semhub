import { Navbar } from "./Navbar";

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="w-full bg-background/80">
        <Navbar />
      </header>
      <main className="flex-1">
        <div className="py-6">{children}</div>
      </main>
    </div>
  );
}
