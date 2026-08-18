import { chromium } from "playwright";

import { PROTOTYPE_SCREEN_CATALOG } from "../src/features/tournament-experience-ui/prototypeScreenCatalog.js";

const BASE = process.env.PHASE2B_BASE || "http://localhost:5174";
const VIEWPORTS = [
  { name: "MOBILE_360", width: 360, height: 800 },
  { name: "MOBILE_390", width: 390, height: 844 },
  { name: "MOBILE_430", width: 430, height: 932 },
  { name: "TABLET_768", width: 768, height: 1024 },
  { name: "TABLET_1024", width: 1024, height: 768 },
  { name: "DESKTOP_1440", width: 1440, height: 900 },
  { name: "DESKTOP_1920", width: 1920, height: 1080 },
];

function isUncaught(log) {
  return log.type === "pageerror" || log.type === "error";
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const report = [];
let failed = false;

for (const route of PROTOTYPE_SCREEN_CATALOG) {
  for (const vp of VIEWPORTS) {
    const logs = [];
    const onConsole = (msg) => logs.push({ type: msg.type(), text: msg.text() });
    const onError = (err) => logs.push({ type: "pageerror", text: String(err) });
    page.on("console", onConsole);
    page.on("pageerror", onError);

    await page.setViewportSize({ width: vp.width, height: vp.height });
    const response = await page.goto(`${BASE}${route.path}`, {
      waitUntil: "networkidle",
      timeout: 30000,
    });
    await page.waitForTimeout(500);

    const metrics = await page.evaluate((mustSee) => {
      const root = document.getElementById("root");
      const text = (document.body?.innerText || "").replace(/\s+/g, " ").trim();
      const doc = document.documentElement;
      const menu = document.querySelector('[aria-label="Mở menu giải đấu"]');
      const notif = document.querySelector('[data-testid="tournament-header-notification"]');
      const appRow = document.querySelector('[data-testid="tournament-app-header-row"]');
      const actions = document.querySelector('[data-testid="tournament-header-page-actions"]');
      const publicPage = document.querySelector('[data-testid="public-tournament-page"]');
      const menuBox = menu?.getBoundingClientRect();
      const notifBox = notif?.getBoundingClientRect();
      const actionBox = actions?.getBoundingClientRect();
      const sameHeaderRow =
        Boolean(menuBox && notifBox) && Math.abs(menuBox.top - notifBox.top) <= 12;
      const actionsBelowHeader =
        !actionBox || !notifBox || actionBox.top >= notifBox.bottom - 2;
      return {
        text: text.slice(0, 280),
        hasMustSee: text.includes(mustSee),
        rootLen: root?.innerHTML?.length || 0,
        innerWidth: window.innerWidth,
        scrollWidth: Math.max(doc.scrollWidth, document.body?.scrollWidth || 0),
        isPublic: Boolean(publicPage),
        headerStable: Boolean(appRow) && sameHeaderRow && actionsBelowHeader,
      };
    }, route.heading);

    page.off("console", onConsole);
    page.off("pageerror", onError);

    const uncaught = logs.filter(isUncaught);
    const overflow = metrics.scrollWidth > metrics.innerWidth + 1;
    const isMobile = vp.width <= 430;
    const headerPass = metrics.isPublic || !isMobile || metrics.headerStable;
    const renderPass =
      response?.status() === 200 && metrics.rootLen > 0 && metrics.hasMustSee;
    const row = {
      id: `SCREEN_${route.id}`,
      viewport: vp.name,
      status: response?.status() || 0,
      render: renderPass ? "PASS" : "FAIL",
      overflow: overflow ? "FAIL" : "PASS",
      uncaught: uncaught.length ? "FAIL" : "PASS",
      header: headerPass ? "PASS" : "FAIL",
      rootLen: metrics.rootLen,
      preview: metrics.text,
      errors: uncaught.slice(0, 4),
    };
    if (row.render !== "PASS" || row.overflow !== "PASS" || row.uncaught !== "PASS" || row.header !== "PASS") {
      failed = true;
    }
    report.push(row);
  }
}

await browser.close();
console.log(JSON.stringify(report, null, 2));
process.exit(failed ? 1 : 0);
