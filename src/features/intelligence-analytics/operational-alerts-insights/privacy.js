/**
 * Forbidden PII / payment-credential / notification-delivery keys for
 * I&A-10 operational signals and notification candidates.
 */

import { fail } from "../contracts/result.js";
import { analyticsError, ANALYTICS_ERROR_CODE } from "../contracts/errors.js";
import { isPlainObject } from "../contracts/shared.js";

export const FORBIDDEN_OPERATIONAL_ALERT_KEYS = Object.freeze([
  "email",
  "phone",
  "phoneNumber",
  "mobile",
  "deviceToken",
  "pushToken",
  "recipient",
  "recipientId",
  "recipients",
  "channel",
  "provider",
  "password",
  "secret",
  "apiKey",
  "cardNumber",
  "cvv",
  "pan",
  "ssn",
  "nationalId",
  "fullName",
  "firstName",
  "lastName",
  "address",
  "privateMessage",
  "messageBody",
  "retryCount",
  "deliveryState",
  "deliveryStatus",
  "credentials",
]);

/**
 * @param {unknown} input
 * @param {string} [field]
 * @returns {import("../contracts/result.js").Result | null}
 */
export function rejectForbiddenOperationalAlertFields(input, field = "input") {
  if (!isPlainObject(input)) return null;
  for (const key of FORBIDDEN_OPERATIONAL_ALERT_KEYS) {
    if (Object.prototype.hasOwnProperty.call(input, key)) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.OPERATIONAL_ALERTS_PRIVACY_VIOLATION,
          `Forbidden sensitive field "${key}" is not allowed on operational alert/insight contracts`,
          `${field}.${key}`
        )
      );
    }
  }
  return null;
}

/**
 * @param {unknown} message
 * @returns {string}
 */
export function sanitizeErrorMessage(message) {
  const text = typeof message === "string" ? message : "operational alerts error";
  return text
    .replace(/\b[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}\b/g, "[redacted-email]")
    .replace(/\b(?:\+?\d[\d\s().-]{7,}\d)\b/g, "[redacted-phone]");
}
