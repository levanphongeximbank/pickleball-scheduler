/**
 * CORE-09 — deterministic fingerprints. No clock. No Math.random. No secrets.
 */

import { MATCH_GENERATOR_IDENTITY } from "../constants.js";

/**
 * Stable string → 32-bit unsigned hash (FNV-1a).
 * @param {string} input
 * @returns {number}
 */
export function hashStringToUint32(input) {
  let hash = 2166136261;
  const str = String(input ?? "");
  for (let i = 0; i < str.length; i += 1) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/**
 * Deterministic JSON-like canonicalize: sort object keys; preserve array order
 * after caller applied semantic sorting where required.
 * @param {unknown} value
 * @returns {unknown}
 */
/**
 * @param {unknown} value
 * @param {WeakSet<object>} [seen]
 * @returns {unknown}
 */
export function canonicalizeJsonValue(value, seen = new WeakSet()) {
  if (value === null || typeof value !== "object") {
    if (typeof value === "number" && !Number.isFinite(value)) {
      throw new Error("NON_CANONICAL_VALUE: non-finite number in fingerprint material");
    }
    if (typeof value === "bigint") {
      throw new Error("NON_CANONICAL_VALUE: bigint in fingerprint material");
    }
    if (typeof value === "undefined") {
      return null;
    }
    if (typeof value === "function" || typeof value === "symbol") {
      throw new Error(
        `NON_CANONICAL_VALUE: ${typeof value} in fingerprint material`
      );
    }
    return value ?? null;
  }
  if (seen.has(value)) {
    throw new Error("NON_CANONICAL_VALUE: cyclic reference in fingerprint material");
  }
  seen.add(value);
  if (Array.isArray(value)) {
    return value.map((item) => canonicalizeJsonValue(item, seen));
  }
  /** @type {Record<string, unknown>} */
  const out = {};
  for (const key of Object.keys(
    /** @type {Record<string, unknown>} */ (value)
  ).sort()) {
    out[key] = canonicalizeJsonValue(
      /** @type {Record<string, unknown>} */ (value)[key],
      seen
    );
  }
  return out;
}

/**
 * @param {unknown} value
 * @returns {string}
 */
export function serializeCanonical(value) {
  return JSON.stringify(canonicalizeJsonValue(value));
}

/**
 * Hex fingerprint from FNV-1a 32-bit (not a cryptographic claim).
 * @param {unknown} value
 * @returns {string}
 */
export function fingerprintValue(value) {
  const material = serializeCanonical(value);
  return hashStringToUint32(material).toString(16).padStart(8, "0");
}

/**
 * Generation fingerprint from canonical MatchPlan structural material + bound fingerprints.
 *
 * @param {object} material
 * @returns {string}
 */
export function fingerprintGeneration(material = {}) {
  return fingerprintValue({
    kind: "CORE09_GENERATION_V1",
    generatorId: MATCH_GENERATOR_IDENTITY.id,
    generatorVersion:
      material.generatorVersion || MATCH_GENERATOR_IDENTITY.version,
    drawFingerprint: String(material.drawFingerprint || ""),
    ruleEvaluationFingerprint: String(
      material.ruleEvaluationFingerprint || ""
    ),
    participantFingerprint: String(material.participantFingerprint || ""),
    strategy: String(material.strategy || ""),
    stages: material.stages || [],
    rounds: material.rounds || [],
    logicalMatches: material.logicalMatches || [],
    deterministicOrderingInputs: material.deterministicOrderingInputs || [],
  });
}

/**
 * Canonical structural projection of a MatchPlan for fingerprinting / regen checks.
 * Omits diagnostics / validationSummary / free metadata.
 *
 * @param {import('../contracts/matchPlan.js').MatchPlan|object} plan
 * @returns {object}
 */
export function projectMatchPlanForFingerprint(plan) {
  const matches = Array.isArray(plan?.logicalMatches)
    ? plan.logicalMatches.map((m) => ({
        logicalMatchKey: m.logicalMatchKey,
        competitionId: m.competitionId,
        divisionId: m.divisionId,
        categoryId: m.categoryId,
        stageId: m.stageId,
        groupId: m.groupId,
        bracketId: m.bracketId,
        roundNumber: m.roundNumber,
        matchNumber: m.matchNumber,
        deterministicOrder: m.deterministicOrder,
        isByeMatch: m.isByeMatch,
        participantSlotA: {
          kind: m.participantSlotA?.kind,
          participantId: m.participantSlotA?.participantId,
          sourceLogicalMatchKey: m.participantSlotA?.sourceLogicalMatchKey,
          placementRef: m.participantSlotA?.placementRef,
          isBye: m.participantSlotA?.isBye,
        },
        participantSlotB: {
          kind: m.participantSlotB?.kind,
          participantId: m.participantSlotB?.participantId,
          sourceLogicalMatchKey: m.participantSlotB?.sourceLogicalMatchKey,
          placementRef: m.participantSlotB?.placementRef,
          isBye: m.participantSlotB?.isBye,
        },
        dependencyInputs: (m.dependencyInputs || []).map((d) => ({
          type: d.type,
          logicalMatchKey: d.logicalMatchKey,
          participantId: d.participantId,
          placementRef: d.placementRef,
        })),
        winnerTo: m.winnerTo
          ? {
              type: m.winnerTo.type,
              logicalMatchKey: m.winnerTo.logicalMatchKey,
            }
          : null,
        loserTo: m.loserTo
          ? {
              type: m.loserTo.type,
              logicalMatchKey: m.loserTo.logicalMatchKey,
            }
          : null,
        sourcePlacementRefs: [...(m.sourcePlacementRefs || [])],
      }))
    : [];

  return {
    competitionId: plan?.competitionId,
    divisionId: plan?.divisionId,
    categoryId: plan?.categoryId,
    stages: (plan?.stages || []).map((s) => ({
      stageId: s.stageId,
      stageOrder: s.stageOrder,
      roundIds: [...(s.roundIds || [])],
    })),
    rounds: (plan?.rounds || []).map((r) => ({
      roundId: r.roundId,
      stageId: r.stageId,
      roundNumber: r.roundNumber,
      roundOrder: r.roundOrder,
      logicalMatchKeys: [...(r.logicalMatchKeys || [])],
    })),
    logicalMatches: matches,
    drawFingerprint: plan?.drawFingerprint,
    ruleEvaluationFingerprint: plan?.ruleEvaluationFingerprint,
    participantFingerprint: plan?.participantFingerprint,
    generatorVersion: plan?.generatorVersion,
  };
}

/**
 * Compute generation fingerprint for a MatchPlan (structural projection).
 * @param {import('../contracts/matchPlan.js').MatchPlan|object} plan
 * @param {object} [extras]
 * @returns {string}
 */
export function fingerprintMatchPlan(plan, extras = {}) {
  const projection = projectMatchPlanForFingerprint(plan);
  return fingerprintGeneration({
    ...projection,
    strategy: extras.strategy || extras.generationStrategy || "",
    deterministicOrderingInputs: extras.deterministicOrderingInputs || [],
  });
}
