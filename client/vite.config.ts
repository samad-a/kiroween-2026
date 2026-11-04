import { defineConfig } from "vite";

export default defineConfig({
  server: { port: 5173, host: true },
  build: { chunkSizeWarningLimit: 2000 }, // Phaser is ~1.5 MB on its own
});
