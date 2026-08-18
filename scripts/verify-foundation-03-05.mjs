import { chromium } from "playwright";

const BASE = process.env.PHASE2B_BASE || "http://localhost:5174";
const ROUTES = [
  {
    id: "SCREEN_03",
    path: "/ux-prototype/tournament-experience/t/pick-vn-open-2026/settings",
    mustSee: "Cài đặt Giải đấu / Nội dung",
  },
  {
    id: "SCREEN_05",
    path: "/ux-prototype/tournament-experience/t/pick-vn-open-2026/participants",
    mustSee: "Chưa sẵn sàng chốt",
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
      const menu = document.querySelector('[aria-label="Mở menu giải đấu"]');
      const notif = document.querySelector('[data-testid="tournament-header-notification"]');
      const appRow = document.querySelector('[data-testid="tournament-app-header-row"]');
      const actions = document.querySelector('[data-testid="tournament-header-page-actions"]');
      const menuBox = menu?.getBoundingClientRect();
      const notifBox = notif?.getBoundingClientRect();
      const actionBox = actions?.getBoundingClientRect();
      const sameHeaderRow = Boolean(menuBox && notifBox) && Math.abs(menuBox.top - notifBox.top) <= 12;
      const actionsBelowHeader = !actionBox || !notifBox || actionBox.top >= notifBox.bottom - 2;
      return {
        text: text.slice(0, 280),
        hasMustSee: text.includes(mustSee),
        hasBanner: text.includes("Nguyên mẫu UX Giải đấu"),
        rootLen: root?.innerHTML?.length || 0,
        innerWidth: window.innerWidth,
        scrollWidth: Math.max(doc.scrollWidth, document.body?.scrollWidth || 0),
        headerStable: Boolean(appRow) && sameHeaderRow && actionsBelowHeader,
      };
    }, route.mustSee);
    page.off("console", onConsole);
    page.off("pageerror", onError);
    const uncaught = logs.filter(isUncaught);
    const overflow = metrics.scrollWidth > metrics.innerWidth + 1;
    const isMobile = vp.width <= 430;
    const extra = { noiDungScope: "n/a", eventTerm: "n/a", configLocked: "n/a" };
    if (route.id === "SCREEN_03") {
      await page.getByRole("button", { name: "Nội dung", exact: true }).click();
      await page.waitForTimeout(400);
      const locked = await page.evaluate(() => {
        const text = (document.body?.innerText || "").replace(/\s+/g, " ");
        const doc = document.documentElement;
        return {
          hasNoiDung: text.includes("NỘI DUNG THI ĐẤU"),
          hasLocked: text.includes("ĐÃ KHÓA"),
          hasInProgress: text.includes("Đang thi đấu"),
          hasCorrection: text.includes("Điều chỉnh / Mở lại") && !text.includes("Correction / Reopen"),
          hasDraft: text.includes("DRAFT"),
          hasEventWord: /\bEvent\b/.test(text),
          hasFormatDesigner: text.includes("Format Designer"),
          hasSaveDraft: text.includes("Lưu nháp"),
          innerWidth: window.innerWidth,
          scrollWidth: Math.max(doc.scrollWidth, document.body?.scrollWidth || 0),
        };
      });
      extra.noiDungScope = locked.hasNoiDung && locked.hasInProgress ? "PASS" : "FAIL";
      extra.eventTerm = !locked.hasEventWord && !locked.hasFormatDesigner ? "PASS" : "FAIL";
      extra.configLocked = locked.hasLocked && locked.hasCorrection && !locked.hasDraft && !locked.hasSaveDraft ? "PASS" : "FAIL";
      extra.overflowLocked = locked.scrollWidth > locked.innerWidth + 1 ? "FAIL" : "PASS";
    }
    const row = {
      id: route.id,
      viewport: vp.name,
      render: response?.status() === 200 && metrics.rootLen > 0 && metrics.hasMustSee ? "PASS" : "FAIL",
      overflow: overflow || extra.overflowLocked === "FAIL" ? "FAIL" : "PASS",
      uncaught: uncaught.length ? "FAIL" : "PASS",
      header: !isMobile || metrics.headerStable ? "PASS" : "FAIL",
      banner: metrics.hasBanner ? "PASS" : "FAIL",
      ...extra,
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
