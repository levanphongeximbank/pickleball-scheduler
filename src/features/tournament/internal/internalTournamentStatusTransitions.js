/**
 * Internal Tournament status transition contract (IT-E2E-004).
 * Server SQL mirrors this graph for mode = internal_tournament only.
 * Team / Official / Daily are NOT constrained by this module.
 */
import { TOURNAMENT_STATUS } from "../../../models/tournament/constants.js";

export const INTERNAL_STATUS_TRANSITION_ERROR = "INTERNAL_STATUS_TRANSITION_DENIED";

/**
 * Legal ordinary transitions for internal_tournament.
 * draft → ready is intentional (BTC draw/schedule path skips optional registration).
 * ready → completed allows close after finished RR without requiring a separate activate click
 * when competition already advanced via scoring (client also bumps ready→active on first score).
 */
export const INTERNAL_TOURNAMENT_STATUS_TRANSITIONS = Object.freeze({
  [TOURNAMENT_STATUS.DRAFT]: [
    TOURNAMENT_STATUS.REGISTRATION,
    TOURNAMENT_STATUS.READY,
    TOURNAMENT_STATUS.CANCELLED,
  ],
  [TOURNAMENT_STATUS.REGISTRATION]: [
    TOURNAMENT_STATUS.READY,
    TOURNAMENT_STATUS.DRAFT,
    TOURNAMENT_STATUS.CANCELLED,
  ],
  [TOURNAMENT_STATUS.READY]: [
    TOURNAMENT_STATUS.ACTIVE,
    TOURNAMENT_STATUS.COMPLETED,
    TOURNAMENT_STATUS.REGISTRATION,
    TOURNAMENT_STATUS.CANCELLED,
  ],
  [TOURNAMENT_STATUS.ACTIVE]: [
    TOURNAMENT_STATUS.COMPLETED,
    TOURNAMENT_STATUS.CANCELLED,
  ],
  [TOURNAMENT_STATUS.COMPLETED]: [],
  [TOURNAMENT_STATUS.CANCELLED]: [TOURNAMENT_STATUS.DRAFT],
});

export function normalizeInternalStatus(status) {
  const value = String(status || TOURNAMENT_STATUS.DRAFT).trim().toLowerCase();
  return Object.values(TOURNAMENT_STATUS).includes(value)
    ? value
    : TOURNAMENT_STATUS.DRAFT;
}

/**
 * @param {string} fromStatus
 * @param {string} toStatus
 * @param {{ forceReopen?: boolean }} [options]
 */
export function validateInternalTournamentStatusTransition(
  fromStatus,
  toStatus,
  options = {}
) {
  const from = normalizeInternalStatus(fromStatus);
  const to = normalizeInternalStatus(toStatus);

  if (from === to) {
    return { ok: true, from, to, noop: true };
  }

  if (
    options.forceReopen === true &&
    from === TOURNAMENT_STATUS.COMPLETED &&
    to === TOURNAMENT_STATUS.ACTIVE
  ) {
    return { ok: true, from, to, forceReopen: true };
  }

  const allowed = INTERNAL_TOURNAMENT_STATUS_TRANSITIONS[from] || [];
  if (!allowed.includes(to)) {
    return {
      ok: false,
      code: INTERNAL_STATUS_TRANSITION_ERROR,
      from,
      to,
      error: `Không thể chuyển giải nội bộ từ ${from} sang ${to}.`,
    };
  }

  return { ok: true, from, to };
}

/**
 * Suggest status when first match score is committed while still ready.
 */
export function resolveStatusAfterMatchActivity(currentStatus) {
  const status = normalizeInternalStatus(currentStatus);
  if (status === TOURNAMENT_STATUS.READY) {
    return TOURNAMENT_STATUS.ACTIVE;
  }
  return status;
}
