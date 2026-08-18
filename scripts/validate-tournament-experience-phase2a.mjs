/**
 * Phase 2A viewport check — prototype routes only. No production writes.
 */
import { chromium } from "playwright";

const BASE = process.env.PHASE2A_BASE || "http://localhost:5173";
const PATHS = [
  "/ux-prototype/tournament-experience",
  "/ux-prototype/tournament-experience/t/pick-vn-open-2026",
  "/ux-prototype/tournament-experience/t/pick-vn-open-2026/registration",
];
const VIEWPORTS = [
  { name: "MOBILE_360", width: 360, height: 800 },
  { name: "MOBILE_390", width: 390, height: 844 },
  { name: "MOBILE_430", width: 430, height: 932 },
  { name: "TABLET_768", width: 768, height: 1024 },
  { name: "TABLET_1024", width: 1024, height: 768 },
  { name: "DESKTOP_1440", width: 1440, height: 900 },
  { name: "DESKTOP_1920", width: 1920, height: 1080 },
];

const results = [];
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

for (const path of PATHS) {
  for (const vp of VIEWPORTS) {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    const response = await page.goto(`${BASE}${path}`, { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForTimeout(400);
    const metrics = await page.evaluate(() => {
      const doc = document.documentElement;
      return {
        title: document.body?.innerText?.slice(0, 80) || "",
        innerWidth: window.innerWidth,
        scrollWidth: Math.max(doc.scrollWidth, document.body?.scrollWidth || 0),
      };
    });
    const overflow = metrics.scrollWidth > metrics.innerWidth + 1;
    results.push({
      path,
      viewport: vp.name,
      status: response?.status() || 0,
      overflow: overflow ? "FAIL" : "PASS",
      scrollWidth: metrics.scrollWidth,
      innerWidth: metrics.innerWidth,
    });
  }
}

await browser.close();
console.log(JSON.stringify(results, null, 2));
const failed = results.filter((row) => row.overflow === "FAIL" || row.status >= 400);
process.exit(failed.length ? 1 : 0);
