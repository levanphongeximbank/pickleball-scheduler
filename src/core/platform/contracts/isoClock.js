/**
 * Absolute UTC ISO-8601 instant helpers (Platform Core Phase 1B).
 *
 * Handles explicit-offset / Z timestamps only. Does not replace civil time,
 * venue hours, booking intervals, or IANA timezone conversion.
 */

import { fail, ok } from "./result.js";

export const ISO_INSTANT_ERROR = Object.freeze({
  NOT_STRING: "ISO_INSTANT_NOT_STRING",
  INVALID: "ISO_INSTANT_INVALID",
});

/**
 * Full instant with mandatory timezone: Z or ±HH:MM.
 * Fractional seconds optional (1–9 digits).
 */
const ISO_INSTANT_RE =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,9}))?(Z|[+-]\d{2}:\d{2})$/;

/**
 * @param {string} code
 * @param {string} message
 * @returns {{ code: string, message: string }}
 */
function isoInstantError(code, message) {
  return Object.freeze({ code, message });
}

/**
 * @param {number} year
 * @param {number} month
 * @param {number} day
 * @param {number} hour
 * @param {number} minute
 * @param {number} second
 * @returns {boolean}
 */
function isValidInstantComponents(year, month, day, hour, minute, second) {
  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day) ||
    !Number.isInteger(hour) ||
    !Number.isInteger(minute) ||
    !Number.isInteger(second)
  ) {
    return false;
  }
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;
  if (hour < 0 || hour > 23) return false;
  if (minute < 0 || minute > 59) return false;
  if (second < 0 || second > 59) return false;

  const probe = new Date(Date.UTC(year, month - 1, day));
  return (
    probe.getUTCFullYear() === year &&
    probe.getUTCMonth() === month - 1 &&
    probe.getUTCDate() === day
  );
}

/**
 * @param {string} offset
 * @returns {boolean}
 */
function isValidOffset(offset) {
  if (offset === "Z") return true;
  const match = /^([+-])(\d{2}):(\d{2})$/.exec(offset);
  if (!match) return false;
  const hours = Number(match[2]);
  const minutes = Number(match[3]);
  if (hours > 23 || minutes > 59) return false;
  return true;
}

/**
 * Current absolute instant as UTC ISO-8601 ending with Z.
 *
 * @returns {string}
 */
export function nowIso() {
  return new Date().toISOString();
}

/**
 * Parse a strict absolute instant string and normalize to UTC ISO Z.
 *
 * Rejects date-only, time-only, and timestamps without an explicit timezone.
 *
 * @param {*} value
 * @returns {import("./result.js").Result}
 */
export function parseIsoStrict(value) {
  if (typeof value !== "string") {
    return fail(
      isoInstantError(
        ISO_INSTANT_ERROR.NOT_STRING,
        "ISO instant must be a string"
      )
    );
  }

  const text = value.trim();
  const match = ISO_INSTANT_RE.exec(text);
  if (!match) {
    return fail(
      isoInstantError(
        ISO_INSTANT_ERROR.INVALID,
        "ISO instant must be a full timestamp with explicit timezone"
      )
    );
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);
  const offset = match[8];

  if (!isValidInstantComponents(year, month, day, hour, minute, second)) {
    return fail(
      isoInstantError(
        ISO_INSTANT_ERROR.INVALID,
        "ISO instant has an invalid calendar date or time"
      )
    );
  }

  if (!isValidOffset(offset)) {
    return fail(
      isoInstantError(
        ISO_INSTANT_ERROR.INVALID,
        "ISO instant has an invalid timezone offset"
      )
    );
  }

  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) {
    return fail(
      isoInstantError(
        ISO_INSTANT_ERROR.INVALID,
        "ISO instant could not be parsed"
      )
    );
  }

  return ok(parsed.toISOString());
}
