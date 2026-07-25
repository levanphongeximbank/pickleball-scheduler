/**
 * PII and payment-credential rejection helpers for Finance, Ranking and
 * Performance Analytics (I&A-09). This module is descriptive-analytics-only
 * and must never accept, store, or echo personally identifiable information
 * or payment credentials/instrument identifiers. Facts must carry opaque
 * identifiers and explicit status/amount signals only.
 */

import { fail, ok } from "../contracts/result.js";
import { analyticsError, ANALYTICS_ERROR_CODE } from "../contracts/errors.js";
import { isPlainObject } from "../contracts/shared.js";

/**
 * Frozen list of field names that are forbidden anywhere in Finance /
 * Ranking / Performance analytics facts or inputs. Presence of the key is
 * rejected regardless of its value (including `undefined`, `null`, or empty
 * string) because the mere shape of accepting such a field signals a
 * PII/payment-coupling defect.
 */
export const FORBIDDEN_PII_AND_PAYMENT_FACT_KEYS = Object.freeze([
  // I&A-08 PII keys (carried forward — finance facts must not smuggle PII)
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
  // I&A-09 payment/financial-credential keys
  "bankAccount",
  "bankAccountNumber",
  "cardNumber",
  "cardToken",
  "paymentToken",
  "paymentCredential",
  "cvv",
  "cvc",
  "invoicePrivateNote",
  "privateNote",
  "accountNumber",
  "routingNumber",
  "iban",
  "pan",
]);

const FORBIDDEN_FACT_KEY_SET = new Set(FORBIDDEN_PII_AND_PAYMENT_FACT_KEYS);

/**
 * Rejects any input object that carries a forbidden PII or payment-credential
 * field name. Never echoes the offending value(s) — only the field name(s) —
 * in the returned error.
 * @param {unknown} input
 * @param {string} fieldLabel
 * @returns {import("../contracts/result.js").Result}
 */
export function rejectForbiddenSensitiveFields(input, fieldLabel) {
  if (!isPlainObject(input)) {
    return ok(input);
  }

  /** @type {string[]} */
  const present = [];
  for (const key of Object.keys(input)) {
    if (FORBIDDEN_FACT_KEY_SET.has(key)) {
      present.push(key);
    }
  }

  if (present.length > 0) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.FINANCE_RANKING_PERFORMANCE_PRIVACY_VIOLATION,
        `${fieldLabel} must not contain forbidden PII/payment field(s): ${present.join(", ")}`,
        fieldLabel,
        { forbiddenFields: Object.freeze([...present]) }
      )
    );
  }

  return ok(input);
}

const EMAIL_LIKE_PATTERN = /[^\s@]+@[^\s@]+\.[^\s@]+/g;
const PHONE_LIKE_PATTERN = /(\+?\d[\d\-\s().]{6,}\d)/g;
const CARD_LIKE_PATTERN = /\b(?:\d[ -]?){12,19}\b/g;

/**
 * Best-effort redaction of email-like, phone-like, and card-number-like
 * substrings from a message string. Defense-in-depth only — the primary
 * guarantee is that PII/payment-credential values are never accepted into
 * facts in the first place.
 * @param {unknown} message
 * @returns {unknown}
 */
export function sanitizeErrorMessage(message) {
  if (typeof message !== "string") return message;
  return message
    .replace(EMAIL_LIKE_PATTERN, "[redacted-email]")
    .replace(CARD_LIKE_PATTERN, "[redacted-card]")
    .replace(PHONE_LIKE_PATTERN, "[redacted-phone]");
}
