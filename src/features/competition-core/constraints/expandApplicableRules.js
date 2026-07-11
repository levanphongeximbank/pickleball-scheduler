/**
 * @typedef {import('../types/index.js').ConstraintDefinition} ConstraintDefinition
 * @typedef {import('../types/index.js').ConstraintContext} ConstraintContext
 * @typedef {import('../types/index.js').ConstraintApplicability} ConstraintApplicability
 */

function parseTime(value) {
  if (!value) {
    return null;
  }
  const time = Date.parse(String(value));
  return Number.isFinite(time) ? time : null;
}

function matchesField(expected, actual) {
  if (expected == null || expected === "") {
    return true;
  }
  return String(expected) === String(actual ?? "");
}

function matchesRange(value, min, max) {
  if (value == null || Number.isNaN(Number(value))) {
    return min == null && max == null;
  }
  const numeric = Number(value);
  if (min != null && numeric < Number(min)) {
    return false;
  }
  if (max != null && numeric > Number(max)) {
    return false;
  }
  return true;
}

/**
 * @param {ConstraintApplicability|undefined} applicability
 * @param {ConstraintContext} context
 * @returns {boolean}
 */
export function isRuleApplicable(applicability, context) {
  if (!applicability || typeof applicability !== "object") {
    return true;
  }

  const evaluatedAt = parseTime(context.evaluatedAt) ?? Date.now();
  const effectiveFrom = parseTime(applicability.effectiveFrom);
  const effectiveTo = parseTime(applicability.effectiveTo);

  if (effectiveFrom != null && effectiveFrom > evaluatedAt) {
    return false;
  }
  if (effectiveTo != null && effectiveTo < evaluatedAt) {
    return false;
  }

  return (
    matchesField(applicability.tenantId, context.tenantId) &&
    matchesField(applicability.clubId, context.clubId) &&
    matchesField(applicability.tournamentId, context.tournamentId) &&
    matchesField(applicability.eventId, context.eventId) &&
    matchesField(applicability.sessionId, context.sessionId) &&
    matchesField(applicability.venueId, context.venueId) &&
    matchesField(applicability.competitionType, context.competitionType) &&
    matchesField(applicability.gender, context.gender) &&
    matchesField(applicability.ageGroup, context.ageGroup) &&
    matchesRange(context.skillMin, applicability.skillMin, applicability.skillMax)
  );
}

/**
 * Filter constraints to those applicable in the current context.
 *
 * @param {ConstraintDefinition[]} constraints
 * @param {ConstraintContext} context
 * @returns {ConstraintDefinition[]}
 */
export function expandApplicableRules(constraints = [], context) {
  return (constraints || []).filter((constraint) => {
    if (constraint?.enabled === false) {
      return false;
    }
    if (constraint.scope && constraint.scope !== context.scope) {
      return false;
    }
    return isRuleApplicable(constraint.applicability, context);
  });
}
