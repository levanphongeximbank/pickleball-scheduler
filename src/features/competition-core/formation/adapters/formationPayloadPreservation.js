import { cloneLegacyFormationPayload } from "./legacyFormationPayloadMappers.js";

const PRESERVED_TOP_LEVEL_KEYS = [
  "strategyKey",
  "legacyStrategyKey",
  "sessionId",
  "clubId",
  "eventId",
  "venueId",
  "randomSeed",
  "randomFn",
  "players",
  "constraints",
  "options",
];

const PRESERVED_PLAYER_KEYS = [
  "id",
  "name",
  "rating",
  "level",
  "gender",
  "checkedIn",
  "busy",
  "restUntil",
  "partnerPreference",
  "avoidPartners",
  "avoidOpponents",
  "clubId",
  "organizationId",
];

const SECRET_PATTERNS = [
  /token/i,
  /password/i,
  /secret/i,
  /service.?role/i,
  /refresh/i,
  /access.?key/i,
];

/**
 * @param {import('./legacyFormationPayloadMappers.js').LegacyFormationPayload} payload
 * @returns {{ preserved: boolean, warnings: string[], unmappedFields: string[] }}
 */
export function verifyFormationPayloadPreservation(payload = {}) {
  const cloned = cloneLegacyFormationPayload(payload);
  const warnings = [];
  const unmappedFields = [];

  for (const key of Object.keys(payload)) {
    if (!PRESERVED_TOP_LEVEL_KEYS.includes(key) && key !== "courts" && key !== "rounds") {
      if (payload[key] !== undefined) {
        unmappedFields.push(key);
        warnings.push(`UNMAPPED_LEGACY_FIELD:${key}`);
      }
      if (payload[key] !== undefined && cloned[key] === undefined) {
        warnings.push(`DROPPED_LEGACY_FIELD:${key}`);
      }
    }
  }

  if (payload.options?.playersById instanceof Map) {
    if (!(cloned.options?.playersById instanceof Map)) {
      warnings.push("MAP_NOT_PRESERVED:options.playersById");
    } else if (cloned.options.playersById !== payload.options.playersById) {
      warnings.push("MAP_REFERENCE_CHANGED:options.playersById");
    }
  }

  if (typeof payload.randomFn === "function") {
    if (cloned.randomFn !== payload.randomFn) {
      warnings.push("RANDOM_FN_REFERENCE_CHANGED:payload.randomFn");
    }
  }

  if (typeof payload.options?.randomFn === "function") {
    if (cloned.options?.randomFn !== payload.options.randomFn) {
      warnings.push("RANDOM_FN_REFERENCE_CHANGED:options.randomFn");
    }
  }

  const players = payload.players || [];
  for (const player of players) {
    for (const key of Object.keys(player)) {
      if (!PRESERVED_PLAYER_KEYS.includes(key) && !key.startsWith("_")) {
        const clonedPlayer = cloned.players?.find((p) => String(p.id) === String(player.id));
        if (clonedPlayer && clonedPlayer[key] === undefined && player[key] !== undefined) {
          unmappedFields.push(`player.${player.id}.${key}`);
        }
      }
    }
  }

  const preserved =
    warnings.filter((w) => w.startsWith("DROPPED_LEGACY_FIELD")).length === 0;

  return {
    preserved: preserved && unmappedFields.length === 0,
    warnings,
    unmappedFields,
  };
}

/**
 * Collect extension fields stored in options for canonical round-trip.
 *
 * @param {import('./legacyFormationPayloadMappers.js').LegacyFormationPayload} payload
 */
export function extractLegacyPayloadExtensions(payload = {}) {
  const extensions = {};
  for (const key of Object.keys(payload)) {
    if (!PRESERVED_TOP_LEVEL_KEYS.includes(key)) {
      extensions[key] = payload[key];
    }
  }
  if (payload.options) {
    extensions.options = { ...payload.options };
  }
  return extensions;
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function containsSecretLikeKeys(value, path = "") {
  if (!value || typeof value !== "object") {
    return false;
  }
  if (Array.isArray(value)) {
    return value.some((item, index) => containsSecretLikeKeys(item, `${path}[${index}]`));
  }
  for (const key of Object.keys(value)) {
    if (SECRET_PATTERNS.some((pattern) => pattern.test(key))) {
      return true;
    }
    if (containsSecretLikeKeys(value[key], path ? `${path}.${key}` : key)) {
      return true;
    }
  }
  return false;
}
