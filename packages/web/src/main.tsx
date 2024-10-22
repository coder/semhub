import "./globals.css";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createRouter, RouterProvider } from "@tanstack/react-router";
import { Loader2Icon } from "lucide-react";
import { ThemeProvider } from "next-themes";
import ReactDOM from "react-dom/client";

import { Layout } from "@/components/Layout";

import { Error } from "./components/Error";
import { NotFound } from "./components/NotFound";
import { routeTree } from "./routeTree.gen";

const queryClient = new QueryClient();
const router = createRouter({
  routeTree,
  defaultPreload: "intent",
  defaultPreloadStaleTime: 0, // use react query to manage stale time instead of router
  context: { queryClient },
  defaultPendingComponent: () => (
    <div className="mx-auto mt-8 flex flex-col items-center justify-center">
      <Loader2Icon className="animate-spin" />
      <p className="mt-2 text-sm text-muted-foreground">Loading...</p>
    </div>
  ),
  defaultNotFoundComponent: () => <NotFound />,
  defaultErrorComponent: ({ error }) => <Error error={error} />,
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

const rootElement = document.getElementById("app")!;

if (!rootElement.innerHTML) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        <Layout>
          <RouterProvider router={router} />
        </Layout>
      </ThemeProvider>
    </QueryClientProvider>,
  );
}
