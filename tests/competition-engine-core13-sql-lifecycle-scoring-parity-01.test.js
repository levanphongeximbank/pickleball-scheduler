/**
 * CORE-13 SQL lifecycle / scoring parity (durable mutation boundary).
 * Static package tests plus JS classifier/gate parity. No Staging mutation.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  ASSIGNMENT_COMMAND,
  ASSIGNMENT_COMMAND_ERROR_CODE,
  ASSIGNMENT_LIFECYCLE_STATE,
  CANONICAL_SCORING_COMMAND_TYPES,
  EVENT_SEQUENCE_ALONE_AS_SCORING_ACTIVE,
  SCORING_ACTIVE_REFINEMENT_ONLY_FOR_IN_PROGRESS,
  classifyCanonicalScoringActivity,
  evaluateAssignmentLifecycleGate,
} from "../src/features/competition-engine/operations/referee/assignment/index.js";
import { CANONICAL_SCORING_DOMAIN_EVENT_TYPES } from "../src/features/competition-engine/operations/referee/assignment/classifyCanonicalScoringActivity.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SQL_PKG = path.join(
  ROOT,
  "docs/v5/migrations/core13-canonical-assignment-runtime-closure-01"
);
const PRE_APPLY_FUNCTION_DEFINITION_SHA256 =
  "d0b889c963a73b9c1eefeebed2857e8b05060bff145634006fa3caad944f2345";

function readSql(name) {
  return readFileSync(path.join(SQL_PKG, name), "utf8").replace(/\r\n/g, "\n");
}

function extractBoundary(sql) {
  const start = sql.indexOf(
    "create or replace function public.competition_assignment_assert_mutation_boundary("
  );
  assert.ok(start >= 0, "boundary function missing");
  const next = sql.indexOf("\ncreate or replace function", start + 1);
  const revoke = sql.indexOf(
    "revoke all on function public.competition_assignment_assert_mutation_boundary",
    start
  );
  const end = next >= 0 && (revoke < 0 || next < revoke) ? next : revoke >= 0 ? revoke : sql.length;
  return sql.slice(start, end);
}

const apply = readSql("02_APPLY.sql");
const surgical = readSql("06_STAGING_SURGICAL_LIFECYCLE_SCORING_PARITY.sql");
const rollback = readSql("07_STAGING_SURGICAL_LIFECYCLE_SCORING_PARITY_ROLLBACK.sql");
const evidence = readSql("EVIDENCE_STAGING_LIFECYCLE_SCORING_PARITY.md");
const applyBoundary = extractBoundary(apply);
const surgicalBoundary = extractBoundary(surgical);

function gate(command, lifecycle, extra = {}) {
  return evaluateAssignmentLifecycleGate({
    command,
    lifecycleState: lifecycle,
    emergencyReplacement: extra.emergencyReplacement === true,
    emergencyAuthorized: extra.emergencyAuthorized === true,
  });
}

test("SQL1. canonical SQL no longer treats last_event_sequence > 0 alone as scoring active", () => {
  assert.equal(EVENT_SEQUENCE_ALONE_AS_SCORING_ACTIVE, "DENY");
  assert.doesNotMatch(applyBoundary, /coalesce\(\s*v_live\.last_event_sequence/i);
  assert.doesNotMatch(surgicalBoundary, /coalesce\(\s*v_live\.last_event_sequence/i);
  assert.match(
    applyBoundary,
    /last_event_sequence > 0 alone is NOT scoring evidence/
  );
  assert.match(rollback, /coalesce\(v_live\.last_event_sequence, 0\) > 0/);
});

test("SQL2. START_MATCH-only conceptual state is IN_PROGRESS, not scoring", () => {
  assert.doesNotMatch(applyBoundary, /'START_MATCH'/);
  assert.doesNotMatch(applyBoundary, /'START_TIMEOUT'/);
  assert.doesNotMatch(applyBoundary, /'PAUSE_MATCH'/);
  assert.doesNotMatch(applyBoundary, /'SWITCH_ENDS'/);
  const evidenceJs = classifyCanonicalScoringActivity({
    liveRow: {
      status: "in_progress",
      last_event_sequence: 1,
      team_a_score: 0,
      team_b_score: 0,
    },
    events: [{ command_type: "START_MATCH", event_type: "START_MATCH", generated_events: ["START_MATCH"] }],
  });
  assert.equal(evidenceJs.scoringActive, false);
});

test("SQL3. score >0 is SCORING_ACTIVE", () => {
  assert.match(applyBoundary, /coalesce\(v_live\.team_a_score, 0\) > 0/);
  assert.match(applyBoundary, /coalesce\(v_live\.team_b_score, 0\) > 0/);
  const evidenceJs = classifyCanonicalScoringActivity({
    liveRow: { status: "in_progress", last_event_sequence: 2, team_a_score: 1, team_b_score: 0 },
    events: [],
  });
  assert.equal(evidenceJs.scoringActive, true);
});

test("SQL4. TEAM_A_WON_RALLY history at score 0-0 is SCORING_ACTIVE", () => {
  assert.match(applyBoundary, /TEAM_A_WON_RALLY/);
  const evidenceJs = classifyCanonicalScoringActivity({
    liveRow: { status: "in_progress", last_event_sequence: 2, team_a_score: 0, team_b_score: 0 },
    events: [{ command_type: "TEAM_A_WON_RALLY", generated_events: ["POINT_AWARDED"] }],
  });
  assert.equal(evidenceJs.scoringActive, true);
});

test("SQL5. TEAM_B_WON_RALLY history is SCORING_ACTIVE", () => {
  assert.match(applyBoundary, /TEAM_B_WON_RALLY/);
  const evidenceJs = classifyCanonicalScoringActivity({
    liveRow: { status: "in_progress", last_event_sequence: 2, team_a_score: 0, team_b_score: 0 },
    events: [{ command_type: "TEAM_B_WON_RALLY" }],
  });
  assert.equal(evidenceJs.scoringActive, true);
});

test("SQL6-8. scoring EXISTS is bound to authoritative live tenant+tournament+match", () => {
  assert.match(applyBoundary, /me\.tenant_id = v_live\.tenant_id/);
  assert.match(applyBoundary, /me\.tournament_id = v_live\.tournament_id/);
  assert.match(applyBoundary, /me\.match_id = v_live\.match_id/);
  assert.doesNotMatch(
    applyBoundary.slice(applyBoundary.indexOf("from public.match_events")),
    /me\.tenant_id = p_tenant_id/
  );
});

test("SQL9. COMPLETED precedence preserved", () => {
  assert.match(
    applyBoundary,
    /v_lifecycle not in \('COMPLETED', 'LOCKED'\)/
  );
  assert.match(
    applyBoundary,
    /v_mu\.status = 'locked' and v_lifecycle is distinct from 'COMPLETED'/
  );
});

test("SQL10. LOCKED precedence preserved", () => {
  assert.match(
    applyBoundary,
    /if v_lifecycle is distinct from 'COMPLETED' then\s+v_lifecycle := 'LOCKED'/
  );
  assert.match(
    applyBoundary,
    /SCORING_ACTIVE may only refine an otherwise IN_PROGRESS live row/
  );
  assert.equal(SCORING_ACTIVE_REFINEMENT_ONLY_FOR_IN_PROGRESS, "YES");
});

test("SQL11. IN_PROGRESS replace allowed", () => {
  const result = gate(ASSIGNMENT_COMMAND.REPLACE, ASSIGNMENT_LIFECYCLE_STATE.IN_PROGRESS);
  assert.equal(result.ok, true);
  assert.match(applyBoundary, /if v_lifecycle = 'IN_PROGRESS'/);
  assert.match(applyBoundary, /IN_PROGRESS forbids new assignment \(use atomic replace\)/);
  assert.doesNotMatch(applyBoundary, /IN_PROGRESS requires explicit emergencyReplacement/);
});

test("SQL12. IN_PROGRESS assign denied", () => {
  const result = gate(ASSIGNMENT_COMMAND.ASSIGN, ASSIGNMENT_LIFECYCLE_STATE.IN_PROGRESS);
  assert.equal(result.ok, false);
  assert.match(applyBoundary, /IN_PROGRESS forbids new assignment/);
});

test("SQL13. IN_PROGRESS unassign denied", () => {
  const result = gate(ASSIGNMENT_COMMAND.UNASSIGN, ASSIGNMENT_LIFECYCLE_STATE.IN_PROGRESS);
  assert.equal(result.ok, false);
  assert.equal(result.code, ASSIGNMENT_COMMAND_ERROR_CODE.UNASSIGN_WITHOUT_REPLACEMENT_DENIED);
  assert.match(applyBoundary, /IN_PROGRESS forbids unassign without replacement/);
});

test("SQL14. SCORING_ACTIVE normal replace requires emergency", () => {
  const result = gate(ASSIGNMENT_COMMAND.REPLACE, ASSIGNMENT_LIFECYCLE_STATE.SCORING_ACTIVE);
  assert.equal(result.ok, false);
  assert.equal(result.code, ASSIGNMENT_COMMAND_ERROR_CODE.EMERGENCY_REPLACEMENT_REQUIRED);
  assert.match(applyBoundary, /EMERGENCY_REPLACEMENT_REQUIRED/);
});

test("SQL15. SCORING_ACTIVE authorized emergency replacement allowed", () => {
  const result = gate(
    ASSIGNMENT_COMMAND.REPLACE,
    ASSIGNMENT_LIFECYCLE_STATE.SCORING_ACTIVE,
    { emergencyReplacement: true, emergencyAuthorized: true }
  );
  assert.equal(result.ok, true);
  assert.match(
    applyBoundary,
    /v_op = 'REPLACE' and coalesce\(p_emergency_replacement, false\) is not true/
  );
});

test("SQL16. SQL classifier semantics match JS classifier semantics", () => {
  for (const type of CANONICAL_SCORING_COMMAND_TYPES) {
    assert.match(applyBoundary, new RegExp(type));
    assert.match(surgicalBoundary, new RegExp(type));
  }
  for (const type of CANONICAL_SCORING_DOMAIN_EVENT_TYPES) {
    assert.match(applyBoundary, new RegExp(type));
  }
  assert.deepEqual(CANONICAL_SCORING_COMMAND_TYPES, [
    "TEAM_A_WON_RALLY",
    "TEAM_B_WON_RALLY",
  ]);
  assert.deepEqual(CANONICAL_SCORING_DOMAIN_EVENT_TYPES, ["POINT_AWARDED"]);
});

test("surgical patch is CREATE OR REPLACE of the target function only", () => {
  assert.equal(surgicalBoundary.trim(), applyBoundary.trim());
  assert.match(surgical, /TARGET_PROJECT=qyewbxjsiiyufanzcjcq/);
  assert.match(surgical, /FULL_02_APPLY_REEXECUTION=DENY/);
  assert.equal(
    [...surgical.matchAll(/create or replace function/gi)].length,
    1
  );
  assert.doesNotMatch(surgical, /create table/i);
  assert.doesNotMatch(surgical, /\binsert\s+into\b/i);
  assert.doesNotMatch(surgical, /\bupdate\s+public\./i);
  assert.doesNotMatch(surgical, /\bdelete\s+from\b/i);
  assert.doesNotMatch(surgical, /grant execute[\s\S]*to authenticated/i);
  assert.doesNotMatch(surgical, /grant execute[\s\S]*to anon/i);
  assert.doesNotMatch(surgical, /grant execute[\s\S]*to public/i);
  assert.match(surgical, /language plpgsql/i);
  assert.match(surgical, /\bstable\b/i);
  assert.match(surgical, /security definer/i);
  assert.match(surgical, /set search_path = public/);
});

test("rollback restores exact pre-apply pg_get_functiondef hash", () => {
  const start = rollback.indexOf("CREATE OR REPLACE FUNCTION");
  assert.ok(start >= 0);
  const def = rollback.slice(start);
  const sha = createHash("sha256").update(def, "utf8").digest("hex");
  assert.equal(sha, PRE_APPLY_FUNCTION_DEFINITION_SHA256);
  assert.match(evidence, new RegExp(PRE_APPLY_FUNCTION_DEFINITION_SHA256));
  assert.match(rollback, /ROLLBACK_EXECUTION_GO=NO/);
});
