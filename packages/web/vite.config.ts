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
            "react-core": ["react", "react-dom"],
            tanstack: [
              "@tanstack/react-router",
              "@tanstack/react-query",
              "@tanstack/react-form",
              "@tanstack/router-zod-adapter",
              "@tanstack/zod-form-adapter",
            ],
            "ui-components": [
              "@radix-ui/react-accordion",
              "@radix-ui/react-dialog",
              "@radix-ui/react-icons",
              "@radix-ui/react-slot",
              "@radix-ui/react-toast",
              "@radix-ui/react-tooltip",
              "lucide-react",
              "cmdk",
            ],
            styling: [
              "tailwindcss",
              "tailwind-merge",
              "tailwindcss-animate",
              "class-variance-authority",
              "clsx",
            ],
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
