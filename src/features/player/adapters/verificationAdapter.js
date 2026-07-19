/**
 * Identity verification adapter — separate from rating verification.
 */
import {
  IDENTITY_VERIFICATION_STATUS,
  IDENTITY_VERIFICATION_VALUES,
  RATING_VERIFICATION_STATUS_EXAMPLES,
} from "../constants/verification.js";

/**
 * @param {unknown} value
 * @returns {string}
 */
export function normalizeVerificationStatus(value) {
  if (value == null || value === "") return IDENTITY_VERIFICATION_STATUS.UNVERIFIED;
  const raw = String(value).trim().toLowerCase();
  if (IDENTITY_VERIFICATION_VALUES.includes(raw)) return raw;
  return IDENTITY_VERIFICATION_STATUS.UNVERIFIED;
}

/**
 * @param {unknown} value
 */
export function validateVerificationStatus(value) {
  if (value == null || value === "") {
    return { ok: true, value: IDENTITY_VERIFICATION_STATUS.UNVERIFIED, errors: [] };
  }
  const raw = String(value).trim().toLowerCase();
  if (RATING_VERIFICATION_STATUS_EXAMPLES.includes(raw)) {
    return {
      ok: false,
      value: null,
      errors: [
        {
          code: "RATING_VERIFICATION_NOT_ALLOWED",
          field: "verificationStatus",
          message:
            "Rating verification status cannot be used as identity verificationStatus",
        },
      ],
    };
  }
  if (!IDENTITY_VERIFICATION_VALUES.includes(raw)) {
    return {
      ok: false,
      value: null,
      errors: [
        {
          code: "UNSUPPORTED_VERIFICATION_STATUS",
          field: "verificationStatus",
          message: `Unsupported verificationStatus: ${String(value)}`,
        },
      ],
    };
  }
  return { ok: true, value: raw, errors: [] };
}
