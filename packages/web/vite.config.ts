import fs from "fs";
import path from "path";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// https://vitejs.dev/config/
export default defineConfig(() => {
  return {
    plugins: [TanStackRouterVite({}), react()],
    resolve: {
      alias: {
        "@/core": path.resolve(__dirname, "../core/src"),
        "@/workers": path.resolve(__dirname, "../workers/src"),
        "@": path.resolve(__dirname, "./src"),
      },
    },
    build: {
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
