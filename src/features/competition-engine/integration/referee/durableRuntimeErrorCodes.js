/**
 * Durable referee runtime denial codes (implementation layer).
 *
 * Not part of CompetitionRefereeAdapterContract v1 / Contract #08 frozen
 * identifiers in ./constants.js. Product paths deny direct referee_assignments
 * table DML; CORE-13 remains the sole assignment mutation authority.
 */

export const REFEREE_DURABLE_RUNTIME_ERROR_CODE = Object.freeze({
  DIRECT_ASSIGNMENT_MUTATION_FORBIDDEN:
    "REFEREE_ADAPTER_DIRECT_ASSIGNMENT_MUTATION_FORBIDDEN",
});

export const DIRECT_ASSIGNMENT_MUTATION_FORBIDDEN =
  REFEREE_DURABLE_RUNTIME_ERROR_CODE.DIRECT_ASSIGNMENT_MUTATION_FORBIDDEN;
