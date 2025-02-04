import "./globals.css";

import * as Counterscale from "@counterscale/tracker";
import { QueryClientProvider } from "@tanstack/react-query";
import { createRouter, RouterProvider } from "@tanstack/react-router";
import { Loader2Icon } from "lucide-react";
import { ThemeProvider } from "next-themes";
import ReactDOM from "react-dom/client";

import { queryClient } from "@/lib/queryClient";

import { Error } from "./components/Error";
import { NotFound } from "./components/NotFound";
import { routeTree } from "./routeTree.gen";

const sstStage = import.meta.env.VITE_SST_STAGE;
// Initialize Counterscale analytics
Counterscale.init({
  siteId: `semhub-${sstStage}`,
  reporterUrl: "https://semhub-prod-counterscale.pages.dev/collect",
});

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
        <RouterProvider router={router} />
      </ThemeProvider>
    </QueryClientProvider>,
  );
}
