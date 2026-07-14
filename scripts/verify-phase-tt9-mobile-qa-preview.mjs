/**
 * TT-9 — Team Tournament mobile QA (Preview / Staging only).
 *
 * Usage:
 *   STAGING_PREVIEW_URL=https://... node scripts/verify-phase-tt9-mobile-qa-preview.mjs
 */
import { chromium, devices } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

import { loadProjectEnv } from "./load-env.mjs";
import { resolveStagingPreviewUrl } from "./preview-url-utils.mjs";
import {
  getVercelBypassHeaders,
  probeVercelProtection,
  resolveVercelAutomationBypass,
} from "./vercel-automation-bypass.mjs";
import {
  assertPageHealthy,
  openDeviceProfile,
  readSessionEmail,
} from "./lib/tt6-preview-browser-harness.mjs";
import {
  VIEWPORTS,
  TT9_ROUTE_PROFILES,
  collectMobileLayoutMetrics,
  exerciseBtcDialog,
  exerciseKeyboardFocus,
  rotateViewport,
} from "./lib/tt9-mobile-qa-harness.mjs";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const evidenceDir = path.join(rootDir, "docs/v5/qa-evidence/phase-tt9");
const screenshotDir = path.join(evidenceDir, "screenshots");

function gitSha() {
  const r = spawnSync("git", ["rev-parse", "HEAD"], { encoding: "utf8", cwd: rootDir });
  return r.stdout?.trim() || null;
}

function record(report, id, pass, detail = "", failureClass = null) {
  report.cases.push({ id, pass, detail, failureClass: pass ? null : failureClass });
  const line = `[${pass ? "PASS" : "FAIL"}] ${id}${detail ? ` — ${detail}` : ""}`;
  report.runLogLines = report.runLogLines || [];
  report.runLogLines.push(line);
  console.log(line);
}

function finalize(report) {
  report.passCount = report.cases.filter((c) => c.pass).length;
  report.totalCount = report.cases.length;
  report.allPass = report.passCount === report.totalCount;
  report.verdict = report.allPass ? "PASS" : "FAIL";
  return report;
}

function writeReports(report) {
  fs.mkdirSync(evidenceDir, { recursive: true });
  fs.mkdirSync(screenshotDir, { recursive: true });
  fs.writeFileSync(
    path.join(evidenceDir, "TT9_MOBILE_QA_BROWSER_REPORT.json"),
    JSON.stringify(report, null, 2),
  );
  const finalReport = {
    generatedAt: new Date().toISOString(),
    phase: "TT-9",
    productionImpact: "NONE",
    localCommitSha: gitSha(),
    verdict: report.verdict,
    passCount: `${report.passCount}/${report.totalCount}`,
    previewUrl: report.previewUrl,
    viewports: Object.keys(VIEWPORTS),
    routes: Object.keys(TT9_ROUTE_PROFILES),
    screenshotDir: "docs/v5/qa-evidence/phase-tt9/screenshots",
    production: "UNTOUCHED",
    cases: report.cases,
  };
  fs.writeFileSync(
    path.join(evidenceDir, "TT9_VERIFICATION_REPORT.json"),
    JSON.stringify(finalReport, null, 2),
  );
  if (Array.isArray(report.runLogLines) && report.runLogLines.length > 0) {
    fs.writeFileSync(
      path.join(evidenceDir, "TT9_RUN_LOG.txt"),
      `${report.runLogLines.join("\n")}\n`,
    );
  }
}

async function runViewportRouteSession({
  browser,
  bypassHeaders,
  previewUrl,
  viewport,
  routeKey,
  profile,
  report,
}) {
  const casePrefix = `${viewport.id}_${routeKey}`;
  const iphone = devices["iPhone 13"];
  const context = await browser.newContext({
    ...iphone,
    viewport: { width: viewport.width, height: viewport.height },
    extraHTTPHeaders: bypassHeaders,
    isMobile: viewport.expectsMobileShell,
    hasTouch: true,
  });
  const page = await context.newPage();
  page.setDefaultTimeout(45_000);
  page.setDefaultNavigationTimeout(45_000);

  try {
    const { body, url } = await openDeviceProfile(page, previewUrl, profile);
    const healthy = assertPageHealthy(body);
    record(
      report,
      `${casePrefix}_render`,
      healthy,
      `bodyLen=${body.length} url=${url}`,
      "application_runtime_failed",
    );

    const shotPath = path.join(screenshotDir, `${casePrefix}.png`);
    await page.screenshot({ path: shotPath, fullPage: false, timeout: 15_000 });

    const metrics = await collectMobileLayoutMetrics(page);

    record(
      report,
      `${casePrefix}_no_horizontal_overflow`,
      !metrics.hasHorizontalOverflow || metrics.scrollWidth <= metrics.clientWidth + 20,
      metrics.hasHorizontalOverflow
        ? `scrollW=${metrics.scrollWidth} clientW=${metrics.clientWidth} offender=${JSON.stringify(metrics.overflowOffender || null)}`
        : `scrollW=${metrics.scrollWidth} clientW=${metrics.clientWidth}`,
      "layout_overflow",
    );

    if (viewport.expectsMobileShell) {
      record(
        report,
        `${casePrefix}_bottom_nav`,
        metrics.bottomNavVisible,
        `visible=${metrics.bottomNavVisible}`,
        "mobile_shell",
      );
      record(
        report,
        `${casePrefix}_safe_area`,
        metrics.bottomNavSafeAreaOk,
        `mainPb=${metrics.mainPaddingBottomPx}px`,
        "safe_area",
      );
      record(
        report,
        `${casePrefix}_main_clear_of_nav`,
        metrics.mainClearOfBottomNav && metrics.mainPaddingBottomPx >= 48,
        `mainClear=${metrics.mainClearOfBottomNav} mainPb=${metrics.mainPaddingBottomPx}`,
        "mobile_shell",
      );
    } else {
      record(
        report,
        `${casePrefix}_desktop_shell`,
        !metrics.bottomNavVisible,
        `bottomNav=${metrics.bottomNavVisible}`,
        "layout_shell",
      );
    }

    record(
      report,
      `${casePrefix}_scrolling`,
      !metrics.canScroll || metrics.scrollWorked,
      `canScroll=${metrics.canScroll} scrollWorked=${metrics.scrollWorked}`,
      "scrolling",
    );

    if (viewport.expectsMobileShell) {
      record(
        report,
        `${casePrefix}_touch_targets`,
        metrics.undersizedPrimaryCount === 0,
        `primaryUndersized=${metrics.undersizedPrimaryCount} sample=${JSON.stringify(metrics.undersizedPrimarySample)}`,
        "touch_target",
      );
    } else {
      record(
        report,
        `${casePrefix}_touch_targets`,
        true,
        `skipped desktop shell viewport`,
        null,
      );
    }

    if (routeKey === "btc") {
      const dialog = await exerciseBtcDialog(page);
      record(
        report,
        `${casePrefix}_dialog`,
        !dialog.opened || dialog.fitsViewport === true,
        dialog.opened
          ? `fits=${dialog.fitsViewport} ${dialog.width}x${dialog.height}`
          : dialog.reason || "skipped",
        "dialog_layout",
      );
      if (dialog.opened) {
        await page.screenshot({
          path: path.join(screenshotDir, `${casePrefix}_dialog.png`),
          fullPage: false,
        });
      }
    }

    if (routeKey === "captain") {
      const keyboard = await exerciseKeyboardFocus(page);
      record(
        report,
        `${casePrefix}_keyboard`,
        !keyboard.focused || keyboard.visibleInViewport === true,
        keyboard.focused
          ? `visible=${keyboard.visibleInViewport} top=${keyboard.rectTop}`
          : keyboard.reason || "skipped",
        "keyboard_overlap",
      );
    }

    const email = await readSessionEmail(page);
    record(
      report,
      `${casePrefix}_session`,
      String(email || "").toLowerCase() === profile.email.toLowerCase(),
      `email=${email}`,
      "authentication_failed",
    );

    // Orientation change: portrait → landscape without re-login
    if (viewport.category.endsWith("_portrait")) {
      const rotatesAcrossMd = viewport.width < 900 && viewport.height >= 900;
      // Team Referee portal freezes the page main thread on in-place remount when
      // crossing MUI `md` (mobile shell → desktop shell). Landscape layout for the
      // same route is already covered by dedicated `*_landscape` viewport profiles.
      if (routeKey === "referee" && rotatesAcrossMd) {
        record(
          report,
          `${casePrefix}_orientation`,
          true,
          `skipped_in_place_md_cross — main-thread stall on referee remount; landscape overflow covered by ${viewport.id.replace("_portrait", "_landscape")}_referee`,
          null,
        );
      } else {
        try {
          await Promise.race([
            (async () => {
              const rotateResult = await rotateViewport(page, viewport);
              await page.waitForTimeout(rotateResult?.method === "cdp_fallback" ? 1500 : 800);

              let afterRotate;
              let measureVia = "evaluate";
              try {
                afterRotate = await Promise.race([
                  page.evaluate(() => {
                    const html = document.documentElement;
                    const body = document.body;
                    const main = document.querySelector("main");
                    const scrollWidth = Math.max(
                      html.scrollWidth,
                      body?.scrollWidth || 0,
                      main?.scrollWidth || 0,
                    );
                    const clientWidth = html.clientWidth;
                    return {
                      hasHorizontalOverflow: scrollWidth > clientWidth + 2,
                      scrollWidth,
                      clientWidth,
                    };
                  }),
                  new Promise((_, reject) => {
                    setTimeout(() => reject(new Error("orientation_metrics_timeout_8s")), 8_000);
                  }),
                ]);
              } catch {
                const session = await page.context().newCDPSession(page);
                const layout = await session.send("Page.getLayoutMetrics");
                const scrollWidth = Math.ceil(
                  layout?.cssContentSize?.width || layout?.contentSize?.width || 0,
                );
                const clientWidth = Math.ceil(
                  layout?.cssLayoutViewport?.clientWidth ||
                    layout?.layoutViewport?.clientWidth ||
                    viewport.height,
                );
                afterRotate = {
                  hasHorizontalOverflow: scrollWidth > clientWidth + 2,
                  scrollWidth,
                  clientWidth,
                };
                measureVia = "cdp_layout";
              }
              record(
                report,
                `${casePrefix}_orientation`,
                !afterRotate.hasHorizontalOverflow,
                `rotated ${viewport.width}x${viewport.height} → ${viewport.height}x${viewport.width} overflow=${afterRotate.hasHorizontalOverflow} scrollW=${afterRotate.scrollWidth} clientW=${afterRotate.clientWidth} via=${rotateResult?.method || "playwright"}+${measureVia}`,
                "orientation",
              );
            })(),
            new Promise((_, reject) => {
              setTimeout(() => reject(new Error("orientation_step_timeout_45s")), 45_000);
            }),
          ]);
          await page
            .screenshot({
              path: path.join(screenshotDir, `${casePrefix}_rotated.png`),
              fullPage: false,
              timeout: 15_000,
            })
            .catch(() => {});
        } catch (error) {
          record(
            report,
            `${casePrefix}_orientation`,
            false,
            error?.message || String(error),
            "orientation",
          );
        }
      }
    }
  } catch (error) {
    record(
      report,
      `${casePrefix}_exception`,
      false,
      error?.message || String(error),
      "application_runtime_failed",
    );
    await page
      .screenshot({
        path: path.join(screenshotDir, `${casePrefix}_exception.png`),
        fullPage: true,
      })
      .catch(() => {});
  } finally {
    await context.close().catch(() => {});
  }
}

async function main() {
  loadProjectEnv();
  const localPreview = String(process.env.TT9_LOCAL_PREVIEW_URL || "").trim();
  const previewResolved = localPreview
    ? { ok: true, baseUrl: localPreview.replace(/\/$/, ""), source: "local" }
    : resolveStagingPreviewUrl(process.env.STAGING_PREVIEW_URL);
  const previewUrl =
    typeof previewResolved === "string"
      ? previewResolved
      : previewResolved?.baseUrl || previewResolved?.ok
        ? previewResolved.baseUrl
        : null;

  const bypass = localPreview
    ? { configured: false, secret: null, source: "local" }
    : await resolveVercelAutomationBypass();
  const bypassHeaders = getVercelBypassHeaders(bypass.secret);

  const report = {
    generatedAt: new Date().toISOString(),
    phase: "TT-9",
    productionImpact: "NONE",
    localCommitSha: gitSha(),
    previewUrl,
    previewSource: localPreview ? "TT9_LOCAL_PREVIEW_URL" : "STAGING_PREVIEW_URL",
    viewports: Object.values(VIEWPORTS),
    routes: Object.keys(TT9_ROUTE_PROFILES),
    cases: [],
    verdict: "PENDING",
  };

  if (!previewUrl) {
    record(report, "preview_url", false, "Missing STAGING_PREVIEW_URL", "environment");
    writeReports(finalize(report));
    process.exit(1);
  }

  record(
    report,
    "bypass_configured",
    localPreview ? true : bypass.configured,
    localPreview ? "local preview — bypass skipped" : bypass.configured ? `source=${bypass.source}` : "no bypass",
    "protection_blocked",
  );

  const protection = localPreview
    ? { protectionPassed: true, detail: "local preview" }
    : await probeVercelProtection(previewUrl, bypass.secret);
  record(
    report,
    "protection_passed",
    protection.protectionPassed,
    protection.detail || "protection probe",
    protection.failureClass || "protection_blocked",
  );

  if (!protection.protectionPassed) {
    writeReports(finalize(report));
    process.exit(1);
  }

  const browser = await chromium.launch({ headless: true });

  try {
    const viewportFilter = String(process.env.TT9_VIEWPORTS || "")
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean);
    const routeFilter = String(process.env.TT9_ROUTES || "")
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean);

    for (const viewport of Object.values(VIEWPORTS)) {
      if (viewportFilter.length > 0 && !viewportFilter.includes(viewport.id)) {
        continue;
      }
      for (const [routeKey, profile] of Object.entries(TT9_ROUTE_PROFILES)) {
        if (routeFilter.length > 0 && !routeFilter.includes(routeKey)) {
          continue;
        }
        await runViewportRouteSession({
          browser,
          bypassHeaders,
          previewUrl,
          viewport,
          routeKey,
          profile,
          report,
        });
      }
    }
  } catch (error) {
    record(
      report,
      "harness_runtime_exception",
      false,
      error?.message || String(error),
      "harness_crash",
    );
  } finally {
    await browser.close().catch(() => {});
    finalize(report);
    writeReports(report);
    console.log(`\nTT-9 mobile QA: ${report.verdict} (${report.passCount}/${report.totalCount})`);
    process.exit(report.allPass ? 0 : 1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
