import fs from "fs";
import path from "path";
import { sentryVitePlugin } from "@sentry/vite-plugin";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig(() => {
  return {
    plugins: [
      TanStackRouterVite({}),
      react(),
      sentryVitePlugin({
        authToken: process.env.SENTRY_AUTH_TOKEN,
        org: "coder-aw",
        project:
          process.env.SST_STAGE === "prod"
            ? "semhub-web-prod"
            : "semhub-web-dev",
      }),
    ],
    resolve: {
      alias: {
        "@/core": path.resolve(__dirname, "../core/src"),
        "@/workers": path.resolve(__dirname, "../workers/src"),
        "@": path.resolve(__dirname, "./src"),
      },
    },
    build: {
      sourcemap: true,
      rollupOptions: {
        output: {
          manualChunks: {
            // Core React chunk
            "react-core": ["react", "react-dom", "react/jsx-runtime"],

            // Data management and routing
            "data-layer": [
              "@tanstack/react-query",
              "@tanstack/react-query-devtools",
              "immer",
            ],

            // Routing specific
            routing: [
              "@tanstack/react-router",
              "@tanstack/router-devtools",
              "@tanstack/router-zod-adapter",
            ],

            // Form handling
            forms: ["@tanstack/react-form", "@tanstack/zod-form-adapter"],

            // UI Framework - Radix components
            "ui-radix": [
              "@radix-ui/react-accordion",
              "@radix-ui/react-alert-dialog",
              "@radix-ui/react-avatar",
              "@radix-ui/react-dialog",
              "@radix-ui/react-dropdown-menu",
              "@radix-ui/react-icons",
              "@radix-ui/react-popover",
              "@radix-ui/react-select",
              "@radix-ui/react-slot",
              "@radix-ui/react-toast",
              "@radix-ui/react-tooltip",
            ],
            // UI Utilities
            "ui-utils": ["lucide-react", "cmdk", "next-themes", "simple-icons"],
            // Styling utilities
            styling: [
              "tailwindcss",
              "tailwind-merge",
              "tailwindcss-animate",
              "class-variance-authority",
              "clsx",
            ],
            // web analytics and monitoring
            monitoring: ["@sentry/react", "@counterscale/tracker"],
          },
        },
        onwarn(warning, warn) {
          // Suppress warnings about Node.js module externalization
          if (
            warning.code === "PLUGIN_WARNING" &&
            warning.plugin === "vite:resolve" &&
            warning.message.includes(
              "has been externalized for browser compatibility",
            )
          ) {
            return;
          }
          warn(warning);
        },
      },
    },
    server: {
      host: "local.semhub.dev",
      port: 3001,
      https: {
        key: fs.readFileSync(
          path.resolve(__dirname, "./certs/local.semhub.dev-key.pem"),
        ),
        cert: fs.readFileSync(
          path.resolve(__dirname, "./certs/local.semhub.dev.pem"),
        ),
      },
    },
  };
});
