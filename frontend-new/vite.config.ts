import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  vite: {
    server: {
      host: "0.0.0.0",
      allowedHosts: ["corny-marxism-headed.ngrok-free.dev"],
      proxy: {
        "/api": {
          target: "http://localhost:8000",
          changeOrigin: true,
        },
      },
    },
  },

  tanstackStart: {
    server: { entry: "server" },
  },
});
