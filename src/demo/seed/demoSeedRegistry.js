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
  return localStorage.getItem(DEMO_SEED_DISABLED_KEY) === "1";
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
