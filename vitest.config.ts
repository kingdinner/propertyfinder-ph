import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    fileParallelism: false,
    testTimeout: 20000,
    env: {
      DATABASE_URL: "postgresql://kingrowellvidal@localhost:5432/propertyfinder_ph_test",
      TEST_DATABASE_URL: "postgresql://kingrowellvidal@localhost:5432/propertyfinder_ph_test",
      AUTH_SECRET: "dev-only-change-me-propertyfinder-ph-auth-secret-32chars",
      NEXT_PUBLIC_APP_URL: "http://localhost:3456",
      NODE_ENV: "test",
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
