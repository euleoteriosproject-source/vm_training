import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";
export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@": path.resolve(__dirname, ".") } },
  test: {
    include: [
      "lib/**/*.test.ts",
      "components/**/*.test.tsx",
      "app/**/*.test.ts",
    ],
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    coverage: { reporter: ["text", "html"], include: ["lib/**/*.ts"] },
  },
});
