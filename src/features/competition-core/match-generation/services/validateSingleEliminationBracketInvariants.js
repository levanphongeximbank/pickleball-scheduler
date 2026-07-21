/**
 * CORE-09 Phase 1D — Single Elimination bracket invariant validation.
 */

import { createMatchGenerationIssue } from "../contracts/matchGenerationIssue.js";
import { PARTICIPANT_SLOT_KIND } from "../enums/participantSlotKind.js";
import { MATCH_DEPENDENCY_TYPE } from "../enums/dependencyType.js";
import { MATCH_GENERATION_ISSUE_CODE } from "../errors/matchGenerationIssueCodes.js";
import { sortMatchGenerationIssues } from "./asciiCompare.js";
import {
  isPowerOfTwo,
  expectedLogicalMatchCount,
  expectedPlayedMatchCount,
} from "../generators/singleEliminationBracket.js";

/**
 * @param {import('../contracts/matchPlan.js').MatchPlan|object} plan
 * @param {object} options
 * @param {number} options.participantCount
 * @param {number} options.bracketSize
 * @param {number} options.byeCount
 * @param {number} options.championshipRoundCount
 * @param {boolean} options.includeThirdPlace
 * @returns {import('../contracts/matchGenerationIssue.js').MatchGenerationIssue[]}
 */
export function validateSingleEliminationBracketInvariants(plan, options) {
  /** @type {import('../contracts/matchGenerationIssue.js').MatchGenerationIssue[]} */
  const issues = [];

  const N = options.participantCount;
  const B = options.bracketSize;
  const byeCount = options.byeCount;
  const rounds = options.championshipRoundCount;
  const includeThirdPlace = options.includeThirdPlace === true;

  if (typeof N !== "number" || !Number.isInteger(N) || N < 2) {
    issues.push(
      createMatchGenerationIssue({
        code: MATCH_GENERATION_ISSUE_CODE.PARTICIPANT_COUNT_INSUFFICIENT,
        path: "participantCount",
        message: "Single Elimination requires N >= 2",
        details: { participantCount: N ?? null },
      })
    );
    return sortMatchGenerationIssues(issues);
  }

  if (!isPowerOfTwo(B) || B < N) {
    issues.push(
      createMatchGenerationIssue({
        code: MATCH_GENERATION_ISSUE_CODE.BRACKET_INVARIANT_VIOLATION,
        path: "bracketSize",
        message: "Bracket size must be a power of two >= N",
        details: { bracketSize: B, participantCount: N },
      })
    );
  }

  if (byeCount !== B - N) {
    issues.push(
      createMatchGenerationIssue({
        code: MATCH_GENERATION_ISSUE_CODE.BRACKET_INVARIANT_VIOLATION,
        path: "byeCount",
        message: "Bye count must equal B − N",
        details: { byeCount, expected: B - N },
      })
    );
  }

  const matches = Array.isArray(plan?.logicalMatches) ? plan.logicalMatches : [];
  const expectedLogical = expectedLogicalMatchCount(B, includeThirdPlace);
  if (matches.length !== expectedLogical) {
    issues.push(
      createMatchGenerationIssue({
        code: MATCH_GENERATION_ISSUE_CODE.BRACKET_INVARIANT_VIOLATION,
        path: "logicalMatches",
        message: "LogicalMatch count does not match Single Elimination formula",
        details: {
          actual: matches.length,
          expected: expectedLogical,
          includeThirdPlace,
        },
      })
    );
  }

  const played = matches.filter((m) => m.isByeMatch !== true);
  const expectedPlayed = expectedPlayedMatchCount(N, includeThirdPlace);
  if (played.length !== expectedPlayed) {
    issues.push(
      createMatchGenerationIssue({
        code: MATCH_GENERATION_ISSUE_CODE.BRACKET_INVARIANT_VIOLATION,
        path: "logicalMatches",
        message: "Played match count does not match Single Elimination formula",
        details: { actual: played.length, expected: expectedPlayed },
      })
    );
  }

  /** @type {Map<string, import('../contracts/logicalMatch.js').LogicalMatch>} */
  const byKey = new Map();
  /** @type {Set<string>} */
  const openingParticipants = new Set();
  let doubleBye = 0;
  let finals = 0;
  let thirds = 0;

  for (const m of matches) {
    if (m?.logicalMatchKey) byKey.set(m.logicalMatchKey, m);

    const aBye = m.participantSlotA?.kind === PARTICIPANT_SLOT_KIND.BYE;
    const bBye = m.participantSlotB?.kind === PARTICIPANT_SLOT_KIND.BYE;
    if (aBye && bBye) {
      doubleBye += 1;
      issues.push(
        createMatchGenerationIssue({
          code: MATCH_GENERATION_ISSUE_CODE.BRACKET_INVARIANT_VIOLATION,
          path: `logicalMatches.${m.logicalMatchKey}`,
          message: "Match has two BYE slots",
        })
      );
    }

    if (m.roundNumber === 1) {
      for (const slot of [m.participantSlotA, m.participantSlotB]) {
        if (
          slot?.kind === PARTICIPANT_SLOT_KIND.DIRECT_PARTICIPANT &&
          slot.participantId
        ) {
          if (openingParticipants.has(slot.participantId)) {
            issues.push(
              createMatchGenerationIssue({
                code: MATCH_GENERATION_ISSUE_CODE.BRACKET_INVARIANT_VIOLATION,
                path: `logicalMatches.${m.logicalMatchKey}`,
                message: "Duplicate opening-round participant",
                details: { participantId: slot.participantId },
              })
            );
          }
          openingParticipants.add(slot.participantId);
        }
        if (
          m.roundNumber === 1 &&
          slot?.kind !== PARTICIPANT_SLOT_KIND.DIRECT_PARTICIPANT &&
          slot?.kind !== PARTICIPANT_SLOT_KIND.BYE
        ) {
          issues.push(
            createMatchGenerationIssue({
              code: MATCH_GENERATION_ISSUE_CODE.BRACKET_INVARIANT_VIOLATION,
              path: `logicalMatches.${m.logicalMatchKey}`,
              message: "Opening-round slot must be DIRECT_PARTICIPANT or BYE",
              details: { kind: slot?.kind ?? null },
            })
          );
        }
      }
    }

    // Final / third-place / later championship rounds
    if (m.roundNumber === rounds && m.matchNumber === 1) {
      finals += 1;
      if (rounds === 1) {
        // N=2: opening match is the final (DIRECT slots only).
        for (const slot of [m.participantSlotA, m.participantSlotB]) {
          if (slot?.kind !== PARTICIPANT_SLOT_KIND.DIRECT_PARTICIPANT) {
            issues.push(
              createMatchGenerationIssue({
                code: MATCH_GENERATION_ISSUE_CODE.BRACKET_INVARIANT_VIOLATION,
                path: `logicalMatches.${m.logicalMatchKey}`,
                message: "N=2 final must use two DIRECT_PARTICIPANT slots",
                details: { kind: slot?.kind ?? null },
              })
            );
          }
        }
      } else {
        assertWinnerOfSemis(issues, m, rounds, byKey);
      }
    } else if (
      m.roundNumber === rounds &&
      m.matchNumber === 2 &&
      includeThirdPlace
    ) {
      thirds += 1;
      assertLoserOfSemis(issues, m, rounds, byKey);
    } else if (m.roundNumber > 1) {
      for (const slot of [m.participantSlotA, m.participantSlotB]) {
        if (slot?.kind !== PARTICIPANT_SLOT_KIND.WINNER_OF) {
          issues.push(
            createMatchGenerationIssue({
              code: MATCH_GENERATION_ISSUE_CODE.BRACKET_INVARIANT_VIOLATION,
              path: `logicalMatches.${m.logicalMatchKey}`,
              message:
                "Non-opening championship slots must use WINNER_OF dependencies",
              details: { kind: slot?.kind ?? null },
            })
          );
        }
      }
    }

    // Dependency sources must be prior rounds
    for (const slot of [m.participantSlotA, m.participantSlotB]) {
      const srcKey = slot?.sourceLogicalMatchKey;
      if (!srcKey) continue;
      if (srcKey === m.logicalMatchKey) {
        issues.push(
          createMatchGenerationIssue({
            code: MATCH_GENERATION_ISSUE_CODE.BRACKET_INVARIANT_VIOLATION,
            path: `logicalMatches.${m.logicalMatchKey}`,
            message: "Self-referential dependency",
          })
        );
        continue;
      }
      const src = byKey.get(srcKey);
      if (!src) {
        issues.push(
          createMatchGenerationIssue({
            code: MATCH_GENERATION_ISSUE_CODE.DANGLING_DEPENDENCY,
            path: `logicalMatches.${m.logicalMatchKey}`,
            message: "Dependency source does not exist",
            details: { sourceLogicalMatchKey: srcKey },
          })
        );
        continue;
      }
      if (src.roundNumber >= m.roundNumber) {
        issues.push(
          createMatchGenerationIssue({
            code: MATCH_GENERATION_ISSUE_CODE.BRACKET_INVARIANT_VIOLATION,
            path: `logicalMatches.${m.logicalMatchKey}`,
            message: "Dependency must reference a prior round",
            details: {
              sourceRound: src.roundNumber,
              matchRound: m.roundNumber,
            },
          })
        );
      }
    }
  }

  if (openingParticipants.size !== N) {
    issues.push(
      createMatchGenerationIssue({
        code: MATCH_GENERATION_ISSUE_CODE.BRACKET_INVARIANT_VIOLATION,
        path: "logicalMatches",
        message: "Opening-round direct participants must equal N",
        details: { expected: N, actual: openingParticipants.size },
      })
    );
  }

  if (finals !== 1) {
    issues.push(
      createMatchGenerationIssue({
        code: MATCH_GENERATION_ISSUE_CODE.BRACKET_INVARIANT_VIOLATION,
        path: "logicalMatches",
        message: "Exactly one championship final is required",
        details: { finals },
      })
    );
  }

  if (includeThirdPlace) {
    if (thirds !== 1) {
      issues.push(
        createMatchGenerationIssue({
          code: MATCH_GENERATION_ISSUE_CODE.BRACKET_INVARIANT_VIOLATION,
          path: "logicalMatches",
          message: "Exactly one third-place match is required when PLAYOFF",
          details: { thirds },
        })
      );
    }
  } else if (thirds !== 0) {
    issues.push(
      createMatchGenerationIssue({
        code: MATCH_GENERATION_ISSUE_CODE.BRACKET_INVARIANT_VIOLATION,
        path: "logicalMatches",
        message: "Third-place match present but thirdPlacePolicy is not PLAYOFF",
        details: { thirds },
      })
    );
  }

  if (doubleBye > 0) {
    // already issued per match
  }

  // Bye match count
  const byeMatches = matches.filter((m) => m.isByeMatch === true).length;
  if (byeMatches !== byeCount) {
    issues.push(
      createMatchGenerationIssue({
        code: MATCH_GENERATION_ISSUE_CODE.BRACKET_INVARIANT_VIOLATION,
        path: "logicalMatches",
        message: "Explicit bye LogicalMatch count must equal B − N",
        details: { expected: byeCount, actual: byeMatches },
      })
    );
  }

  return sortMatchGenerationIssues(issues);
}

/**
 * @param {import('../contracts/matchGenerationIssue.js').MatchGenerationIssue[]} issues
 * @param {import('../contracts/logicalMatch.js').LogicalMatch} m
 * @param {number} rounds
 * @param {Map<string, import('../contracts/logicalMatch.js').LogicalMatch>} byKey
 */
function assertWinnerOfSemis(issues, m, rounds, byKey) {
  for (const slot of [m.participantSlotA, m.participantSlotB]) {
    if (slot?.kind !== PARTICIPANT_SLOT_KIND.WINNER_OF) {
      issues.push(
        createMatchGenerationIssue({
          code: MATCH_GENERATION_ISSUE_CODE.BRACKET_INVARIANT_VIOLATION,
          path: `logicalMatches.${m.logicalMatchKey}`,
          message: "Championship final slots must be WINNER_OF semifinals",
          details: { kind: slot?.kind ?? null },
        })
      );
    }
  }
  if (rounds >= 2) {
    const deps = (m.dependencyInputs || []).filter(
      (d) => d.type === MATCH_DEPENDENCY_TYPE.WINNER_OF
    );
    if (deps.length !== 2) {
      issues.push(
        createMatchGenerationIssue({
          code: MATCH_GENERATION_ISSUE_CODE.BRACKET_INVARIANT_VIOLATION,
          path: `logicalMatches.${m.logicalMatchKey}`,
          message: "Final must depend on exactly two WINNER_OF inputs",
        })
      );
    }
    for (const d of deps) {
      const src = byKey.get(d.logicalMatchKey || "");
      if (!src || src.roundNumber !== rounds - 1) {
        issues.push(
          createMatchGenerationIssue({
            code: MATCH_GENERATION_ISSUE_CODE.INVALID_WINNER_PATH,
            path: `logicalMatches.${m.logicalMatchKey}`,
            message: "Final WINNER_OF source is not a semifinal",
            details: { source: d.logicalMatchKey },
          })
        );
      }
    }
  }
  if (m.matchNumber !== 1) {
    issues.push(
      createMatchGenerationIssue({
        code: MATCH_GENERATION_ISSUE_CODE.BRACKET_INVARIANT_VIOLATION,
        path: `logicalMatches.${m.logicalMatchKey}`,
        message: "Championship final must use matchNumber 1",
      })
    );
  }
}

/**
 * @param {import('../contracts/matchGenerationIssue.js').MatchGenerationIssue[]} issues
 * @param {import('../contracts/logicalMatch.js').LogicalMatch} m
 * @param {number} rounds
 * @param {Map<string, import('../contracts/logicalMatch.js').LogicalMatch>} byKey
 */
function assertLoserOfSemis(issues, m, rounds, byKey) {
  for (const slot of [m.participantSlotA, m.participantSlotB]) {
    if (slot?.kind !== PARTICIPANT_SLOT_KIND.LOSER_OF) {
      issues.push(
        createMatchGenerationIssue({
          code: MATCH_GENERATION_ISSUE_CODE.BRACKET_INVARIANT_VIOLATION,
          path: `logicalMatches.${m.logicalMatchKey}`,
          message: "Third-place slots must be LOSER_OF semifinals",
          details: { kind: slot?.kind ?? null },
        })
      );
    }
  }
  const deps = (m.dependencyInputs || []).filter(
    (d) => d.type === MATCH_DEPENDENCY_TYPE.LOSER_OF
  );
  if (deps.length !== 2) {
    issues.push(
      createMatchGenerationIssue({
        code: MATCH_GENERATION_ISSUE_CODE.BRACKET_INVARIANT_VIOLATION,
        path: `logicalMatches.${m.logicalMatchKey}`,
        message: "Third-place must depend on exactly two LOSER_OF inputs",
      })
    );
  }
  for (const d of deps) {
    const src = byKey.get(d.logicalMatchKey || "");
    if (!src || src.roundNumber !== rounds - 1) {
      issues.push(
        createMatchGenerationIssue({
          code: MATCH_GENERATION_ISSUE_CODE.INVALID_LOSER_PATH,
          path: `logicalMatches.${m.logicalMatchKey}`,
          message: "Third-place LOSER_OF source is not a semifinal",
          details: { source: d.logicalMatchKey },
        })
      );
    }
  }
  if (m.winnerTo != null || m.loserTo != null) {
    issues.push(
      createMatchGenerationIssue({
        code: MATCH_GENERATION_ISSUE_CODE.BRACKET_INVARIANT_VIOLATION,
        path: `logicalMatches.${m.logicalMatchKey}`,
        message: "Third-place match must not feed another match",
      })
    );
  }
}
