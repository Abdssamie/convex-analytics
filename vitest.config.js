import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "edge-runtime",
    exclude: [
      "**/node_modules/**",
      "**/dist/**",
      "rybbit/**",
      "perf/playwright/**",
    ],
    typecheck: {
      tsconfig: "./tsconfig.test.json",
    },
  },
});
