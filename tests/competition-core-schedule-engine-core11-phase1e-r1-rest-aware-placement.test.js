/**
 * CORE-11 Phase 1E-R1 — participant/resource rest-aware baseline placement.
 *
 * Traceability 1–43: docs/competition-engine/core-11/09_PHASE_1I_BLOCKER_REST_AWARE_PLACEMENT.md
 *
 * Remediates the Phase 1I blocker: minParticipantRestMinutes must bind placement,
 * independently of capacity/dependency buffers. Does not complete Phase 1I.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  PARTICIPANT_REFERENCE_KIND,
  SCHEDULE_DEPENDENCY_TYPE,
  CONSTRAINT_CERTIFICATION,
  BASELINE_CANDIDATE_STATUS,
  SCHEDULE_DIAGNOSTIC_CODE,
  createScheduleRequest,
  createScheduleMatchInput,
  createSchedulePolicy,
  createScheduleParticipantReference,
  createScheduleDependency,
  createSchedulePlan,
  buildBaselineScheduleCandidate,
  certifyBaselineScheduleCandidateConstraints,
  fingerprintScheduleRequest,
  fingerprintBaselineScheduleCandidate,
} from "../src/features/competition-core/schedule-engine/index.js";

import {
  COURT_ASSIGNMENT_STATUS,
  COURT_AVAILABILITY_STATUS,
  fingerprintValue,
} from "../src/features/competition-core/court-assignment/index.js";

import { assignCourtsFromCertifiedSchedule } from "../src/features/competition-core/integration/index.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BASELINE_SRC = path.join(
  ROOT,
  "src/features/competition-core/schedule-engine/baselineScheduleCandidate.js"
);
const TZ = "Asia/Ho_Chi_Minh";
const DATE = "2026-08-01";

function player(id, extra = {}) {
  return createScheduleParticipantReference({
    participantId: id,
    kind: PARTICIPANT_REFERENCE_KIND.PLAYER,
    ...extra,
  });
}

function team(id, extra = {}) {
  return createScheduleParticipantReference({
    participantId: id,
    kind: PARTICIPANT_REFERENCE_KIND.TEAM,
    ...extra,
  });
}

function entry(id, extra = {}) {
  return createScheduleParticipantReference({
    participantId: id,
    kind: PARTICIPANT_REFERENCE_KIND.ENTRY,
    ...extra,
  });
}

function match(id, participants, extra = {}) {
  return createScheduleMatchInput({
    matchId: id,
    participants,
    ...extra,
  });
}

function policy(overrides = {}) {
  return createSchedulePolicy({
    duration: {
      defaultDurationMinutes: 30,
      bufferMinutes: 0,
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

function request(partial = {}) {
  return createScheduleRequest({
    competitionId: "comp-1e-r1",
    timezone: TZ,
    policy: policy(),
    operatingWindows: [{ date: DATE, startMinutes: 480, endMinutes: 1080 }],
    matches: [],
    ...partial,
  });
}

function scheduledOf(candidate, matchId) {
  return candidate.plan.scheduled.find((s) => s.matchId === matchId);
}

function restGapMinutes(earlier, later) {
  return (later.startUtcMs - earlier.endUtcMs) / 60_000;
}

function deepFreezeClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function assertUnmutated(original, live) {
  assert.deepEqual(live, original);
}

/* -------------------------------------------------------------------------- */
/* Basic rest placement (1–8)                                                  */
/* -------------------------------------------------------------------------- */

test("1E-R1-01..08 basic rest placement", () => {
  // 1 — shared PLAYER, rest 15, buffers 0
  {
    const req = request({
      matches: [
        match("m1", [player("P1"), player("P2")]),
        match("m2", [player("P1"), player("P3")]),
      ],
      policy: policy({ capacity: { maxConcurrentMatches: 2 } }),
    });
    const cand = buildBaselineScheduleCandidate(req);
    const m1 = scheduledOf(cand, "m1");
    const m2 = scheduledOf(cand, "m2");
    assert.ok(m1 && m2);
    assert.ok(m2.start.minutesFromMidnight >= m1.end.minutesFromMidnight + 15);
    assert.ok(restGapMinutes(m1, m2) >= 15);
  }

  // 2 — shared TEAM with minTeamRestMinutes
  {
    const req = request({
      policy: policy({
        rest: { minParticipantRestMinutes: 0, minTeamRestMinutes: 15 },
      }),
      matches: [
        match("m1", [team("T1"), team("T2")]),
        match("m2", [team("T1"), team("T3")]),
      ],
    });
    const cand = buildBaselineScheduleCandidate(req);
    const m1 = scheduledOf(cand, "m1");
    const m2 = scheduledOf(cand, "m2");
    assert.ok(restGapMinutes(m1, m2) >= 15);
  }

  // 3 — shared ENTRY (TEAM-kind resources) with minTeamRestMinutes
  {
    const req = request({
      policy: policy({
        rest: { minParticipantRestMinutes: 0, minTeamRestMinutes: 15 },
      }),
      matches: [
        match("m1", [entry("E1"), entry("E2")]),
        match("m2", [entry("E1"), entry("E3")]),
      ],
    });
    const cand = buildBaselineScheduleCandidate(req);
    assert.ok(
      restGapMinutes(scheduledOf(cand, "m1"), scheduledOf(cand, "m2")) >= 15
    );
  }

  // 4 — disjoint resources not delayed
  {
    const req = request({
      matches: [
        match("m1", [player("A"), player("B")]),
        match("m2", [player("C"), player("D")]),
      ],
    });
    const cand = buildBaselineScheduleCandidate(req);
    const m1 = scheduledOf(cand, "m1");
    const m2 = scheduledOf(cand, "m2");
    assert.equal(m1.start.minutesFromMidnight, 480);
    assert.equal(m2.start.minutesFromMidnight, 480);
  }

  // 5 — rest zero: no concurrent reuse; may touch at prior end (no artificial gap)
  {
    const req = request({
      policy: policy({
        rest: { minParticipantRestMinutes: 0, minTeamRestMinutes: 0 },
        capacity: { maxConcurrentMatches: 2 },
      }),
      matches: [
        match("m1", [player("P1"), player("P2")]),
        match("m2", [player("P1"), player("P3")]),
      ],
    });
    const cand = buildBaselineScheduleCandidate(req);
    const m1 = scheduledOf(cand, "m1");
    const m2 = scheduledOf(cand, "m2");
    assert.equal(m2.startUtcMs, m1.endUtcMs);
    assert.equal(restGapMinutes(m1, m2), 0);
    assert.ok(m2.startUtcMs >= m1.endUtcMs);
  }

  // 6–8 — rest from actual end, not capacityRelease; not capacity/dependency buffer
  {
    const req = request({
      policy: policy({
        duration: { defaultDurationMinutes: 30, bufferMinutes: 10 },
        rest: { minParticipantRestMinutes: 15, minTeamRestMinutes: 0 },
        capacity: { maxConcurrentMatches: 1 },
      }),
      matches: [
        match("m1", [player("P1"), player("P2")]),
        match("m2", [player("P1"), player("P3")]),
      ],
    });
    const cand = buildBaselineScheduleCandidate(req);
    const m1 = scheduledOf(cand, "m1");
    const m2 = scheduledOf(cand, "m2");
    assert.equal(m1.capacityReleaseUtcMs, m1.endUtcMs + 10 * 60_000);
    // Rest anchors at end, not capacity release → start = end + 15, not release + 15
    assert.equal(m2.startUtcMs, m1.endUtcMs + 15 * 60_000);
    assert.notEqual(m2.startUtcMs, m1.capacityReleaseUtcMs + 15 * 60_000);
    assert.notEqual(m2.startUtcMs, m1.endUtcMs + 10 * 60_000);
  }
});

/* -------------------------------------------------------------------------- */
/* Multiple resources (9–12)                                                   */
/* -------------------------------------------------------------------------- */

test("1E-R1-09..12 multiple resources", () => {
  // 9 — later of two shared resources wins
  {
    const req = request({
      policy: policy({ capacity: { maxConcurrentMatches: 2 } }),
      matches: [
        match("m1", [player("R1"), player("X1")], {
          estimatedDurationMinutes: 30,
          sequence: 1,
        }),
        match("m2", [player("R2"), player("X2")], {
          estimatedDurationMinutes: 60,
          sequence: 2,
        }),
        match("m3", [player("R1"), player("R2")], {
          sequence: 3,
        }),
      ],
    });
    const cand = buildBaselineScheduleCandidate(req);
    const early = scheduledOf(cand, "m1");
    const late = scheduledOf(cand, "m2");
    const both = scheduledOf(cand, "m3");
    assert.ok(early && late && both);
    const required = Math.max(early.endUtcMs, late.endUtcMs) + 15 * 60_000;
    assert.ok(both.startUtcMs >= required);
  }

  // 10 — duplicate constraintResourceIds do not multiply rest
  {
    const req = request({
      policy: policy({ capacity: { maxConcurrentMatches: 1 } }),
      matches: [
        match("m1", [
          player("P1", { constraintResourceIds: ["shared", "shared"] }),
          player("P2"),
        ]),
        match("m2", [
          player("P3", { constraintResourceIds: ["shared"] }),
          player("P4"),
        ]),
      ],
    });
    const cand = buildBaselineScheduleCandidate(req);
    assert.equal(
      restGapMinutes(scheduledOf(cand, "m1"), scheduledOf(cand, "m2")),
      15
    );
  }

  // 11–12 — resource input order / normalization stable
  {
    const a = request({
      matches: [
        match("m1", [
          player("P1", { constraintResourceIds: ["z", "a"] }),
          player("P2"),
        ]),
        match("m2", [
          player("P3", { constraintResourceIds: ["a", "z"] }),
          player("P4"),
        ]),
      ],
    });
    const b = request({
      matches: [
        match("m1", [
          player("P1", { constraintResourceIds: ["a", "z"] }),
          player("P2"),
        ]),
        match("m2", [
          player("P3", { constraintResourceIds: ["z", "a"] }),
          player("P4"),
        ]),
      ],
    });
    const ca = buildBaselineScheduleCandidate(a);
    const cb = buildBaselineScheduleCandidate(b);
    assert.equal(
      fingerprintBaselineScheduleCandidate(ca),
      fingerprintBaselineScheduleCandidate(cb)
    );
    assert.deepEqual(
      a.matches[0].participants[0].constraintResourceIds,
      ["a", "z"]
    );
  }
});

/* -------------------------------------------------------------------------- */
/* Dependency interaction (13–16)                                              */
/* -------------------------------------------------------------------------- */

test("1E-R1-13..16 dependency interaction", () => {
  // 13 — dependency earlier than rest → rest wins
  {
    const req = request({
      policy: policy({
        duration: { defaultDurationMinutes: 30, bufferMinutes: 0 },
        rest: { minParticipantRestMinutes: 15, minTeamRestMinutes: 0 },
        capacity: { maxConcurrentMatches: 1 },
      }),
      matches: [
        match("m1", [player("P1"), player("P2")]),
        match("m2", [player("P1"), player("P3")], {
          dependencies: [
            createScheduleDependency({
              sourceMatchId: "m1",
              type: SCHEDULE_DEPENDENCY_TYPE.PREVIOUS_ROUND,
            }),
          ],
        }),
      ],
    });
    const cand = buildBaselineScheduleCandidate(req);
    const m1 = scheduledOf(cand, "m1");
    const m2 = scheduledOf(cand, "m2");
    // dependency alone → end+0; rest → end+15
    assert.equal(m2.startUtcMs, m1.endUtcMs + 15 * 60_000);
  }

  // 14 — rest earlier than dependency → dependency wins
  {
    const req = request({
      policy: policy({
        duration: { defaultDurationMinutes: 30, bufferMinutes: 20 },
        rest: { minParticipantRestMinutes: 5, minTeamRestMinutes: 0 },
        capacity: { maxConcurrentMatches: 1 },
      }),
      matches: [
        match("m1", [player("P1"), player("P2")]),
        match("m2", [player("Q1"), player("Q2")], {
          dependencies: [
            createScheduleDependency({
              sourceMatchId: "m1",
              type: SCHEDULE_DEPENDENCY_TYPE.PREVIOUS_ROUND,
            }),
          ],
        }),
      ],
    });
    const cand = buildBaselineScheduleCandidate(req);
    const m1 = scheduledOf(cand, "m1");
    const m2 = scheduledOf(cand, "m2");
    // disjoint participants: dependency buffer 20 wins over rest (none shared)
    assert.equal(m2.startUtcMs, m1.endUtcMs + 20 * 60_000);
  }

  // 15 — dependency buffer and rest combine via max (not sum)
  {
    const req = request({
      policy: policy({
        duration: { defaultDurationMinutes: 30, bufferMinutes: 10 },
        rest: { minParticipantRestMinutes: 15, minTeamRestMinutes: 0 },
        capacity: { maxConcurrentMatches: 1 },
      }),
      matches: [
        match("m1", [player("P1"), player("P2")]),
        match("m2", [player("P1"), player("P3")], {
          dependencies: [
            createScheduleDependency({
              sourceMatchId: "m1",
              type: SCHEDULE_DEPENDENCY_TYPE.PREVIOUS_ROUND,
            }),
          ],
        }),
      ],
    });
    const cand = buildBaselineScheduleCandidate(req);
    const m1 = scheduledOf(cand, "m1");
    const m2 = scheduledOf(cand, "m2");
    assert.equal(m2.startUtcMs, m1.endUtcMs + 15 * 60_000);
    assert.notEqual(m2.startUtcMs, m1.endUtcMs + 25 * 60_000);
  }

  // 16 — dependent match with disjoint participants respects dependency only
  {
    const req = request({
      policy: policy({
        duration: { defaultDurationMinutes: 30, bufferMinutes: 0 },
        rest: { minParticipantRestMinutes: 15, minTeamRestMinutes: 0 },
        capacity: { maxConcurrentMatches: 1 },
      }),
      matches: [
        match("m1", [player("P1"), player("P2")]),
        match("m2", [player("Q1"), player("Q2")], {
          dependencies: [
            createScheduleDependency({
              sourceMatchId: "m1",
              type: SCHEDULE_DEPENDENCY_TYPE.PREVIOUS_ROUND,
            }),
          ],
        }),
      ],
    });
    const cand = buildBaselineScheduleCandidate(req);
    const m1 = scheduledOf(cand, "m1");
    const m2 = scheduledOf(cand, "m2");
    assert.equal(m2.startUtcMs, m1.endUtcMs);
  }
});

/* -------------------------------------------------------------------------- */
/* Capacity interaction (17–21)                                                */
/* -------------------------------------------------------------------------- */

test("1E-R1-17..21 capacity interaction", () => {
  // 17 — capacity later than rest → capacity wins
  {
    const req = request({
      policy: policy({
        rest: { minParticipantRestMinutes: 5, minTeamRestMinutes: 0 },
        capacity: { maxConcurrentMatches: 1 },
        duration: { defaultDurationMinutes: 30, bufferMinutes: 0 },
      }),
      matches: [
        match("m1", [player("A"), player("B")]),
        match("m2", [player("C"), player("D")]),
        // m3 shares A with m1; rest alone → 08:35, but capacity lane free only at 08:30
        // With maxConcurrent=1: m1 08:00, m2 08:30, m3 after m2 release OR rest from A
        match("m3", [player("A"), player("E")]),
      ],
    });
    const cand = buildBaselineScheduleCandidate(req);
    const m1 = scheduledOf(cand, "m1");
    const m2 = scheduledOf(cand, "m2");
    const m3 = scheduledOf(cand, "m3");
    const restBound = m1.endUtcMs + 5 * 60_000;
    const capacityBound = m2.capacityReleaseUtcMs;
    assert.ok(m3.startUtcMs >= Math.max(restBound, capacityBound));
  }

  // 18 — rest later than capacity → rest wins (blocker shape)
  {
    const req = request({
      policy: policy({
        rest: { minParticipantRestMinutes: 15, minTeamRestMinutes: 0 },
        capacity: { maxConcurrentMatches: 2 },
        duration: { defaultDurationMinutes: 30, bufferMinutes: 0 },
      }),
      matches: [
        match("m1", [player("P1"), player("P2")]),
        match("m2", [player("P3"), player("P4")]),
        match("m3", [player("P1"), player("P5")]),
      ],
    });
    const cand = buildBaselineScheduleCandidate(req);
    const m1 = scheduledOf(cand, "m1");
    const m3 = scheduledOf(cand, "m3");
    // capacity free at 08:30; rest requires 08:45
    assert.equal(m3.start.minutesFromMidnight, 525);
    assert.equal(m3.startUtcMs, m1.endUtcMs + 15 * 60_000);
  }

  // 19–21 — concurrent disjoint allowed; concurrencyIndex abstract; no lane→resource
  {
    const req = request({
      matches: [
        match("m1", [player("A"), player("B")]),
        match("m2", [player("C"), player("D")]),
      ],
    });
    const cand = buildBaselineScheduleCandidate(req);
    const m1 = scheduledOf(cand, "m1");
    const m2 = scheduledOf(cand, "m2");
    assert.equal(m1.startUtcMs, m2.startUtcMs);
    assert.notEqual(m1.concurrencyIndex, m2.concurrencyIndex);
    assert.equal(typeof m1.concurrencyIndex, "number");
    const src = readFileSync(BASELINE_SRC, "utf8");
    assert.equal(/lane.*court|courtId\s*=\s*concurrency/i.test(src), false);
  }
});

/* -------------------------------------------------------------------------- */
/* Windows and infeasibility (22–26)                                           */
/* -------------------------------------------------------------------------- */

test("1E-R1-22..26 windows and infeasibility", () => {
  // 22 — rest-aware start fits same session
  {
    const req = request({
      operatingWindows: [{ date: DATE, startMinutes: 480, endMinutes: 900 }],
      sessionWindows: [
        {
          sessionId: "s1",
          date: DATE,
          startMinutes: 480,
          endMinutes: 720,
        },
      ],
      matches: [
        match("m1", [player("P1"), player("P2")]),
        match("m2", [player("P1"), player("P3")]),
      ],
      policy: policy({ capacity: { maxConcurrentMatches: 1 } }),
    });
    const cand = buildBaselineScheduleCandidate(req);
    const m2 = scheduledOf(cand, "m2");
    assert.equal(m2.sessionId, "s1");
    assert.equal(m2.start.minutesFromMidnight, 525);
  }

  // 23 — advance to later session when first cannot host rest-aware start
  {
    const req = request({
      operatingWindows: [{ date: DATE, startMinutes: 480, endMinutes: 900 }],
      sessionWindows: [
        {
          sessionId: "s-early",
          date: DATE,
          startMinutes: 480,
          endMinutes: 520,
        },
        {
          sessionId: "s-late",
          date: DATE,
          startMinutes: 540,
          endMinutes: 720,
        },
      ],
      matches: [
        match("m1", [player("P1"), player("P2")], {
          estimatedDurationMinutes: 30,
        }),
        match("m2", [player("P1"), player("P3")]),
      ],
      policy: policy({
        capacity: { maxConcurrentMatches: 1 },
        duration: { defaultDurationMinutes: 30, bufferMinutes: 0 },
      }),
    });
    const cand = buildBaselineScheduleCandidate(req);
    const m1 = scheduledOf(cand, "m1");
    const m2 = scheduledOf(cand, "m2");
    // m1 08:00–08:30 in s-early; rest → 08:45 cannot fit s-early (ends 08:40)
    assert.ok(m1);
    assert.ok(m2);
    assert.equal(m2.sessionId, "s-late");
    assert.ok(m2.start.minutesFromMidnight >= 540);
  }

  // 24–25 — no rest-legal slot → unscheduled; never illegal placement
  {
    const req = request({
      operatingWindows: [{ date: DATE, startMinutes: 480, endMinutes: 540 }],
      matches: [
        match("m1", [player("P1"), player("P2")]),
        match("m2", [player("P1"), player("P3")]),
      ],
      policy: policy({
        capacity: { maxConcurrentMatches: 1 },
        rest: { minParticipantRestMinutes: 60, minTeamRestMinutes: 0 },
      }),
    });
    const cand = buildBaselineScheduleCandidate(req);
    assert.ok(scheduledOf(cand, "m1"));
    assert.equal(scheduledOf(cand, "m2"), undefined);
    const u = cand.plan.unscheduled.find((x) => x.matchId === "m2");
    assert.ok(u);
    assert.equal(u.reasonCode, SCHEDULE_DIAGNOSTIC_CODE.NO_FEASIBLE_TIME_SLOT);
  }

  // 26 — Phase 1F rejects forged insufficient-rest candidate
  {
    const req = request({
      matches: [
        match("m1", [player("P1"), player("P2")]),
        match("m2", [player("P1"), player("P3")]),
      ],
      policy: policy({ capacity: { maxConcurrentMatches: 1 } }),
    });
    const cand = buildBaselineScheduleCandidate(req);
    const m1 = scheduledOf(cand, "m1");
    const forged = {
      status: BASELINE_CANDIDATE_STATUS,
      constraintCertification: CONSTRAINT_CERTIFICATION.BASELINE_ONLY,
      plan: createSchedulePlan({
        ...cand.plan,
        scheduled: cand.plan.scheduled.map((s) => {
          if (s.matchId !== "m2") return s;
          return {
            ...s,
            start: { ...m1.end },
            end: {
              date: m1.end.date,
              minutesFromMidnight: m1.end.minutesFromMidnight + 30,
            },
            startUtcMs: m1.endUtcMs,
            endUtcMs: m1.endUtcMs + 30 * 60_000,
            capacityReleaseUtcMs: m1.endUtcMs + 30 * 60_000,
          };
        }),
      }),
    };
    const cert = certifyBaselineScheduleCandidateConstraints(req, forged);
    assert.equal(cert.ok, false);
    assert.ok(
      cert.diagnostics.some(
        (d) => d.code === SCHEDULE_DIAGNOSTIC_CODE.INSUFFICIENT_REST
      )
    );
  }
});

/* -------------------------------------------------------------------------- */
/* Byes and unresolved identities (27–30)                                      */
/* -------------------------------------------------------------------------- */

test("1E-R1-27..30 byes and unresolved identities", () => {
  // 27–28 — bye does not consume rest / reservation
  {
    const req = request({
      matches: [
        match("bye1", [player("P1"), player("P2")], { isBye: true }),
        match("m1", [player("P1"), player("P3")]),
      ],
    });
    const cand = buildBaselineScheduleCandidate(req);
    assert.equal(
      cand.plan.scheduled.some((s) => s.matchId === "bye1"),
      false
    );
    assert.equal(scheduledOf(cand, "m1").start.minutesFromMidnight, 480);
  }

  // 29–30 — missing identity follows existing validation; no display inference
  {
    const src = readFileSync(BASELINE_SRC, "utf8");
    assert.equal(/displayName|displayLabel|teamName/.test(src), false);
    const req = request({
      matches: [
        match("m1", [
          createScheduleParticipantReference({
            participantId: "P1",
            kind: PARTICIPANT_REFERENCE_KIND.PLAYER,
          }),
          createScheduleParticipantReference({
            participantId: "P2",
            kind: PARTICIPANT_REFERENCE_KIND.PLAYER,
          }),
        ]),
      ],
    });
    const cand = buildBaselineScheduleCandidate(req);
    assert.equal(cand.ok, true);
    assert.ok(scheduledOf(cand, "m1"));
  }
});

/* -------------------------------------------------------------------------- */
/* Determinism and mutation (31–37)                                            */
/* -------------------------------------------------------------------------- */

test("1E-R1-31..37 determinism and mutation", () => {
  const base = request({
    matches: [
      match("m1", [player("P1"), player("P2")]),
      match("m2", [player("P3"), player("P4")]),
      match("m3", [player("P1"), player("P5")]),
    ],
  });
  const snap = deepFreezeClone(base);

  // 31 — repeated run identical
  const a = buildBaselineScheduleCandidate(base);
  const b = buildBaselineScheduleCandidate(base);
  assert.equal(
    fingerprintBaselineScheduleCandidate(a),
    fingerprintBaselineScheduleCandidate(b)
  );

  // 32 — reversed match input order (canonical sequence/topo still deterministic)
  const reversed = request({
    matches: [
      match("m3", [player("P1"), player("P5")], { sequence: 3 }),
      match("m2", [player("P3"), player("P4")], { sequence: 2 }),
      match("m1", [player("P1"), player("P2")], { sequence: 1 }),
    ],
  });
  const c = buildBaselineScheduleCandidate(reversed);
  assert.equal(scheduledOf(c, "m1").start.minutesFromMidnight, 480);
  assert.equal(scheduledOf(c, "m2").start.minutesFromMidnight, 480);
  assert.equal(scheduledOf(c, "m3").start.minutesFromMidnight, 525);

  // 33 — reversed resource order identical fingerprint
  const r1 = request({
    matches: [
      match("m1", [
        player("P1", { constraintResourceIds: ["b", "a"] }),
        player("P2"),
      ]),
      match("m2", [
        player("P3", { constraintResourceIds: ["a", "b"] }),
        player("P4"),
      ]),
    ],
  });
  const r2 = request({
    matches: [
      match("m1", [
        player("P1", { constraintResourceIds: ["a", "b"] }),
        player("P2"),
      ]),
      match("m2", [
        player("P3", { constraintResourceIds: ["b", "a"] }),
        player("P4"),
      ]),
    ],
  });
  assert.equal(
    fingerprintBaselineScheduleCandidate(buildBaselineScheduleCandidate(r1)),
    fingerprintBaselineScheduleCandidate(buildBaselineScheduleCandidate(r2))
  );

  // 34–35 — ScheduleRequest / match inputs not mutated
  buildBaselineScheduleCandidate(base);
  assertUnmutated(snap, deepFreezeClone(base));

  // 36 — no nondeterministic primitives in baseline source
  {
    const src = readFileSync(BASELINE_SRC, "utf8");
    assert.equal(/Date\.now\s*\(/.test(src), false);
    assert.equal(/Math\.random\s*\(/.test(src), false);
    assert.equal(/randomUUID/.test(src), false);
    assert.equal(/localeCompare/.test(src), false);
  }

  // 37 — candidate fingerprint replay-stable
  assert.equal(
    fingerprintBaselineScheduleCandidate(a),
    fingerprintBaselineScheduleCandidate(
      buildBaselineScheduleCandidate(JSON.parse(JSON.stringify(base)))
    )
  );
});

/* -------------------------------------------------------------------------- */
/* Original Phase 1I blocker reproduction (38–43)                              */
/* -------------------------------------------------------------------------- */

test("1E-R1-38..43 Phase 1I blocker reproduction and handoff", () => {
  const scheduleRequest = request({
    competitionId: "comp-1i-e2e-001",
    matches: [
      match("m1", [player("P1"), player("P2")]),
      match("m2", [player("P3"), player("P4")]),
      match("m3", [player("P1"), player("P5")]),
    ],
    policy: policy({
      duration: { defaultDurationMinutes: 30, bufferMinutes: 0 },
      rest: { minParticipantRestMinutes: 15, minTeamRestMinutes: 0 },
      capacity: { maxConcurrentMatches: 2 },
    }),
  });

  // 38–39 — fixture times
  const candidate = buildBaselineScheduleCandidate(scheduleRequest);
  assert.equal(candidate.status, BASELINE_CANDIDATE_STATUS);
  assert.equal(
    candidate.constraintCertification,
    CONSTRAINT_CERTIFICATION.BASELINE_ONLY
  );
  const m1 = scheduledOf(candidate, "m1");
  const m2 = scheduledOf(candidate, "m2");
  const m3 = scheduledOf(candidate, "m3");
  assert.equal(m1.start.minutesFromMidnight, 480);
  assert.equal(m1.end.minutesFromMidnight, 510);
  assert.equal(m2.start.minutesFromMidnight, 480);
  assert.equal(m2.end.minutesFromMidnight, 510);
  assert.ok(m3.start.minutesFromMidnight >= 525);
  assert.equal(m3.start.minutesFromMidnight, 525);
  assert.equal(m3.end.minutesFromMidnight, 555);
  assert.equal(restGapMinutes(m1, m3), 15);

  // 40 — Phase 1F certifies
  const certificationResult = certifyBaselineScheduleCandidateConstraints(
    scheduleRequest,
    candidate
  );
  assert.equal(certificationResult.ok, true);
  assert.equal(
    certificationResult.certification,
    CONSTRAINT_CERTIFICATION.HARD_CONSTRAINTS_CERTIFIED
  );

  // 41 — fingerprint continuity
  assert.equal(
    certificationResult.replay.inputFingerprint,
    fingerprintScheduleRequest(scheduleRequest)
  );
  assert.equal(
    certificationResult.replay.resultFingerprint,
    fingerprintBaselineScheduleCandidate(candidate)
  );

  // 42–43 — public Phase 1H-B handoff + CORE-12 SUCCESS with two courts
  const courts = [
    {
      courtId: "court-a",
      tenantId: "tenant-1i",
      clubId: "club-1i",
      venueId: "venue-1i",
      availabilityStatus: COURT_AVAILABILITY_STATUS.AVAILABLE,
      active: true,
      eligible: true,
      priority: 1,
      capabilities: { indoor: true },
      availabilityIntervals: [
        {
          start: "2026-08-01T00:00:00.000Z",
          end: "2026-08-01T23:59:00.000Z",
        },
      ],
    },
    {
      courtId: "court-b",
      tenantId: "tenant-1i",
      clubId: "club-1i",
      venueId: "venue-1i",
      availabilityStatus: COURT_AVAILABILITY_STATUS.AVAILABLE,
      active: true,
      eligible: true,
      priority: 2,
      capabilities: { indoor: true },
      availabilityIntervals: [
        {
          start: "2026-08-01T00:00:00.000Z",
          end: "2026-08-01T23:59:00.000Z",
        },
      ],
    },
  ];
  const availabilitySnapshotRef = {
    snapshotId: "avail-1e-r1",
    snapshotVersion: "v1",
    fingerprint: fingerprintValue({
      courts: courts.map((c) => ({
        courtId: c.courtId,
        intervals: c.availabilityIntervals,
      })),
    }),
  };

  const timesBefore = Object.fromEntries(
    candidate.plan.scheduled.map((s) => [
      s.matchId,
      { startUtcMs: s.startUtcMs, endUtcMs: s.endUtcMs },
    ])
  );

  const assigned = assignCourtsFromCertifiedSchedule({
    scheduleRequest,
    candidate,
    certificationResult,
    scope: {
      tenantId: "tenant-1i",
      clubId: "club-1i",
      venueId: "venue-1i",
    },
    courts,
    availabilitySnapshotRef,
    courtAssignmentPolicy: { partialAssignmentAllowed: false },
  });

  assert.equal(assigned.ok, true);
  assert.equal(
    assigned.courtAssignmentResult.status,
    COURT_ASSIGNMENT_STATUS.SUCCESS
  );
  assert.equal(assigned.courtAssignmentResult.unassigned.length, 0);
  assert.equal(assigned.courtAssignmentResult.assignments.length, 3);

  for (const s of candidate.plan.scheduled) {
    assert.equal(s.startUtcMs, timesBefore[s.matchId].startUtcMs);
    assert.equal(s.endUtcMs, timesBefore[s.matchId].endUtcMs);
  }
  for (const aRow of assigned.courtAssignmentResult.assignments) {
    const src = timesBefore[aRow.matchId];
    assert.ok(src);
    // Assigned times must equal certified schedule times (ISO or ms fields).
    if (Number.isFinite(aRow.startUtcMs)) {
      assert.equal(aRow.startUtcMs, src.startUtcMs);
    }
    if (Number.isFinite(aRow.endUtcMs)) {
      assert.equal(aRow.endUtcMs, src.endUtcMs);
    }
  }
});

test("1E-R1 metadata: rest and overlap placement-enforced; court/referee deferred", () => {
  const cand = buildBaselineScheduleCandidate(
    request({ matches: [match("m1", [player("P1"), player("P2")])] })
  );
  const certified = cand.plan.replay.details.certifiedConstraints;
  const deferred = cand.plan.replay.details.deferredConstraints;
  for (const code of [
    "INSUFFICIENT_REST",
    "MIN_TEAM_REST",
    "PARTICIPANT_OVERLAP",
    "TEAM_OVERLAP",
  ]) {
    assert.ok(certified.includes(code), code);
    assert.equal(deferred.includes(code), false, code);
  }
  assert.ok(deferred.includes("PHYSICAL_COURT_ASSIGNMENT"));
  assert.ok(deferred.includes("REFEREE_ASSIGNMENT"));
});

/* -------------------------------------------------------------------------- */
/* Pre-commit review additions (R1-A..R1-Z)                                    */
/* -------------------------------------------------------------------------- */

test("1E-R1-A resource-kind rest policy matrix", () => {
  // Different participant vs team rest values
  const mixedPolicy = policy({
    rest: { minParticipantRestMinutes: 20, minTeamRestMinutes: 5 },
    capacity: { maxConcurrentMatches: 1 },
    duration: { defaultDurationMinutes: 30, bufferMinutes: 0 },
  });

  // Participant resource uses participant rest (20)
  {
    const req = request({
      policy: mixedPolicy,
      matches: [
        match("m1", [player("P1"), player("P2")]),
        match("m2", [player("P1"), player("P3")]),
      ],
    });
    const cand = buildBaselineScheduleCandidate(req);
    assert.equal(
      restGapMinutes(scheduledOf(cand, "m1"), scheduledOf(cand, "m2")),
      20
    );
  }

  // Team resource uses team rest (5)
  {
    const req = request({
      policy: mixedPolicy,
      matches: [
        match("m1", [team("T1"), team("T2")]),
        match("m2", [team("T1"), team("T3")]),
      ],
    });
    const cand = buildBaselineScheduleCandidate(req);
    assert.equal(
      restGapMinutes(scheduledOf(cand, "m1"), scheduledOf(cand, "m2")),
      5
    );
  }

  // Mixed-resource match: later applicable bound wins
  {
    const req = request({
      policy: mixedPolicy,
      matches: [
        match("m1", [player("P1"), team("T1")], { sequence: 1 }),
        match("m2", [player("X1"), team("T9")], {
          sequence: 2,
          estimatedDurationMinutes: 60,
        }),
        match("m3", [player("P1"), team("T9")], { sequence: 3 }),
      ],
    });
    const cand = buildBaselineScheduleCandidate(req);
    const m1 = scheduledOf(cand, "m1");
    const m2 = scheduledOf(cand, "m2");
    const m3 = scheduledOf(cand, "m3");
    const fromP1 = m1.endUtcMs + 20 * 60_000;
    const fromT9 = m2.endUtcMs + 5 * 60_000;
    assert.equal(m3.startUtcMs, Math.max(fromP1, fromT9));
  }

  // Generic constraintResourceIds → SHARED_PLAYER → participant rest (Option A)
  {
    const req = request({
      policy: mixedPolicy,
      matches: [
        match("m1", [
          player("A", { constraintResourceIds: ["shared:1"] }),
          player("B"),
        ]),
        match("m2", [
          player("C", { constraintResourceIds: ["shared:1"] }),
          player("D"),
        ]),
      ],
    });
    const cand = buildBaselineScheduleCandidate(req);
    assert.equal(
      restGapMinutes(scheduledOf(cand, "m1"), scheduledOf(cand, "m2")),
      20
    );
  }

  // Kind/resource input order does not affect placement fingerprint
  {
    const a = request({
      policy: mixedPolicy,
      matches: [
        match("m1", [
          player("P1", { constraintResourceIds: ["z", "a"] }),
          team("T1"),
        ]),
        match("m2", [
          player("P2", { constraintResourceIds: ["a", "z"] }),
          team("T1"),
        ]),
      ],
    });
    const b = request({
      policy: mixedPolicy,
      matches: [
        match("m1", [
          team("T1"),
          player("P1", { constraintResourceIds: ["a", "z"] }),
        ]),
        match("m2", [
          team("T1"),
          player("P2", { constraintResourceIds: ["z", "a"] }),
        ]),
      ],
    });
    assert.equal(
      fingerprintBaselineScheduleCandidate(buildBaselineScheduleCandidate(a)),
      fingerprintBaselineScheduleCandidate(buildBaselineScheduleCandidate(b))
    );
  }
});

test("1E-R1-B zero-rest overlap hard rule", () => {
  // Shared participant, rest 0, capacity 2 → sequential touch, not concurrent
  {
    const req = request({
      policy: policy({
        rest: { minParticipantRestMinutes: 0, minTeamRestMinutes: 0 },
        capacity: { maxConcurrentMatches: 2 },
      }),
      matches: [
        match("m1", [player("P1"), player("P2")]),
        match("m2", [player("P1"), player("P3")]),
      ],
    });
    const cand = buildBaselineScheduleCandidate(req);
    const m1 = scheduledOf(cand, "m1");
    const m2 = scheduledOf(cand, "m2");
    assert.equal(m1.start.minutesFromMidnight, 480);
    assert.equal(m2.startUtcMs, m1.endUtcMs);
    assert.ok(!(m2.startUtcMs < m1.endUtcMs && m1.startUtcMs < m2.endUtcMs));
    const cert = certifyBaselineScheduleCandidateConstraints(req, cand);
    assert.equal(cert.ok, true);
    assert.equal(
      cert.certification,
      CONSTRAINT_CERTIFICATION.HARD_CONSTRAINTS_CERTIFIED
    );
  }

  // Shared team, team rest 0
  {
    const req = request({
      policy: policy({
        rest: { minParticipantRestMinutes: 0, minTeamRestMinutes: 0 },
        capacity: { maxConcurrentMatches: 2 },
      }),
      matches: [
        match("m1", [team("T1"), team("T2")]),
        match("m2", [team("T1"), team("T3")]),
      ],
    });
    const cand = buildBaselineScheduleCandidate(req);
    assert.equal(
      scheduledOf(cand, "m2").startUtcMs,
      scheduledOf(cand, "m1").endUtcMs
    );
  }

  // Disjoint may remain concurrent
  {
    const req = request({
      policy: policy({
        rest: { minParticipantRestMinutes: 0, minTeamRestMinutes: 0 },
        capacity: { maxConcurrentMatches: 2 },
      }),
      matches: [
        match("m1", [player("A"), player("B")]),
        match("m2", [player("C"), player("D")]),
      ],
    });
    const cand = buildBaselineScheduleCandidate(req);
    assert.equal(
      scheduledOf(cand, "m1").startUtcMs,
      scheduledOf(cand, "m2").startUtcMs
    );
  }

  // Dependent shared-resource rest 0 may start exactly at prior end
  {
    const req = request({
      policy: policy({
        rest: { minParticipantRestMinutes: 0, minTeamRestMinutes: 0 },
        duration: { defaultDurationMinutes: 30, bufferMinutes: 0 },
        capacity: { maxConcurrentMatches: 1 },
      }),
      matches: [
        match("m1", [player("P1"), player("P2")]),
        match("m2", [player("P1"), player("P3")], {
          dependencies: [
            createScheduleDependency({
              sourceMatchId: "m1",
              type: SCHEDULE_DEPENDENCY_TYPE.PREVIOUS_ROUND,
            }),
          ],
        }),
      ],
    });
    const cand = buildBaselineScheduleCandidate(req);
    assert.equal(
      scheduledOf(cand, "m2").startUtcMs,
      scheduledOf(cand, "m1").endUtcMs
    );
  }

  // Forged overlap still rejected by Phase 1F
  {
    const req = request({
      policy: policy({
        rest: { minParticipantRestMinutes: 0, minTeamRestMinutes: 0 },
        capacity: { maxConcurrentMatches: 2 },
      }),
      matches: [
        match("m1", [player("P1"), player("P2")]),
        match("m2", [player("P1"), player("P3")]),
      ],
    });
    const cand = buildBaselineScheduleCandidate(req);
    const m1 = scheduledOf(cand, "m1");
    const forged = {
      status: BASELINE_CANDIDATE_STATUS,
      constraintCertification: CONSTRAINT_CERTIFICATION.BASELINE_ONLY,
      plan: createSchedulePlan({
        ...cand.plan,
        scheduled: cand.plan.scheduled.map((s) =>
          s.matchId === "m2"
            ? {
                ...s,
                start: { ...m1.start },
                end: { ...m1.end },
                startUtcMs: m1.startUtcMs,
                endUtcMs: m1.endUtcMs,
                capacityReleaseUtcMs: m1.capacityReleaseUtcMs,
                concurrencyIndex: 1,
                abstractSlotIndex: 1,
              }
            : s
        ),
      }),
    };
    const cert = certifyBaselineScheduleCandidateConstraints(req, forged);
    assert.equal(cert.ok, false);
    assert.ok(
      cert.diagnostics.some(
        (d) => d.code === SCHEDULE_DIAGNOSTIC_CODE.PARTICIPANT_OVERLAP
      )
    );
  }

  // Zero rest does not become capacity buffer
  {
    const req = request({
      policy: policy({
        rest: { minParticipantRestMinutes: 0, minTeamRestMinutes: 0 },
        duration: { defaultDurationMinutes: 30, bufferMinutes: 10 },
        capacity: { maxConcurrentMatches: 1 },
      }),
      matches: [
        match("m1", [player("P1"), player("P2")]),
        match("m2", [player("P1"), player("P3")]),
      ],
    });
    const cand = buildBaselineScheduleCandidate(req);
    const m1 = scheduledOf(cand, "m1");
    const m2 = scheduledOf(cand, "m2");
    // Capacity release is end+10; resource earliest is end+0; capacity wins
    assert.equal(m2.startUtcMs, m1.capacityReleaseUtcMs);
    assert.equal(m1.capacityReleaseUtcMs, m1.endUtcMs + 10 * 60_000);
  }
});

test("1E-R1-C Phase 1E/1F resource parity and lower-bound composition", () => {
  // Parity: shared-player + duplicate/reverse normalization
  {
    const req = request({
      matches: [
        match("m1", [
          player("P1", {
            constraintResourceIds: ["player:9", "player:9", " player:9 "],
          }),
          player("P2"),
        ]),
        match("m2", [
          player("P3", { constraintResourceIds: ["player:9"] }),
          player("P4"),
        ]),
      ],
    });
    assert.deepEqual(req.matches[0].participants[0].constraintResourceIds, [
      "player:9",
    ]);
    const cand = buildBaselineScheduleCandidate(req);
    const cert = certifyBaselineScheduleCandidateConstraints(req, cand);
    assert.equal(cert.ok, true);
  }

  // Display labels never become resource IDs (source scan)
  {
    const src = readFileSync(BASELINE_SRC, "utf8");
    assert.equal(/displayName|displayLabel/.test(src), false);
  }

  // Lower-bound: same source — max, not sum (dep buffer 10 + rest 15 → 15)
  {
    const req = request({
      policy: policy({
        duration: { defaultDurationMinutes: 30, bufferMinutes: 10 },
        rest: { minParticipantRestMinutes: 15, minTeamRestMinutes: 0 },
        capacity: { maxConcurrentMatches: 1 },
      }),
      matches: [
        match("m1", [player("P1"), player("P2")]),
        match("m2", [player("P1"), player("P3")], {
          dependencies: [
            createScheduleDependency({
              sourceMatchId: "m1",
              type: SCHEDULE_DEPENDENCY_TYPE.PREVIOUS_ROUND,
            }),
          ],
        }),
      ],
    });
    const cand = buildBaselineScheduleCandidate(req);
    const m1 = scheduledOf(cand, "m1");
    const m2 = scheduledOf(cand, "m2");
    assert.equal(m2.startUtcMs, m1.endUtcMs + 15 * 60_000);
    assert.notEqual(m2.startUtcMs, m1.endUtcMs + 25 * 60_000);
  }

  // Capacity later than rest
  {
    const req = request({
      policy: policy({
        rest: { minParticipantRestMinutes: 0, minTeamRestMinutes: 0 },
        duration: { defaultDurationMinutes: 30, bufferMinutes: 0 },
        capacity: { maxConcurrentMatches: 1 },
      }),
      matches: [
        match("m1", [player("A"), player("B")]),
        match("m2", [player("C"), player("D")]),
        match("m3", [player("A"), player("E")]),
      ],
    });
    const cand = buildBaselineScheduleCandidate(req);
    const m2 = scheduledOf(cand, "m2");
    const m3 = scheduledOf(cand, "m3");
    // m3 resource rest from m1 → 08:30; capacity free after m2 → 09:00
    assert.equal(m3.startUtcMs, m2.capacityReleaseUtcMs);
  }

  // No double-add / no effectiveBuffer substitution in source
  {
    const src = readFileSync(BASELINE_SRC, "utf8");
    assert.equal(/effectiveBuffer/.test(src), false);
    assert.equal(
      /max\s*\(\s*bufferMinutes\s*,\s*minParticipantRestMinutes\s*\)/.test(src),
      false
    );
  }
});
