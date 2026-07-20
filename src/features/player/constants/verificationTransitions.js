/**
 * Phase 1H-A — explicit identity-verification transition matrix (admin-only).
 *
 * Narrowest defensible policy:
 * - Start / decide from unverified or pending
 * - Revoke verified only to unverified (no direct verified → rejected/pending)
 * - Re-open rejected via pending (no direct rejected → verified)
 * - Same-status is not a successful transition
 */
import { IDENTITY_VERIFICATION_STATUS } from "./verification.js";
import { WRITE_ERROR_CODES } from "./writableFields.js";

const U = IDENTITY_VERIFICATION_STATUS.UNVERIFIED;
const P = IDENTITY_VERIFICATION_STATUS.PENDING;
const V = IDENTITY_VERIFICATION_STATUS.VERIFIED;
const R = IDENTITY_VERIFICATION_STATUS.REJECTED;

/**
 * Allowed next statuses keyed by current status.
 * @type {Readonly<Record<string, ReadonlyArray<string>>>}
 */
export const VERIFICATION_TRANSITION_MATRIX = Object.freeze({
  [U]: Object.freeze([P, V, R]),
  [P]: Object.freeze([U, V, R]),
  [V]: Object.freeze([U]),
  [R]: Object.freeze([U, P]),
});

/**
 * @param {string} fromStatus
 * @param {string} toStatus
 * @returns {{ ok: true, from: string, to: string } | { ok: false, code: string, message: string, from: string, to: string }}
 */
export function validateVerificationTransition(fromStatus, toStatus) {
  const from = String(fromStatus || U).trim().toLowerCase() || U;
  const to = String(toStatus || "").trim().toLowerCase();

  if (!to) {
    return {
      ok: false,
      code: WRITE_ERROR_CODES.VALIDATION_ERROR,
      message: "Next verification status is required",
      from,
      to: "",
    };
  }

  if (from === to) {
    return {
      ok: false,
      code: WRITE_ERROR_CODES.INVALID_TRANSITION,
      message: `Verification status is already ${from}`,
      from,
      to,
    };
  }

  const allowed = VERIFICATION_TRANSITION_MATRIX[from];
  if (!allowed || !allowed.includes(to)) {
    return {
      ok: false,
      code: WRITE_ERROR_CODES.INVALID_TRANSITION,
      message: `Transition ${from} → ${to} is not allowed`,
      from,
      to,
      allowed: allowed ? [...allowed] : [],
    };
  }

  return { ok: true, from, to };
}
