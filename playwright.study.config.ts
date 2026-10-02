import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "study-workflows.spec.ts",
  workers: 1,
  fullyParallel: false,
  use: { baseURL: "http://127.0.0.1:3101", screenshot: "only-on-failure", trace: "retain-on-failure" },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile-chromium", use: { ...devices["Pixel 7"] } },
  ],
  webServer: [
    { command: "node --import tsx tests/fixtures/study-backend.ts", url: "http://127.0.0.1:3102/__reset", reuseExistingServer: false },
    { command: "npm run dev -- --hostname 127.0.0.1 --port 3101", url: "http://127.0.0.1:3101", reuseExistingServer: false, timeout: 120_000,
      env: { NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:3102", NEXT_PUBLIC_SUPABASE_ANON_KEY: "test-anon-key", ANTHROPIC_API_KEY: "unused-test-key" } },
  ],
});
