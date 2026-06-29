/**
 * Xóa hết VĐV trong localStorage của một cổng dev local.
 * Chạy: node scripts/clear-players-local.mjs [port]
 */
import { chromium } from "playwright";

const port = process.argv[2] || "5178";
const TARGET = `http://localhost:${port}`;

const CLEAR_ALL_PLAYERS = `(() => {
  const CLUBS_KEY = "pickleball-clubs-v1";
  const clubs = JSON.parse(localStorage.getItem(CLUBS_KEY) || "[]");
  const cleared = [];

  clubs.forEach((club) => {
    const key = "pickleball-club-data-v3::" + club.id;
    const raw = localStorage.getItem(key);
    if (!raw) {
      return;
    }
    const data = JSON.parse(raw);
    const before = Array.isArray(data.players) ? data.players.length : 0;
    data.players = [];
    data.updatedAt = new Date().toISOString();
    localStorage.setItem(key, JSON.stringify(data));
    cleared.push({ clubId: club.id, clubName: club.name, removed: before });
  });

  return cleared;
})()`;

async function main() {
  const browser = await chromium.launch({ headless: true });

  try {
    const page = await browser.newPage();
    await page.goto(TARGET, { waitUntil: "domcontentloaded", timeout: 15000 });
    const cleared = await page.evaluate(CLEAR_ALL_PLAYERS);
    const removedTotal = cleared.reduce((sum, item) => sum + item.removed, 0);
    console.log(`Da xoa ${removedTotal} VDV tren ${TARGET}:`, cleared);
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
