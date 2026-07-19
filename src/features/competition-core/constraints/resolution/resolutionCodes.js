/**
 * Resolution / suppression reason codes — CORE-01.
 * Additive to RULE_ERROR_CODE; used in resolution traces.
 */

export const RULE_RESOLUTION_REASON = Object.freeze({
  SELECTED: "rule_selected",
  DISABLED: "rule_disabled",
  INVALID: "rule_invalid",
  OPERATION_MISMATCH: "rule_operation_mismatch",
  OPERATION_UNSUPPORTED: "rule_operation_unsupported",
  SCOPE_MISMATCH: "rule_scope_mismatch",
  TENANT_MISMATCH: "rule_tenant_mismatch",
  COMPETITION_MISMATCH: "rule_competition_mismatch",
  APPLICABILITY_MISMATCH: "rule_applicability_mismatch",
  SUPPRESSED_BY_HIGHER_AUTHORITY: "rule_suppressed_by_higher_authority",
  /** @deprecated Prefer RULE_RESOLUTION_AMBIGUOUS — kept for trace continuity. */
  UNRESOLVABLE_AUTHORITY_TIE: "rule_unresolvable_authority_tie",
  /**
   * Only when normalized identities cannot be totally ordered
   * (e.g. conflicting rules share the same empty/identical id after normalize).
   * Equal sourcePriority/priority/version/updatedAt with distinct valid ids is NOT ambiguous.
   */
  RULE_RESOLUTION_AMBIGUOUS: "rule_resolution_ambiguous",
  TENANT_CONTEXT_REQUIRED: "rule_tenant_context_required",
  COMPETITION_CONTEXT_REQUIRED: "rule_competition_context_required",
  FLAG_OFF_PASSTHROUGH: "rules_v2_flag_off_passthrough",
});
