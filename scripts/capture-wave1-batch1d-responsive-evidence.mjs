/**
 * Wave 1 Batch 1D — responsive shell evidence (canonical flag ON).
 */
import { createServer } from "vite";
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(root, "docs/v5/web-app-experience/wave1/batch-1d/screenshots");

const VIEWPORTS = [
  { name: "1920", width: 1920, height: 1080 },
  { name: "1440", width: 1440, height: 900 },
  { name: "1199", width: 1199, height: 800 },
  { name: "1024", width: 1024, height: 768 },
  { name: "900", width: 900, height: 700 },
  { name: "899", width: 899, height: 700 },
  { name: "768", width: 768, height: 700 },
  { name: "430", width: 430, height: 932 },
  { name: "390", width: 390, height: 844 },
  { name: "360", width: 360, height: 740 },
];

const ROUTES = [
  { pathKey: "dashboard", slug: "dashboard" },
  { pathKey: "tournament", slug: "tournament" },
];

async function measure(page) {
  return page.evaluate(async () => {
    const topbar = document.querySelector('[data-testid="canonical-topbar"]');
    const sidebar = document.querySelector('[data-testid="canonical-sidebar"]');
    const menuBtn = document.querySelectorAll('[data-testid="canonical-mobile-menu-trigger"]').length;

    let drawerOpen = false;
    let drawerContext = 0;
    if (menuBtn) {
      document.querySelector('[data-testid="canonical-mobile-menu-trigger"]')?.click();
      await new Promise((r) => setTimeout(r, 450));
      drawerOpen = Boolean(document.querySelector('[data-testid="canonical-mobile-drawer-panel"]'));
      drawerContext = document.querySelectorAll('[data-testid="canonical-mobile-drawer-context"]').length;
      document.querySelector('[data-testid="canonical-mobile-drawer-close"]')?.click();
      await new Promise((r) => setTimeout(r, 200));
    }

    return {
      canonical: document.querySelectorAll('[data-testid="canonical-app-shell"]').length,
      legacy: document.querySelectorAll('[data-testid="legacy-app-shell"]').length,
      topbars: document.querySelectorAll('[data-testid="canonical-topbar"]').length,
      viewportAttr: topbar?.getAttribute("data-viewport") || null,
      sidebarPresent: Boolean(sidebar),
      sidebarCollapsed: sidebar?.getAttribute("data-sidebar-collapsed") || null,
      sidebarWidth: sidebar?.getAttribute("data-sidebar-width") || null,
      help: document.querySelectorAll('[data-testid="canonical-help-button"]').length,
      venueTop: document.querySelectorAll('[data-testid="canonical-topbar-venue-zone"]').length,
      clubTop: document.querySelectorAll('[data-testid="canonical-topbar-club-zone"]').length,
      mobileTitle: document.querySelectorAll('[data-testid="canonical-topbar-mobile-title"]').length,
      bottomNav: document.querySelectorAll(".MuiBottomNavigation-root").length,
      menuBtn,
      drawerOpen,
      drawerContext,
      shellOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 2,
    };
  });
}

async function main() {
  process.env.VITE_CANONICAL_APP_SHELL_ENABLED = "true";
  process.env.VITE_RBAC_ENABLED = "false";
  process.env.VITE_SUPABASE_URL = "";
  process.env.VITE_SUPABASE_ANON_KEY = "";

  mkdirSync(outDir, { recursive: true });

  const server = await createServer({
    root,
    configFile: path.join(root, "vite.config.js"),
    define: {
      "import.meta.env.VITE_CANONICAL_APP_SHELL_ENABLED": JSON.stringify("true"),
      "import.meta.env.VITE_RBAC_ENABLED": JSON.stringify("false"),
    },
    server: { port: 0, strictPort: false },
  });
  await server.listen();
  const base = server.resolvedUrls?.local?.[0];
  if (!base) throw new Error("Vite server URL missing");

  const browser = await chromium.launch({ headless: true });
  const results = [];
  const failures = [];

  try {
    for (const vp of VIEWPORTS) {
      for (const route of ROUTES) {
        const page = await browser.newPage({
          viewport: { width: vp.width, height: vp.height },
        });
        page.setDefaultTimeout(60_000);
        try {
          const url = new URL("/batch1c-topbar-evidence.html", base);
          url.searchParams.set("path", route.pathKey);
          await page.goto(url.toString(), { waitUntil: "domcontentloaded", timeout: 90_000 });
          await page.waitForSelector('[data-testid="canonical-app-shell"]', { timeout: 60_000 });
          await page.waitForSelector(
            '[data-testid="batch1c-page-body"], [data-testid="batch1a-page-body"]',
            { timeout: 30_000 }
          );
          await new Promise((r) => setTimeout(r, 350));

          const metrics = await measure(page);
          if (metrics.canonical !== 1 || metrics.legacy !== 0 || metrics.topbars !== 1) {
            throw new Error(`Exclusivity failed: ${JSON.stringify(metrics)}`);
          }
          if (vp.width <= 899) {
            if (metrics.sidebarPresent) throw new Error(`Persistent sidebar on mobile`);
            if (metrics.venueTop || metrics.clubTop) throw new Error(`Selectors in mobile topbar`);
            if (!metrics.menuBtn || !metrics.mobileTitle || !metrics.bottomNav) {
              throw new Error(`Mobile chrome incomplete: ${JSON.stringify(metrics)}`);
            }
            if (!metrics.drawerOpen || metrics.drawerContext < 1) {
              throw new Error(`Drawer context missing: ${JSON.stringify(metrics)}`);
            }
          } else if (vp.width >= 900 && vp.width <= 1199) {
            if (!metrics.sidebarPresent) throw new Error(`Tablet sidebar missing`);
            if (metrics.sidebarWidth !== "64" && metrics.sidebarCollapsed !== "true") {
              throw new Error(`Tablet rail expected: ${JSON.stringify(metrics)}`);
            }
          } else if (vp.width >= 1200) {
            if (!metrics.sidebarPresent) throw new Error(`Desktop sidebar missing`);
            if (metrics.sidebarWidth !== "260" && metrics.sidebarCollapsed !== "false") {
              throw new Error(`Desktop expanded expected: ${JSON.stringify(metrics)}`);
            }
          }
          if (metrics.shellOverflow) throw new Error(`Shell horizontal overflow`);

          const file = path.join(outDir, `${route.slug}-${vp.name}.png`);
          await page.screenshot({ path: file, fullPage: false });
          results.push({
            route: route.pathKey,
            viewport: vp.name,
            file: path.relative(root, file).replace(/\\/g, "/"),
            ...metrics,
          });
        } catch (err) {
          failures.push({
            route: route.pathKey,
            viewport: vp.name,
            error: String(err?.message || err),
          });
        } finally {
          await page.close().catch(() => {});
        }
      }
    }
  } finally {
    await browser.close().catch(() => {});
    await server.close().catch(() => {});
  }

  writeFileSync(
    path.join(outDir, "..", "SCREEN_EVIDENCE.json"),
    JSON.stringify(
      {
        capturedAt: new Date().toISOString(),
        flag: "VITE_CANONICAL_APP_SHELL_ENABLED=true",
        harness: "batch1c-topbar-evidence.html (Batch 1D reuse)",
        results,
        failures,
      },
      null,
      2
    )
  );

  if (failures.length) {
    console.error(JSON.stringify({ ok: false, failures, captured: results.length }, null, 2));
    process.exit(1);
  }
  console.log(JSON.stringify({ ok: true, count: results.length }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
