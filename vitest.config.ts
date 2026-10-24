import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    include: ["src/**/*.test.{ts,tsx}", "test/**/*.test.ts"],
    exclude: ["**/*.int.test.ts", "**/node_modules/**"],
    environment: "node",
  },
});
