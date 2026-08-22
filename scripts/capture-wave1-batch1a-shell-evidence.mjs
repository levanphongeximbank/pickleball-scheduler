/**
 * Wave 1 Batch 1A — local shell exclusivity screen evidence (canonical flag ON).
 * Uses a MainLayout harness page (not full App router) to isolate chrome proof.
 */
import { createServer } from "vite";
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(root, "docs/v5/web-app-experience/wave1/batch-1a/screenshots");

const VIEWPORTS = [
  { name: "1920", width: 1920, height: 1080 },
  { name: "1440", width: 1440, height: 900 },
];

const ROUTES = [
  { pathKey: "dashboard", slug: "dashboard" },
  { pathKey: "tournament", slug: "tournament" },
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
    server: { port: 5191, strictPort: true },
  });

  await server.listen();
  const base = server.resolvedUrls?.local?.[0] || "http://127.0.0.1:5191/";

  const browser = await chromium.launch({ headless: true });
  const results = [];

  try {
    for (const vp of VIEWPORTS) {
      for (const route of ROUTES) {
        const page = await browser.newPage({
          viewport: { width: vp.width, height: vp.height },
        });
        const url = new URL("/batch1a-shell-evidence.html", base);
        url.searchParams.set("path", route.pathKey);
        await page.goto(url.toString(), { waitUntil: "networkidle", timeout: 120_000 });
        await page.waitForSelector('[data-testid="canonical-app-shell"]', { timeout: 60_000 });
        await page.waitForSelector('[data-testid="batch1a-page-body"]', { timeout: 30_000 });

        const metrics = await page.evaluate(() => {
          const canonical = document.querySelectorAll('[data-testid="canonical-app-shell"]').length;
          const legacy = document.querySelectorAll('[data-testid="legacy-app-shell"]').length;
          const topbars = document.querySelectorAll('[data-testid="canonical-topbar"]').length;
          const bottomNav = document.querySelectorAll(".MuiBottomNavigation-root").length;
          const sideDrawers = document.querySelectorAll(".MuiDrawer-root").length;
          return {
            canonical,
            legacy,
            topbars,
            bottomNav,
            sideDrawers,
            href: location.href,
            bodyText: document.body?.innerText?.slice(0, 200) || "",
          };
        });

        if (metrics.canonical !== 1 || metrics.legacy !== 0 || metrics.topbars !== 1) {
          throw new Error(
            `Exclusivity failed for ${route.slug}@${vp.name}: ${JSON.stringify(metrics)}`
          );
        }

        const file = path.join(outDir, `${route.slug}-${vp.name}.png`);
        await page.screenshot({ path: file, fullPage: false });
        results.push({
          route: `/${route.pathKey}`,
          viewport: vp.name,
          file: path.relative(root, file).replace(/\\/g, "/"),
          ...metrics,
        });
        await page.close();
      }
    }
  } finally {
    await browser.close();
    await server.close();
  }

  const summaryPath = path.join(outDir, "..", "SCREEN_EVIDENCE.json");
  writeFileSync(
    summaryPath,
    JSON.stringify(
      {
        capturedAt: new Date().toISOString(),
        flag: "VITE_CANONICAL_APP_SHELL_ENABLED=true",
        harness: "batch1a-shell-evidence.html",
        note: "MainLayout harness — proves exclusive Canonical chrome; page bodies are labeled stand-ins for /dashboard and /tournament content slots.",
        results,
      },
      null,
      2
    )
  );
  console.log(JSON.stringify({ ok: true, results }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
