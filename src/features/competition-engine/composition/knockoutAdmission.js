/**
 * Shared Competition Engine knockout admission composition boundary.
 *
 * Consumes canonical admission plan + standings + DIRECT/GROUP_DIRECT/WILDCARD
 * selections. Does NOT own ranking (CORE-18) or bracket/draw (CORE-08/09).
 *
 * Supported DIRECT execution: effectiveTargetStage == bracketWideEntryRound only.
 */

import {
  ADMISSION_SOURCE,
  assertFirstPlayableDirectEntryExecution,
  resolveAdmissionSourcePrecedence,
  resolveWildcardRankingPolicy,
} from "../../competition-core/competition-rules/index.js";
import { rankCrossGroupWildcardCandidates } from "../../competition-core/standings/index.js";
import { E2E02_ERROR_CODE, failE2E02 } from "./errors.js";
import { deepFreeze } from "./fingerprint.js";

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
 * Preserves entryId as participantId transport token (alias equality proven).
 *
 * @param {Array<{ entryId: string, seedNumber?: number|null, admissionSource?: string, groupId?: string|null, poolRank?: number|null }>} admitted
 */
export function adaptAdmittedToKnockoutQualifiers(admitted) {
  return (admitted || []).map((row, index) =>
    Object.freeze({
      participantId: row.entryId,
      entryId: row.entryId,
      seedNumber:
        Number.isFinite(Number(row.seedNumber)) && Number(row.seedNumber) >= 1
          ? Number(row.seedNumber)
          : index + 1,
      admissionSource: row.admissionSource || null,
      groupId: row.groupId != null ? row.groupId : null,
      poolRank: row.poolRank != null ? row.poolRank : null,
      effectiveTargetStage: row.effectiveTargetStage ?? null,
    })
  );
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
 *   knockoutRequired?: boolean,
 *   deterministicSeed?: string,
 *   directQualifiersPerGroup?: number,
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

  // BYPASS_ONLY without DIRECT route → fail closed when knockout required
  if (knockoutRequired) {
    for (const bypassId of bypassIds) {
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

  // Flatten standings for wildcard ranking (exclude DIRECT + later GROUP_DIRECT)
  const flatRows = [];
  for (const block of standingsBlocks) {
    for (const row of block.rows || []) {
      const entryId = String(row.entryId || "").trim();
      if (!entryId) continue;
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

  const wildcardPolicy = resolveWildcardRankingPolicy(
    input.competitionRulesProfile || {}
  );
  const wildcardSlots = Number(plan.wildcardSlots) || 0;

  let rankedWildcards = [];
  if (wildcardSlots > 0) {
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
    rankedWildcards = ranking.ranked;
  }

  const precedence = resolveAdmissionSourcePrecedence({
    directEntrants: directEntrants.map((e) => ({
      entryId: e.entryId,
      effectiveTargetStage: e.effectiveTargetStage || e.targetStage || null,
      seedNumber: e.seedNumber,
    })),
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

  // Build final admitted list — preserve source identity until integrity checks
  /** @type {object[]} */
  const admitted = [];
  const seen = new Set();

  const pushUnique = (row) => {
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

  for (const d of precedence.direct) pushUnique({ ...d });
  for (const g of precedence.groupDirect) pushUnique({ ...g });
  for (const w of precedence.wildcard) pushUnique({ ...w });

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

  // Deterministic seeding for KO adaptation: DIRECT first, then GROUP_DIRECT, then WILDCARD
  const seeded = admitted.map((row, index) =>
    Object.freeze({
      ...row,
      seedNumber:
        Number.isFinite(Number(row.seedNumber)) && Number(row.seedNumber) >= 1
          ? Number(row.seedNumber)
          : index + 1,
    })
  );

  const qualifiers = adaptAdmittedToKnockoutQualifiers(seeded);

  return deepFreeze({
    stage: "KNOCKOUT_ADMISSION",
    admitted: Object.freeze(seeded),
    qualifiers: Object.freeze(qualifiers),
    counts: Object.freeze({
      direct: actualDirect,
      groupDirect: actualGroupDirect,
      wildcard: actualWildcard,
      total: seeded.length,
    }),
    slotEquation: Object.freeze({
      totalKnockoutSlots,
      directKnockoutEntrySlots: expectedDirect,
      groupDirectQualifierSlots: expectedGroupDirect,
      wildcardSlots: expectedWildcard,
      proven: true,
    }),
    bracketWideEntryRound,
    directExecution: Object.freeze({
      firstPlayableOnly: true,
      laterStageDeferred: true,
      condition: "effectiveTargetStage == bracketWideEntryRound",
    }),
    distinctions: Object.freeze({
      DIRECT_NE_BYE: true,
      BYPASS_IMPLIES_DIRECT: false,
      DIRECT_ENTRY_IMPLIES_BYPASS: false,
    }),
    precedence,
  });
}
