import { getScopedStorageKey, loadClubs } from "./club.js";
import { buildDemoPlayers, DEMO_PLAYER_COUNT } from "./samplePlayers.js";

const PLAYERS_KEY = "players";
const COURTS_KEY = "courts";
const DEMO_SEED_MARKER = "pickleball-demo-seeded-v1";

function buildDemoCourts(count = 8) {
  return Array.from({ length: count }, (_, index) => {
    const number = index + 1;
    return {
      id: number,
      name: `Sân ${number}`,
      number,
      active: true,
    };
  });
}

function readPlayerCount() {
  const raw =
    localStorage.getItem(getScopedStorageKey(PLAYERS_KEY)) ||
    localStorage.getItem(PLAYERS_KEY);

  if (!raw) {
    return 0;
  }

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.length : 0;
  } catch {
    return 0;
  }
}

function shouldSeedDemoData() {
  if (!import.meta.env.DEV) {
    return false;
  }

  if (import.meta.env.VITE_SEED_DEMO === "false") {
    return false;
  }

  if (import.meta.env.VITE_SEED_DEMO === "force") {
    return true;
  }

  if (typeof window !== "undefined") {
    const params = new URLSearchParams(window.location.search);
    if (params.get("seed") === "demo") {
      return true;
    }
  }

  return readPlayerCount() < DEMO_PLAYER_COUNT;
}

export function seedDemoDataForDev() {
  if (!shouldSeedDemoData()) {
    return false;
  }

  loadClubs();

  const players = buildDemoPlayers(DEMO_PLAYER_COUNT);
  const courts = buildDemoCourts(8);
  const playersKey = getScopedStorageKey(PLAYERS_KEY);
  const courtsKey = getScopedStorageKey(COURTS_KEY);

  localStorage.setItem(playersKey, JSON.stringify(players));
  localStorage.setItem(courtsKey, JSON.stringify(courts));
  localStorage.setItem(DEMO_SEED_MARKER, String(Date.now()));

  return true;
}
