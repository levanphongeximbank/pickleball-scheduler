/**
 * Tìm cổng local nào đang lưu bao nhiêu VĐV.
 * Chạy: node scripts/find-players-port.mjs
 */
import { chromium } from "playwright";

const PORTS = [5173, 5174, 5175, 5176, 5177, 5178, 5179, 5180, 3000, 4173];

const COUNT_PLAYERS = `(() => {
  const CLUBS_KEY = "pickleball-clubs-v1";
  const clubs = JSON.parse(localStorage.getItem(CLUBS_KEY) || "[]");
  const byClub = [];

  clubs.forEach((club) => {
    const key = "pickleball-club-data-v3::" + club.id;
    const raw = localStorage.getItem(key);
    if (!raw) {
      return;
    }
    const data = JSON.parse(raw);
    const count = Array.isArray(data.players) ? data.players.length : 0;
    byClub.push({ clubId: club.id, clubName: club.name, count });
  });

  const total = byClub.reduce((sum, item) => sum + item.count, 0);
  return { total, byClub, clubCount: clubs.length };
})()`;

async function checkPort(browser, port) {
  const url = `http://localhost:${port}`;
  const context = await browser.newContext();

  try {
    const page = await context.newPage();
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 5000 });
    const result = await page.evaluate(COUNT_PLAYERS);
    return { port, url, ok: true, ...result };
  } catch {
    return { port, url, ok: false };
  } finally {
    await context.close();
  }
}

async function main() {
  const target = Number(process.argv[2]) || 32;
  const browser = await chromium.launch({ headless: true });
  const results = [];

  try {
    for (const port of PORTS) {
      const result = await checkPort(browser, port);
      if (result.ok) {
        results.push(result);
      }
    }
  } finally {
    await browser.close();
  }

  if (results.length === 0) {
    console.log("Khong tim thay server dev nao dang chay.");
    return;
  }

  console.log("Ket qua quet localStorage theo cong:\n");
  results
    .sort((a, b) => a.port - b.port)
    .forEach((item) => {
      const clubs = item.byClub
        .map((club) => `${club.clubName}: ${club.count}`)
        .join(", ");
      console.log(`- ${item.url} => ${item.total} VDV (${clubs || "khong co CLB"})`);
    });

  const matches = results.filter((item) => item.total === target);
  console.log("");
  if (matches.length > 0) {
    console.log(`Tim thay ${target} VDV tai:`);
    matches.forEach((item) => console.log(`  => ${item.url}/players`));
  } else {
    console.log(`Khong co cong nao dang co dung ${target} VDV trong danh sach quet.`);
    const closest = [...results].sort(
      (a, b) => Math.abs(a.total - target) - Math.abs(b.total - target)
    )[0];
    if (closest) {
      console.log(`Gan nhat: ${closest.url} voi ${closest.total} VDV.`);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
