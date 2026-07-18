/**
 * Phase 3D — legacy status mappers (team + roster).
 */

import {
  COMPETITION_TEAM_STATUS,
  COMPETITION_ROSTER_STATUS,
  COMPETITION_ROSTER_MEMBER_STATUS,
} from "../../participants/enums/statuses.js";
import { TEAM_RUNTIME_ERROR_CODE } from "../errors/runtimeErrorCodes.js";
import { TeamRuntimeError } from "../errors/TeamRuntimeError.js";

/** @type {Readonly<Record<string, string>>} */
export const LEGACY_TEAM_STATUS_MAP = Object.freeze({
  draft: COMPETITION_TEAM_STATUS.DRAFT,
  active: COMPETITION_TEAM_STATUS.ACTIVE,
  withdrawn: COMPETITION_TEAM_STATUS.WITHDRAWN,
  disqualified: COMPETITION_TEAM_STATUS.DISQUALIFIED,
  completed: COMPETITION_TEAM_STATUS.COMPLETED,
  dq: COMPETITION_TEAM_STATUS.DISQUALIFIED,
});

/** @type {Readonly<Record<string, string>>} */
export const LEGACY_ROSTER_STATUS_MAP = Object.freeze({
  draft: COMPETITION_ROSTER_STATUS.DRAFT,
  submitted: COMPETITION_ROSTER_STATUS.SUBMITTED,
  approved: COMPETITION_ROSTER_STATUS.APPROVED,
  roster_locked: COMPETITION_ROSTER_STATUS.ROSTER_LOCKED,
  locked: COMPETITION_ROSTER_STATUS.ROSTER_LOCKED,
  amended: COMPETITION_ROSTER_STATUS.AMENDED,
  withdrawn: COMPETITION_ROSTER_STATUS.WITHDRAWN,
});

/**
 * @param {unknown} raw
 * @param {{ defaultStatus?: string }} [options]
 * @returns {string}
 */
export function mapLegacyTeamStatus(raw, options = {}) {
  if (raw == null || raw === "") {
    return options.defaultStatus || COMPETITION_TEAM_STATUS.ACTIVE;
  }
  const key = String(raw).trim().toLowerCase();
  const mapped = LEGACY_TEAM_STATUS_MAP[key];
  if (mapped) return mapped;
  const upper = String(raw).trim().toUpperCase();
  if (Object.values(COMPETITION_TEAM_STATUS).includes(upper)) return upper;
  throw new TeamRuntimeError(
    TEAM_RUNTIME_ERROR_CODE.UNSUPPORTED_TEAM_STATUS,
    "Unsupported team status",
    { status: raw }
  );
}

/**
 * @param {unknown} raw
 * @param {{ locked?: boolean, defaultStatus?: string }} [options]
 * @returns {string}
 */
export function mapLegacyRosterStatus(raw, options = {}) {
  if (options.locked === true) {
    return COMPETITION_ROSTER_STATUS.ROSTER_LOCKED;
  }
  if (raw == null || raw === "") {
    return options.defaultStatus || COMPETITION_ROSTER_STATUS.DRAFT;
  }
  const key = String(raw).trim().toLowerCase().replace(/\s+/g, "_");
  const mapped = LEGACY_ROSTER_STATUS_MAP[key];
  if (mapped) return mapped;
  const upper = String(raw).trim().toUpperCase();
  if (Object.values(COMPETITION_ROSTER_STATUS).includes(upper)) return upper;
  throw new TeamRuntimeError(
    TEAM_RUNTIME_ERROR_CODE.UNSUPPORTED_ROSTER_STATUS,
    "Unsupported roster status",
    { status: raw }
  );
}

/**
 * @param {unknown} raw
 * @param {{ absent?: boolean }} [options]
 * @returns {string}
 */
export function mapLegacyRosterMemberStatus(raw, options = {}) {
  if (options.absent === true) {
    return COMPETITION_ROSTER_MEMBER_STATUS.ABSENT;
  }
  if (raw == null || raw === "") {
    return COMPETITION_ROSTER_MEMBER_STATUS.ACTIVE;
  }
  const key = String(raw).trim().toLowerCase();
  if (key === "absent") return COMPETITION_ROSTER_MEMBER_STATUS.ABSENT;
  if (key === "replaced") return COMPETITION_ROSTER_MEMBER_STATUS.REPLACED;
  if (key === "withdrawn") return COMPETITION_ROSTER_MEMBER_STATUS.WITHDRAWN;
  if (key === "active") return COMPETITION_ROSTER_MEMBER_STATUS.ACTIVE;
  const upper = String(raw).trim().toUpperCase();
  if (Object.values(COMPETITION_ROSTER_MEMBER_STATUS).includes(upper)) return upper;
  return COMPETITION_ROSTER_MEMBER_STATUS.ACTIVE;
}
