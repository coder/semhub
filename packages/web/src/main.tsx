import "./globals.css";

import * as Counterscale from "@counterscale/tracker";
import * as Sentry from "@sentry/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { createRouter, RouterProvider } from "@tanstack/react-router";
import { Loader2Icon } from "lucide-react";
import { ThemeProvider } from "next-themes";
import ReactDOM from "react-dom/client";

import { client } from "@/lib/api/client";
import { queryClient } from "@/lib/queryClient";

import { Error } from "./components/Error";
import { NotFound } from "./components/NotFound";
import { routeTree } from "./routeTree.gen";

const sstStage = import.meta.env.VITE_SST_STAGE;

// for web analytics
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

console.log(client.sentry.tunnel.$url().toString());

Sentry.init({
  // TODO: separate projects/DSNs for separate stages, pass these in as env vars
  dsn: "https://bf47d2a69dccbb1f44173be530166765@o4508764596142080.ingest.us.sentry.io/4508764610494464",
  debug: true, // Enable debug mode temporarily
  environment: sstStage, // Set the environment explicitly
  tunnel: client.sentry.tunnel.$url().toString(),
  integrations: [
    Sentry.tanstackRouterBrowserTracingIntegration(router),
    // Temporarily disable replay for local testing
    // Sentry.replayIntegration(),
  ],
  // Enable all error capturing for testing
  sampleRate: 1.0,
  // Tracing
  tracesSampleRate: 1.0, //  Capture 100% of the transactions
  // Set 'tracePropagationTargets' to control for which URLs distributed tracing should be enabled
  tracePropagationTargets: [
    // Same-origin API routes
    /^\/api\//,
    // uat endpoints
    "https://api.uat.semhub.dev",
    "https://auth.uat.semhub.dev",
    // Production endpoints
    "https://api.semhub.dev",
    "https://auth.semhub.dev",
    // stg endpoints
    "https://api.stg.semhub.dev",
    "https://auth.stg.semhub.dev",
    // dev API endpoints with dynamic subdomains
    /^https:\/\/api\.[^.]+\.stg\.semhub\.dev$/, // Matches api.{anything}.stg.semhub.dev
    /^https:\/\/auth\.[^.]+\.stg\.semhub\.dev$/, // Matches auth.{anything}.stg.semhub.dev
  ],
  // Session Replay
  // TODO: lower eventually?
  replaysSessionSampleRate: 1.0, // This sets the sample rate at 10%. You may want to change it to 100% while in development and then sample at a lower rate in production.
  replaysOnErrorSampleRate: 1.0, // If you're not already sampling the entire session, change the sample rate to 100% when sampling sessions where errors occur.
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
