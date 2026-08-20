import { normalizeClub, createClubRecord } from "../models/club.js";
import { isDemoSeedClubId, shouldHideDemoSeedData } from "../demo/seed/demoSeedRegistry.js";

const CLUBS_KEY = "pickleball-clubs-v1";
const ACTIVE_CLUB_KEY = "pickleball-active-club-v1";

/**
 * Local/offline fixture identity. NOT an authority Club.
 * Wave 5: must never be auto-inserted into the registry or persisted as a
 * fabricated operational target merely because the registry is empty.
 */
export const DEFAULT_CLUB = normalizeClub({
  id: "default-club",
  name: "CLB Mac dinh",
  isDefault: true,
});

function safeParseArray(raw, fallback = []) {
  if (!raw) {
    return fallback;
  }

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function migrateClubRecord(club) {
  const normalized = normalizeClub(club);

  if (normalized.id === DEFAULT_CLUB.id) {
    return { ...normalized, isDefault: true };
  }

  const governance = { ...normalized.governance };
  if (!governance.presidentUserId && normalized.createdByUserId) {
    governance.presidentUserId = normalized.createdByUserId;
  }
  if (!Array.isArray(governance.registeredCourtIds)) {
    governance.registeredCourtIds = [];
  }
  if (governance.registeredClusterId == null) {
    governance.registeredClusterId = null;
  }

  return {
    ...normalized,
    governance,
    status:
      normalized.status === "inactive"
        ? "inactive"
        : normalized.status === "pending_approval"
          ? "pending_approval"
        : normalized.status === "pending_setup" && governance.presidentUserId
          ? "active"
          : normalized.status,
  };
}

/**
 * Local registry reader for no-cloud compatibility.
 * Does not fabricate default-club when empty.
 * Does not create Club existence from a preference.
 */
export function loadClubs() {
  const raw = localStorage.getItem(CLUBS_KEY);
  const parsed = safeParseArray(raw, []);
  const normalized = parsed
    .map(migrateClubRecord)
    .filter((club) => club.id !== "" && club.name !== "");

  return filterDemoClubs(normalized);
}

function filterDemoClubs(clubs) {
  if (!shouldHideDemoSeedData()) {
    return clubs;
  }

  return clubs.filter((club) => !isDemoSeedClubId(club.id));
}

export function saveClubs(clubs) {
  const normalized = clubs
    .map(migrateClubRecord)
    .filter((club) => club.id !== "" && club.name !== "");

  localStorage.setItem(CLUBS_KEY, JSON.stringify(normalized));
}

/**
 * @deprecated Preference-only. Does not prove Club exists, is eligible, or
 * belongs to the selected Tenant. Never fabricates default-club.
 * Domain services must take an explicit clubId — do not use this as a default.
 */
export function getActiveClubId() {
  return getActiveClubIdPreference();
}

/**
 * Persist a Club id as a UI preference only.
 * Does not require local-blob existence (canonical/cloud clubs can be selected).
 * Does not create a Club record.
 */
export function setActiveClubId(clubId) {
  return setActiveClubIdPreference(clubId);
}

/**
 * Read the persisted active-club id as a PREFERENCE only (no local-blob
 * existence check, no default-club coercion). Canonical read mode validates
 * this against the canonical visible set — localStorage never grants existence.
 * @returns {string|null}
 */
export function getActiveClubIdPreference() {
  const raw = localStorage.getItem(ACTIVE_CLUB_KEY);
  const trimmed = String(raw || "").trim();
  return trimmed || null;
}

/**
 * Persist the active-club id as a PREFERENCE only. Unlike a registry write this
 * does NOT create Club existence. The canonical visible set remains the
 * existence/access authority; this is a UI preference write.
 * @param {string} clubId
 * @returns {boolean}
 */
export function setActiveClubIdPreference(clubId) {
  const normalizedId = String(clubId || "").trim();
  if (!normalizedId) {
    return false;
  }
  localStorage.setItem(ACTIVE_CLUB_KEY, normalizedId);
  return true;
}

/**
 * Clear the persisted active-club preference (tenant switch / logout).
 * Preference is never authorization authority — clearing prevents cross-tenant leak.
 */
export function clearActiveClubIdPreference() {
  localStorage.removeItem(ACTIVE_CLUB_KEY);
}

/**
 * Local-registry lookup of the preference. Returns null when the preferred
 * Club is not in the local registry — never fabricates DEFAULT_CLUB.
 */
export function getActiveClub() {
  const activeId = getActiveClubIdPreference();
  if (!activeId) {
    return null;
  }
  return loadClubs().find((club) => club.id === activeId) || null;
}

export function addClub(name) {
  const trimmed = String(name || "").trim();

  if (trimmed === "") {
    return { ok: false, error: "Ten CLB khong duoc de trong." };
  }

  const clubs = loadClubs();
  const club = createClubRecord(trimmed);
  const next = [...clubs, club];
  saveClubs(next);

  return { ok: true, club };
}

export function removeClub(clubId) {
  if (clubId === DEFAULT_CLUB.id) {
    return { ok: false, error: "Khong the xoa CLB mac dinh." };
  }

  const clubs = loadClubs();
  const next = clubs.filter((club) => club.id !== clubId);

  if (next.length === clubs.length) {
    return { ok: false, error: "Khong tim thay CLB can xoa." };
  }

  saveClubs(next);

  if (getActiveClubIdPreference() === clubId) {
    clearActiveClubIdPreference();
  }

  return { ok: true };
}

export function getScopedStorageKey(baseKey, clubId) {
  const id = String(clubId || "").trim();
  if (!id) {
    throw new Error("CLUB_REQUIRED — scoped storage key needs an explicit clubId.");
  }
  return `${baseKey}::${id}`;
}

export { normalizeClub };
