/**
 * CORE-11 Phase 1E — deterministic baseline schedule candidate (focused).
 */

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  CONSTRAINT_CERTIFICATION,
  SCHEDULE_DIAGNOSTIC_CODE,
  SCHEDULE_DEPENDENCY_TYPE,
  FORBIDDEN_CANONICAL_ASSIGNMENT_FIELDS,
  generateAbstractScheduleSlots,
  resolveMatchDurationMinutes,
  placeMatchIntoCandidateSlot,
  buildBaselineScheduleCandidate,
  createScheduleRequest,
  createScheduleMatchInput,
  createSchedulePolicy,
  fingerprintSchedulePlan,
  collectForbiddenAssignmentFieldPaths,
} from "../src/features/competition-core/schedule-engine/index.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SE_ROOT = path.join(ROOT, "src/features/competition-core/schedule-engine");
const TZ = "Asia/Ho_Chi_Minh";

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

function readModuleSources() {
  return listJsFiles(SE_ROOT)
    .map((f) => readFileSync(f, "utf8"))
    .join("\n");
}

function basePolicy(overrides = {}) {
  return createSchedulePolicy({
    duration: {
      defaultDurationMinutes: 30,
      bufferMinutes: 5,
      ...(overrides.duration || {}),
    },
    rest: {
      minParticipantRestMinutes: 15,
      minTeamRestMinutes: 0,
      ...(overrides.rest || {}),
    },
    capacity: {
      maxConcurrentMatches: 2,
      ...(overrides.capacity || {}),
    },
  });
}

function match(id, extra = {}) {
  return createScheduleMatchInput({ matchId: id, ...extra });
}

function dep(sourceMatchId, type = SCHEDULE_DEPENDENCY_TYPE.WINNER_OF) {
  return { sourceMatchId, type };
}

function request(partial = {}) {
  return createScheduleRequest({
    competitionId: "comp-1e",
    timezone: TZ,
    policy: basePolicy(),
    operatingWindows: [
      { date: "2026-08-01", startMinutes: 480, endMinutes: 720 },
    ],
    matches: [],
    ...partial,
  });
}

function codesOf(result) {
  return (result.diagnostics || []).map((d) => d.code);
}

test("01 empty schedule candidate", () => {
  const result = buildBaselineScheduleCandidate(request({ matches: [] }));
  assert.equal(result.status, "BASELINE_SCHEDULE_CANDIDATE");
  assert.equal(result.plan.scheduled.length, 0);
  assert.equal(result.plan.unscheduled.length, 0);
  assert.equal(
    result.constraintCertification,
    CONSTRAINT_CERTIFICATION.BASELINE_ONLY
  );
});

test("02 single match in one operating window", () => {
  const result = buildBaselineScheduleCandidate(
    request({ matches: [match("m1")] })
  );
  assert.equal(result.ok, true);
  assert.equal(result.plan.scheduled.length, 1);
  assert.equal(result.plan.scheduled[0].matchId, "m1");
  assert.equal(result.plan.scheduled[0].start.minutesFromMidnight, 480);
  assert.equal(result.plan.scheduled[0].end.minutesFromMidnight, 510);
});

test("03 multiple sequential matches", () => {
  const result = buildBaselineScheduleCandidate(
    request({
      policy: basePolicy({ capacity: { maxConcurrentMatches: 1 } }),
      matches: [match("m2"), match("m1"), match("m3")],
    })
  );
  assert.equal(result.plan.scheduled.length, 3);
  const byId = Object.fromEntries(
    result.plan.scheduled.map((s) => [s.matchId, s])
  );
  assert.equal(byId.m1.start.minutesFromMidnight, 480);
  assert.equal(byId.m2.start.minutesFromMidnight, 515);
  assert.equal(byId.m3.start.minutesFromMidnight, 550);
});

test("04 multiple abstract concurrent matches", () => {
  const result = buildBaselineScheduleCandidate(
    request({
      policy: basePolicy({ capacity: { maxConcurrentMatches: 2 } }),
      matches: [match("a"), match("b")],
    })
  );
  assert.equal(result.plan.scheduled.length, 2);
  assert.equal(result.plan.scheduled[0].start.minutesFromMidnight, 480);
  assert.equal(result.plan.scheduled[1].start.minutesFromMidnight, 480);
  assert.notEqual(
    result.plan.scheduled[0].concurrencyIndex,
    result.plan.scheduled[1].concurrencyIndex
  );
});

test("05 capacity one forces sequential placement", () => {
  const result = buildBaselineScheduleCandidate(
    request({
      policy: basePolicy({ capacity: { maxConcurrentMatches: 1 } }),
      matches: [match("m1"), match("m2")],
    })
  );
  const starts = result.plan.scheduled.map((s) => s.start.minutesFromMidnight);
  assert.deepEqual(starts, [480, 515]);
});

test("06 capacity greater than one permits concurrency", () => {
  const result = buildBaselineScheduleCandidate(
    request({
      policy: basePolicy({ capacity: { maxConcurrentMatches: 3 } }),
      matches: [match("m1"), match("m2"), match("m3")],
    })
  );
  assert.ok(
    result.plan.scheduled.every((s) => s.start.minutesFromMidnight === 480)
  );
});

test("07 lowest concurrency index preferred", () => {
  const result = buildBaselineScheduleCandidate(
    request({
      policy: basePolicy({ capacity: { maxConcurrentMatches: 3 } }),
      matches: [match("m1")],
    })
  );
  assert.equal(result.plan.scheduled[0].concurrencyIndex, 0);
  assert.equal(result.plan.scheduled[0].abstractSlotIndex, 0);
});

test("08 match-specific duration", () => {
  const result = buildBaselineScheduleCandidate(
    request({
      matches: [match("m1", { estimatedDurationMinutes: 45 })],
    })
  );
  assert.equal(result.plan.scheduled[0].durationMinutes, 45);
  assert.equal(result.plan.scheduled[0].end.minutesFromMidnight, 525);
});

test("09 default duration", () => {
  const resolved = resolveMatchDurationMinutes(match("m1"), basePolicy());
  assert.equal(resolved.ok, true);
  assert.equal(resolved.durationMinutes, 30);
  assert.equal(resolved.source, "DEFAULT");
});

test("10 round-specific duration when supported", () => {
  const policy = basePolicy({
    duration: {
      defaultDurationMinutes: 30,
      bufferMinutes: 5,
      durationByRound: { 2: 40 },
    },
  });
  const resolved = resolveMatchDurationMinutes(
    match("m1", { roundNumber: 2 }),
    policy
  );
  assert.equal(resolved.durationMinutes, 40);
  assert.equal(resolved.source, "DURATION_BY_ROUND");
});

test("10b stage-specific duration precedes round when both apply", () => {
  const policy = basePolicy({
    duration: {
      defaultDurationMinutes: 30,
      bufferMinutes: 5,
      durationByStage: { finals: 50 },
      durationByRound: { 2: 40 },
    },
  });
  const resolved = resolveMatchDurationMinutes(
    match("m1", { roundNumber: 2, stageId: "finals" }),
    policy
  );
  assert.equal(resolved.ok, true);
  assert.equal(resolved.durationMinutes, 50);
  assert.equal(resolved.source, "DURATION_BY_STAGE");
});

test("11 invalid duration", () => {
  const resolved = resolveMatchDurationMinutes(
    match("m1", { estimatedDurationMinutes: 0 }),
    basePolicy()
  );
  assert.equal(resolved.ok, false);
  assert.ok(codesOf(resolved).includes(SCHEDULE_DIAGNOSTIC_CODE.MATCH_DURATION_INVALID));
  const result = buildBaselineScheduleCandidate(
    request({ matches: [match("m1", { estimatedDurationMinutes: -1 })] })
  );
  assert.equal(result.plan.scheduled.length, 0);
  assert.equal(result.plan.unscheduled[0].reasonCode, SCHEDULE_DIAGNOSTIC_CODE.MATCH_DURATION_INVALID);
});

test("12 buffer occupancy", () => {
  const slots = generateAbstractScheduleSlots({
    operatingWindows: [
      { date: "2026-08-01", startMinutes: 480, endMinutes: 600, windowId: "ow1" },
    ],
    durationMinutes: 30,
    bufferMinutes: 10,
    maxConcurrentMatches: 1,
    timezone: TZ,
  });
  assert.equal(slots.ok, true);
  assert.equal(slots.slots[0].startMinutes, 480);
  assert.equal(slots.slots[1].startMinutes, 520);
});

test("13 match end excludes buffer", () => {
  const result = buildBaselineScheduleCandidate(
    request({
      policy: basePolicy({
        duration: { defaultDurationMinutes: 30, bufferMinutes: 10 },
        capacity: { maxConcurrentMatches: 1 },
      }),
      matches: [match("m1")],
    })
  );
  assert.equal(result.plan.scheduled[0].end.minutesFromMidnight, 510);
  assert.equal(result.plan.scheduled[0].bufferMinutes, 10);
});

test("14 capacity release includes buffer", () => {
  const result = buildBaselineScheduleCandidate(
    request({
      policy: basePolicy({
        duration: { defaultDurationMinutes: 30, bufferMinutes: 10 },
        capacity: { maxConcurrentMatches: 1 },
      }),
      matches: [match("m1"), match("m2")],
    })
  );
  const m1 = result.plan.scheduled.find((s) => s.matchId === "m1");
  assert.equal(
    m1.capacityReleaseUtcMs,
    m1.endUtcMs + 10 * 60_000
  );
  const m2 = result.plan.scheduled.find((s) => s.matchId === "m2");
  assert.equal(m2.start.minutesFromMidnight, 520);
});

test("15 start boundary inclusive", () => {
  const slots = generateAbstractScheduleSlots({
    operatingWindows: [
      { date: "2026-08-01", startMinutes: 480, endMinutes: 510, windowId: "ow1" },
    ],
    durationMinutes: 30,
    bufferMinutes: 0,
    maxConcurrentMatches: 1,
    timezone: TZ,
  });
  assert.equal(slots.slots[0].startMinutes, 480);
});

test("16 end boundary exclusive", () => {
  const slots = generateAbstractScheduleSlots({
    operatingWindows: [
      { date: "2026-08-01", startMinutes: 480, endMinutes: 510, windowId: "ow1" },
    ],
    durationMinutes: 30,
    bufferMinutes: 0,
    maxConcurrentMatches: 1,
    timezone: TZ,
  });
  assert.equal(slots.slots.length, 1);
  assert.equal(slots.slots[0].endMinutes, 510);
});

test("17 match fits exactly at window end", () => {
  const result = buildBaselineScheduleCandidate(
    request({
      operatingWindows: [
        { date: "2026-08-01", startMinutes: 480, endMinutes: 510 },
      ],
      policy: basePolicy({
        duration: { defaultDurationMinutes: 30, bufferMinutes: 0 },
        capacity: { maxConcurrentMatches: 1 },
      }),
      matches: [match("m1")],
    })
  );
  assert.equal(result.plan.scheduled.length, 1);
  assert.equal(result.plan.scheduled[0].end.minutesFromMidnight, 510);
});

test("18 match exceeding remaining window is rejected", () => {
  const result = buildBaselineScheduleCandidate(
    request({
      operatingWindows: [
        { date: "2026-08-01", startMinutes: 480, endMinutes: 500 },
      ],
      matches: [match("m1")],
    })
  );
  assert.equal(result.plan.scheduled.length, 0);
  assert.ok(
    [
      SCHEDULE_DIAGNOSTIC_CODE.MATCH_DURATION_EXCEEDS_WINDOW,
      SCHEDULE_DIAGNOSTIC_CODE.NO_FEASIBLE_TIME_SLOT,
    ].includes(result.plan.unscheduled[0].reasonCode)
  );
});

test("19 gap between operating windows", () => {
  const slots = generateAbstractScheduleSlots({
    operatingWindows: [
      { date: "2026-08-01", startMinutes: 480, endMinutes: 510, windowId: "a" },
      { date: "2026-08-01", startMinutes: 540, endMinutes: 570, windowId: "b" },
    ],
    durationMinutes: 30,
    bufferMinutes: 0,
    maxConcurrentMatches: 1,
    timezone: TZ,
  });
  assert.deepEqual(
    slots.slots.map((s) => s.startMinutes),
    [480, 540]
  );
});

test("20 multiple windows on one day", () => {
  const result = buildBaselineScheduleCandidate(
    request({
      operatingWindows: [
        { date: "2026-08-01", startMinutes: 600, endMinutes: 660 },
        { date: "2026-08-01", startMinutes: 480, endMinutes: 540 },
      ],
      policy: basePolicy({ capacity: { maxConcurrentMatches: 1 } }),
      matches: [match("m1"), match("m2")],
    })
  );
  assert.equal(result.plan.scheduled[0].start.minutesFromMidnight, 480);
});

test("21 multiple competition days", () => {
  const result = buildBaselineScheduleCandidate(
    request({
      operatingWindows: [
        { date: "2026-08-02", startMinutes: 480, endMinutes: 600 },
        { date: "2026-08-01", startMinutes: 480, endMinutes: 510 },
      ],
      policy: basePolicy({
        duration: { defaultDurationMinutes: 30, bufferMinutes: 0 },
        capacity: { maxConcurrentMatches: 1 },
      }),
      matches: [match("m1"), match("m2")],
    })
  );
  assert.equal(result.plan.scheduled[0].start.date, "2026-08-01");
  assert.equal(result.plan.scheduled[1].start.date, "2026-08-02");
});

test("22 session-contained placement", () => {
  const result = buildBaselineScheduleCandidate(
    request({
      operatingWindows: [
        { date: "2026-08-01", startMinutes: 480, endMinutes: 720 },
      ],
      sessionWindows: [
        {
          sessionId: "s1",
          date: "2026-08-01",
          startMinutes: 540,
          endMinutes: 600,
        },
      ],
      matches: [match("m1")],
    })
  );
  assert.equal(result.plan.scheduled[0].sessionId, "s1");
  assert.equal(result.plan.scheduled[0].start.minutesFromMidnight, 540);
});

test("23 session gap unavailable", () => {
  const slots = generateAbstractScheduleSlots({
    operatingWindows: [
      { date: "2026-08-01", startMinutes: 480, endMinutes: 720, windowId: "ow" },
    ],
    sessionWindows: [
      {
        sessionId: "am",
        date: "2026-08-01",
        startMinutes: 480,
        endMinutes: 510,
      },
      {
        sessionId: "pm",
        date: "2026-08-01",
        startMinutes: 600,
        endMinutes: 630,
      },
    ],
    durationMinutes: 30,
    bufferMinutes: 0,
    maxConcurrentMatches: 1,
    timezone: TZ,
  });
  assert.deepEqual(
    slots.slots.map((s) => s.startMinutes),
    [480, 600]
  );
});

test("24 no fallback outside configured sessions", () => {
  const result = buildBaselineScheduleCandidate(
    request({
      operatingWindows: [
        { date: "2026-08-01", startMinutes: 480, endMinutes: 720 },
      ],
      sessionWindows: [
        {
          sessionId: "s1",
          date: "2026-08-01",
          startMinutes: 600,
          endMinutes: 630,
        },
      ],
      matches: [match("m1")],
    })
  );
  assert.equal(result.plan.scheduled[0].start.minutesFromMidnight, 600);
  assert.notEqual(result.plan.scheduled[0].start.minutesFromMidnight, 480);
});

test("25 input-order-independent windows", () => {
  const a = generateAbstractScheduleSlots({
    operatingWindows: [
      { date: "2026-08-01", startMinutes: 600, endMinutes: 630, windowId: "b" },
      { date: "2026-08-01", startMinutes: 480, endMinutes: 510, windowId: "a" },
    ],
    durationMinutes: 30,
    bufferMinutes: 0,
    maxConcurrentMatches: 1,
    timezone: TZ,
  });
  const b = generateAbstractScheduleSlots({
    operatingWindows: [
      { date: "2026-08-01", startMinutes: 480, endMinutes: 510, windowId: "a" },
      { date: "2026-08-01", startMinutes: 600, endMinutes: 630, windowId: "b" },
    ],
    durationMinutes: 30,
    bufferMinutes: 0,
    maxConcurrentMatches: 1,
    timezone: TZ,
  });
  assert.deepEqual(
    a.slots.map((s) => s.slotId),
    b.slots.map((s) => s.slotId)
  );
});

test("26 input-order-independent matches", () => {
  const a = buildBaselineScheduleCandidate(
    request({ matches: [match("m2"), match("m1")] })
  );
  const b = buildBaselineScheduleCandidate(
    request({ matches: [match("m1"), match("m2")] })
  );
  assert.equal(
    fingerprintSchedulePlan(a.plan),
    fingerprintSchedulePlan(b.plan)
  );
});

test("27 deterministic repeated candidate generation", () => {
  const req = request({ matches: [match("m1"), match("m2")] });
  const a = buildBaselineScheduleCandidate(req);
  const b = buildBaselineScheduleCandidate(req);
  assert.equal(
    fingerprintSchedulePlan(a.plan),
    fingerprintSchedulePlan(b.plan)
  );
});

test("28 linear dependency chain", () => {
  const result = buildBaselineScheduleCandidate(
    request({
      policy: basePolicy({ capacity: { maxConcurrentMatches: 2 } }),
      matches: [
        match("m3", {
          dependencies: [dep("m2", SCHEDULE_DEPENDENCY_TYPE.PREVIOUS_ROUND)],
        }),
        match("m1"),
        match("m2", { dependencies: [dep("m1")] }),
      ],
    })
  );
  const byId = Object.fromEntries(
    result.plan.scheduled.map((s) => [s.matchId, s])
  );
  assert.ok(byId.m1.startUtcMs < byId.m2.startUtcMs);
  assert.ok(byId.m2.startUtcMs < byId.m3.startUtcMs);
});

test("29 branching dependencies", () => {
  const result = buildBaselineScheduleCandidate(
    request({
      operatingWindows: [
        { date: "2026-08-01", startMinutes: 480, endMinutes: 900 },
      ],
      matches: [
        match("final", {
          dependencies: [dep("sf1"), dep("sf2")],
        }),
        match("sf2"),
        match("sf1"),
      ],
    })
  );
  assert.equal(result.plan.scheduled.length, 3);
  const final = result.plan.scheduled.find((s) => s.matchId === "final");
  const sf1 = result.plan.scheduled.find((s) => s.matchId === "sf1");
  const sf2 = result.plan.scheduled.find((s) => s.matchId === "sf2");
  assert.ok(final.startUtcMs >= Math.max(sf1.endUtcMs, sf2.endUtcMs));
});

test("30 planned predecessor end controls dependent earliest start", () => {
  const result = buildBaselineScheduleCandidate(
    request({
      policy: basePolicy({
        duration: { defaultDurationMinutes: 30, bufferMinutes: 5 },
        capacity: { maxConcurrentMatches: 2 },
      }),
      matches: [match("m1"), match("m2", { dependencies: [dep("m1")] })],
    })
  );
  const m1 = result.plan.scheduled.find((s) => s.matchId === "m1");
  const m2 = result.plan.scheduled.find((s) => s.matchId === "m2");
  assert.equal(m2.startUtcMs, m1.endUtcMs + 5 * 60_000);
});

test("31 scheduled predecessor need not be completed", () => {
  const result = buildBaselineScheduleCandidate(
    request({
      matches: [match("m1"), match("m2", { dependencies: [dep("m1")] })],
    })
  );
  assert.equal(result.plan.scheduled.length, 2);
  assert.equal(result.plan.unscheduled.length, 0);
});

test("32 winner/loser identity is not inferred", () => {
  const src = readModuleSources();
  assert.equal(/inferWinner|inferLoser|resolveWinner|resolveLoser/.test(src), false);
  const result = buildBaselineScheduleCandidate(
    request({
      matches: [
        match("m1", {
          participants: [{ participantId: "p1" }, { participantId: "p2" }],
        }),
        match("m2", {
          dependencies: [dep("m1", SCHEDULE_DEPENDENCY_TYPE.WINNER_OF)],
          participants: [{ participantId: "__PENDING__" }],
        }),
      ],
    })
  );
  assert.equal(result.plan.scheduled.length, 2);
  assert.equal(
    result.plan.scheduled.find((s) => s.matchId === "m2").metadata
      ?.constraintCertification,
    CONSTRAINT_CERTIFICATION.BASELINE_ONLY
  );
});

test("33 dependency buffer applied", () => {
  const result = buildBaselineScheduleCandidate(
    request({
      policy: basePolicy({
        duration: { defaultDurationMinutes: 20, bufferMinutes: 15 },
        capacity: { maxConcurrentMatches: 2 },
      }),
      matches: [match("m1"), match("m2", { dependencies: [dep("m1")] })],
    })
  );
  const m1 = result.plan.scheduled.find((s) => s.matchId === "m1");
  const m2 = result.plan.scheduled.find((s) => s.matchId === "m2");
  assert.equal(m2.startUtcMs - m1.endUtcMs, 15 * 60_000);
});

test("34 multiple predecessor latest end selected", () => {
  const result = buildBaselineScheduleCandidate(
    request({
      operatingWindows: [
        { date: "2026-08-01", startMinutes: 480, endMinutes: 900 },
      ],
      policy: basePolicy({
        duration: { defaultDurationMinutes: 30, bufferMinutes: 5 },
        capacity: { maxConcurrentMatches: 1 },
      }),
      matches: [
        match("a"),
        match("b"),
        match("c", { dependencies: [dep("a"), dep("b")] }),
      ],
    })
  );
  const a = result.plan.scheduled.find((s) => s.matchId === "a");
  const b = result.plan.scheduled.find((s) => s.matchId === "b");
  const c = result.plan.scheduled.find((s) => s.matchId === "c");
  const latestEnd = Math.max(a.endUtcMs, b.endUtcMs);
  assert.equal(c.startUtcMs, latestEnd + 5 * 60_000);
});

test("35 bye match not placed", () => {
  const result = buildBaselineScheduleCandidate(
    request({ matches: [match("bye1", { isBye: true }), match("m1")] })
  );
  assert.equal(result.plan.scheduled.some((s) => s.matchId === "bye1"), false);
  assert.equal(result.plan.unscheduled.some((u) => u.matchId === "bye1"), false);
  assert.ok(
    codesOf(result).includes(SCHEDULE_DIAGNOSTIC_CODE.BYE_NO_SCHEDULE_REQUIRED)
  );
});

test("36 bye does not consume capacity", () => {
  const result = buildBaselineScheduleCandidate(
    request({
      policy: basePolicy({ capacity: { maxConcurrentMatches: 1 } }),
      matches: [
        match("bye1", { isBye: true }),
        match("m1"),
        match("m2"),
      ],
    })
  );
  assert.equal(result.plan.scheduled.length, 2);
  assert.equal(result.plan.scheduled[0].start.minutesFromMidnight, 480);
});

test("37 bye-only dependency creates no fabricated end", () => {
  const result = buildBaselineScheduleCandidate(
    request({
      matches: [
        match("bye1", { isBye: true }),
        match("m1", { dependencies: [dep("bye1")] }),
      ],
    })
  );
  assert.equal(result.plan.scheduled.length, 1);
  assert.equal(result.plan.scheduled[0].matchId, "m1");
  assert.equal(result.plan.scheduled[0].start.minutesFromMidnight, 480);
});

test("38 unscheduled predecessor blocks dependent placement", () => {
  const result = buildBaselineScheduleCandidate(
    request({
      operatingWindows: [
        { date: "2026-08-01", startMinutes: 480, endMinutes: 510 },
      ],
      policy: basePolicy({
        duration: { defaultDurationMinutes: 30, bufferMinutes: 0 },
        capacity: { maxConcurrentMatches: 1 },
      }),
      matches: [
        match("m1", { estimatedDurationMinutes: 60 }),
        match("m2", { dependencies: [dep("m1")] }),
      ],
    })
  );
  assert.equal(result.plan.scheduled.length, 0);
  const m2 = result.plan.unscheduled.find((u) => u.matchId === "m2");
  assert.equal(m2.reasonCode, SCHEDULE_DIAGNOSTIC_CODE.PREDECESSOR_UNSCHEDULED);
});

test("39 unknown dependency fails closed", () => {
  const result = buildBaselineScheduleCandidate(
    request({
      matches: [match("m1", { dependencies: [dep("missing")] })],
    })
  );
  assert.equal(result.ok, false);
  assert.equal(result.plan.scheduled.length, 0);
  assert.ok(
    codesOf(result).includes(SCHEDULE_DIAGNOSTIC_CODE.UNKNOWN_MATCH_DEPENDENCY)
  );
});

test("40 cyclic graph fails closed", () => {
  const result = buildBaselineScheduleCandidate(
    request({
      matches: [
        match("m1", { dependencies: [dep("m2")] }),
        match("m2", { dependencies: [dep("m1")] }),
      ],
    })
  );
  assert.equal(result.ok, false);
  assert.equal(result.plan.scheduled.length, 0);
  assert.ok(
    codesOf(result).includes(SCHEDULE_DIAGNOSTIC_CODE.CYCLIC_MATCH_DEPENDENCY)
  );
});

test("41 duplicate match ID fails closed", () => {
  const result = buildBaselineScheduleCandidate(
    request({
      matches: [match("m1"), match("m1")],
    })
  );
  assert.equal(result.ok, false);
  assert.ok(codesOf(result).includes(SCHEDULE_DIAGNOSTIC_CODE.DUPLICATE_MATCH_ID));
});

test("42 match placed at most once", () => {
  const result = buildBaselineScheduleCandidate(
    request({ matches: [match("m1"), match("m2")] })
  );
  const ids = result.plan.scheduled.map((s) => s.matchId);
  assert.equal(new Set(ids).size, ids.length);
});

test("43 scheduled/unscheduled mutual exclusion", () => {
  const result = buildBaselineScheduleCandidate(
    request({
      operatingWindows: [
        { date: "2026-08-01", startMinutes: 480, endMinutes: 510 },
      ],
      policy: basePolicy({
        duration: { defaultDurationMinutes: 30, bufferMinutes: 0 },
        capacity: { maxConcurrentMatches: 1 },
      }),
      matches: [match("m1"), match("m2")],
    })
  );
  const scheduledIds = new Set(result.plan.scheduled.map((s) => s.matchId));
  for (const u of result.plan.unscheduled) {
    assert.equal(scheduledIds.has(u.matchId), false);
  }
});

test("44 no feasible slot produces explicit unscheduled record", () => {
  const result = buildBaselineScheduleCandidate(
    request({
      operatingWindows: [
        { date: "2026-08-01", startMinutes: 480, endMinutes: 500 },
      ],
      matches: [match("m1")],
    })
  );
  assert.equal(result.plan.unscheduled.length, 1);
  assert.ok(result.plan.unscheduled[0].reasonCode);
});

test("45 capacity exhaustion diagnostic", () => {
  const result = buildBaselineScheduleCandidate(
    request({
      operatingWindows: [
        { date: "2026-08-01", startMinutes: 480, endMinutes: 510 },
      ],
      policy: basePolicy({
        duration: { defaultDurationMinutes: 30, bufferMinutes: 0 },
        capacity: { maxConcurrentMatches: 1 },
      }),
      matches: [match("m1"), match("m2")],
    })
  );
  assert.equal(result.plan.scheduled.length, 1);
  assert.equal(
    result.plan.unscheduled[0].reasonCode,
    SCHEDULE_DIAGNOSTIC_CODE.ABSTRACT_CAPACITY_EXHAUSTED
  );
});

test("46 deterministic unscheduled ordering", () => {
  const result = buildBaselineScheduleCandidate(
    request({
      operatingWindows: [
        { date: "2026-08-01", startMinutes: 480, endMinutes: 510 },
      ],
      policy: basePolicy({
        duration: { defaultDurationMinutes: 30, bufferMinutes: 0 },
        capacity: { maxConcurrentMatches: 1 },
      }),
      matches: [match("m3"), match("m1"), match("m2")],
    })
  );
  const ids = result.plan.unscheduled.map((u) => u.matchId);
  assert.deepEqual(ids, [...ids].sort());
});

test("47 BASELINE_ONLY certification marker", () => {
  const result = buildBaselineScheduleCandidate(
    request({ matches: [match("m1")] })
  );
  assert.equal(
    result.constraintCertification,
    CONSTRAINT_CERTIFICATION.BASELINE_ONLY
  );
  assert.equal(
    result.plan.metadata.constraintCertification,
    CONSTRAINT_CERTIFICATION.BASELINE_ONLY
  );
  assert.equal(
    result.plan.replay.details.constraintCertification,
    CONSTRAINT_CERTIFICATION.BASELINE_ONLY
  );
});

test("48 participant-overlap is placement-enforced (Phase 1E-R1)", () => {
  const result = buildBaselineScheduleCandidate(
    request({ matches: [match("m1")] })
  );
  assert.ok(
    result.plan.replay.details.certifiedConstraints.includes("PARTICIPANT_OVERLAP")
  );
  assert.equal(
    result.plan.replay.details.deferredConstraints.includes("PARTICIPANT_OVERLAP"),
    false
  );
  assert.ok(
    result.plan.replay.details.certifiedConstraints.includes("TEAM_OVERLAP")
  );
  assert.equal(
    result.plan.replay.details.deferredConstraints.includes("TEAM_OVERLAP"),
    false
  );
});

test("49 minimum-rest is placement-enforced (Phase 1E-R1)", () => {
  const result = buildBaselineScheduleCandidate(
    request({ matches: [match("m1")] })
  );
  assert.ok(
    result.plan.replay.details.certifiedConstraints.includes("INSUFFICIENT_REST")
  );
  assert.equal(
    result.plan.replay.details.deferredConstraints.includes("INSUFFICIENT_REST"),
    false
  );
  assert.ok(
    result.plan.replay.details.certifiedConstraints.includes("MIN_TEAM_REST")
  );
  assert.equal(
    result.plan.replay.details.deferredConstraints.includes("MIN_TEAM_REST"),
    false
  );
});

test("50 no physical court fields", () => {
  const result = buildBaselineScheduleCandidate(
    request({ matches: [match("m1")] })
  );
  const hits = collectForbiddenAssignmentFieldPaths(result.plan);
  assert.equal(
    hits.filter((h) =>
      ["courtId", "courtName", "courtNumber", "assignedCourt"].includes(h.field)
    ).length,
    0
  );
  for (const field of FORBIDDEN_CANONICAL_ASSIGNMENT_FIELDS) {
    if (String(field).includes("ourt")) {
      assert.equal(JSON.stringify(result.plan).includes(`"${field}"`), false);
    }
  }
});

test("51 no referee fields", () => {
  const result = buildBaselineScheduleCandidate(
    request({ matches: [match("m1")] })
  );
  assert.equal(JSON.stringify(result.plan).includes("refereeId"), false);
  assert.equal(JSON.stringify(result.plan).includes("assignedReferee"), false);
});

test("52 no persistence or UI import", () => {
  const src = readModuleSources();
  assert.equal(/from ['"].*supabase/i.test(src), false);
  assert.equal(/from ['"]react['"]/.test(src), false);
  assert.equal(/from ['"]@mui\//.test(src), false);
});

test("53 no CORE-09 private or CC-09 scheduling import", () => {
  const src = readModuleSources();
  assert.equal(
    /from ['"].*competition-core\/scheduling/.test(src),
    false
  );
  // Phase 1G-B1 adapters may import the public CORE-09 barrel only.
  const adapterFiles = listJsFiles(path.join(SE_ROOT, "adapters"));
  for (const file of listJsFiles(SE_ROOT)) {
    if (adapterFiles.includes(file)) continue;
    const text = readFileSync(file, "utf8");
    assert.equal(/from ['"].*match-generation/.test(text), false, file);
  }
  for (const file of adapterFiles) {
    const text = readFileSync(file, "utf8");
    if (!/match-generation/i.test(text)) continue;
    assert.match(
      text,
      /from ['"].*match-generation\/index\.js['"]/,
      `adapter must import CORE-09 public barrel: ${file}`
    );
    assert.equal(
      /from ['"].*match-generation\/(?!index\.js)/.test(text),
      false,
      file
    );
  }
});

test("54 no CORE-10 optimizer runtime", () => {
  const src = readModuleSources();
  assert.equal(/from ['"].*competition-core\/optimizer/.test(src), false);
  assert.equal(/optimizeSchedule\(/.test(src), false);
});

test("55 no CORE-12 implementation import", () => {
  const src = readModuleSources();
  assert.equal(/from ['"].*venue-court/.test(src), false);
  assert.equal(/from ['"].*court-engine/.test(src), false);
});

test("56 input immutability", () => {
  const req = request({
    matches: [match("m2"), match("m1")],
    operatingWindows: [
      { date: "2026-08-01", startMinutes: 600, endMinutes: 720 },
      { date: "2026-08-01", startMinutes: 480, endMinutes: 540 },
    ],
  });
  const before = JSON.stringify(req);
  buildBaselineScheduleCandidate(req);
  assert.equal(JSON.stringify(req), before);
});

test("57 Phase 1B contracts test suite remains present", () => {
  const p = path.join(
    ROOT,
    "tests/competition-core-schedule-engine-core11-phase1b-contracts.test.js"
  );
  assert.equal(existsSync(p), true);
  const text = readFileSync(p, "utf8");
  assert.ok(text.includes("valid minimal request"));
  assert.ok(text.includes("createSchedulePlan"));
});

test("58 Phase 1C time-windows test suite remains present", () => {
  const p = path.join(
    ROOT,
    "tests/competition-core-schedule-engine-core11-phase1c-time-windows.test.js"
  );
  assert.equal(existsSync(p), true);
  const text = readFileSync(p, "utf8");
  assert.ok(text.includes("normalizeOperatingWindows"));
  assert.ok(text.includes("convertCivilScheduleTimeToAbsolute"));
});

test("59 Phase 1D dependency-graph test suite remains present", () => {
  const p = path.join(
    ROOT,
    "tests/competition-core-schedule-engine-core11-phase1d-dependency-graph.test.js"
  );
  assert.equal(existsSync(p), true);
  const text = readFileSync(p, "utf8");
  assert.ok(text.includes("buildScheduleDependencyGraph"));
  assert.ok(text.includes("deriveDependencyEarliestStartAbsolute"));
});

test("60 no Date.now, Math.random or localeCompare in executable code", () => {
  for (const file of listJsFiles(SE_ROOT)) {
    const text = readFileSync(file, "utf8");
    const code = text
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/(^|[^:])\/\/.*$/gm, "$1");
    assert.equal(/Date\.now\s*\(/.test(code), false, file);
    assert.equal(/Math\.random\s*\(/.test(code), false, file);
    assert.equal(/\brandomUUID\s*\(/.test(code), false, file);
    assert.equal(/\.localeCompare\s*\(/.test(code), false, file);
    assert.equal(/\.getHours\s*\(/.test(code), false, file);
    assert.equal(/\.setHours\s*\(/.test(code), false, file);
    assert.equal(/\.getTimezoneOffset\s*\(/.test(code), false, file);
  }
});

test("61 BASELINE_CANDIDATE_INCOMPLETE when unscheduled remain", () => {
  const result = buildBaselineScheduleCandidate(
    request({
      operatingWindows: [
        { date: "2026-08-01", startMinutes: 480, endMinutes: 500 },
      ],
      matches: [match("m1")],
    })
  );
  assert.ok(
    codesOf(result).includes(SCHEDULE_DIAGNOSTIC_CODE.BASELINE_CANDIDATE_INCOMPLETE)
  );
});

test("62 placeMatchIntoCandidateSlot helper + no absolute-to-civil export", () => {
  const placed = placeMatchIntoCandidateSlot({
    match: match("m1"),
    durationMinutes: 30,
    bufferMinutes: 5,
    maxConcurrentMatches: 1,
    placementWindows: [
      {
        date: "2026-08-01",
        startMinutes: 480,
        endMinutes: 600,
        windowId: "ow1",
      },
    ],
    occupied: [],
    timezone: TZ,
    sequence: 0,
  });
  assert.equal(placed.ok, true);
  assert.equal(placed.scheduled.matchId, "m1");
  const indexText = readFileSync(path.join(SE_ROOT, "index.js"), "utf8");
  assert.equal(/convertAbsoluteToCivilScheduleTime/.test(indexText), false);
  const civilText = readFileSync(
    path.join(SE_ROOT, "scheduleCivilTime.js"),
    "utf8"
  );
  assert.equal(/export function convertAbsoluteToCivilScheduleTime/.test(civilText), false);
  assert.equal(/absoluteToCivilParts/.test(civilText), false);
});
