/**
 * CORE-11 Phase 1C — canonical time & window model (focused).
 */

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  SCHEDULE_DIAGNOSTIC_CODE,
  OVERNIGHT_POLICY,
  normalizeOperatingWindows,
  normalizeSessionWindows,
  validateSessionContainment,
  convertCivilScheduleTimeToAbsolute,
  convertSchedulingWindowToAbsoluteRange,
  validateScheduleRequest,
  createScheduleRequest,
  createScheduleMatchInput,
  civilWindowsOverlap,
  isCivilWindowContained,
} from "../src/features/competition-core/schedule-engine/index.js";

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

function basePolicy() {
  return {
    duration: { defaultDurationMinutes: 30, bufferMinutes: 5 },
    rest: { minParticipantRestMinutes: 15, minTeamRestMinutes: 0 },
    capacity: { maxConcurrentMatches: 2 },
  };
}

function codesOf(result) {
  return (result.diagnostics || []).map((d) => d.code);
}

const TZ_HCM = "Asia/Ho_Chi_Minh";
const TZ_NY = "America/New_York";

test("01 valid single operating window", () => {
  const result = normalizeOperatingWindows(
    [{ date: "2026-08-01", startMinutes: 480, endMinutes: 1080 }],
    { timezone: TZ_HCM }
  );
  assert.equal(result.ok, true);
  assert.equal(result.windows.length, 1);
  assert.equal(result.windows[0].date, "2026-08-01");
  assert.equal(result.windows[0].startMinutes, 480);
  assert.equal(result.windows[0].endMinutes, 1080);
  assert.equal(result.windows[0].timezone, TZ_HCM);
  assert.equal(result.windows[0].sequence, 0);
  assert.ok(result.windows[0].windowId);
});

test("02 multiple windows on one day", () => {
  const result = normalizeOperatingWindows(
    [
      { date: "2026-08-01", startMinutes: 780, endMinutes: 1080 },
      { date: "2026-08-01", startMinutes: 480, endMinutes: 720 },
    ],
    { timezone: TZ_HCM }
  );
  assert.equal(result.ok, true);
  assert.equal(result.windows.length, 2);
  assert.equal(result.windows[0].startMinutes, 480);
  assert.equal(result.windows[1].startMinutes, 780);
  assert.equal(result.windows[0].sequence, 0);
  assert.equal(result.windows[1].sequence, 1);
});

test("03 multiple-day windows", () => {
  const result = normalizeOperatingWindows(
    [
      {
        date: "2026-08-02",
        startMinutes: 480,
        endMinutes: 1080,
        timezone: TZ_HCM,
      },
      {
        date: "2026-08-01",
        startMinutes: 480,
        endMinutes: 1080,
        timezone: TZ_HCM,
      },
    ],
    { timezone: TZ_HCM }
  );
  assert.equal(result.ok, true);
  assert.deepEqual(
    result.windows.map((w) => w.date),
    ["2026-08-01", "2026-08-02"]
  );
});

test("04 input-order-independent normalization", () => {
  const a = normalizeOperatingWindows(
    [
      { date: "2026-08-01", startMinutes: 800, endMinutes: 900 },
      { date: "2026-08-01", startMinutes: 480, endMinutes: 600 },
    ],
    { timezone: TZ_HCM }
  );
  const b = normalizeOperatingWindows(
    [
      { date: "2026-08-01", startMinutes: 480, endMinutes: 600 },
      { date: "2026-08-01", startMinutes: 800, endMinutes: 900 },
    ],
    { timezone: TZ_HCM }
  );
  assert.equal(a.ok, true);
  assert.deepEqual(a.windows, b.windows);
});

test("05 deterministic repeated normalization", () => {
  const input = [
    { date: "2026-08-01", startMinutes: 480, endMinutes: 720, label: " AM " },
  ];
  const a = normalizeOperatingWindows(input, { timezone: TZ_HCM });
  const b = normalizeOperatingWindows(input, { timezone: TZ_HCM });
  assert.deepEqual(a, b);
});

test("06 start boundary inclusive (half-open semantics)", () => {
  const outer = { date: "2026-08-01", startMinutes: 480, endMinutes: 600 };
  const atStart = { date: "2026-08-01", startMinutes: 480, endMinutes: 500 };
  assert.equal(isCivilWindowContained(atStart, outer), true);
});

test("07 end boundary exclusive (half-open semantics)", () => {
  const a = { startMinutes: 480, endMinutes: 600 };
  const b = { startMinutes: 600, endMinutes: 720 };
  assert.equal(civilWindowsOverlap(a, b), false);
  const touching = normalizeOperatingWindows(
    [
      { date: "2026-08-01", startMinutes: 480, endMinutes: 600 },
      { date: "2026-08-01", startMinutes: 600, endMinutes: 720 },
    ],
    { timezone: TZ_HCM }
  );
  assert.equal(touching.ok, true);
});

test("08 gap between operating windows allowed", () => {
  const result = normalizeOperatingWindows(
    [
      { date: "2026-08-01", startMinutes: 480, endMinutes: 600 },
      { date: "2026-08-01", startMinutes: 660, endMinutes: 780 },
    ],
    { timezone: TZ_HCM }
  );
  assert.equal(result.ok, true);
  assert.equal(result.windows.length, 2);
});

test("09 overlapping operating windows rejected", () => {
  const result = normalizeOperatingWindows(
    [
      { date: "2026-08-01", startMinutes: 480, endMinutes: 600 },
      { date: "2026-08-01", startMinutes: 540, endMinutes: 700 },
    ],
    { timezone: TZ_HCM }
  );
  assert.equal(result.ok, false);
  assert.ok(codesOf(result).includes(SCHEDULE_DIAGNOSTIC_CODE.OVERLAPPING_TIME_WINDOW));
});

test("10 duplicate operating windows rejected", () => {
  const result = normalizeOperatingWindows(
    [
      { date: "2026-08-01", startMinutes: 480, endMinutes: 600 },
      { date: "2026-08-01", startMinutes: 480, endMinutes: 600 },
    ],
    { timezone: TZ_HCM }
  );
  assert.equal(result.ok, false);
  assert.ok(
    codesOf(result).includes(SCHEDULE_DIAGNOSTIC_CODE.DUPLICATE_OPERATING_WINDOW)
  );
});

test("11 invalid civil date", () => {
  const result = normalizeOperatingWindows(
    [{ date: "2026-02-30", startMinutes: 0, endMinutes: 60 }],
    { timezone: TZ_HCM }
  );
  assert.equal(result.ok, false);
  assert.ok(codesOf(result).includes(SCHEDULE_DIAGNOSTIC_CODE.INVALID_DATE));
});

test("12 invalid timezone", () => {
  const result = normalizeOperatingWindows(
    [{ date: "2026-08-01", startMinutes: 480, endMinutes: 600 }],
    { timezone: "Not/A_Zone" }
  );
  assert.equal(result.ok, false);
  assert.ok(codesOf(result).includes(SCHEDULE_DIAGNOSTIC_CODE.INVALID_TIMEZONE));
});

test("13 window timezone mismatch", () => {
  const result = normalizeOperatingWindows(
    [
      {
        date: "2026-08-01",
        startMinutes: 480,
        endMinutes: 600,
        timezone: TZ_NY,
      },
    ],
    { timezone: TZ_HCM }
  );
  assert.equal(result.ok, false);
  assert.ok(codesOf(result).includes(SCHEDULE_DIAGNOSTIC_CODE.TIMEZONE_MISMATCH));
});

test("14 invalid start minutes", () => {
  const result = normalizeOperatingWindows(
    [{ date: "2026-08-01", startMinutes: -1, endMinutes: 60 }],
    { timezone: TZ_HCM }
  );
  assert.equal(result.ok, false);
  assert.ok(codesOf(result).includes(SCHEDULE_DIAGNOSTIC_CODE.INVALID_TIME_WINDOW));
});

test("15 invalid end minutes", () => {
  const result = normalizeOperatingWindows(
    [{ date: "2026-08-01", startMinutes: 0, endMinutes: 1440 }],
    { timezone: TZ_HCM }
  );
  assert.equal(result.ok, false);
  assert.ok(codesOf(result).includes(SCHEDULE_DIAGNOSTIC_CODE.INVALID_TIME_WINDOW));
});

test("16 end equal to start", () => {
  const result = normalizeOperatingWindows(
    [{ date: "2026-08-01", startMinutes: 600, endMinutes: 600 }],
    { timezone: TZ_HCM }
  );
  assert.equal(result.ok, false);
  assert.ok(codesOf(result).includes(SCHEDULE_DIAGNOSTIC_CODE.INVALID_TIME_WINDOW));
});

test("17 end before start", () => {
  const result = normalizeOperatingWindows(
    [{ date: "2026-08-01", startMinutes: 700, endMinutes: 600 }],
    { timezone: TZ_HCM }
  );
  assert.equal(result.ok, false);
  assert.ok(
    codesOf(result).includes(SCHEDULE_DIAGNOSTIC_CODE.OVERNIGHT_WINDOW_NOT_SUPPORTED)
  );
});

test("18 overnight rejection", () => {
  assert.equal(OVERNIGHT_POLICY.PHASE_1, "REJECT");
  const result = normalizeOperatingWindows(
    [{ date: "2026-08-01", startMinutes: 1320, endMinutes: 120 }],
    { timezone: TZ_HCM }
  );
  assert.equal(result.ok, false);
  assert.ok(
    codesOf(result).includes(SCHEDULE_DIAGNOSTIC_CODE.OVERNIGHT_WINDOW_NOT_SUPPORTED)
  );
});

test("19 valid session inside operating window", () => {
  const operating = normalizeOperatingWindows(
    [{ date: "2026-08-01", startMinutes: 480, endMinutes: 1080 }],
    { timezone: TZ_HCM }
  ).windows;
  const result = normalizeSessionWindows(
    [
      {
        sessionId: "s-am",
        date: "2026-08-01",
        startMinutes: 480,
        endMinutes: 720,
      },
    ],
    operating,
    { timezone: TZ_HCM }
  );
  assert.equal(result.ok, true);
  assert.equal(result.windows.length, 1);
  assert.equal(result.windows[0].sessionId, "s-am");
  assert.equal(result.windows[0].timezone, TZ_HCM);
});

test("20 multiple ordered sessions", () => {
  const operating = normalizeOperatingWindows(
    [{ date: "2026-08-01", startMinutes: 480, endMinutes: 1080 }],
    { timezone: TZ_HCM }
  ).windows;
  const result = normalizeSessionWindows(
    [
      {
        sessionId: "s-pm",
        date: "2026-08-01",
        startMinutes: 780,
        endMinutes: 960,
      },
      {
        sessionId: "s-am",
        date: "2026-08-01",
        startMinutes: 480,
        endMinutes: 720,
      },
    ],
    operating,
    { timezone: TZ_HCM }
  );
  assert.equal(result.ok, true);
  assert.deepEqual(
    result.windows.map((s) => s.sessionId),
    ["s-am", "s-pm"]
  );
  assert.equal(result.windows[0].sequence, 0);
  assert.equal(result.windows[1].sequence, 1);
});

test("21 session gaps allowed", () => {
  const operating = normalizeOperatingWindows(
    [{ date: "2026-08-01", startMinutes: 480, endMinutes: 1080 }],
    { timezone: TZ_HCM }
  ).windows;
  const result = normalizeSessionWindows(
    [
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
    operating,
    { timezone: TZ_HCM }
  );
  assert.equal(result.ok, true);
});

test("22 duplicate session ID", () => {
  const operating = normalizeOperatingWindows(
    [{ date: "2026-08-01", startMinutes: 480, endMinutes: 1080 }],
    { timezone: TZ_HCM }
  ).windows;
  const result = normalizeSessionWindows(
    [
      {
        sessionId: "s1",
        date: "2026-08-01",
        startMinutes: 480,
        endMinutes: 540,
      },
      {
        sessionId: "s1",
        date: "2026-08-01",
        startMinutes: 600,
        endMinutes: 660,
      },
    ],
    operating,
    { timezone: TZ_HCM }
  );
  assert.equal(result.ok, false);
  assert.ok(codesOf(result).includes(SCHEDULE_DIAGNOSTIC_CODE.DUPLICATE_SESSION_ID));
});

test("23 duplicate equivalent session window", () => {
  const operating = normalizeOperatingWindows(
    [{ date: "2026-08-01", startMinutes: 480, endMinutes: 1080 }],
    { timezone: TZ_HCM }
  ).windows;
  const result = normalizeSessionWindows(
    [
      {
        sessionId: "s1",
        date: "2026-08-01",
        startMinutes: 480,
        endMinutes: 540,
      },
      {
        sessionId: "s2",
        date: "2026-08-01",
        startMinutes: 480,
        endMinutes: 540,
      },
    ],
    operating,
    { timezone: TZ_HCM }
  );
  assert.equal(result.ok, false);
  assert.ok(
    codesOf(result).includes(SCHEDULE_DIAGNOSTIC_CODE.DUPLICATE_SESSION_WINDOW)
  );
});

test("24 overlapping sessions", () => {
  const operating = normalizeOperatingWindows(
    [{ date: "2026-08-01", startMinutes: 480, endMinutes: 1080 }],
    { timezone: TZ_HCM }
  ).windows;
  const result = normalizeSessionWindows(
    [
      {
        sessionId: "s1",
        date: "2026-08-01",
        startMinutes: 480,
        endMinutes: 600,
      },
      {
        sessionId: "s2",
        date: "2026-08-01",
        startMinutes: 540,
        endMinutes: 660,
      },
    ],
    operating,
    { timezone: TZ_HCM }
  );
  assert.equal(result.ok, false);
  assert.ok(codesOf(result).includes(SCHEDULE_DIAGNOSTIC_CODE.OVERLAPPING_TIME_WINDOW));
});

test("25 session partially outside operating window", () => {
  const operating = normalizeOperatingWindows(
    [{ date: "2026-08-01", startMinutes: 480, endMinutes: 720 }],
    { timezone: TZ_HCM }
  ).windows;
  const result = normalizeSessionWindows(
    [
      {
        sessionId: "s1",
        date: "2026-08-01",
        startMinutes: 600,
        endMinutes: 800,
      },
    ],
    operating,
    { timezone: TZ_HCM }
  );
  assert.equal(result.ok, false);
  assert.ok(
    codesOf(result).includes(SCHEDULE_DIAGNOSTIC_CODE.SESSION_OUTSIDE_OPERATING_WINDOW)
  );
});

test("26 session entirely outside operating window", () => {
  const operating = normalizeOperatingWindows(
    [{ date: "2026-08-01", startMinutes: 480, endMinutes: 600 }],
    { timezone: TZ_HCM }
  ).windows;
  const result = normalizeSessionWindows(
    [
      {
        sessionId: "s1",
        date: "2026-08-01",
        startMinutes: 700,
        endMinutes: 800,
      },
    ],
    operating,
    { timezone: TZ_HCM }
  );
  assert.equal(result.ok, false);
  assert.ok(
    codesOf(result).includes(SCHEDULE_DIAGNOSTIC_CODE.SESSION_OUTSIDE_OPERATING_WINDOW)
  );
});

test("27 session on date without operating window", () => {
  const operating = normalizeOperatingWindows(
    [{ date: "2026-08-01", startMinutes: 480, endMinutes: 1080 }],
    { timezone: TZ_HCM }
  ).windows;
  const result = normalizeSessionWindows(
    [
      {
        sessionId: "s1",
        date: "2026-08-02",
        startMinutes: 480,
        endMinutes: 600,
      },
    ],
    operating,
    { timezone: TZ_HCM }
  );
  assert.equal(result.ok, false);
  assert.ok(
    codesOf(result).includes(SCHEDULE_DIAGNOSTIC_CODE.SESSION_OUTSIDE_OPERATING_WINDOW)
  );
});

test("28 session crossing two adjacent operating windows", () => {
  const operating = normalizeOperatingWindows(
    [
      { date: "2026-08-01", startMinutes: 480, endMinutes: 600 },
      { date: "2026-08-01", startMinutes: 600, endMinutes: 720 },
    ],
    { timezone: TZ_HCM }
  ).windows;
  const result = normalizeSessionWindows(
    [
      {
        sessionId: "s-cross",
        date: "2026-08-01",
        startMinutes: 540,
        endMinutes: 660,
      },
    ],
    operating,
    { timezone: TZ_HCM }
  );
  assert.equal(result.ok, false);
  assert.ok(
    codesOf(result).includes(
      SCHEDULE_DIAGNOSTIC_CODE.SESSION_SPANS_INCOMPATIBLE_WINDOWS
    )
  );
  const containment = validateSessionContainment(
    { date: "2026-08-01", startMinutes: 540, endMinutes: 660 },
    operating
  );
  assert.equal(containment.ok, false);
  assert.equal(
    containment.code,
    SCHEDULE_DIAGNOSTIC_CODE.SESSION_SPANS_INCOMPATIBLE_WINDOWS
  );
});

test("29 empty session list behavior", () => {
  const operating = normalizeOperatingWindows(
    [{ date: "2026-08-01", startMinutes: 480, endMinutes: 1080 }],
    { timezone: TZ_HCM }
  ).windows;
  const result = normalizeSessionWindows([], operating, { timezone: TZ_HCM });
  assert.equal(result.ok, true);
  assert.deepEqual(result.windows, []);

  const viaRequest = validateScheduleRequest(
    createScheduleRequest({
      competitionId: "comp-1",
      timezone: TZ_HCM,
      matches: [createScheduleMatchInput({ matchId: "m1" })],
      policy: basePolicy(),
      operatingWindows: [
        { date: "2026-08-01", startMinutes: 480, endMinutes: 1080 },
      ],
      sessionWindows: [],
    })
  );
  assert.equal(viaRequest.ok, true);
  assert.deepEqual(viaRequest.request.sessionWindows, []);
  assert.equal(viaRequest.request.operatingWindows.length, 1);
});

test("30 civil time to UTC milliseconds using civilTime.js", () => {
  const result = convertCivilScheduleTimeToAbsolute({
    date: "2026-07-22",
    minutesFromMidnight: 480,
    timezone: TZ_HCM,
  });
  assert.equal(result.ok, true);
  assert.equal(result.utcMs, 1784682000000);
});

test("31 civil time to UTC ISO using civilTime.js", () => {
  const result = convertCivilScheduleTimeToAbsolute({
    date: "2026-07-22",
    minutesFromMidnight: 480,
    timezone: TZ_HCM,
  });
  assert.equal(result.ok, true);
  assert.equal(result.utcIso, "2026-07-22T01:00:00.000Z");
});

test("32 correct conversion for Asia/Ho_Chi_Minh", () => {
  const result = convertCivilScheduleTimeToAbsolute(
    { date: "2026-08-01", minutesFromMidnight: 0 },
    TZ_HCM
  );
  assert.equal(result.ok, true);
  assert.equal(result.utcIso, "2026-07-31T17:00:00.000Z");
});

test("33 correct conversion for DST-observing IANA timezone", () => {
  const result = convertCivilScheduleTimeToAbsolute({
    date: "2026-07-22",
    minutesFromMidnight: 480,
    timezone: TZ_NY,
  });
  assert.equal(result.ok, true);
  assert.equal(result.utcMs, 1784721600000);
  assert.equal(result.utcIso, "2026-07-22T12:00:00.000Z");
});

test("34 nonexistent DST civil time fails closed", () => {
  // America/New_York spring-forward gap 2026-03-08 02:00 — SSOT rejects.
  const result = convertCivilScheduleTimeToAbsolute({
    date: "2026-03-08",
    minutesFromMidnight: 120,
    timezone: TZ_NY,
  });
  assert.equal(result.ok, false);
  assert.ok(codesOf(result).includes(SCHEDULE_DIAGNOSTIC_CODE.AMBIGUOUS_CIVIL_TIME));
  assert.equal(
    result.diagnostics[0].details.civilTimeErrorCode,
    "AMBIGUOUS_LOCAL_TIME"
  );
});

test("35 fall-back ambiguous civil time inherits civilTime.js instant", () => {
  // America/New_York fall-back 2025-11-02 01:30 is ambiguous in civil terms,
  // but civilTime.js currently returns one absolute instant. CORE-11 must use
  // that instant and must NOT independently reject fall-back ambiguity.
  const result = convertCivilScheduleTimeToAbsolute({
    date: "2025-11-02",
    minutesFromMidnight: 90,
    timezone: TZ_NY,
  });
  assert.equal(result.ok, true);
  assert.equal(typeof result.utcMs, "number");
  assert.equal(result.utcIso, new Date(result.utcMs).toISOString());
  assert.equal(
    codesOf(result).includes(SCHEDULE_DIAGNOSTIC_CODE.AMBIGUOUS_CIVIL_TIME),
    false
  );

  // Contrast: spring-forward gap is rejected by the SSOT and mapped.
  const gap = convertCivilScheduleTimeToAbsolute({
    date: "2026-03-08",
    minutesFromMidnight: 150,
    timezone: TZ_NY,
  });
  assert.equal(gap.ok, false);
  assert.ok(codesOf(gap).includes(SCHEDULE_DIAGNOSTIC_CODE.AMBIGUOUS_CIVIL_TIME));
  assert.equal(gap.diagnostics[0].details.civilTimeErrorCode, "AMBIGUOUS_LOCAL_TIME");
});

test("36 multi-day absolute ranges retain correct civil dates", () => {
  const day1 = convertSchedulingWindowToAbsoluteRange(
    {
      date: "2026-08-01",
      startMinutes: 480,
      endMinutes: 1080,
      timezone: TZ_HCM,
    },
    TZ_HCM
  );
  const day2 = convertSchedulingWindowToAbsoluteRange(
    {
      date: "2026-08-02",
      startMinutes: 480,
      endMinutes: 1080,
      timezone: TZ_HCM,
    },
    TZ_HCM
  );
  assert.equal(day1.ok, true);
  assert.equal(day2.ok, true);
  assert.equal(day1.start.utcIso, "2026-08-01T01:00:00.000Z");
  assert.equal(day2.start.utcIso, "2026-08-02T01:00:00.000Z");
  assert.ok(day2.start.utcMs > day1.start.utcMs);
  assert.equal(day1.end.utcMs - day1.start.utcMs, (1080 - 480) * 60_000);
});

test("37 input immutability", () => {
  const operating = [
    { date: "2026-08-01", startMinutes: 480, endMinutes: 1080 },
  ];
  const sessions = [
    {
      sessionId: "s1",
      date: "2026-08-01",
      startMinutes: 480,
      endMinutes: 600,
    },
  ];
  const beforeOw = JSON.stringify(operating);
  const beforeSw = JSON.stringify(sessions);
  const ow = normalizeOperatingWindows(operating, { timezone: TZ_HCM });
  normalizeSessionWindows(sessions, ow.windows, { timezone: TZ_HCM });
  convertCivilScheduleTimeToAbsolute({
    date: "2026-08-01",
    minutesFromMidnight: 480,
    timezone: TZ_HCM,
  });
  assert.equal(JSON.stringify(operating), beforeOw);
  assert.equal(JSON.stringify(sessions), beforeSw);
});

test("38 no host-local timezone dependence", () => {
  const a = convertCivilScheduleTimeToAbsolute({
    date: "2026-08-01",
    minutesFromMidnight: 480,
    timezone: TZ_HCM,
  });
  const b = convertCivilScheduleTimeToAbsolute({
    date: "2026-08-01",
    minutesFromMidnight: 480,
    timezone: TZ_HCM,
  });
  assert.deepEqual(a, b);
  // Missing timezone must fail — never fall back to host local.
  const missing = convertCivilScheduleTimeToAbsolute({
    date: "2026-08-01",
    minutesFromMidnight: 480,
  });
  assert.equal(missing.ok, false);
  assert.ok(codesOf(missing).includes(SCHEDULE_DIAGNOSTIC_CODE.INVALID_TIMEZONE));
});

test("39 no Date.now, Math.random or localeCompare in CORE-11 module", () => {
  const files = listJsFiles(SE_ROOT);
  assert.ok(files.length > 0);
  for (const file of files) {
    const text = readFileSync(file, "utf8");
    // Strip comments so documentation mentions do not count as usage.
    const code = text
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/(^|[^:])\/\/.*$/gm, "$1");
    assert.equal(/Date\.now\s*\(/.test(code), false, file);
    assert.equal(/Math\.random\s*\(/.test(code), false, file);
    assert.equal(/\.localeCompare\s*\(/.test(code), false, file);
  }
});

test("40 no React, Supabase, court, referee or persistence import", () => {
  const files = listJsFiles(SE_ROOT);
  for (const file of files) {
    const text = readFileSync(file, "utf8");
    assert.equal(/from\s+['"]react['"]/i.test(text), false, file);
    assert.equal(/from\s+['"]@mui\//i.test(text), false, file);
    assert.equal(/from\s+['"][^'"]*supabase/i.test(text), false, file);
    assert.equal(
      /from\s+['"][^'"]*\/(persistence|repositories)\//i.test(text),
      false,
      file
    );
    assert.equal(/from\s+['"][^'"]*venue-court/i.test(text), false, file);
    assert.equal(/from\s+['"][^'"]*court-engine/i.test(text), false, file);
    assert.equal(/from\s+['"][^'"]*scheduling\//i.test(text), false, file);
    assert.equal(/from\s+['"][^'"]*match-generation/i.test(text), false, file);
  }
});

test("41 request validator integrates Phase 1C normalization", () => {
  const result = validateScheduleRequest(
    createScheduleRequest({
      competitionId: "comp-1",
      timezone: TZ_HCM,
      matches: [createScheduleMatchInput({ matchId: "m1" })],
      policy: basePolicy(),
      operatingWindows: [
        { date: "2026-08-02", startMinutes: 480, endMinutes: 720 },
        { date: "2026-08-01", startMinutes: 480, endMinutes: 720 },
      ],
      sessionWindows: [
        {
          sessionId: "s-pm",
          date: "2026-08-01",
          startMinutes: 600,
          endMinutes: 700,
        },
        {
          sessionId: "s-am",
          date: "2026-08-01",
          startMinutes: 480,
          endMinutes: 560,
        },
      ],
    })
  );
  assert.equal(result.ok, true);
  assert.deepEqual(
    result.request.operatingWindows.map((w) => w.date),
    ["2026-08-01", "2026-08-02"]
  );
  assert.deepEqual(
    result.request.sessionWindows.map((s) => s.sessionId),
    ["s-am", "s-pm"]
  );
  assert.equal(result.request.operatingWindows[0].timezone, TZ_HCM);
});

test("42 no scheduler, graph or slot-generation export", () => {
  const indexText = readFileSync(path.join(SE_ROOT, "index.js"), "utf8");
  assert.equal(/export\s+.*\bscheduleMatches\b/.test(indexText), false);
  assert.equal(/export\s+.*\bgenerateSlots\b/.test(indexText), false);
  assert.equal(/export\s+.*\bbuildDependencyGraph\b/.test(indexText), false);
  assert.equal(/export\s+.*\btopologicalSort\b/.test(indexText), false);
  assert.equal(/export\s+.*\boptimizeSchedule\b/.test(indexText), false);
  for (const file of listJsFiles(SE_ROOT)) {
    const text = readFileSync(file, "utf8");
    assert.equal(
      /function\s+(scheduleMatches|generateSlots|buildDependencyGraph|detectCycles)\b/.test(
        text
      ),
      false,
      file
    );
  }
});
