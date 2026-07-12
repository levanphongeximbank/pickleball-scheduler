/**
 * Canonical V5 rating foundation — 9 tables (staging migration 9/9).
 * Single source for docs and audits.
 */
export const V5_FOUNDATION_TABLES = Object.freeze([
  Object.freeze({
    table_name: "player_rating_profiles",
    purpose: "V5 canonical rating profile per player/mode (shadow by default)",
    write_authority: "service RPC / rating_v5_complete_assessment only",
    rls_mode: "SELECT own/reviewer; INSERT/UPDATE/DELETE denied to authenticated",
    append_only: false,
    shadow_impact: "is_shadow=true default; excluded from leaderboard index",
  }),
  Object.freeze({
    table_name: "player_skill_assessments",
    purpose: "Questionnaire sessions with server-computed scores on complete",
    write_authority: "PLAYER draft insert/update; complete via SECURITY DEFINER RPC",
    rls_mode: "SELECT own/reviewer; INSERT/UPDATE draft only without computed fields",
    append_only: false,
    shadow_impact: "is_shadow=true default; rollout_cohort stamped",
  }),
  Object.freeze({
    table_name: "player_rating_events",
    purpose: "Append-only rating change ledger (assessment, match, evidence)",
    write_authority: "engine RPC only (rating_v5_complete_assessment, match engine)",
    rls_mode: "SELECT own/reviewer; INSERT/UPDATE/DELETE denied to authenticated",
    append_only: true,
    shadow_impact: "is_shadow=true default on assessment events",
  }),
  Object.freeze({
    table_name: "rating_evidence",
    purpose: "Court/coach/external evidence submissions pending review",
    write_authority: "PLAYER insert level≤3; reviewer RPC for approve",
    rls_mode: "SELECT own; INSERT self pending; UPDATE denied to authenticated",
    append_only: false,
    shadow_impact: "is_shadow=true default",
  }),
  Object.freeze({
    table_name: "rating_snapshots",
    purpose: "Periodic profile snapshots for audit/rollback",
    write_authority: "service_role / technician RPC only",
    rls_mode: "ALL denied to authenticated",
    append_only: false,
    shadow_impact: "is_shadow=true default",
  }),
  Object.freeze({
    table_name: "rating_review_cases",
    purpose: "Anomaly and verification review workflow",
    write_authority: "reviewer RPC only",
    rls_mode: "SELECT own/reviewer; write denied to authenticated",
    append_only: false,
    shadow_impact: "is_shadow=true default",
  }),
  Object.freeze({
    table_name: "rating_calibration_versions",
    purpose: "Versioned calibration parameters (weights, gates, MAE targets)",
    write_authority: "rating_v5.calibration_manage permission",
    rls_mode: "SELECT pilot/approved or manage; write manage only",
    append_only: false,
    shadow_impact: "none — config only",
  }),
  Object.freeze({
    table_name: "rating_v5_rollout_config",
    purpose: "Shadow mode and pilot cohort flags (no hard-coded user IDs)",
    write_authority: "rating_v5.calibration_manage permission",
    rls_mode: "SELECT authenticated; write manage only",
    append_only: false,
    shadow_impact: "shadow_mode_enabled, compare_v2_enabled defaults",
  }),
  Object.freeze({
    table_name: "rating_v5_idempotency",
    purpose: "RPC idempotency keys for safe retries",
    write_authority: "service_role / SECURITY DEFINER RPC only",
    rls_mode: "ALL denied to authenticated",
    append_only: false,
    shadow_impact: "none",
  }),
]);

export const V5_FOUNDATION_TABLE_NAMES = V5_FOUNDATION_TABLES.map((t) => t.table_name);

export function getV5TableRegistryEntry(tableName) {
  return V5_FOUNDATION_TABLES.find((t) => t.table_name === tableName) ?? null;
}
