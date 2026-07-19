/**
 * Phase 3E — legacy lineup status mapper.
 */

import { COMPETITION_LINEUP_STATUS } from "../../participants/enums/statuses.js";
import { LINEUP_RUNTIME_ERROR_CODE } from "../errors/runtimeErrorCodes.js";
import { LineupRuntimeError } from "../errors/LineupRuntimeError.js";

/** @type {Readonly<Record<string, string>>} */
export const LEGACY_LINEUP_STATUS_MAP = Object.freeze({
  not_submitted: COMPETITION_LINEUP_STATUS.DRAFT,
  not_started: COMPETITION_LINEUP_STATUS.DRAFT,
  draft: COMPETITION_LINEUP_STATUS.DRAFT,
  submitted: COMPETITION_LINEUP_STATUS.SUBMITTED,
  locked: COMPETITION_LINEUP_STATUS.LOCKED,
  published: COMPETITION_LINEUP_STATUS.PUBLISHED,
  overridden: COMPETITION_LINEUP_STATUS.SUPERSEDED,
  withdrawn: COMPETITION_LINEUP_STATUS.VOIDED,
  expired: COMPETITION_LINEUP_STATUS.VOIDED,
  voided: COMPETITION_LINEUP_STATUS.VOIDED,
  superseded: COMPETITION_LINEUP_STATUS.SUPERSEDED,
});

/**
 * @param {unknown} raw
 * @param {{ defaultStatus?: string }} [options]
 * @returns {string}
 */
export function mapLegacyLineupStatus(raw, options = {}) {
  if (raw == null || raw === "") {
    return options.defaultStatus || COMPETITION_LINEUP_STATUS.DRAFT;
  }
  const key = String(raw).trim().toLowerCase().replace(/\s+/g, "_");
  const mapped = LEGACY_LINEUP_STATUS_MAP[key];
  if (mapped) return mapped;
  const upper = String(raw).trim().toUpperCase();
  if (Object.values(COMPETITION_LINEUP_STATUS).includes(upper)) return upper;
  throw new LineupRuntimeError(
    LINEUP_RUNTIME_ERROR_CODE.UNSUPPORTED_LINEUP_STATUS,
    "Unsupported lineup status",
    { status: raw }
  );
}
