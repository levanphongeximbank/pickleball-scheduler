/**
 * CORE-09 Phase 1B — MatchPlan invariant validation (fail-closed, structured issues).
 * No locale-dependent ordering. No Math.random / Date.now.
 */

import { createMatchGenerationIssue } from "../contracts/matchGenerationIssue.js";
import { collectForbiddenFieldPaths } from "../contracts/forbiddenSchedulingFields.js";
import { MATCH_DEPENDENCY_TYPE } from "../enums/dependencyType.js";
import { PARTICIPANT_SLOT_KIND } from "../enums/participantSlotKind.js";
import { MATCH_GENERATION_ISSUE_CODE } from "../errors/matchGenerationIssueCodes.js";
import { isWellFormedLogicalMatchKey } from "./buildLogicalMatchKey.js";
import { sortMatchGenerationIssues, asciiCompare } from "./asciiCompare.js";
import { fingerprintMatchPlan } from "./fingerprint.js";

/**
 * @param {import('../contracts/participantSlot.js').ParticipantSlot|null|undefined} slot
 * @returns {string|null}
 */
function resolvedParticipantToken(slot) {
  if (!slot || slot.isBye || slot.kind === PARTICIPANT_SLOT_KIND.BYE) {
    return null;
  }
  if (
    slot.kind === PARTICIPANT_SLOT_KIND.DIRECT_PARTICIPANT &&
    slot.participantId
  ) {
    return `P:${slot.participantId}`;
  }
  if (
    (slot.kind === PARTICIPANT_SLOT_KIND.WINNER_OF ||
      slot.kind === PARTICIPANT_SLOT_KIND.LOSER_OF) &&
    slot.sourceLogicalMatchKey
  ) {
    return `${slot.kind}:${slot.sourceLogicalMatchKey}`;
  }
  if (
    slot.kind === PARTICIPANT_SLOT_KIND.UNRESOLVED_PLACEMENT &&
    slot.placementRef
  ) {
    return `PLACE:${slot.placementRef}`;
  }
  return null;
}

/**
 * Pairing key independent of side order.
 * @param {string} a
 * @param {string} b
 * @returns {string}
 */
function unorderedPairKey(a, b) {
  return asciiCompare(a, b) <= 0 ? `${a}|${b}` : `${b}|${a}`;
}

/**
 * @param {import('../contracts/matchPlan.js').MatchPlan|object} plan
 * @returns {Map<string, import('../contracts/logicalMatch.js').LogicalMatch>}
 */
function indexMatches(plan) {
  /** @type {Map<string, import('../contracts/logicalMatch.js').LogicalMatch>} */
  const map = new Map();
  for (const m of plan?.logicalMatches || []) {
    if (m?.logicalMatchKey) {
      map.set(m.logicalMatchKey, m);
    }
  }
  return map;
}

/**
 * Collect outgoing dependency edges from match key → referenced match keys.
 * @param {import('../contracts/logicalMatch.js').LogicalMatch} match
 * @returns {string[]}
 */
function collectReferencedMatchKeys(match) {
  /** @type {string[]} */
  const keys = [];
  const push = (key) => {
    if (typeof key === "string" && key.trim()) keys.push(key.trim());
  };

  for (const dep of match.dependencyInputs || []) {
    if (
      dep.type === MATCH_DEPENDENCY_TYPE.WINNER_OF ||
      dep.type === MATCH_DEPENDENCY_TYPE.LOSER_OF
    ) {
      push(dep.logicalMatchKey);
    }
  }
  push(match.participantSlotA?.sourceLogicalMatchKey);
  push(match.participantSlotB?.sourceLogicalMatchKey);
  if (match.winnerTo?.logicalMatchKey) push(match.winnerTo.logicalMatchKey);
  if (match.loserTo?.logicalMatchKey) push(match.loserTo.logicalMatchKey);
  return keys;
}

/**
 * @param {import('../contracts/matchGenerationIssue.js').MatchGenerationIssue[]} issues
 * @param {object} args
 */
function validateAdvancementPath(issues, args) {
  const { path, code, label, expectedDepType, edge, key, match, matchIndex } =
    args;
  if (!edge?.logicalMatchKey) return;

  const target = matchIndex.get(edge.logicalMatchKey);
  if (!target) {
    issues.push(
      createMatchGenerationIssue({
        code,
        path,
        message: `${label} path does not resolve to a valid future match`,
        details: { target: edge.logicalMatchKey },
      })
    );
    return;
  }

  const feedsSlot =
    target.participantSlotA?.sourceLogicalMatchKey === key ||
    target.participantSlotB?.sourceLogicalMatchKey === key ||
    (target.dependencyInputs || []).some(
      (d) =>
        d.logicalMatchKey === key &&
        (d.type === expectedDepType ||
          d.type === MATCH_DEPENDENCY_TYPE.WINNER_OF ||
          d.type === MATCH_DEPENDENCY_TYPE.LOSER_OF)
    );
  if (!feedsSlot) {
    issues.push(
      createMatchGenerationIssue({
        code,
        path,
        message: `${label} path target does not reference this match as an input slot`,
        details: { target: edge.logicalMatchKey },
      })
    );
  }
  if (
    typeof target.deterministicOrder === "number" &&
    typeof match.deterministicOrder === "number" &&
    target.deterministicOrder <= match.deterministicOrder
  ) {
    issues.push(
      createMatchGenerationIssue({
        code,
        path,
        message: `${label} path must target a later deterministic order`,
        details: {
          fromOrder: match.deterministicOrder,
          toOrder: target.deterministicOrder,
        },
      })
    );
  }
}

/**
 * Detect cycles among logical match dependency edges.
 * Edge: from referenced prior match → current match (or winnerTo/loserTo target).
 *
 * @param {import('../contracts/matchPlan.js').MatchPlan|object} plan
 * @returns {string[]|null} cycle path or null
 */
export function detectDependencyCycle(plan) {
  /** @type {Map<string, Set<string>>} */
  const adj = new Map();
  const ensure = (k) => {
    if (!adj.has(k)) adj.set(k, new Set());
    return adj.get(k);
  };

  for (const match of plan?.logicalMatches || []) {
    const key = match.logicalMatchKey;
    ensure(key);
    for (const dep of match.dependencyInputs || []) {
      if (
        (dep.type === MATCH_DEPENDENCY_TYPE.WINNER_OF ||
          dep.type === MATCH_DEPENDENCY_TYPE.LOSER_OF) &&
        dep.logicalMatchKey
      ) {
        ensure(dep.logicalMatchKey).add(key);
      }
    }
    if (match.participantSlotA?.sourceLogicalMatchKey) {
      ensure(match.participantSlotA.sourceLogicalMatchKey).add(key);
    }
    if (match.participantSlotB?.sourceLogicalMatchKey) {
      ensure(match.participantSlotB.sourceLogicalMatchKey).add(key);
    }
    if (match.winnerTo?.logicalMatchKey) {
      ensure(key).add(match.winnerTo.logicalMatchKey);
    }
    if (match.loserTo?.logicalMatchKey) {
      ensure(key).add(match.loserTo.logicalMatchKey);
    }
  }

  /** @type {Set<string>} */
  const visiting = new Set();
  /** @type {Set<string>} */
  const visited = new Set();
  /** @type {string[]} */
  const stack = [];

  /**
   * @param {string} node
   * @returns {string[]|null}
   */
  function dfs(node) {
    if (visiting.has(node)) {
      const idx = stack.indexOf(node);
      return stack.slice(idx).concat(node);
    }
    if (visited.has(node)) return null;
    visiting.add(node);
    stack.push(node);
    for (const next of adj.get(node) || []) {
      const cycle = dfs(next);
      if (cycle) return cycle;
    }
    stack.pop();
    visiting.delete(node);
    visited.add(node);
    return null;
  }

  const nodes = [...adj.keys()].sort(asciiCompare);
  for (const node of nodes) {
    const cycle = dfs(node);
    if (cycle) return cycle;
  }
  return null;
}

/**
 * Validate MatchPlan against CORE-09 Phase 1B invariants.
 *
 * @param {import('../contracts/matchPlan.js').MatchPlan|object|null|undefined} plan
 * @param {object} [options]
 * @param {import('../contracts/drawSnapshot.js').DrawSnapshot} [options.boundDrawSnapshot]
 * @param {string} [options.expectedDrawFingerprint]
 * @param {string} [options.expectedRuleEvaluationFingerprint]
 * @param {string} [options.expectedParticipantFingerprint]
 * @param {string} [options.strategy]
 * @param {string[]} [options.deterministicOrderingInputs]
 * @param {boolean} [options.requireGenerationFingerprintMatch]
 * @returns {import('../contracts/matchGenerationIssue.js').MatchGenerationIssue[]}
 */
export function validateMatchPlanInvariants(plan, options = {}) {
  /** @type {import('../contracts/matchGenerationIssue.js').MatchGenerationIssue[]} */
  const issues = [];

  if (!plan || typeof plan !== "object") {
    issues.push(
      createMatchGenerationIssue({
        code: MATCH_GENERATION_ISSUE_CODE.INVALID_MATCH_PLAN,
        path: "",
        message: "MatchPlan must be an object",
      })
    );
    return sortMatchGenerationIssues(issues);
  }

  // 14. Forbidden scheduling / score / lifecycle / standings fields
  for (const path of collectForbiddenFieldPaths(plan)) {
    issues.push(
      createMatchGenerationIssue({
        code: MATCH_GENERATION_ISSUE_CODE.FORBIDDEN_SCHEDULING_FIELD,
        path,
        message: `Forbidden field on MatchPlan: ${path}`,
      })
    );
  }

  // 11 / 12 — fingerprint binding
  const drawFp = String(plan.drawFingerprint || "").trim();
  const ruleFp = String(plan.ruleEvaluationFingerprint || "").trim();
  const partFp = String(plan.participantFingerprint || "").trim();

  if (!drawFp) {
    issues.push(
      createMatchGenerationIssue({
        code: MATCH_GENERATION_ISSUE_CODE.DRAW_FINGERPRINT_MISSING,
        path: "drawFingerprint",
        message: "Draw fingerprint must be bound to MatchPlan",
      })
    );
  } else if (
    options.expectedDrawFingerprint &&
    drawFp !== String(options.expectedDrawFingerprint).trim()
  ) {
    issues.push(
      createMatchGenerationIssue({
        code: MATCH_GENERATION_ISSUE_CODE.DRAW_FINGERPRINT_MISMATCH,
        path: "drawFingerprint",
        message: "MatchPlan draw fingerprint does not match bound Draw",
      })
    );
  }

  if (!ruleFp) {
    issues.push(
      createMatchGenerationIssue({
        code: MATCH_GENERATION_ISSUE_CODE.RULE_FINGERPRINT_MISSING,
        path: "ruleEvaluationFingerprint",
        message: "Rule evaluation fingerprint must be bound to MatchPlan",
      })
    );
  } else if (
    options.expectedRuleEvaluationFingerprint &&
    ruleFp !== String(options.expectedRuleEvaluationFingerprint).trim()
  ) {
    issues.push(
      createMatchGenerationIssue({
        code: MATCH_GENERATION_ISSUE_CODE.RULE_FINGERPRINT_MISMATCH,
        path: "ruleEvaluationFingerprint",
        message: "MatchPlan rule fingerprint does not match bound rules",
      })
    );
  }

  if (!partFp) {
    issues.push(
      createMatchGenerationIssue({
        code: MATCH_GENERATION_ISSUE_CODE.PARTICIPANT_FINGERPRINT_MISSING,
        path: "participantFingerprint",
        message: "Participant fingerprint must be bound to MatchPlan",
      })
    );
  } else if (
    options.expectedParticipantFingerprint &&
    partFp !== String(options.expectedParticipantFingerprint).trim()
  ) {
    issues.push(
      createMatchGenerationIssue({
        code: MATCH_GENERATION_ISSUE_CODE.PARTICIPANT_FINGERPRINT_MISSING,
        path: "participantFingerprint",
        message: "MatchPlan participant fingerprint mismatch",
      })
    );
  }

  // 10 — Draw placements not mutated (when bound snapshot provided)
  if (options.boundDrawSnapshot) {
    if (
      drawFp &&
      String(options.boundDrawSnapshot.drawFingerprint || "").trim() !== drawFp
    ) {
      issues.push(
        createMatchGenerationIssue({
          code: MATCH_GENERATION_ISSUE_CODE.DRAW_MUTATION_DETECTED,
          path: "drawFingerprint",
          message: "Bound Draw fingerprint diverges from MatchPlan",
        })
      );
    }
  }

  const stages = Array.isArray(plan.stages) ? plan.stages : [];
  const rounds = Array.isArray(plan.rounds) ? plan.rounds : [];
  const matches = Array.isArray(plan.logicalMatches) ? plan.logicalMatches : [];

  /** @type {Map<string, number>} */
  const stageIdCounts = new Map();
  for (const s of stages) {
    const id = String(s.stageId || "").trim();
    if (id) stageIdCounts.set(id, (stageIdCounts.get(id) || 0) + 1);
  }

  /** @type {Map<string, number>} */
  const roundIdCounts = new Map();
  /** @type {Map<string, string>} */
  const roundToStage = new Map();
  for (const r of rounds) {
    const id = String(r.roundId || "").trim();
    if (id) {
      roundIdCounts.set(id, (roundIdCounts.get(id) || 0) + 1);
      roundToStage.set(id, String(r.stageId || "").trim());
    }
  }

  /** @type {Map<string, number>} */
  const keyCounts = new Map();
  /** @type {Map<string, number>} */
  const pairCounts = new Map();
  /** @type {Map<string, number>} */
  const matchStageMembership = new Map();
  /** @type {Map<string, number>} */
  const matchRoundMembership = new Map();

  for (const r of rounds) {
    for (const key of r.logicalMatchKeys || []) {
      matchRoundMembership.set(
        key,
        (matchRoundMembership.get(key) || 0) + 1
      );
      const stageId = String(r.stageId || "").trim();
      if (stageId) {
        matchStageMembership.set(
          key,
          (matchStageMembership.get(key) || 0) + 1
        );
      }
    }
  }

  // Round ↔ stage consistency via stage.roundIds → rounds
  for (const s of stages) {
    for (const roundId of s.roundIds || []) {
      const round = rounds.find((r) => r.roundId === roundId);
      if (!round) continue;
      if (round.stageId && round.stageId !== s.stageId) {
        issues.push(
          createMatchGenerationIssue({
            code: MATCH_GENERATION_ISSUE_CODE.MATCH_STAGE_AMBIGUOUS,
            path: `rounds.${roundId}.stageId`,
            message: "Round stageId conflicts with parent stage",
            details: {
              roundId,
              stageId: s.stageId,
              roundStageId: round.stageId,
            },
          })
        );
      }
    }
  }

  const matchIndex = indexMatches(plan);

  for (let i = 0; i < matches.length; i += 1) {
    const match = matches[i];
    const path = `logicalMatches[${i}]`;
    const key = String(match?.logicalMatchKey || "").trim();

    if (!key || !isWellFormedLogicalMatchKey(key)) {
      issues.push(
        createMatchGenerationIssue({
          code: MATCH_GENERATION_ISSUE_CODE.INVALID_LOGICAL_MATCH_KEY,
          path: `${path}.logicalMatchKey`,
          message: "Stable logical match key is invalid",
          details: { logicalMatchKey: key || null },
        })
      );
    } else {
      keyCounts.set(key, (keyCounts.get(key) || 0) + 1);
    }

    // 3 / 4 — exactly one stage and round
    const stageMembership = matchRoundMembership.has(key)
      ? matchStageMembership.get(key) || 0
      : 0;
    const roundMembership = matchRoundMembership.get(key) || 0;

    if (!match?.stageId) {
      issues.push(
        createMatchGenerationIssue({
          code: MATCH_GENERATION_ISSUE_CODE.MATCH_STAGE_REQUIRED,
          path: `${path}.stageId`,
          message: "Logical match must belong to a stage",
        })
      );
    } else if (!stageIdCounts.has(match.stageId)) {
      issues.push(
        createMatchGenerationIssue({
          code: MATCH_GENERATION_ISSUE_CODE.MATCH_STAGE_REQUIRED,
          path: `${path}.stageId`,
          message: "Logical match stageId is not present in MatchPlan.stages",
          details: { stageId: match.stageId },
        })
      );
    }

    if (
      typeof match.roundNumber !== "number" ||
      !Number.isInteger(match.roundNumber)
    ) {
      issues.push(
        createMatchGenerationIssue({
          code: MATCH_GENERATION_ISSUE_CODE.MATCH_ROUND_REQUIRED,
          path: `${path}.roundNumber`,
          message: "Logical match must belong to a round",
        })
      );
    }

    if (key && roundMembership === 0) {
      issues.push(
        createMatchGenerationIssue({
          code: MATCH_GENERATION_ISSUE_CODE.MATCH_ROUND_REQUIRED,
          path: `${path}`,
          message: "Logical match is not listed in exactly one round",
          details: { logicalMatchKey: key },
        })
      );
    } else if (key && roundMembership > 1) {
      issues.push(
        createMatchGenerationIssue({
          code: MATCH_GENERATION_ISSUE_CODE.MATCH_ROUND_AMBIGUOUS,
          path: `${path}`,
          message: "Logical match belongs to more than one round",
          details: { logicalMatchKey: key, count: roundMembership },
        })
      );
    }

    if (key && stageMembership > 1) {
      issues.push(
        createMatchGenerationIssue({
          code: MATCH_GENERATION_ISSUE_CODE.MATCH_STAGE_AMBIGUOUS,
          path: `${path}`,
          message: "Logical match belongs to more than one stage",
          details: { logicalMatchKey: key, count: stageMembership },
        })
      );
    }

    // 1 — no self-match
    const tokenA = resolvedParticipantToken(match.participantSlotA);
    const tokenB = resolvedParticipantToken(match.participantSlotB);
    if (tokenA && tokenB && tokenA === tokenB) {
      issues.push(
        createMatchGenerationIssue({
          code: MATCH_GENERATION_ISSUE_CODE.SELF_MATCH,
          path: path,
          message: "Participant plays itself",
          details: { token: tokenA, logicalMatchKey: key },
        })
      );
    }

    // 2 — forbidden duplicate pairing (same unordered direct pair)
    if (
      tokenA &&
      tokenB &&
      match.participantSlotA?.kind === PARTICIPANT_SLOT_KIND.DIRECT_PARTICIPANT &&
      match.participantSlotB?.kind === PARTICIPANT_SLOT_KIND.DIRECT_PARTICIPANT
    ) {
      const pair = unorderedPairKey(tokenA, tokenB);
      pairCounts.set(pair, (pairCounts.get(pair) || 0) + 1);
    }

    // 9 — bye consistency
    const aBye = match.participantSlotA?.isBye === true;
    const bBye = match.participantSlotB?.isBye === true;
    if (aBye && match.participantSlotA?.kind !== PARTICIPANT_SLOT_KIND.BYE) {
      issues.push(
        createMatchGenerationIssue({
          code: MATCH_GENERATION_ISSUE_CODE.INVALID_BYE_REPRESENTATION,
          path: `${path}.participantSlotA`,
          message: "Bye flag requires BYE slot kind",
        })
      );
    }
    if (bBye && match.participantSlotB?.kind !== PARTICIPANT_SLOT_KIND.BYE) {
      issues.push(
        createMatchGenerationIssue({
          code: MATCH_GENERATION_ISSUE_CODE.INVALID_BYE_REPRESENTATION,
          path: `${path}.participantSlotB`,
          message: "Bye flag requires BYE slot kind",
        })
      );
    }
    if (match.isByeMatch === true && !aBye && !bBye) {
      issues.push(
        createMatchGenerationIssue({
          code: MATCH_GENERATION_ISSUE_CODE.INVALID_BYE_REPRESENTATION,
          path: `${path}.isByeMatch`,
          message: "isByeMatch true but neither slot is a bye",
        })
      );
    }
    if ((aBye || bBye) && match.isByeMatch !== true) {
      issues.push(
        createMatchGenerationIssue({
          code: MATCH_GENERATION_ISSUE_CODE.INVALID_BYE_REPRESENTATION,
          path: `${path}.isByeMatch`,
          message: "Bye slot present but isByeMatch is false",
        })
      );
    }

    // 6 — dependency resolution
    for (const refKey of collectReferencedMatchKeys(match)) {
      if (!matchIndex.has(refKey)) {
        issues.push(
          createMatchGenerationIssue({
            code: MATCH_GENERATION_ISSUE_CODE.DANGLING_DEPENDENCY,
            path: path,
            message: "Dependency reference does not resolve",
            details: {
              logicalMatchKey: key,
              referencedLogicalMatchKey: refKey,
            },
          })
        );
      }
    }

    // 8 — elimination winner / loser paths resolve to valid future slots
    validateAdvancementPath(issues, {
      path: `${path}.winnerTo`,
      code: MATCH_GENERATION_ISSUE_CODE.INVALID_WINNER_PATH,
      label: "Winner",
      expectedDepType: MATCH_DEPENDENCY_TYPE.WINNER_OF,
      edge: match.winnerTo,
      key,
      match,
      matchIndex,
    });
    validateAdvancementPath(issues, {
      path: `${path}.loserTo`,
      code: MATCH_GENERATION_ISSUE_CODE.INVALID_LOSER_PATH,
      label: "Loser",
      expectedDepType: MATCH_DEPENDENCY_TYPE.LOSER_OF,
      edge: match.loserTo,
      key,
      match,
      matchIndex,
    });
  }

  // 5 — unique keys
  for (const [logicalMatchKey, count] of keyCounts.entries()) {
    if (count > 1) {
      issues.push(
        createMatchGenerationIssue({
          code: MATCH_GENERATION_ISSUE_CODE.DUPLICATE_LOGICAL_MATCH_KEY,
          path: "logicalMatches",
          message: "Stable match keys must be unique inside a MatchPlan",
          details: { logicalMatchKey, count },
        })
      );
    }
  }

  // 2 — duplicate pairings
  for (const [pair, count] of pairCounts.entries()) {
    if (count > 1) {
      issues.push(
        createMatchGenerationIssue({
          code: MATCH_GENERATION_ISSUE_CODE.FORBIDDEN_DUPLICATE_PAIRING,
          path: "logicalMatches",
          message: "Forbidden duplicate pairing",
          details: { pair, count },
        })
      );
    }
  }

  // 7 — acyclic dependencies
  const cycle = detectDependencyCycle(plan);
  if (cycle) {
    issues.push(
      createMatchGenerationIssue({
        code: MATCH_GENERATION_ISSUE_CODE.DEPENDENCY_CYCLE,
        path: "logicalMatches",
        message: "Dependency graph contains a cycle",
        details: { cycle },
      })
    );
  }

  // 13 — generation fingerprint consistency when requested
  if (
    options.requireGenerationFingerprintMatch !== false &&
    String(plan.generationFingerprint || "").trim()
  ) {
    const expected = fingerprintMatchPlan(plan, {
      strategy: options.strategy,
      deterministicOrderingInputs: options.deterministicOrderingInputs || [],
    });
    if (expected !== String(plan.generationFingerprint).trim()) {
      issues.push(
        createMatchGenerationIssue({
          code: MATCH_GENERATION_ISSUE_CODE.GENERATION_FINGERPRINT_MISMATCH,
          path: "generationFingerprint",
          message: "Generation fingerprint does not match canonical inputs",
          details: {
            expected,
            actual: plan.generationFingerprint,
          },
        })
      );
    }
  }

  return sortMatchGenerationIssues(issues);
}

/**
 * @param {import('../contracts/matchPlan.js').MatchPlan|object} plan
 * @param {object} [options]
 * @returns {{ ok: boolean, issues: import('../contracts/matchGenerationIssue.js').MatchGenerationIssue[] }}
 */
export function assertMatchPlanValid(plan, options = {}) {
  const issues = validateMatchPlanInvariants(plan, options);
  return { ok: issues.length === 0, issues };
}
