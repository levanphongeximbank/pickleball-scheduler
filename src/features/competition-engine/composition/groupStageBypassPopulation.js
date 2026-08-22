/**
 * GROUP_STAGE_BYPASS population filter for shared group allocation.
 *
 * competitionPopulationEntryIds − explicit groupStageBypassEntryIds
 *   = groupStageParticipantEntryIds
 *
 * Bypass entrants remain legitimate competition entrants — not deleted.
 * DIRECT alone does NOT imply bypass.
 */

import { deriveKnockoutAdmissionPlan } from "../../competition-core/competition-rules/index.js";
import { E2E02_ERROR_CODE, failE2E02 } from "./errors.js";
import { deepFreeze } from "./fingerprint.js";
import { normalizeCompetitionUnitParticipants } from "./entryIdentity.js";

/**
 * @param {{
 *   participants: Array<{ entryId?: string, participantId?: string, seedNumber?: number }|string>,
 *   competitionRulesProfile?: object,
 *   knockoutAdmissionPlan?: object|null,
 *   groupStageBypassEntryIds?: string[],
 *   requireCanonicalEntryId?: boolean,
 *   competitionUnitKind?: string|null,
 * }} input
 */
export function applyGroupStageBypassPopulation(input = {}) {
  const normalized = normalizeCompetitionUnitParticipants(input.participants || [], {
    requireCanonicalEntryId: input.requireCanonicalEntryId === true,
    competitionUnitKind: input.competitionUnitKind,
  });
  const competitionPopulationEntryIds = normalized.map((p) => p.entryId);

  let plan = input.knockoutAdmissionPlan || null;
  if (!plan && input.competitionRulesProfile) {
    const derived = deriveKnockoutAdmissionPlan(input.competitionRulesProfile, {
      competitionPopulationEntryIds,
    });
    if (!derived.ok) {
      failE2E02(
        E2E02_ERROR_CODE.INVALID_CONFIGURATION,
        derived.message || "knockout admission plan derivation failed",
        { code: derived.code, details: derived.details || {} }
      );
    }
    plan = derived.knockoutAdmissionPlan;
  }

  const bypassIds = new Set(
    (
      plan?.populations?.groupStageBypassEntryIds ||
      input.groupStageBypassEntryIds ||
      []
    )
      .map((id) => String(id).trim())
      .filter(Boolean)
  );

  const groupStageParticipants = normalized.filter(
    (p) => !bypassIds.has(p.entryId)
  );
  const bypassed = normalized.filter((p) => bypassIds.has(p.entryId));

  // Fail-closed: explicit bypass ids not present in competition population
  for (const id of bypassIds) {
    if (!competitionPopulationEntryIds.includes(id)) {
      failE2E02(
        E2E02_ERROR_CODE.INVALID_CONFIGURATION,
        "group-stage bypass entryId not in competition population",
        { entryId: id }
      );
    }
  }

  return deepFreeze({
    competitionPopulationEntryIds: Object.freeze([...competitionPopulationEntryIds]),
    groupStageBypassEntryIds: Object.freeze([...bypassIds].sort()),
    groupStageParticipantEntryIds: Object.freeze(
      groupStageParticipants.map((p) => p.entryId)
    ),
    groupStageParticipants: Object.freeze(
      groupStageParticipants.map((p) =>
        Object.freeze({
          entryId: p.entryId,
          participantId: p.participantId,
          seedNumber: p.seedNumber,
        })
      )
    ),
    bypassedEntrants: Object.freeze(
      bypassed.map((p) =>
        Object.freeze({
          entryId: p.entryId,
          participantId: p.participantId,
          seedNumber: p.seedNumber,
        })
      )
    ),
    knockoutAdmissionPlan: plan || null,
    distinctions: Object.freeze({
      DIRECT_ENTRY_IMPLIES_BYPASS: false,
      BYPASS_IMPLIES_DIRECT: false,
    }),
  });
}
