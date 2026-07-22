/**
 * CORE-12 Phase 1C-R — shadow-parity classification vocabulary + precedence.
 *
 * Classification precedence version: CORE12_PARITY_CLASSIFICATION_PRECEDENCE_V1
 *
 * A fixture yields exactly one finalClassification (lowest precedence rank that
 * applies). Findings may list supporting evidence in stable order; they do not
 * change the final classification selection algorithm.
 */

export const CORE12_PARITY_CLASSIFICATION_PRECEDENCE_V1 =
  "CORE12_PARITY_CLASSIFICATION_PRECEDENCE_V1";

export const PARITY_CLASSIFICATION = Object.freeze({
  /** Fixture definition itself is invalid / incomplete. */
  FIXTURE_INVALID: "FIXTURE_INVALID",
  /** Legacy data cannot safely map to a CORE-12 request without inference. */
  UNREPRESENTABLE_LEGACY_INPUT: "UNREPRESENTABLE_LEGACY_INPUT",
  /** Legacy produces an assignment that violates certified safety invariants. */
  LEGACY_UNSAFE: "LEGACY_UNSAFE",
  /** CORE-12 fails a case that should be valid under the certified Phase 1B contract. */
  CORE12_REGRESSION: "CORE12_REGRESSION",
  /** CORE-12 intentionally differs due to an approved divergence catalog entry. */
  INTENTIONAL_DIVERGENCE: "INTENTIONAL_DIVERGENCE",
  /** Same valid business outcome; differences only in ordering, diagnostics, or shape. */
  SEMANTIC_PARITY: "SEMANTIC_PARITY",
  /** Same match→court map and equivalent success/failure outcome. */
  EXACT_PARITY: "EXACT_PARITY",
});

export const PARITY_CLASSIFICATION_VALUES = Object.freeze(
  Object.values(PARITY_CLASSIFICATION)
);

/**
 * Lower rank = higher precedence (wins as finalClassification).
 */
export const PARITY_CLASSIFICATION_ORDER = Object.freeze({
  [PARITY_CLASSIFICATION.FIXTURE_INVALID]: 0,
  [PARITY_CLASSIFICATION.UNREPRESENTABLE_LEGACY_INPUT]: 1,
  [PARITY_CLASSIFICATION.LEGACY_UNSAFE]: 2,
  [PARITY_CLASSIFICATION.CORE12_REGRESSION]: 3,
  [PARITY_CLASSIFICATION.INTENTIONAL_DIVERGENCE]: 4,
  [PARITY_CLASSIFICATION.SEMANTIC_PARITY]: 5,
  [PARITY_CLASSIFICATION.EXACT_PARITY]: 6,
});

/**
 * Mutually exclusive entry conditions (first matching rule in precedence order wins).
 *
 * 1. FIXTURE_INVALID — fixtureInvalid flag or incomplete fixture definition.
 * 2. UNREPRESENTABLE_LEGACY_INPUT — adapter mapping failed (missing/ambiguous required data).
 *    Even if legacy would still assign (first-court fallback), final stays UNREPRESENTABLE;
 *    LEGACY_UNSAFE may appear as a supporting finding only.
 * 3. LEGACY_UNSAFE — legacy produces unsafe assignment while input was representable
 *    (or flagged legacyUnsafe with successful adapt for lock-gap double-book cases).
 * 4. CORE12_REGRESSION — expectCore12Valid and CORE-12 REJECTED/unexpected INFEASIBLE.
 * 5. INTENTIONAL_DIVERGENCE — catalog divergenceIds present, and/or ambiguous legacy ok
 *    heuristic with differing CORE-12 status semantics.
 * 6. SEMANTIC_PARITY — assignment maps equal (or equivalent business outcome) but
 *    status/diagnostic shape differs without catalog divergence; OR both reject differently;
 *    OR CORE-12 succeeds safely where legacy failed validation.
 * 7. EXACT_PARITY — maps equal and status-equivalent without divergence findings.
 */
export const PARITY_CLASSIFICATION_ENTRY_CONDITIONS = Object.freeze({
  version: CORE12_PARITY_CLASSIFICATION_PRECEDENCE_V1,
  rules: Object.freeze([
    Object.freeze({
      classification: PARITY_CLASSIFICATION.FIXTURE_INVALID,
      when: "fixtureInvalid === true OR fixture definition incomplete",
    }),
    Object.freeze({
      classification: PARITY_CLASSIFICATION.UNREPRESENTABLE_LEGACY_INPUT,
      when: "adapterOk === false (fail-closed mapping)",
    }),
    Object.freeze({
      classification: PARITY_CLASSIFICATION.LEGACY_UNSAFE,
      when: "legacyUnsafe === true AND adapterOk === true (representable but unsafe legacy outcome)",
    }),
    Object.freeze({
      classification: PARITY_CLASSIFICATION.CORE12_REGRESSION,
      when: "expectCore12Valid === true AND CORE-12 status is REJECTED or unexpected INFEASIBLE",
    }),
    Object.freeze({
      classification: PARITY_CLASSIFICATION.INTENTIONAL_DIVERGENCE,
      when: "divergenceIds non-empty OR legacy PARTIAL_REPORTED_OK ambiguous heuristic",
    }),
    Object.freeze({
      classification: PARITY_CLASSIFICATION.SEMANTIC_PARITY,
      when: "maps equal with status/shape differences OR equivalent business outcome without exact status alignment",
    }),
    Object.freeze({
      classification: PARITY_CLASSIFICATION.EXACT_PARITY,
      when: "maps equal AND status-equivalent AND no higher-precedence signal",
    }),
  ]),
});

/**
 * Resolve the single final classification from candidate set using precedence.
 * @param {Iterable<string>} candidates
 * @returns {string}
 */
export function resolveFinalParityClassification(candidates) {
  let best = PARITY_CLASSIFICATION.EXACT_PARITY;
  let bestRank = PARITY_CLASSIFICATION_ORDER[best];
  for (const c of candidates) {
    const rank = PARITY_CLASSIFICATION_ORDER[c];
    if (rank == null) continue;
    if (rank < bestRank) {
      best = c;
      bestRank = rank;
    }
  }
  return best;
}
