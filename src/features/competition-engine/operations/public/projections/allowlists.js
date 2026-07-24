/**
 * Public field allowlists — never spread canonical objects to public surfaces.
 */

/** @type {ReadonlyArray<string>} */
export const PUBLIC_OVERVIEW_FIELDS = Object.freeze([
  "competitionId",
  "tenantId",
  "publicTitle",
  "branding",
  "venue",
  "dates",
  "divisions",
  "publicationStatus",
  "availability",
  "templateId",
  "formatLabel",
]);

/** @type {ReadonlyArray<string>} */
export const PUBLIC_PARTICIPANT_FIELDS = Object.freeze([
  "participantId",
  "displayName",
  "seedNumber",
  "divisionId",
  "categoryId",
  "status",
]);

/** @type {ReadonlyArray<string>} */
export const PUBLIC_SCHEDULE_MATCH_FIELDS = Object.freeze([
  "matchId",
  "divisionId",
  "stage",
  "round",
  "scheduledTime",
  "timezone",
  "venueId",
  "venueName",
  "courtId",
  "courtName",
  "status",
  "participantIds",
  "participantLabels",
]);

/** @type {ReadonlyArray<string>} */
export const PUBLIC_COURT_FIELDS = Object.freeze([
  "courtId",
  "courtName",
  "venueId",
  "venueName",
  "publicLabel",
]);

/** @type {ReadonlyArray<string>} */
export const PUBLIC_POOL_GROUP_FIELDS = Object.freeze([
  "groupId",
  "groupLabel",
  "participantIds",
  "participantLabels",
]);

/** @type {ReadonlyArray<string>} */
export const PUBLIC_STANDING_ROW_FIELDS = Object.freeze([
  "participantId",
  "displayName",
  "groupId",
  "rank",
  "played",
  "wins",
  "losses",
  "points",
  "pointDiff",
  "qualificationStatus",
]);

/** @type {ReadonlyArray<string>} */
export const PUBLIC_QUALIFIER_FIELDS = Object.freeze([
  "participantId",
  "displayName",
  "groupId",
  "seedSlot",
  "status",
]);

/** @type {ReadonlyArray<string>} */
export const PUBLIC_BRACKET_SLOT_FIELDS = Object.freeze([
  "slotId",
  "roundId",
  "roundLabel",
  "position",
  "participantId",
  "displayName",
  "isBye",
  "isPlaceholder",
  "winnerOfMatchId",
  "status",
]);

/** @type {ReadonlyArray<string>} */
export const PUBLIC_MATCH_CENTER_FIELDS = Object.freeze([
  "matchId",
  "divisionId",
  "stage",
  "round",
  "participants",
  "scheduledTime",
  "timezone",
  "venue",
  "court",
  "status",
  "score",
  "validatedResult",
  "nextMatchId",
  "updateVersion",
]);

/** @type {ReadonlyArray<string>} */
export const PUBLIC_FINAL_RESULT_FIELDS = Object.freeze([
  "participantId",
  "displayName",
  "placement",
  "award",
]);

/** Forbidden keys that must never appear on public projections. */
export const PUBLIC_FORBIDDEN_KEYS = Object.freeze([
  "email",
  "phone",
  "contact",
  "audit",
  "auditPayload",
  "permissions",
  "grantedPermissions",
  "allowedOrganizerActions",
  "deniedOrganizerActions",
  "blockingIssues",
  "diagnostics",
  "concurrencyDiagnostics",
  "capacityDiagnostics",
  "internalNotes",
  "refereeContact",
  "refereePhone",
  "refereeEmail",
  "privateProfile",
  "identityEvidence",
  "authz",
  "clientGrants",
]);

/**
 * @param {object|null|undefined} source
 * @param {ReadonlyArray<string>} allowlist
 * @returns {Record<string, unknown>}
 */
export function pickAllowlisted(source, allowlist) {
  /** @type {Record<string, unknown>} */
  const out = {};
  if (!source || typeof source !== "object") return out;
  const set = new Set(allowlist);
  for (const key of Object.keys(source)) {
    if (!set.has(key)) continue;
    if (PUBLIC_FORBIDDEN_KEYS.includes(key)) continue;
    out[key] = /** @type {Record<string, unknown>} */ (source)[key];
  }
  return out;
}

/**
 * Recursively strip forbidden keys from a plain object/array tree.
 * @param {unknown} value
 * @returns {unknown}
 */
export function stripForbiddenKeys(value) {
  if (value == null) return value;
  if (Array.isArray(value)) {
    return value.map((item) => stripForbiddenKeys(item));
  }
  if (typeof value !== "object") return value;
  /** @type {Record<string, unknown>} */
  const out = {};
  for (const [key, child] of Object.entries(
    /** @type {Record<string, unknown>} */ (value)
  )) {
    if (PUBLIC_FORBIDDEN_KEYS.includes(key)) continue;
    out[key] = stripForbiddenKeys(child);
  }
  return out;
}
