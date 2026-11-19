import { fileURLToPath } from "node:url";
import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  return {
    test: {
      environment: "node",
      include: ["tests/unit/**/*.test.ts", "tests/integration/**/*.test.ts"],
      exclude: ["tests/e2e/**"],
      clearMocks: true,
      env,
      setupFiles: ["./tests/setup.ts"],
    },
    resolve: {
      alias: {
        "@": fileURLToPath(new URL(".", import.meta.url)),
      },
    },
  };
});
