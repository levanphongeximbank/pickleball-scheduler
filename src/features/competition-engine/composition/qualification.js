/**
 * Qualification & Advancement — minimal composition/policy boundary.
 * Consumes CORE-18 standings; does not own ranking algorithms.
 */

import {
  calculateCanonicalStandings,
  createStandingsRequest,
  createStandingsEntry,
  createStandingsMatchRecord,
  DEFAULT_TIEBREAK_ORDER,
  TIEBREAK_TYPE,
} from "../../competition-core/standings/index.js";
import {
  E2E02_QUALIFICATION_POLICY,
  E2E02_UNRESOLVED_TIE_BEHAVIOR,
} from "./constants.js";
import { E2E02_ERROR_CODE, failE2E02 } from "./errors.js";
import { deepFreeze, isNonEmptyString } from "./fingerprint.js";

const EXCLUDED_STATUSES = new Set([
  "WITHDRAWN",
  "DISQUALIFIED",
  "DQ",
  "VOID",
  "INVALID",
  "UNACCEPTED",
]);

/**
 * @param {{
 *   format: object,
 *   poolStage: object,
 *   poolStandingsRows?: Array<{
 *     groupId: string,
 *     rows: Array<{
 *       entryId: string,
 *       rank: number,
 *       points?: number,
 *       status?: string,
 *       tieBreakUnresolved?: boolean,
 *     }>
 *   }>,
 *   poolMatchResults?: Array<{
 *     groupId: string,
 *     matchId: string,
 *     entryAId: string,
 *     entryBId: string,
 *     winnerEntryId?: string,
 *     resultType?: string,
 *     acceptanceStatus?: string,
 *     scoreA?: number,
 *     scoreB?: number,
 *   }>,
 *   competitionId: string,
 *   poolStageComplete?: boolean,
 * }} input
 */
export function composeQualificationAdvancement(input) {
  if (input.poolStageComplete === false) {
    failE2E02(
      E2E02_ERROR_CODE.POOL_STAGE_INCOMPLETE,
      "cannot advance to knockout before pool stage is complete",
      {}
    );
  }
  if (!input.poolStage || !input.poolStage.grouping) {
    failE2E02(
      E2E02_ERROR_CODE.POOL_STAGE_INCOMPLETE,
      "pool stage output required before qualification",
      {}
    );
  }

  const format = input.format;
  const policy = format.qualification.policy;
  if (
    format.qualification.unresolvedTieBehavior !==
    E2E02_UNRESOLVED_TIE_BEHAVIOR.FAIL_CLOSED
  ) {
    failE2E02(
      E2E02_ERROR_CODE.UNRESOLVED_TIE,
      "unresolved tie behavior must be FAIL_CLOSED",
      {}
    );
  }

  /** @type {Map<string, Array<{ entryId: string, rank: number, points: number, status?: string, tieBreakUnresolved?: boolean }>>} */
  const standingsByGroup = new Map();

  if (Array.isArray(input.poolStandingsRows) && input.poolStandingsRows.length) {
    for (const block of input.poolStandingsRows) {
      standingsByGroup.set(
        String(block.groupId),
        (block.rows || []).map((r) => ({
          entryId: String(r.entryId),
          rank: Number(r.rank),
          points: Number(r.points ?? 0),
          status: r.status,
          tieBreakUnresolved: r.tieBreakUnresolved === true,
        }))
      );
    }
  } else if (Array.isArray(input.poolMatchResults)) {
    for (const group of input.poolStage.grouping.groups) {
      const groupId = group.groupId;
      const entries = group.participantIds.map((id) =>
        createStandingsEntry({ entryId: id, playerId: id })
      );
      const matches = [];
      for (const result of input.poolMatchResults) {
        if (String(result.groupId) !== groupId) continue;
        const acceptance = String(result.acceptanceStatus || "ACCEPTED").toUpperCase();
        const resultType = String(result.resultType || "COMPLETED").toUpperCase();
        if (
          acceptance !== "ACCEPTED" ||
          EXCLUDED_STATUSES.has(resultType) ||
          resultType === "VOID" ||
          resultType === "UNVERIFIED"
        ) {
          // Invalid/unaccepted results are excluded from standings inputs.
          continue;
        }
        matches.push(
          createStandingsMatchRecord({
            matchId: result.matchId,
            entryAId: result.entryAId,
            entryBId: result.entryBId,
            winnerEntryId: result.winnerEntryId,
            resultType: "COMPLETED",
            scoreA: result.scoreA,
            scoreB: result.scoreB,
            verified: true,
            groupId,
            canonicalSource: true,
          })
        );
      }

      const standings = calculateCanonicalStandings(
        createStandingsRequest({
          tournamentId: input.competitionId,
          groupId,
          entries,
          matches,
          configuration: {
            tieBreakRules: [...DEFAULT_TIEBREAK_ORDER],
            tieBreakRuleSetId: "e2e02-injected-tiebreak",
            tieBreakRuleSetVersion: "1",
            drawLotSeed: `${input.competitionId}:${groupId}`,
          },
        }),
        { requireInjectedTieBreakRules: true }
      );

      if (!standings.ok) {
        failE2E02(
          E2E02_ERROR_CODE.STANDINGS_FAILED,
          "CORE-18 standings calculation failed",
          { groupId, errors: standings.errors }
        );
      }

      standingsByGroup.set(
        groupId,
        (standings.rows || []).map((row, index) => ({
          entryId: String(row.entryId),
          rank: Number(row.rank ?? index + 1),
          points: Number(row.points ?? 0),
          status: row.status,
          tieBreakUnresolved: row.tieBreakUnresolved === true,
        }))
      );
    }
  } else {
    failE2E02(
      E2E02_ERROR_CODE.POOL_STAGE_INCOMPLETE,
      "qualification requires poolStandingsRows or poolMatchResults",
      {}
    );
  }

  /** @type {{ participantId: string, seedNumber: number, groupId: string, poolRank: number }[]} */
  const qualifiers = [];

  if (policy === E2E02_QUALIFICATION_POLICY.TOP_N_PER_POOL) {
    const n = format.qualification.qualifiersPerPool;
    for (const group of input.poolStage.grouping.groups) {
      const rows = [...(standingsByGroup.get(group.groupId) || [])].sort(
        (a, b) => a.rank - b.rank || a.entryId.localeCompare(b.entryId)
      );
      const eligible = rows.filter((r) => {
        const status = String(r.status || "").toUpperCase();
        return !EXCLUDED_STATUSES.has(status);
      });

      if (eligible.length < n) {
        failE2E02(
          E2E02_ERROR_CODE.INVALID_QUALIFIER_COUNT,
          "not enough eligible participants to fill qualifier slots",
          { groupId: group.groupId, needed: n, eligible: eligible.length }
        );
      }

      // Detect unresolved boundary ties around the cut line.
      const cut = eligible[n - 1];
      const boundary = eligible.filter(
        (r) =>
          r.rank === cut.rank ||
          (r.points === cut.points && r.rank <= n + 1 && r.tieBreakUnresolved)
      );
      if (
        eligible.some((r) => r.tieBreakUnresolved && r.rank <= n) ||
        (eligible.length > n &&
          eligible[n] &&
          eligible[n].rank === cut.rank)
      ) {
        failE2E02(
          E2E02_ERROR_CODE.UNRESOLVED_TIE,
          "unresolved standings tie at qualification boundary — fail-closed",
          { groupId: group.groupId, boundary }
        );
      }

      for (let i = 0; i < n; i += 1) {
        const row = eligible[i];
        qualifiers.push({
          participantId: row.entryId,
          seedNumber: 0, // assigned globally below
          groupId: group.groupId,
          poolRank: i + 1,
        });
      }
    }
  } else if (policy === E2E02_QUALIFICATION_POLICY.GLOBAL_TOP_N) {
    const n = format.qualification.globalQualifierCount;
    const all = [];
    for (const [groupId, rows] of standingsByGroup.entries()) {
      for (const row of rows) {
        const status = String(row.status || "").toUpperCase();
        if (EXCLUDED_STATUSES.has(status)) continue;
        all.push({ ...row, groupId });
      }
    }
    all.sort(
      (a, b) =>
        b.points - a.points ||
        a.rank - b.rank ||
        a.entryId.localeCompare(b.entryId)
    );
    if (all.length < n) {
      failE2E02(
        E2E02_ERROR_CODE.INVALID_QUALIFIER_COUNT,
        "global qualifier count exceeds eligible participants",
        { needed: n, eligible: all.length }
      );
    }
    const cut = all[n - 1];
    const contested = all.filter(
      (r, index) =>
        index >= n - 1 &&
        r.points === cut.points &&
        (r.tieBreakUnresolved === true || r.rank === cut.rank)
    );
    if (
      all.slice(0, n).some((r) => r.tieBreakUnresolved === true) ||
      (all[n] &&
        all[n].points === cut.points &&
        (all[n].tieBreakUnresolved === true || all[n].rank === cut.rank))
    ) {
      failE2E02(
        E2E02_ERROR_CODE.UNRESOLVED_TIE,
        "unresolved global qualification tie — fail-closed",
        { contested }
      );
    }
    for (let i = 0; i < n; i += 1) {
      qualifiers.push({
        participantId: all[i].entryId,
        seedNumber: 0,
        groupId: all[i].groupId,
        poolRank: all[i].rank,
      });
    }
  } else {
    failE2E02(
      E2E02_ERROR_CODE.INVALID_CONFIGURATION,
      "unsupported qualification policy",
      { policy }
    );
  }

  // Deterministic knockout seeding: poolRank then groupId then participantId.
  const ordered = [...qualifiers].sort(
    (a, b) =>
      a.poolRank - b.poolRank ||
      a.groupId.localeCompare(b.groupId) ||
      a.participantId.localeCompare(b.participantId)
  );

  const seen = new Set();
  const seeded = ordered.map((q, index) => {
    if (seen.has(q.participantId)) {
      failE2E02(
        E2E02_ERROR_CODE.DUPLICATE_QUALIFIER,
        "duplicate qualifier rejected",
        { participantId: q.participantId }
      );
    }
    seen.add(q.participantId);
    return {
      participantId: q.participantId,
      seedNumber: index + 1,
      groupId: q.groupId,
      poolRank: q.poolRank,
    };
  });

  const totalParticipants = input.poolStage.grouping.participantCount;
  if (seeded.length > totalParticipants) {
    failE2E02(
      E2E02_ERROR_CODE.INVALID_QUALIFIER_COUNT,
      "qualifier count exceeds participant count",
      { qualifiers: seeded.length, participants: totalParticipants }
    );
  }
  if (seeded.length < 2) {
    failE2E02(
      E2E02_ERROR_CODE.INVALID_QUALIFIER_COUNT,
      "at least 2 qualifiers required for knockout",
      { qualifiers: seeded.length }
    );
  }

  return deepFreeze({
    stage: "QUALIFICATION",
    policy,
    qualifiers: seeded,
    standingsByGroup: Object.freeze(
      Object.fromEntries(
        [...standingsByGroup.entries()].map(([k, v]) => [k, Object.freeze([...v])])
      )
    ),
    transition: Object.freeze({
      from: "POOL",
      to: "KNOCKOUT",
      qualifierCount: seeded.length,
      validated: true,
    }),
  });
}

export { TIEBREAK_TYPE, isNonEmptyString };
