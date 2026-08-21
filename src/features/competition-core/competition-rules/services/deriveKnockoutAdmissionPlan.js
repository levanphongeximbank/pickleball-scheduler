/**
 * Derive knockout admission plan — populations + slot math.
 * Policy/plan only. Does NOT call group draw or mutate brackets.
 *
 * GROUP_STAGE_BYPASS ≠ DIRECT_KNOCKOUT_ENTRY ≠ KNOCKOUT_BYE ≠ SEEDING
 */

import { COMPETITION_RULES_ERROR_CODE } from "../constants/errorCodes.js";
import {
  BYE_POLICY,
  KNOCKOUT_ENTRY_ROUND,
  DIRECT_KNOCKOUT_ENTRY_SOURCE,
  KNOCKOUT_BYE_ALLOCATION_SHAPE,
  deriveKnockoutEntryRound,
} from "../constants/enums.js";
import { createCompetitionRulesProfile } from "../domain/competitionRulesProfile.js";
import { deriveQualificationPlan } from "./deriveQualificationPlan.js";

/**
 * @param {object} [profileOrRaw]
 * @param {{
 *   groupParticipantEntryIds?: string[],
 *   competitionPopulationEntryIds?: string[],
 * }} [context]
 */
export function deriveKnockoutAdmissionPlan(profileOrRaw = {}, context = {}) {
  const profile = createCompetitionRulesProfile(profileOrRaw);
  const admission = profile.knockoutAdmission;
  const issues = [];

  const qualificationPlan = deriveQualificationPlan({
    groupCount: profile.groupStage.groupCount,
    totalKnockoutSlots: profile.qualification.totalKnockoutSlots,
    totalQualifiers: profile.qualification.totalQualifiers,
    directQualifiersPerGroup: profile.qualification.directQualifiersPerGroup,
    directKnockoutEntryCount: profile.qualification.directKnockoutEntryCount,
    groupStageEnabled: profile.groupStage.groupStageEnabled,
  });

  if (!qualificationPlan.ok) {
    return Object.freeze({
      ok: false,
      code: qualificationPlan.code,
      message: qualificationPlan.message,
      details: qualificationPlan.details,
      profile,
      qualificationPlan: null,
      knockoutAdmissionPlan: null,
    });
  }

  const bypassEntrants = admission.groupStageBypass.entrants || [];
  const directEntrants = admission.directKnockoutEntry.entrants || [];
  const bypassIds = new Set(bypassEntrants.map((e) => e.entryId));
  const directIds = new Set(directEntrants.map((e) => e.entryId));

  // Duplicate refs within each population
  if (bypassEntrants.length !== bypassIds.size) {
    issues.push(
      Object.freeze({
        code: COMPETITION_RULES_ERROR_CODE.DUPLICATE_ENTRANT_REF,
        message: "Duplicate entryId in groupStageBypass.entrants",
      })
    );
  }
  if (directEntrants.length !== directIds.size) {
    issues.push(
      Object.freeze({
        code: COMPETITION_RULES_ERROR_CODE.DUPLICATE_ENTRANT_REF,
        message: "Duplicate entryId in directKnockoutEntry.entrants",
      })
    );
  }

  // Same entrant cannot be both group participant and bypass/direct when caller supplies both
  const groupParticipantIds = Array.isArray(context.groupParticipantEntryIds)
    ? context.groupParticipantEntryIds.map((id) => String(id).trim()).filter(Boolean)
    : null;
  if (groupParticipantIds) {
    const groupSet = new Set(groupParticipantIds);
    for (const id of [...bypassIds, ...directIds]) {
      if (groupSet.has(id)) {
        issues.push(
          Object.freeze({
            code: COMPETITION_RULES_ERROR_CODE.IMPOSSIBLE_KNOCKOUT_ADMISSION,
            message:
              "Same entryId cannot be both group participant and group-bypass/direct entrant",
            details: Object.freeze({ entryId: id }),
          })
        );
      }
    }
  }

  if (
    admission.directKnockoutEntry.enabled &&
    admission.directKnockoutEntry.count < 1
  ) {
    issues.push(
      Object.freeze({
        code: COMPETITION_RULES_ERROR_CODE.INVALID_DIRECT_KNOCKOUT_ENTRY,
        message:
          "directKnockoutEntry.enabled requires count >= 1",
        details: Object.freeze({
          count: admission.directKnockoutEntry.count,
        }),
      })
    );
  }

  if (
    admission.directKnockoutEntry.enabled ||
    admission.directKnockoutEntry.count > 0
  ) {
    if (
      admission.directKnockoutEntry.count !==
      profile.qualification.directKnockoutEntryCount
    ) {
      issues.push(
        Object.freeze({
          code: COMPETITION_RULES_ERROR_CODE.INVALID_KNOCKOUT_ADMISSION,
          message:
            "qualification.directKnockoutEntryCount must equal knockoutAdmission.directKnockoutEntry.count",
          details: Object.freeze({
            qualificationCount: profile.qualification.directKnockoutEntryCount,
            admissionCount: admission.directKnockoutEntry.count,
          }),
        })
      );
    }

    const targetStage = admission.directKnockoutEntry.targetStage;
    if (
      targetStage != null &&
      !Object.values(KNOCKOUT_ENTRY_ROUND).includes(targetStage)
    ) {
      issues.push(
        Object.freeze({
          code: COMPETITION_RULES_ERROR_CODE.INVALID_DIRECT_KNOCKOUT_ENTRY,
          message: "Invalid direct-entry targetStage",
          details: Object.freeze({ targetStage }),
        })
      );
    }

    if (
      directEntrants.length > 0 &&
      !admission.directKnockoutEntry.sourceCategory &&
      directEntrants.some((e) => !e.sourceCategory)
    ) {
      issues.push(
        Object.freeze({
          code: COMPETITION_RULES_ERROR_CODE.INVALID_DIRECT_KNOCKOUT_ENTRY,
          message:
            "direct-entry sourceCategory required when resolved entrants are supplied",
          details: Object.freeze({
            allowed: Object.values(DIRECT_KNOCKOUT_ENTRY_SOURCE),
          }),
        })
      );
    }

    if (directEntrants.length > admission.directKnockoutEntry.count) {
      issues.push(
        Object.freeze({
          code: COMPETITION_RULES_ERROR_CODE.IMPOSSIBLE_KNOCKOUT_ADMISSION,
          message:
            "Resolved direct entrants exceed directKnockoutEntry.count",
          details: Object.freeze({
            resolved: directEntrants.length,
            count: admission.directKnockoutEntry.count,
          }),
        })
      );
    }
  }

  if (admission.groupStageBypass.enabled && bypassEntrants.length === 0) {
    issues.push(
      Object.freeze({
        code: COMPETITION_RULES_ERROR_CODE.INVALID_GROUP_STAGE_BYPASS,
        message:
          "groupStageBypass.enabled requires at least one canonical entrant entryId",
      })
    );
  }

  for (const e of [...bypassEntrants, ...directEntrants]) {
    if (!e.entryId || typeof e.entryId !== "string") {
      issues.push(
        Object.freeze({
          code: COMPETITION_RULES_ERROR_CODE.MISSING_ENTRANT_IDENTITY,
          message: "Canonical entryId required for admission entrant refs",
        })
      );
    }
  }

  // BYE policy validation (policy shape only — reuse CORE-09 vocabulary)
  if (!Object.values(BYE_POLICY).includes(admission.bye.byePolicy)) {
    issues.push(
      Object.freeze({
        code: COMPETITION_RULES_ERROR_CODE.INVALID_BYE_POLICY,
        message: "Invalid knockout byePolicy",
        details: Object.freeze({ byePolicy: admission.bye.byePolicy }),
      })
    );
  }
  if (
    !Object.values(KNOCKOUT_BYE_ALLOCATION_SHAPE).includes(
      admission.bye.allocationShape
    )
  ) {
    issues.push(
      Object.freeze({
        code: COMPETITION_RULES_ERROR_CODE.INVALID_BYE_POLICY,
        message: "Unsupported BYE allocationShape",
        details: Object.freeze({
          allocationShape: admission.bye.allocationShape,
        }),
      })
    );
  }

  // Bracket size / entry round compatibility for knockout field
  const bracketEntryRound = deriveKnockoutEntryRound(
    qualificationPlan.totalKnockoutSlots
  );
  if (profile.knockout.knockoutEnabled && !bracketEntryRound) {
    issues.push(
      Object.freeze({
        code: COMPETITION_RULES_ERROR_CODE.INVALID_KNOCKOUT,
        message:
          "totalKnockoutSlots must be a power-of-two bracket size (2/4/8/16/32) when knockoutEnabled",
        details: Object.freeze({
          totalKnockoutSlots: qualificationPlan.totalKnockoutSlots,
        }),
      })
    );
  }

  // Impossible BYE: NONE policy cannot pad non-power-of-two admitted counts.
  // (Admitted count for bye math is totalKnockoutSlots when field is full;
  //  under-filled fields are an execution concern — policy flags NONE + padding need.)
  if (
    admission.bye.byePolicy === BYE_POLICY.NONE &&
    profile.knockout.knockoutEnabled &&
    qualificationPlan.totalKnockoutSlots > 0
  ) {
    // Policy allows NONE only when no padding is expected at declared field size.
    // Declared field is already power-of-two; runtime underfill would still need byes —
    // document that NONE fails closed at match-generation when B−N > 0.
    // No additional issue here unless allocationShape is unsupported.
  }

  const competitionPopulation = Array.isArray(context.competitionPopulationEntryIds)
    ? context.competitionPopulationEntryIds
        .map((id) => String(id).trim())
        .filter(Boolean)
    : null;

  // Direct knockout entrants are excluded from group allocation by definition
  // (GROUP_STAGE_BYPASS population includes them for plan filtering).
  const effectiveBypassIds = new Set([...bypassIds, ...directIds]);

  const groupStageParticipantPopulation = competitionPopulation
    ? competitionPopulation.filter((id) => !effectiveBypassIds.has(id))
    : null;

  const ok = issues.length === 0;
  if (!ok) {
    return Object.freeze({
      ok: false,
      code: issues[0].code,
      message: issues[0].message,
      details: issues[0].details || Object.freeze({}),
      issues: Object.freeze(issues),
      profile,
      qualificationPlan,
      knockoutAdmissionPlan: null,
    });
  }

  const plan = Object.freeze({
    totalKnockoutSlots: qualificationPlan.totalKnockoutSlots,
    directKnockoutEntrySlots: qualificationPlan.directKnockoutEntrySlots,
    groupDirectQualifierSlots: qualificationPlan.groupDirectQualifierSlots,
    wildcardSlots: qualificationPlan.wildcardSlots,
    remainingSlots: qualificationPlan.remainingSlots,
    requiresCrossGroupWildcardRanking:
      qualificationPlan.requiresCrossGroupWildcardRanking,
    groupStageBypass: Object.freeze({
      enabled: admission.groupStageBypass.enabled || directIds.size > 0,
      entrants: Object.freeze(
        [...effectiveBypassIds].sort().map((entryId) => Object.freeze({ entryId }))
      ),
      note:
        "Bypassed units remain in competition population but must not enter group allocation / group matches / group standings",
    }),
    directKnockoutEntry: Object.freeze({
      enabled: admission.directKnockoutEntry.enabled,
      count: admission.directKnockoutEntry.count,
      sourceCategory: admission.directKnockoutEntry.sourceCategory,
      targetStage: admission.directKnockoutEntry.targetStage,
      /**
       * Distinct from bracket-wide knockout.entryRound
       * (derived from totalKnockoutSlots / qualifierCount).
       */
      bracketWideEntryRound: bracketEntryRound,
      entrants: Object.freeze(directEntrants.map((e) => Object.freeze({ ...e }))),
      unresolvedSlotCount: Math.max(
        0,
        admission.directKnockoutEntry.count - directEntrants.length
      ),
    }),
    bye: Object.freeze({
      byePolicy: admission.bye.byePolicy,
      allocationShape: admission.bye.allocationShape,
      executionOwner: "CORE-08 / CORE-09 / CE",
      newByeEngine: false,
      fakeByeWinner: false,
      phantomResult: false,
    }),
    populations: Object.freeze({
      competitionPopulationEntryIds: competitionPopulation
        ? Object.freeze([...competitionPopulation])
        : null,
      groupStageParticipantEntryIds: groupStageParticipantPopulation
        ? Object.freeze([...groupStageParticipantPopulation])
        : null,
      groupStageBypassEntryIds: Object.freeze([...effectiveBypassIds].sort()),
      directKnockoutEntryIds: Object.freeze([...directIds].sort()),
    }),
    seedingDistinctFromDirectEntry: true,
    groupStageBypassDistinctFromDirectEntry: true,
    directEntryDistinctFromBye: true,
    canonicalIdentity: "entryId",
    displayNameIdentityAllowed: false,
  });

  return Object.freeze({
    ok: true,
    profile,
    qualificationPlan,
    knockoutAdmissionPlan: plan,
    code: null,
    message: null,
  });
}
