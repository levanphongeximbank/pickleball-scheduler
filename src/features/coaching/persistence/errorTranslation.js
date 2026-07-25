/**
 * Translate persistence / database errors into CoachingError contracts (COACHING-02).
 */

import { COACHING_ERROR_CODES } from "../constants/errorCodes.js";
import { CoachingError, isCoachingError } from "../errors/CoachingError.js";

/**
 * @param {unknown} err
 * @param {{ conflictMessage?: string, notFoundMessage?: string }} [options]
 * @returns {never}
 */
export function translateCoachingPersistenceError(err, options = {}) {
  if (isCoachingError(err)) {
    throw err;
  }

  const code = String(err?.code || err?.error?.code || "");
  const message = String(err?.message || err?.error?.message || err || "Persistence error");
  const detail = String(err?.detail || err?.error?.detail || "");
  const combined = `${message} ${detail}`;

  if (
    /COACHING_VERSION_CONFLICT/i.test(combined) ||
    err?.name === "CoachingVersionConflict" ||
    code === "40001"
  ) {
    throw new CoachingError(
      COACHING_ERROR_CODES.VERSION_CONFLICT,
      "Coaching version conflict.",
      { detail: detail || undefined }
    );
  }

  if (/COACHING_ENTITLEMENT_EXHAUSTED/i.test(combined)) {
    throw new CoachingError(
      COACHING_ERROR_CODES.ENTITLEMENT_EXHAUSTED,
      "Package entitlement has no remaining sessions.",
      { detail: detail || undefined }
    );
  }

  if (/COACHING_IMMUTABLE|append-only|immutable/i.test(combined)) {
    throw new CoachingError(
      COACHING_ERROR_CODES.IMMUTABLE_RECORD,
      "Coaching record is immutable.",
      { detail: detail || undefined }
    );
  }

  if (
    code === "23505" ||
    /duplicate|unique|COACHING_DUPLICATE/i.test(combined) ||
    err?.name === "CoachingUniqueViolation"
  ) {
    throw new CoachingError(
      COACHING_ERROR_CODES.DUPLICATE,
      options.conflictMessage || "Coaching persistence conflict (unique constraint).",
      { detail: detail || undefined }
    );
  }

  if (
    code === "PGRST116" ||
    code === "P0002" ||
    err?.name === "CoachingNotFound" ||
    /COACHING_NOT_FOUND|not found/i.test(combined)
  ) {
    throw new CoachingError(
      COACHING_ERROR_CODES.NOT_FOUND,
      options.notFoundMessage || "Coaching persistence row not found."
    );
  }

  if (
    code === "42501" ||
    /COACHING_FORBIDDEN_SCOPE|COACHING_FORBIDDEN_ACTION|COACHING_MISSING_ACTOR|COACHING_MISSING_SCOPE|permission denied|scope denied|forbidden/i.test(
      combined
    )
  ) {
    if (/MISSING_ACTOR/i.test(combined)) {
      throw new CoachingError(
        COACHING_ERROR_CODES.MISSING_ACTOR,
        "Coaching persistence requires an authenticated actor."
      );
    }
    if (/MISSING_SCOPE/i.test(combined)) {
      throw new CoachingError(
        COACHING_ERROR_CODES.MISSING_SCOPE,
        "Coaching persistence requires tenantId and clubId."
      );
    }
    if (/FORBIDDEN_ACTION/i.test(combined)) {
      throw new CoachingError(
        COACHING_ERROR_CODES.FORBIDDEN_ACTION,
        "Coaching persistence action denied."
      );
    }
    throw new CoachingError(
      COACHING_ERROR_CODES.FORBIDDEN_SCOPE,
      "Coaching persistence scope or permission denied."
    );
  }

  if (/COACHING_INVALID_TRANSITION/i.test(combined)) {
    throw new CoachingError(
      COACHING_ERROR_CODES.INVALID_TRANSITION,
      message,
      { detail: detail || undefined }
    );
  }

  if (/COACHING_INVALID_STATUS/i.test(combined)) {
    throw new CoachingError(
      COACHING_ERROR_CODES.INVALID_STATUS,
      message,
      { detail: detail || undefined }
    );
  }

  if (code === "23514" || /COACHING_INVALID_INPUT|check constraint/i.test(combined)) {
    throw new CoachingError(
      COACHING_ERROR_CODES.INVALID_INPUT,
      message,
      { detail: detail || undefined }
    );
  }

  throw new CoachingError(COACHING_ERROR_CODES.INVALID_INPUT, message);
}

/**
 * @template T
 * @param {() => Promise<T>|T} fn
 * @param {object} [options]
 * @returns {Promise<T>}
 */
export async function withCoachingPersistenceErrors(fn, options = {}) {
  try {
    return await fn();
  } catch (err) {
    translateCoachingPersistenceError(err, options);
  }
}
