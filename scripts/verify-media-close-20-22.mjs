import { chromium } from "playwright";

const BASE = process.env.PHASE2B_BASE || "http://localhost:5173";
const ROUTES = [
  {
    id: "SCREEN_20",
    path: "/ux-prototype/tournament-experience/t/pick-vn-open-2026/media",
  },
  {
    id: "SCREEN_22",
    path: "/ux-prototype/tournament-experience/t/pick-vn-open-2026/complete",
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
    const metrics = await page.evaluate((id) => {
      const text = (document.body?.innerText || "").replace(/\s+/g, " ");
      const doc = document.documentElement;
      const start = [...document.querySelectorAll("button")].find((el) => el.textContent?.includes("Start presentation"));
      const pause = [...document.querySelectorAll("button")].find((el) => el.textContent?.trim() === "Pause");
      const score = document.querySelector('[data-testid="presentation-live-score"]');
      const scoreStyle = score ? getComputedStyle(score) : null;
      const complete = [...document.querySelectorAll("button")].filter((el) => el.textContent?.includes("Hoàn tất giải đấu"));
      return {
        text,
        startDisabled: start ? start.disabled : id !== "SCREEN_20",
        pauseEnabled: pause ? !pause.disabled : id !== "SCREEN_20",
        scoreNowrap: score ? scoreStyle.whiteSpace === "nowrap" && !score.textContent.includes("\n") : id !== "SCREEN_20",
        has108: text.includes("108 trận còn lại"),
        has160268: text.includes("160/268") || text.includes("160 / 268"),
        completeDisabled: complete.length === 0 || complete.every((el) => el.disabled),
        innerWidth: window.innerWidth,
        scrollWidth: Math.max(doc.scrollWidth, document.body?.scrollWidth || 0),
      };
    }, route.id);
    const overflow = metrics.scrollWidth > metrics.innerWidth + 1;
    const semantic = route.id === "SCREEN_20"
      ? metrics.startDisabled && metrics.pauseEnabled && metrics.scoreNowrap
      : metrics.has108 && metrics.has160268 && metrics.completeDisabled;
    const row = {
      id: route.id,
      viewport: vp.name,
      render: response?.status() === 200 && semantic ? "PASS" : "FAIL",
      overflow: overflow ? "FAIL" : "PASS",
    };
    if (Object.values(row).includes("FAIL")) failed = true;
    report.push(row);
  }
}

await browser.close();
console.log(JSON.stringify(report, null, 2));
process.exit(failed ? 1 : 0);
