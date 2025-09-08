// vitest.config.js
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true, // This enables Jest-like globals (describe, test, expect, etc.)
  },
});
