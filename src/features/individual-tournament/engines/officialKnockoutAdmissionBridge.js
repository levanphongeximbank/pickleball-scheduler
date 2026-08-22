/**
 * Official/Open → canonical knockout admission bridge (G2-F1).
 * TRANSLATE / COMPOSE / DELEGATE only — no second admission engine.
 */

import {
  createCompetitionRulesProfile,
  BYE_POLICY,
} from "../../competition-core/competition-rules/index.js";
import { resolveKnockoutAdmissionPolicy } from "../../competition-core/competition-rules/services/resolveKnockoutAdmissionPolicy.js";
import { deriveKnockoutAdmissionPlan } from "../../competition-core/competition-rules/services/deriveKnockoutAdmissionPlan.js";
import { canMutateKnockoutAdmissionPolicy } from "../../competition-core/competition-rules/services/canMutateKnockoutAdmissionPolicy.js";
import { assertFirstPlayableDirectEntryExecution } from "../../competition-core/competition-rules/services/assertDirectEntryExecutionSupport.js";
import { applyGroupStageBypassPopulation } from "../../competition-engine/composition/groupStageBypassPopulation.js";
import { resolveContentGroup2Settings } from "./officialContentCompetitionRules.js";

/**
 * Official classic path capability truth for canonical admission axes (G2-F1).
 */
export const OFFICIAL_KNOCKOUT_ADMISSION_CAPABILITY = Object.freeze({
  GROUP_STAGE_BYPASS: Object.freeze({
    policy: "SUPPORTED",
    officialClassicRuntime: "SUPPORTED",
    sharedExecution: "SUPPORTED",
    note: "applyGroupStageBypassPopulation / deriveKnockoutAdmissionPlan populations",
  }),
  DIRECT_KNOCKOUT_ENTRY: Object.freeze({
    policy: "SUPPORTED",
    officialClassicRuntime: "PARTIAL_FAIL_CLOSED",
    sharedExecution: "PARTIAL",
    firstPlayable: "SHARED_CE_ONLY",
    laterStage: "DEFERRED",
    noGroup: "DEFERRED",
    note: "Official classic CROSS_GROUP path does not compose DIRECT — fail closed when enabled",
  }),
  KNOCKOUT_BYE: Object.freeze({
    policy: "SUPPORTED",
    officialClassicRuntime: "DEFERRED_FAIL_CLOSED",
    sharedExecution: "SUPPORTED",
    executionOwner: "CORE-08 / CORE-09 / CE",
    note: "No local bye engine; Official classic CROSS_GROUP does not compose shared BYE yet",
  }),
  WILDCARD_RANKING: Object.freeze({
    sharedCore18Available: true,
    officialGroup4Activated: false,
  }),
});

function trim(value) {
  return value != null ? String(value).trim() : "";
}

export function buildContentRulesProfileInput(rules) {
  const r = rules || {};
  return {
    groupStage: r.groupStage || {},
    qualification: {
      totalKnockoutSlots:
        r.qualification?.totalKnockoutSlots ?? r.qualification?.totalQualifiers,
      totalQualifiers: r.qualification?.totalQualifiers,
      directQualifiersPerGroup: r.qualification?.directQualifiersPerGroup,
      directKnockoutEntryCount:
        r.qualification?.directKnockoutEntryCount ??
        r.knockoutAdmission?.directKnockoutEntry?.count ??
        0,
    },
    knockoutAdmission: r.knockoutAdmission || {},
    knockout: r.knockout || {},
    inGroupTieBreak: r.inGroupTieBreak || undefined,
    crossGroupRanking: r.crossGroupRanking || undefined,
  };
}

/**
 * Official Content → canonical knockout admission policy/plan.
 */
export function resolveOfficialContentKnockoutAdmission(tournament, options = {}) {
  const eventId = trim(options.eventId);
  if (!eventId) {
    return {
      ok: false,
      code: "EVENT_REQUIRED",
      error: "Chọn nội dung tường minh (eventId) trước khi xét admission knockout.",
    };
  }

  const group2 = resolveContentGroup2Settings(tournament, {
    eventId,
    allowSoleEventInference: false,
  });
  if (!group2.ok) return group2;

  const profile = createCompetitionRulesProfile(
    buildContentRulesProfileInput(group2)
  );
  const policy = resolveKnockoutAdmissionPolicy(profile);
  const planResult = deriveKnockoutAdmissionPlan(profile, {
    competitionPopulationEntryIds: options.competitionPopulationEntryIds,
    groupParticipantEntryIds: options.groupParticipantEntryIds,
  });

  const admission = profile.knockoutAdmission;
  const bypassEnabled = admission.groupStageBypass?.enabled === true;
  const directEnabled = admission.directKnockoutEntry?.enabled === true;
  const byeActive = admission.bye?.byePolicy !== BYE_POLICY.NONE;
  const advancedConfigured = bypassEnabled || directEnabled || byeActive;

  if (!planResult.ok) {
    return {
      ok: false,
      code: planResult.code || "INVALID_KNOCKOUT_ADMISSION",
      error: planResult.message || "Knockout admission plan không hợp lệ.",
      eventId,
      source: group2.source,
      profile,
      policy,
      planResult,
      knockoutAdmission: admission,
      advancedConfigured,
      capability: OFFICIAL_KNOCKOUT_ADMISSION_CAPABILITY,
      authority: false,
    };
  }

  if (directEnabled) {
    const firstPlayable = assertFirstPlayableDirectEntryExecution({
      entrants: planResult.knockoutAdmissionPlan.directKnockoutEntry.entrants,
      bracketWideEntryRound:
        planResult.knockoutAdmissionPlan.directKnockoutEntry.bracketWideEntryRound,
      policyTargetStage: admission.directKnockoutEntry.targetStage,
    });
    return {
      ok: false,
      code: "KNOCKOUT_ADMISSION_DIRECT_UNSUPPORTED_ON_OFFICIAL_CLASSIC",
      error:
        "DIRECT_KNOCKOUT_ENTRY trên Official classic CROSS_GROUP path chưa được compose — partial shared CE only. Không tạo engine DIRECT cục bộ.",
      eventId,
      source: group2.source,
      profile,
      policy,
      plan: planResult.knockoutAdmissionPlan,
      qualificationPlan: planResult.qualificationPlan,
      knockoutAdmission: admission,
      firstPlayable,
      advancedConfigured: true,
      capability: OFFICIAL_KNOCKOUT_ADMISSION_CAPABILITY,
      authority: false,
      officialClassicRuntime: "PARTIAL_FAIL_CLOSED",
    };
  }

  if (byeActive) {
    return {
      ok: false,
      code: "KNOCKOUT_BYE_REQUIRES_SHARED_CE_PATH",
      error:
        "KNOCKOUT_BYE policy active — Official classic CROSS_GROUP chưa bind CORE-08/09 bye path. Không invent bye cục bộ.",
      eventId,
      source: group2.source,
      profile,
      policy,
      plan: planResult.knockoutAdmissionPlan,
      qualificationPlan: planResult.qualificationPlan,
      knockoutAdmission: admission,
      advancedConfigured: true,
      capability: OFFICIAL_KNOCKOUT_ADMISSION_CAPABILITY,
      authority: false,
      officialClassicRuntime: "DEFERRED_FAIL_CLOSED",
    };
  }

  return {
    ok: true,
    eventId,
    source: group2.source,
    profile,
    policy,
    plan: planResult.knockoutAdmissionPlan,
    qualificationPlan: planResult.qualificationPlan,
    knockoutAdmission: admission,
    advancedConfigured,
    bypassEnabled,
    directEnabled: false,
    byeActive: false,
    capability: OFFICIAL_KNOCKOUT_ADMISSION_CAPABILITY,
    authority: false,
    officialClassicRuntime: bypassEnabled
      ? "BYPASS_GROUP_DRAW_SUPPORTED"
      : "ADMISSION_INACTIVE_CLASSIC_OK",
  };
}

/**
 * Shared GROUP_STAGE_BYPASS population subtraction for Official group draw.
 */
export function applyOfficialGroupStageBypassToDrawUnits(tournament, options = {}) {
  const eventId = trim(options.eventId);
  const units = Array.isArray(options.units) ? options.units : [];
  if (!eventId) {
    return {
      ok: false,
      code: "EVENT_REQUIRED",
      error: "Chọn nội dung tường minh (eventId) trước khi chia bảng.",
    };
  }

  const populationIds = units
    .map((u) => String(u?.id || "").trim())
    .filter(Boolean);

  for (const unit of units) {
    const id = String(unit?.id || "").trim();
    if (!id) {
      return {
        ok: false,
        code: "MISSING_ENTRANT_IDENTITY",
        error:
          "Canonical entryId (CompetitionEntry.id) required for group-draw admission population.",
      };
    }
  }

  const admission = resolveOfficialContentKnockoutAdmission(tournament, {
    eventId,
    competitionPopulationEntryIds: populationIds,
    groupParticipantEntryIds: populationIds,
  });

  if (!admission.ok) {
    return {
      ok: false,
      code: admission.code,
      error: admission.error,
      admission,
    };
  }

  if (!admission.bypassEnabled) {
    return {
      ok: true,
      units,
      bypassApplied: false,
      admission,
    };
  }

  let bypassPopulation;
  try {
    bypassPopulation = applyGroupStageBypassPopulation({
      participants: populationIds.map((entryId) => ({ entryId })),
      knockoutAdmissionPlan: admission.plan,
      requireCanonicalEntryId: true,
    });
  } catch (err) {
    return {
      ok: false,
      code: err?.code || "GROUP_STAGE_BYPASS_FAILED",
      error: err?.message || "Không áp dụng GROUP_STAGE_BYPASS.",
      admission,
    };
  }

  const keep = new Set(
    (bypassPopulation.groupStageParticipantEntryIds || []).map(String)
  );
  const filtered = units.filter((u) => keep.has(String(u.id)));
  const bypassIds = admission.plan?.populations?.groupStageBypassEntryIds || [];
  for (const id of bypassIds) {
    if (!populationIds.includes(String(id))) {
      return {
        ok: false,
        code: "MISSING_ENTRANT_IDENTITY",
        error: `GROUP_STAGE_BYPASS entryId không thuộc competition population: ${id}`,
        admission,
      };
    }
  }

  return {
    ok: true,
    units: filtered,
    bypassApplied: true,
    removedCount: units.length - filtered.length,
    bypassPopulation,
    admission,
  };
}

export function assertOfficialKnockoutAdmissionMutationAllowed(input = {}) {
  return canMutateKnockoutAdmissionPolicy(input);
}
