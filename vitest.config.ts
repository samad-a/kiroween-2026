import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    exclude: ["**/node_modules/**", "**/dist/**"],
    // Server tests boot a real Colyseus server; give them headroom.
    testTimeout: 15000,
    // @colyseus/testing's boot() ignores its port argument for a Server instance
    // and always binds 2568, so server suites must not run in parallel.
    fileParallelism: false,
  },
});
