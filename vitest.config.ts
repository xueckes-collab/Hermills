import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    restoreMocks: true
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./apps/renderer/src", import.meta.url)),
      "@hermills/core": fileURLToPath(new URL("./packages/core/src/index.ts", import.meta.url)),
      "@hermills/runtime": fileURLToPath(new URL("./packages/runtime/src/index.ts", import.meta.url)),
      "@hermills/agent-builder": fileURLToPath(new URL("./packages/agent-builder/src/index.ts", import.meta.url))
    }
  }
});
