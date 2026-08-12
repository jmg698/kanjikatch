import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    // Mirror tsconfig's "@/*" → "./src/*" so tests can import modules that
    // use the app's path alias.
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
