import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  MATCH_STATUS,
  MATCH_ACTION,
  MATCH_COMPLETION_REASON,
  MATCH_RUNTIME_ERROR_CODE,
  MatchRuntimeError,
  createCompetitionMatch,
  createMatchSide,
  createMatchResultReference,
  applyMatchTransition,
  evaluatePreMatchReadiness,
  evaluateScoringEligibility,
  assertScoringAllowed,
  assertMatchTransitionAllowed,
  mapLegacyMatchStatus,
  createMatchLifecycleAuditEvent,
} from "../src/features/competition-core/matches/index.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MATCHES_ROOT = path.join(ROOT, "src/features/competition-core/matches");
const NOW = "2026-07-23T01:00:00.000Z";

function auth(overrides = {}) {
  return {
    allowed: true,
    actorId: "actor-1",
    actorRole: "DIRECTOR",
    decisionCode: "ALLOWED",
    policyId: "test-policy",
    details: {},
    ...overrides,
  };
}

function baseMatch(overrides = {}) {
  return createCompetitionMatch({
    competitionId: "comp-1",
    contextId: "m-1",
    status: MATCH_STATUS.READY_TO_START,
    sides: [
      createMatchSide({ sideKey: "A" }),
      createMatchSide({ sideKey: "B" }),
    ],
    scheduledAt: "2026-07-23T00:30:00.000Z",
    courtAssignmentRef: "court-1",
    refereeAssignmentRef: "ref-1",
    ...overrides,
  });
}

function listJsFiles(dir) {
  const out = [];
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) out.push(...listJsFiles(full));
    else if (name.endsWith(".js")) out.push(full);
  }
  return out;
}

test("CORE-15: valid start transition", () => {
  const match = baseMatch();
  const frozenStatus = match.status;
  const result = applyMatchTransition({
    match,
    action: MATCH_ACTION.START,
    authorization: auth(),
    now: NOW,
  });
  assert.equal(result.ok, true);
  assert.equal(result.fromStatus, MATCH_STATUS.READY_TO_START);
  assert.equal(result.toStatus, MATCH_STATUS.IN_PROGRESS);
  assert.equal(result.match.status, MATCH_STATUS.IN_PROGRESS);
  assert.equal(result.match.startedAt, NOW);
  assert.equal(result.auditEvent.action, MATCH_ACTION.START);
  assert.equal(match.status, frozenStatus);
});

test("CORE-15: readiness denial before start", () => {
  const match = baseMatch({
    status: MATCH_STATUS.DRAFT,
    courtAssignmentRef: null,
  });
  const readiness = evaluatePreMatchReadiness(match, {
    requireCourtAssignmentRef: true,
  });
  assert.equal(readiness.readyToStart, false);
  assert.ok(readiness.blockers.length >= 1);

  const startable = baseMatch({ courtAssignmentRef: null });
  assert.throws(
    () =>
      applyMatchTransition({
        match: startable,
        action: MATCH_ACTION.START,
        authorization: auth(),
        now: NOW,
        enforceReadiness: true,
        readinessOptions: { requireCourtAssignmentRef: true },
      }),
    (err) =>
      err instanceof MatchRuntimeError &&
      err.code === MATCH_RUNTIME_ERROR_CODE.MATCH_NOT_READY
  );
});

test("CORE-15: PAUSE from IN_PROGRESS and RESUME from PAUSED", () => {
  const inProgress = baseMatch({
    status: MATCH_STATUS.IN_PROGRESS,
    startedAt: "2026-07-23T00:40:00.000Z",
  });
  const paused = applyMatchTransition({
    match: inProgress,
    action: MATCH_ACTION.PAUSE,
    authorization: auth(),
    now: NOW,
  });
  assert.equal(paused.toStatus, MATCH_STATUS.PAUSED);
  assert.equal(paused.match.pausedAt, NOW);
  assert.notEqual(paused.match.status, MATCH_STATUS.SUSPENDED);

  const resumed = applyMatchTransition({
    match: paused.match,
    action: MATCH_ACTION.RESUME,
    authorization: auth(),
    now: "2026-07-23T01:05:00.000Z",
  });
  assert.equal(resumed.toStatus, MATCH_STATUS.IN_PROGRESS);
  assert.equal(resumed.match.resumedAt, "2026-07-23T01:05:00.000Z");
});

test("CORE-15: SUSPEND from IN_PROGRESS and from PAUSED; RESUME from SUSPENDED", () => {
  const inProgress = baseMatch({ status: MATCH_STATUS.IN_PROGRESS });
  const suspended = applyMatchTransition({
    match: inProgress,
    action: MATCH_ACTION.SUSPEND,
    authorization: auth(),
    now: NOW,
  });
  assert.equal(suspended.toStatus, MATCH_STATUS.SUSPENDED);
  assert.equal(suspended.match.suspendedAt, NOW);

  const paused = applyMatchTransition({
    match: inProgress,
    action: MATCH_ACTION.PAUSE,
    authorization: auth(),
    now: NOW,
  }).match;
  const suspendedFromPaused = applyMatchTransition({
    match: paused,
    action: MATCH_ACTION.SUSPEND,
    authorization: auth(),
    now: "2026-07-23T01:10:00.000Z",
  });
  assert.equal(suspendedFromPaused.toStatus, MATCH_STATUS.SUSPENDED);

  const resumed = applyMatchTransition({
    match: suspended.match,
    action: MATCH_ACTION.RESUME,
    authorization: auth(),
    now: "2026-07-23T01:15:00.000Z",
  });
  assert.equal(resumed.toStatus, MATCH_STATUS.IN_PROGRESS);
});

test("CORE-15: invalid pause/resume/suspend transitions", () => {
  assert.throws(
    () =>
      assertMatchTransitionAllowed({
        action: MATCH_ACTION.PAUSE,
        fromStatus: MATCH_STATUS.READY_TO_START,
      }),
    (err) => err instanceof MatchRuntimeError
  );
  assert.throws(
    () =>
      assertMatchTransitionAllowed({
        action: MATCH_ACTION.RESUME,
        fromStatus: MATCH_STATUS.IN_PROGRESS,
      }),
    (err) =>
      err.code === MATCH_RUNTIME_ERROR_CODE.MATCH_STATE_TRANSITION_INVALID
  );
  assert.throws(
    () =>
      assertMatchTransitionAllowed({
        action: MATCH_ACTION.SUSPEND,
        fromStatus: MATCH_STATUS.SCHEDULED,
      }),
    (err) =>
      err.code === MATCH_RUNTIME_ERROR_CODE.MATCH_NOT_IN_PROGRESS
  );
  assert.notEqual(MATCH_STATUS.PAUSED, MATCH_STATUS.SUSPENDED);
});

test("CORE-15: COMPLETE attaches opaque resultReference without validating score/winner", () => {
  const match = baseMatch({ status: MATCH_STATUS.IN_PROGRESS });
  const opaque = createMatchResultReference({
    resultId: "res-1",
    resultType: "COMPLETED",
    metadata: { note: "opaque-only" },
  });
  const result = applyMatchTransition({
    match,
    action: MATCH_ACTION.COMPLETE,
    authorization: auth(),
    now: NOW,
    completionReason: MATCH_COMPLETION_REASON.COMPLETED,
    resultReference: opaque,
  });
  assert.equal(result.match.status, MATCH_STATUS.COMPLETED);
  assert.equal(result.match.completionReason, MATCH_COMPLETION_REASON.COMPLETED);
  assert.equal(result.match.completedAt, NOW);
  assert.equal(result.match.resultReference?.resultId, "res-1");
  assert.equal(Object.prototype.hasOwnProperty.call(result.match, "scoreA"), false);
  assert.equal(Object.prototype.hasOwnProperty.call(result.match, "winnerId"), false);
});

test("CORE-15: CANCEL does not fabricate result data", () => {
  const match = baseMatch({ status: MATCH_STATUS.READY_TO_START });
  const result = applyMatchTransition({
    match,
    action: MATCH_ACTION.CANCEL,
    authorization: auth(),
    now: NOW,
    reason: "weather",
  });
  assert.equal(result.match.status, MATCH_STATUS.CANCELLED);
  assert.equal(result.match.completionReason, MATCH_COMPLETION_REASON.CANCELLED);
  assert.equal(result.match.cancelledAt, NOW);
  assert.equal(result.match.resultReference, null);
});

test("CORE-15: ABANDON → COMPLETED + ABANDONED without winner/score", () => {
  const match = baseMatch({ status: MATCH_STATUS.IN_PROGRESS });
  const result = applyMatchTransition({
    match,
    action: MATCH_ACTION.ABANDON,
    authorization: auth(),
    now: NOW,
    reason: "facility failure",
  });
  assert.equal(result.match.status, MATCH_STATUS.COMPLETED);
  assert.equal(result.match.completionReason, MATCH_COMPLETION_REASON.ABANDONED);
  assert.equal(result.match.abandonedAt, NOW);
  assert.equal(result.match.completedAt, NOW);
  assert.equal(result.match.resultReference, null);
});

test("CORE-15: walkover / no-show / retirement completion reasons", () => {
  for (const reason of [
    MATCH_COMPLETION_REASON.WALKOVER,
    MATCH_COMPLETION_REASON.NO_SHOW,
    MATCH_COMPLETION_REASON.RETIREMENT,
    MATCH_COMPLETION_REASON.FORFEIT,
  ]) {
    const result = applyMatchTransition({
      match: baseMatch({ status: MATCH_STATUS.IN_PROGRESS }),
      action: MATCH_ACTION.COMPLETE,
      authorization: auth(),
      now: NOW,
      completionReason: reason,
    });
    assert.equal(result.match.status, MATCH_STATUS.COMPLETED);
    assert.equal(result.match.completionReason, reason);
    assert.equal(result.match.resultReference, null);
  }
});

test("CORE-15: authorization allowed / denied / missing fail-closed", () => {
  const match = baseMatch({ status: MATCH_STATUS.IN_PROGRESS });
  const allowed = applyMatchTransition({
    match,
    action: MATCH_ACTION.PAUSE,
    authorization: auth(),
    now: NOW,
  });
  assert.equal(allowed.ok, true);

  assert.throws(
    () =>
      applyMatchTransition({
        match,
        action: MATCH_ACTION.PAUSE,
        authorization: auth({ allowed: false, decisionCode: "DENIED" }),
        now: NOW,
      }),
    (err) =>
      err.code === MATCH_RUNTIME_ERROR_CODE.MATCH_AUTHORIZATION_DENIED
  );

  assert.throws(
    () =>
      applyMatchTransition({
        match,
        action: MATCH_ACTION.PAUSE,
        now: NOW,
      }),
    (err) =>
      err.code === MATCH_RUNTIME_ERROR_CODE.MATCH_AUTHORIZATION_REQUIRED
  );

  assert.throws(
    () =>
      applyMatchTransition({
        match,
        action: MATCH_ACTION.PAUSE,
        authorization: { allowed: true, actorId: null },
        now: NOW,
      }),
    (err) =>
      err.code === MATCH_RUNTIME_ERROR_CODE.MATCH_AUTHORIZATION_REQUIRED
  );
});

test("CORE-15: deterministic timestamps and audit only on success", () => {
  const match = baseMatch();
  const result = applyMatchTransition({
    match,
    action: MATCH_ACTION.START,
    authorization: auth(),
    clock: () => NOW,
    requestId: "req-1",
    idempotencyKey: "idem-1",
  });
  assert.equal(result.match.startedAt, NOW);
  assert.equal(result.auditEvent.occurredAt, NOW);
  assert.equal(result.auditEvent.requestId, "req-1");
  assert.ok(result.auditEvent.eventId);

  assert.throws(() =>
    applyMatchTransition({
      match,
      action: MATCH_ACTION.START,
      authorization: auth({ allowed: false }),
      now: NOW,
    })
  );

  // Failed auth must not produce an audit event from apply (throws before create).
  assert.equal(
    typeof createMatchLifecycleAuditEvent({
      previousStatus: MATCH_STATUS.READY_TO_START,
      nextStatus: MATCH_STATUS.IN_PROGRESS,
      action: MATCH_ACTION.START,
      occurredAt: NOW,
    }).eventId,
    "string"
  );
});

test("CORE-15: input match object is not mutated", () => {
  const match = baseMatch({ status: MATCH_STATUS.IN_PROGRESS });
  const snapshot = JSON.stringify(match);
  applyMatchTransition({
    match,
    action: MATCH_ACTION.PAUSE,
    authorization: auth(),
    now: NOW,
  });
  assert.equal(JSON.stringify(match), snapshot);
});

test("CORE-15: terminal-state immutability", () => {
  for (const terminal of [MATCH_STATUS.COMPLETED, MATCH_STATUS.CANCELLED]) {
    assert.throws(
      () =>
        applyMatchTransition({
          match: baseMatch({ status: terminal }),
          action: MATCH_ACTION.START,
          authorization: auth(),
          now: NOW,
        }),
      (err) =>
        err.code === MATCH_RUNTIME_ERROR_CODE.MATCH_COMPLETED_IMMUTABLE ||
        err.code === MATCH_RUNTIME_ERROR_CODE.MATCH_ALREADY_COMPLETED
    );
  }
});

test("CORE-15: scoring allowed only for IN_PROGRESS; denied otherwise", () => {
  assert.equal(
    evaluateScoringEligibility({ status: MATCH_STATUS.IN_PROGRESS }).scoringAllowed,
    true
  );
  assert.doesNotThrow(() => assertScoringAllowed(MATCH_STATUS.IN_PROGRESS));

  const denied = [
    MATCH_STATUS.PAUSED,
    MATCH_STATUS.SUSPENDED,
    MATCH_STATUS.COMPLETED,
    MATCH_STATUS.CANCELLED,
    MATCH_STATUS.DRAFT,
    MATCH_STATUS.READY,
    MATCH_STATUS.SCHEDULED,
    MATCH_STATUS.LINEUPS_PENDING,
    MATCH_STATUS.READY_TO_START,
    MATCH_STATUS.POSTPONED,
  ];
  for (const status of denied) {
    const result = evaluateScoringEligibility({ status });
    assert.equal(result.scoringAllowed, false, status);
    assert.ok(result.reasonCode);
    assert.throws(() => assertScoringAllowed(status), (err) => {
      if (status === MATCH_STATUS.PAUSED || status === MATCH_STATUS.SUSPENDED) {
        return err.code === MATCH_RUNTIME_ERROR_CODE.MATCH_SCORING_NOT_ALLOWED;
      }
      if (
        status === MATCH_STATUS.COMPLETED ||
        status === MATCH_STATUS.CANCELLED
      ) {
        return err.code === MATCH_RUNTIME_ERROR_CODE.MATCH_SCORING_NOT_ALLOWED;
      }
      return err.code === MATCH_RUNTIME_ERROR_CODE.MATCH_NOT_READY;
    });
  }
});

test("CORE-15: legacy status mapping paused→PAUSED; suspended→SUSPENDED", () => {
  assert.equal(mapLegacyMatchStatus("paused"), MATCH_STATUS.PAUSED);
  assert.equal(mapLegacyMatchStatus("suspended"), MATCH_STATUS.SUSPENDED);
  assert.equal(mapLegacyMatchStatus("playing"), MATCH_STATUS.IN_PROGRESS);
  assert.equal(mapLegacyMatchStatus("forfeit"), MATCH_STATUS.COMPLETED);
});

test("CORE-15 architecture: matches/** has no forbidden adjacent engine imports", () => {
  const forbidden = [
    /from\s+['"][^'"]*referee-v5/,
    /from\s+['"][^'"]*team-tournament/,
    /from\s+['"][^'"]*individual-tournament/,
    /from\s+['"][^'"]*schedule-engine/,
    /from\s+['"][^'"]*court-assignment/,
    /from\s+['"][^'"]*standings\//,
    /from\s+['"][^'"]*matchEngine/,
    /from\s+['"][^'"]*rallyScoring/,
    /from\s+['"][^'"]*seeding\/domain/,
    /Date\.now\s*\(/,
    /Math\.random\s*\(/,
  ];
  for (const file of listJsFiles(MATCHES_ROOT)) {
    const content = readFileSync(file, "utf8");
    for (const pattern of forbidden) {
      assert.doesNotMatch(
        content,
        pattern,
        `forbidden pattern in ${path.relative(ROOT, file)}`
      );
    }
  }
});

test("CORE-15: PAUSED and SUSPENDED remain distinct in matrix", () => {
  assert.equal(
    assertMatchTransitionAllowed({
      action: MATCH_ACTION.PAUSE,
      fromStatus: MATCH_STATUS.IN_PROGRESS,
    }).toStatus,
    MATCH_STATUS.PAUSED
  );
  assert.equal(
    assertMatchTransitionAllowed({
      action: MATCH_ACTION.SUSPEND,
      fromStatus: MATCH_STATUS.IN_PROGRESS,
    }).toStatus,
    MATCH_STATUS.SUSPENDED
  );
  assert.equal(
    assertMatchTransitionAllowed({
      action: MATCH_ACTION.SUSPEND,
      fromStatus: MATCH_STATUS.PAUSED,
    }).toStatus,
    MATCH_STATUS.SUSPENDED
  );
});
