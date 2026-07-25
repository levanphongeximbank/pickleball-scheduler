/**
 * PII rejection helpers for Customer / Player Analytics (I&A-08).
 * This module is descriptive-analytics-only and must never accept, store,
 * or echo personally identifiable information. Facts must carry opaque
 * identifiers and explicit lifecycle/status signals only.
 */

import { fail, ok } from "../contracts/result.js";
import { analyticsError, ANALYTICS_ERROR_CODE } from "../contracts/errors.js";
import { isPlainObject } from "../contracts/shared.js";

/**
 * Frozen list of field names that are forbidden anywhere in Customer/Player
 * analytics facts or inputs. Presence of the key is rejected regardless of
 * its value (including `undefined`, `null`, or empty string) because the
 * mere shape of accepting such a field signals a PII-coupling defect.
 */
export const FORBIDDEN_PII_FACT_KEYS = Object.freeze([
  "fullName",
  "name",
  "email",
  "phone",
  "phoneNumber",
  "streetAddress",
  "address",
  "dateOfBirth",
  "birthDate",
  "fullDateOfBirth",
  "governmentId",
  "governmentIdentifier",
  "nationalId",
  "authToken",
  "authenticationIdentity",
  "password",
  "paymentDetails",
  "bankDetails",
  "privateNotes",
  "notes",
  "freeText",
  "freeTextProfile",
  "healthData",
  "biometric",
  "biometricData",
  "credentials",
  "displayName",
]);

const FORBIDDEN_PII_FACT_KEY_SET = new Set(FORBIDDEN_PII_FACT_KEYS);

/**
 * Rejects any input object that carries a forbidden PII field name.
 * Never echoes the offending value(s) — only the field name(s) — in the
 * returned error.
 * @param {unknown} input
 * @param {string} fieldLabel
 * @returns {import("../contracts/result.js").Result}
 */
export function rejectForbiddenPiiFields(input, fieldLabel) {
  if (!isPlainObject(input)) {
    return ok(input);
  }

  /** @type {string[]} */
  const present = [];
  for (const key of Object.keys(input)) {
    if (FORBIDDEN_PII_FACT_KEY_SET.has(key)) {
      present.push(key);
    }
  }

  if (present.length > 0) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.CUSTOMER_PLAYER_PRIVACY_VIOLATION,
        `${fieldLabel} must not contain forbidden PII field(s): ${present.join(", ")}`,
        fieldLabel,
        { forbiddenFields: Object.freeze([...present]) }
      )
    );
  }

  return ok(input);
}

const EMAIL_LIKE_PATTERN = /[^\s@]+@[^\s@]+\.[^\s@]+/g;
const PHONE_LIKE_PATTERN = /(\+?\d[\d\-\s().]{6,}\d)/g;

/**
 * Best-effort redaction of email-like and phone-like substrings from a
 * message string. Defense-in-depth only — the primary guarantee is that
 * PII values are never accepted into facts in the first place.
 * @param {unknown} message
 * @returns {unknown}
 */
export function sanitizeErrorMessage(message) {
  if (typeof message !== "string") return message;
  return message
    .replace(EMAIL_LIKE_PATTERN, "[redacted-email]")
    .replace(PHONE_LIKE_PATTERN, "[redacted-phone]");
}
