import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/unit/**/*.spec.ts"],
    environment: "node",
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      reportsDirectory: "coverage/unit",
      include: [
        "src/shared/domain/**/*.ts",
        "src/shared/ipc/validators.ts",
        "src/shared/council-runtime-conductor.ts",
        "src/shared/council-runtime-context-window.ts",
        "src/shared/council-view-runtime-guards.ts",
      ],
      thresholds: {
        lines: 90,
        functions: 90,
        statements: 90,
        branches: 80,
      },
    },
  },
});
