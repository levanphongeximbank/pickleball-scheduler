/**
 * CORE-11 Phase 1D — dependency graph & deterministic ordering (focused).
 */

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  SCHEDULE_DIAGNOSTIC_CODE,
  SCHEDULE_DEPENDENCY_TYPE,
  SCHEDULE_PREDECESSOR_STATE,
  buildScheduleDependencyGraph,
  topologicallyOrderScheduleMatches,
  evaluateSchedulePlanningReadiness,
  evaluateParticipantResolutionReadiness,
  evaluateMatchDependencyReadiness,
  deriveDependencyEarliestStartAbsolute,
  createScheduleMatchInput,
  convertCivilScheduleTimeToAbsolute,
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

function codesOf(result) {
  return (result.diagnostics || []).map((d) => d.code);
}

function match(id, deps = [], extra = {}) {
  return createScheduleMatchInput({
    matchId: id,
    dependencies: deps,
    ...extra,
  });
}

function dep(sourceMatchId, type) {
  return { sourceMatchId, type };
}

test("01 empty match graph", () => {
  const g = buildScheduleDependencyGraph([]);
  assert.equal(g.ok, true);
  assert.deepEqual(g.nodeIds, []);
  assert.deepEqual(g.edges, []);
});

test("02 single independent match", () => {
  const g = buildScheduleDependencyGraph([match("m1")]);
  assert.equal(g.ok, true);
  assert.deepEqual(g.nodeIds, ["m1"]);
  assert.equal(g.nodes[0].inDegree, 0);
  const order = topologicallyOrderScheduleMatches(g);
  assert.equal(order.ok, true);
  assert.deepEqual(order.order, ["m1"]);
});

test("03 multiple independent matches", () => {
  const g = buildScheduleDependencyGraph([match("m2"), match("m1"), match("m3")]);
  assert.equal(g.ok, true);
  assert.deepEqual(g.nodeIds, ["m1", "m2", "m3"]);
  const order = topologicallyOrderScheduleMatches(g);
  assert.deepEqual(order.order, ["m1", "m2", "m3"]);
});

test("04 linear dependency chain", () => {
  const g = buildScheduleDependencyGraph([
    match("m3", [dep("m2", SCHEDULE_DEPENDENCY_TYPE.PREVIOUS_ROUND)]),
    match("m1"),
    match("m2", [dep("m1", SCHEDULE_DEPENDENCY_TYPE.WINNER_OF)]),
  ]);
  assert.equal(g.ok, true);
  const order = topologicallyOrderScheduleMatches(g);
  assert.deepEqual(order.order, ["m1", "m2", "m3"]);
});

test("05 branching winner dependencies", () => {
  const g = buildScheduleDependencyGraph([
    match("final", [
      dep("sf1", SCHEDULE_DEPENDENCY_TYPE.WINNER_OF),
      dep("sf2", SCHEDULE_DEPENDENCY_TYPE.WINNER_OF),
    ]),
    match("sf2"),
    match("sf1"),
  ]);
  assert.equal(g.ok, true);
  const order = topologicallyOrderScheduleMatches(g);
  assert.ok(order.order.indexOf("sf1") < order.order.indexOf("final"));
  assert.ok(order.order.indexOf("sf2") < order.order.indexOf("final"));
});

test("06 winner and loser dependencies", () => {
  const g = buildScheduleDependencyGraph([
    match("bronze", [
      dep("sf1", SCHEDULE_DEPENDENCY_TYPE.LOSER_OF),
      dep("sf2", SCHEDULE_DEPENDENCY_TYPE.LOSER_OF),
    ]),
    match("sf1"),
    match("sf2"),
  ]);
  assert.equal(g.ok, true);
  assert.ok(
    g.edges.some(
      (e) =>
        e.type === SCHEDULE_DEPENDENCY_TYPE.LOSER_OF &&
        e.dependentMatchId === "bronze"
    )
  );
});

test("07 previous-round dependency", () => {
  const g = buildScheduleDependencyGraph([
    match("r2", [dep("r1", SCHEDULE_DEPENDENCY_TYPE.PREVIOUS_ROUND)]),
    match("r1"),
  ]);
  assert.equal(g.ok, true);
  assert.equal(g.edges[0].type, SCHEDULE_DEPENDENCY_TYPE.PREVIOUS_ROUND);
});

test("08 group-stage-complete dependency", () => {
  const g = buildScheduleDependencyGraph([
    match("ko1", [dep("g1", SCHEDULE_DEPENDENCY_TYPE.GROUP_STAGE_COMPLETE)]),
    match("g1"),
  ]);
  assert.equal(g.ok, true);
  assert.equal(g.edges[0].type, SCHEDULE_DEPENDENCY_TYPE.GROUP_STAGE_COMPLETE);
});

test("09 qualification dependency", () => {
  const g = buildScheduleDependencyGraph([
    match("main", [dep("qual", SCHEDULE_DEPENDENCY_TYPE.QUALIFICATION)]),
    match("qual"),
  ]);
  assert.equal(g.ok, true);
  assert.equal(g.edges[0].type, SCHEDULE_DEPENDENCY_TYPE.QUALIFICATION);
});

test("10 unknown source match", () => {
  const g = buildScheduleDependencyGraph([
    match("m1", [dep("missing", SCHEDULE_DEPENDENCY_TYPE.WINNER_OF)]),
  ]);
  assert.equal(g.ok, false);
  assert.ok(codesOf(g).includes(SCHEDULE_DIAGNOSTIC_CODE.UNKNOWN_MATCH_DEPENDENCY));
});

test("11 self-dependency", () => {
  const g = buildScheduleDependencyGraph([
    match("m1", [dep("m1", SCHEDULE_DEPENDENCY_TYPE.WINNER_OF)]),
  ]);
  assert.equal(g.ok, false);
  assert.ok(codesOf(g).includes(SCHEDULE_DIAGNOSTIC_CODE.SELF_MATCH_DEPENDENCY));
});

test("12 duplicate dependency edge", () => {
  const g = buildScheduleDependencyGraph([
    match("m2", [
      dep("m1", SCHEDULE_DEPENDENCY_TYPE.WINNER_OF),
      dep("m1", SCHEDULE_DEPENDENCY_TYPE.WINNER_OF),
    ]),
    match("m1"),
  ]);
  assert.equal(g.ok, false);
  assert.ok(codesOf(g).includes(SCHEDULE_DIAGNOSTIC_CODE.DUPLICATE_MATCH_DEPENDENCY));
});

test("13 duplicate match ID", () => {
  const g = buildScheduleDependencyGraph([match("m1"), match("m1")]);
  assert.equal(g.ok, false);
  assert.ok(codesOf(g).includes(SCHEDULE_DIAGNOSTIC_CODE.DUPLICATE_MATCH_ID));
});

test("14 direct two-node cycle", () => {
  const g = buildScheduleDependencyGraph([
    match("a", [dep("b", SCHEDULE_DEPENDENCY_TYPE.WINNER_OF)]),
    match("b", [dep("a", SCHEDULE_DEPENDENCY_TYPE.WINNER_OF)]),
  ]);
  assert.equal(g.ok, false);
  assert.ok(codesOf(g).includes(SCHEDULE_DIAGNOSTIC_CODE.CYCLIC_MATCH_DEPENDENCY));
});

test("15 three-node cycle", () => {
  const g = buildScheduleDependencyGraph([
    match("a", [dep("c", SCHEDULE_DEPENDENCY_TYPE.PREVIOUS_ROUND)]),
    match("b", [dep("a", SCHEDULE_DEPENDENCY_TYPE.PREVIOUS_ROUND)]),
    match("c", [dep("b", SCHEDULE_DEPENDENCY_TYPE.PREVIOUS_ROUND)]),
  ]);
  assert.equal(g.ok, false);
  assert.ok(codesOf(g).includes(SCHEDULE_DIAGNOSTIC_CODE.CYCLIC_MATCH_DEPENDENCY));
});

test("16 disconnected cycle", () => {
  const g = buildScheduleDependencyGraph([
    match("ok"),
    match("x", [dep("y", SCHEDULE_DEPENDENCY_TYPE.WINNER_OF)]),
    match("y", [dep("x", SCHEDULE_DEPENDENCY_TYPE.WINNER_OF)]),
  ]);
  assert.equal(g.ok, false);
  assert.ok(codesOf(g).includes(SCHEDULE_DIAGNOSTIC_CODE.CYCLIC_MATCH_DEPENDENCY));
});

test("17 acyclic disconnected components", () => {
  const g = buildScheduleDependencyGraph([
    match("b2", [dep("b1", SCHEDULE_DEPENDENCY_TYPE.WINNER_OF)]),
    match("a1"),
    match("b1"),
    match("a2", [dep("a1", SCHEDULE_DEPENDENCY_TYPE.WINNER_OF)]),
  ]);
  assert.equal(g.ok, true);
  const order = topologicallyOrderScheduleMatches(g);
  assert.equal(order.ok, true);
  assert.ok(order.order.indexOf("a1") < order.order.indexOf("a2"));
  assert.ok(order.order.indexOf("b1") < order.order.indexOf("b2"));
});

test("18 stable topological ordering", () => {
  const g = buildScheduleDependencyGraph([
    match("m1"),
    match("m2"),
    match("m3"),
  ]);
  const a = topologicallyOrderScheduleMatches(g);
  const b = topologicallyOrderScheduleMatches(g);
  assert.deepEqual(a.order, b.order);
});

test("19 input-order-independent graph", () => {
  const a = buildScheduleDependencyGraph([
    match("m2", [dep("m1", SCHEDULE_DEPENDENCY_TYPE.WINNER_OF)]),
    match("m1"),
  ]);
  const b = buildScheduleDependencyGraph([
    match("m1"),
    match("m2", [dep("m1", SCHEDULE_DEPENDENCY_TYPE.WINNER_OF)]),
  ]);
  assert.deepEqual(a.nodeIds, b.nodeIds);
  assert.deepEqual(a.edges, b.edges);
});

test("20 input-order-independent topological order", () => {
  const a = topologicallyOrderScheduleMatches(
    buildScheduleDependencyGraph([
      match("m2", [dep("m1", SCHEDULE_DEPENDENCY_TYPE.WINNER_OF)]),
      match("m1"),
    ])
  );
  const b = topologicallyOrderScheduleMatches(
    buildScheduleDependencyGraph([
      match("m1"),
      match("m2", [dep("m1", SCHEDULE_DEPENDENCY_TYPE.WINNER_OF)]),
    ])
  );
  assert.deepEqual(a.order, b.order);
});

test("21 round tie-break", () => {
  const g = buildScheduleDependencyGraph([
    match("late", [], { roundNumber: 2 }),
    match("early", [], { roundNumber: 1 }),
  ]);
  const order = topologicallyOrderScheduleMatches(g);
  assert.deepEqual(order.order, ["early", "late"]);
});

test("22 sequence tie-break", () => {
  const g = buildScheduleDependencyGraph([
    match("b", [], { sequence: 2 }),
    match("a", [], { sequence: 1 }),
  ]);
  const order = topologicallyOrderScheduleMatches(g);
  assert.deepEqual(order.order, ["a", "b"]);
});

test("23 priority tie-break", () => {
  // Higher priority number earlier.
  const g = buildScheduleDependencyGraph([
    match("low", [], { priority: 1 }),
    match("high", [], { priority: 10 }),
  ]);
  const order = topologicallyOrderScheduleMatches(g);
  assert.deepEqual(order.order, ["high", "low"]);
});

test("24 match-ID ASCII tie-break", () => {
  const g = buildScheduleDependencyGraph([match("mB"), match("mA")]);
  const order = topologicallyOrderScheduleMatches(g);
  assert.deepEqual(order.order, ["mA", "mB"]);
});

test("25 missing optional ordering values", () => {
  const g = buildScheduleDependencyGraph([
    match("withRound", [], { roundNumber: 1 }),
    match("noRound"),
  ]);
  const order = topologicallyOrderScheduleMatches(g);
  // Present roundNumber precedes missing (+∞).
  assert.deepEqual(order.order, ["withRound", "noRound"]);
});

test("26 every schedulable match appears once", () => {
  const g = buildScheduleDependencyGraph([
    match("m1"),
    match("bye1", [], { isBye: true }),
    match("m2", [dep("m1", SCHEDULE_DEPENDENCY_TYPE.WINNER_OF)]),
  ]);
  const order = topologicallyOrderScheduleMatches(g);
  assert.deepEqual([...order.order].sort(), ["m1", "m2"]);
  assert.equal(new Set(order.order).size, order.order.length);
  assert.ok(order.fullOrder.includes("bye1"));
  assert.equal(order.order.includes("bye1"), false);
});

test("27 cyclic graph returns no valid full order", () => {
  const g = buildScheduleDependencyGraph([
    match("a", [dep("b", SCHEDULE_DEPENDENCY_TYPE.WINNER_OF)]),
    match("b", [dep("a", SCHEDULE_DEPENDENCY_TYPE.WINNER_OF)]),
  ]);
  const order = topologicallyOrderScheduleMatches(g);
  assert.equal(order.ok, false);
  assert.deepEqual(order.order, []);
});

test("28 predecessor and successor arrays deterministically sorted", () => {
  const g = buildScheduleDependencyGraph([
    match("z", [
      dep("m2", SCHEDULE_DEPENDENCY_TYPE.WINNER_OF),
      dep("m1", SCHEDULE_DEPENDENCY_TYPE.LOSER_OF),
    ]),
    match("m1"),
    match("m2"),
  ]);
  const node = g.nodes.find((n) => n.matchId === "z");
  assert.deepEqual(
    node.predecessors.map((e) => `${e.sourceMatchId}:${e.type}`),
    ["m1:LOSER_OF", "m2:WINNER_OF"]
  );
  const m1 = g.nodes.find((n) => n.matchId === "m1");
  assert.deepEqual(
    m1.successors.map((e) => e.dependentMatchId),
    ["z"]
  );
});

test("29 unresolved readiness", () => {
  const g = buildScheduleDependencyGraph([
    match("m2", [dep("m1", SCHEDULE_DEPENDENCY_TYPE.WINNER_OF)]),
    match("m1"),
  ]);
  const planning = evaluateSchedulePlanningReadiness("m2", g, {});
  const participants = evaluateParticipantResolutionReadiness("m2", g, {});
  assert.equal(planning.planningReady, false);
  assert.equal(participants.participantResolutionReady, false);
  assert.equal(planning.blockers[0].state, SCHEDULE_PREDECESSOR_STATE.UNRESOLVED);
  assert.ok(codesOf(planning).includes(SCHEDULE_DIAGNOSTIC_CODE.DEPENDENCY_NOT_READY));
});

test("30 scheduled predecessor is planning-ready but not participant-resolution-ready", () => {
  const g = buildScheduleDependencyGraph([
    match("m2", [dep("m1", SCHEDULE_DEPENDENCY_TYPE.WINNER_OF)]),
    match("m1"),
  ]);
  const state = { m1: SCHEDULE_PREDECESSOR_STATE.SCHEDULED };
  const planning = evaluateSchedulePlanningReadiness("m2", g, state);
  const participants = evaluateParticipantResolutionReadiness("m2", g, state);
  assert.equal(planning.planningReady, true);
  assert.deepEqual(planning.blockers, []);
  assert.equal(participants.participantResolutionReady, false);
  assert.equal(
    participants.unresolvedParticipantDependencies[0].reason,
    "SCHEDULED_NOT_COMPLETED"
  );
});

test("31 completed predecessor is both planning and participant-resolution ready", () => {
  const g = buildScheduleDependencyGraph([
    match("m2", [dep("m1", SCHEDULE_DEPENDENCY_TYPE.WINNER_OF)]),
    match("m1"),
  ]);
  const state = { m1: SCHEDULE_PREDECESSOR_STATE.COMPLETED };
  assert.equal(evaluateSchedulePlanningReadiness("m2", g, state).planningReady, true);
  assert.equal(
    evaluateParticipantResolutionReadiness("m2", g, state).participantResolutionReady,
    true
  );
});

test("32 multiple predecessors report planning and participant blockers separately", () => {
  const g = buildScheduleDependencyGraph([
    match("final", [
      dep("sf1", SCHEDULE_DEPENDENCY_TYPE.WINNER_OF),
      dep("sf2", SCHEDULE_DEPENDENCY_TYPE.WINNER_OF),
    ]),
    match("sf1"),
    match("sf2"),
  ]);
  const state = {
    sf1: SCHEDULE_PREDECESSOR_STATE.SCHEDULED,
    // sf2 unresolved
  };
  const planning = evaluateSchedulePlanningReadiness("final", g, state);
  const participants = evaluateParticipantResolutionReadiness("final", g, state);
  assert.equal(planning.planningReady, false);
  assert.deepEqual(
    planning.blockers.map((b) => b.sourceMatchId),
    ["sf2"]
  );
  assert.equal(participants.participantResolutionReady, false);
  assert.deepEqual(
    participants.unresolvedParticipantDependencies.map((b) => b.sourceMatchId),
    ["sf1", "sf2"]
  );
});

test("33 bye predecessor is participant-resolution-ready", () => {
  const g = buildScheduleDependencyGraph([
    match("bye1", [], { isBye: true }),
    match("m2", [dep("bye1", SCHEDULE_DEPENDENCY_TYPE.WINNER_OF)]),
  ]);
  const planning = evaluateSchedulePlanningReadiness("m2", g, {});
  const participants = evaluateParticipantResolutionReadiness("m2", g, {});
  assert.equal(planning.planningReady, true);
  assert.equal(participants.participantResolutionReady, true);
});

test("34 invalid predecessor state", () => {
  const g = buildScheduleDependencyGraph([
    match("m2", [dep("m1", SCHEDULE_DEPENDENCY_TYPE.WINNER_OF)]),
    match("m1"),
  ]);
  const planning = evaluateSchedulePlanningReadiness("m2", g, { m1: "NOT_A_STATE" });
  assert.equal(planning.planningReady, false);
  assert.equal(planning.blockers[0].state, SCHEDULE_PREDECESSOR_STATE.INVALID);
});

test("34b scheduled predecessor with known end is timing-ready", () => {
  const g = buildScheduleDependencyGraph([
    match("m2", [dep("m1", SCHEDULE_DEPENDENCY_TYPE.WINNER_OF)]),
    match("m1"),
  ]);
  const end = convertCivilScheduleTimeToAbsolute({
    date: "2026-08-01",
    minutesFromMidnight: 600,
    timezone: TZ,
  });
  const timing = deriveDependencyEarliestStartAbsolute({
    matchId: "m2",
    graph: g,
    predecessorSchedule: { m1: { utcMs: end.utcMs, utcIso: end.utcIso } },
    bufferMinutes: 0,
    timezone: TZ,
  });
  assert.equal(timing.timingReady, true);
  assert.equal(timing.ok, true);
  assert.equal(timing.utcMs, end.utcMs);
  // Still not participant-resolution-ready while only SCHEDULED.
  assert.equal(
    evaluateParticipantResolutionReadiness("m2", g, {
      m1: SCHEDULE_PREDECESSOR_STATE.SCHEDULED,
    }).participantResolutionReady,
    false
  );
});

test("34c completed predecessor with missing end remains timing-unavailable", () => {
  const g = buildScheduleDependencyGraph([
    match("m2", [dep("m1", SCHEDULE_DEPENDENCY_TYPE.WINNER_OF)]),
    match("m1"),
  ]);
  assert.equal(
    evaluateParticipantResolutionReadiness("m2", g, {
      m1: SCHEDULE_PREDECESSOR_STATE.COMPLETED,
    }).participantResolutionReady,
    true
  );
  const timing = deriveDependencyEarliestStartAbsolute({
    matchId: "m2",
    graph: g,
    predecessorSchedule: {},
    bufferMinutes: 0,
    timezone: TZ,
  });
  assert.equal(timing.timingReady, false);
  assert.ok(
    codesOf(timing).includes(SCHEDULE_DIAGNOSTIC_CODE.DEPENDENCY_TIMING_UNAVAILABLE)
  );
});

test("34d combined evaluator exposes no ambiguous ready boolean", () => {
  const g = buildScheduleDependencyGraph([
    match("m2", [dep("m1", SCHEDULE_DEPENDENCY_TYPE.WINNER_OF)]),
    match("m1"),
  ]);
  const combined = evaluateMatchDependencyReadiness("m2", g, {
    m1: SCHEDULE_PREDECESSOR_STATE.SCHEDULED,
  });
  assert.equal("ready" in combined, false);
  assert.equal(combined.planningReady, true);
  assert.equal(combined.participantResolutionReady, false);
});

test("35 earliest lower bound from one predecessor", () => {
  const g = buildScheduleDependencyGraph([
    match("m2", [dep("m1", SCHEDULE_DEPENDENCY_TYPE.WINNER_OF)]),
    match("m1"),
  ]);
  const end = convertCivilScheduleTimeToAbsolute({
    date: "2026-08-01",
    minutesFromMidnight: 600,
    timezone: TZ,
  });
  const result = deriveDependencyEarliestStartAbsolute({
    matchId: "m2",
    graph: g,
    predecessorSchedule: {
      m1: { end: { date: "2026-08-01", minutesFromMidnight: 600 }, timezone: TZ },
    },
    bufferMinutes: 0,
    timezone: TZ,
  });
  assert.equal(result.ok, true);
  assert.equal(result.utcMs, end.utcMs);
});

test("36 earliest lower bound from multiple predecessors", () => {
  const g = buildScheduleDependencyGraph([
    match("final", [
      dep("sf1", SCHEDULE_DEPENDENCY_TYPE.WINNER_OF),
      dep("sf2", SCHEDULE_DEPENDENCY_TYPE.WINNER_OF),
    ]),
    match("sf1"),
    match("sf2"),
  ]);
  const later = convertCivilScheduleTimeToAbsolute({
    date: "2026-08-01",
    minutesFromMidnight: 720,
    timezone: TZ,
  });
  const result = deriveDependencyEarliestStartAbsolute({
    matchId: "final",
    graph: g,
    predecessorSchedule: {
      sf1: { end: { date: "2026-08-01", minutesFromMidnight: 600 }, timezone: TZ },
      sf2: { end: { date: "2026-08-01", minutesFromMidnight: 720 }, timezone: TZ },
    },
    bufferMinutes: 0,
    timezone: TZ,
  });
  assert.equal(result.ok, true);
  assert.equal(result.utcMs, later.utcMs);
  assert.ok(result.contributingPredecessorIds.includes("sf2"));
});

test("37 explicit dependency buffer", () => {
  const g = buildScheduleDependencyGraph([
    match("m2", [dep("m1", SCHEDULE_DEPENDENCY_TYPE.WINNER_OF)]),
    match("m1"),
  ]);
  const end = convertCivilScheduleTimeToAbsolute({
    date: "2026-08-01",
    minutesFromMidnight: 600,
    timezone: TZ,
  });
  const result = deriveDependencyEarliestStartAbsolute({
    matchId: "m2",
    graph: g,
    predecessorSchedule: {
      m1: { utcMs: end.utcMs, utcIso: end.utcIso },
    },
    bufferMinutes: 15,
    timezone: TZ,
  });
  assert.equal(result.ok, true);
  assert.equal(result.utcMs, end.utcMs + 15 * 60_000);
});

test("38 missing predecessor timing", () => {
  const g = buildScheduleDependencyGraph([
    match("m2", [dep("m1", SCHEDULE_DEPENDENCY_TYPE.WINNER_OF)]),
    match("m1"),
  ]);
  const result = deriveDependencyEarliestStartAbsolute({
    matchId: "m2",
    graph: g,
    predecessorSchedule: {},
    bufferMinutes: 0,
    timezone: TZ,
  });
  assert.equal(result.ok, false);
  assert.ok(
    codesOf(result).includes(SCHEDULE_DIAGNOSTIC_CODE.DEPENDENCY_TIMING_UNAVAILABLE)
  );
});

test("39 invalid buffer", () => {
  const g = buildScheduleDependencyGraph([
    match("m2", [dep("m1", SCHEDULE_DEPENDENCY_TYPE.WINNER_OF)]),
    match("m1"),
  ]);
  const result = deriveDependencyEarliestStartAbsolute({
    matchId: "m2",
    graph: g,
    predecessorSchedule: {
      m1: { utcMs: 1_000_000 },
    },
    bufferMinutes: -1,
    timezone: TZ,
  });
  assert.equal(result.ok, false);
  assert.ok(codesOf(result).includes(SCHEDULE_DIAGNOSTIC_CODE.BUFFER_DURATION_INVALID));
});

test("40 civil predecessor time converted through Phase 1C SSOT", () => {
  const g = buildScheduleDependencyGraph([
    match("m2", [dep("m1", SCHEDULE_DEPENDENCY_TYPE.WINNER_OF)]),
    match("m1"),
  ]);
  const viaPhase1c = convertCivilScheduleTimeToAbsolute({
    date: "2026-08-01",
    minutesFromMidnight: 480,
    timezone: TZ,
  });
  const result = deriveDependencyEarliestStartAbsolute({
    matchId: "m2",
    graph: g,
    predecessorSchedule: {
      m1: {
        end: { date: "2026-08-01", minutesFromMidnight: 480 },
        timezone: TZ,
      },
    },
    bufferMinutes: 0,
    timezone: TZ,
  });
  assert.equal(result.ok, true);
  assert.equal(result.utcMs, viaPhase1c.utcMs);
  assert.equal(result.utcIso, viaPhase1c.utcIso);
});

test("41 input immutability", () => {
  const matches = [
    match("m2", [dep("m1", SCHEDULE_DEPENDENCY_TYPE.WINNER_OF)]),
    match("m1"),
  ];
  const before = JSON.stringify(matches);
  const g = buildScheduleDependencyGraph(matches);
  topologicallyOrderScheduleMatches(g, matches);
  evaluateMatchDependencyReadiness("m2", g, { m1: "COMPLETED" });
  assert.equal(JSON.stringify(matches), before);
  const a = evaluateSchedulePlanningReadiness("m2", g, {
    m1: SCHEDULE_PREDECESSOR_STATE.SCHEDULED,
  });
  const b = evaluateSchedulePlanningReadiness("m2", g, {
    m1: SCHEDULE_PREDECESSOR_STATE.SCHEDULED,
  });
  assert.deepEqual(a, b);
});

test("42 deterministic repeated execution", () => {
  const matches = [
    match("m3", [dep("m1", SCHEDULE_DEPENDENCY_TYPE.WINNER_OF)]),
    match("m2"),
    match("m1"),
  ];
  const a = buildScheduleDependencyGraph(matches);
  const b = buildScheduleDependencyGraph(matches);
  assert.deepEqual(a, b);
  assert.deepEqual(
    topologicallyOrderScheduleMatches(a),
    topologicallyOrderScheduleMatches(b)
  );
});

test("43 no match-result inference", () => {
  const text = readFileSync(
    path.join(SE_ROOT, "scheduleDependencyReadiness.js"),
    "utf8"
  );
  assert.equal(/winnerId|loserId|matchResult|scoreA|scoreB/.test(text), false);
});

test("44 no lifecycle mutation", () => {
  const text = readFileSync(
    path.join(SE_ROOT, "scheduleDependencyReadiness.js"),
    "utf8"
  );
  assert.equal(/setStatus|advanceLifecycle|mutateLifecycle/.test(text), false);
});

test("45 no slot/session assignment", () => {
  const g = buildScheduleDependencyGraph([match("m1")]);
  const order = topologicallyOrderScheduleMatches(g);
  assert.equal("sessionId" in order, false);
  assert.equal("slots" in order, false);
  assert.equal("abstractSlotIndex" in (g.nodes[0] || {}), false);
});

test("46 no physical court or referee fields", () => {
  const g = buildScheduleDependencyGraph([match("m1")]);
  const json = JSON.stringify(g);
  assert.equal(/"courtId"/.test(json), false);
  assert.equal(/"refereeId"/.test(json), false);
});

test("47 bye-only earliest-start does not fabricate end time", () => {
  const g = buildScheduleDependencyGraph([
    match("bye1", [], { isBye: true }),
    match("m2", [dep("bye1", SCHEDULE_DEPENDENCY_TYPE.WINNER_OF)]),
  ]);
  const result = deriveDependencyEarliestStartAbsolute({
    matchId: "m2",
    graph: g,
    predecessorSchedule: {},
    bufferMinutes: 0,
    timezone: TZ,
  });
  assert.equal(result.ok, false);
  assert.ok(
    codesOf(result).includes(SCHEDULE_DIAGNOSTIC_CODE.DEPENDENCY_TIMING_UNAVAILABLE)
  );
});

test("48 unsupported dependency type fails closed", () => {
  const g = buildScheduleDependencyGraph([
    match("m2", [dep("m1", "NOT_A_REAL_TYPE")]),
    match("m1"),
  ]);
  assert.equal(g.ok, false);
  assert.ok(codesOf(g).includes(SCHEDULE_DIAGNOSTIC_CODE.INVALID_SCHEDULE_REQUEST));
});

test("49 no CORE-09 / scheduler / optimizer / persistence / UI import", () => {
  const files = listJsFiles(SE_ROOT);
  for (const file of files) {
    const text = readFileSync(file, "utf8");
    assert.equal(/from\s+['"]react['"]/i.test(text), false, file);
    assert.equal(/from\s+['"]@mui\//i.test(text), false, file);
    assert.equal(/from\s+['"][^'"]*supabase/i.test(text), false, file);
    assert.equal(/from\s+['"][^'"]*match-generation/i.test(text), false, file);
    assert.equal(/from\s+['"][^'"]*scheduling\//i.test(text), false, file);
    assert.equal(
      /from\s+['"][^'"]*\/(persistence|repositories)\//i.test(text),
      false,
      file
    );
  }
});

test("50 no Date.now Math.random localeCompare in executable code", () => {
  for (const file of listJsFiles(SE_ROOT)) {
    const text = readFileSync(file, "utf8");
    const code = text
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/(^|[^:])\/\/.*$/gm, "$1");
    assert.equal(/Date\.now\s*\(/.test(code), false, file);
    assert.equal(/Math\.random\s*\(/.test(code), false, file);
    assert.equal(/\.localeCompare\s*\(/.test(code), false, file);
  }
});
