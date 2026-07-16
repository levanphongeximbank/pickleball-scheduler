import { RESTRICTED_COMPETITION_CLASSES } from "../constants/enums.js";
import { buildPrivatePairingRuntimeError } from "./prepareLivePrivatePairingOptions.js";
import { PRIVATE_PAIRING_RUNTIME_CODE } from "./runtimeCodes.js";

function isRestrictedCompetitionClass(competitionClass) {
  return RESTRICTED_COMPETITION_CLASSES.has(String(competitionClass || "").toUpperCase());
}

/**
 * Shared fatalConflicts / official blockedByPolicy gate before stage optimizers.
 *
 * @param {Object} resolved
 * @param {string} [competitionClass]
 * @returns {{ ok: true } | { ok: false, error: Object }}
 */
export function gateResolvedForStage(resolved, competitionClass) {
  if (resolved?.validationErrors?.length) {
    return {
      ok: false,
      error: buildPrivatePairingRuntimeError({
        errorCode: PRIVATE_PAIRING_RUNTIME_CODE.RULE_VALIDATION_FAILED,
        meta: { validationErrors: resolved.validationErrors },
      }),
    };
  }
  if (resolved?.fatalConflicts?.length) {
    return {
      ok: false,
      error: buildPrivatePairingRuntimeError({
        errorCode: PRIVATE_PAIRING_RUNTIME_CODE.RULE_SET_CONFLICT,
        meta: { fatalConflicts: resolved.fatalConflicts },
      }),
    };
  }
  if (
    isRestrictedCompetitionClass(competitionClass) &&
    (resolved?.blockedByPolicy || []).length > 0
  ) {
    return {
      ok: false,
      error: buildPrivatePairingRuntimeError({
        errorCode: PRIVATE_PAIRING_RUNTIME_CODE.PRIVATE_RULE_BLOCKED_BY_POLICY,
        meta: { blockedByPolicy: resolved.blockedByPolicy },
      }),
    };
  }
  return { ok: true };
}
