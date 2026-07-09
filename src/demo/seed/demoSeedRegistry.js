export const DEMO_SEED_DISABLED_KEY = "pickleball-demo-seed-disabled-v1";
export const MULTI_TENANT_SEED_MARKER = "pickleball-multi-tenant-seed-v1";
export const CLUB_MANAGEMENT_SEED_MARKER = "pickleball-club-management-seed-v1";

/** Tenant demo từ multiTenantSeed — giữ đồng bộ với SEED_TENANTS. */
export const DEMO_SEED_TENANT_IDS = Object.freeze([
  "tenant-future-arena",
  "tenant-abc-pickleball",
  "tenant-elite-club",
]);

/** CLB demo — multi-tenant seed, club management seed, roster demo. */
export const DEMO_SEED_CLUB_IDS = Object.freeze([
  "club-future-arena",
  "club-abc-pickleball",
  "club-elite-club",
  "club-future-a",
  "club-future-b",
  "club-future-c",
  "demo-club-saigon",
  "demo-club-hanoi",
  "demo-club-danang",
  "demo-club-cantho",
]);

export function isDemoSeedDisabled() {
  if (import.meta.env?.PROD) {
    return true;
  }

  return localStorage.getItem(DEMO_SEED_DISABLED_KEY) === "1";
}

export function isDemoSeedClubId(clubId) {
  const id = String(clubId || "").trim();
  return id !== "" && DEMO_SEED_CLUB_IDS.includes(id);
}

export function isDemoSeedPlayer(player, clubId = null) {
  if (!player) {
    return false;
  }

  const resolvedClubId = clubId || player.sourceClubId || player.clubId || "";
  if (isDemoSeedClubId(resolvedClubId)) {
    return true;
  }

  const playerId = String(player.id || "");
  if (
    /^(abc_pickleball|future_arena|elite_club)-player-\d+$/.test(playerId) ||
    /^FA-[ABC]-cm-player-\d+$/.test(playerId) ||
    /^demo-club-[a-z]+-vdv-\d+$/.test(playerId)
  ) {
    return true;
  }

  const name = String(player.name || "").trim();
  if (/^(abc_pickleball|future_arena|elite_club|FA-[ABC]) VĐV \d+$/.test(name)) {
    return true;
  }

  if (String(player.note || "").startsWith("Demo ")) {
    return true;
  }

  return false;
}

export function shouldHideDemoSeedData() {
  return isDemoSeedDisabled();
}

export function disableDemoSeedAutoApply() {
  localStorage.setItem(DEMO_SEED_DISABLED_KEY, "1");
  localStorage.removeItem(MULTI_TENANT_SEED_MARKER);
  localStorage.removeItem(CLUB_MANAGEMENT_SEED_MARKER);
}

export function getDemoSeedTenantIds() {
  return [...DEMO_SEED_TENANT_IDS];
}

export function getDemoSeedClubIds() {
  return [...DEMO_SEED_CLUB_IDS];
}

const DEMO_STORAGE_KEY_FRAGMENTS = [
  ...DEMO_SEED_CLUB_IDS,
  ...DEMO_SEED_TENANT_IDS,
  "abc_pickleball",
  "future_arena",
  "elite_club",
  "demo-club-",
  "FA-A-cm-player",
  "FA-B-cm-player",
  "FA-C-cm-player",
];

/** Quét toàn bộ localStorage và xóa mọi key liên quan demo. */
export function purgeAllDemoStorageKeys() {
  let removed = 0;

  for (const key of Object.keys(localStorage)) {
    if (DEMO_STORAGE_KEY_FRAGMENTS.some((fragment) => key.includes(fragment))) {
      localStorage.removeItem(key);
      removed += 1;
    }
  }

  return removed;
}
