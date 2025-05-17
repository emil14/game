import { defineConfig } from "vite";

export default defineConfig({
  server: {
    port: 3000, // You can choose any port
  },
  build: {
    target: "esnext", // Target latest JS features, minimal transpilation
    chunkSizeWarningLimit: 1000, // Babylon.js can be large, adjust warning limit
  },
});
