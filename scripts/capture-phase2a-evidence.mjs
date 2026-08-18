import { mkdirSync } from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const BASE = process.env.PHASE2A_BASE || "http://localhost:5174";
const OUT = path.resolve("docs/v5/qa-evidence/tournament-experience-phase2a");
mkdirSync(OUT, { recursive: true });

const shots = [
  { file: "01_DESKTOP_1440.png", path: "/ux-prototype/tournament-experience", width: 1440, height: 900 },
  { file: "01_MOBILE_390.png", path: "/ux-prototype/tournament-experience", width: 390, height: 844 },
  { file: "02_DESKTOP_1440.png", path: "/ux-prototype/tournament-experience/t/pick-vn-open-2026", width: 1440, height: 900 },
  { file: "02_MOBILE_390.png", path: "/ux-prototype/tournament-experience/t/pick-vn-open-2026", width: 390, height: 844 },
  { file: "04_DESKTOP_1440.png", path: "/ux-prototype/tournament-experience/t/pick-vn-open-2026/registration", width: 1440, height: 900 },
  { file: "04_MOBILE_390.png", path: "/ux-prototype/tournament-experience/t/pick-vn-open-2026/registration", width: 390, height: 844 },
];

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
for (const shot of shots) {
  await page.setViewportSize({ width: shot.width, height: shot.height });
  await page.goto(`${BASE}${shot.path}`, { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(600);
  const dest = path.join(OUT, shot.file);
  await page.screenshot({ path: dest, fullPage: true });
  console.log(dest);
}
await browser.close();
