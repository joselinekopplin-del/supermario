import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests",
  testMatch: "**/*.spec.ts",
  timeout: 45000,
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:5173",
    headless: true,
    channel: process.env.PW_CHANNEL,
    viewport: { width: 1440, height: 1000 },
    screenshot: "only-on-failure",
  },
  reporter: [["list"], ["html", { open: "never" }]],
  webServer: {
    command: "node node_modules/vite/bin/vite.js --host 127.0.0.1",
    url: "http://127.0.0.1:5173",
    reuseExistingServer: true,
  },
});
