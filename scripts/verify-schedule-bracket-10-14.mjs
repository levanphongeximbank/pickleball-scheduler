import { chromium } from "playwright";

const BASE = process.env.PHASE2B_BASE || "http://localhost:5173";
const ROUTES = [
  {
    id: "SCREEN_10",
    path: "/ux-prototype/tournament-experience/t/pick-vn-open-2026/schedule",
    check: (text) =>
      text.includes("Còn 2 trận chưa xếp") &&
      text.includes("Còn 3 xung đột") &&
      !text.includes("Unscheduled = 0") &&
      !text.includes("Conflicts resolved"),
  },
  {
    id: "SCREEN_14",
    path: "/ux-prototype/tournament-experience/t/pick-vn-open-2026/bracket",
    check: (text, hasConnector, width) =>
      width <= 430
        ? text.includes("R32") && text.includes("Thắng")
        : text.includes("R32-1") && text.includes("R16-1") && text.includes("VÔ ĐỊCH") && hasConnector,
  },
];
const VIEWPORTS = [
  { name: "MOBILE_390", width: 390, height: 844 },
  { name: "DESKTOP_1440", width: 1440, height: 900 },
];

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const report = [];
let failed = false;

for (const route of ROUTES) {
  for (const vp of VIEWPORTS) {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    const response = await page.goto(`${BASE}${route.path}`, { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForTimeout(400);
    const metrics = await page.evaluate(() => {
      const text = (document.body?.innerText || "").replace(/\s+/g, " ");
      const doc = document.documentElement;
      const connector = document.querySelector('[data-testid="bracket-connector-R32-1-R32-2-R16-1"]');
      const publish = [...document.querySelectorAll("button")].filter((el) => el.textContent?.includes("Công bố lịch"));
      return {
        text,
        hasConnector: Boolean(connector),
        publishDisabled: publish.length === 0 || publish.every((el) => el.disabled),
        innerWidth: window.innerWidth,
        scrollWidth: Math.max(doc.scrollWidth, document.body?.scrollWidth || 0),
      };
    });
    const overflow = metrics.scrollWidth > metrics.innerWidth + 1;
    const semantic = route.check(metrics.text, metrics.hasConnector, vp.width);
    const row = {
      id: route.id,
      viewport: vp.name,
      render: response?.status() === 200 && semantic ? "PASS" : "FAIL",
      publish: route.id !== "SCREEN_10" || metrics.publishDisabled ? "PASS" : "FAIL",
      overflow: overflow ? "FAIL" : "PASS",
    };
    if (Object.values(row).includes("FAIL")) failed = true;
    report.push(row);
  }
}

await browser.close();
console.log(JSON.stringify(report, null, 2));
process.exit(failed ? 1 : 0);
