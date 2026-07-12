import {
  ALLOWED_CLIENT_ASSESSMENT_FIELDS,
  ALLOWED_CLIENT_MATCH_FIELDS,
  FORBIDDEN_CLIENT_RATING_FIELDS,
} from "./forbiddenClientFields.js";

function normalizeKey(key) {
  return String(key ?? "").trim();
}

function findForbiddenKeys(payload, forbiddenSet) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return [];
  }
  const forbidden = new Set(forbiddenSet);
  return Object.keys(payload).filter((key) => forbidden.has(normalizeKey(key)));
}

function findUnknownKeys(payload, allowedSet) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return [];
  }
  const allowed = new Set(allowedSet);
  return Object.keys(payload).filter((key) => !allowed.has(normalizeKey(key)));
}

/**
 * Reject payloads that attempt to set server-authoritative rating fields.
 */
export function validateClientRatingPayload(payload, { context = "generic" } = {}) {
  const forbidden = findForbiddenKeys(payload, FORBIDDEN_CLIENT_RATING_FIELDS);
  if (forbidden.length) {
    return {
      ok: false,
      code: "FORBIDDEN_RATING_FIELDS",
      context,
      forbiddenFields: forbidden,
      message: "Client cannot submit authoritative rating fields.",
    };
  }
  return { ok: true, code: "OK" };
}

export function validateAssessmentInputPayload(payload) {
  const ratingCheck = validateClientRatingPayload(payload, { context: "assessment" });
  if (!ratingCheck.ok) return ratingCheck;

  const unknown = findUnknownKeys(payload, ALLOWED_CLIENT_ASSESSMENT_FIELDS);
  if (unknown.length) {
    return {
      ok: false,
      code: "UNKNOWN_ASSESSMENT_FIELDS",
      unknownFields: unknown,
      message: "Assessment payload contains unexpected fields.",
    };
  }
  return { ok: true, code: "OK" };
}

export function validateMatchInputPayload(payload) {
  const ratingCheck = validateClientRatingPayload(payload, { context: "match" });
  if (!ratingCheck.ok) return ratingCheck;

  const unknown = findUnknownKeys(payload, ALLOWED_CLIENT_MATCH_FIELDS);
  if (unknown.length) {
    return {
      ok: false,
      code: "UNKNOWN_MATCH_FIELDS",
      unknownFields: unknown,
      message: "Match payload contains unexpected fields.",
    };
  }
  return { ok: true, code: "OK" };
}

/** Strip forbidden fields before forwarding to server-side engines. */
export function stripForbiddenRatingFields(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return {};
  }
  const forbidden = new Set(FORBIDDEN_CLIENT_RATING_FIELDS);
  return Object.fromEntries(
    Object.entries(payload).filter(([key]) => !forbidden.has(normalizeKey(key))),
  );
}
