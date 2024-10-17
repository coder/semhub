import path from "path";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";

import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

// https://vitejs.dev/config/
export default defineConfig(({ command, mode }) => {
  // Load env file based on `mode` in the current working directory.
  // Set the third parameter to '' to load all env regardless of the `VITE_` prefix.
  const env = loadEnv(mode, process.cwd(), "");

  return {
    plugins: [TanStackRouterVite({}), react()],
    resolve: {
      alias: {
        "@/core": path.resolve(__dirname, "../core"),
        "@": path.resolve(__dirname, "./src"),
      },
    },
    server: {
      proxy: {
        "/api": {
          target: `${env.VITE_API_URL}/api`,
          changeOrigin: true,
        },
      },
    },
  };
});
