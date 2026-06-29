/**
 * Sao lưu danh sách VĐV từ localhost:5173 → xóa VĐV trên 5178 → ghi lại từ bản sao.
 * Chạy: node scripts/sync-players-5173-to-5178.mjs
 * (Cần: npm i -D playwright && npx playwright install chromium)
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { chromium } from "playwright";

const SOURCE = "http://localhost:5173";
const TARGET = "http://localhost:5178";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BACKUP_FILE = path.join(__dirname, "..", "players-backup-from-5173.json");

const EXTRACT_PLAYERS = `(() => {
  const CLUBS_KEY = "pickleball-clubs-v1";
  const ACTIVE_KEY = "pickleball-active-club-v1";
  const clubs = JSON.parse(localStorage.getItem(CLUBS_KEY) || "[]");
  const activeClubId = localStorage.getItem(ACTIVE_KEY) || "default-club";
  const playersByClub = {};

  clubs.forEach((club) => {
    const key = "pickleball-club-data-v3::" + club.id;
    const raw = localStorage.getItem(key);
    if (raw) {
      const data = JSON.parse(raw);
      playersByClub[club.id] = Array.isArray(data.players) ? data.players : [];
    }
  });

  return {
    source: location.origin,
    exportedAt: new Date().toISOString(),
    clubs,
    activeClubId,
    playersByClub,
  };
})()`;

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

function buildImportScript(backup) {
  return `(() => {
    const backup = ${JSON.stringify(backup)};
    const imported = [];

    Object.entries(backup.playersByClub || {}).forEach(([clubId, players]) => {
      const key = "pickleball-club-data-v3::" + clubId;
      const raw = localStorage.getItem(key);
      if (!raw) {
        imported.push({ clubId, ok: false, reason: "Khong tim thay du lieu CLB" });
        return;
      }
      const data = JSON.parse(raw);
      data.players = players;
      data.updatedAt = new Date().toISOString();
      localStorage.setItem(key, JSON.stringify(data));
      imported.push({ clubId, ok: true, count: players.length });
    });

    return imported;
  })()`;
}

async function main() {
  const browser = await chromium.launch({ headless: true });

  try {
    const sourceContext = await browser.newContext();
    const sourcePage = await sourceContext.newPage();
    await sourcePage.goto(SOURCE, { waitUntil: "domcontentloaded", timeout: 15000 });
    const backup = await sourcePage.evaluate(EXTRACT_PLAYERS);
    await sourceContext.close();

    fs.writeFileSync(BACKUP_FILE, JSON.stringify(backup, null, 2), "utf8");

    const totalSource = Object.values(backup.playersByClub).reduce(
      (sum, list) => sum + list.length,
      0
    );
    console.log(`Sao luu: ${BACKUP_FILE}`);
    console.log(`Nguon ${SOURCE}: ${totalSource} VDV / ${Object.keys(backup.playersByClub).length} CLB`);

    const targetContext = await browser.newContext();
    const targetPage = await targetContext.newPage();
    await targetPage.goto(TARGET, { waitUntil: "domcontentloaded", timeout: 15000 });

    const cleared = await targetPage.evaluate(CLEAR_ALL_PLAYERS);
    const removedTotal = cleared.reduce((sum, item) => sum + item.removed, 0);
    console.log(`Da xoa ${removedTotal} VDV tren ${TARGET}:`, cleared);

    const imported = await targetPage.evaluate(buildImportScript(backup));
    const importedTotal = imported
      .filter((item) => item.ok)
      .reduce((sum, item) => sum + item.count, 0);
    console.log(`Da nhap ${importedTotal} VDV vao ${TARGET}:`, imported);
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
