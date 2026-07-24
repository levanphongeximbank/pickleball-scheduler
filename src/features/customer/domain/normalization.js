/**
 * Deterministic contact normalization (CUSTOMER-02).
 *
 * No third-party phone/email libraries. Rules are pragmatic and documented —
 * not a full RFC / ITU implementation.
 *
 * Customer contact values are business master data, not authentication credentials.
 */

import { CUSTOMER_ERROR_CODES } from "../errors/codes.js";
import { throwCustomerError } from "../errors/CustomerError.js";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Normalize email for storage and duplicate comparison.
 * - trim
 * - lowercase
 * - reject blank / invalid shape
 *
 * @param {unknown} value
 * @returns {{ displayValue: string, normalizedValue: string }}
 */
export function normalizeCustomerEmail(value) {
  if (value == null || typeof value !== "string" || !value.trim()) {
    throwCustomerError(
      CUSTOMER_ERROR_CODES.INVALID_EMAIL,
      "Email contact value is required.",
      { field: "value", type: "EMAIL" }
    );
  }
  const displayValue = value.trim();
  const normalizedValue = displayValue.toLowerCase();
  if (!EMAIL_PATTERN.test(normalizedValue) || normalizedValue.includes("..")) {
    throwCustomerError(
      CUSTOMER_ERROR_CODES.INVALID_EMAIL,
      "Email contact format is invalid.",
      { field: "value", type: "EMAIL" }
    );
  }
  return { displayValue, normalizedValue };
}

/**
 * Normalize phone for storage and duplicate comparison.
 *
 * Rules:
 * - trim display value (preserve caller formatting for displayValue)
 * - strip spaces, dashes, parentheses, and other non-digit separators
 * - keep a single leading "+" when present (or when input starts with "00")
 * - require 7–15 digits (E.164 digit budget, without inventing country rules)
 * - do NOT auto-map local trunk prefixes (e.g. leading 0 → +84)
 *
 * @param {unknown} value
 * @returns {{ displayValue: string, normalizedValue: string }}
 */
export function normalizeCustomerPhone(value) {
  if (value == null || typeof value !== "string" || !value.trim()) {
    throwCustomerError(
      CUSTOMER_ERROR_CODES.INVALID_PHONE,
      "Phone contact value is required.",
      { field: "value", type: "PHONE" }
    );
  }
  const displayValue = value.trim().replace(/\s+/g, " ");
  let working = displayValue;
  let withPlus = false;
  if (working.startsWith("00")) {
    withPlus = true;
    working = working.slice(2);
  } else if (working.startsWith("+")) {
    withPlus = true;
    working = working.slice(1);
  }
  const digits = working.replace(/\D/g, "");
  if (digits.length < 7 || digits.length > 15) {
    throwCustomerError(
      CUSTOMER_ERROR_CODES.INVALID_PHONE,
      "Phone contact must contain 7 to 15 digits.",
      { field: "value", type: "PHONE", digitCount: digits.length }
    );
  }
  const normalizedValue = withPlus ? `+${digits}` : digits;
  return { displayValue, normalizedValue };
}
