import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@": fileURLToPath(new URL(".", import.meta.url)) } },
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    include: ["{lib,components}/**/*.test.{ts,tsx}"],
    coverage: {
      provider: "v8",
      include: ["lib/**", "components/**"],
      exclude: ["lib/api/schema.d.ts", "lib/api/types.ts", "lib/test/**", "**/*.test.*"],
      thresholds: { lines: 80 },
    },
  },
});
