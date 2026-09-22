import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  vite: {
    server: {
      proxy: {
        "/api": {
          target: "http://localhost:8000",
          changeOrigin: true,
        },
      },
      allowedHosts: ["corny-marxism-headed.ngrok-free.dev"],
    },
  },

  tanstackStart: {
    server: { entry: "server" },
  },
});