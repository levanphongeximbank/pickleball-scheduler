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

function readStoredArrayLength(storageKey) {
  const raw =
    localStorage.getItem(getScopedStorageKey(storageKey)) ||
    localStorage.getItem(storageKey);

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

export function isDemoStorageEmpty() {
  return (
    readStoredArrayLength(PLAYERS_KEY) === 0 &&
    readStoredArrayLength(COURTS_KEY) === 0
  );
}

function isSeedDemoExplicitlyEnabled() {
  return import.meta.env.VITE_SEED_DEMO === "true";
}

function isSeedDemoForceInTest() {
  return import.meta.env.MODE === "test" && import.meta.env.VITE_SEED_DEMO === "force";
}

function shouldAutoSeedDemoData() {
  if (!import.meta.env.DEV && !isSeedDemoForceInTest()) {
    return false;
  }

  if (import.meta.env.VITE_SEED_DEMO === "false") {
    return false;
  }

  if (isSeedDemoForceInTest()) {
    return true;
  }

  if (!isSeedDemoExplicitlyEnabled()) {
    return false;
  }

  return isDemoStorageEmpty();
}

function applyDemoSeed() {
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

export function seedDemoDataForDev() {
  if (!shouldAutoSeedDemoData()) {
    return false;
  }

  if (!isSeedDemoForceInTest() && !isDemoStorageEmpty()) {
    return false;
  }

  return applyDemoSeed();
}

export function seedDemoDataManually({ force = false } = {}) {
  if (!import.meta.env.DEV) {
    return { ok: false, error: "Chỉ dùng trong môi trường dev." };
  }

  if (!force && !isDemoStorageEmpty()) {
    return {
      ok: false,
      error:
        "Đã có người chơi hoặc sân. Chỉ seed khi dữ liệu trống, hoặc chọn ghi đè trong hộp thoại xác nhận.",
    };
  }

  applyDemoSeed();
  return {
    ok: true,
    message: `Đã tạo ${DEMO_PLAYER_COUNT} người chơi demo và 8 sân.`,
  };
}
