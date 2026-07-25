/**
 * Privacy-safe error sanitizer (I&A-11).
 * Strips PII, payment credentials, raw facts, tokens; preserves stable codes.
 */

import { fail, ok } from "../contracts/result.js";
import { analyticsError, ANALYTICS_ERROR_CODE } from "../contracts/errors.js";
import { deepFreeze, isNonEmptyString, isPlainObject } from "../contracts/shared.js";

const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const PHONE_PATTERN = /(?:\+?\d[\d\s().-]{7,}\d)/g;
const CARD_PATTERN = /\b(?:\d[ -]*?){13,19}\b/g;
const CVV_PATTERN = /\bcvv[:\s=]*\d{3,4}\b/gi;
const IBAN_PATTERN = /\b[A-Z]{2}\d{2}[A-Z0-9]{10,30}\b/gi;

const FORBIDDEN_DETAIL_KEYS = Object.freeze([
  "email",
  "phone",
  "mobile",
  "fullName",
  "name",
  "firstName",
  "lastName",
  "address",
  "birthDate",
  "dateOfBirth",
  "customerNotes",
  "notes",
  "playerProfile",
  "cardNumber",
  "cvv",
  "pan",
  "iban",
  "bankAccount",
  "paymentCredential",
  "token",
  "accessToken",
  "authToken",
  "password",
  "secret",
  "permissions",
  "permissionObject",
  "fact",
  "rawFact",
  "rawValue",
  "originalValue",
  "value",
  "cohortCount",
  "eligibleCount",
]);

/**
 * @param {unknown} text
 * @returns {string}
 */
export function sanitizePrivacySafeText(text) {
  if (typeof text !== "string") return "privacy-safe message unavailable";
  return text
    .replace(EMAIL_PATTERN, "[REDACTED_EMAIL]")
    .replace(PHONE_PATTERN, "[REDACTED_PHONE]")
    .replace(CARD_PATTERN, "[REDACTED_PAYMENT]")
    .replace(CVV_PATTERN, "[REDACTED_CVV]")
    .replace(IBAN_PATTERN, "[REDACTED_IBAN]");
}

/**
 * @param {unknown} errorInput
 * @param {{
 *   allowOpaqueTenantId?: boolean,
 *   correlationId?: string,
 *   policyReference?: { policyId?: string, policyVersion?: string },
 * }} [options]
 * @returns {import("../contracts/result.js").Result}
 */
export function sanitizePrivacySafeError(errorInput, options = {}) {
  if (!isPlainObject(errorInput)) {
    return ok(
      deepFreeze({
        code: ANALYTICS_ERROR_CODE.PRIVACY_SAFE_ERROR,
        message: "Invalid error input sanitized",
        safe: true,
      })
    );
  }

  const code = isNonEmptyString(errorInput.code)
    ? String(errorInput.code).trim()
    : ANALYTICS_ERROR_CODE.PRIVACY_SAFE_ERROR;

  const message = sanitizePrivacySafeText(
    isNonEmptyString(errorInput.message)
      ? errorInput.message
      : "Access or privacy evaluation failed"
  );

  /** @type {Record<string, unknown>} */
  const safe = {
    code,
    message,
    safe: true,
  };

  if (isNonEmptyString(errorInput.field)) {
    safe.field = String(errorInput.field).trim();
  }

  if (isNonEmptyString(options.correlationId)) {
    safe.correlationId = String(options.correlationId).trim();
  } else if (isNonEmptyString(errorInput.correlationId)) {
    safe.correlationId = String(errorInput.correlationId).trim();
  }

  if (isPlainObject(options.policyReference)) {
    safe.policyReference = Object.freeze({
      ...(isNonEmptyString(options.policyReference.policyId)
        ? { policyId: String(options.policyReference.policyId).trim() }
        : {}),
      ...(isNonEmptyString(options.policyReference.policyVersion)
        ? {
            policyVersion: String(
              options.policyReference.policyVersion
            ).trim(),
          }
        : {}),
    });
  }

  if (isPlainObject(errorInput.details)) {
    /** @type {Record<string, unknown>} */
    const details = {};
    for (const [key, value] of Object.entries(errorInput.details)) {
      if (FORBIDDEN_DETAIL_KEYS.includes(key)) continue;
      if (key === "tenantId" && options.allowOpaqueTenantId === false) continue;
      if (typeof value === "string") {
        details[key] = sanitizePrivacySafeText(value);
      } else if (
        typeof value === "number" ||
        typeof value === "boolean" ||
        value === null
      ) {
        details[key] = value;
      } else if (Array.isArray(value) && value.every((v) => typeof v === "string" || typeof v === "number")) {
        details[key] = Object.freeze([...value]);
      }
      // Skip nested objects / raw facts.
    }
    safe.details = Object.freeze(details);
  }

  if (isNonEmptyString(errorInput.metricId)) {
    safe.metricReference = Object.freeze({
      metricId: String(errorInput.metricId).trim(),
    });
  }

  if (isNonEmptyString(errorInput.entityKind)) {
    safe.entityReference = Object.freeze({
      entityKind: String(errorInput.entityKind).trim(),
    });
  }

  return ok(deepFreeze(safe));
}

/**
 * Wrap policy-source failures without leaking internals.
 * @param {unknown} cause
 * @returns {import("../contracts/result.js").Result}
 */
export function wrapPrivacyPolicySourceFailure(cause) {
  const sanitized = sanitizePrivacySafeError(
    isPlainObject(cause)
      ? cause
      : {
          code: ANALYTICS_ERROR_CODE.PRIVACY_POLICY_SOURCE_FAILURE,
          message: "Privacy policy source failure",
        }
  );

  return fail(
    analyticsError(
      ANALYTICS_ERROR_CODE.PRIVACY_POLICY_SOURCE_FAILURE,
      sanitized.ok ? sanitized.value.message : "Privacy policy source failure",
      "policySource",
      {
        reasonCode: "POLICY_SOURCE_FAILURE",
        safeError: sanitized.ok ? sanitized.value : undefined,
      }
    )
  );
}
