import { mkdirSync } from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const BASE = process.env.PHASE2B_BASE || "http://localhost:5174";
const OUT = path.resolve("docs/v5/qa-evidence/tournament-experience-phase2b");
mkdirSync(OUT, { recursive: true });

const shots = [
  { file: "03_DESKTOP_1440.png", path: "/ux-prototype/tournament-experience/t/pick-vn-open-2026/settings", width: 1440, height: 900 },
  { file: "03_TABLET_768.png", path: "/ux-prototype/tournament-experience/t/pick-vn-open-2026/settings", width: 768, height: 1024 },
  { file: "03_MOBILE_390.png", path: "/ux-prototype/tournament-experience/t/pick-vn-open-2026/settings", width: 390, height: 844 },
  { file: "05_DESKTOP_1440.png", path: "/ux-prototype/tournament-experience/t/pick-vn-open-2026/participants", width: 1440, height: 900 },
  { file: "05_TABLET_768.png", path: "/ux-prototype/tournament-experience/t/pick-vn-open-2026/participants", width: 768, height: 1024 },
  { file: "05_MOBILE_390.png", path: "/ux-prototype/tournament-experience/t/pick-vn-open-2026/participants", width: 390, height: 844 },
];

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
for (const shot of shots) {
  await page.setViewportSize({ width: shot.width, height: shot.height });
  await page.goto(`${BASE}${shot.path}`, { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(400);
  if (shot.file.startsWith("03_")) {
    await page.getByRole("button", { name: "Nội dung", exact: true }).click();
    await page.waitForTimeout(400);
  }
  const dest = path.join(OUT, shot.file);
  await page.screenshot({ path: dest, fullPage: true });
  console.log(dest);
}
await browser.close();
