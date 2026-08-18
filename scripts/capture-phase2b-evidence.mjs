import { mkdirSync } from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

import { PROTOTYPE_SCREEN_CATALOG } from "../src/features/tournament-experience-ui/prototypeScreenCatalog.js";

const BASE = process.env.PHASE2B_BASE || "http://localhost:5174";
const OUT = path.resolve("docs/v5/qa-evidence/tournament-experience-phase2b");
mkdirSync(OUT, { recursive: true });

const TABLET_SCREENS = new Set(["03", "06", "07", "08", "10", "11", "14", "15", "16", "17", "18", "19", "20", "21", "22"]);

const shots = [];
for (const screen of PROTOTYPE_SCREEN_CATALOG) {
  shots.push({ file: `${screen.id}_DESKTOP_1440.png`, path: screen.path, width: 1440, height: 900 });
  shots.push({ file: `${screen.id}_MOBILE_390.png`, path: screen.path, width: 390, height: 844 });
  if (TABLET_SCREENS.has(screen.id)) {
    shots.push({ file: `${screen.id}_TABLET_768.png`, path: screen.path, width: 768, height: 1024 });
  }
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
for (const shot of shots) {
  await page.setViewportSize({ width: shot.width, height: shot.height });
  await page.goto(`${BASE}${shot.path}`, { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(500);
  const dest = path.join(OUT, shot.file);
  await page.screenshot({ path: dest, fullPage: true });
  console.log(dest);
}
await browser.close();
