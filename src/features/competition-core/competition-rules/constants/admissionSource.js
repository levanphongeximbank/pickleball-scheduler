/**
 * Knockout admission source tags — execution composition vocabulary.
 * Distinct from DIRECT_KNOCKOUT_ENTRY_SOURCE (policy origin category).
 *
 * Precedence (canonical competition rules semantic policy):
 *   DIRECT > GROUP_DIRECT > WILDCARD
 */

export const ADMISSION_SOURCE = Object.freeze({
  DIRECT: "DIRECT",
  GROUP_DIRECT: "GROUP_DIRECT",
  WILDCARD: "WILDCARD",
});

export const ADMISSION_SOURCE_PRECEDENCE = Object.freeze([
  ADMISSION_SOURCE.DIRECT,
  ADMISSION_SOURCE.GROUP_DIRECT,
  ADMISSION_SOURCE.WILDCARD,
]);

/**
 * Canonical semantic locks for admission-source consumption.
 * Competition Engine must not invent or own these rules.
 */
export const ADMISSION_SOURCE_SEMANTICS = Object.freeze({
  DIRECT_PRECEDENCE_OVER_GROUP_DIRECT: true,
  DIRECT_PRECEDENCE_OVER_WILDCARD: true,
  GROUP_DIRECT_PRECEDENCE_OVER_WILDCARD: true,
  DIRECT_CONSUMES_GROUP_DIRECT_SLOT: false,
  DIRECT_CONSUMES_WILDCARD_SLOT: false,
  NEXT_ELIGIBLE_GROUP_BACKFILL: true,
  NEXT_ELIGIBLE_WILDCARD_BACKFILL: true,
  BYPASS_IMPLIES_DIRECT: false,
  DIRECT_ENTRY_IMPLIES_BYPASS: false,
  UNRESOLVED_DIRECT_SLOT_EXECUTION: "DENY",
  LATER_STAGE_DIRECT_ENTRY_EXECUTION: "DEFERRED",
  FAKE_BYE_WINNER: "DENY",
  PHANTOM_RESULT: "DENY",
  NEW_BYE_ENGINE: "DENY",
});
