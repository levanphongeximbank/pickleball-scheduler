/** PR-4.25 — shared result / identity contracts for canonical repositories. */

export const CANONICAL_SOURCE = Object.freeze({
  V2_REGISTRY: "v2_registry",
  MEMBERSHIP_SSOT: "membership_ssot",
  LEGACY_BLOB: "legacy_blob",
  HYBRID: "hybrid",
});

export const MAPPING_STATUS = Object.freeze({
  MAPPED: "MAPPED",
  DERIVED: "DERIVED",
  UNMAPPED: "UNMAPPED",
  INVALID: "INVALID",
});

export const CANONICAL_WARNING_CODE = Object.freeze({
  UNMAPPED_ACTIVE_MEMBER: "UNMAPPED_ACTIVE_MEMBER",
  INVALID_PLAYER_MAPPING: "INVALID_PLAYER_MAPPING",
  DUPLICATE_MEMBERSHIP_HISTORY: "DUPLICATE_MEMBERSHIP_HISTORY",
  PLAYER_OUTSIDE_CLUB: "PLAYER_OUTSIDE_CLUB",
  PLAYER_OUTSIDE_TENANT: "PLAYER_OUTSIDE_TENANT",
  PLAYER_MAPPING_REQUIRED: "PLAYER_MAPPING_REQUIRED",
  DEFAULT_CLUB_EXCLUDED: "DEFAULT_CLUB_EXCLUDED",
});

/** Local registry demo club — never a Production V2 source club. */
export const LOCAL_DEFAULT_CLUB_ID = "default-club";

export const ACTIVE_MEMBERSHIP_STATUSES = Object.freeze(["active"]);

export const NON_PICKER_MEMBERSHIP_STATUSES = Object.freeze([
  "left",
  "removed",
  "rejected",
  "pending",
]);

/**
 * @typedef {object} CanonicalRepoWarning
 * @property {string} code
 * @property {string} [message]
 * @property {Record<string, unknown>} [meta]
 */

/**
 * @typedef {object} MappingSummary
 * @property {number} totalMembers
 * @property {number} activeMembers
 * @property {number} mappedPlayers
 * @property {number} derivedPlayers
 * @property {number} unmappedMembers
 * @property {number} invalidMappings
 * @property {number} duplicatesRemoved
 */

/**
 * @param {Partial<MappingSummary>} [partial]
 * @returns {MappingSummary}
 */
export function emptyMappingSummary(partial = {}) {
  return {
    totalMembers: 0,
    activeMembers: 0,
    mappedPlayers: 0,
    derivedPlayers: 0,
    unmappedMembers: 0,
    invalidMappings: 0,
    duplicatesRemoved: 0,
    ...partial,
  };
}

/**
 * @template T
 * @param {object} params
 * @param {T} params.data
 * @param {string} params.source
 * @param {CanonicalRepoWarning[]} [params.warnings]
 * @param {MappingSummary} [params.mappingSummary]
 * @param {Record<string, unknown>} [params.execution]
 */
export function buildRepoResult({
  data,
  source,
  warnings = [],
  mappingSummary = emptyMappingSummary(),
  execution = {},
}) {
  return {
    ok: true,
    data,
    source,
    warnings,
    mappingSummary,
    execution: {
      at: new Date().toISOString(),
      ...execution,
    },
  };
}

/**
 * @param {object} params
 * @param {string} params.code
 * @param {string} [params.message]
 * @param {string} [params.source]
 * @param {CanonicalRepoWarning[]} [params.warnings]
 */
export function buildRepoError({
  code,
  message,
  source = CANONICAL_SOURCE.HYBRID,
  warnings = [],
}) {
  return {
    ok: false,
    code,
    message: message || code,
    data: null,
    source,
    warnings,
    mappingSummary: emptyMappingSummary(),
    execution: { at: new Date().toISOString() },
  };
}

/**
 * Canonical player ID from auth user — established convention (platformAthleteService).
 * @param {string} authUserId
 */
export function buildDerivedAuthPlayerId(authUserId) {
  const safe = String(authUserId || "")
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, "");
  return safe ? `player-auth-${safe}` : "";
}

/**
 * @param {unknown} club
 * @returns {boolean}
 */
export function isLocalDefaultClub(club) {
  const id = String(club?.id || club || "").trim();
  if (id === LOCAL_DEFAULT_CLUB_ID) return true;
  if (club && typeof club === "object" && club.isDefault === true) return true;
  const name = String(club?.name || "").trim().toLowerCase();
  return name === "clb mặc định" || name === "clb mac dinh";
}
