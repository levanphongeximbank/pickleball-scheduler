/**
 * Phase 3F — legacy match / sub-match status mapper.
 */

import { MATCH_STATUS } from "../enums/matchStatuses.js";
import { MATCH_RUNTIME_ERROR_CODE } from "../errors/runtimeErrorCodes.js";
import { MatchRuntimeError } from "../errors/MatchRuntimeError.js";

/** @type {Readonly<Record<string, string>>} */
export const LEGACY_MATCH_STATUS_MAP = Object.freeze({
  waiting: MATCH_STATUS.READY,
  pending: MATCH_STATUS.READY,
  scheduled: MATCH_STATUS.SCHEDULED,
  assigned: MATCH_STATUS.READY_TO_START,
  ready: MATCH_STATUS.READY_TO_START,
  ready_to_start: MATCH_STATUS.READY_TO_START,
  lineup_open: MATCH_STATUS.LINEUPS_PENDING,
  lineups_pending: MATCH_STATUS.LINEUPS_PENDING,
  locked: MATCH_STATUS.READY_TO_START,
  published: MATCH_STATUS.READY_TO_START,
  playing: MATCH_STATUS.IN_PROGRESS,
  in_progress: MATCH_STATUS.IN_PROGRESS,
  inprogress: MATCH_STATUS.IN_PROGRESS,
  active: MATCH_STATUS.IN_PROGRESS,
  running: MATCH_STATUS.IN_PROGRESS,
  // Unambiguous legacy "paused" → canonical PAUSED (distinct from SUSPENDED).
  paused: MATCH_STATUS.PAUSED,
  pause: MATCH_STATUS.PAUSED,
  suspended: MATCH_STATUS.SUSPENDED,
  suspend: MATCH_STATUS.SUSPENDED,
  completed: MATCH_STATUS.COMPLETED,
  done: MATCH_STATUS.COMPLETED,
  finished: MATCH_STATUS.COMPLETED,
  forfeit: MATCH_STATUS.COMPLETED,
  walkover: MATCH_STATUS.COMPLETED,
  postponed: MATCH_STATUS.POSTPONED,
  cancelled: MATCH_STATUS.CANCELLED,
  canceled: MATCH_STATUS.CANCELLED,
  draft: MATCH_STATUS.DRAFT,
  not_started: MATCH_STATUS.READY,
});

/**
 * @param {unknown} raw
 * @param {{ defaultStatus?: string }} [options]
 * @returns {string}
 */
export function mapLegacyMatchStatus(raw, options = {}) {
  if (raw == null || raw === "") {
    return options.defaultStatus || MATCH_STATUS.DRAFT;
  }
  const key = String(raw).trim().toLowerCase().replace(/\s+/g, "_");
  const mapped = LEGACY_MATCH_STATUS_MAP[key];
  if (mapped) return mapped;
  const upper = String(raw).trim().toUpperCase();
  if (Object.values(MATCH_STATUS).includes(upper)) return upper;
  throw new MatchRuntimeError(
    MATCH_RUNTIME_ERROR_CODE.MATCH_UNSUPPORTED_STATUS,
    "Unsupported match status",
    { status: raw }
  );
}
