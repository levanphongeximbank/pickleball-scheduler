import { FORMATION_CONSTRAINT_KIND } from "../formationConstants.js";
import { mapLegacyFormationConstraintKind } from "../legacyFormationMapping.js";

/**
 * @typedef {Object} FormationConstraintParityResult
 * @property {boolean} ok
 * @property {boolean} hardDecisionMismatch
 * @property {boolean} softScoreMismatch
 * @property {string[]} constraintMissing
 * @property {string[]} constraintDoubleCount
 * @property {string[]} unsupportedConstraint
 * @property {string[]} warnings
 */

const AUDITED_CONSTRAINT_KINDS = Object.values(FORMATION_CONSTRAINT_KIND).filter(
  (k) => k !== "custom"
);

/**
 * Compare constraint metadata between legacy payload and canonical request.
 * Does NOT alter legacy constraint decisions.
 *
 * @param {Object} input
 * @param {import('./legacyFormationPayloadMappers.js').LegacyFormationPayload} input.legacyPayload
 * @param {import('../formationTypes.js').FormationRequest} [input.formationRequest]
 */
export function compareFormationConstraintParity(input = {}) {
  const legacyConstraints = input.legacyPayload?.constraints || [];
  const canonicalConstraints = input.formationRequest?.constraints || [];

  const legacyKinds = legacyConstraints.map((c) =>
    mapLegacyFormationConstraintKind(c.kind || c.type)
  );
  const canonicalKinds = canonicalConstraints.map((c) => c.kind);

  /** @type {string[]} */
  const constraintMissing = [];
  /** @type {string[]} */
  const constraintDoubleCount = [];
  /** @type {string[]} */
  const unsupportedConstraint = [];
  /** @type {string[]} */
  const warnings = [];

  for (const kind of legacyKinds) {
    const count = canonicalKinds.filter((k) => k === kind).length;
    if (count === 0) {
      constraintMissing.push(kind);
    } else if (count > 1) {
      constraintDoubleCount.push(kind);
    }
    if (!AUDITED_CONSTRAINT_KINDS.includes(kind) && kind !== "custom") {
      unsupportedConstraint.push(kind);
      warnings.push(`unsupportedConstraint:${kind}`);
    }
  }

  for (const constraint of legacyConstraints) {
    if (constraint.kind === "must_partner" || constraint.type === "must_partner") {
      const params = constraint.params || constraint;
      if (params.playerA && params.playerB) {
        warnings.push(`must_partner:${params.playerA}+${params.playerB}`);
      }
    }
    if (constraint.kind === "must_not_partner" || constraint.type === "avoid_partner") {
      warnings.push("must_not_partner:evaluated");
    }
  }

  const hardDecisionMismatch = constraintMissing.some((k) =>
    ["must_partner", "must_not_partner", "manual_lock", "gender", "check_in"].includes(k)
  );

  return {
    ok: constraintMissing.length === 0 && constraintDoubleCount.length === 0,
    hardDecisionMismatch,
    softScoreMismatch: false,
    constraintMissing,
    constraintDoubleCount,
    unsupportedConstraint,
    warnings,
  };
}
