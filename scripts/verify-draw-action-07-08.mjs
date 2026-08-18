import { chromium } from "playwright";

const BASE = process.env.PHASE2B_BASE || "http://localhost:5173";
const ROUTES = [
  {
    id: "SCREEN_07",
    path: "/ux-prototype/tournament-experience/t/pick-vn-open-2026/pair-draw",
    helper: "Còn 24 cặp chưa bốc",
    lock: "Khóa kết quả bốc thăm",
    next: "Sang bốc thăm chia bảng",
  },
  {
    id: "SCREEN_08",
    path: "/ux-prototype/tournament-experience/t/pick-vn-open-2026/group-draw",
    helper: "Còn 14 cặp chưa chia bảng",
    lock: "Khóa kết quả bốc thăm",
    next: "Sang vòng bảng",
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
    const metrics = await page.evaluate((spec) => {
      const text = (document.body?.innerText || "").replace(/\s+/g, " ");
      const doc = document.documentElement;
      const lockButtons = [...document.querySelectorAll("button")].filter((el) => el.textContent?.includes(spec.lock));
      const nextButtons = [...document.querySelectorAll("button")].filter((el) => el.textContent?.includes(spec.next));
      const nextLinks = [...document.querySelectorAll("a")].filter((el) => el.textContent?.includes(spec.next));
      return {
        hasHelper: text.includes(spec.helper),
        hasLegacyLock: text.includes("Lock kết quả bốc thăm"),
        lockDisabled: lockButtons.length > 0 && lockButtons.every((el) => el.disabled),
        nextDisabled: nextButtons.length > 0 && nextButtons.every((el) => el.disabled) && nextLinks.length === 0,
        innerWidth: window.innerWidth,
        scrollWidth: Math.max(doc.scrollWidth, document.body?.scrollWidth || 0),
      };
    }, route);
    const overflow = metrics.scrollWidth > metrics.innerWidth + 1;
    const row = {
      id: route.id,
      viewport: vp.name,
      render: response?.status() === 200 ? "PASS" : "FAIL",
      helper: metrics.hasHelper ? "PASS" : "FAIL",
      lockDisabled: metrics.lockDisabled && !metrics.hasLegacyLock ? "PASS" : "FAIL",
      nextDisabled: metrics.nextDisabled ? "PASS" : "FAIL",
      overflow: overflow ? "FAIL" : "PASS",
    };
    if (Object.values(row).includes("FAIL")) failed = true;
    report.push(row);
  }
}

await browser.close();
console.log(JSON.stringify(report, null, 2));
process.exit(failed ? 1 : 0);
