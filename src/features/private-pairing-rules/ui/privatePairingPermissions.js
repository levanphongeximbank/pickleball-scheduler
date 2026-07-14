/**
 * PR-5 — client permission helpers for Private Pairing SUPER_ADMIN UI.
 * Menu + route + actions must all check these (not menu hide alone).
 */

import { can } from "../../../auth/rbac.js";
import { PERMISSIONS } from "../../identity/constants/permissions.js";
import {
  isPrivatePairingRulesEnabled,
  isPrivatePairingSimulationEnabled,
} from "../constants/codes.js";

export const PRIVATE_PAIRING_UI_PERMISSIONS = Object.freeze({
  VIEW: PERMISSIONS.PAIRING_PRIVATE_RULES_VIEW,
  MANAGE: PERMISSIONS.PAIRING_PRIVATE_RULES_MANAGE,
  AUDIT: PERMISSIONS.PAIRING_PRIVATE_RULES_AUDIT,
  SIMULATE: PERMISSIONS.PAIRING_PRIVATE_RULES_SIMULATE,
});

export function canViewPrivatePairingRules(user, options = {}) {
  if (!isPrivatePairingRulesEnabled(options.envSource)) return false;
  return can(user, PRIVATE_PAIRING_UI_PERMISSIONS.VIEW, {}, options);
}

export function canManagePrivatePairingRules(user, options = {}) {
  if (!isPrivatePairingRulesEnabled(options.envSource)) return false;
  return can(user, PRIVATE_PAIRING_UI_PERMISSIONS.MANAGE, {}, options);
}

export function canAuditPrivatePairingRules(user, options = {}) {
  if (!isPrivatePairingRulesEnabled(options.envSource)) return false;
  return can(user, PRIVATE_PAIRING_UI_PERMISSIONS.AUDIT, {}, options);
}

export function canSimulatePrivatePairingRules(user, options = {}) {
  if (!isPrivatePairingRulesEnabled(options.envSource)) return false;
  if (!isPrivatePairingSimulationEnabled(options.envSource)) return false;
  return can(user, PRIVATE_PAIRING_UI_PERMISSIONS.SIMULATE, {}, options);
}

/** Forbidden payload for direct URL / service refusals. */
export function privatePairingForbiddenResult(code = "403_FORBIDDEN") {
  return {
    ok: false,
    code,
    message: "403_FORBIDDEN",
  };
}
