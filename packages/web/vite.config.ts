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
