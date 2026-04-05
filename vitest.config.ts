import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/test_*.ts"],
    // Exclude E2E tests from the default run — they require a prior build and
    // load a large ML model (~22MB download on first run, ~170s to initialise).
    // Run them explicitly: npx vitest run src/tools/__tests__/contextManagement.e2e.test.ts
    exclude: ["**/node_modules/**", "**/*.e2e.test.ts"],
  },
});
