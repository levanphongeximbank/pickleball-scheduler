/**
 * E2E-06 Governance action → Identity permission map.
 * Does NOT create a competing permission taxonomy.
 */

import { PERMISSIONS } from "../../../../identity/constants/permissions.js";
import { GOVERNANCE_ACTION } from "../constants.js";

export const GOVERNANCE_CAPABILITY = Object.freeze({
  GOVERNANCE_READ: "competition.governance.read",
  RELIABILITY_EVALUATE: "competition.governance.reliability",
  RECOVERY_EVALUATE: "competition.governance.recovery",
  REPLAY_EVALUATE: "competition.governance.replay",
  IMPORT_EVALUATE: "competition.governance.import",
  EXPORT_EVALUATE: "competition.governance.export",
  ARCHIVE_EVALUATE: "competition.governance.archive",
  EVIDENCE_BUILD: "competition.governance.evidence",
  CERTIFICATION_READ: "competition.governance.certification",
});

/**
 * @type {Readonly<Record<string, Readonly<{
 *   capability: string,
 *   requiredPermissions: readonly string[],
 *   requireVenue: boolean,
 *   elevated: boolean,
 * }>>>}
 */
export const GOVERNANCE_ACTION_PERMISSION_MAP = Object.freeze({
  [GOVERNANCE_ACTION.GOVERNANCE_READ]: Object.freeze({
    capability: GOVERNANCE_CAPABILITY.GOVERNANCE_READ,
    requiredPermissions: Object.freeze([PERMISSIONS.TOURNAMENT_VIEW]),
    requireVenue: false,
    elevated: false,
  }),
  [GOVERNANCE_ACTION.RELIABILITY_EVALUATE]: Object.freeze({
    capability: GOVERNANCE_CAPABILITY.RELIABILITY_EVALUATE,
    requiredPermissions: Object.freeze([
      PERMISSIONS.TOURNAMENT_VIEW,
      PERMISSIONS.DIRECTOR_USE,
    ]),
    requireVenue: false,
    elevated: false,
  }),
  [GOVERNANCE_ACTION.RECOVERY_EVALUATE]: Object.freeze({
    capability: GOVERNANCE_CAPABILITY.RECOVERY_EVALUATE,
    requiredPermissions: Object.freeze([
      PERMISSIONS.TOURNAMENT_UPDATE,
      PERMISSIONS.DIRECTOR_USE,
      PERMISSIONS.TOURNAMENT_CERTIFY,
    ]),
    requireVenue: false,
    elevated: true,
  }),
  [GOVERNANCE_ACTION.REPLAY_EVALUATE]: Object.freeze({
    capability: GOVERNANCE_CAPABILITY.REPLAY_EVALUATE,
    requiredPermissions: Object.freeze([
      PERMISSIONS.TOURNAMENT_VIEW,
      PERMISSIONS.DIRECTOR_USE,
    ]),
    requireVenue: false,
    elevated: false,
  }),
  [GOVERNANCE_ACTION.IMPORT_EVALUATE]: Object.freeze({
    capability: GOVERNANCE_CAPABILITY.IMPORT_EVALUATE,
    requiredPermissions: Object.freeze([
      PERMISSIONS.TOURNAMENT_UPDATE,
      PERMISSIONS.TOURNAMENT_CERTIFY,
    ]),
    requireVenue: false,
    elevated: true,
  }),
  [GOVERNANCE_ACTION.EXPORT_EVALUATE]: Object.freeze({
    capability: GOVERNANCE_CAPABILITY.EXPORT_EVALUATE,
    requiredPermissions: Object.freeze([PERMISSIONS.TOURNAMENT_VIEW]),
    requireVenue: false,
    elevated: false,
  }),
  [GOVERNANCE_ACTION.ARCHIVE_EVALUATE]: Object.freeze({
    capability: GOVERNANCE_CAPABILITY.ARCHIVE_EVALUATE,
    requiredPermissions: Object.freeze([
      PERMISSIONS.TOURNAMENT_UPDATE,
      PERMISSIONS.TOURNAMENT_CERTIFY,
    ]),
    requireVenue: false,
    elevated: true,
  }),
  [GOVERNANCE_ACTION.EVIDENCE_BUILD]: Object.freeze({
    capability: GOVERNANCE_CAPABILITY.EVIDENCE_BUILD,
    requiredPermissions: Object.freeze([
      PERMISSIONS.TOURNAMENT_VIEW,
      PERMISSIONS.DIRECTOR_USE,
    ]),
    requireVenue: false,
    elevated: false,
  }),
  [GOVERNANCE_ACTION.CERTIFICATION_READ]: Object.freeze({
    capability: GOVERNANCE_CAPABILITY.CERTIFICATION_READ,
    requiredPermissions: Object.freeze([
      PERMISSIONS.TOURNAMENT_VIEW,
      PERMISSIONS.TOURNAMENT_CERTIFY,
    ]),
    requireVenue: false,
    elevated: false,
  }),
});

/**
 * @param {string} action
 * @returns {boolean}
 */
export function isKnownGovernanceAction(action) {
  return Object.prototype.hasOwnProperty.call(
    GOVERNANCE_ACTION_PERMISSION_MAP,
    String(action || "")
  );
}

/**
 * @param {string} action
 */
export function resolveGovernanceActionPermissions(action) {
  const key = String(action || "");
  if (!isKnownGovernanceAction(key)) {
    return null;
  }
  return GOVERNANCE_ACTION_PERMISSION_MAP[key];
}
