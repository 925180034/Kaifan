import { defineConfig } from "@playwright/test";

const localhostNoProxy = ["127.0.0.1", "localhost"];
process.env.NO_PROXY = mergeNoProxy(process.env.NO_PROXY, localhostNoProxy);
process.env.no_proxy = mergeNoProxy(process.env.no_proxy, localhostNoProxy);

export default defineConfig({
  testDir: "./tests_e2e",
  timeout: 45000,
  expect: {
    timeout: 10000
  },
  reporter: process.env.CI
    ? [["list"], ["html", { open: "never" }]]
    : "list",
  use: {
    baseURL: "http://127.0.0.1:6053",
    screenshot: "only-on-failure",
    trace: "retain-on-failure"
  },
  webServer: {
    command: "npm run dev",
    url: "http://127.0.0.1:6053/",
    reuseExistingServer: true,
    timeout: 45000
  },
  projects: [
    {
      name: "chrome-mobile",
      use: {
        channel: "chrome",
        viewport: { width: 390, height: 900 }
      }
    }
  ]
});

function mergeNoProxy(current, additions) {
  const values = new Set(
    String(current ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean)
  );
  additions.forEach((value) => values.add(value));
  return [...values].join(",");
}
