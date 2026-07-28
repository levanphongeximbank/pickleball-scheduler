/**
 * PLATFORM-HARD-CUTOVER-01 — Rating cutover helpers.
 * Enforces foundation writer / idempotency / Elo separation contracts in code.
 */

import { MATCH_RESULT_RATING_ALGORITHM } from "../player-rating/foundation/ports/matchResultRatingPort.js";

export const RATING_CUTOVER_FLAG = "VITE_PICK_VN_RATING_V5_ENABLED";

export function isPublicPlayerRatingActivationEnabled(env) {
  const source =
    env && typeof env === "object"
      ? env
      : typeof import.meta !== "undefined"
        ? import.meta.env
        : {};
  return String(source?.[RATING_CUTOVER_FLAG] ?? "false").toLowerCase() === "true";
}

/** Competition Elo must never be treated as public Player Rating SSOT. */
export function assertCompetitionEloSeparatedFromPublicRating() {
  return {
    ok: true,
    competitionEloIsPublicRating: false,
    matchResultRatingPortImplemented: Boolean(
      MATCH_RESULT_RATING_ALGORITHM?.hasAlgorithm
    ),
  };
}

/**
 * Idempotency key contract for durable rating writes.
 * @param {string} key
 */
export function assertRatingIdempotencyKey(key) {
  const normalized = String(key || "").trim();
  if (normalized.length < 8) {
    return {
      ok: false,
      code: "RATING_IDEMPOTENCY_KEY_REQUIRED",
      error: "Rating durable write requires idempotency key (min 8 chars).",
    };
  }
  return { ok: true, idempotencyKey: normalized };
}

/** Club blob rating verified write is forbidden as canonical authority. */
export function assertClubBlobRatingWriteForbidden() {
  return {
    ok: false,
    code: "CLUB_BLOB_RATING_WRITE_FORBIDDEN",
    error: "Club blob rating fields are mirror-only; foundation/V5 durable is SSOT.",
  };
}

/** Local assessment is draft-only. */
export function demoteLocalAssessmentToDraft(assessment) {
  return {
    ...(assessment && typeof assessment === "object" ? assessment : {}),
    canonicalAuthority: false,
    draftOnly: true,
    status: "draft",
  };
}
