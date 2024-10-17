import path from "path";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// https://vitejs.dev/config/
export default defineConfig(({ command }) => ({
  plugins: [TanStackRouterVite({}), react()],
  resolve: {
    alias: {
      "@/core": path.resolve(__dirname, "../core"),
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server:
    command === "serve"
      ? {
          proxy: {
            "/api": {
              target: `${import.meta.env.VITE_API_URL}/api`,
              changeOrigin: true,
            },
          },
        }
      : undefined,
}));
