/**
 * Shared Competition Engine knockout admission composition boundary.
 *
 * Consumes canonical admission plan + competition population. Group-stage
 * execution composes DIRECT/GROUP_DIRECT/WILDCARD; no-group execution composes
 * DIRECT + the exact eligible residual population. Does NOT own ranking
 * (CORE-18), seeding (CORE-07), or bracket/draw (CORE-08/09).
 *
 * Seeding (canonical admission path):
 *   - consume proven CORE-07 projection via projectAuthoritativeSeedingResult /
 *     mapAuthoritativeProjectionToDrawSeedRanking (SEEDED draw)
 *   - no projection → OPEN deterministic CORE-08 draw (no CE seed fabrication)
 *   - partial / invalid projection coverage → fail closed (no silent OPEN fallback)
 *   - naked authoritativeSeedsByEntryId is rejected on this path
 */

import {
  ADMISSION_SOURCE,
  assertFirstPlayableDirectEntryExecution,
  resolveAdmissionSourcePrecedence,
  resolveWildcardRankingPolicy,
} from "../../competition-core/competition-rules/index.js";
import { rankCrossGroupWildcardCandidates } from "../../competition-core/standings/index.js";
import {
  resolveAuthoritativeSeedMapFromCore07,
  resolveEffectiveCompetitionScope,
  selectCore07SeedingProjectionForStage,
} from "./core07SeedingProjection.js";
import { E2E02_ERROR_CODE, failE2E02 } from "./errors.js";
import { deepFreeze } from "./fingerprint.js";

export const KNOCKOUT_DRAW_PLACEMENT_MODE = Object.freeze({
  SEEDED: "SEEDED",
  OPEN: "OPEN",
});

const EXCLUDED_STATUSES = new Set([
  "WITHDRAWN",
  "DISQUALIFIED",
  "DQ",
  "VOID",
  "INVALID",
  "UNACCEPTED",
]);

/**
 * Adapt admitted field → existing composeKnockoutStage qualifier shape.
 * Does NOT fabricate seedNumber. Authoritative seeds only when present.
 *
 * @param {Array<object>} admitted
 * @param {"SEEDED"|"OPEN"} placementMode
 */
export function adaptAdmittedToKnockoutQualifiers(admitted, placementMode) {
  return (admitted || []).map((row) => {
    const hasAuth =
      row.authoritativeSeed === true &&
      Number.isFinite(Number(row.seedNumber)) &&
      Number(row.seedNumber) >= 1;
    if (placementMode === KNOCKOUT_DRAW_PLACEMENT_MODE.SEEDED && !hasAuth) {
      failE2E02(
        E2E02_ERROR_CODE.INVALID_CONFIGURATION,
        "SEEDED knockout placement requires authoritative seedNumber for every admitted entrant",
        { entryId: row.entryId }
      );
    }
    return Object.freeze({
      participantId: row.entryId,
      entryId: row.entryId,
      seedNumber: hasAuth ? Number(row.seedNumber) : null,
      authoritativeSeed: hasAuth,
      admissionSource: row.admissionSource || null,
      groupId: row.groupId != null ? row.groupId : null,
      poolRank: row.poolRank != null ? row.poolRank : null,
      effectiveTargetStage: row.effectiveTargetStage ?? null,
    });
  });
}

/**
 * @param {string[]|null|undefined} ids
 * @returns {Set<string>}
 */
function buildPopulationSet(ids) {
  const list = Array.isArray(ids) ? ids : [];
  const set = new Set();
  for (const raw of list) {
    const id = String(raw || "").trim();
    if (!id) {
      failE2E02(
        E2E02_ERROR_CODE.INVALID_CONFIGURATION,
        "empty/invalid identity in competition population",
        {}
      );
    }
    if (set.has(id)) {
      failE2E02(
        E2E02_ERROR_CODE.DUPLICATE_PARTICIPANT,
        "duplicate competition population entryId",
        { entryId: id }
      );
    }
    set.add(id);
  }
  return set;
}

/**
 * @param {{
 *   knockoutAdmissionPlan: object,
 *   competitionRulesProfile?: object,
 *   standingsByGroup: Array<{
 *     groupId: string,
 *     rows: Array<object>
 *   }>,
 *   competitionPopulationEntryIds?: string[],
 *   excludedEntryIds?: string[],
 *   entryStatusesByEntryId?: Record<string, string>,
 *   knockoutRequired?: boolean,
 *   deterministicSeed?: string,
 *   directQualifiersPerGroup?: number,
 *   competitionId?: string,
 *   competitionVersionId?: string|null,
 *   divisionId?: string|null,
 *   categoryId?: string|null,
 *   competitionUnitKind?: string|null,
 *   knockoutSeedingProjection?: object|null,
 *   authoritativeSeedingProjection?: object|null,
 *   groupStageSeedingProjection?: object|null,
 * }} input
 */
export function composeKnockoutAdmission(input) {
  const plan = input.knockoutAdmissionPlan;
  if (!plan || typeof plan !== "object") {
    failE2E02(
      E2E02_ERROR_CODE.INVALID_CONFIGURATION,
      "knockoutAdmissionPlan required for admission composition",
      {}
    );
  }

  const groupStageEnabled =
    plan.groupStageEnabled !== false && Number(plan.groupCount) > 0;

  const populationIds =
    input.competitionPopulationEntryIds ||
    plan.populations?.competitionPopulationEntryIds ||
    null;
  if (!Array.isArray(populationIds) || populationIds.length === 0) {
    failE2E02(
      E2E02_ERROR_CODE.INVALID_CONFIGURATION,
      "canonical competitionPopulationEntryIds required for admission execution",
      {}
    );
  }
  const population = buildPopulationSet(populationIds);

  const unresolvedSlotCount = Number(
    plan.directKnockoutEntry?.unresolvedSlotCount ?? 0
  );
  if (unresolvedSlotCount > 0) {
    failE2E02(
      E2E02_ERROR_CODE.INVALID_CONFIGURATION,
      "unresolved DIRECT slots cannot execute — fail closed",
      {
        unresolvedSlotCount,
        UNRESOLVED_DIRECT_SLOT_EXECUTION: "DENY",
      }
    );
  }

  const bracketWideEntryRound =
    plan.directKnockoutEntry?.bracketWideEntryRound || null;
  const directEntrants = plan.directKnockoutEntry?.entrants || [];

  for (const e of directEntrants) {
    const entryId = String(e.entryId || "").trim();
    if (!entryId || !population.has(entryId)) {
      failE2E02(
        E2E02_ERROR_CODE.INVALID_CONFIGURATION,
        "DIRECT entrant outside canonical competition population — fail closed",
        { entryId: entryId || null }
      );
    }
  }

  if (directEntrants.length > 0 || Number(plan.directKnockoutEntrySlots) > 0) {
    const stageCheck = assertFirstPlayableDirectEntryExecution({
      entrants: directEntrants,
      bracketWideEntryRound,
      policyTargetStage: plan.directKnockoutEntry?.targetStage || null,
    });
    if (!stageCheck.ok) {
      failE2E02(
        E2E02_ERROR_CODE.INVALID_CONFIGURATION,
        stageCheck.message || "later-stage DIRECT execution deferred",
        stageCheck.details || {}
      );
    }
  }

  const bypassIds = new Set(
    (plan.populations?.groupStageBypassEntryIds || []).map(String)
  );
  const directIds = new Set(
    (plan.populations?.directKnockoutEntryIds || []).map(String)
  );
  const knockoutRequired = input.knockoutRequired !== false;

  if (knockoutRequired) {
    for (const bypassId of bypassIds) {
      if (!population.has(bypassId)) {
        failE2E02(
          E2E02_ERROR_CODE.INVALID_CONFIGURATION,
          "bypass entryId outside canonical competition population",
          { entryId: bypassId }
        );
      }
      if (!directIds.has(bypassId)) {
        failE2E02(
          E2E02_ERROR_CODE.INVALID_CONFIGURATION,
          "bypass-only entrant lacks explicit DIRECT knockout admission route — fail closed",
          {
            entryId: bypassId,
            BYPASS_IMPLIES_DIRECT: false,
            BYPASS_ONLY_KNOCKOUT_EXECUTION_WITHOUT_ROUTE: "FAIL_CLOSED",
          }
        );
      }
    }
  }

  const standingsBlocks = Array.isArray(input.standingsByGroup)
    ? input.standingsByGroup
    : [];

  const directQualifiersPerGroup =
    input.directQualifiersPerGroup != null
      ? Math.max(0, Math.floor(Number(input.directQualifiersPerGroup)))
      : Math.max(0, Math.floor(Number(plan.directQualifiersPerGroup) || 0));

  const groupSlotsPerGroup = directQualifiersPerGroup;

  const excluded = new Set(
    (input.excludedEntryIds || []).map((id) => String(id).trim()).filter(Boolean)
  );
  const entryStatusesByEntryId =
    input.entryStatusesByEntryId &&
    typeof input.entryStatusesByEntryId === "object"
      ? input.entryStatusesByEntryId
      : {};
  if (!groupStageEnabled) {
    for (const [rawEntryId, rawStatus] of Object.entries(entryStatusesByEntryId)) {
      const entryId = String(rawEntryId || "").trim();
      if (!entryId || !population.has(entryId)) {
        failE2E02(
          E2E02_ERROR_CODE.INVALID_CONFIGURATION,
          "entry status supplied outside canonical competition population",
          { entryId: entryId || null }
        );
      }
      if (EXCLUDED_STATUSES.has(String(rawStatus || "").toUpperCase())) {
        excluded.add(entryId);
      }
    }
  }

  const flatRows = [];
  for (const block of standingsBlocks) {
    for (const row of block.rows || []) {
      const entryId = String(row.entryId || "").trim();
      if (!entryId) {
        failE2E02(
          E2E02_ERROR_CODE.INVALID_CONFIGURATION,
          "standings row missing canonical entryId",
          { groupId: block.groupId }
        );
      }
      if (!population.has(entryId)) {
        failE2E02(
          E2E02_ERROR_CODE.INVALID_CONFIGURATION,
          "standings entry outside canonical competition population — fail closed",
          { entryId, groupId: block.groupId }
        );
      }
      if (excluded.has(entryId)) continue;
      const status = String(row.status || "").toUpperCase();
      if (EXCLUDED_STATUSES.has(status)) continue;
      flatRows.push({
        ...row,
        entryId,
        groupId: block.groupId,
      });
    }
  }

  const wildcardSlots = Number(plan.wildcardSlots) || 0;

  let rankedWildcards = [];
  if (wildcardSlots > 0) {
    const wildcardPolicy = resolveWildcardRankingPolicy(
      input.competitionRulesProfile || {}
    );
    const ranking = rankCrossGroupWildcardCandidates({
      rows: flatRows.filter((r) => !directIds.has(r.entryId)),
      criteria: wildcardPolicy.criteria,
      normalizeByMatchesPlayed: wildcardPolicy.normalizeByMatchesPlayed === true,
      drawLotSeed: String(
        input.deterministicSeed ||
          `${plan.totalKnockoutSlots}:cross-group-wildcard`
      ),
      excludeEntryIds: [...excluded, ...directIds],
    });
    if (!ranking.ok) {
      failE2E02(
        E2E02_ERROR_CODE.STANDINGS_FAILED,
        ranking.message || "cross-group wildcard ranking failed",
        { issues: ranking.issues || [] }
      );
    }
    for (const r of ranking.ranked) {
      if (!population.has(r.entryId)) {
        failE2E02(
          E2E02_ERROR_CODE.INVALID_CONFIGURATION,
          "wildcard candidate outside canonical competition population — fail closed",
          { entryId: r.entryId }
        );
      }
    }
    rankedWildcards = ranking.ranked;
  }

  if (
    input.authoritativeSeedsByEntryId != null &&
    typeof input.authoritativeSeedsByEntryId === "object"
  ) {
    failE2E02(
      E2E02_ERROR_CODE.INVALID_CONFIGURATION,
      "naked authoritativeSeedsByEntryId is not accepted on canonical admission path — supply CORE-07 authoritativeSeedingProjection / knockoutSeedingProjection",
      {
        RAW_AUTHORITATIVE_SEED_MAP_ACCEPTED_ON_CANONICAL_PATH: false,
      }
    );
  }

  const competitionId = String(
    input.competitionId || plan.competitionId || ""
  ).trim();
  const effectiveScope = resolveEffectiveCompetitionScope({
    competitionId,
    competitionVersionId: input.competitionVersionId,
    divisionId: input.divisionId ?? plan.divisionId,
    categoryId: input.categoryId ?? plan.categoryId,
  });

  const knockoutStageId = "stage-knockout";
  const knockoutProjectionInput = selectCore07SeedingProjectionForStage(
    input,
    "KNOCKOUT",
    knockoutStageId
  );
  const usedCore07Projection = Boolean(knockoutProjectionInput);

  const precedence = resolveAdmissionSourcePrecedence({
    directEntrants: directEntrants.map((e) => {
      const entryId = e.entryId;
      return {
        entryId,
        effectiveTargetStage: e.effectiveTargetStage || e.targetStage || null,
        seedNumber: null,
        authoritativeSeed: false,
      };
    }),
    directKnockoutEntrySlots: Number(plan.directKnockoutEntrySlots) || 0,
    groupStandingsByGroup: standingsBlocks.map((b) => ({
      groupId: b.groupId,
      rows: (b.rows || []).map((r) => ({
        entryId: String(r.entryId),
        rank: Number(r.rank),
        status: r.status,
      })),
    })),
    groupDirectSlotsPerGroup: groupSlotsPerGroup,
    groupDirectQualifierSlots: Number(plan.groupDirectQualifierSlots) || 0,
    wildcardCandidates: rankedWildcards.map((r) => ({
      entryId: r.entryId,
      rank: r.crossGroupRank,
      crossGroupRank: r.crossGroupRank,
      groupId: r.groupId,
      status: r.status,
    })),
    wildcardSlots,
    excludedEntryIds: [...excluded],
  });

  if (!precedence.ok) {
    failE2E02(
      E2E02_ERROR_CODE.INVALID_QUALIFIER_COUNT,
      precedence.message || "admission source precedence failed",
      precedence.details || {}
    );
  }

  /** @type {object[]} */
  const admitted = [];
  const seen = new Set();

  const pushUnique = (row) => {
    if (!population.has(row.entryId)) {
      failE2E02(
        E2E02_ERROR_CODE.INVALID_CONFIGURATION,
        "admitted entryId outside canonical competition population — fail closed",
        { entryId: row.entryId, admissionSource: row.admissionSource }
      );
    }
    if (seen.has(row.entryId)) {
      failE2E02(
        E2E02_ERROR_CODE.DUPLICATE_QUALIFIER,
        "duplicate entryId across final admission sources",
        { entryId: row.entryId, admissionSource: row.admissionSource }
      );
    }
    seen.add(row.entryId);
    admitted.push(row);
  };

  for (const d of precedence.direct) {
    if (!groupStageEnabled && excluded.has(d.entryId)) {
      failE2E02(
        E2E02_ERROR_CODE.INVALID_QUALIFIER_COUNT,
        "no-group DIRECT entrant is excluded or ineligible — fail closed",
        { entryId: d.entryId }
      );
    }
    pushUnique({
      ...d,
      authoritativeSeed: false,
      seedNumber: null,
    });
  }
  for (const g of precedence.groupDirect) {
    pushUnique({
      ...g,
      authoritativeSeed: false,
      seedNumber: null,
    });
  }
  for (const w of precedence.wildcard) {
    pushUnique({
      ...w,
      authoritativeSeed: false,
      seedNumber: null,
    });
  }

  let actualBase = 0;
  const expectedBase = groupStageEnabled ? 0 : Number(plan.remainingSlots) || 0;
  if (!groupStageEnabled) {
    const expectedGroupDirect = Number(plan.groupDirectQualifierSlots) || 0;
    if (expectedGroupDirect !== 0 || wildcardSlots !== 0) {
      failE2E02(
        E2E02_ERROR_CODE.INVALID_CONFIGURATION,
        "no-group admission requires groupDirectQualifierSlots=0 and wildcardSlots=0",
        { groupDirectQualifierSlots: expectedGroupDirect, wildcardSlots }
      );
    }

    const baseEntryIds = [...population]
      .filter((entryId) => !directIds.has(entryId) && !excluded.has(entryId))
      .sort();
    if (baseEntryIds.length !== expectedBase) {
      failE2E02(
        E2E02_ERROR_CODE.INVALID_QUALIFIER_COUNT,
        "eligible no-group base population count must equal remainingSlots",
        {
          eligibleBasePopulationCount: baseEntryIds.length,
          remainingSlots: expectedBase,
          UNDERFILL_BEHAVIOR: "FAIL_CLOSED",
          OVERPOPULATION_BEHAVIOR: "FAIL_CLOSED",
        }
      );
    }
    for (const entryId of baseEntryIds) {
      pushUnique({
        entryId,
        admissionSource: null,
        compositionProvenance: "NO_GROUP_BASE_POPULATION",
        effectiveTargetStage: null,
        authoritativeSeed: false,
        seedNumber: null,
      });
    }
    actualBase = baseEntryIds.length;
  }

  if (usedCore07Projection) {
    const authSeeds = resolveAuthoritativeSeedMapFromCore07(
      knockoutProjectionInput,
      admitted.map((a) => a.entryId),
      {
        competitionId: effectiveScope.competitionId,
        competitionVersionId: effectiveScope.effectiveCompetitionVersionId,
        divisionId: effectiveScope.effectiveDivisionId,
        categoryId: effectiveScope.effectiveCategoryId,
        stageId: knockoutStageId,
        competitionUnitKind: input.competitionUnitKind,
        role: "KNOCKOUT",
      }
    );
    for (const row of admitted) {
      const seedNumber = authSeeds[row.entryId];
      row.authoritativeSeed = true;
      row.seedNumber = seedNumber;
    }
  }

  const actualDirect = admitted.filter(
    (a) => a.admissionSource === ADMISSION_SOURCE.DIRECT
  ).length;
  const actualGroupDirect = admitted.filter(
    (a) => a.admissionSource === ADMISSION_SOURCE.GROUP_DIRECT
  ).length;
  const actualWildcard = admitted.filter(
    (a) => a.admissionSource === ADMISSION_SOURCE.WILDCARD
  ).length;

  const expectedDirect = Number(plan.directKnockoutEntrySlots) || 0;
  const expectedGroupDirect = Number(plan.groupDirectQualifierSlots) || 0;
  const expectedWildcard = Number(plan.wildcardSlots) || 0;
  const totalKnockoutSlots = Number(plan.totalKnockoutSlots) || 0;

  if (actualDirect !== expectedDirect) {
    failE2E02(
      E2E02_ERROR_CODE.INVALID_QUALIFIER_COUNT,
      "ACTUAL_DIRECT_COUNT must equal directKnockoutEntrySlots",
      { actualDirect, expectedDirect }
    );
  }
  if (actualGroupDirect !== expectedGroupDirect) {
    failE2E02(
      E2E02_ERROR_CODE.INVALID_QUALIFIER_COUNT,
      "ACTUAL_GROUP_DIRECT_COUNT must equal groupDirectQualifierSlots",
      { actualGroupDirect, expectedGroupDirect }
    );
  }
  if (actualWildcard !== expectedWildcard) {
    failE2E02(
      E2E02_ERROR_CODE.INVALID_QUALIFIER_COUNT,
      "ACTUAL_WILDCARD_COUNT must equal wildcardSlots",
      { actualWildcard, expectedWildcard }
    );
  }
  if (!groupStageEnabled && actualBase !== expectedBase) {
    failE2E02(
      E2E02_ERROR_CODE.INVALID_QUALIFIER_COUNT,
      "ACTUAL_BASE_COUNT must equal remainingSlots",
      { actualBase, expectedBase }
    );
  }
  if (admitted.length !== totalKnockoutSlots) {
    failE2E02(
      E2E02_ERROR_CODE.INVALID_QUALIFIER_COUNT,
      "FINAL_ADMITTED_UNIQUE_ENTRY_COUNT must equal totalKnockoutSlots",
      {
        finalAdmitted: admitted.length,
        totalKnockoutSlots,
      }
    );
  }

  // CE does NOT assign seeds. Full authoritative set → SEEDED; none → OPEN; partial → fail closed.
  const authCount = admitted.filter((a) => a.authoritativeSeed === true).length;
  if (authCount > 0 && authCount < admitted.length) {
    failE2E02(
      E2E02_ERROR_CODE.INVALID_CONFIGURATION,
      "partial authoritative seed set is not certified — fail closed (CE does not invent missing seeds)",
      {
        authoritativeCount: authCount,
        admittedCount: admitted.length,
        PARTIAL_SEED_CONFIG_BEHAVIOR: "FAIL_CLOSED",
      }
    );
  }
  const drawPlacementMode =
    authCount === admitted.length && admitted.length > 0
      ? KNOCKOUT_DRAW_PLACEMENT_MODE.SEEDED
      : KNOCKOUT_DRAW_PLACEMENT_MODE.OPEN;

  const frozenAdmitted = admitted.map((row) => Object.freeze({ ...row }));
  const qualifiers = adaptAdmittedToKnockoutQualifiers(
    frozenAdmitted,
    drawPlacementMode
  );

  return deepFreeze({
    stage: "KNOCKOUT_ADMISSION",
    admitted: Object.freeze(frozenAdmitted),
    qualifiers: Object.freeze(qualifiers),
    drawPlacementMode,
    competitionPopulationEntryIds: Object.freeze([...population].sort()),
    populationBoundaryProven: true,
    counts: Object.freeze({
      direct: actualDirect,
      groupDirect: actualGroupDirect,
      wildcard: actualWildcard,
      base: actualBase,
      total: frozenAdmitted.length,
    }),
    slotEquation: Object.freeze({
      totalKnockoutSlots,
      directKnockoutEntrySlots: expectedDirect,
      groupDirectQualifierSlots: expectedGroupDirect,
      wildcardSlots: expectedWildcard,
      remainingSlots: groupStageEnabled ? expectedWildcard : expectedBase,
      proven: true,
    }),
    bracketWideEntryRound,
    directExecution: Object.freeze({
      firstPlayableOnly: true,
      laterStageDeferred: true,
      noGroupSupported: !groupStageEnabled,
      condition:
        "effectiveTargetStage == bracketWideEntryRound",
    }),
    seeding: Object.freeze({
      admissionSourceAffectsSeeding: false,
      ceAssignsSeeds: false,
      authority: usedCore07Projection
        ? "CORE-07 authoritative projection → CORE-08 SEEDED draw"
        : "CORE-08 OPEN draw (no authoritative CORE-07 projection)",
      core07ProjectionConsumed: usedCore07Projection,
      drawPlacementMode,
    }),
    distinctions: Object.freeze({
      DIRECT_NE_BYE: true,
      SEEDING_NE_DIRECT: true,
      BYPASS_IMPLIES_DIRECT: false,
      DIRECT_ENTRY_IMPLIES_BYPASS: false,
    }),
    precedence,
    noGroupComposition: groupStageEnabled
      ? null
      : Object.freeze({
          exactBasePopulationRequired: true,
          underfillBehavior: "FAIL_CLOSED",
          overpopulationBehavior: "FAIL_CLOSED",
          rankingOrSelectionAuthorityCreated: false,
        }),
  });
}
