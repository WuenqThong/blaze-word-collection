import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    include: ["tests/**/*.test.{ts,tsx}"],
    setupFiles: ["./tests/setup.ts"],
    testTimeout: 20000,
    hookTimeout: 20000,
    // Existing demo flow tests exercise the IndexedDB-only mode; server sync has its own tests.
    env: { VITE_DEMO_SERVER: "off" },
  },
});
