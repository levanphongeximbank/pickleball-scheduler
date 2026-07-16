import {
  CANONICAL_SCHEMA_VERSION,
  CanonicalValidationError,
  canonicalizeAwardsObject,
  canonicalizeDomainCollection,
  canonicalizeValue,
  normalizeCanonicalDate,
  normalizeCanonicalNumber,
  normalizeCanonicalString,
  normalizeCanonicalUuidString,
} from "./teamTournamentCanonicalRules.js";

const EMPTY_SCHEDULE_PUBLISH = Object.freeze({
  status: "draft",
  publishedAt: null,
  lockedAt: null,
  publishedBy: "",
  lockedBy: "",
});

const EMPTY_CLOSING = Object.freeze({
  closed: false,
  closedAt: null,
  closedBy: "",
  resultsLocked: false,
});

/**
 * @param {object} team
 * @returns {object}
 */
function canonicalizeTeamEntry(team) {
  const canonical = canonicalizeValue(team);
  const entry = {
    ...canonical,
    id: normalizeCanonicalUuidString(canonical.id),
    playerIds: canonicalizeDomainCollection("teamPlayerIds", canonical.playerIds || []),
    captainPlayerId: normalizeCanonicalUuidString(canonical.captainPlayerId),
    deputyPlayerIds: canonicalizeDomainCollection("teamPlayerIds", canonical.deputyPlayerIds || []),
  };
  if (canonical.avgLevel != null && canonical.avgLevel !== "") {
    entry.avgLevel = normalizeCanonicalNumber(canonical.avgLevel, { rating: true });
  }
  if (canonical.topPlayerRating != null && canonical.topPlayerRating !== "") {
    entry.topPlayerRating = normalizeCanonicalNumber(canonical.topPlayerRating, { rating: true });
  }
  if (canonical.totalRating != null && canonical.totalRating !== "") {
    entry.totalRating = normalizeCanonicalNumber(canonical.totalRating, { rating: true });
  }
  return entry;
}

/**
 * @param {object} [input]
 * @returns {object}
 */
export function buildCanonicalSetupSnapshot(input = {}) {
  const tournament = canonicalizeValue(input.tournament || {});
  const teams = (input.teams || []).map((team) => canonicalizeTeamEntry(team));
  const snapshot = {
    schemaVersion: CANONICAL_SCHEMA_VERSION,
    tournament: {
      ...tournament,
      id: normalizeCanonicalUuidString(tournament.id),
      version: Number(tournament.version) >= 1 ? Number(tournament.version) : 1,
    },
    teams: canonicalizeDomainCollection("teams", teams),
    rosterMembers: canonicalizeDomainCollection("rosterMembers", input.rosterMembers || []),
    captain: canonicalizeValue(input.captain || {}),
    deputies: canonicalizeDomainCollection("deputies", input.deputies || []),
    disciplines: canonicalizeDomainCollection("disciplines", input.disciplines || []),
    groups: canonicalizeDomainCollection("groups", input.groups || []),
    matchups: canonicalizeDomainCollection("matchups", input.matchups || []),
    subMatches: canonicalizeDomainCollection("subMatches", input.subMatches || []),
    schedule: canonicalizeDomainCollection("schedule", input.schedule || []),
    schedulePublish: canonicalizeValue(input.schedulePublish || EMPTY_SCHEDULE_PUBLISH),
    settings: canonicalizeValue(input.settings || {}),
    formatPreset: normalizeCanonicalString(input.formatPreset || input.settings?.formatPreset || "custom"),
    rosterRules: canonicalizeValue(input.rosterRules || input.settings?.rosterRules || {}),
    privatePairingEvidence: canonicalizeValue(input.privatePairingEvidence || {}),
    dreambreaker: canonicalizeValue(input.dreambreaker || {}),
    awards: canonicalizeAwardsObject(input.awards || {}),
    closing: canonicalizeValue(input.closing || EMPTY_CLOSING),
    engine: canonicalizeValue(input.engine || {}),
    rules: canonicalizeValue(input.rules || {}),
    actor: canonicalizeValue(input.actor || {}),
    generatedAt: normalizeCanonicalDate(input.generatedAt || new Date().toISOString()),
  };

  return canonicalizeValue(snapshot);
}

/**
 * @param {unknown} snapshot
 * @returns {{ ok: true } | { ok: false, code: string, error: string }}
 */
export function validateCanonicalSetupSnapshot(snapshot) {
  try {
    const value = canonicalizeValue(snapshot);
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return { ok: false, code: "VALIDATION_ERROR", error: "Snapshot không hợp lệ." };
    }
    if (Number(value.schemaVersion) !== CANONICAL_SCHEMA_VERSION) {
      return {
        ok: false,
        code: "VALIDATION_ERROR",
        error: `schemaVersion phải là ${CANONICAL_SCHEMA_VERSION}.`,
      };
    }
    if (!value.tournament?.id) {
      return { ok: false, code: "VALIDATION_ERROR", error: "Thiếu tournament.id." };
    }
    if (!Array.isArray(value.teams)) {
      return { ok: false, code: "VALIDATION_ERROR", error: "teams phải là mảng." };
    }
    if (!value.generatedAt) {
      return { ok: false, code: "VALIDATION_ERROR", error: "Thiếu generatedAt." };
    }
    return { ok: true };
  } catch (error) {
    if (error instanceof CanonicalValidationError) {
      return { ok: false, code: error.code, error: error.message };
    }
    return { ok: false, code: "VALIDATION_ERROR", error: error?.message || "Snapshot không hợp lệ." };
  }
}
