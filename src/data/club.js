import { normalizeClub, createClubRecord } from "../models/club.js";

const CLUBS_KEY = "pickleball-clubs-v1";
const ACTIVE_CLUB_KEY = "pickleball-active-club-v1";

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

  return normalized;
}

export function loadClubs() {
  const raw = localStorage.getItem(CLUBS_KEY);
  const parsed = safeParseArray(raw, []);
  const normalized = parsed
    .map(migrateClubRecord)
    .filter((club) => club.id !== "" && club.name !== "");

  if (normalized.length === 0) {
    localStorage.setItem(CLUBS_KEY, JSON.stringify([DEFAULT_CLUB]));
    return [DEFAULT_CLUB];
  }

  if (!normalized.some((club) => club.id === DEFAULT_CLUB.id)) {
    const withDefault = [DEFAULT_CLUB, ...normalized];
    localStorage.setItem(CLUBS_KEY, JSON.stringify(withDefault));
    return withDefault;
  }

  return normalized;
}

export function saveClubs(clubs) {
  const normalized = clubs
    .map(migrateClubRecord)
    .filter((club) => club.id !== "" && club.name !== "");

  const withDefault = normalized.some((club) => club.id === DEFAULT_CLUB.id)
    ? normalized
    : [DEFAULT_CLUB, ...normalized];

  localStorage.setItem(CLUBS_KEY, JSON.stringify(withDefault));
}

export function getActiveClubId() {
  const clubs = loadClubs();
  const raw = localStorage.getItem(ACTIVE_CLUB_KEY);

  if (!raw) {
    localStorage.setItem(ACTIVE_CLUB_KEY, DEFAULT_CLUB.id);
    return DEFAULT_CLUB.id;
  }

  if (clubs.some((club) => club.id === raw)) {
    return raw;
  }

  localStorage.setItem(ACTIVE_CLUB_KEY, DEFAULT_CLUB.id);
  return DEFAULT_CLUB.id;
}

export function setActiveClubId(clubId) {
  const clubs = loadClubs();
  const normalizedId = String(clubId || "").trim();

  if (clubs.some((club) => club.id === normalizedId)) {
    localStorage.setItem(ACTIVE_CLUB_KEY, normalizedId);
    return true;
  }

  return false;
}

export function getActiveClub() {
  const activeId = getActiveClubId();
  return loadClubs().find((club) => club.id === activeId) || DEFAULT_CLUB;
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

  if (getActiveClubId() === clubId) {
    setActiveClubId(DEFAULT_CLUB.id);
  }

  return { ok: true };
}

export function getScopedStorageKey(baseKey, clubId = getActiveClubId()) {
  return `${baseKey}::${clubId}`;
}

export { normalizeClub };
