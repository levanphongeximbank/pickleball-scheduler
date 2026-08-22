/**
 * Wave 1 Batch 1C — topbar composition screen evidence (canonical flag ON).
 */
import { createServer } from "vite";
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(root, "docs/v5/web-app-experience/wave1/batch-1c/screenshots");

const VIEWPORTS = [
  { name: "1920", width: 1920, height: 1080 },
  { name: "1440", width: 1440, height: 900 },
  { name: "1024", width: 1024, height: 768 },
  { name: "430", width: 430, height: 932 },
];

const ROUTES = [
  { pathKey: "dashboard", slug: "dashboard" },
  { pathKey: "tournament", slug: "tournament" },
  { pathKey: "tournament-overview", slug: "tournament-overview" },
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
    server: { port: 5193, strictPort: true },
  });

  await server.listen();
  const base = server.resolvedUrls?.local?.[0] || "http://127.0.0.1:5193/";

  const browser = await chromium.launch({ headless: true });
  const results = [];

  try {
    for (const vp of VIEWPORTS) {
      for (const route of ROUTES) {
        const page = await browser.newPage({
          viewport: { width: vp.width, height: vp.height },
        });
        const url = new URL("/batch1c-topbar-evidence.html", base);
        url.searchParams.set("path", route.pathKey);
        await page.goto(url.toString(), { waitUntil: "networkidle", timeout: 120_000 });
        await page.waitForSelector('[data-testid="canonical-app-shell"]', { timeout: 60_000 });
        await page.waitForSelector('[data-testid="canonical-topbar"]', { timeout: 30_000 });
        await page.waitForSelector('[data-testid="batch1c-page-body"]', { timeout: 30_000 });

        const metrics = await page.evaluate(() => {
          const canonical = document.querySelectorAll('[data-testid="canonical-app-shell"]').length;
          const legacy = document.querySelectorAll('[data-testid="legacy-app-shell"]').length;
          const topbars = document.querySelectorAll('[data-testid="canonical-topbar"]').length;
          const help = document.querySelectorAll('[data-testid="canonical-help-button"]').length;
          const helpTarget =
            document.querySelector('[data-testid="canonical-help-button"]')?.getAttribute("data-help-target") ||
            null;
          const search = document.querySelectorAll('[data-testid="canonical-topbar-search-zone"]').length;
          const actions = document.querySelectorAll('[data-testid="canonical-topbar-actions-zone"]').length;
          const topbar = document.querySelector('[data-testid="canonical-topbar"]');
          const clipped =
            topbar && (topbar.scrollWidth > topbar.clientWidth + 1 || topbar.scrollHeight > topbar.clientHeight + 1);
          return {
            canonical,
            legacy,
            topbars,
            help,
            helpTarget,
            search,
            actions,
            clipped: Boolean(clipped),
            viewportAttr: topbar?.getAttribute("data-viewport") || null,
          };
        });

        if (metrics.canonical !== 1 || metrics.legacy !== 0 || metrics.topbars !== 1) {
          throw new Error(`Exclusivity failed ${route.slug}@${vp.name}: ${JSON.stringify(metrics)}`);
        }
        if (vp.width >= 1024 && metrics.help < 1) {
          throw new Error(`Help missing ${route.slug}@${vp.name}: ${JSON.stringify(metrics)}`);
        }
        if (metrics.help > 0 && metrics.helpTarget !== "/support") {
          throw new Error(`Help target invalid ${route.slug}@${vp.name}: ${JSON.stringify(metrics)}`);
        }

        const file = path.join(outDir, `${route.slug}-${vp.name}.png`);
        await page.screenshot({ path: file, fullPage: false });
        results.push({
          route: route.pathKey,
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

  writeFileSync(
    path.join(outDir, "..", "SCREEN_EVIDENCE.json"),
    JSON.stringify(
      {
        capturedAt: new Date().toISOString(),
        flag: "VITE_CANONICAL_APP_SHELL_ENABLED=true",
        harness: "batch1c-topbar-evidence.html",
        note: "430 observation only for Batch 1D planning. Help must target /support.",
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
