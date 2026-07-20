/**
 * Phase 1H-C — UI action mapping for admin verification transitions.
 * Derives available actions solely from VERIFICATION_TRANSITION_MATRIX (1H-A).
 * Does not broaden the matrix.
 */
import { IDENTITY_VERIFICATION_STATUS } from "../constants/verification.js";
import { VERIFICATION_TRANSITION_MATRIX } from "../constants/verificationTransitions.js";
import { formatVerificationStatusDisplay } from "../selectors/selfProfileDisplay.js";

/** User-friendly labels keyed by canonical next status. */
export const VERIFICATION_ACTION_LABELS = Object.freeze({
  [IDENTITY_VERIFICATION_STATUS.PENDING]: "Đưa vào chờ duyệt",
  [IDENTITY_VERIFICATION_STATUS.VERIFIED]: "Phê duyệt xác minh",
  [IDENTITY_VERIFICATION_STATUS.REJECTED]: "Từ chối xác minh",
  [IDENTITY_VERIFICATION_STATUS.UNVERIFIED]: "Đưa về chưa xác minh",
});

/**
 * @param {string|null|undefined} currentStatus — canonical status
 * @returns {ReadonlyArray<{ nextStatus: string, label: string }>}
 */
export function getAvailableVerificationActions(currentStatus) {
  const from = String(currentStatus || IDENTITY_VERIFICATION_STATUS.UNVERIFIED)
    .trim()
    .toLowerCase();
  const allowed = VERIFICATION_TRANSITION_MATRIX[from];
  if (!allowed || allowed.length === 0) return Object.freeze([]);

  return Object.freeze(
    allowed.map((nextStatus) =>
      Object.freeze({
        nextStatus,
        label: VERIFICATION_ACTION_LABELS[nextStatus] || nextStatus,
      })
    )
  );
}

/**
 * @param {string|null|undefined} currentStatus
 * @param {string} nextStatus
 * @returns {boolean}
 */
export function isVerificationActionAvailable(currentStatus, nextStatus) {
  const actions = getAvailableVerificationActions(currentStatus);
  const to = String(nextStatus || "").trim().toLowerCase();
  return actions.some((a) => a.nextStatus === to);
}

/**
 * Confirmation payload shown before mutation. Rejection reason is deferred
 * (no canonical audited reason contract in 1H-A).
 *
 * @param {object} args
 * @param {object} args.item — admin queue DTO
 * @param {string} args.nextStatus
 * @returns {{ ok: true, payload: object } | { ok: false, code: string, message: string }}
 */
export function buildVerificationConfirmation({ item, nextStatus }) {
  if (!item || typeof item !== "object") {
    return {
      ok: false,
      code: "INVALID_TARGET",
      message: "Target player is required for confirmation",
    };
  }
  const playerId = item.playerId || item.authUserId;
  if (!playerId) {
    return {
      ok: false,
      code: "INVALID_TARGET",
      message: "Target player id is required for confirmation",
    };
  }
  const fromStatus = String(item.verificationStatus || "").trim().toLowerCase();
  const toStatus = String(nextStatus || "").trim().toLowerCase();
  if (!isVerificationActionAvailable(fromStatus, toStatus)) {
    return {
      ok: false,
      code: "INVALID_TRANSITION",
      message: `Action ${fromStatus} → ${toStatus} is not available`,
    };
  }

  return {
    ok: true,
    payload: Object.freeze({
      playerId: item.playerId || null,
      authUserId: item.authUserId || null,
      displayName: item.displayName || null,
      fromStatus,
      toStatus,
      fromStatusLabel: formatVerificationStatusDisplay(fromStatus),
      toStatusLabel: formatVerificationStatusDisplay(toStatus),
      venueId: item.venueId || null,
      /** Free-text rejection reason: deferred — no audited reason contract yet. */
      rejectionReasonSupported: false,
    }),
  };
}
