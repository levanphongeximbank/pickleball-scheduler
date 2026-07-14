import { ENTRY_STATUS, PAIR_TYPE } from "./constants.js";

const VALID_PAIR_TYPES = new Set(Object.values(PAIR_TYPE));
const VALID_ENTRY_STATUSES = new Set(Object.values(ENTRY_STATUS));

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizePairType(value) {
  const raw = String(value || "").trim().toLowerCase();
  return VALID_PAIR_TYPES.has(raw) ? raw : PAIR_TYPE.SAME_CLUB;
}

function normalizeEntryStatus(value) {
  const raw = String(value || ENTRY_STATUS.ACTIVE).trim().toLowerCase();
  return VALID_ENTRY_STATUSES.has(raw) ? raw : ENTRY_STATUS.ACTIVE;
}

export function isDrawEligibleEntry(entry) {
  const status = normalizeEntryStatus(entry?.status);
  return status === ENTRY_STATUS.APPROVED || status === ENTRY_STATUS.ACTIVE;
}

export function isCountableRegistrationEntry(entry) {
  const status = normalizeEntryStatus(entry?.status);
  return (
    status === ENTRY_STATUS.PENDING ||
    status === ENTRY_STATUS.APPROVED ||
    status === ENTRY_STATUS.ACTIVE ||
    status === ENTRY_STATUS.WAITLISTED
  );
}

export function isWithdrawnEntry(entry) {
  return normalizeEntryStatus(entry?.status) === ENTRY_STATUS.WITHDRAWN;
}

export function normalizeEntry(entry, index = 0) {
  if (!entry || entry.id === undefined || entry.id === null) {
    return null;
  }

  const playerIds = Array.isArray(entry.playerIds)
    ? entry.playerIds.map((id) => String(id).trim()).filter(Boolean)
    : [];

  return {
    ...entry,
    id: String(entry.id).trim(),
    tournamentId: entry.tournamentId ? String(entry.tournamentId).trim() : "",
    eventId: entry.eventId ? String(entry.eventId).trim() : "",
    name: String(entry.name || "").trim() || `Đội ${index + 1}`,
    playerIds,
    representativeClubName: entry.representativeClubName
      ? String(entry.representativeClubName).trim()
      : "",
    pairType: normalizePairType(entry.pairType),
    rating: toNumber(entry.rating, 0),
    seed: entry.seed != null ? Number(entry.seed) : null,
    groupId: entry.groupId ? String(entry.groupId).trim() : "",
    clubName: entry.clubName ? String(entry.clubName).trim() : "",
    unitName: entry.unitName ? String(entry.unitName).trim() : "",
    status: normalizeEntryStatus(entry.status),
    waitlistPosition:
      entry.waitlistPosition != null && Number.isFinite(Number(entry.waitlistPosition))
        ? Number(entry.waitlistPosition)
        : null,
    partnerInviteToken: entry.partnerInviteToken
      ? String(entry.partnerInviteToken).trim()
      : "",
    registeredAt: entry.registeredAt || null,
    decidedAt: entry.decidedAt || null,
    decidedBy: entry.decidedBy ? String(entry.decidedBy).trim() : "",
    cancelledAt: entry.cancelledAt || null,
    rejectionReason: entry.rejectionReason ? String(entry.rejectionReason).trim() : "",
  };
}

export function normalizeEntries(entries = []) {
  if (!Array.isArray(entries)) {
    return [];
  }

  return entries
    .map((entry, index) => normalizeEntry(entry, index))
    .filter(Boolean);
}

export function createEntryRecord(options = {}) {
  return normalizeEntry({
    id: options.id || `entry-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    tournamentId: options.tournamentId || "",
    eventId: options.eventId || "",
    name: options.name || "",
    playerIds: options.playerIds || [],
    representativeClubName: options.representativeClubName || "",
    pairType: options.pairType || PAIR_TYPE.SAME_CLUB,
    rating: options.rating ?? 0,
    seed: options.seed ?? null,
    groupId: options.groupId || "",
    clubName: options.clubName || "",
    unitName: options.unitName || "",
    status: options.status || ENTRY_STATUS.ACTIVE,
    waitlistPosition: options.waitlistPosition ?? null,
    partnerInviteToken: options.partnerInviteToken || "",
    registeredAt: options.registeredAt || null,
    decidedAt: options.decidedAt || null,
    decidedBy: options.decidedBy || "",
    cancelledAt: options.cancelledAt || null,
    rejectionReason: options.rejectionReason || "",
  });
}
