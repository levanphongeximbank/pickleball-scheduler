/**
 * Resolve knockout admission policy from a Competition Rules Profile.
 * Policy projection only — no draw/bracket/group mutation.
 */

import { createCompetitionRulesProfile } from "../domain/competitionRulesProfile.js";
import { COMPETITION_RULES_ERROR_CODE } from "../constants/errorCodes.js";

/**
 * @param {object} [profileOrRaw]
 */
export function resolveKnockoutAdmissionPolicy(profileOrRaw = {}) {
  const profile = createCompetitionRulesProfile(profileOrRaw);
  const admission = profile.knockoutAdmission;

  return Object.freeze({
    ok: true,
    knockoutAdmission: admission,
    distinctions: Object.freeze({
      GROUP_STAGE_BYPASS:
        "competition unit excluded from group-stage participation",
      DIRECT_KNOCKOUT_ENTRY:
        "competition unit receives an admitted knockout slot without group standings qualification",
      KNOCKOUT_BYE:
        "admitted knockout unit does not play one round due to bracket BYE allocation",
      SEEDING_POLICY:
        "ordering/placement only — seedNumber never implies DIRECT_KNOCKOUT_ENTRY",
    }),
    authority: Object.freeze({
      policyOwner: "competition-core.competition-rules",
      groupAllocationExecution: "existing draw / CE composition (not Adapter A)",
      knockoutByeExecution: "CORE-08 / CORE-09 / CE (not a new bye engine)",
      resultAcceptance: "CORE-17",
      persistenceAuthority: false,
      executionAuthority: false,
    }),
    code: null,
    message: null,
  });
}

/**
 * Fail-closed guard when a caller requests an unsupported admission claim.
 * @param {object} [profileOrRaw]
 * @param {{ claim?: string }} [options]
 */
export function assertKnockoutAdmissionDistinctions(profileOrRaw, options = {}) {
  const claim = String(options.claim || "").trim().toUpperCase();
  const collapsed =
    claim === "SEEDING_IS_DIRECT_ENTRY" ||
    claim === "BYE_IS_DIRECT_ENTRY" ||
    claim === "BYPASS_IS_DIRECT_ENTRY" ||
    claim === "DIRECT_ENTRY_IS_BYE";
  if (collapsed) {
    return Object.freeze({
      ok: false,
      code: COMPETITION_RULES_ERROR_CODE.INVALID_KNOCKOUT_ADMISSION,
      message:
        "GROUP_STAGE_BYPASS, DIRECT_KNOCKOUT_ENTRY, KNOCKOUT_BYE, and SEEDING_POLICY are distinct — do not collapse",
      details: Object.freeze({ claim }),
    });
  }
  return resolveKnockoutAdmissionPolicy(profileOrRaw);
}
