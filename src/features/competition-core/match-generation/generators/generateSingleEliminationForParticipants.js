/**
 * CORE-09 Phase 1D — generate Single Elimination LogicalMatches from Draw slots.
 */

import { createMatchGenerationIssue } from "../contracts/index.js";
import { MATCH_GENERATION_ISSUE_CODE } from "../errors/matchGenerationIssueCodes.js";
import { sortMatchGenerationIssues } from "../services/asciiCompare.js";
import {
  computeSingleEliminationBracket,
  expectedLogicalMatchCount,
  expectedPlayedMatchCount,
} from "./singleEliminationBracket.js";
import {
  resolveBracketSlotsFromDraw,
  materializeOpeningRoundMatches,
} from "./materializeSingleEliminationMatches.js";
import { buildEliminationDependencyGraph } from "./buildEliminationDependencyGraph.js";

/**
 * Count non-bye participants in Draw (does not invent byes).
 * @param {import('../contracts/drawSnapshot.js').DrawSnapshot} drawSnapshot
 * @returns {number}
 */
export function countDrawParticipants(drawSnapshot) {
  const placements = Array.isArray(drawSnapshot?.participantPlacements)
    ? drawSnapshot.participantPlacements
    : [];
  let n = 0;
  /** @type {Set<string>} */
  const seen = new Set();
  for (const p of placements) {
    if (p?.isBye === true) continue;
    const id = String(p?.participantId || "").trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    n += 1;
  }
  return n;
}

/**
 * @param {object} args
 * @param {import('../contracts/drawSnapshot.js').DrawSnapshot} args.drawSnapshot
 * @param {import('../contracts/evaluatedMatchGenerationRules.js').EvaluatedMatchGenerationRules} args.evaluatedRules
 * @param {string} args.competitionId
 * @param {string} args.divisionId
 * @param {string|null} args.categoryId
 * @param {string} args.stageId
 * @returns {{
 *   ok: boolean,
 *   logicalMatches: import('../contracts/logicalMatch.js').LogicalMatch[],
 *   diagnostics: object,
 *   issues: import('../contracts/matchGenerationIssue.js').MatchGenerationIssue[],
 * }}
 */
export function generateSingleEliminationForParticipants(args) {
  /** @type {import('../contracts/matchGenerationIssue.js').MatchGenerationIssue[]} */
  const issues = [];
  const N = countDrawParticipants(args.drawSnapshot);

  if (N < 2) {
    issues.push(
      createMatchGenerationIssue({
        code: MATCH_GENERATION_ISSUE_CODE.PARTICIPANT_COUNT_INSUFFICIENT,
        path: "participantPlacements",
        message: "Single Elimination requires at least two participants",
        details: { participantCount: N },
      })
    );
    return {
      ok: false,
      logicalMatches: [],
      diagnostics: { participantCount: N },
      issues: sortMatchGenerationIssues(issues),
    };
  }

  const includeThirdPlace =
    String(args.evaluatedRules?.thirdPlacePolicy || "") === "PLAYOFF";

  if (includeThirdPlace && N < 4) {
    issues.push(
      createMatchGenerationIssue({
        code: MATCH_GENERATION_ISSUE_CODE.PARTICIPANT_COUNT_INSUFFICIENT,
        path: "evaluatedRules.thirdPlacePolicy",
        message: "Third-place PLAYOFF requires at least four participants",
        details: { participantCount: N },
      })
    );
    return {
      ok: false,
      logicalMatches: [],
      diagnostics: { participantCount: N, includeThirdPlace },
      issues: sortMatchGenerationIssues(issues),
    };
  }

  const dims = computeSingleEliminationBracket(
    N,
    args.evaluatedRules.bracketSizePolicy
  );
  if (!dims.ok) {
    const code =
      dims.reason === "PARTICIPANT_COUNT_INSUFFICIENT"
        ? MATCH_GENERATION_ISSUE_CODE.PARTICIPANT_COUNT_INSUFFICIENT
        : dims.reason === "EXACT_REQUIRES_POWER_OF_TWO"
          ? MATCH_GENERATION_ISSUE_CODE.UNSUPPORTED_GENERATION_POLICY
          : MATCH_GENERATION_ISSUE_CODE.BRACKET_INVARIANT_VIOLATION;
    issues.push(
      createMatchGenerationIssue({
        code,
        path: "evaluatedRules.bracketSizePolicy",
        message: "Single Elimination bracket size could not be computed",
        details: {
          reason: dims.reason,
          participantCount: N,
          bracketSizePolicy: args.evaluatedRules.bracketSizePolicy,
        },
      })
    );
    return {
      ok: false,
      logicalMatches: [],
      diagnostics: { participantCount: N },
      issues: sortMatchGenerationIssues(issues),
    };
  }

  const resolved = resolveBracketSlotsFromDraw(args.drawSnapshot, {
    bracketSize: dims.bracketSize,
    participantCount: N,
    byeCount: dims.byeCount,
  });
  if (!resolved.ok) {
    return {
      ok: false,
      logicalMatches: [],
      diagnostics: {
        participantCount: N,
        bracketSize: dims.bracketSize,
        byeCount: dims.byeCount,
      },
      issues: sortMatchGenerationIssues(resolved.issues),
    };
  }

  const opening = materializeOpeningRoundMatches({
    slots: resolved.slots,
    bracketSize: dims.bracketSize,
    competitionId: args.competitionId,
    divisionId: args.divisionId,
    categoryId: args.categoryId,
    stageId: args.stageId,
    bracketId: resolved.bracketId,
    deterministicOrderStart: 1,
  });
  if (!opening.ok) {
    return {
      ok: false,
      logicalMatches: [],
      diagnostics: {
        participantCount: N,
        bracketSize: dims.bracketSize,
      },
      issues: sortMatchGenerationIssues(opening.issues),
    };
  }

  try {
    const graph = buildEliminationDependencyGraph({
      openingMatches: opening.logicalMatches,
      bracketSize: dims.bracketSize,
      championshipRoundCount: dims.championshipRoundCount,
      competitionId: args.competitionId,
      divisionId: args.divisionId,
      categoryId: args.categoryId,
      stageId: args.stageId,
      bracketId: resolved.bracketId,
      deterministicOrderStart: opening.nextDeterministicOrder,
      includeThirdPlace,
    });

    const diagnostics = {
      participantCount: N,
      bracketSize: dims.bracketSize,
      byeCount: dims.byeCount,
      championshipRoundCount: dims.championshipRoundCount,
      openingMatchCount: dims.openingMatchCount,
      includeThirdPlace,
      expectedLogicalMatches: expectedLogicalMatchCount(
        dims.bracketSize,
        includeThirdPlace
      ),
      expectedPlayedMatches: expectedPlayedMatchCount(N, includeThirdPlace),
      actualLogicalMatches: graph.logicalMatches.length,
      actualPlayedMatches: graph.logicalMatches.filter((m) => !m.isByeMatch)
        .length,
      finalKey: graph.finalKey,
      thirdPlaceKey: graph.thirdPlaceKey,
      semifinalKeys: graph.semifinalKeys,
      slotOrder: resolved.slots.map((s) =>
        s.isBye ? `BYE@${s.position}` : `${s.participantId}@${s.position}`
      ),
    };

    return {
      ok: true,
      logicalMatches: graph.logicalMatches,
      diagnostics,
      issues: [],
    };
  } catch (err) {
    issues.push(
      createMatchGenerationIssue({
        code: MATCH_GENERATION_ISSUE_CODE.BRACKET_INVARIANT_VIOLATION,
        path: "logicalMatches",
        message: "Single Elimination dependency graph construction failed",
        details: {
          error: err instanceof Error ? err.message : String(err),
        },
      })
    );
    return {
      ok: false,
      logicalMatches: [],
      diagnostics: {
        participantCount: N,
        bracketSize: dims.bracketSize,
      },
      issues: sortMatchGenerationIssues(issues),
    };
  }
}
