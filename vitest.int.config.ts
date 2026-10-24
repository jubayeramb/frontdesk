import { defineConfig } from "vitest/config";

// Integration tests share one Postgres, so files run one at a time.
export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    include: ["src/**/*.int.test.ts", "test/**/*.int.test.ts"],
    environment: "node",
    globalSetup: ["test/int/global-setup.ts"],
    fileParallelism: false,
  },
});
