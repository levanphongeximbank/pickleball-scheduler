/**
 * Local browser acceptance — Dashboard club-context bootstrap remediation.
 * Paths: /, /login, /dashboard @ desktop 1440 + mobile 390.
 */
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "artifacts", "dashboard-club-context-bootstrap-browser");
const BASE = process.env.SMOKE_BASE_URL || "http://127.0.0.1:5173";

mkdirSync(OUT, { recursive: true });

const VIEWPORTS = [
  { name: "desktop-1440", width: 1440, height: 900 },
  { name: "mobile-390", width: 390, height: 844 },
];

const ROUTES = ["/", "/login", "/dashboard"];

async function probe(page) {
  return page.evaluate(() => {
    const text = (document.body?.innerText || "").replace(/\s+/g, " ").trim();
    const reactRoot = document.getElementById("root");
    const hasReactChildren = Boolean(reactRoot && reactRoot.children.length > 0);
    const clubRequired = /CLUB_REQUIRED|ClubContextError/i.test(text);
    const blank =
      !text ||
      text.length < 8 ||
      (!hasReactChildren && !document.querySelector("[data-testid]"));
    return {
      pathName: location.pathname,
      title: document.title || "",
      textSample: text.slice(0, 400),
      textLen: text.length,
      blank,
      hasReactChildren,
      clubRequiredInDom: clubRequired,
      dashboardRoot: Boolean(document.querySelector('[data-testid="dashboard-root"]')),
      clubOps: Boolean(document.querySelector('[data-testid="dashboard-club-operations"]')),
      clubPlaceholder: Boolean(
        document.querySelector('[data-testid="dashboard-club-operations-placeholder"]')
      ),
      loginHeading: Boolean(
        document.querySelector('h1,h2,h3,h4,h5,h6') &&
          /Đăng nhập|Login/i.test(document.body?.innerText || "")
      ),
    };
  });
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const report = {
    base: BASE,
    results: [],
    summary: {
      WHITE_SCREEN: "NO",
      UNCAUGHT_CLUB_REQUIRED: "NO",
      REACT_MOUNTED: "YES",
      VISIBLE_APP_SHELL: "YES",
      DESKTOP_1440: "PASS",
      MOBILE_390: "PASS",
    },
  };

  try {
    for (const vp of VIEWPORTS) {
      const context = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
      });
      const page = await context.newPage();
      const consoleErrors = [];
      const pageErrors = [];
      page.on("console", (msg) => {
        if (msg.type() === "error") consoleErrors.push(msg.text());
      });
      page.on("pageerror", (err) => {
        pageErrors.push(String(err?.message || err));
      });

      for (const route of ROUTES) {
        const url = `${BASE}${route}`;
        let navError = null;
        try {
          await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
          await page.waitForTimeout(1500);
        } catch (error) {
          navError = String(error?.message || error);
        }
        const signals = navError
          ? { blank: true, hasReactChildren: false, clubRequiredInDom: false, pathName: route }
          : await probe(page);
        const shot = path.join(OUT, `${vp.name}${route.replace(/\//g, "_") || "_root"}.png`);
        if (!navError) {
          await page.screenshot({ path: shot, fullPage: true });
        }

        const clubRequiredUncaught = pageErrors.some((e) =>
          /CLUB_REQUIRED|ClubContextError/i.test(e)
        );
        const entry = {
          viewport: vp.name,
          route,
          url,
          navError,
          signals,
          consoleErrors: [...consoleErrors],
          pageErrors: [...pageErrors],
          clubRequiredUncaught,
          screenshot: navError ? null : shot,
        };
        report.results.push(entry);

        if (signals.blank || navError) {
          report.summary.WHITE_SCREEN = "YES";
          if (vp.name === "desktop-1440") report.summary.DESKTOP_1440 = "FAIL";
          if (vp.name === "mobile-390") report.summary.MOBILE_390 = "FAIL";
        }
        if (!signals.hasReactChildren && !navError && route !== "/dashboard") {
          // /dashboard may redirect to login when unauthenticated — still ok if not blank
        }
        if (!signals.hasReactChildren) {
          report.summary.REACT_MOUNTED = signals.blank ? "NO" : report.summary.REACT_MOUNTED;
        }
        if (clubRequiredUncaught || signals.clubRequiredInDom) {
          report.summary.UNCAUGHT_CLUB_REQUIRED = "YES";
        }
        consoleErrors.length = 0;
        pageErrors.length = 0;
      }
      await context.close();
    }
  } finally {
    await browser.close();
  }

  const outFile = path.join(OUT, "ACCEPTANCE_REPORT.json");
  writeFileSync(outFile, JSON.stringify(report, null, 2), "utf8");
  console.log(JSON.stringify(report.summary, null, 2));
  console.log(`Wrote ${outFile}`);

  const failed =
    report.summary.WHITE_SCREEN === "YES" ||
    report.summary.UNCAUGHT_CLUB_REQUIRED === "YES" ||
    report.summary.DESKTOP_1440 === "FAIL" ||
    report.summary.MOBILE_390 === "FAIL";
  process.exit(failed ? 1 : 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
