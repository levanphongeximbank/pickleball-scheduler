/** Playwright config for V5-B.2 browser E2E (optional — main runner is verify-v5b2-browser-e2e-staging.mjs). */
export default {
  testDir: ".",
  timeout: 300_000,
  use: {
    headless: String(process.env.HEADLESS ?? "true").toLowerCase() !== "false",
    viewport: { width: 1280, height: 900 },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
};
