/**
 * CORE-08 Phase 1C — generic constraint resolver port.
 *
 * Format-neutral DI boundary only. CORE-08 does not define club/unit/host rules.
 * Resolves the existing DrawResolverOptions.constraintResolver declaration into
 * an invocable, matchable port (function or { resolveConstraints }).
 */

/**
 * @typedef {Object} ConstraintResolveInput
 * @property {ReadonlyArray<import('../contracts/drawPlacement.js').DrawPlacement>} placements
 * @property {ReadonlyArray<import('../contracts/drawCandidate.js').DrawCandidate>} candidates
 * @property {ReadonlyArray<import('../contracts/drawGroup.js').DrawGroup>} groups
 * @property {ReadonlyArray<import('../contracts/drawGroup.js').DrawBracket>} brackets
 * @property {ReadonlyArray<import('../contracts/drawGroup.js').DrawBye>} byes
 * @property {ReadonlyArray<import('../contracts/drawCandidate.js').DrawCandidate>} unresolvedCandidates
 * @property {ReadonlyArray<string>} decisionTrace
 * @property {string} drawMode
 * @property {string} layoutType
 * @property {number|null} groupCount
 * @property {number|null} groupCapacity
 * @property {number|null} bracketSize
 * @property {string} drawIdentityKey
 * @property {string} competitionId
 * @property {string} contextId
 * @property {unknown} [deterministicSeed]
 * @property {Readonly<Record<string, unknown>>} context
 * @property {Readonly<Record<string, unknown>>} metadata
 * @property {ReadonlyArray<Record<string, unknown>>} manualPlacements
 * @property {ReadonlyArray<Record<string, unknown>>} protectedPlacements
 */

/**
 * Accepted / adjusted / fail-closed result shapes.
 *
 * @typedef {Object} ConstraintResolveResult
 * @property {boolean} ok
 * @property {boolean} [accepted] when ok+accepted, keep Phase 3H proposal unchanged
 * @property {import('../contracts/drawPlacement.js').DrawPlacement[]} [placements]
 * @property {import('../contracts/drawGroup.js').DrawGroup[]} [groups]
 * @property {import('../contracts/drawGroup.js').DrawBracket[]} [brackets]
 * @property {import('../contracts/drawGroup.js').DrawBye[]} [byes]
 * @property {import('../contracts/drawCandidate.js').DrawCandidate[]} [unresolvedCandidates]
 * @property {string[]} [decisionTrace]
 * @property {string[]} [diagnostics]
 * @property {string} [code]
 * @property {string} [message]
 * @property {Record<string, unknown>} [details]
 */

/**
 * @typedef {(input: ConstraintResolveInput) =>
 *   ConstraintResolveResult|Promise<ConstraintResolveResult>} ConstraintResolverFn
 */

/**
 * @typedef {Object} ConstraintResolverPort
 * @property {ConstraintResolverFn} resolveConstraints
 */

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function matchesConstraintResolver(value) {
  if (typeof value === "function") return true;
  return (
    !!value &&
    typeof value === "object" &&
    typeof /** @type {{ resolveConstraints?: unknown }} */ (value)
      .resolveConstraints === "function"
  );
}

/**
 * Normalize DI value to a single invocable function.
 * @param {unknown} value
 * @returns {ConstraintResolverFn|null}
 */
export function normalizeConstraintResolver(value) {
  if (typeof value === "function") {
    return /** @type {ConstraintResolverFn} */ (value);
  }
  if (
    value &&
    typeof value === "object" &&
    typeof /** @type {{ resolveConstraints?: unknown }} */ (value)
      .resolveConstraints === "function"
  ) {
    const port = /** @type {ConstraintResolverPort} */ (value);
    return (input) => port.resolveConstraints(input);
  }
  return null;
}

/**
 * Defensive shallow freeze of arrays/objects for resolver input.
 * Does not deep-freeze nested placement objects (callers still must not mutate).
 *
 * @param {ConstraintResolveInput} input
 * @returns {ConstraintResolveInput}
 */
export function freezeConstraintResolveInput(input) {
  return Object.freeze({
    placements: Object.freeze(
      (input.placements || []).map((p) => Object.freeze({ ...p }))
    ),
    candidates: Object.freeze(
      (input.candidates || []).map((c) => Object.freeze({ ...c }))
    ),
    groups: Object.freeze(
      (input.groups || []).map((g) => Object.freeze({ ...g }))
    ),
    brackets: Object.freeze(
      (input.brackets || []).map((b) => Object.freeze({ ...b }))
    ),
    byes: Object.freeze((input.byes || []).map((b) => Object.freeze({ ...b }))),
    unresolvedCandidates: Object.freeze(
      (input.unresolvedCandidates || []).map((c) => Object.freeze({ ...c }))
    ),
    decisionTrace: Object.freeze([...(input.decisionTrace || [])]),
    drawMode: input.drawMode,
    layoutType: input.layoutType,
    groupCount: input.groupCount,
    groupCapacity: input.groupCapacity,
    bracketSize: input.bracketSize,
    drawIdentityKey: input.drawIdentityKey,
    competitionId: input.competitionId,
    contextId: input.contextId,
    deterministicSeed: input.deterministicSeed,
    context: Object.freeze({ ...(input.context || {}) }),
    metadata: Object.freeze({ ...(input.metadata || {}) }),
    manualPlacements: Object.freeze(
      (input.manualPlacements || []).map((row) => Object.freeze({ ...row }))
    ),
    protectedPlacements: Object.freeze(
      (input.protectedPlacements || []).map((row) => Object.freeze({ ...row }))
    ),
  });
}
