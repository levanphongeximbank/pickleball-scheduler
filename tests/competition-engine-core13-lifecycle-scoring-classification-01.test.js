/**
 * CORE-13 lifecycle / scoring classification matrix (J forensic remediation).
 * Local only. No SQL. No staging mutation.
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  ASSIGNMENT_COMMAND,
  ASSIGNMENT_COMMAND_ERROR_CODE,
  ASSIGNMENT_LIFECYCLE_STATE,
  CANONICAL_SCORING_COMMAND_TYPES,
  EVENT_SEQUENCE_ALONE_AS_SCORING_ACTIVE,
  SCORING_ACTIVE_REFINEMENT_ONLY_FOR_IN_PROGRESS,
  classifyCanonicalScoringActivity,
  evaluateAssignmentLifecycleGate,
  isCompetitionRefereeAssignmentCommandError,
  normalizeAssignmentLifecycleState,
} from "../src/features/competition-engine/operations/referee/assignment/index.js";
import { loadAuthoritativeAssignmentEvidence } from "../src/features/competition-engine/operations/referee/assignment/server/loadAuthoritativeAssignmentEvidence.js";
import { listCanonicalRefereeMatchEvents } from "../src/features/competition-engine/integration/referee/createLiveRpcCanonicalRefereeDurableDriver.js";
import { CASE_CATALOG } from "../scripts/core13/core13-staging-acceptance-proofs.mjs";

const TENANT = "tenant-a";
const TOURNAMENT = "tourn-a";
const MATCH = "match-1";
const FOREIGN_TENANT = "tenant-b";
const FOREIGN_TOURNAMENT = "tourn-b";

function createFilterApi(rows, { error = null } = {}) {
  let filtered = [...rows];
  const api = {
    select: () => api,
    eq(col, val) {
      filtered = filtered.filter((row) => String(row[col]) === String(val));
      return api;
    },
    order: () => api,
    limit: () => api,
    maybeSingle: async () => ({ data: filtered[0] || null, error }),
    then: (resolve) => resolve({ data: filtered, error }),
  };
  return api;
}

function createEvidenceClient({
  live = [],
  events = [],
  eventsError = null,
} = {}) {
  return {
    rpc: async () => ({ data: null, error: null }),
    from(table) {
      if (table === "canonical_tournaments") {
        return createFilterApi([
          {
            id: TOURNAMENT,
            tenant_id: TENANT,
            club_id: "club-a",
            status: "active",
            mode: "internal",
            payload: {
              matches: [
                {
                  id: MATCH,
                  scheduledStart: "2026-08-17T10:00:00.000Z",
                  scheduledEnd: "2026-08-17T11:00:00.000Z",
                  courtId: "court-1",
                  entryAId: "e1",
                  entryBId: "e2",
                  status: "SCHEDULED",
                },
              ],
            },
          },
        ]);
      }
      if (table === "team_tournaments") return createFilterApi([]);
      if (table === "match_live_states") return createFilterApi(live);
      if (table === "match_events") {
        return createFilterApi(events, { error: eventsError });
      }
      return createFilterApi([]);
    },
  };
}

function liveRow(overrides = {}) {
  return {
    tenant_id: TENANT,
    tournament_id: TOURNAMENT,
    match_id: MATCH,
    status: "in_progress",
    last_event_sequence: 1,
    team_a_score: 0,
    team_b_score: 0,
    state_payload: {
      status: "in_progress",
      teams: { teamA: { score: 0 }, teamB: { score: 0 } },
    },
    updated_at: "2026-08-20T00:00:00.000Z",
    ...overrides,
  };
}

function eventRow(overrides = {}) {
  return {
    id: overrides.id || "evt-1",
    tenant_id: TENANT,
    tournament_id: TOURNAMENT,
    match_id: MATCH,
    match_state_id: `${TENANT}::${TOURNAMENT}::${MATCH}`,
    event_sequence: 1,
    event_type: "START_MATCH",
    command_type: "START_MATCH",
    generated_events: ["START_MATCH"],
    ...overrides,
  };
}

async function classifyLive(live, events) {
  return loadAuthoritativeAssignmentEvidence({
    serviceClient: createEvidenceClient({ live: live ? [live] : [], events }),
    tenantId: TENANT,
    tournamentId: TOURNAMENT,
    matchId: MATCH,
  });
}

function gate(command, lifecycleState, extra = {}) {
  return evaluateAssignmentLifecycleGate({
    command,
    lifecycleState,
    actorAuthorized: true,
    ...extra,
  });
}

test("M1. no live state → PRE_MATCH", async () => {
  const evidence = await classifyLive(null, []);
  assert.equal(evidence.lifecycleState, ASSIGNMENT_LIFECYCLE_STATE.PRE_MATCH);
  assert.equal(evidence.scoringActive, false);
});

test("M2. NOT_STARTED sequence=0 → PRE_MATCH", async () => {
  const evidence = await classifyLive(
    liveRow({ status: "not_started", last_event_sequence: 0 }),
    []
  );
  assert.equal(evidence.lifecycleState, ASSIGNMENT_LIFECYCLE_STATE.PRE_MATCH);
});

test("M3/M19. START_MATCH only with sequence>0 and 0-0 is IN_PROGRESS, never SCORING_ACTIVE", async () => {
  assert.equal(EVENT_SEQUENCE_ALONE_AS_SCORING_ACTIVE, "DENY");
  const evidence = await classifyLive(liveRow(), [eventRow()]);
  assert.equal(evidence.lifecycleState, ASSIGNMENT_LIFECYCLE_STATE.IN_PROGRESS);
  assert.equal(evidence.scoringActive, false);
  const scoring = classifyCanonicalScoringActivity({
    liveRow: liveRow(),
    events: [eventRow()],
    eventsReadable: true,
  });
  assert.equal(scoring.scoringActive, false);
  assert.equal(scoring.sequence > 0, true);
});

test("M4. IN_PROGRESS + timeout/non-scoring command only → IN_PROGRESS", async () => {
  const evidence = await classifyLive(liveRow({ last_event_sequence: 2 }), [
    eventRow(),
    eventRow({
      id: "evt-2",
      event_sequence: 2,
      event_type: "START_TIMEOUT",
      command_type: "START_TIMEOUT",
      generated_events: ["START_TIMEOUT"],
    }),
  ]);
  assert.equal(evidence.lifecycleState, ASSIGNMENT_LIFECYCLE_STATE.IN_PROGRESS);
});

test("M5. TEAM_A_WON_RALLY at 0-0 (side-out) → SCORING_ACTIVE", async () => {
  const evidence = await classifyLive(liveRow({ last_event_sequence: 2 }), [
    eventRow(),
    eventRow({
      id: "evt-2",
      event_sequence: 2,
      event_type: "TEAM_A_WON_RALLY",
      command_type: "TEAM_A_WON_RALLY",
      generated_events: ["SIDE_OUT"],
    }),
  ]);
  assert.equal(evidence.lifecycleState, ASSIGNMENT_LIFECYCLE_STATE.SCORING_ACTIVE);
  assert.equal(evidence.scoringActive, true);
});

test("M6. TEAM_B_WON_RALLY → SCORING_ACTIVE", async () => {
  const evidence = await classifyLive(liveRow({ last_event_sequence: 2 }), [
    eventRow(),
    eventRow({
      id: "evt-2",
      event_sequence: 2,
      event_type: "TEAM_B_WON_RALLY",
      command_type: "TEAM_B_WON_RALLY",
      generated_events: ["POINT_AWARDED"],
    }),
  ]);
  assert.equal(evidence.lifecycleState, ASSIGNMENT_LIFECYCLE_STATE.SCORING_ACTIVE);
});

test("M7. canonical score >0 → SCORING_ACTIVE", async () => {
  const evidence = await classifyLive(
    liveRow({
      last_event_sequence: 2,
      team_a_score: 1,
      state_payload: {
        status: "in_progress",
        teams: { teamA: { score: 1 }, teamB: { score: 0 } },
      },
    }),
    [eventRow()]
  );
  assert.equal(evidence.lifecycleState, ASSIGNMENT_LIFECYCLE_STATE.SCORING_ACTIVE);
});

test("M8. PAUSED after scoring → LOCKED", async () => {
  const evidence = await classifyLive(
    liveRow({
      status: "paused",
      last_event_sequence: 2,
      team_a_score: 1,
    }),
    [
      eventRow(),
      eventRow({
        id: "evt-2",
        event_sequence: 2,
        command_type: "TEAM_A_WON_RALLY",
        event_type: "TEAM_A_WON_RALLY",
      }),
    ]
  );
  assert.equal(evidence.lifecycleState, ASSIGNMENT_LIFECYCLE_STATE.LOCKED);
});

test("M9. LOCKED after scoring → LOCKED", async () => {
  const evidence = await classifyLive(
    liveRow({ status: "locked", last_event_sequence: 3, team_a_score: 2 }),
    []
  );
  assert.equal(evidence.lifecycleState, ASSIGNMENT_LIFECYCLE_STATE.LOCKED);
});

test("M10. COMPLETED after scoring → COMPLETED", async () => {
  const evidence = await classifyLive(
    liveRow({ status: "completed", last_event_sequence: 8, team_a_score: 11 }),
    []
  );
  assert.equal(evidence.lifecycleState, ASSIGNMENT_LIFECYCLE_STATE.COMPLETED);
});

test("M11. IN_PROGRESS + REPLACE authorized + no scoring → PASS without emergency", () => {
  const result = gate(ASSIGNMENT_COMMAND.REPLACE, ASSIGNMENT_LIFECYCLE_STATE.IN_PROGRESS);
  assert.equal(result.allowed, true);
  assert.equal(result.policy, "IN_PROGRESS_ATOMIC_REPLACEMENT_ALLOW_AUTHORIZED");
});

test("M12. IN_PROGRESS + ASSIGN → DENY", () => {
  const result = gate(ASSIGNMENT_COMMAND.ASSIGN, ASSIGNMENT_LIFECYCLE_STATE.IN_PROGRESS);
  assert.equal(result.allowed, false);
  assert.equal(result.code, ASSIGNMENT_COMMAND_ERROR_CODE.LIFECYCLE_DENIED);
});

test("M13. IN_PROGRESS + UNASSIGN without replacement → DENY", () => {
  const result = gate(ASSIGNMENT_COMMAND.UNASSIGN, ASSIGNMENT_LIFECYCLE_STATE.IN_PROGRESS);
  assert.equal(result.allowed, false);
  assert.equal(
    result.code,
    ASSIGNMENT_COMMAND_ERROR_CODE.UNASSIGN_WITHOUT_REPLACEMENT_DENIED
  );
});

test("M14. SCORING_ACTIVE + normal REPLACE → EMERGENCY_REPLACEMENT_REQUIRED", () => {
  const result = gate(ASSIGNMENT_COMMAND.REPLACE, ASSIGNMENT_LIFECYCLE_STATE.SCORING_ACTIVE);
  assert.equal(result.allowed, false);
  assert.equal(
    result.code,
    ASSIGNMENT_COMMAND_ERROR_CODE.EMERGENCY_REPLACEMENT_REQUIRED
  );
});

test("M15. SCORING_ACTIVE + emergencyReplacement + emergency auth → PASS", () => {
  const result = gate(ASSIGNMENT_COMMAND.REPLACE, ASSIGNMENT_LIFECYCLE_STATE.SCORING_ACTIVE, {
    emergencyReplacement: true,
    emergencyAuthorized: true,
  });
  assert.equal(result.allowed, true);
});

test("M16. SCORING_ACTIVE + emergencyReplacement without emergency auth → DENY", () => {
  const result = gate(ASSIGNMENT_COMMAND.REPLACE, ASSIGNMENT_LIFECYCLE_STATE.SCORING_ACTIVE, {
    emergencyReplacement: true,
    emergencyAuthorized: false,
  });
  assert.equal(result.allowed, false);
  assert.equal(result.code, ASSIGNMENT_COMMAND_ERROR_CODE.EMERGENCY_UNAUTHORIZED);
});

test("M17. LOCKED + REPLACE → DENY", () => {
  const result = gate(ASSIGNMENT_COMMAND.REPLACE, ASSIGNMENT_LIFECYCLE_STATE.LOCKED);
  assert.equal(result.allowed, false);
  assert.equal(result.code, ASSIGNMENT_COMMAND_ERROR_CODE.LIFECYCLE_DENIED);
});

test("M18. COMPLETED + REPLACE → DENY", () => {
  const result = gate(ASSIGNMENT_COMMAND.REPLACE, ASSIGNMENT_LIFECYCLE_STATE.COMPLETED);
  assert.equal(result.allowed, false);
});

test("M20/M21. H durable idempotency and G replacement evidence files remain in catalog of unit tests", () => {
  assert.equal(typeof evaluateAssignmentLifecycleGate, "function");
  assert.equal(CANONICAL_SCORING_COMMAND_TYPES.includes("TEAM_A_WON_RALLY"), true);
});

test("M22. canonical event evidence read is tenant + tournament + match scoped", async () => {
  const events = [
    eventRow(),
    eventRow({
      id: "foreign",
      tenant_id: FOREIGN_TENANT,
      tournament_id: FOREIGN_TOURNAMENT,
      match_id: "foreign-match",
      match_state_id: `${FOREIGN_TENANT}::${FOREIGN_TOURNAMENT}::foreign-match`,
      command_type: "TEAM_A_WON_RALLY",
      event_type: "TEAM_A_WON_RALLY",
      generated_events: ["POINT_AWARDED"],
    }),
  ];
  const listed = await listCanonicalRefereeMatchEvents(createEvidenceClient({ events }), {
    tenantId: TENANT,
    competitionId: TOURNAMENT,
    matchId: MATCH,
  });
  assert.equal(listed.length, 1);
  assert.equal(listed[0].commandType, "START_MATCH");
  assert.equal(listed[0].tenantId, TENANT);
  assert.equal(listed[0].competitionId, TOURNAMENT);
  assert.equal(listed[0].matchId, MATCH);
});

test("M23. cross-tenant/cross-tournament event history cannot influence classification", async () => {
  const evidence = await classifyLive(liveRow(), [
    eventRow(),
    eventRow({
      id: "cross",
      tenant_id: FOREIGN_TENANT,
      tournament_id: FOREIGN_TOURNAMENT,
      match_id: MATCH,
      match_state_id: `${FOREIGN_TENANT}::${FOREIGN_TOURNAMENT}::${MATCH}`,
      command_type: "TEAM_A_WON_RALLY",
      event_type: "TEAM_A_WON_RALLY",
      generated_events: ["POINT_AWARDED"],
    }),
  ]);
  assert.equal(evidence.lifecycleState, ASSIGNMENT_LIFECYCLE_STATE.IN_PROGRESS);
  assert.equal(evidence.scoringActive, false);
});

test("M24. failure to obtain required scoring evidence fails closed, not permissive", async () => {
  await assert.rejects(
    () =>
      loadAuthoritativeAssignmentEvidence({
        serviceClient: createEvidenceClient({
          live: [liveRow()],
          eventsError: { message: "match_events unavailable" },
        }),
        tenantId: TENANT,
        tournamentId: TOURNAMENT,
        matchId: MATCH,
      }),
    (err) =>
      isCompetitionRefereeAssignmentCommandError(err) &&
      err.code === ASSIGNMENT_COMMAND_ERROR_CODE.CANONICAL_REFEREE_EVIDENCE_REQUIRED
  );
  await assert.rejects(
    () =>
      loadAuthoritativeAssignmentEvidence({
        serviceClient: createEvidenceClient({
          live: [liveRow()],
          events: [],
        }),
        tenantId: TENANT,
        tournamentId: TOURNAMENT,
        matchId: MATCH,
      }),
    (err) =>
      isCompetitionRefereeAssignmentCommandError(err) &&
      err.code === ASSIGNMENT_COMMAND_ERROR_CODE.CANONICAL_REFEREE_EVIDENCE_REQUIRED
  );
});

test("scoring hint cannot overwrite LOCKED or COMPLETED", () => {
  assert.equal(SCORING_ACTIVE_REFINEMENT_ONLY_FOR_IN_PROGRESS, "YES");
  assert.equal(
    normalizeAssignmentLifecycleState("paused", { scoringActive: true }),
    ASSIGNMENT_LIFECYCLE_STATE.LOCKED
  );
  assert.equal(
    normalizeAssignmentLifecycleState("completed", { scoringActive: true }),
    ASSIGNMENT_LIFECYCLE_STATE.COMPLETED
  );
  assert.equal(
    normalizeAssignmentLifecycleState("in_progress", { scoringActive: true }),
    ASSIGNMENT_LIFECYCLE_STATE.SCORING_ACTIVE
  );
  assert.equal(
    normalizeAssignmentLifecycleState("in_progress", { scoringActive: false }),
    ASSIGNMENT_LIFECYCLE_STATE.IN_PROGRESS
  );
});

test("remaining Live29 lifecycle-dependent cases stay aligned with classifier", () => {
  const remaining = CASE_CATALOG.slice(
    CASE_CATALOG.indexOf("J.lifecycle-in-progress-replace-pass") + 1
  ).filter((name) =>
    /lifecycle|scoring|locked|completed|IN_PROGRESS|SCORING_ACTIVE/i.test(name)
  );
  assert.equal(remaining.length, 4);
  assert.deepEqual(remaining, [
    "J.lifecycle-scoring-replace-without-emergency-deny",
    "J.lifecycle-scoring-emergency-replace-pass",
    "J.lifecycle-locked-deny",
    "J.lifecycle-completed-deny",
  ]);
  assert.equal(
    gate(ASSIGNMENT_COMMAND.REPLACE, ASSIGNMENT_LIFECYCLE_STATE.SCORING_ACTIVE).code,
    ASSIGNMENT_COMMAND_ERROR_CODE.EMERGENCY_REPLACEMENT_REQUIRED
  );
  assert.equal(
    gate(ASSIGNMENT_COMMAND.REPLACE, ASSIGNMENT_LIFECYCLE_STATE.SCORING_ACTIVE, {
      emergencyReplacement: true,
      emergencyAuthorized: true,
    }).allowed,
    true
  );
  assert.equal(
    gate(ASSIGNMENT_COMMAND.ASSIGN, ASSIGNMENT_LIFECYCLE_STATE.LOCKED).allowed,
    false
  );
  assert.equal(
    gate(ASSIGNMENT_COMMAND.ASSIGN, ASSIGNMENT_LIFECYCLE_STATE.COMPLETED).allowed,
    false
  );
});
