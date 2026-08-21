/**
 * Derive knockout admission plan — populations + slot math.
 * Policy/plan only. Does NOT call group draw or mutate brackets.
 *
 * GROUP_STAGE_BYPASS ≠ DIRECT_KNOCKOUT_ENTRY ≠ KNOCKOUT_BYE ≠ SEEDING
 *
 * DIRECT_ENTRY_IMPLIES_BYPASS = NO
 * EXPLICIT_DIRECT_AND_BYPASS_OVERLAP_ALLOWED = YES
 */

import { COMPETITION_RULES_ERROR_CODE } from "../constants/errorCodes.js";
import {
  BYE_POLICY,
  KNOCKOUT_ENTRY_ROUND,
  DIRECT_KNOCKOUT_ENTRY_SOURCE,
  KNOCKOUT_BYE_ALLOCATION_SHAPE,
  deriveKnockoutEntryRound,
  isDirectEntryTargetStageCompatible,
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

  // Group-participant conflict applies ONLY to explicit BYPASS entrants.
  // DIRECT_KNOCKOUT_ENTRY alone may still appear in group participant population.
  const groupParticipantIds = Array.isArray(context.groupParticipantEntryIds)
    ? context.groupParticipantEntryIds
        .map((id) => String(id).trim())
        .filter(Boolean)
    : null;
  if (groupParticipantIds) {
    const groupSet = new Set(groupParticipantIds);
    for (const id of bypassIds) {
      if (groupSet.has(id)) {
        issues.push(
          Object.freeze({
            code: COMPETITION_RULES_ERROR_CODE.IMPOSSIBLE_KNOCKOUT_ADMISSION,
            message:
              "Same entryId cannot be both group participant and explicit group-stage bypass",
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
        message: "directKnockoutEntry.enabled requires count >= 1",
        details: Object.freeze({
          count: admission.directKnockoutEntry.count,
        }),
      })
    );
  }

  const bracketEntryRound = deriveKnockoutEntryRound(
    qualificationPlan.totalKnockoutSlots
  );

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

    const policyTargetStage = admission.directKnockoutEntry.targetStage;
    const unresolvedSlotCount = Math.max(
      0,
      admission.directKnockoutEntry.count - directEntrants.length
    );

    // Unresolved slots require an unambiguous policy-level default targetStage
    if (unresolvedSlotCount > 0) {
      if (
        policyTargetStage == null ||
        !Object.values(KNOCKOUT_ENTRY_ROUND).includes(policyTargetStage)
      ) {
        issues.push(
          Object.freeze({
            code: COMPETITION_RULES_ERROR_CODE.INVALID_DIRECT_KNOCKOUT_ENTRY,
            message:
              "directKnockoutEntry.targetStage required when unresolved direct slots remain",
            details: Object.freeze({
              unresolvedSlotCount,
              targetStage: policyTargetStage,
            }),
          })
        );
      }
    }

    // Every resolved entrant must have a valid targetStage (own or inherited)
    for (const e of directEntrants) {
      const effectiveStage = e.targetStage || policyTargetStage;
      if (
        effectiveStage == null ||
        !Object.values(KNOCKOUT_ENTRY_ROUND).includes(effectiveStage)
      ) {
        issues.push(
          Object.freeze({
            code: COMPETITION_RULES_ERROR_CODE.INVALID_DIRECT_KNOCKOUT_ENTRY,
            message:
              "Resolved direct entrant requires a valid targetStage (own or policy default)",
            details: Object.freeze({ entryId: e.entryId, targetStage: effectiveStage }),
          })
        );
        continue;
      }
      if (
        bracketEntryRound &&
        !isDirectEntryTargetStageCompatible(effectiveStage, bracketEntryRound)
      ) {
        issues.push(
          Object.freeze({
            code: COMPETITION_RULES_ERROR_CODE.INVALID_DIRECT_KNOCKOUT_ENTRY,
            message:
              "direct-entry targetStage is incompatible with bracket-wide entry round (must be same or later stage)",
            details: Object.freeze({
              entryId: e.entryId,
              targetStage: effectiveStage,
              bracketWideEntryRound: bracketEntryRound,
              totalKnockoutSlots: qualificationPlan.totalKnockoutSlots,
            }),
          })
        );
      }
    }

    if (
      policyTargetStage != null &&
      Object.values(KNOCKOUT_ENTRY_ROUND).includes(policyTargetStage) &&
      bracketEntryRound &&
      !isDirectEntryTargetStageCompatible(policyTargetStage, bracketEntryRound)
    ) {
      issues.push(
        Object.freeze({
          code: COMPETITION_RULES_ERROR_CODE.INVALID_DIRECT_KNOCKOUT_ENTRY,
          message:
            "policy directKnockoutEntry.targetStage is incompatible with bracket-wide entry round",
          details: Object.freeze({
            targetStage: policyTargetStage,
            bracketWideEntryRound: bracketEntryRound,
            totalKnockoutSlots: qualificationPlan.totalKnockoutSlots,
          }),
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
  if (admission.bye.byePolicy === BYE_POLICY.NONE) {
    // allocationShape may be null (dormant) or a valid dormant metadata value
    if (
      admission.bye.allocationShape != null &&
      !Object.values(KNOCKOUT_BYE_ALLOCATION_SHAPE).includes(
        admission.bye.allocationShape
      )
    ) {
      issues.push(
        Object.freeze({
          code: COMPETITION_RULES_ERROR_CODE.INVALID_BYE_POLICY,
          message: "Invalid dormant BYE allocationShape metadata",
          details: Object.freeze({
            allocationShape: admission.bye.allocationShape,
          }),
        })
      );
    }
  } else if (
    !Object.values(KNOCKOUT_BYE_ALLOCATION_SHAPE).includes(
      admission.bye.allocationShape
    )
  ) {
    issues.push(
      Object.freeze({
        code: COMPETITION_RULES_ERROR_CODE.INVALID_BYE_POLICY,
        message: "Unsupported BYE allocationShape when byePolicy is active",
        details: Object.freeze({
          allocationShape: admission.bye.allocationShape,
          byePolicy: admission.bye.byePolicy,
        }),
      })
    );
  }

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

  const competitionPopulation = Array.isArray(
    context.competitionPopulationEntryIds
  )
    ? context.competitionPopulationEntryIds
        .map((id) => String(id).trim())
        .filter(Boolean)
    : null;

  // GROUP_STAGE_BYPASS population = explicit bypassIds ONLY (not auto-merged from direct).
  const groupStageParticipantPopulation = competitionPopulation
    ? competitionPopulation.filter((id) => !bypassIds.has(id))
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

  const bothPolicies = [...directIds].filter((id) => bypassIds.has(id));

  const plan = Object.freeze({
    totalKnockoutSlots: qualificationPlan.totalKnockoutSlots,
    directKnockoutEntrySlots: qualificationPlan.directKnockoutEntrySlots,
    groupDirectQualifierSlots: qualificationPlan.groupDirectQualifierSlots,
    wildcardSlots: qualificationPlan.wildcardSlots,
    remainingSlots: qualificationPlan.remainingSlots,
    requiresCrossGroupWildcardRanking:
      qualificationPlan.requiresCrossGroupWildcardRanking,
    groupStageBypass: Object.freeze({
      enabled: admission.groupStageBypass.enabled,
      entrants: Object.freeze(
        [...bypassIds].sort().map((entryId) => Object.freeze({ entryId }))
      ),
      note:
        "Explicit bypass only — DIRECT_KNOCKOUT_ENTRY does not imply GROUP_STAGE_BYPASS",
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
      entrants: Object.freeze(
        directEntrants.map((e) =>
          Object.freeze({
            ...e,
            effectiveTargetStage:
              e.targetStage || admission.directKnockoutEntry.targetStage || null,
          })
        )
      ),
      unresolvedSlotCount: Math.max(
        0,
        admission.directKnockoutEntry.count - directEntrants.length
      ),
      executionDeferred: true,
    }),
    bye: Object.freeze({
      byePolicy: admission.bye.byePolicy,
      allocationShape: admission.bye.allocationShape,
      byeActive: admission.bye.byePolicy !== BYE_POLICY.NONE,
      allocationShapeDormant: admission.bye.byePolicy === BYE_POLICY.NONE,
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
      groupStageBypassEntryIds: Object.freeze([...bypassIds].sort()),
      directKnockoutEntryIds: Object.freeze([...directIds].sort()),
      explicitDirectAndBypassOverlapEntryIds: Object.freeze(
        bothPolicies.sort()
      ),
    }),
    distinctions: Object.freeze({
      DIRECT_ENTRY_IMPLIES_BYPASS: false,
      EXPLICIT_DIRECT_AND_BYPASS_OVERLAP_ALLOWED: true,
      seedingDistinctFromDirectEntry: true,
      groupStageBypassDistinctFromDirectEntry: true,
      directEntryDistinctFromBye: true,
    }),
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
