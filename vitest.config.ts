import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

// The real `obsidian` module is injected by the app at runtime and is not
// resolvable in a test process, so we alias it to a hand-written stub that
// provides minimal runtime stand-ins for the classes/functions we import.
export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["test/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      // UI shells are thin wrappers over Obsidian base classes whose behaviour
      // lives in extracted pure functions tested elsewhere. Asserting against a
      // mock of Obsidian's DOM helpers would test the mock, not our code.
      exclude: ["src/main.ts", "src/*-modal.ts", "src/settings.ts"],
      thresholds: {
        statements: 100,
        branches: 100,
        functions: 100,
        lines: 100,
      },
    },
  },
  resolve: {
    alias: {
      obsidian: resolve(__dirname, "test/obsidian-stub.ts"),
    },
  },
});
