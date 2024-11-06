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
        "@semhub/core": path.resolve(__dirname, "../core/src"),
        "@/workers": path.resolve(__dirname, "../workers/src"),
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };
});
