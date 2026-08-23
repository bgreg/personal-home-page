import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    channel: "chrome",
    baseURL: "http://127.0.0.1:8123",
    viewport: { width: 1600, height: 900 }
  },
  webServer: {
    command: "python3 -m http.server 8123",
    url: "http://127.0.0.1:8123/index.html",
    reuseExistingServer: true,
    timeout: 20_000
  }
});
