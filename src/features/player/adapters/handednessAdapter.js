/**
 * Handedness adapter — canonical: right | left | ambidextrous | unknown.
 */
import { HANDEDNESS, HANDEDNESS_VALUES } from "../constants/handedness.js";

const RIGHT_ALIASES = new Set([
  "right",
  "r",
  "rh",
  "right-handed",
  "right_handed",
  "righthanded",
  "tay phải",
  "tay phai",
  "phải",
  "phai",
]);

const LEFT_ALIASES = new Set([
  "left",
  "l",
  "lh",
  "left-handed",
  "left_handed",
  "lefthanded",
  "tay trái",
  "tay trai",
  "trái",
  "trai",
]);

const AMBI_ALIASES = new Set([
  "ambidextrous",
  "ambi",
  "both",
  "two-handed",
  "two_handed",
  "hai tay",
]);

/**
 * @param {unknown} value
 * @returns {"right"|"left"|"ambidextrous"|"unknown"}
 */
export function normalizeHandedness(value) {
  if (value == null || value === "") return HANDEDNESS.UNKNOWN;
  const raw = String(value).trim().toLowerCase().normalize("NFC");
  const ascii = raw.normalize("NFD").replace(/\p{M}/gu, "");

  if (RIGHT_ALIASES.has(raw) || RIGHT_ALIASES.has(ascii) || ascii === "tay phai" || ascii === "phai") {
    return HANDEDNESS.RIGHT;
  }
  if (LEFT_ALIASES.has(raw) || LEFT_ALIASES.has(ascii) || ascii === "tay trai" || ascii === "trai") {
    return HANDEDNESS.LEFT;
  }
  if (AMBI_ALIASES.has(raw) || AMBI_ALIASES.has(ascii)) {
    return HANDEDNESS.AMBIDEXTROUS;
  }
  if (HANDEDNESS_VALUES.includes(raw)) return raw;
  return HANDEDNESS.UNKNOWN;
}

/**
 * Strict validate for writes — unsupported labels that don't map are rejected
 * only when caller passes `strict: true` and value is non-empty unrecognized.
 * Soft normalize always returns a canonical value; write path uses strict check.
 *
 * @param {unknown} value
 * @param {{ strict?: boolean }} [options]
 */
export function validateHandedness(value, options = {}) {
  if (value == null || value === "") {
    return { ok: true, value: HANDEDNESS.UNKNOWN, errors: [] };
  }
  const normalized = normalizeHandedness(value);
  if (options.strict) {
    const raw = String(value).trim().toLowerCase();
    const known =
      HANDEDNESS_VALUES.includes(raw) ||
      RIGHT_ALIASES.has(raw) ||
      LEFT_ALIASES.has(raw) ||
      AMBI_ALIASES.has(raw) ||
      normalized !== HANDEDNESS.UNKNOWN ||
      ["unknown", "không rõ", "khong ro", "?"].includes(raw);
    if (!known && normalized === HANDEDNESS.UNKNOWN) {
      return {
        ok: false,
        value: null,
        errors: [
          {
            code: "UNSUPPORTED_HANDEDNESS",
            field: "handedness",
            message: `Unsupported handedness: ${String(value)}`,
          },
        ],
      };
    }
  }
  return { ok: true, value: normalized, errors: [] };
}
