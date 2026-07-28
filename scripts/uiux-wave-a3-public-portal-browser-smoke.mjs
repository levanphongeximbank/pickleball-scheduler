/**
 * Wave A3 — Public Portal anonymous browser smoke (Playwright).
 * HC ON by default via Vite env. Writes screenshots under artifacts/.
 */
import { chromium } from "playwright";
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "artifacts", "uiux-wave-a3-public-portal-smoke");
const BASE = process.env.SMOKE_BASE_URL || "http://127.0.0.1:5173";
const MODE = process.env.SMOKE_HC_MODE || "on"; // on | off

mkdirSync(OUT, { recursive: true });

const VIEWPORTS = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "mobile", width: 390, height: 844 },
];

const ROUTES = ["/", "/home", "/clubs", "/courts", "/clubs/invalid-public-id-wave-a3"];

function hasHorizontalOverflow(metrics) {
  return metrics.scrollWidth > metrics.clientWidth + 1;
}

async function collectPageSignals(page) {
  return page.evaluate(() => {
    const text = (document.body?.innerText || "").replace(/\s+/g, " ").trim();
    const html = document.body?.innerHTML || "";
    const title = document.title || "";
    const pathName = location.pathname;
    const loading = Boolean(document.querySelector('[data-testid="public-loading-state"]'));
    const empty = Boolean(document.querySelector('[data-testid="public-empty-state"]'));
    const unavailable = Boolean(
      document.querySelector('[data-testid="public-unavailable-state"]')
    );
    const error = Boolean(document.querySelector('[data-testid="public-error-state"]'));
    const notice = document.querySelector('[data-testid="public-data-source-notice"]');
    const noticeSource = notice?.getAttribute("data-source") || null;
    const noticeText = notice?.textContent || "";
    const mockAsReal =
      (/MOCK_CLUB|mock-club|CLB Demo Alpha|Sân Demo|Future Arena|future_arena|PUBLIC_STATS/i.test(
        text
      ) ||
        /Giải 1 Future Arena|Giải đấu nổi bật[\s\S]{0,80}Sắp diễn ra/i.test(text)) &&
      !/minh họa|dự phòng|demo|mẫu|không bền vững|tạm thời không khả dụng/i.test(text);
    const fakeCountHints = Array.from(document.querySelectorAll("body *"))
      .slice(0, 400)
      .map((el) => el.textContent || "")
      .filter((t) => /\d+\s*(thành viên|sân|giải đã tổ chức)/i.test(t));
    const rawBackend = /supabase|postgres|service_role|stack trace|PGRST|relation .* does not exist/i.test(
      text
    );
    const loginRedirect = pathName.startsWith("/login");
    const blank =
      !text ||
      text.length < 8 ||
      (document.body.children.length === 0 && !loading);
    return {
      title,
      pathName,
      textSample: text.slice(0, 500),
      loading,
      empty,
      unavailable,
      error,
      noticeSource,
      noticeText: noticeText.slice(0, 240),
      mockAsReal,
      fakeCountHints: fakeCountHints.slice(0, 5),
      rawBackend,
      loginRedirect,
      blank,
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
      hasCta:
        Boolean(document.querySelector('a[href="/clubs"], a[href="/courts"], a[href="/home"], button')) ||
        /Thử lại|Xem tất cả|Đăng ký/i.test(text),
    };
  });
}

async function waitForSettled(page, timeoutMs = 20000) {
  const start = Date.now();
  let last = null;
  while (Date.now() - start < timeoutMs) {
    last = await collectPageSignals(page);
    const readyTitle =
      /PICK_VN|Câu lạc bộ|Sân pickleball|Trang chủ|Không tìm thấy/i.test(last.title || "");
    const hasShell = /PICK_VN/i.test(last.textSample || "");
    if (!last.loading && !last.blank && (readyTitle || hasShell)) {
      return last;
    }
    // Suspense / lazy route still mounting.
    if (last.blank || !readyTitle) {
      await page.waitForTimeout(400);
      continue;
    }
    if (!last.loading) return last;
    await page.waitForTimeout(300);
  }
  return last;
}

async function gotoAnonymous(page, context, url) {
  await context.clearCookies();
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.evaluate(() => {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch {
      /* ignore */
    }
  });
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForSelector("body", { timeout: 15000 });
  // Give lazy public chunks time to mount.
  await page.waitForTimeout(800);
  try {
    await page.waitForFunction(
      () => {
        const title = document.title || "";
        const text = (document.body?.innerText || "").trim();
        return /PICK_VN|Câu lạc bộ|Sân pickleball|Trang chủ|Không tìm thấy/i.test(title) ||
          /PICK_VN/i.test(text);
      },
      { timeout: 15000 }
    );
  } catch {
    /* fall through to signal collection */
  }
}

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    locale: "vi-VN",
    storageState: undefined,
  });
  // Force anonymous: clear any storage before each navigation.
  await context.clearCookies();

  const consoleErrors = [];
  const report = {
    mode: MODE,
    base: BASE,
    startedAt: new Date().toISOString(),
    routes: ROUTES,
    viewports: VIEWPORTS.map((v) => v.name),
    results: [],
    consoleErrors: [],
    pass: true,
    failures: [],
  };

  const page = await context.newPage();
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      const entry = { text: msg.text(), location: msg.location(), mode: MODE };
      consoleErrors.push(entry);
    }
  });
  page.on("pageerror", (err) => {
    consoleErrors.push({ text: String(err), pageerror: true, mode: MODE });
  });

  for (const vp of VIEWPORTS) {
    await page.setViewportSize({ width: vp.width, height: vp.height });

    for (const route of ROUTES) {
      await gotoAnonymous(page, context, `${BASE}${route}`);

      const signals = await waitForSettled(page);
      const overflow = hasHorizontalOverflow(signals);
      const stillLoading = signals.loading === true;
      const failures = [];

      if (stillLoading) failures.push("infinite_or_stuck_loading");
      if (signals.blank && !signals.loading) failures.push("blank_page");
      if (signals.loginRedirect && ["/", "/home", "/clubs", "/courts"].includes(route)) {
        failures.push("unexpected_login_redirect");
      }
      if (signals.rawBackend) failures.push("raw_backend_error");
      if (overflow) failures.push("horizontal_overflow");
      if (MODE === "on") {
        if (signals.mockAsReal) failures.push("mock_shown_as_real");
        if (signals.noticeSource === "MOCK" || signals.noticeSource === "MIXED") {
          // Under HC ON, clubs/courts/home catalog must not land on labeled mock/mixed as authority.
          if (route === "/clubs" || route === "/courts" || route === "/home" || route === "/") {
            failures.push("hc_on_mock_or_mixed_authority");
          }
        }
        if (
          (route === "/clubs" || route === "/courts") &&
          !signals.empty &&
          !signals.unavailable &&
          !signals.error &&
          !signals.loading
        ) {
          // Ready with data is OK only if LIVE and no fake counts.
          if (signals.fakeCountHints.length && /0 thành viên|0 giải|null/.test(signals.fakeCountHints.join("|"))) {
            failures.push("fake_count_display");
          }
        }
        if ((route === "/clubs" || route === "/courts") && (signals.empty || signals.unavailable || signals.error)) {
          const vn =
            /công khai|khả dụng|Không tải|Chưa có|thử lại|hard cutover/i.test(signals.textSample);
          if (!vn) failures.push("missing_vietnamese_state_copy");
        }
      }

      if (MODE === "off" && (route === "/clubs" || route === "/courts" || route === "/home")) {
        if (signals.noticeSource === "MOCK" || signals.noticeSource === "MIXED") {
          const labeled = /minh họa|dự phòng|demo|xem trước|không bền vững|tương thích local/i.test(
            signals.noticeText + " " + signals.textSample
          );
          if (!labeled) failures.push("hc_off_demo_unlabeled");
        }
      }

      const shotName =
        MODE === "on"
          ? route === "/" || route === "/home"
            ? `hc-on-home-${vp.name}.png`
            : route === "/clubs"
              ? vp.name === "desktop"
                ? "hc-on-clubs-empty.png"
                : `hc-on-clubs-${vp.name}.png`
              : route === "/courts"
                ? vp.name === "desktop"
                  ? "hc-on-courts-unavailable.png"
                  : `hc-on-courts-${vp.name}.png`
                : vp.name === "desktop"
                  ? "invalid-public-route.png"
                  : `invalid-public-route-${vp.name}.png`
          : route === "/home" && vp.name === "desktop"
            ? "hc-off-demo-label.png"
            : `hc-off-${route.replace(/\W+/g, "_")}-${vp.name}.png`;

      const shotPath = path.join(OUT, shotName);
      // Avoid overwriting primary named shots with later viewports for clubs/courts.
      if (!existsSync(shotPath) || vp.name === "desktop" || route === "/" || route === "/home") {
        await page.screenshot({ path: shotPath, fullPage: true });
      }

      const row = {
        mode: MODE,
        route,
        viewport: vp.name,
        signals,
        overflow,
        stillLoading,
        failures,
        screenshot: shotName,
      };
      report.results.push(row);
      if (failures.length) {
        report.pass = false;
        report.failures.push(row);
      }
      console.log(
        `[${MODE}] ${vp.name} ${route} -> loading=${signals.loading} empty=${signals.empty} unavail=${signals.unavailable} err=${signals.error} notice=${signals.noticeSource} fail=${failures.join(",") || "none"}`
      );
    }
  }

  // Public-portal specific console filter (ignore generic vite noise if any).
  report.consoleErrors = consoleErrors.filter((e) =>
    /public|portal|clubs|courts|catalog|Public/i.test(String(e.text || ""))
  );
  if (report.consoleErrors.length) {
    report.pass = false;
  }

  report.finishedAt = new Date().toISOString();
  const reportPath = path.join(OUT, `SMOKE_REPORT_HC_${MODE.toUpperCase()}.json`);
  writeFileSync(reportPath, JSON.stringify(report, null, 2), "utf8");
  console.log(`Wrote ${reportPath} pass=${report.pass}`);
  await browser.close();
  process.exit(report.pass ? 0 : 1);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
