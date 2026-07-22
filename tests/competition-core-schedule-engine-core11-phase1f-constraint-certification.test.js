/**
 * CORE-11 Phase 1F — hard-constraint certification (focused).
 */

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  CONSTRAINT_CERTIFICATION,
  BASELINE_CANDIDATE_STATUS,
  CONSTRAINT_CERTIFICATION_RESULT_STATUS,
  PARTICIPANT_REFERENCE_KIND,
  SCHEDULE_DIAGNOSTIC_CODE,
  SCHEDULE_DEPENDENCY_TYPE,
  certifyBaselineScheduleCandidateConstraints,
  buildBaselineScheduleCandidate,
  createScheduleRequest,
  createScheduleMatchInput,
  createSchedulePolicy,
  createScheduledMatch,
  createUnscheduledMatch,
  createSchedulePlan,
  createScheduleParticipantReference,
  fingerprintSchedulePlan,
  fingerprintScheduleRequest,
  fingerprintBaselineScheduleCandidate,
  deriveConservativeConstraintResources,
  serializeCanonical,
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

function codesOf(result) {
  return (result.diagnostics || []).map((d) => d.code);
}

function policy(overrides = {}) {
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

function p(id, extra = {}) {
  return createScheduleParticipantReference({ participantId: id, ...extra });
}

function match(id, extra = {}) {
  return createScheduleMatchInput({
    matchId: id,
    participants: extra.participants || [p(`${id}-a`), p(`${id}-b`)],
    ...extra,
  });
}

function baseRequest(partial = {}) {
  return createScheduleRequest({
    competitionId: "comp-1f",
    timezone: TZ,
    policy: policy(),
    operatingWindows: [
      { date: "2026-08-01", startMinutes: 480, endMinutes: 900 },
    ],
    matches: [],
    ...partial,
  });
}

function certify(request, candidate) {
  return certifyBaselineScheduleCandidateConstraints(request, candidate);
}

function buildAndCertify(request) {
  const candidate = buildBaselineScheduleCandidate(request);
  return { candidate, result: certify(request, candidate) };
}

test("01 empty valid candidate", () => {
  const request = baseRequest({ matches: [] });
  const candidate = buildBaselineScheduleCandidate(request);
  const result = certify(request, candidate);
  assert.equal(result.status, CONSTRAINT_CERTIFICATION_RESULT_STATUS);
  assert.equal(result.ok, true);
  assert.equal(
    result.certification,
    CONSTRAINT_CERTIFICATION.HARD_CONSTRAINTS_CERTIFIED
  );
});

test("02 valid single-match certification", () => {
  const { result } = buildAndCertify(
    baseRequest({ matches: [match("m1")] })
  );
  assert.equal(result.ok, true);
  assert.equal(
    result.certification,
    CONSTRAINT_CERTIFICATION.HARD_CONSTRAINTS_CERTIFIED
  );
  assert.equal(result.candidateStatus, BASELINE_CANDIDATE_STATUS);
});

test("03 valid sequential participants", () => {
  const { result } = buildAndCertify(
    baseRequest({
      policy: policy({
        rest: { minParticipantRestMinutes: 5, minTeamRestMinutes: 0 },
        capacity: { maxConcurrentMatches: 1 },
      }),
      matches: [
        match("m1", { participants: [p("alice"), p("bob")] }),
        match("m2", { participants: [p("alice"), p("carol")] }),
      ],
    })
  );
  assert.equal(result.ok, true);
});

test("04 participant overlap", () => {
  const request = baseRequest({
    policy: policy({
      rest: { minParticipantRestMinutes: 0, minTeamRestMinutes: 0 },
      capacity: { maxConcurrentMatches: 2 },
    }),
    matches: [
      match("m1", { participants: [p("alice"), p("bob")] }),
      match("m2", { participants: [p("alice"), p("carol")] }),
    ],
  });
  const candidate = buildBaselineScheduleCandidate(request);
  // Force concurrent overlap by tampering m2 to same start as m1.
  const m1 = candidate.plan.scheduled.find((s) => s.matchId === "m1");
  const plan = createSchedulePlan({
    ...candidate.plan,
    scheduled: candidate.plan.scheduled.map((s) =>
      s.matchId === "m2"
        ? {
            ...s,
            start: { ...m1.start },
            end: { ...m1.end },
            startUtcMs: m1.startUtcMs,
            endUtcMs: m1.endUtcMs,
            capacityReleaseUtcMs: m1.capacityReleaseUtcMs,
            durationMinutes: m1.durationMinutes,
            bufferMinutes: m1.bufferMinutes,
            concurrencyIndex: 1,
            abstractSlotIndex: 1,
          }
        : s
    ),
  });
  const result = certify(request, {
    ...candidate,
    plan,
    status: BASELINE_CANDIDATE_STATUS,
    constraintCertification: CONSTRAINT_CERTIFICATION.BASELINE_ONLY,
  });
  assert.equal(result.ok, false);
  assert.ok(codesOf(result).includes(SCHEDULE_DIAGNOSTIC_CODE.PARTICIPANT_OVERLAP));
});

test("05 matches touching with zero required rest", () => {
  const { result } = buildAndCertify(
    baseRequest({
      policy: policy({
        duration: { defaultDurationMinutes: 30, bufferMinutes: 0 },
        rest: { minParticipantRestMinutes: 0, minTeamRestMinutes: 0 },
        capacity: { maxConcurrentMatches: 1 },
      }),
      matches: [
        match("m1", { participants: [p("alice"), p("bob")] }),
        match("m2", { participants: [p("alice"), p("carol")] }),
      ],
    })
  );
  assert.equal(result.ok, true);
});

test("06 touching matches with positive required rest", () => {
  const request = baseRequest({
    policy: policy({
      duration: { defaultDurationMinutes: 30, bufferMinutes: 0 },
      rest: { minParticipantRestMinutes: 15, minTeamRestMinutes: 0 },
      capacity: { maxConcurrentMatches: 1 },
    }),
    matches: [
      match("m1", { participants: [p("alice"), p("bob")] }),
      match("m2", { participants: [p("alice"), p("carol")] }),
    ],
  });
  const candidate = buildBaselineScheduleCandidate(request);
  // Place m2 immediately at m1.end (zero rest, buffer 0).
  const m1 = candidate.plan.scheduled.find((s) => s.matchId === "m1");
  const m2start = m1.end.minutesFromMidnight;
  const plan = createSchedulePlan({
    ...candidate.plan,
    scheduled: candidate.plan.scheduled.map((s) => {
      if (s.matchId !== "m2") return s;
      return {
        ...s,
        start: { date: m1.end.date, minutesFromMidnight: m2start },
        end: { date: m1.end.date, minutesFromMidnight: m2start + 30 },
        startUtcMs: m1.endUtcMs,
        endUtcMs: m1.endUtcMs + 30 * 60_000,
        capacityReleaseUtcMs: m1.endUtcMs + 30 * 60_000,
        durationMinutes: 30,
        bufferMinutes: 0,
        concurrencyIndex: 0,
        abstractSlotIndex: 0,
      };
    }),
  });
  const result = certify(request, {
    status: BASELINE_CANDIDATE_STATUS,
    constraintCertification: CONSTRAINT_CERTIFICATION.BASELINE_ONLY,
    plan,
  });
  assert.equal(result.ok, false);
  assert.ok(codesOf(result).includes(SCHEDULE_DIAGNOSTIC_CODE.INSUFFICIENT_REST));
});

test("07 sufficient participant rest", () => {
  const { result } = buildAndCertify(
    baseRequest({
      policy: policy({
        duration: { defaultDurationMinutes: 30, bufferMinutes: 5 },
        rest: { minParticipantRestMinutes: 5, minTeamRestMinutes: 0 },
        capacity: { maxConcurrentMatches: 1 },
      }),
      matches: [
        match("m1", { participants: [p("alice"), p("bob")] }),
        match("m2", { participants: [p("alice"), p("carol")] }),
      ],
    })
  );
  assert.equal(result.ok, true);
});

test("08 cross-session participant rest", () => {
  const { result } = buildAndCertify(
    baseRequest({
      operatingWindows: [
        { date: "2026-08-01", startMinutes: 480, endMinutes: 900 },
      ],
      sessionWindows: [
        {
          sessionId: "s1",
          date: "2026-08-01",
          startMinutes: 480,
          endMinutes: 540,
        },
        {
          sessionId: "s2",
          date: "2026-08-01",
          startMinutes: 600,
          endMinutes: 660,
        },
      ],
      policy: policy({
        rest: { minParticipantRestMinutes: 15, minTeamRestMinutes: 0 },
        capacity: { maxConcurrentMatches: 1 },
      }),
      matches: [
        match("m1", { participants: [p("alice"), p("bob")] }),
        match("m2", { participants: [p("alice"), p("carol")] }),
      ],
    })
  );
  assert.equal(result.ok, true);
});

test("09 cross-day participant rest", () => {
  const { candidate, result } = buildAndCertify(
    baseRequest({
      operatingWindows: [
        { date: "2026-08-01", startMinutes: 480, endMinutes: 510 },
        { date: "2026-08-02", startMinutes: 480, endMinutes: 540 },
      ],
      policy: policy({
        duration: { defaultDurationMinutes: 30, bufferMinutes: 0 },
        rest: { minParticipantRestMinutes: 15, minTeamRestMinutes: 0 },
        capacity: { maxConcurrentMatches: 1 },
      }),
      matches: [
        match("m1", { participants: [p("alice"), p("bob")] }),
        match("m2", { participants: [p("alice"), p("carol")] }),
      ],
    })
  );
  assert.equal(result.ok, true);
  assert.equal(candidate.plan.scheduled[0].start.date, "2026-08-01");
  assert.equal(candidate.plan.scheduled[1].start.date, "2026-08-02");
});

test("10 team overlap", () => {
  const request = baseRequest({
    policy: policy({
      rest: { minParticipantRestMinutes: 0, minTeamRestMinutes: 0 },
      capacity: { maxConcurrentMatches: 2 },
    }),
    matches: [
      match("m1", {
        participants: [
          p("entry-a", { kind: PARTICIPANT_REFERENCE_KIND.ENTRY }),
          p("entry-b", { kind: PARTICIPANT_REFERENCE_KIND.ENTRY }),
        ],
      }),
      match("m2", {
        participants: [
          p("entry-a", { kind: PARTICIPANT_REFERENCE_KIND.ENTRY }),
          p("entry-c", { kind: PARTICIPANT_REFERENCE_KIND.ENTRY }),
        ],
      }),
    ],
  });
  const candidate = buildBaselineScheduleCandidate(request);
  const m1 = candidate.plan.scheduled.find((s) => s.matchId === "m1");
  const plan = createSchedulePlan({
    ...candidate.plan,
    scheduled: candidate.plan.scheduled.map((s) =>
      s.matchId === "m2"
        ? {
            ...s,
            start: { ...m1.start },
            end: { ...m1.end },
            startUtcMs: m1.startUtcMs,
            endUtcMs: m1.endUtcMs,
            capacityReleaseUtcMs: m1.capacityReleaseUtcMs,
            durationMinutes: m1.durationMinutes,
            bufferMinutes: m1.bufferMinutes,
            concurrencyIndex: 1,
            abstractSlotIndex: 1,
          }
        : s
    ),
  });
  const result = certify(request, {
    status: BASELINE_CANDIDATE_STATUS,
    constraintCertification: CONSTRAINT_CERTIFICATION.BASELINE_ONLY,
    plan,
  });
  assert.ok(codesOf(result).includes(SCHEDULE_DIAGNOSTIC_CODE.TEAM_OVERLAP));
});

test("11 sufficient team rest", () => {
  const { result } = buildAndCertify(
    baseRequest({
      policy: policy({
        rest: { minParticipantRestMinutes: 0, minTeamRestMinutes: 5 },
        capacity: { maxConcurrentMatches: 1 },
      }),
      matches: [
        match("m1", {
          participants: [
            p("team-a", { kind: PARTICIPANT_REFERENCE_KIND.TEAM }),
            p("team-b", { kind: PARTICIPANT_REFERENCE_KIND.TEAM }),
          ],
        }),
        match("m2", {
          participants: [
            p("team-a", { kind: PARTICIPANT_REFERENCE_KIND.TEAM }),
            p("team-c", { kind: PARTICIPANT_REFERENCE_KIND.TEAM }),
          ],
        }),
      ],
    })
  );
  assert.equal(result.ok, true);
});

test("12 insufficient team rest", () => {
  const request = baseRequest({
    policy: policy({
      duration: { defaultDurationMinutes: 30, bufferMinutes: 0 },
      rest: { minParticipantRestMinutes: 0, minTeamRestMinutes: 20 },
      capacity: { maxConcurrentMatches: 1 },
    }),
    matches: [
      match("m1", {
        participants: [
          p("team-a", { kind: PARTICIPANT_REFERENCE_KIND.TEAM }),
          p("team-b", { kind: PARTICIPANT_REFERENCE_KIND.TEAM }),
        ],
      }),
      match("m2", {
        participants: [
          p("team-a", { kind: PARTICIPANT_REFERENCE_KIND.TEAM }),
          p("team-c", { kind: PARTICIPANT_REFERENCE_KIND.TEAM }),
        ],
      }),
    ],
  });
  const candidate = buildBaselineScheduleCandidate(request);
  const m1 = candidate.plan.scheduled.find((s) => s.matchId === "m1");
  const plan = createSchedulePlan({
    ...candidate.plan,
    scheduled: candidate.plan.scheduled.map((s) => {
      if (s.matchId !== "m2") return s;
      const start = m1.end.minutesFromMidnight;
      return {
        ...s,
        start: { date: m1.end.date, minutesFromMidnight: start },
        end: { date: m1.end.date, minutesFromMidnight: start + 30 },
        startUtcMs: m1.endUtcMs,
        endUtcMs: m1.endUtcMs + 30 * 60_000,
        capacityReleaseUtcMs: m1.endUtcMs + 30 * 60_000,
        durationMinutes: 30,
        bufferMinutes: 0,
        concurrencyIndex: 0,
        abstractSlotIndex: 0,
      };
    }),
  });
  const result = certify(request, {
    status: BASELINE_CANDIDATE_STATUS,
    constraintCertification: CONSTRAINT_CERTIFICATION.BASELINE_ONLY,
    plan,
  });
  assert.equal(result.ok, false);
  const rest = result.diagnostics.find(
    (d) =>
      d.code === SCHEDULE_DIAGNOSTIC_CODE.INSUFFICIENT_REST &&
      d.details?.restKind === "TEAM"
  );
  assert.ok(rest);
});

test("13 shared player across different entries", () => {
  const request = baseRequest({
    policy: policy({
      rest: { minParticipantRestMinutes: 0, minTeamRestMinutes: 0 },
      capacity: { maxConcurrentMatches: 2 },
    }),
    matches: [
      match("m1", {
        participants: [
          p("entry-a", {
            kind: PARTICIPANT_REFERENCE_KIND.ENTRY,
            constraintResourceIds: ["player:123"],
          }),
          p("entry-b", { kind: PARTICIPANT_REFERENCE_KIND.ENTRY }),
        ],
      }),
      match("m2", {
        participants: [
          p("entry-c", {
            kind: PARTICIPANT_REFERENCE_KIND.ENTRY,
            constraintResourceIds: ["player:123"],
          }),
          p("entry-d", { kind: PARTICIPANT_REFERENCE_KIND.ENTRY }),
        ],
      }),
    ],
  });
  const candidate = buildBaselineScheduleCandidate(request);
  const m1 = candidate.plan.scheduled.find((s) => s.matchId === "m1");
  const plan = createSchedulePlan({
    ...candidate.plan,
    scheduled: candidate.plan.scheduled.map((s) =>
      s.matchId === "m2"
        ? {
            ...s,
            start: { ...m1.start },
            end: { ...m1.end },
            startUtcMs: m1.startUtcMs,
            endUtcMs: m1.endUtcMs,
            capacityReleaseUtcMs: m1.capacityReleaseUtcMs,
            durationMinutes: m1.durationMinutes,
            bufferMinutes: m1.bufferMinutes,
            concurrencyIndex: 1,
            abstractSlotIndex: 1,
          }
        : s
    ),
  });
  const result = certify(request, {
    status: BASELINE_CANDIDATE_STATUS,
    constraintCertification: CONSTRAINT_CERTIFICATION.BASELINE_ONLY,
    plan,
  });
  assert.ok(codesOf(result).includes(SCHEDULE_DIAGNOSTIC_CODE.PARTICIPANT_OVERLAP));
  assert.ok(
    result.diagnostics.some((d) => d.details?.resourceId === "player:123")
  );
});

test("14 multiple shared-player conflicts", () => {
  const request = baseRequest({
    policy: policy({
      rest: { minParticipantRestMinutes: 0, minTeamRestMinutes: 0 },
      capacity: { maxConcurrentMatches: 2 },
    }),
    matches: [
      match("m1", {
        participants: [
          p("e1", {
            kind: PARTICIPANT_REFERENCE_KIND.ENTRY,
            constraintResourceIds: ["player:1", "player:2"],
          }),
        ],
      }),
      match("m2", {
        participants: [
          p("e2", {
            kind: PARTICIPANT_REFERENCE_KIND.ENTRY,
            constraintResourceIds: ["player:1", "player:2"],
          }),
        ],
      }),
    ],
  });
  const candidate = buildBaselineScheduleCandidate(request);
  const m1 = candidate.plan.scheduled.find((s) => s.matchId === "m1");
  const plan = createSchedulePlan({
    ...candidate.plan,
    scheduled: candidate.plan.scheduled.map((s) =>
      s.matchId === "m2"
        ? {
            ...s,
            start: { ...m1.start },
            end: { ...m1.end },
            startUtcMs: m1.startUtcMs,
            endUtcMs: m1.endUtcMs,
            capacityReleaseUtcMs: m1.capacityReleaseUtcMs,
            durationMinutes: m1.durationMinutes,
            bufferMinutes: m1.bufferMinutes,
            concurrencyIndex: 1,
            abstractSlotIndex: 1,
          }
        : s
    ),
  });
  const result = certify(request, {
    status: BASELINE_CANDIDATE_STATUS,
    constraintCertification: CONSTRAINT_CERTIFICATION.BASELINE_ONLY,
    plan,
  });
  const overlaps = result.diagnostics.filter(
    (d) => d.code === SCHEDULE_DIAGNOSTIC_CODE.PARTICIPANT_OVERLAP
  );
  assert.ok(overlaps.length >= 2);
});

test("15 duplicate conflict resource IDs", () => {
  const part = p("e1", {
    kind: PARTICIPANT_REFERENCE_KIND.ENTRY,
    constraintResourceIds: ["player:9", "player:9", " player:9 "],
  });
  assert.deepEqual(part.constraintResourceIds, ["player:9"]);
});

test("16 input-order-independent participant resources", () => {
  const a = baseRequest({
    matches: [
      match("m2", { participants: [p("bob"), p("alice")] }),
      match("m1", { participants: [p("carol"), p("dave")] }),
    ],
  });
  const b = baseRequest({
    matches: [
      match("m1", { participants: [p("dave"), p("carol")] }),
      match("m2", { participants: [p("alice"), p("bob")] }),
    ],
  });
  const ca = buildBaselineScheduleCandidate(a);
  const cb = buildBaselineScheduleCandidate(b);
  const ra = certify(a, ca);
  const rb = certify(b, cb);
  assert.equal(ra.ok, rb.ok);
  assert.equal(ra.certification, rb.certification);
});

test("17 unresolved placeholder identity fails closed when material", () => {
  const { result } = buildAndCertify(
    baseRequest({
      matches: [
        match("m1", {
          participants: [
            p("__PENDING_WINNER__", {
              kind: PARTICIPANT_REFERENCE_KIND.PLACEHOLDER,
            }),
          ],
        }),
      ],
    })
  );
  assert.equal(result.ok, false);
  assert.ok(
    codesOf(result).includes(SCHEDULE_DIAGNOSTIC_CODE.PARTICIPANT_IDENTITY_UNRESOLVED)
  );
});

test("18 structurally safe known placeholder on unscheduled does not forge identity", () => {
  const request = baseRequest({
    operatingWindows: [
      { date: "2026-08-01", startMinutes: 480, endMinutes: 510 },
    ],
    matches: [
      match("m1", { estimatedDurationMinutes: 60, participants: [p("a"), p("b")] }),
      match("m2", {
        participants: [
          p("__PENDING__", { kind: PARTICIPANT_REFERENCE_KIND.PLACEHOLDER }),
        ],
        dependencies: [
          { sourceMatchId: "m1", type: SCHEDULE_DEPENDENCY_TYPE.WINNER_OF },
        ],
      }),
    ],
  });
  const candidate = buildBaselineScheduleCandidate(request);
  assert.ok(candidate.plan.unscheduled.some((u) => u.matchId === "m2"));
  const result = certify(request, candidate);
  assert.equal(result.ok, false);
  assert.ok(
    codesOf(result).includes(SCHEDULE_DIAGNOSTIC_CODE.SCHEDULE_INCOMPLETE)
  );
  assert.equal(
    result.diagnostics.some(
      (d) =>
        d.code === SCHEDULE_DIAGNOSTIC_CODE.PARTICIPANT_IDENTITY_UNRESOLVED &&
        d.relatedMatchIds.includes("m2")
    ),
    false
  );
});

test("19 unknown match ID in candidate", () => {
  const request = baseRequest({ matches: [match("m1")] });
  const candidate = buildBaselineScheduleCandidate(request);
  const plan = createSchedulePlan({
    ...candidate.plan,
    scheduled: [
      ...candidate.plan.scheduled,
      createScheduledMatch({
        ...candidate.plan.scheduled[0],
        matchId: "ghost",
      }),
    ],
  });
  const result = certify(request, {
    status: BASELINE_CANDIDATE_STATUS,
    constraintCertification: CONSTRAINT_CERTIFICATION.BASELINE_ONLY,
    plan,
  });
  assert.ok(codesOf(result).includes(SCHEDULE_DIAGNOSTIC_CODE.UNKNOWN_CANDIDATE_MATCH));
});

test("20 missing requested match", () => {
  const request = baseRequest({ matches: [match("m1"), match("m2")] });
  const candidate = buildBaselineScheduleCandidate(request);
  const plan = createSchedulePlan({
    ...candidate.plan,
    scheduled: candidate.plan.scheduled.filter((s) => s.matchId === "m1"),
    unscheduled: [],
  });
  const result = certify(request, {
    status: BASELINE_CANDIDATE_STATUS,
    constraintCertification: CONSTRAINT_CERTIFICATION.BASELINE_ONLY,
    plan,
  });
  assert.ok(codesOf(result).includes(SCHEDULE_DIAGNOSTIC_CODE.SCHEDULE_INCOMPLETE));
});

test("21 duplicate scheduled match", () => {
  const request = baseRequest({ matches: [match("m1")] });
  const candidate = buildBaselineScheduleCandidate(request);
  const s = candidate.plan.scheduled[0];
  const plan = createSchedulePlan({
    ...candidate.plan,
    scheduled: [s, { ...s }],
  });
  const result = certify(request, {
    status: BASELINE_CANDIDATE_STATUS,
    constraintCertification: CONSTRAINT_CERTIFICATION.BASELINE_ONLY,
    plan,
  });
  assert.ok(codesOf(result).includes(SCHEDULE_DIAGNOSTIC_CODE.DUPLICATE_MATCH_ID));
});

test("22 duplicate unscheduled match", () => {
  const request = baseRequest({
    operatingWindows: [
      { date: "2026-08-01", startMinutes: 480, endMinutes: 500 },
    ],
    matches: [match("m1")],
  });
  const candidate = buildBaselineScheduleCandidate(request);
  const plan = createSchedulePlan({
    ...candidate.plan,
    unscheduled: [
      createUnscheduledMatch({ matchId: "m1", reasonCode: "X" }),
      createUnscheduledMatch({ matchId: "m1", reasonCode: "Y" }),
    ],
  });
  const result = certify(request, {
    status: BASELINE_CANDIDATE_STATUS,
    constraintCertification: CONSTRAINT_CERTIFICATION.BASELINE_ONLY,
    plan,
  });
  assert.ok(codesOf(result).includes(SCHEDULE_DIAGNOSTIC_CODE.DUPLICATE_MATCH_ID));
});

test("23 match both scheduled and unscheduled", () => {
  const request = baseRequest({ matches: [match("m1")] });
  const candidate = buildBaselineScheduleCandidate(request);
  const plan = createSchedulePlan({
    ...candidate.plan,
    unscheduled: [createUnscheduledMatch({ matchId: "m1", reasonCode: "X" })],
  });
  const result = certify(request, {
    status: BASELINE_CANDIDATE_STATUS,
    constraintCertification: CONSTRAINT_CERTIFICATION.BASELINE_ONLY,
    plan,
  });
  assert.equal(result.ok, false);
});

test("24 bye absent from both arrays", () => {
  const { candidate, result } = buildAndCertify(
    baseRequest({
      matches: [match("bye1", { isBye: true }), match("m1")],
    })
  );
  assert.equal(candidate.plan.scheduled.some((s) => s.matchId === "bye1"), false);
  assert.equal(candidate.plan.unscheduled.some((u) => u.matchId === "bye1"), false);
  assert.equal(result.ok, true);
});

test("25 bye incorrectly scheduled", () => {
  const request = baseRequest({
    matches: [match("bye1", { isBye: true }), match("m1")],
  });
  const candidate = buildBaselineScheduleCandidate(request);
  const s = candidate.plan.scheduled[0];
  const plan = createSchedulePlan({
    ...candidate.plan,
    scheduled: [...candidate.plan.scheduled, { ...s, matchId: "bye1" }],
  });
  const result = certify(request, {
    status: BASELINE_CANDIDATE_STATUS,
    constraintCertification: CONSTRAINT_CERTIFICATION.BASELINE_ONLY,
    plan,
  });
  assert.equal(result.ok, false);
});

test("26 unscheduled non-bye causes incomplete certification", () => {
  const { result } = buildAndCertify(
    baseRequest({
      operatingWindows: [
        { date: "2026-08-01", startMinutes: 480, endMinutes: 500 },
      ],
      matches: [match("m1")],
    })
  );
  assert.equal(result.ok, false);
  assert.equal(
    result.certification,
    CONSTRAINT_CERTIFICATION.HARD_CONSTRAINTS_REJECTED
  );
  assert.ok(codesOf(result).includes(SCHEDULE_DIAGNOSTIC_CODE.SCHEDULE_INCOMPLETE));
});

test("27 valid operating-window containment", () => {
  const { result } = buildAndCertify(baseRequest({ matches: [match("m1")] }));
  assert.equal(result.ok, true);
});

test("28 match starts before window", () => {
  const request = baseRequest({ matches: [match("m1")] });
  const candidate = buildBaselineScheduleCandidate(request);
  const s = candidate.plan.scheduled[0];
  const plan = createSchedulePlan({
    ...candidate.plan,
    scheduled: [
      {
        ...s,
        start: { date: "2026-08-01", minutesFromMidnight: 400 },
        end: { date: "2026-08-01", minutesFromMidnight: 430 },
        startUtcMs: undefined,
        endUtcMs: undefined,
        capacityReleaseUtcMs: undefined,
        durationMinutes: 30,
        bufferMinutes: 5,
      },
    ],
  });
  // Re-derive UTC by leaving them unset — certifier derives from civil.
  const result = certify(request, {
    status: BASELINE_CANDIDATE_STATUS,
    constraintCertification: CONSTRAINT_CERTIFICATION.BASELINE_ONLY,
    plan,
  });
  assert.ok(
    codesOf(result).includes(SCHEDULE_DIAGNOSTIC_CODE.MATCH_OUTSIDE_ALLOWED_WINDOW)
  );
});

test("29 match ends after window", () => {
  const request = baseRequest({
    operatingWindows: [
      { date: "2026-08-01", startMinutes: 480, endMinutes: 520 },
    ],
    matches: [match("m1")],
  });
  const candidate = buildBaselineScheduleCandidate(request);
  const s = candidate.plan.scheduled[0];
  const plan = createSchedulePlan({
    ...candidate.plan,
    scheduled: [
      {
        ...s,
        start: { date: "2026-08-01", minutesFromMidnight: 480 },
        end: { date: "2026-08-01", minutesFromMidnight: 540 },
        durationMinutes: 60,
        bufferMinutes: 5,
        startUtcMs: undefined,
        endUtcMs: undefined,
        capacityReleaseUtcMs: undefined,
      },
    ],
  });
  const result = certify(request, {
    status: BASELINE_CANDIDATE_STATUS,
    constraintCertification: CONSTRAINT_CERTIFICATION.BASELINE_ONLY,
    plan,
  });
  assert.ok(
    codesOf(result).includes(SCHEDULE_DIAGNOSTIC_CODE.MATCH_OUTSIDE_ALLOWED_WINDOW)
  );
});

test("30 civil and UTC start mismatch", () => {
  const request = baseRequest({ matches: [match("m1")] });
  const candidate = buildBaselineScheduleCandidate(request);
  const s = candidate.plan.scheduled[0];
  const plan = createSchedulePlan({
    ...candidate.plan,
    scheduled: [{ ...s, startUtcMs: s.startUtcMs + 60_000 }],
  });
  const result = certify(request, {
    status: BASELINE_CANDIDATE_STATUS,
    constraintCertification: CONSTRAINT_CERTIFICATION.BASELINE_ONLY,
    plan,
  });
  assert.ok(codesOf(result).includes(SCHEDULE_DIAGNOSTIC_CODE.MATCH_TIME_INCONSISTENT));
});

test("31 civil and UTC end mismatch", () => {
  const request = baseRequest({ matches: [match("m1")] });
  const candidate = buildBaselineScheduleCandidate(request);
  const s = candidate.plan.scheduled[0];
  const plan = createSchedulePlan({
    ...candidate.plan,
    scheduled: [{ ...s, endUtcMs: s.endUtcMs + 60_000 }],
  });
  const result = certify(request, {
    status: BASELINE_CANDIDATE_STATUS,
    constraintCertification: CONSTRAINT_CERTIFICATION.BASELINE_ONLY,
    plan,
  });
  assert.ok(codesOf(result).includes(SCHEDULE_DIAGNOSTIC_CODE.MATCH_TIME_INCONSISTENT));
});

test("32 invalid timezone", () => {
  const request = baseRequest({ matches: [match("m1")], timezone: "Not/AZone" });
  const candidate = {
    status: BASELINE_CANDIDATE_STATUS,
    constraintCertification: CONSTRAINT_CERTIFICATION.BASELINE_ONLY,
    plan: createSchedulePlan({
      competitionId: "comp-1f",
      timezone: "Not/AZone",
      scheduled: [],
      unscheduled: [],
    }),
  };
  const result = certify(request, candidate);
  assert.ok(codesOf(result).includes(SCHEDULE_DIAGNOSTIC_CODE.INVALID_TIMEZONE));
});

test("33 overnight/tampered match", () => {
  const request = baseRequest({ matches: [match("m1")] });
  const candidate = buildBaselineScheduleCandidate(request);
  const s = candidate.plan.scheduled[0];
  const plan = createSchedulePlan({
    ...candidate.plan,
    scheduled: [
      {
        ...s,
        start: { date: "2026-08-01", minutesFromMidnight: 1400 },
        end: { date: "2026-08-02", minutesFromMidnight: 30 },
        durationMinutes: 70,
        startUtcMs: undefined,
        endUtcMs: undefined,
        capacityReleaseUtcMs: undefined,
      },
    ],
  });
  const result = certify(request, {
    status: BASELINE_CANDIDATE_STATUS,
    constraintCertification: CONSTRAINT_CERTIFICATION.BASELINE_ONLY,
    plan,
  });
  assert.ok(
    codesOf(result).includes(SCHEDULE_DIAGNOSTIC_CODE.OVERNIGHT_WINDOW_NOT_SUPPORTED)
  );
});

test("34 valid session containment", () => {
  const { result } = buildAndCertify(
    baseRequest({
      sessionWindows: [
        {
          sessionId: "s1",
          date: "2026-08-01",
          startMinutes: 480,
          endMinutes: 600,
        },
      ],
      matches: [match("m1")],
    })
  );
  assert.equal(result.ok, true);
});

test("35 missing sessionId when sessions configured", () => {
  const request = baseRequest({
    sessionWindows: [
      {
        sessionId: "s1",
        date: "2026-08-01",
        startMinutes: 480,
        endMinutes: 600,
      },
    ],
    matches: [match("m1")],
  });
  const candidate = buildBaselineScheduleCandidate(request);
  const s = candidate.plan.scheduled[0];
  const { sessionId: _drop, ...rest } = s;
  const plan = createSchedulePlan({
    ...candidate.plan,
    scheduled: [rest],
  });
  const result = certify(request, {
    status: BASELINE_CANDIDATE_STATUS,
    constraintCertification: CONSTRAINT_CERTIFICATION.BASELINE_ONLY,
    plan,
  });
  assert.ok(
    codesOf(result).includes(SCHEDULE_DIAGNOSTIC_CODE.MATCH_OUTSIDE_ALLOWED_WINDOW)
  );
});

test("36 unknown sessionId", () => {
  const request = baseRequest({
    sessionWindows: [
      {
        sessionId: "s1",
        date: "2026-08-01",
        startMinutes: 480,
        endMinutes: 600,
      },
    ],
    matches: [match("m1")],
  });
  const candidate = buildBaselineScheduleCandidate(request);
  const s = candidate.plan.scheduled[0];
  const plan = createSchedulePlan({
    ...candidate.plan,
    scheduled: [{ ...s, sessionId: "nope" }],
  });
  const result = certify(request, {
    status: BASELINE_CANDIDATE_STATUS,
    constraintCertification: CONSTRAINT_CERTIFICATION.BASELINE_ONLY,
    plan,
  });
  assert.ok(codesOf(result).includes(SCHEDULE_DIAGNOSTIC_CODE.UNKNOWN_SESSION_ID));
});

test("37 match crossing session boundary", () => {
  const request = baseRequest({
    sessionWindows: [
      {
        sessionId: "s1",
        date: "2026-08-01",
        startMinutes: 480,
        endMinutes: 520,
      },
    ],
    matches: [match("m1")],
  });
  const candidate = buildBaselineScheduleCandidate(request);
  const s = candidate.plan.scheduled[0];
  const plan = createSchedulePlan({
    ...candidate.plan,
    scheduled: [
      {
        ...s,
        start: { date: "2026-08-01", minutesFromMidnight: 500 },
        end: { date: "2026-08-01", minutesFromMidnight: 540 },
        durationMinutes: 40,
        startUtcMs: undefined,
        endUtcMs: undefined,
        capacityReleaseUtcMs: undefined,
      },
    ],
  });
  const result = certify(request, {
    status: BASELINE_CANDIDATE_STATUS,
    constraintCertification: CONSTRAINT_CERTIFICATION.BASELINE_ONLY,
    plan,
  });
  assert.ok(
    codesOf(result).includes(SCHEDULE_DIAGNOSTIC_CODE.MATCH_OUTSIDE_ALLOWED_WINDOW)
  );
});

test("38 no session fallback outside configured sessions", () => {
  const { candidate, result } = buildAndCertify(
    baseRequest({
      sessionWindows: [
        {
          sessionId: "s1",
          date: "2026-08-01",
          startMinutes: 600,
          endMinutes: 660,
        },
      ],
      matches: [match("m1")],
    })
  );
  assert.equal(candidate.plan.scheduled[0].sessionId, "s1");
  assert.equal(candidate.plan.scheduled[0].start.minutesFromMidnight, 600);
  assert.equal(result.ok, true);
});

test("39 valid dependency order", () => {
  const { result } = buildAndCertify(
    baseRequest({
      matches: [
        match("m1"),
        match("m2", {
          dependencies: [
            { sourceMatchId: "m1", type: SCHEDULE_DEPENDENCY_TYPE.WINNER_OF },
          ],
        }),
      ],
    })
  );
  assert.equal(result.ok, true);
});

test("40 dependent match before predecessor", () => {
  const request = baseRequest({
    matches: [
      match("m1"),
      match("m2", {
        dependencies: [
          { sourceMatchId: "m1", type: SCHEDULE_DEPENDENCY_TYPE.WINNER_OF },
        ],
      }),
    ],
  });
  const candidate = buildBaselineScheduleCandidate(request);
  const m1 = candidate.plan.scheduled.find((s) => s.matchId === "m1");
  const m2 = candidate.plan.scheduled.find((s) => s.matchId === "m2");
  const plan = createSchedulePlan({
    ...candidate.plan,
    scheduled: [
      {
        ...m2,
        start: m1.start,
        end: m1.end,
        startUtcMs: m1.startUtcMs,
        endUtcMs: m1.endUtcMs,
        capacityReleaseUtcMs: m1.capacityReleaseUtcMs,
      },
      m1,
    ],
  });
  const result = certify(request, {
    status: BASELINE_CANDIDATE_STATUS,
    constraintCertification: CONSTRAINT_CERTIFICATION.BASELINE_ONLY,
    plan,
  });
  assert.ok(
    codesOf(result).includes(SCHEDULE_DIAGNOSTIC_CODE.DEPENDENCY_ORDER_VIOLATION)
  );
});

test("41 dependency buffer violation", () => {
  const request = baseRequest({
    policy: policy({
      duration: { defaultDurationMinutes: 30, bufferMinutes: 10 },
      rest: { minParticipantRestMinutes: 0, minTeamRestMinutes: 0 },
    }),
    matches: [
      match("m1"),
      match("m2", {
        dependencies: [
          { sourceMatchId: "m1", type: SCHEDULE_DEPENDENCY_TYPE.WINNER_OF },
        ],
      }),
    ],
  });
  const candidate = buildBaselineScheduleCandidate(request);
  const m1 = candidate.plan.scheduled.find((s) => s.matchId === "m1");
  const m2 = candidate.plan.scheduled.find((s) => s.matchId === "m2");
  // Move m2 to start exactly at m1.end (skipping dependency buffer).
  const plan = createSchedulePlan({
    ...candidate.plan,
    scheduled: [
      m1,
      {
        ...m2,
        start: { ...m1.end },
        end: {
          date: m1.end.date,
          minutesFromMidnight: m1.end.minutesFromMidnight + 30,
        },
        startUtcMs: m1.endUtcMs,
        endUtcMs: m1.endUtcMs + 30 * 60_000,
        capacityReleaseUtcMs: m1.endUtcMs + 40 * 60_000,
        durationMinutes: 30,
        bufferMinutes: 10,
      },
    ],
  });
  const result = certify(request, {
    status: BASELINE_CANDIDATE_STATUS,
    constraintCertification: CONSTRAINT_CERTIFICATION.BASELINE_ONLY,
    plan,
  });
  assert.ok(
    codesOf(result).includes(SCHEDULE_DIAGNOSTIC_CODE.DEPENDENCY_ORDER_VIOLATION)
  );
});

test("42 unscheduled predecessor", () => {
  const { result } = buildAndCertify(
    baseRequest({
      operatingWindows: [
        { date: "2026-08-01", startMinutes: 480, endMinutes: 510 },
      ],
      matches: [
        match("m1", { estimatedDurationMinutes: 60 }),
        match("m2", {
          dependencies: [
            { sourceMatchId: "m1", type: SCHEDULE_DEPENDENCY_TYPE.WINNER_OF },
          ],
        }),
      ],
    })
  );
  assert.equal(result.ok, false);
});

test("43 unknown dependency", () => {
  const { result } = buildAndCertify(
    baseRequest({
      matches: [
        match("m1", {
          dependencies: [
            { sourceMatchId: "missing", type: SCHEDULE_DEPENDENCY_TYPE.WINNER_OF },
          ],
        }),
      ],
    })
  );
  assert.ok(
    codesOf(result).includes(SCHEDULE_DIAGNOSTIC_CODE.UNKNOWN_MATCH_DEPENDENCY)
  );
});

test("44 cyclic dependency", () => {
  const { result } = buildAndCertify(
    baseRequest({
      matches: [
        match("m1", {
          dependencies: [
            { sourceMatchId: "m2", type: SCHEDULE_DEPENDENCY_TYPE.PREVIOUS_ROUND },
          ],
        }),
        match("m2", {
          dependencies: [
            { sourceMatchId: "m1", type: SCHEDULE_DEPENDENCY_TYPE.PREVIOUS_ROUND },
          ],
        }),
      ],
    })
  );
  assert.ok(
    codesOf(result).includes(SCHEDULE_DIAGNOSTIC_CODE.CYCLIC_MATCH_DEPENDENCY)
  );
});

test("45 bye dependency timing behavior", () => {
  const { result } = buildAndCertify(
    baseRequest({
      matches: [
        match("bye1", { isBye: true, participants: [] }),
        match("m1", {
          dependencies: [
            { sourceMatchId: "bye1", type: SCHEDULE_DEPENDENCY_TYPE.WINNER_OF },
          ],
        }),
      ],
    })
  );
  assert.equal(result.ok, true);
});

test("46 valid capacity occupancy", () => {
  const { result } = buildAndCertify(
    baseRequest({
      policy: policy({ capacity: { maxConcurrentMatches: 2 } }),
      matches: [match("m1"), match("m2")],
    })
  );
  assert.equal(result.ok, true);
});

test("47 capacity exceeded", () => {
  const request = baseRequest({
    policy: policy({
      rest: { minParticipantRestMinutes: 0, minTeamRestMinutes: 0 },
      capacity: { maxConcurrentMatches: 1 },
    }),
    matches: [match("m1", { participants: [p("a1"), p("b1")] }), match("m2", { participants: [p("a2"), p("b2")] })],
  });
  const candidate = buildBaselineScheduleCandidate(request);
  const m1 = candidate.plan.scheduled.find((s) => s.matchId === "m1");
  const m2 = candidate.plan.scheduled.find((s) => s.matchId === "m2");
  const plan = createSchedulePlan({
    ...candidate.plan,
    scheduled: [
      m1,
      {
        ...m2,
        start: { ...m1.start },
        end: { ...m1.end },
        startUtcMs: m1.startUtcMs,
        endUtcMs: m1.endUtcMs,
        capacityReleaseUtcMs: m1.capacityReleaseUtcMs,
        concurrencyIndex: 0,
        abstractSlotIndex: 0,
        durationMinutes: m1.durationMinutes,
        bufferMinutes: m1.bufferMinutes,
      },
    ],
  });
  const result = certify(request, {
    status: BASELINE_CANDIDATE_STATUS,
    constraintCertification: CONSTRAINT_CERTIFICATION.BASELINE_ONLY,
    plan,
  });
  assert.ok(codesOf(result).includes(SCHEDULE_DIAGNOSTIC_CODE.CAPACITY_EXCEEDED));
});

test("48 invalid concurrency index", () => {
  const request = baseRequest({
    policy: policy({ capacity: { maxConcurrentMatches: 1 } }),
    matches: [match("m1")],
  });
  const candidate = buildBaselineScheduleCandidate(request);
  const s = candidate.plan.scheduled[0];
  const plan = createSchedulePlan({
    ...candidate.plan,
    scheduled: [{ ...s, concurrencyIndex: 5, abstractSlotIndex: 5 }],
  });
  const result = certify(request, {
    status: BASELINE_CANDIDATE_STATUS,
    constraintCertification: CONSTRAINT_CERTIFICATION.BASELINE_ONLY,
    plan,
  });
  assert.ok(
    codesOf(result).includes(SCHEDULE_DIAGNOSTIC_CODE.CONCURRENCY_INDEX_INVALID)
  );
});

test("49 same concurrency index overlap", () => {
  // Covered by capacity exceeded with same index — assert specifically.
  const request = baseRequest({
    policy: policy({
      rest: { minParticipantRestMinutes: 0, minTeamRestMinutes: 0 },
      capacity: { maxConcurrentMatches: 2 },
    }),
    matches: [
      match("m1", { participants: [p("x1"), p("y1")] }),
      match("m2", { participants: [p("x2"), p("y2")] }),
    ],
  });
  const candidate = buildBaselineScheduleCandidate(request);
  const m1 = candidate.plan.scheduled.find((s) => s.matchId === "m1");
  const m2 = candidate.plan.scheduled.find((s) => s.matchId === "m2");
  const plan = createSchedulePlan({
    ...candidate.plan,
    scheduled: [
      m1,
      {
        ...m2,
        start: { ...m1.start },
        end: { ...m1.end },
        startUtcMs: m1.startUtcMs,
        endUtcMs: m1.endUtcMs,
        capacityReleaseUtcMs: m1.capacityReleaseUtcMs,
        concurrencyIndex: m1.concurrencyIndex,
        abstractSlotIndex: m1.abstractSlotIndex,
        durationMinutes: m1.durationMinutes,
        bufferMinutes: m1.bufferMinutes,
      },
    ],
  });
  const result = certify(request, {
    status: BASELINE_CANDIDATE_STATUS,
    constraintCertification: CONSTRAINT_CERTIFICATION.BASELINE_ONLY,
    plan,
  });
  assert.ok(codesOf(result).includes(SCHEDULE_DIAGNOSTIC_CODE.CAPACITY_EXCEEDED));
});

test("50 capacity release matches buffer", () => {
  const { candidate, result } = buildAndCertify(
    baseRequest({ matches: [match("m1")] })
  );
  const s = candidate.plan.scheduled[0];
  assert.equal(s.capacityReleaseUtcMs, s.endUtcMs + s.bufferMinutes * 60_000);
  assert.equal(result.ok, true);
});

test("51 capacity release tampered", () => {
  const request = baseRequest({ matches: [match("m1")] });
  const candidate = buildBaselineScheduleCandidate(request);
  const s = candidate.plan.scheduled[0];
  const plan = createSchedulePlan({
    ...candidate.plan,
    scheduled: [{ ...s, capacityReleaseUtcMs: s.endUtcMs }],
  });
  const result = certify(request, {
    status: BASELINE_CANDIDATE_STATUS,
    constraintCertification: CONSTRAINT_CERTIFICATION.BASELINE_ONLY,
    plan,
  });
  assert.ok(
    codesOf(result).includes(SCHEDULE_DIAGNOSTIC_CODE.CAPACITY_RELEASE_INCONSISTENT)
  );
});

test("52 match duration record inconsistent", () => {
  const request = baseRequest({ matches: [match("m1")] });
  const candidate = buildBaselineScheduleCandidate(request);
  const s = candidate.plan.scheduled[0];
  const plan = createSchedulePlan({
    ...candidate.plan,
    scheduled: [{ ...s, durationMinutes: 99 }],
  });
  const result = certify(request, {
    status: BASELINE_CANDIDATE_STATUS,
    constraintCertification: CONSTRAINT_CERTIFICATION.BASELINE_ONLY,
    plan,
  });
  assert.ok(codesOf(result).includes(SCHEDULE_DIAGNOSTIC_CODE.MATCH_TIME_INCONSISTENT));
});

test("53 physical court field rejection", () => {
  const request = baseRequest({ matches: [match("m1")] });
  const candidate = buildBaselineScheduleCandidate(request);
  const s = candidate.plan.scheduled[0];
  const plan = {
    ...candidate.plan,
    scheduled: [{ ...s, courtId: "court-1" }],
  };
  const result = certify(request, {
    status: BASELINE_CANDIDATE_STATUS,
    constraintCertification: CONSTRAINT_CERTIFICATION.BASELINE_ONLY,
    plan,
  });
  assert.ok(
    codesOf(result).includes(
      SCHEDULE_DIAGNOSTIC_CODE.COURT_ASSIGNMENT_BOUNDARY_VIOLATION
    )
  );
});

test("54 referee field rejection", () => {
  const request = baseRequest({ matches: [match("m1")] });
  const candidate = buildBaselineScheduleCandidate(request);
  const s = candidate.plan.scheduled[0];
  const plan = {
    ...candidate.plan,
    scheduled: [{ ...s, refereeId: "ref-1" }],
  };
  const result = certify(request, {
    status: BASELINE_CANDIDATE_STATUS,
    constraintCertification: CONSTRAINT_CERTIFICATION.BASELINE_ONLY,
    plan,
  });
  assert.ok(
    codesOf(result).includes(
      SCHEDULE_DIAGNOSTIC_CODE.REFEREE_ASSIGNMENT_BOUNDARY_VIOLATION
    )
  );
});

test("55 forged candidate status", () => {
  const request = baseRequest({ matches: [match("m1")] });
  const candidate = buildBaselineScheduleCandidate(request);
  const result = certify(request, {
    ...candidate,
    status: "PRODUCTION_SCHEDULE",
  });
  assert.equal(result.ok, false);
  assert.ok(
    codesOf(result).includes(
      SCHEDULE_DIAGNOSTIC_CODE.HARD_CONSTRAINT_CERTIFICATION_FAILED
    )
  );
});

test("56 forged certification marker", () => {
  const request = baseRequest({ matches: [match("m1")] });
  const candidate = buildBaselineScheduleCandidate(request);
  const result = certify(request, {
    ...candidate,
    constraintCertification: CONSTRAINT_CERTIFICATION.HARD_CONSTRAINTS_CERTIFIED,
  });
  assert.equal(result.ok, false);
});

test("57 certification result is separate from candidate", () => {
  const request = baseRequest({ matches: [match("m1")] });
  const candidate = buildBaselineScheduleCandidate(request);
  const before = serializeCanonical(candidate.plan);
  const result = certify(request, candidate);
  assert.equal(result.status, CONSTRAINT_CERTIFICATION_RESULT_STATUS);
  assert.notEqual(result.status, candidate.status);
  assert.equal(serializeCanonical(candidate.plan), before);
  assert.equal(
    candidate.constraintCertification,
    CONSTRAINT_CERTIFICATION.BASELINE_ONLY
  );
});

test("58 successful HARD_CONSTRAINTS_CERTIFIED", () => {
  const { result } = buildAndCertify(baseRequest({ matches: [match("m1")] }));
  assert.equal(
    result.certification,
    CONSTRAINT_CERTIFICATION.HARD_CONSTRAINTS_CERTIFIED
  );
  assert.equal(result.ok, true);
});

test("59 failed HARD_CONSTRAINTS_REJECTED", () => {
  const { result } = buildAndCertify(
    baseRequest({
      operatingWindows: [
        { date: "2026-08-01", startMinutes: 480, endMinutes: 500 },
      ],
      matches: [match("m1")],
    })
  );
  assert.equal(
    result.certification,
    CONSTRAINT_CERTIFICATION.HARD_CONSTRAINTS_REJECTED
  );
});

test("60 deterministic diagnostics", () => {
  const request = baseRequest({
    matches: [
      match("m2", {
        participants: [
          p("__PENDING__", { kind: PARTICIPANT_REFERENCE_KIND.PLACEHOLDER }),
        ],
      }),
      match("m1", {
        participants: [
          p("TBD", { kind: PARTICIPANT_REFERENCE_KIND.PLACEHOLDER }),
        ],
      }),
    ],
  });
  const candidate = buildBaselineScheduleCandidate(request);
  const a = certify(request, candidate);
  const b = certify(request, candidate);
  assert.deepEqual(
    a.diagnostics.map((d) => d.code + d.path),
    b.diagnostics.map((d) => d.code + d.path)
  );
});

test("61 deterministic violations", () => {
  const { result } = buildAndCertify(
    baseRequest({
      matches: [
        match("m1", {
          participants: [
            p("__PENDING__", { kind: PARTICIPANT_REFERENCE_KIND.PLACEHOLDER }),
          ],
        }),
      ],
    })
  );
  const again = certify(
    baseRequest({
      matches: [
        match("m1", {
          participants: [
            p("__PENDING__", { kind: PARTICIPANT_REFERENCE_KIND.PLACEHOLDER }),
          ],
        }),
      ],
    }),
    buildBaselineScheduleCandidate(
      baseRequest({
        matches: [
          match("m1", {
            participants: [
              p("__PENDING__", { kind: PARTICIPANT_REFERENCE_KIND.PLACEHOLDER }),
            ],
          }),
        ],
      })
    )
  );
  assert.deepEqual(
    result.violations.map((v) => v.code),
    again.violations.map((v) => v.code)
  );
});

test("62 deterministic fingerprints", () => {
  const request = baseRequest({ matches: [match("m1")] });
  const candidate = buildBaselineScheduleCandidate(request);
  const a = certify(request, candidate);
  const b = certify(request, candidate);
  assert.equal(a.replay.inputFingerprint, b.replay.inputFingerprint);
  assert.equal(a.replay.resultFingerprint, b.replay.resultFingerprint);
});

test("63 input immutability", () => {
  const request = baseRequest({ matches: [match("m1"), match("m2")] });
  const candidate = buildBaselineScheduleCandidate(request);
  const beforeReq = JSON.stringify(request);
  const beforeCand = JSON.stringify(candidate);
  certify(request, candidate);
  assert.equal(JSON.stringify(request), beforeReq);
  assert.equal(JSON.stringify(candidate), beforeCand);
});

test("64 no candidate repair or rescheduling", () => {
  const src = readModuleSources();
  assert.equal(/function\s+reschedule|repairCandidate|publishSchedule/.test(src), false);
  const request = baseRequest({
    operatingWindows: [
      { date: "2026-08-01", startMinutes: 480, endMinutes: 500 },
    ],
    matches: [match("m1")],
  });
  const candidate = buildBaselineScheduleCandidate(request);
  const before = fingerprintSchedulePlan(candidate.plan);
  certify(request, candidate);
  assert.equal(fingerprintSchedulePlan(candidate.plan), before);
});

test("65 no winner/loser inference", () => {
  const src = readModuleSources();
  assert.equal(/inferWinner|inferLoser|resolveWinner|resolveLoser/.test(src), false);
});

test("66 no lifecycle mutation", () => {
  const src = readModuleSources();
  assert.equal(/mutateLifecycle|completeMatch\(|setMatchStatus/.test(src), false);
});

test("67 no CORE-09 adapter import", () => {
  const src = readModuleSources();
  assert.equal(/from ['"].*competition-core\/scheduling/.test(src), false);
});

test("68 no CORE-10 runtime", () => {
  const src = readModuleSources();
  assert.equal(/from ['"].*competition-core\/optimizer/.test(src), false);
});

test("69 no CORE-12 implementation", () => {
  const src = readModuleSources();
  assert.equal(/from ['"].*venue-court|from ['"].*court-engine/.test(src), false);
});

test("70 no court/referee/persistence/UI import", () => {
  const src = readModuleSources();
  assert.equal(/from ['"]react['"]/.test(src), false);
  assert.equal(/from ['"]@mui\//.test(src), false);
  assert.equal(/supabase/i.test(src), false);
});

test("71 no Date.now, Math.random, random UUID or localeCompare", () => {
  for (const file of listJsFiles(SE_ROOT)) {
    const text = readFileSync(file, "utf8");
    const code = text
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/(^|[^:])\/\/.*$/gm, "$1");
    assert.equal(/Date\.now\s*\(/.test(code), false, file);
    assert.equal(/Math\.random\s*\(/.test(code), false, file);
    assert.equal(/\brandomUUID\s*\(/.test(code), false, file);
    assert.equal(/\.localeCompare\s*\(/.test(code), false, file);
  }
});

test("72 Phase 1B test suite remains present", () => {
  assert.equal(
    existsSync(
      path.join(
        ROOT,
        "tests/competition-core-schedule-engine-core11-phase1b-contracts.test.js"
      )
    ),
    true
  );
});

test("73 Phase 1C test suite remains present", () => {
  assert.equal(
    existsSync(
      path.join(
        ROOT,
        "tests/competition-core-schedule-engine-core11-phase1c-time-windows.test.js"
      )
    ),
    true
  );
});

test("74 Phase 1D test suite remains present", () => {
  assert.equal(
    existsSync(
      path.join(
        ROOT,
        "tests/competition-core-schedule-engine-core11-phase1d-dependency-graph.test.js"
      )
    ),
    true
  );
});

test("75 Phase 1E test suite remains present", () => {
  assert.equal(
    existsSync(
      path.join(
        ROOT,
        "tests/competition-core-schedule-engine-core11-phase1e-baseline-scheduler.test.js"
      )
    ),
    true
  );
});

/* -------------------------------------------------------------------------- */
/* Condition 1 — conservative placeholder lineage                             */
/* -------------------------------------------------------------------------- */

function matchByIdMap(request) {
  /** @type {Map<string, unknown>} */
  const map = new Map();
  for (const m of request.matches || []) {
    map.set(m.matchId, m);
  }
  return map;
}

test("C1-01 direct concrete player identity", () => {
  const request = baseRequest({
    matches: [
      match("m1", {
        participants: [
          p("player-1", { kind: PARTICIPANT_REFERENCE_KIND.PLAYER }),
          p("player-2", { kind: PARTICIPANT_REFERENCE_KIND.PLAYER }),
        ],
      }),
    ],
  });
  const { result } = buildAndCertify(request);
  assert.equal(result.ok, true);
});

test("C1-02 direct team or entry identity", () => {
  const request = baseRequest({
    matches: [
      match("m1", {
        participants: [
          p("team-a", { kind: PARTICIPANT_REFERENCE_KIND.TEAM }),
          p("entry-b", { kind: PARTICIPANT_REFERENCE_KIND.ENTRY }),
        ],
      }),
    ],
  });
  const { result } = buildAndCertify(request);
  assert.equal(result.ok, true);
});

test("C1-03 winner placeholder derives all possible source resources", () => {
  const request = baseRequest({
    matches: [
      match("m1", {
        participants: [p("p101"), p("p102")],
      }),
      match("m2", {
        participants: [
          p("WINNER_OF:m1", { kind: PARTICIPANT_REFERENCE_KIND.PLACEHOLDER }),
          p("p200"),
        ],
        dependencies: [
          { sourceMatchId: "m1", type: SCHEDULE_DEPENDENCY_TYPE.WINNER_OF },
        ],
      }),
    ],
  });
  const derived = deriveConservativeConstraintResources(
    p("WINNER_OF:m1", { kind: PARTICIPANT_REFERENCE_KIND.PLACEHOLDER }),
    "m2",
    matchByIdMap(request)
  );
  assert.equal(derived.unresolved, false);
  const ids = derived.resources.map((r) => r.resourceId).sort();
  assert.deepEqual(ids, ["p101", "p102"]);
});

test("C1-04 loser placeholder derives all possible source resources", () => {
  const request = baseRequest({
    matches: [
      match("m1", { participants: [p("a"), p("b")] }),
      match("m2", {
        participants: [
          p("LOSER_OF:m1", { kind: PARTICIPANT_REFERENCE_KIND.PLACEHOLDER }),
        ],
        dependencies: [
          { sourceMatchId: "m1", type: SCHEDULE_DEPENDENCY_TYPE.LOSER_OF },
        ],
      }),
    ],
  });
  const derived = deriveConservativeConstraintResources(
    p("LOSER_OF:m1", { kind: PARTICIPANT_REFERENCE_KIND.PLACEHOLDER }),
    "m2",
    matchByIdMap(request)
  );
  assert.deepEqual(
    derived.resources.map((r) => r.resourceId).sort(),
    ["a", "b"]
  );
});

test("C1-05 multi-round lineage propagation", () => {
  const request = baseRequest({
    matches: [
      match("r1", { participants: [p("w"), p("x")] }),
      match("r2", {
        participants: [
          p("WINNER_OF:r1", { kind: PARTICIPANT_REFERENCE_KIND.PLACEHOLDER }),
          p("y"),
        ],
        dependencies: [
          { sourceMatchId: "r1", type: SCHEDULE_DEPENDENCY_TYPE.WINNER_OF },
        ],
      }),
      match("r3", {
        participants: [
          p("WINNER_OF:r2", { kind: PARTICIPANT_REFERENCE_KIND.PLACEHOLDER }),
        ],
        dependencies: [
          { sourceMatchId: "r2", type: SCHEDULE_DEPENDENCY_TYPE.WINNER_OF },
        ],
      }),
    ],
  });
  const derived = deriveConservativeConstraintResources(
    p("WINNER_OF:r2", { kind: PARTICIPANT_REFERENCE_KIND.PLACEHOLDER }),
    "r3",
    matchByIdMap(request)
  );
  assert.equal(derived.unresolved, false);
  assert.deepEqual(
    derived.resources.map((r) => r.resourceId).sort(),
    ["w", "x", "y"]
  );
});

test("C1-06 branching lineage union", () => {
  const request = baseRequest({
    matches: [
      match("a", { participants: [p("p1"), p("p2")] }),
      match("b", { participants: [p("p3"), p("p4")] }),
      match("final", {
        participants: [
          p("__PENDING_A__", { kind: PARTICIPANT_REFERENCE_KIND.PLACEHOLDER }),
          p("__PENDING_B__", { kind: PARTICIPANT_REFERENCE_KIND.PLACEHOLDER }),
        ],
        dependencies: [
          { sourceMatchId: "a", type: SCHEDULE_DEPENDENCY_TYPE.WINNER_OF },
          { sourceMatchId: "b", type: SCHEDULE_DEPENDENCY_TYPE.WINNER_OF },
        ],
      }),
    ],
  });
  const derived = deriveConservativeConstraintResources(
    p("__PENDING_A__", { kind: PARTICIPANT_REFERENCE_KIND.PLACEHOLDER }),
    "final",
    matchByIdMap(request)
  );
  // Match-level WINNER_OF deps are unioned for any placeholder on that match.
  assert.deepEqual(
    derived.resources.map((r) => r.resourceId).sort(),
    ["p1", "p2", "p3", "p4"]
  );
});

test("C1-07 duplicate lineage resources are normalized", () => {
  const request = baseRequest({
    matches: [
      match("m1", {
        participants: [
          p("shared", { constraintResourceIds: ["player:1", "player:1"] }),
          p("other", { constraintResourceIds: ["player:1"] }),
        ],
      }),
      match("m2", {
        participants: [
          p("WINNER_OF:m1", { kind: PARTICIPANT_REFERENCE_KIND.PLACEHOLDER }),
        ],
        dependencies: [
          { sourceMatchId: "m1", type: SCHEDULE_DEPENDENCY_TYPE.WINNER_OF },
        ],
      }),
    ],
  });
  const derived = deriveConservativeConstraintResources(
    p("WINNER_OF:m1", { kind: PARTICIPANT_REFERENCE_KIND.PLACEHOLDER }),
    "m2",
    matchByIdMap(request)
  );
  const playerKeys = derived.resources
    .filter((r) => r.resourceId === "player:1")
    .map((r) => r.resourceId);
  assert.equal(playerKeys.length, 1);
});

test("C1-08 input-order-independent lineage", () => {
  const mk = (participantOrder, depOrder) =>
    baseRequest({
      matches: [
        match("m1", {
          participants: participantOrder.map((id) => p(id)),
        }),
        match("m2", {
          participants: [
            p("WINNER_OF:m1", { kind: PARTICIPANT_REFERENCE_KIND.PLACEHOLDER }),
          ],
          dependencies: depOrder,
        }),
      ],
    });
  const a = deriveConservativeConstraintResources(
    p("WINNER_OF:m1", { kind: PARTICIPANT_REFERENCE_KIND.PLACEHOLDER }),
    "m2",
    matchByIdMap(
      mk(["z", "a"], [
        { sourceMatchId: "m1", type: SCHEDULE_DEPENDENCY_TYPE.WINNER_OF },
      ])
    )
  );
  const b = deriveConservativeConstraintResources(
    p("WINNER_OF:m1", { kind: PARTICIPANT_REFERENCE_KIND.PLACEHOLDER }),
    "m2",
    matchByIdMap(
      mk(["a", "z"], [
        { sourceMatchId: "m1", type: SCHEDULE_DEPENDENCY_TYPE.WINNER_OF },
      ])
    )
  );
  assert.deepEqual(
    a.resources.map((r) => `${r.kind}:${r.resourceId}`),
    b.resources.map((r) => `${r.kind}:${r.resourceId}`)
  );
});

test("C1-09 placeholder does not infer one winner", () => {
  const request = baseRequest({
    matches: [
      match("m1", { participants: [p("only-a"), p("only-b")] }),
      match("m2", {
        participants: [
          p("WINNER_OF:m1", { kind: PARTICIPANT_REFERENCE_KIND.PLACEHOLDER }),
        ],
        dependencies: [
          { sourceMatchId: "m1", type: SCHEDULE_DEPENDENCY_TYPE.WINNER_OF },
        ],
      }),
    ],
  });
  const derived = deriveConservativeConstraintResources(
    p("WINNER_OF:m1", { kind: PARTICIPANT_REFERENCE_KIND.PLACEHOLDER }),
    "m2",
    matchByIdMap(request)
  );
  assert.equal(derived.resources.length, 2);
  assert.ok(derived.resources.every((r) => r.resourceId !== "WINNER"));
});

test("C1-10 placeholder conflict is detected conservatively", () => {
  const request = baseRequest({
    policy: policy({
      rest: { minParticipantRestMinutes: 0, minTeamRestMinutes: 0 },
      capacity: { maxConcurrentMatches: 2 },
    }),
    matches: [
      match("m1", { participants: [p("p101"), p("p102")] }),
      match("m2", {
        participants: [
          p("WINNER_OF:m1", { kind: PARTICIPANT_REFERENCE_KIND.PLACEHOLDER }),
          p("outsider"),
        ],
        dependencies: [
          { sourceMatchId: "m1", type: SCHEDULE_DEPENDENCY_TYPE.WINNER_OF },
        ],
      }),
    ],
  });
  const candidate = buildBaselineScheduleCandidate(request);
  const m1 = candidate.plan.scheduled.find((s) => s.matchId === "m1");
  const plan = createSchedulePlan({
    ...candidate.plan,
    scheduled: candidate.plan.scheduled.map((s) =>
      s.matchId === "m2"
        ? {
            ...s,
            start: { ...m1.start },
            end: { ...m1.end },
            startUtcMs: m1.startUtcMs,
            endUtcMs: m1.endUtcMs,
            capacityReleaseUtcMs: m1.capacityReleaseUtcMs,
            durationMinutes: m1.durationMinutes,
            bufferMinutes: m1.bufferMinutes,
            concurrencyIndex: 1,
            abstractSlotIndex: 1,
          }
        : s
    ),
  });
  const result = certify(request, {
    status: BASELINE_CANDIDATE_STATUS,
    constraintCertification: CONSTRAINT_CERTIFICATION.BASELINE_ONLY,
    plan,
  });
  assert.equal(result.ok, false);
  assert.ok(codesOf(result).includes(SCHEDULE_DIAGNOSTIC_CODE.PARTICIPANT_OVERLAP));
});

test("C1-11 placeholder rest violation is detected conservatively", () => {
  // Phase 1E-R1 places conservatively for WINNER_OF placeholders, so the live
  // baseline candidate is rest-legal. Phase 1F defense-in-depth is verified by
  // forging an insufficient-rest schedule (same pattern as test 06).
  const request = baseRequest({
    policy: policy({
      rest: { minParticipantRestMinutes: 30, minTeamRestMinutes: 0 },
      capacity: { maxConcurrentMatches: 1 },
      duration: { defaultDurationMinutes: 30, bufferMinutes: 0 },
    }),
    matches: [
      match("m1", { participants: [p("p101"), p("p102")] }),
      match("m2", {
        participants: [
          p("WINNER_OF:m1", { kind: PARTICIPANT_REFERENCE_KIND.PLACEHOLDER }),
          p("outsider"),
        ],
        dependencies: [
          { sourceMatchId: "m1", type: SCHEDULE_DEPENDENCY_TYPE.WINNER_OF },
        ],
      }),
    ],
  });
  const candidate = buildBaselineScheduleCandidate(request);
  const live = certify(request, candidate);
  assert.equal(live.ok, true);
  const m1 = candidate.plan.scheduled.find((s) => s.matchId === "m1");
  const m2 = candidate.plan.scheduled.find((s) => s.matchId === "m2");
  assert.ok(m1 && m2);
  assert.ok(m2.startUtcMs >= m1.endUtcMs + 30 * 60_000);

  const forgedPlan = createSchedulePlan({
    ...candidate.plan,
    scheduled: candidate.plan.scheduled.map((s) => {
      if (s.matchId !== "m2") return s;
      return {
        ...s,
        start: { date: m1.end.date, minutesFromMidnight: m1.end.minutesFromMidnight },
        end: {
          date: m1.end.date,
          minutesFromMidnight: m1.end.minutesFromMidnight + 30,
        },
        startUtcMs: m1.endUtcMs,
        endUtcMs: m1.endUtcMs + 30 * 60_000,
        capacityReleaseUtcMs: m1.endUtcMs + 30 * 60_000,
        durationMinutes: 30,
        bufferMinutes: 0,
        concurrencyIndex: 0,
        abstractSlotIndex: 0,
      };
    }),
  });
  const result = certify(request, {
    status: BASELINE_CANDIDATE_STATUS,
    constraintCertification: CONSTRAINT_CERTIFICATION.BASELINE_ONLY,
    plan: forgedPlan,
  });
  assert.equal(result.ok, false);
  assert.ok(codesOf(result).includes(SCHEDULE_DIAGNOSTIC_CODE.INSUFFICIENT_REST));
});

test("C1-12 structurally safe future match can be certified", () => {
  const request = baseRequest({
    policy: policy({
      rest: { minParticipantRestMinutes: 5, minTeamRestMinutes: 0 },
      capacity: { maxConcurrentMatches: 1 },
    }),
    matches: [
      match("m1", { participants: [p("p101"), p("p102")] }),
      match("m2", {
        participants: [
          p("WINNER_OF:m1", { kind: PARTICIPANT_REFERENCE_KIND.PLACEHOLDER }),
          p("p200"),
        ],
        dependencies: [
          { sourceMatchId: "m1", type: SCHEDULE_DEPENDENCY_TYPE.WINNER_OF },
        ],
      }),
    ],
  });
  const { result } = buildAndCertify(request);
  assert.equal(result.ok, true);
  assert.equal(result.certification, CONSTRAINT_CERTIFICATION.HARD_CONSTRAINTS_CERTIFIED);
  assert.equal(
    codesOf(result).includes(SCHEDULE_DIAGNOSTIC_CODE.PARTICIPANT_IDENTITY_UNRESOLVED),
    false
  );
});

test("C1-13 opaque placeholder fails closed", () => {
  const { result } = buildAndCertify(
    baseRequest({
      matches: [
        match("m1", {
          participants: [
            p("mystery", { kind: PARTICIPANT_REFERENCE_KIND.PLACEHOLDER }),
          ],
        }),
      ],
    })
  );
  assert.equal(result.ok, false);
  assert.ok(
    codesOf(result).includes(SCHEDULE_DIAGNOSTIC_CODE.PARTICIPANT_IDENTITY_UNRESOLVED)
  );
});

test("C1-14 external qualification placeholder without lineage fails closed", () => {
  const { result } = buildAndCertify(
    baseRequest({
      matches: [
        match("m1", {
          participants: [
            p("qual", { kind: PARTICIPANT_REFERENCE_KIND.PLACEHOLDER }),
          ],
          dependencies: [
            {
              sourceMatchId: "m1",
              type: SCHEDULE_DEPENDENCY_TYPE.QUALIFICATION,
            },
          ],
        }),
      ],
    })
  );
  // Self QUALIFICATION is invalid graph-wise or unresolved identity.
  assert.equal(result.ok, false);
  assert.ok(
    codesOf(result).includes(SCHEDULE_DIAGNOSTIC_CODE.PARTICIPANT_IDENTITY_UNRESOLVED) ||
      codesOf(result).includes(SCHEDULE_DIAGNOSTIC_CODE.UNKNOWN_MATCH_DEPENDENCY) ||
      codesOf(result).includes(SCHEDULE_DIAGNOSTIC_CODE.CYCLIC_MATCH_DEPENDENCY) ||
      codesOf(result).includes(SCHEDULE_DIAGNOSTIC_CODE.HARD_CONSTRAINT_CERTIFICATION_FAILED)
  );
});

test("C1-14b qualification from external barrier source fails closed", () => {
  const request = baseRequest({
    matches: [
      match("gate", { participants: [p("seed-a"), p("seed-b")] }),
      match("m2", {
        participants: [
          p("qual-slot", { kind: PARTICIPANT_REFERENCE_KIND.PLACEHOLDER }),
        ],
        dependencies: [
          {
            sourceMatchId: "gate",
            type: SCHEDULE_DEPENDENCY_TYPE.QUALIFICATION,
          },
        ],
      }),
    ],
  });
  const derived = deriveConservativeConstraintResources(
    p("qual-slot", { kind: PARTICIPANT_REFERENCE_KIND.PLACEHOLDER }),
    "m2",
    matchByIdMap(request)
  );
  assert.equal(derived.unresolved, true);
  assert.equal(derived.resources.length, 0);
});

test("C1-15 bye lineage creates no identity", () => {
  const request = baseRequest({
    matches: [
      match("bye1", { isBye: true, participants: [] }),
      match("m2", {
        participants: [
          p("WINNER_OF:bye1", { kind: PARTICIPANT_REFERENCE_KIND.PLACEHOLDER }),
          p("concrete"),
        ],
        dependencies: [
          { sourceMatchId: "bye1", type: SCHEDULE_DEPENDENCY_TYPE.WINNER_OF },
        ],
      }),
    ],
  });
  const derived = deriveConservativeConstraintResources(
    p("WINNER_OF:bye1", { kind: PARTICIPANT_REFERENCE_KIND.PLACEHOLDER }),
    "m2",
    matchByIdMap(request)
  );
  assert.equal(derived.lineageResolved, true);
  assert.equal(derived.unresolved, false);
  assert.equal(derived.resources.length, 0);
});

test("C1-16 cyclic lineage does not recurse indefinitely", () => {
  const request = baseRequest({
    matches: [
      match("m1", {
        participants: [
          p("WINNER_OF:m2", { kind: PARTICIPANT_REFERENCE_KIND.PLACEHOLDER }),
        ],
        dependencies: [
          { sourceMatchId: "m2", type: SCHEDULE_DEPENDENCY_TYPE.WINNER_OF },
        ],
      }),
      match("m2", {
        participants: [
          p("WINNER_OF:m1", { kind: PARTICIPANT_REFERENCE_KIND.PLACEHOLDER }),
        ],
        dependencies: [
          { sourceMatchId: "m1", type: SCHEDULE_DEPENDENCY_TYPE.WINNER_OF },
        ],
      }),
    ],
  });
  const derived = deriveConservativeConstraintResources(
    p("WINNER_OF:m2", { kind: PARTICIPANT_REFERENCE_KIND.PLACEHOLDER }),
    "m1",
    matchByIdMap(request)
  );
  assert.equal(derived.unresolved, true);
});

test("C1-17 no display-name identity inference", () => {
  const src = readModuleSources();
  assert.equal(/displayName|playerName/.test(src), false);
  const request = baseRequest({
    matches: [
      match("m1", {
        participants: [
          createScheduleParticipantReference({
            participantId: "id-1",
            metadata: { displayName: "Alice" },
          }),
        ],
      }),
    ],
  });
  const derived = deriveConservativeConstraintResources(
    request.matches[0].participants[0],
    "m1",
    matchByIdMap(request)
  );
  assert.deepEqual(
    derived.resources.map((r) => r.resourceId),
    ["id-1"]
  );
});

test("C1-18 no score or lifecycle dependency", () => {
  const src = readModuleSources();
  assert.equal(
    /readScore|matchResult|lifecycleState|inferWinner|inferLoser/.test(src),
    false
  );
});

/* -------------------------------------------------------------------------- */
/* Condition 2 — canonical fingerprints                                       */
/* -------------------------------------------------------------------------- */

test("C2-01 same semantic request different input order → same fingerprint", () => {
  const a = baseRequest({
    matches: [match("m2", { participants: [p("b"), p("a")] }), match("m1")],
  });
  const b = baseRequest({
    matches: [match("m1"), match("m2", { participants: [p("a"), p("b")] })],
  });
  assert.equal(fingerprintScheduleRequest(a), fingerprintScheduleRequest(b));
});

test("C2-02 same semantic candidate different array order → same fingerprint", () => {
  const request = baseRequest({ matches: [match("m1"), match("m2")] });
  const candidate = buildBaselineScheduleCandidate(request);
  const planA = createSchedulePlan({
    ...candidate.plan,
    scheduled: [...candidate.plan.scheduled].reverse(),
  });
  const envA = {
    status: BASELINE_CANDIDATE_STATUS,
    constraintCertification: CONSTRAINT_CERTIFICATION.BASELINE_ONLY,
    plan: planA,
  };
  const envB = {
    status: BASELINE_CANDIDATE_STATUS,
    constraintCertification: CONSTRAINT_CERTIFICATION.BASELINE_ONLY,
    plan: candidate.plan,
  };
  assert.equal(
    fingerprintBaselineScheduleCandidate(envA),
    fingerprintBaselineScheduleCandidate(envB)
  );
});

test("C2-03 changing scheduled time → different candidate fingerprint", () => {
  const request = baseRequest({ matches: [match("m1")] });
  const candidate = buildBaselineScheduleCandidate(request);
  const env = {
    status: BASELINE_CANDIDATE_STATUS,
    constraintCertification: CONSTRAINT_CERTIFICATION.BASELINE_ONLY,
    plan: candidate.plan,
  };
  const before = fingerprintBaselineScheduleCandidate(env);
  const plan = createSchedulePlan({
    ...candidate.plan,
    scheduled: candidate.plan.scheduled.map((s) => ({
      ...s,
      start: { ...s.start, minutesFromMidnight: s.start.minutesFromMidnight + 5 },
      startUtcMs: s.startUtcMs + 5 * 60_000,
      end: { ...s.end, minutesFromMidnight: s.end.minutesFromMidnight + 5 },
      endUtcMs: s.endUtcMs + 5 * 60_000,
      capacityReleaseUtcMs: s.capacityReleaseUtcMs + 5 * 60_000,
    })),
  });
  const after = fingerprintBaselineScheduleCandidate({ ...env, plan });
  assert.notEqual(before, after);
});

test("C2-04 changing resource identity → different request fingerprint", () => {
  const a = baseRequest({ matches: [match("m1", { participants: [p("a")] })] });
  const b = baseRequest({ matches: [match("m1", { participants: [p("b")] })] });
  assert.notEqual(fingerprintScheduleRequest(a), fingerprintScheduleRequest(b));
});

test("C2-05 changing rest policy → different request fingerprint", () => {
  const a = baseRequest({
    policy: policy({ rest: { minParticipantRestMinutes: 10, minTeamRestMinutes: 0 } }),
  });
  const b = baseRequest({
    policy: policy({ rest: { minParticipantRestMinutes: 20, minTeamRestMinutes: 0 } }),
  });
  assert.notEqual(fingerprintScheduleRequest(a), fingerprintScheduleRequest(b));
});

test("C2-06 changing capacity policy → different request fingerprint", () => {
  const a = baseRequest({
    policy: policy({ capacity: { maxConcurrentMatches: 1 } }),
  });
  const b = baseRequest({
    policy: policy({ capacity: { maxConcurrentMatches: 2 } }),
  });
  assert.notEqual(fingerprintScheduleRequest(a), fingerprintScheduleRequest(b));
});

test("C2-07 changing session or window → different request fingerprint", () => {
  const a = baseRequest({
    operatingWindows: [{ date: "2026-08-01", startMinutes: 480, endMinutes: 900 }],
  });
  const b = baseRequest({
    operatingWindows: [{ date: "2026-08-01", startMinutes: 500, endMinutes: 900 }],
  });
  assert.notEqual(fingerprintScheduleRequest(a), fingerprintScheduleRequest(b));
});

test("C2-08 moving match between scheduled and unscheduled → different candidate fingerprint", () => {
  const request = baseRequest({ matches: [match("m1"), match("m2")] });
  const candidate = buildBaselineScheduleCandidate(request);
  const env = {
    status: BASELINE_CANDIDATE_STATUS,
    constraintCertification: CONSTRAINT_CERTIFICATION.BASELINE_ONLY,
    plan: candidate.plan,
  };
  const before = fingerprintBaselineScheduleCandidate(env);
  const moved = candidate.plan.scheduled[1];
  const plan = createSchedulePlan({
    ...candidate.plan,
    scheduled: candidate.plan.scheduled.filter((s) => s.matchId !== moved.matchId),
    unscheduled: [
      ...candidate.plan.unscheduled,
      createUnscheduledMatch({
        matchId: moved.matchId,
        reasonCode: SCHEDULE_DIAGNOSTIC_CODE.ABSTRACT_CAPACITY_EXHAUSTED,
      }),
    ],
  });
  assert.notEqual(
    before,
    fingerprintBaselineScheduleCandidate({ ...env, plan })
  );
});

test("C2-09 changing capacity release → different candidate fingerprint", () => {
  const request = baseRequest({ matches: [match("m1")] });
  const candidate = buildBaselineScheduleCandidate(request);
  const env = {
    status: BASELINE_CANDIDATE_STATUS,
    constraintCertification: CONSTRAINT_CERTIFICATION.BASELINE_ONLY,
    plan: candidate.plan,
  };
  const before = fingerprintBaselineScheduleCandidate(env);
  const plan = createSchedulePlan({
    ...candidate.plan,
    scheduled: candidate.plan.scheduled.map((s) => ({
      ...s,
      capacityReleaseUtcMs: s.capacityReleaseUtcMs + 60_000,
    })),
  });
  assert.notEqual(before, fingerprintBaselineScheduleCandidate({ ...env, plan }));
});

test("C2-10 changing concurrency index → different candidate fingerprint", () => {
  const request = baseRequest({
    policy: policy({ capacity: { maxConcurrentMatches: 2 } }),
    matches: [match("m1"), match("m2")],
  });
  const candidate = buildBaselineScheduleCandidate(request);
  const env = {
    status: BASELINE_CANDIDATE_STATUS,
    constraintCertification: CONSTRAINT_CERTIFICATION.BASELINE_ONLY,
    plan: candidate.plan,
  };
  const before = fingerprintBaselineScheduleCandidate(env);
  const plan = createSchedulePlan({
    ...candidate.plan,
    scheduled: candidate.plan.scheduled.map((s, i) =>
      i === 0 ? { ...s, concurrencyIndex: (s.concurrencyIndex ?? 0) === 0 ? 1 : 0 } : s
    ),
  });
  assert.notEqual(before, fingerprintBaselineScheduleCandidate({ ...env, plan }));
});

test("C2-11 changing only producedAt → unchanged semantic fingerprint", () => {
  const request = baseRequest({ matches: [match("m1")] });
  const candidate = buildBaselineScheduleCandidate(request);
  const env = {
    status: BASELINE_CANDIDATE_STATUS,
    constraintCertification: CONSTRAINT_CERTIFICATION.BASELINE_ONLY,
    plan: candidate.plan,
  };
  const before = fingerprintBaselineScheduleCandidate(env);
  const plan = createSchedulePlan({
    ...candidate.plan,
    producedAt: "2099-01-01T00:00:00.000Z",
  });
  assert.equal(
    before,
    fingerprintBaselineScheduleCandidate({ ...env, plan })
  );
});

test("C2-12 fingerprint generation deterministic across repeats", () => {
  const request = baseRequest({
    matches: [match("m1", { participants: [p("a"), p("b")] })],
  });
  const candidate = buildBaselineScheduleCandidate(request);
  const env = {
    status: BASELINE_CANDIDATE_STATUS,
    constraintCertification: CONSTRAINT_CERTIFICATION.BASELINE_ONLY,
    plan: candidate.plan,
  };
  assert.equal(fingerprintScheduleRequest(request), fingerprintScheduleRequest(request));
  assert.equal(
    fingerprintBaselineScheduleCandidate(env),
    fingerprintBaselineScheduleCandidate(env)
  );
  const cert = certify(request, candidate);
  assert.equal(cert.replay.inputFingerprint, fingerprintScheduleRequest(request));
  assert.equal(
    cert.replay.resultFingerprint,
    fingerprintBaselineScheduleCandidate({
      status: BASELINE_CANDIDATE_STATUS,
      constraintCertification: CONSTRAINT_CERTIFICATION.BASELINE_ONLY,
      plan: candidate.plan,
    })
  );
});

test("C2-13 no Date.now random salt or machine-local fingerprint values", () => {
  for (const file of listJsFiles(SE_ROOT)) {
    const text = readFileSync(file, "utf8");
    const code = text
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/(^|[^:])\/\/.*$/gm, "$1");
    assert.equal(/Date\.now\s*\(/.test(code), false, file);
    assert.equal(/Math\.random\s*\(/.test(code), false, file);
    assert.equal(/\brandomUUID\s*\(/.test(code), false, file);
    assert.equal(/\.localeCompare\s*\(/.test(code), false, file);
  }
});

test("C2-14 ASCII ordering only and no input mutation for fingerprints", () => {
  const request = baseRequest({
    matches: [match("m2"), match("m1", { participants: [p("z"), p("a")] })],
  });
  const before = JSON.stringify(request);
  fingerprintScheduleRequest(request);
  assert.equal(JSON.stringify(request), before);
  const candidate = buildBaselineScheduleCandidate(request);
  const beforeCand = JSON.stringify(candidate);
  fingerprintBaselineScheduleCandidate({
    status: BASELINE_CANDIDATE_STATUS,
    constraintCertification: CONSTRAINT_CERTIFICATION.BASELINE_ONLY,
    plan: candidate.plan,
  });
  assert.equal(JSON.stringify(candidate), beforeCand);
});
