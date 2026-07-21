/**
 * CORE-06 Phase 1F — Team Tournament V6 ↔ CORE-06 compatibility matrix.
 * Documentary data only. No TT runtime imports.
 *
 * classification:
 * - exact_match
 * - transform_required
 * - missing_legacy_field
 * - legacy_only_field
 * - canonical_only_field
 * - deferred_persistence
 */

export const TT_CORE06_COMPATIBILITY_MATRIX = Object.freeze([
  Object.freeze({
    concept: "tenant",
    ttField: "tenantId / club scope (product)",
    coreField: "tenantId",
    classification: "transform_required",
    notes: "TT often scopes via tournament/club; CORE-06 requires explicit tenantId",
  }),
  Object.freeze({
    concept: "competition",
    ttField: "tournamentId",
    coreField: "competitionId",
    classification: "transform_required",
    notes: "Rename + normalize; must be non-empty",
  }),
  Object.freeze({
    concept: "match_or_tie",
    ttField: "matchupId",
    coreField: "contextId",
    classification: "transform_required",
    notes: "matchupId maps to lineup contextId",
  }),
  Object.freeze({
    concept: "team",
    ttField: "teamId",
    coreField: "teamId",
    classification: "exact_match",
    notes: null,
  }),
  Object.freeze({
    concept: "lineup_identity",
    ttField: "implicit matchupId+teamId",
    coreField: "identityKey = competitionId::LINEUP::contextId::teamId",
    classification: "transform_required",
    notes: "CORE-06 builds deterministic key; reject ambiguity",
  }),
  Object.freeze({
    concept: "slot_identity",
    ttField: "discipline + index / selections",
    coreField: "slotId via buildLineupSlotId",
    classification: "transform_required",
    notes: null,
  }),
  Object.freeze({
    concept: "captain_manager_actor",
    ttField: "actorId + captain/manager role",
    coreField: "actorId / actorRole",
    classification: "exact_match",
    notes: "Authorization remains injected; role name alone never authorizes",
  }),
  Object.freeze({
    concept: "official_admin_actor",
    ttField: "BTC / referee",
    coreField: "actorRole + authorization port",
    classification: "transform_required",
    notes: "Format adapter supplies authz decisions",
  }),
  Object.freeze({
    concept: "roster_eligibility",
    ttField: "team roster snapshot",
    coreField: "rosterLookupPort / rosterVersion",
    classification: "deferred_persistence",
    notes: "CORE-05 owns roster SoT",
  }),
  Object.freeze({
    concept: "lineup_slots",
    ttField: "selections[]",
    coreField: "slots[]",
    classification: "transform_required",
    notes: "Normalize disciplineOrSideKey + index + person ref",
  }),
  Object.freeze({
    concept: "participant_references",
    ttField: "playerId",
    coreField: "person { kind, id }",
    classification: "transform_required",
    notes: "Default kind PLAYER_PROFILE when fixture provides opaque id",
  }),
  Object.freeze({
    concept: "submission_status",
    ttField: "submitted / not_submitted / draft",
    coreField: "DRAFT | SUBMITTED",
    classification: "transform_required",
    notes: "See LEGACY_LINEUP_STATUS_MAP",
  }),
  Object.freeze({
    concept: "lock_status",
    ttField: "locked",
    coreField: "LOCKED",
    classification: "exact_match",
    notes: null,
  }),
  Object.freeze({
    concept: "publish_reveal_state",
    ttField: "published / requiresRepublish / opponent null",
    coreField: "visibilityState + revealEligible (separate)",
    classification: "transform_required",
    notes: "Do not infer OPPONENT_VISIBLE from SUBMITTED/LOCKED",
  }),
  Object.freeze({
    concept: "deadline_timestamps",
    ttField: "lineupLockAt / server now flags",
    coreField: "opensAt/submitBy/lockAt/revealAt/graceUntil",
    classification: "transform_required",
    notes: "Injected policy timestamps; no client clock",
  }),
  Object.freeze({
    concept: "expectedVersion",
    ttField: "expectedVersion",
    coreField: "expectedVersion / revision",
    classification: "exact_match",
    notes: "Must not synthesize when policy requires",
  }),
  Object.freeze({
    concept: "idempotency_key",
    ttField: "idempotencyKey",
    coreField: "idempotencyKey + aggregate + command + fingerprint",
    classification: "transform_required",
    notes: "CORE-06 hardens contextual identity",
  }),
  Object.freeze({
    concept: "random_fallback_seed",
    ttField: "ownerSeed / randomize inputs",
    coreField: "seed + LineupRandomPort",
    classification: "transform_required",
    notes: "Phase 1D deterministic algorithm",
  }),
  Object.freeze({
    concept: "correction_reason",
    ttField: "override reason",
    coreField: "reason + allowsLockedCorrection policy",
    classification: "transform_required",
    notes: "Correction denied by default in CORE-06",
  }),
  Object.freeze({
    concept: "audit_source",
    ttField: "revision/audit writers",
    coreField: "LineupAuditMetadata / AuditPort",
    classification: "deferred_persistence",
    notes: "Production audit tables deferred",
  }),
  Object.freeze({
    concept: "canSaveDraft_flags",
    ttField: "canSaveDraft / canSubmit (server)",
    coreField: "deadline phase evaluation",
    classification: "legacy_only_field",
    notes: "Derived from timestamps in CORE-06; not stored as flags",
  }),
  Object.freeze({
    concept: "visibilityState",
    ttField: "(implicit via publish)",
    coreField: "PRIVATE…PUBLIC",
    classification: "canonical_only_field",
    notes: "Legacy has no explicit visibility enum",
  }),
  Object.freeze({
    concept: "revealEligible",
    ttField: "(implicit via publish + matchup state)",
    coreField: "revealEligible / revealPhase",
    classification: "canonical_only_field",
    notes: "Must not collapse with LOCKED",
  }),
  Object.freeze({
    concept: "command_fingerprint",
    ttField: "(absent)",
    coreField: "commandFingerprint / resultFingerprint",
    classification: "canonical_only_field",
    notes: "Not exposed to legacy by default",
  }),
]);

/**
 * @param {string} concept
 */
export function findCompatibilityRow(concept) {
  return (
    TT_CORE06_COMPATIBILITY_MATRIX.find((r) => r.concept === concept) || null
  );
}
