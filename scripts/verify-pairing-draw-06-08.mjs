import { chromium } from "playwright";

const BASE = process.env.PHASE2B_BASE || "http://localhost:5174";
const ROUTES = [
  {
    id: "SCREEN_06",
    path: "/ux-prototype/tournament-experience/t/pick-vn-open-2026/pairs",
    mustSee: "NGỮ CẢNH HÌNH THÀNH CẶP / ĐỘI",
  },
  {
    id: "SCREEN_07",
    path: "/ux-prototype/tournament-experience/t/pick-vn-open-2026/pair-draw",
    mustSee: "PHÒNG BỐC THĂM",
  },
  {
    id: "SCREEN_08",
    path: "/ux-prototype/tournament-experience/t/pick-vn-open-2026/group-draw",
    mustSee: "Kết quả chia bảng",
  },
];
const VIEWPORTS = [
  { name: "MOBILE_390", width: 390, height: 844 },
  { name: "TABLET_768", width: 768, height: 1024 },
  { name: "DESKTOP_1440", width: 1440, height: 900 },
];

function isUncaught(log) {
  return log.type === "pageerror" || log.type === "error";
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const report = [];
let failed = false;

for (const route of ROUTES) {
  for (const vp of VIEWPORTS) {
    const logs = [];
    const onConsole = (msg) => logs.push({ type: msg.type(), text: msg.text() });
    const onError = (err) => logs.push({ type: "pageerror", text: String(err) });
    page.on("console", onConsole);
    page.on("pageerror", onError);
    await page.setViewportSize({ width: vp.width, height: vp.height });
    const response = await page.goto(`${BASE}${route.path}`, { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForTimeout(500);
    const metrics = await page.evaluate((mustSee) => {
      const root = document.getElementById("root");
      const text = (document.body?.innerText || "").replace(/\s+/g, " ").trim();
      const doc = document.documentElement;
      return {
        text: text.slice(0, 280),
        hasMustSee: text.includes(mustSee),
        hasBanner: text.includes("Nguyên mẫu UX Giải đấu"),
        rootLen: root?.innerHTML?.length || 0,
        innerWidth: window.innerWidth,
        scrollWidth: Math.max(doc.scrollWidth, document.body?.scrollWidth || 0),
      };
    }, route.mustSee);
    page.off("console", onConsole);
    page.off("pageerror", onError);
    const uncaught = logs.filter(isUncaught);
    const overflow = metrics.scrollWidth > metrics.innerWidth + 1;
    const row = {
      id: route.id,
      viewport: vp.name,
      render: response?.status() === 200 && metrics.rootLen > 0 && metrics.hasMustSee ? "PASS" : "FAIL",
      overflow: overflow ? "FAIL" : "PASS",
      uncaught: uncaught.length ? "FAIL" : "PASS",
      banner: metrics.hasBanner ? "PASS" : "FAIL",
      preview: metrics.text,
      errors: uncaught.slice(0, 4),
    };
    if (Object.values(row).includes("FAIL")) failed = true;
    report.push(row);
  }
}

await browser.close();
console.log(JSON.stringify(report, null, 2));
process.exit(failed ? 1 : 0);
