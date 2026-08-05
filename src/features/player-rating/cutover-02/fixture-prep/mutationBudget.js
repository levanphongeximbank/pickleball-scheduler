/**
 * Predicted durable write-count model for A3c fixture preparation.
 * No mutations are executed by this module itself.
 */

import { FIXTURE_CANDIDATES } from "./fixtureManifest.js";
import { MUTATION_BUDGET } from "./constants.js";

/**
 * Per-candidate first successful PREPARE (transaction categories).
 *
 * Tx1 enrollment upsert (new cohort only): +1 enrollment row
 * Tx2 V2 pick_vn_sync_rating upsert: +1 V2 primary row (when prior count 0)
 * Tx3 V5 draft assessment insert: +1 assessment
 * Tx4 persist completion: +1 assessment update (not a new row), +1 event, +1 profile
 * Tx5 prep audit insert: +1 audit
 *
 * Retry ALREADY_PREPARED: +1 bounded idempotent-attempt audit only (optional).
 */
export function buildPerCandidateWriteModel() {
  return Object.freeze({
    enrollment_rows: { min: 1, max: 1, notes: "exact new cohort upsert" },
    v2_primary_rows: { min: 0, max: 1, notes: "0 if already present identical; max 1 create/upsert" },
    v5_assessment_rows: { min: 1, max: 1, notes: "one draft created then completed" },
    v5_assessment_updates: { min: 1, max: 1, notes: "status draft→completed (update, counted in evidence budget)" },
    v5_event_rows: { min: 1, max: 1, notes: "assessment_complete questionnaire event" },
    v5_profile_rows: { min: 1, max: 1, notes: "shadow profile upsert" },
    prep_audit_rows: { min: 1, max: 1, notes: "durable prep audit / evidence" },
    idempotent_attempt_audit_rows: {
      min: 0,
      max: 1,
      notes: "only on identical retry; bounded",
    },
  });
}

export function buildCohortWriteModel() {
  const n = FIXTURE_CANDIDATES.length;
  const per = buildPerCandidateWriteModel();

  const firstRunMin =
    n * (per.enrollment_rows.min +
      per.v5_assessment_rows.min +
      per.v5_event_rows.min +
      per.v5_profile_rows.min +
      per.prep_audit_rows.min);
  // V2 may already exist → min can exclude V2; include assessment updates in evidence budget
  const firstRunMax =
    n *
    (per.enrollment_rows.max +
      per.v2_primary_rows.max +
      per.v5_assessment_rows.max +
      per.v5_event_rows.max +
      per.v5_profile_rows.max +
      per.prep_audit_rows.max);

  // Assessment updates are durable writes but not new rows — counted in evidence budget
  const evidenceRowsMin = n * (per.v5_assessment_rows.min + per.v5_event_rows.min + per.prep_audit_rows.min);
  const evidenceRowsMax =
    n *
    (per.v5_assessment_rows.max +
      per.v5_assessment_updates.max +
      per.v5_event_rows.max +
      per.prep_audit_rows.max +
      per.idempotent_attempt_audit_rows.max);

  const totalMin = firstRunMin;
  const totalMax = firstRunMax + n * per.idempotent_attempt_audit_rows.max;

  const requiresOwnerRevision =
    totalMax > MUTATION_BUDGET.TOTAL_DURABLE_WRITE_CEILING ||
    evidenceRowsMax > MUTATION_BUDGET.V5_ASSESSMENT_EVENT_EVIDENCE_ROWS_MAX;

  return Object.freeze({
    candidateCount: n,
    perCandidate: per,
    hardCeilings: MUTATION_BUDGET,
    expected: Object.freeze({
      enrollment_rows: { min: n, max: n },
      v2_primary_rows: { min: 0, max: n },
      v5_profile_rows: { min: n, max: n },
      v5_assessment_event_evidence_rows: { min: evidenceRowsMin, max: evidenceRowsMax },
      total_durable_writes_first_run: { min: totalMin, max: firstRunMax },
      total_durable_writes_with_one_idempotent_retry_each: {
        min: totalMin,
        max: totalMax,
      },
    }),
    transactionByTransaction: Object.freeze([
      Object.freeze({
        tx: "TX1_ENROLLMENT",
        perCandidateWrites: 1,
        cohortMax: n,
        tables: ["rating_v5_pilot_enrollments"],
      }),
      Object.freeze({
        tx: "TX2_V2_SYNC",
        perCandidateWrites: 1,
        cohortMax: n,
        tables: ["pick_vn_player_ratings"],
      }),
      Object.freeze({
        tx: "TX3_V5_DRAFT_ASSESSMENT",
        perCandidateWrites: 1,
        cohortMax: n,
        tables: ["player_skill_assessments"],
      }),
      Object.freeze({
        tx: "TX4_V5_PERSIST_COMPLETION",
        perCandidateWrites: 3,
        cohortMax: n * 3,
        notes: "assessment update + event insert + profile upsert",
        tables: [
          "player_skill_assessments",
          "player_rating_events",
          "player_rating_profiles",
        ],
      }),
      Object.freeze({
        tx: "TX5_PREP_AUDIT",
        perCandidateWrites: 1,
        cohortMax: n,
        tables: ["rating_v5_cutover_02_fixture_prep_audit"],
      }),
    ]),
    AUTH_USER_CREATIONS: 0,
    PROFILE_CREATIONS: 0,
    ROLLOUT_CONFIG_CHANGES: 0,
    CURRENT_PHASE4_PILOT_CHANGES: 0,
    TOTAL_DURABLE_WRITE_CEILING: MUTATION_BUDGET.TOTAL_DURABLE_WRITE_CEILING,
    MUTATION_BUDGET_REQUIRES_OWNER_REVISION: requiresOwnerRevision,
    excludeNonDurable: [
      "console logs",
      "Edge request logs without DB insert",
      "in-memory evidence sinks",
    ],
  });
}

/**
 * Enforce running write tally against hard ceilings.
 * @param {{
 *   enrollmentRows?: number,
 *   v2PrimaryRows?: number,
 *   v5ProfileRows?: number,
 *   evidenceRows?: number,
 *   totalDurableWrites?: number,
 *   authUserCreations?: number,
 *   profileCreations?: number,
 *   rolloutConfigChanges?: number,
 *   phase4PilotChanges?: number,
 * }} tally
 */
export function evaluateMutationBudget(tally = {}) {
  const model = buildCohortWriteModel();
  const violations = [];

  const checks = [
    ["authUserCreations", MUTATION_BUDGET.AUTH_USER_CREATIONS],
    ["profileCreations", MUTATION_BUDGET.PROFILE_CREATIONS],
    ["rolloutConfigChanges", MUTATION_BUDGET.ROLLOUT_CONFIG_CHANGES],
    ["phase4PilotChanges", MUTATION_BUDGET.CURRENT_PHASE4_PILOT_CHANGES],
    ["enrollmentRows", MUTATION_BUDGET.ENROLLMENT_ROWS_MAX],
    ["v2PrimaryRows", MUTATION_BUDGET.V2_PRIMARY_ROWS_MAX],
    ["v5ProfileRows", MUTATION_BUDGET.V5_PROFILE_ROWS_MAX],
    ["evidenceRows", MUTATION_BUDGET.V5_ASSESSMENT_EVENT_EVIDENCE_ROWS_MAX],
    ["totalDurableWrites", MUTATION_BUDGET.TOTAL_DURABLE_WRITE_CEILING],
  ];

  for (const [key, ceiling] of checks) {
    const value = Number(tally[key] ?? 0);
    if (value > ceiling) {
      violations.push({ key, value, ceiling });
    }
  }

  return {
    ok: violations.length === 0,
    violations,
    model,
  };
}
