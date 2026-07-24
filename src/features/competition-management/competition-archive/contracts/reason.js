/**
 * Reason validation for archive / unarchive (CM-08).
 */

import { COMPETITION_ARCHIVE_ERROR_CODE } from "../errors/errorCodes.js";
import {
  COMPETITION_ARCHIVE_REASON_CODE,
  COMPETITION_ARCHIVE_REASON_CATEGORY_BY_CODE,
  COMPETITION_UNARCHIVE_REASON_CODE,
  COMPETITION_UNARCHIVE_REASON_CATEGORY_BY_CODE,
  COMPETITION_ARCHIVE_REASON_SUMMARY_MAX_LENGTH,
  COMPETITION_ARCHIVE_REASON_DETAIL_MAX_LENGTH,
  COMPETITION_ARCHIVE_REASON_OTHER_MIN_DETAIL_LENGTH,
  isCompetitionArchiveReasonCode,
  isCompetitionUnarchiveReasonCode,
} from "../constants/reasons.js";
import { createFieldError } from "./validation.js";
import {
  deepFreeze,
  isNonEmptyString,
  hasControlCharacters,
  looksLikeHtmlOrScript,
} from "./shared.js";

/**
 * @param {"ARCHIVE"|"UNARCHIVE"} action
 * @param {unknown} reason
 * @returns {{ errors: object[], value: object|null }}
 */
export function collectReasonErrors(action, reason) {
  /** @type {object[]} */
  const errors = [];

  if (!reason || typeof reason !== "object" || Array.isArray(reason)) {
    errors.push(
      createFieldError(
        "reason",
        action === "UNARCHIVE"
          ? COMPETITION_ARCHIVE_ERROR_CODE.INVALID_UNARCHIVE_REASON
          : COMPETITION_ARCHIVE_ERROR_CODE.INVALID_ARCHIVE_REASON,
        "explicit reason object is required",
        {}
      )
    );
    return { errors, value: null };
  }

  const code = reason.code;
  const isKnown =
    action === "UNARCHIVE"
      ? isCompetitionUnarchiveReasonCode(code)
      : isCompetitionArchiveReasonCode(code);
  const category =
    action === "UNARCHIVE"
      ? COMPETITION_UNARCHIVE_REASON_CATEGORY_BY_CODE[code] ?? null
      : COMPETITION_ARCHIVE_REASON_CATEGORY_BY_CODE[code] ?? null;
  const invalidCodeError =
    action === "UNARCHIVE"
      ? COMPETITION_ARCHIVE_ERROR_CODE.INVALID_UNARCHIVE_REASON
      : COMPETITION_ARCHIVE_ERROR_CODE.INVALID_ARCHIVE_REASON;
  const otherCode =
    action === "UNARCHIVE"
      ? COMPETITION_UNARCHIVE_REASON_CODE.OTHER
      : COMPETITION_ARCHIVE_REASON_CODE.OTHER;

  if (!isKnown) {
    errors.push(
      createFieldError(
        "reason.code",
        invalidCodeError,
        "unknown reason code is rejected (no silent normalize)",
        { value: code }
      )
    );
  }

  if (!isNonEmptyString(reason.summary)) {
    errors.push(
      createFieldError(
        "reason.summary",
        COMPETITION_ARCHIVE_ERROR_CODE.INVALID_REASON_SUMMARY,
        "human-readable reason.summary is required",
        {}
      )
    );
  } else {
    const summary = String(reason.summary);
    if (summary.trim().length === 0) {
      errors.push(
        createFieldError(
          "reason.summary",
          COMPETITION_ARCHIVE_ERROR_CODE.INVALID_REASON_SUMMARY,
          "reason.summary must be non-empty after trim",
          {}
        )
      );
    }
    if (summary.length > COMPETITION_ARCHIVE_REASON_SUMMARY_MAX_LENGTH) {
      errors.push(
        createFieldError(
          "reason.summary",
          COMPETITION_ARCHIVE_ERROR_CODE.INVALID_REASON_SUMMARY,
          `reason.summary exceeds max length ${COMPETITION_ARCHIVE_REASON_SUMMARY_MAX_LENGTH}`,
          { length: summary.length }
        )
      );
    }
    if (hasControlCharacters(summary)) {
      errors.push(
        createFieldError(
          "reason.summary",
          COMPETITION_ARCHIVE_ERROR_CODE.REASON_CONTROL_CHARACTERS,
          "reason.summary must not contain control characters",
          {}
        )
      );
    }
    if (looksLikeHtmlOrScript(summary)) {
      errors.push(
        createFieldError(
          "reason.summary",
          COMPETITION_ARCHIVE_ERROR_CODE.INVALID_REASON_SUMMARY,
          "reason.summary must not contain HTML or script content",
          {}
        )
      );
    }
  }

  let detail = null;
  if (reason.detail != null) {
    if (!isNonEmptyString(reason.detail) && reason.detail !== "") {
      errors.push(
        createFieldError(
          "reason.detail",
          COMPETITION_ARCHIVE_ERROR_CODE.MISSING_REASON_DETAIL,
          "reason.detail must be a string when provided",
          {}
        )
      );
    } else {
      const d = String(reason.detail);
      if (d.length > COMPETITION_ARCHIVE_REASON_DETAIL_MAX_LENGTH) {
        errors.push(
          createFieldError(
            "reason.detail",
            COMPETITION_ARCHIVE_ERROR_CODE.MISSING_REASON_DETAIL,
            `reason.detail exceeds max length ${COMPETITION_ARCHIVE_REASON_DETAIL_MAX_LENGTH}`,
            { length: d.length }
          )
        );
      }
      if (hasControlCharacters(d)) {
        errors.push(
          createFieldError(
            "reason.detail",
            COMPETITION_ARCHIVE_ERROR_CODE.REASON_CONTROL_CHARACTERS,
            "reason.detail must not contain control characters",
            {}
          )
        );
      }
      if (looksLikeHtmlOrScript(d)) {
        errors.push(
          createFieldError(
            "reason.detail",
            COMPETITION_ARCHIVE_ERROR_CODE.MISSING_REASON_DETAIL,
            "reason.detail must not contain HTML or script content",
            {}
          )
        );
      }
      detail = d.trim().length > 0 ? d.trim() : null;
    }
  }

  if (isKnown && code === otherCode) {
    const detailText = detail ?? "";
    if (detailText.length < COMPETITION_ARCHIVE_REASON_OTHER_MIN_DETAIL_LENGTH) {
      errors.push(
        createFieldError(
          "reason.detail",
          COMPETITION_ARCHIVE_ERROR_CODE.MISSING_REASON_DETAIL,
          `reason code OTHER requires detail of at least ${COMPETITION_ARCHIVE_REASON_OTHER_MIN_DETAIL_LENGTH} characters`,
          { length: detailText.length }
        )
      );
    }
  }

  let reference = null;
  if (reason.reference != null) {
    if (!isNonEmptyString(reason.reference)) {
      errors.push(
        createFieldError(
          "reason.reference",
          COMPETITION_ARCHIVE_ERROR_CODE.INVALID_CONTRACT,
          "reason.reference must be a non-empty string when provided",
          {}
        )
      );
    } else if (hasControlCharacters(String(reason.reference))) {
      errors.push(
        createFieldError(
          "reason.reference",
          COMPETITION_ARCHIVE_ERROR_CODE.REASON_CONTROL_CHARACTERS,
          "reason.reference must not contain control characters",
          {}
        )
      );
    } else {
      reference = String(reason.reference).trim();
    }
  }

  if (errors.length > 0) return { errors, value: null };

  return {
    errors,
    value: deepFreeze({
      code,
      category,
      summary: String(reason.summary).trim(),
      detail,
      reference,
    }),
  };
}
