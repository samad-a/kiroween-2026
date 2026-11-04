import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    exclude: ["**/node_modules/**", "**/dist/**"],
    // Server tests boot a real Colyseus server; give them headroom.
    testTimeout: 15000,
  },
});
