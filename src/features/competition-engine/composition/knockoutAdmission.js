/**
 * Shared Competition Engine knockout admission composition boundary.
 *
 * Consumes canonical admission plan + standings + DIRECT/GROUP_DIRECT/WILDCARD
 * selections. Does NOT own ranking (CORE-18), seeding, or bracket/draw (CORE-08/09).
 *
 * Supported DIRECT execution (this PR):
 *   group stage enabled AND effectiveTargetStage == bracketWideEntryRound
 * No-group DIRECT and later-stage DIRECT remain deferred / fail-closed.
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
 * Source-neutral seed assignment: admissionSource does NOT define seeding.
 * Preserves explicit authoritative seedNumber only; otherwise assigns by
 * deterministic entryId order (existing identity-order contract).
 *
 * @param {object[]} admitted
 * @returns {object[]}
 */
export function assignSourceNeutralKnockoutSeeds(admitted) {
  const rows = (admitted || []).map((row) => ({ ...row }));
  const used = new Set();
  for (const row of rows) {
    if (
      row.authoritativeSeed === true &&
      Number.isFinite(Number(row.seedNumber)) &&
      Number(row.seedNumber) >= 1
    ) {
      used.add(Number(row.seedNumber));
    } else {
      row.seedNumber = null;
      row.authoritativeSeed = false;
    }
  }
  const needing = rows
    .filter((r) => r.seedNumber == null)
    .sort((a, b) => String(a.entryId).localeCompare(String(b.entryId)));
  let next = 1;
  for (const row of needing) {
    while (used.has(next)) next += 1;
    row.seedNumber = next;
    used.add(next);
    next += 1;
  }
  return rows;
}

/**
 * Adapt admitted field → existing composeKnockoutStage qualifier shape.
 * Seed numbers must already be source-neutral (not admission-order fallback).
 *
 * @param {Array<{ entryId: string, seedNumber?: number|null, admissionSource?: string, groupId?: string|null, poolRank?: number|null }>} admitted
 */
export function adaptAdmittedToKnockoutQualifiers(admitted) {
  return (admitted || []).map((row) => {
    if (
      !Number.isFinite(Number(row.seedNumber)) ||
      Number(row.seedNumber) < 1
    ) {
      failE2E02(
        E2E02_ERROR_CODE.INVALID_CONFIGURATION,
        "admitted entrant missing source-neutral seedNumber before knockout adaptation",
        { entryId: row.entryId }
      );
    }
    return Object.freeze({
      participantId: row.entryId,
      entryId: row.entryId,
      seedNumber: Number(row.seedNumber),
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
 *   knockoutRequired?: boolean,
 *   deterministicSeed?: string,
 *   directQualifiersPerGroup?: number,
 *   authoritativeSeedsByEntryId?: Record<string, number>,
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

  // Blocker 5 — no-group DIRECT not certified on this shared path (option B)
  const groupStageEnabled =
    plan.groupStageEnabled !== false && Number(plan.groupCount) > 0;
  if (!groupStageEnabled) {
    failE2E02(
      E2E02_ERROR_CODE.INVALID_CONFIGURATION,
      "no-group DIRECT / base knockout population execution is not certified on shared pool-knockout admission path — fail closed",
      {
        NO_GROUP_DIRECT_EXECUTION: "DEFERRED",
        groupStageEnabled: false,
        groupCount: plan.groupCount ?? 0,
      }
    );
  }

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

  const authSeeds =
    input.authoritativeSeedsByEntryId &&
    typeof input.authoritativeSeedsByEntryId === "object"
      ? input.authoritativeSeedsByEntryId
      : {};

  const precedence = resolveAdmissionSourcePrecedence({
    directEntrants: directEntrants.map((e) => {
      const entryId = e.entryId;
      const auth = authSeeds[entryId];
      const explicit =
        Number.isFinite(Number(auth)) && Number(auth) >= 1
          ? Number(auth)
          : Number.isFinite(Number(e.seedNumber)) &&
              Number(e.seedNumber) >= 1 &&
              e.authoritativeSeed === true
            ? Number(e.seedNumber)
            : null;
      return {
        entryId,
        effectiveTargetStage: e.effectiveTargetStage || e.targetStage || null,
        seedNumber: explicit,
        authoritativeSeed: explicit != null,
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
    pushUnique({
      ...d,
      authoritativeSeed: d.authoritativeSeed === true,
      seedNumber: d.authoritativeSeed === true ? d.seedNumber : null,
    });
  }
  for (const g of precedence.groupDirect) pushUnique({ ...g, authoritativeSeed: false });
  for (const w of precedence.wildcard) pushUnique({ ...w, authoritativeSeed: false });

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

  // SEEDING ≠ DIRECT — source-neutral identity-order seeds
  const seeded = assignSourceNeutralKnockoutSeeds(admitted).map((row) =>
    Object.freeze(row)
  );
  const qualifiers = adaptAdmittedToKnockoutQualifiers(seeded);

  return deepFreeze({
    stage: "KNOCKOUT_ADMISSION",
    admitted: Object.freeze(seeded),
    qualifiers: Object.freeze(qualifiers),
    competitionPopulationEntryIds: Object.freeze([...population].sort()),
    populationBoundaryProven: true,
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
      noGroupDeferred: true,
      condition:
        "groupStageEnabled && effectiveTargetStage == bracketWideEntryRound",
    }),
    seeding: Object.freeze({
      admissionSourceAffectsSeeding: false,
      contract: "source-neutral entryId order + explicit authoritative seeds only",
    }),
    distinctions: Object.freeze({
      DIRECT_NE_BYE: true,
      SEEDING_NE_DIRECT: true,
      BYPASS_IMPLIES_DIRECT: false,
      DIRECT_ENTRY_IMPLIES_BYPASS: false,
    }),
    precedence,
  });
}
