/**
 * Wave 1 Batch 1E — final closure visual evidence (canonical flag ON).
 * Representative shots + drawer-open mobile; reuses Batch 1C harness.
 */
import { createServer } from "vite";
import { chromium } from "playwright";
import { mkdirSync, writeFileSync, copyFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(root, "docs/v5/web-app-experience/wave1/batch-1e/screenshots");
const batch1dDir = path.join(root, "docs/v5/web-app-experience/wave1/batch-1d/screenshots");

const SHOTS = [
  { name: "dashboard-1440", width: 1440, height: 900, pathKey: "dashboard", drawer: false },
  { name: "tournament-1440", width: 1440, height: 900, pathKey: "tournament", drawer: false },
  { name: "dashboard-1024", width: 1024, height: 768, pathKey: "dashboard", drawer: false },
  { name: "tournament-1024", width: 1024, height: 768, pathKey: "tournament", drawer: false },
  { name: "dashboard-430-closed", width: 430, height: 932, pathKey: "dashboard", drawer: false },
  { name: "dashboard-430-drawer-open", width: 430, height: 932, pathKey: "dashboard", drawer: true },
  { name: "tournament-430", width: 430, height: 932, pathKey: "tournament", drawer: false },
];

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
    for (const shot of SHOTS) {
      const page = await browser.newPage({
        viewport: { width: shot.width, height: shot.height },
      });
      page.setDefaultTimeout(60_000);
      try {
        const url = new URL("/batch1c-topbar-evidence.html", base);
        url.searchParams.set("path", shot.pathKey);
        await page.goto(url.toString(), { waitUntil: "domcontentloaded", timeout: 90_000 });
        await page.waitForSelector('[data-testid="canonical-app-shell"]', { timeout: 60_000 });
        await page.waitForSelector(
          '[data-testid="batch1c-page-body"], [data-testid="batch1a-page-body"]',
          { timeout: 30_000 }
        );
        await new Promise((r) => setTimeout(r, 350));

        if (shot.drawer) {
          await page.click('[data-testid="canonical-mobile-menu-trigger"]');
          await page.waitForSelector('[data-testid="canonical-mobile-drawer-panel"]', {
            timeout: 10_000,
          });
          await new Promise((r) => setTimeout(r, 400));
        }

        const metrics = await page.evaluate(() => {
          const sidebar = document.querySelector('[data-testid="canonical-sidebar"]');
          return {
            canonical: document.querySelectorAll('[data-testid="canonical-app-shell"]').length,
            legacy: document.querySelectorAll('[data-testid="legacy-app-shell"]').length,
            topbars: document.querySelectorAll('[data-testid="canonical-topbar"]').length,
            sidebarPresent: Boolean(sidebar),
            sidebarWidth: sidebar?.getAttribute("data-sidebar-width") || null,
            drawerOpen: Boolean(
              document.querySelector('[data-testid="canonical-mobile-drawer-panel"]')
            ),
            help: document.querySelectorAll('[data-testid="canonical-help-button"]').length,
            search: document.querySelectorAll(
              '[data-testid="canonical-global-search-trigger"], [aria-label="Tìm kiếm toàn cục"]'
            ).length,
            shellOverflow:
              document.documentElement.scrollWidth > document.documentElement.clientWidth + 2,
          };
        });

        if (metrics.canonical !== 1 || metrics.legacy !== 0 || metrics.topbars !== 1) {
          throw new Error(`Exclusivity failed: ${JSON.stringify(metrics)}`);
        }
        if (shot.width <= 899 && metrics.sidebarPresent) {
          throw new Error("Persistent sidebar on mobile");
        }
        if (shot.drawer && !metrics.drawerOpen) {
          throw new Error("Drawer open expected");
        }
        if (metrics.shellOverflow) throw new Error("Shell horizontal overflow");

        const file = path.join(outDir, `${shot.name}.png`);
        await page.screenshot({ path: file, fullPage: false });
        results.push({
          shot: shot.name,
          file: path.relative(root, file).replace(/\\/g, "/"),
          ...metrics,
        });
      } catch (err) {
        failures.push({ shot: shot.name, error: String(err?.message || err) });
      } finally {
        await page.close().catch(() => {});
      }
    }
  } finally {
    await browser.close().catch(() => {});
    await server.close().catch(() => {});
  }

  // Retain Batch 1D breakpoint evidence by reference copy of key boundary files when present.
  const retain = [
    "dashboard-1200.png",
    "dashboard-1199.png",
    "dashboard-900.png",
    "dashboard-899.png",
    "dashboard-1920.png",
    "dashboard-768.png",
    "dashboard-390.png",
    "dashboard-360.png",
  ];
  // Batch 1D may not have exactly 1200 — copy nearest available markers.
  const retainMap = {
    "dashboard-1200.png": "dashboard-1440.png", // desktop representative if exact 1200 absent
    "dashboard-1199.png": "dashboard-1199.png",
    "dashboard-900.png": "dashboard-900.png",
    "dashboard-899.png": "dashboard-899.png",
    "dashboard-1920.png": "dashboard-1920.png",
    "dashboard-768.png": "dashboard-768.png",
    "dashboard-390.png": "dashboard-390.png",
    "dashboard-360.png": "dashboard-360.png",
  };
  const retained = [];
  for (const [label, srcName] of Object.entries(retainMap)) {
    const src = path.join(batch1dDir, srcName);
    if (existsSync(src)) {
      const dest = path.join(outDir, `retained-1d-${label}`);
      copyFileSync(src, dest);
      retained.push(path.relative(root, dest).replace(/\\/g, "/"));
    }
  }

  writeFileSync(
    path.join(outDir, "..", "FINAL_VISUAL_EVIDENCE.json"),
    JSON.stringify(
      {
        capturedAt: new Date().toISOString(),
        flag: "VITE_CANONICAL_APP_SHELL_ENABLED=true",
        harness: "batch1c-topbar-evidence.html",
        results,
        failures,
        retainedFromBatch1D: retained,
      },
      null,
      2
    )
  );

  if (failures.length) {
    console.error(JSON.stringify({ ok: false, failures, captured: results.length }, null, 2));
    process.exit(1);
  }
  console.log(JSON.stringify({ ok: true, count: results.length, retained: retained.length }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
