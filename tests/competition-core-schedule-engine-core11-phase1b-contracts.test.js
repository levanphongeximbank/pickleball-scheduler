/**
 * CORE-11 Phase 1B — canonical contracts & validation (focused).
 */

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  SCHEDULE_ENGINE_IDENTITY,
  SCHEDULE_DIAGNOSTIC_CODE,
  SCHEDULE_DIAGNOSTIC_SEVERITY,
  OVERNIGHT_POLICY,
  FORBIDDEN_CANONICAL_ASSIGNMENT_FIELDS,
  createScheduleRequest,
  createScheduleMatchInput,
  createSchedulePlan,
  createScheduledMatch,
  createUnscheduledMatch,
  createScheduleReplayMetadata,
  createScheduleDiagnostic,
  validateScheduleRequest,
  validateSchedulePlan,
  scheduleResultValidator,
  fingerprintSchedulePlan,
  schedulePlansSemanticallyEqual,
  matchesScheduleOptimizerPort,
} from "../src/features/competition-core/schedule-engine/index.js";

const BYE_CODE = SCHEDULE_DIAGNOSTIC_CODE.BYE_NO_SCHEDULE_REQUIRED;

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SE_ROOT = path.join(ROOT, "src/features/competition-core/schedule-engine");

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

function basePolicy(overrides = {}) {
  return {
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
  };
}

function minimalRequest(overrides = {}) {
  return createScheduleRequest({
    competitionId: "comp-1",
    timezone: "Asia/Ho_Chi_Minh",
    matches: [
      createScheduleMatchInput({
        matchId: "m1",
        participants: [{ participantId: "p1" }, { participantId: "p2" }],
      }),
    ],
    policy: basePolicy(),
    operatingWindows: [
      { date: "2026-07-22", startMinutes: 480, endMinutes: 1200 },
    ],
    sessionWindows: [
      {
        sessionId: "session-am",
        date: "2026-07-22",
        startMinutes: 480,
        endMinutes: 720,
      },
    ],
    ...overrides,
  });
}

function minimalPlan(overrides = {}) {
  return createSchedulePlan({
    competitionId: "comp-1",
    timezone: "Asia/Ho_Chi_Minh",
    scheduled: [
      createScheduledMatch({
        matchId: "m1",
        start: { date: "2026-07-22", minutesFromMidnight: 480 },
        end: { date: "2026-07-22", minutesFromMidnight: 510 },
        sequence: 0,
        abstractSlotIndex: 0,
        sessionId: "session-am",
      }),
    ],
    unscheduled: [],
    diagnostics: [],
    replay: createScheduleReplayMetadata({
      engineId: SCHEDULE_ENGINE_IDENTITY.id,
      engineVersion: SCHEDULE_ENGINE_IDENTITY.version,
    }),
    ...overrides,
  });
}

function codesOf(result) {
  return result.diagnostics.map((d) => d.code);
}

test("01 valid minimal request", () => {
  const result = validateScheduleRequest(minimalRequest());
  assert.equal(result.ok, true);
  assert.ok(result.request);
  assert.equal(result.request.competitionId, "comp-1");
});

test("02 empty match list is valid", () => {
  const result = validateScheduleRequest(minimalRequest({ matches: [] }));
  assert.equal(result.ok, true);
  assert.deepEqual(result.request.matches, []);
});

test("03 missing competition ID", () => {
  const result = validateScheduleRequest(minimalRequest({ competitionId: "  " }));
  assert.equal(result.ok, false);
  assert.ok(codesOf(result).includes(SCHEDULE_DIAGNOSTIC_CODE.INVALID_IDENTIFIER));
});

test("04 missing timezone", () => {
  const raw = {
    ...minimalRequest(),
    timezone: "",
  };
  const result = validateScheduleRequest(raw);
  assert.equal(result.ok, false);
  assert.ok(codesOf(result).includes(SCHEDULE_DIAGNOSTIC_CODE.INVALID_TIMEZONE));
});

test("05 invalid timezone", () => {
  const result = validateScheduleRequest(
    minimalRequest({ timezone: "Not/A_Real_Zone" })
  );
  assert.equal(result.ok, false);
  assert.ok(codesOf(result).includes(SCHEDULE_DIAGNOSTIC_CODE.INVALID_TIMEZONE));
});

test("06 invalid date", () => {
  const result = validateScheduleRequest(
    minimalRequest({
      operatingWindows: [{ date: "2026-13-40", startMinutes: 0, endMinutes: 60 }],
      sessionWindows: [],
    })
  );
  assert.equal(result.ok, false);
  assert.ok(codesOf(result).includes(SCHEDULE_DIAGNOSTIC_CODE.INVALID_DATE));
});

test("07 invalid minutes", () => {
  const result = validateScheduleRequest(
    minimalRequest({
      operatingWindows: [
        { date: "2026-07-22", startMinutes: 1500, endMinutes: 1600 },
      ],
      sessionWindows: [],
    })
  );
  assert.equal(result.ok, false);
  assert.ok(codesOf(result).includes(SCHEDULE_DIAGNOSTIC_CODE.INVALID_TIME_WINDOW));
});

test("08 end equal to start", () => {
  const result = validateScheduleRequest(
    minimalRequest({
      operatingWindows: [
        { date: "2026-07-22", startMinutes: 600, endMinutes: 600 },
      ],
      sessionWindows: [],
    })
  );
  assert.equal(result.ok, false);
  assert.ok(codesOf(result).includes(SCHEDULE_DIAGNOSTIC_CODE.INVALID_TIME_WINDOW));
});

test("09 end before start (overnight wrap)", () => {
  const result = validateScheduleRequest(
    minimalRequest({
      operatingWindows: [
        { date: "2026-07-22", startMinutes: 1320, endMinutes: 120 },
      ],
      sessionWindows: [],
    })
  );
  assert.equal(result.ok, false);
  assert.ok(
    codesOf(result).includes(SCHEDULE_DIAGNOSTIC_CODE.OVERNIGHT_WINDOW_NOT_SUPPORTED)
  );
  assert.equal(OVERNIGHT_POLICY.PHASE_1, "REJECT");
});

test("10 overnight window rejection policy constant", () => {
  assert.equal(OVERNIGHT_POLICY.PHASE_1, "REJECT");
  const result = validateScheduleRequest(
    minimalRequest({
      operatingWindows: [
        { date: "2026-07-22", startMinutes: 1400, endMinutes: 30 },
      ],
      sessionWindows: [],
    })
  );
  assert.ok(
    codesOf(result).includes(SCHEDULE_DIAGNOSTIC_CODE.OVERNIGHT_WINDOW_NOT_SUPPORTED)
  );
});

test("11 overlapping windows", () => {
  const result = validateScheduleRequest(
    minimalRequest({
      operatingWindows: [
        { date: "2026-07-22", startMinutes: 480, endMinutes: 600 },
        { date: "2026-07-22", startMinutes: 540, endMinutes: 700 },
      ],
      sessionWindows: [],
    })
  );
  assert.equal(result.ok, false);
  assert.ok(
    codesOf(result).includes(SCHEDULE_DIAGNOSTIC_CODE.OVERLAPPING_TIME_WINDOW)
  );
});

test("12 duplicate session IDs", () => {
  const result = validateScheduleRequest(
    minimalRequest({
      sessionWindows: [
        {
          sessionId: "s1",
          date: "2026-07-22",
          startMinutes: 480,
          endMinutes: 600,
        },
        {
          sessionId: "s1",
          date: "2026-07-22",
          startMinutes: 620,
          endMinutes: 700,
        },
      ],
    })
  );
  assert.equal(result.ok, false);
  assert.ok(codesOf(result).includes(SCHEDULE_DIAGNOSTIC_CODE.DUPLICATE_SESSION_ID));
});

test("13 duplicate match IDs", () => {
  const result = validateScheduleRequest(
    minimalRequest({
      matches: [
        createScheduleMatchInput({ matchId: "m1" }),
        createScheduleMatchInput({ matchId: "m1" }),
      ],
    })
  );
  assert.equal(result.ok, false);
  assert.ok(codesOf(result).includes(SCHEDULE_DIAGNOSTIC_CODE.DUPLICATE_MATCH_ID));
});

test("14 invalid participant reference", () => {
  const result = validateScheduleRequest(
    minimalRequest({
      matches: [
        {
          matchId: "m1",
          participants: [{ participantId: "  " }],
        },
      ],
    })
  );
  assert.equal(result.ok, false);
  assert.ok(codesOf(result).includes(SCHEDULE_DIAGNOSTIC_CODE.INVALID_IDENTIFIER));
});

test("15 invalid dependency reference", () => {
  const result = validateScheduleRequest(
    minimalRequest({
      matches: [
        {
          matchId: "m2",
          dependencies: [{ sourceMatchId: "" }],
        },
      ],
    })
  );
  assert.equal(result.ok, false);
  assert.ok(codesOf(result).includes(SCHEDULE_DIAGNOSTIC_CODE.INVALID_IDENTIFIER));

  const unknown = validateScheduleRequest(
    minimalRequest({
      matches: [
        {
          matchId: "m2",
          dependencies: [{ sourceMatchId: "missing-match" }],
        },
      ],
    })
  );
  assert.ok(
    codesOf(unknown).includes(SCHEDULE_DIAGNOSTIC_CODE.UNKNOWN_MATCH_DEPENDENCY)
  );
});

test("16 invalid default duration", () => {
  const result = validateScheduleRequest(
    minimalRequest({
      policy: basePolicy({ duration: { defaultDurationMinutes: 0 } }),
    })
  );
  assert.equal(result.ok, false);
  assert.ok(
    codesOf(result).includes(SCHEDULE_DIAGNOSTIC_CODE.MATCH_DURATION_INVALID)
  );
});

test("17 invalid per-match duration", () => {
  const result = validateScheduleRequest(
    minimalRequest({
      matches: [
        createScheduleMatchInput({
          matchId: "m1",
          estimatedDurationMinutes: -5,
        }),
      ],
    })
  );
  assert.equal(result.ok, false);
  assert.ok(
    codesOf(result).includes(SCHEDULE_DIAGNOSTIC_CODE.MATCH_DURATION_INVALID)
  );
});

test("18 invalid buffer", () => {
  const result = validateScheduleRequest(
    minimalRequest({
      policy: basePolicy({ duration: { bufferMinutes: -1 } }),
    })
  );
  assert.equal(result.ok, false);
  assert.ok(
    codesOf(result).includes(SCHEDULE_DIAGNOSTIC_CODE.BUFFER_DURATION_INVALID)
  );
});

test("19 invalid rest values", () => {
  const result = validateScheduleRequest(
    minimalRequest({
      policy: basePolicy({
        rest: { minParticipantRestMinutes: -1, minTeamRestMinutes: 1.5 },
      }),
    })
  );
  assert.equal(result.ok, false);
  assert.ok(codesOf(result).includes(SCHEDULE_DIAGNOSTIC_CODE.REST_POLICY_INVALID));
});

test("20 missing capacity", () => {
  const raw = minimalRequest();
  delete raw.policy.capacity.maxConcurrentMatches;
  const result = validateScheduleRequest(raw);
  assert.equal(result.ok, false);
  assert.ok(
    codesOf(result).includes(SCHEDULE_DIAGNOSTIC_CODE.CAPACITY_POLICY_INVALID)
  );
});

test("21 zero capacity", () => {
  const result = validateScheduleRequest(
    minimalRequest({
      policy: basePolicy({ capacity: { maxConcurrentMatches: 0 } }),
    })
  );
  assert.equal(result.ok, false);
  assert.ok(
    codesOf(result).includes(SCHEDULE_DIAGNOSTIC_CODE.CAPACITY_POLICY_INVALID)
  );
});

test("22 non-integer capacity", () => {
  const result = validateScheduleRequest(
    minimalRequest({
      policy: basePolicy({ capacity: { maxConcurrentMatches: 1.5 } }),
    })
  );
  assert.equal(result.ok, false);
  assert.ok(
    codesOf(result).includes(SCHEDULE_DIAGNOSTIC_CODE.CAPACITY_POLICY_INVALID)
  );
});

test("23 physical court field rejection", () => {
  const result = validateScheduleRequest({
    ...minimalRequest(),
    matches: [{ matchId: "m1", courtId: "court-1" }],
  });
  assert.equal(result.ok, false);
  assert.ok(
    codesOf(result).includes(
      SCHEDULE_DIAGNOSTIC_CODE.COURT_ASSIGNMENT_BOUNDARY_VIOLATION
    )
  );
  assert.ok(FORBIDDEN_CANONICAL_ASSIGNMENT_FIELDS.has("courtId"));
});

test("24 referee field rejection", () => {
  const result = validateScheduleRequest({
    ...minimalRequest(),
    matches: [{ matchId: "m1", refereeId: "ref-1" }],
  });
  assert.equal(result.ok, false);
  assert.ok(
    codesOf(result).includes(
      SCHEDULE_DIAGNOSTIC_CODE.REFEREE_ASSIGNMENT_BOUNDARY_VIOLATION
    )
  );
});

test("25 valid minimal SchedulePlan", () => {
  const result = validateSchedulePlan(minimalPlan());
  assert.equal(result.ok, true);
  assert.ok(result.plan);
  assert.equal(result.plan.scheduled.length, 1);
});

test("26 duplicate scheduled match", () => {
  const result = validateSchedulePlan(
    minimalPlan({
      scheduled: [
        createScheduledMatch({
          matchId: "m1",
          start: { date: "2026-07-22", minutesFromMidnight: 480 },
          end: { date: "2026-07-22", minutesFromMidnight: 510 },
          sequence: 0,
        }),
        createScheduledMatch({
          matchId: "m1",
          start: { date: "2026-07-22", minutesFromMidnight: 520 },
          end: { date: "2026-07-22", minutesFromMidnight: 550 },
          sequence: 1,
        }),
      ],
    })
  );
  assert.equal(result.ok, false);
  assert.ok(codesOf(result).includes(SCHEDULE_DIAGNOSTIC_CODE.DUPLICATE_MATCH_ID));
});

test("27 duplicate unscheduled match", () => {
  const result = validateSchedulePlan(
    minimalPlan({
      scheduled: [],
      unscheduled: [
        createUnscheduledMatch({ matchId: "m9" }),
        createUnscheduledMatch({ matchId: "m9" }),
      ],
    })
  );
  assert.equal(result.ok, false);
  assert.ok(codesOf(result).includes(SCHEDULE_DIAGNOSTIC_CODE.DUPLICATE_MATCH_ID));
});

test("28 match both scheduled and unscheduled", () => {
  const result = validateSchedulePlan(
    minimalPlan({
      unscheduled: [createUnscheduledMatch({ matchId: "m1" })],
    })
  );
  assert.equal(result.ok, false);
  assert.ok(
    codesOf(result).includes(SCHEDULE_DIAGNOSTIC_CODE.INVALID_SCHEDULE_PLAN)
  );
});

test("29 invalid scheduled time", () => {
  const result = validateSchedulePlan(
    minimalPlan({
      scheduled: [
        createScheduledMatch({
          matchId: "m1",
          start: { date: "2026-07-22", minutesFromMidnight: 510 },
          end: { date: "2026-07-22", minutesFromMidnight: 480 },
          sequence: 0,
        }),
      ],
    })
  );
  assert.equal(result.ok, false);
  assert.ok(codesOf(result).includes(SCHEDULE_DIAGNOSTIC_CODE.INVALID_TIME_WINDOW));
});

test("30 invalid sequence", () => {
  const result = validateSchedulePlan(
    minimalPlan({
      scheduled: [
        createScheduledMatch({
          matchId: "m1",
          start: { date: "2026-07-22", minutesFromMidnight: 480 },
          end: { date: "2026-07-22", minutesFromMidnight: 510 },
          sequence: -1,
        }),
      ],
    })
  );
  assert.equal(result.ok, false);
  assert.ok(
    codesOf(result).includes(SCHEDULE_DIAGNOSTIC_CODE.INVALID_SCHEDULE_PLAN)
  );
});

test("31 invalid abstract slot", () => {
  const result = validateSchedulePlan(
    minimalPlan({
      scheduled: [
        createScheduledMatch({
          matchId: "m1",
          start: { date: "2026-07-22", minutesFromMidnight: 480 },
          end: { date: "2026-07-22", minutesFromMidnight: 510 },
          sequence: 0,
          abstractSlotIndex: 1.5,
        }),
      ],
    })
  );
  assert.equal(result.ok, false);
  assert.ok(
    codesOf(result).includes(SCHEDULE_DIAGNOSTIC_CODE.INVALID_SCHEDULE_PLAN)
  );
});

test("32 invalid replay metadata", () => {
  const result = validateSchedulePlan({
    competitionId: "comp-1",
    timezone: "Asia/Ho_Chi_Minh",
    scheduled: [],
    unscheduled: [],
    diagnostics: [],
    replay: { engineId: "", engineVersion: "" },
  });
  assert.equal(result.ok, false);
  assert.ok(codesOf(result).includes(SCHEDULE_DIAGNOSTIC_CODE.INVALID_IDENTIFIER));
});

test("33 invalid diagnostic structure", () => {
  const result = validateSchedulePlan({
    competitionId: "comp-1",
    timezone: "Asia/Ho_Chi_Minh",
    scheduled: [],
    unscheduled: [],
    diagnostics: [{ code: "NOT_A_REAL_CODE", severity: "ERROR", message: "x" }],
  });
  assert.equal(result.ok, false);
  assert.ok(
    codesOf(result).includes(SCHEDULE_DIAGNOSTIC_CODE.INVALID_SCHEDULE_PLAN)
  );
});

test("34 deterministic repeated validation", () => {
  const req = minimalRequest({
    matches: [
      createScheduleMatchInput({ matchId: "m2" }),
      createScheduleMatchInput({ matchId: "m1", isBye: true }),
    ],
  });
  const a = validateScheduleRequest(req);
  const b = validateScheduleRequest(req);
  assert.deepEqual(a.diagnostics, b.diagnostics);
  assert.deepEqual(a.request, b.request);

  const plan = minimalPlan({
    scheduled: [
      createScheduledMatch({
        matchId: "m2",
        start: { date: "2026-07-22", minutesFromMidnight: 600 },
        end: { date: "2026-07-22", minutesFromMidnight: 630 },
        sequence: 1,
      }),
      createScheduledMatch({
        matchId: "m1",
        start: { date: "2026-07-22", minutesFromMidnight: 480 },
        end: { date: "2026-07-22", minutesFromMidnight: 510 },
        sequence: 0,
      }),
    ],
  });
  const p1 = validateSchedulePlan(plan);
  const p2 = validateSchedulePlan(plan);
  assert.deepEqual(p1.diagnostics, p2.diagnostics);
  assert.deepEqual(p1.plan?.scheduled.map((m) => m.matchId), ["m1", "m2"]);
  assert.deepEqual(p2.plan?.scheduled.map((m) => m.matchId), ["m1", "m2"]);
});

test("35 input immutability", () => {
  const matches = [
    {
      matchId: "m1",
      participants: [{ participantId: "p1" }],
      dependencies: [],
    },
  ];
  const operatingWindows = [
    { date: "2026-07-22", startMinutes: 480, endMinutes: 1200 },
  ];
  const raw = {
    competitionId: "comp-1",
    timezone: "Asia/Ho_Chi_Minh",
    matches,
    policy: basePolicy(),
    operatingWindows,
    sessionWindows: [],
  };
  const before = JSON.stringify(raw);
  validateScheduleRequest(raw);
  assert.equal(JSON.stringify(raw), before);

  const planRaw = {
    competitionId: "comp-1",
    timezone: "Asia/Ho_Chi_Minh",
    scheduled: [
      {
        matchId: "m1",
        start: { date: "2026-07-22", minutesFromMidnight: 480 },
        end: { date: "2026-07-22", minutesFromMidnight: 510 },
        sequence: 0,
      },
    ],
    unscheduled: [],
    diagnostics: [],
  };
  const beforePlan = JSON.stringify(planRaw);
  validateSchedulePlan(planRaw);
  assert.equal(JSON.stringify(planRaw), beforePlan);
});

test("36 producedAt excluded from semantic equality / fingerprint", () => {
  const a = minimalPlan({ producedAt: "2026-01-01T00:00:00.000Z" });
  const b = minimalPlan({ producedAt: "2026-12-31T23:59:59.000Z" });
  assert.equal(schedulePlansSemanticallyEqual(a, b), true);
  assert.equal(fingerprintSchedulePlan(a), fingerprintSchedulePlan(b));
  assert.notEqual(a.producedAt, b.producedAt);
});

test("37 BYE_NO_SCHEDULE_REQUIRED code availability", () => {
  assert.equal(BYE_CODE, "BYE_NO_SCHEDULE_REQUIRED");
  const result = validateScheduleRequest(
    minimalRequest({
      matches: [createScheduleMatchInput({ matchId: "bye-1", isBye: true })],
    })
  );
  assert.ok(codesOf(result).includes(BYE_CODE));
  const info = result.diagnostics.find((d) => d.code === BYE_CODE);
  assert.equal(info.severity, SCHEDULE_DIAGNOSTIC_SEVERITY.INFO);
  assert.equal(result.ok, true);
});

test("38 CORE-10 optimizer port remains optional and unused", () => {
  assert.equal(matchesScheduleOptimizerPort(undefined), false);
  assert.equal(matchesScheduleOptimizerPort(null), false);
  const fake = {
    optimizeSchedule() {
      throw new Error("must not be called in Phase 1B");
    },
  };
  assert.equal(matchesScheduleOptimizerPort(fake), true);
  // validateScheduleRequest / validateSchedulePlan do not call optimizeSchedule
  validateScheduleRequest(minimalRequest());
  validateSchedulePlan(minimalPlan());
  assert.equal(typeof scheduleResultValidator.validateSchedulePlan, "function");
});

test("39 no direct persistence import", () => {
  const files = listJsFiles(SE_ROOT);
  assert.ok(files.length > 0);
  for (const file of files) {
    const text = readFileSync(file, "utf8");
    assert.equal(
      /from\s+['"][^'"]*supabase/i.test(text),
      false,
      `unexpected supabase import in ${file}`
    );
    assert.equal(
      /from\s+['"][^'"]*\/(persistence|repositories)\//i.test(text),
      false,
      `unexpected persistence import in ${file}`
    );
  }
});

test("40 no UI, court inventory or referee implementation import", () => {
  const files = listJsFiles(SE_ROOT);
  for (const file of files) {
    const text = readFileSync(file, "utf8");
    assert.equal(/from\s+['"]react['"]/i.test(text), false, file);
    assert.equal(/from\s+['"]@mui\//i.test(text), false, file);
    assert.equal(
      /from\s+['"][^'"]*venue-court/i.test(text),
      false,
      file
    );
    assert.equal(
      /from\s+['"][^'"]*scheduling\//i.test(text),
      false,
      `must not import CC-09 scheduling: ${file}`
    );
    const isAdapter = /schedule-engine[\\/]+adapters[\\/]/.test(file);
    if (!isAdapter) {
      assert.equal(
        /from\s+['"][^'"]*match-generation/i.test(text),
        false,
        file
      );
    } else if (/match-generation/i.test(text)) {
      assert.match(
        text,
        /from\s+['"][^'"]*match-generation\/index\.js['"]/,
        `adapter must import CORE-09 public barrel only: ${file}`
      );
      assert.equal(
        /from\s+['"][^'"]*match-generation\/(?!index\.js)/.test(text),
        false,
        `adapter must not import CORE-09 private paths: ${file}`
      );
    }
  }
});

test("engine identity constants", () => {
  assert.equal(SCHEDULE_ENGINE_IDENTITY.id, "CORE11_SCHEDULE_ENGINE");
  assert.equal(SCHEDULE_ENGINE_IDENTITY.version, "core11-v1");
});

test("createScheduleDiagnostic factory", () => {
  const d = createScheduleDiagnostic({
    code: SCHEDULE_DIAGNOSTIC_CODE.INVALID_IDENTIFIER,
    path: "competitionId",
    message: "bad id",
    relatedMatchIds: ["m2", "m1", "m1"],
  });
  assert.deepEqual(d.relatedMatchIds, ["m1", "m2"]);
});
