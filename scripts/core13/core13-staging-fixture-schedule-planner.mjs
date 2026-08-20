/**
 * CORE-13 fixture schedule planner — test orchestration only.
 *
 * Not product runtime. Not a schedule authority. Canonical CORE-13 remains
 * assignment/capacity authority. This planner only chooses mutually
 * non-overlapping windows for positive fixture cases so the harness does
 * not collide with the (correct) capacity guard.
 *
 * FIXED_SHARED_08_00_09_00_WINDOW_FOR_POSITIVE_CASES=DENY
 */

export const FIXTURE_SCHEDULE_PLANNER_ID = "core13-staging-fixture-schedule-planner-v1";

export const POSITIVE_FIXTURE_SCHEDULE_CASES = Object.freeze([
  "preMatch",
  "inProgress",
  "scoringActive",
  "locked",
  "completed",
  "nonOverlap",
  "overlapA",
]);

export const NEGATIVE_OVERLAP_SOURCE_CASE = "overlapA";
export const NEGATIVE_OVERLAP_FIXTURE_CASE = "overlapB";

/** Far-future deterministic horizon. Not 08:00–09:00. */
export const FIXTURE_BASE_HORIZON_ISO = "2099-06-15T12:00:00.000Z";
export const FIXTURE_CANONICAL_SLOT_MS = 60 * 60 * 1000;
export const FIXTURE_MAX_SLOT_SCAN = 24 * 14;

function proof(ok, detail, extra = {}) {
  return Object.freeze({ ok: ok === true, detail: String(detail || ""), ...extra });
}

function toIso(ms) {
  return new Date(ms).toISOString();
}

export function normalizeScheduleWindow(input) {
  if (!input || typeof input !== "object") return null;
  const startRaw =
    input.startAt ||
    input.startsAt ||
    input.scheduledStart ||
    input.scheduledAt ||
    input.start ||
    input.windowStart ||
    null;
  const endRaw =
    input.endAt ||
    input.endsAt ||
    input.scheduledEnd ||
    input.end ||
    input.windowEnd ||
    null;
  const startMs = Date.parse(String(startRaw || ""));
  let endMs = Date.parse(String(endRaw || ""));
  if (!Number.isFinite(endMs) && Number.isFinite(startMs)) {
    const minutes = Number(input.durationMinutes || input.matchDurationMinutes || 0);
    if (Number.isFinite(minutes) && minutes > 0) {
      endMs = startMs + minutes * 60 * 1000;
    }
  }
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) {
    return null;
  }
  return Object.freeze({
    startAt: toIso(startMs),
    endAt: toIso(endMs),
    startMs,
    endMs,
  });
}

export function windowsOverlapHalfOpen(a, b) {
  const left = normalizeScheduleWindow(a);
  const right = normalizeScheduleWindow(b);
  if (!left || !right) return false;
  return left.startMs < right.endMs && right.startMs < left.endMs;
}

export function collectAuthoritativeBlockingWindows(rows = []) {
  const out = [];
  for (const row of Array.isArray(rows) ? rows : []) {
    const window = normalizeScheduleWindow(row) || normalizeScheduleWindow(row?.scheduleWindow);
    if (!window) continue;
    out.push(
      Object.freeze({
        ...window,
        source: row.source || "AUTHORITATIVE_ACTIVE_ASSIGNMENT",
        assignmentId: row.assignmentId || row.id || null,
        matchId: row.matchId || row.match_id || null,
        refereeId: row.refereeId || row.referee_user_id || null,
        tournamentId: row.tournamentId || row.tournament_id || null,
      })
    );
  }
  out.sort((a, b) => a.startMs - b.startMs || String(a.matchId || "").localeCompare(String(b.matchId || "")));
  return Object.freeze(out);
}

export function selectNextFreeCanonicalWindow({
  blockingWindows = [],
  reservedWindows = [],
  horizonStartIso = FIXTURE_BASE_HORIZON_ISO,
  slotMs = FIXTURE_CANONICAL_SLOT_MS,
  maxScan = FIXTURE_MAX_SLOT_SCAN,
} = {}) {
  const horizonMs = Date.parse(String(horizonStartIso || ""));
  if (!Number.isFinite(horizonMs) || slotMs <= 0) {
    return proof(false, "invalid fixture schedule horizon");
  }
  const occupied = [
    ...collectAuthoritativeBlockingWindows(blockingWindows),
    ...collectAuthoritativeBlockingWindows(reservedWindows),
  ];
  for (let index = 0; index < maxScan; index += 1) {
    const startMs = horizonMs + index * slotMs;
    const candidate = {
      startAt: toIso(startMs),
      endAt: toIso(startMs + slotMs),
      startMs,
      endMs: startMs + slotMs,
    };
    const hit = occupied.find((row) => windowsOverlapHalfOpen(candidate, row));
    if (!hit) {
      return proof(true, "free-window", {
        window: Object.freeze(candidate),
        slotIndex: index,
      });
    }
  }
  return proof(false, "no free canonical fixture window in scan horizon");
}

export function resolveWriterScheduleWindow(input = {}) {
  return (
    normalizeScheduleWindow(input?.scheduleWindow) ||
    normalizeScheduleWindow(input) ||
    null
  );
}

export function toMatchScheduleFields(window) {
  const normalized = normalizeScheduleWindow(window);
  if (!normalized) return null;
  const durationMinutes = Math.round((normalized.endMs - normalized.startMs) / 60000);
  return Object.freeze({
    scheduledAt: normalized.startAt,
    scheduledStart: normalized.startAt,
    startAt: normalized.startAt,
    scheduledEnd: normalized.endAt,
    endAt: normalized.endAt,
    durationMinutes,
  });
}

export function toSpanningCourtSchedule(plan) {
  const windows = Object.values(plan?.cases || {})
    .map((row) => normalizeScheduleWindow(row))
    .filter(Boolean);
  if (!windows.length) return null;
  const startMs = Math.min(...windows.map((row) => row.startMs));
  const endMs = Math.max(...windows.map((row) => row.endMs));
  const start = new Date(startMs);
  const end = new Date(endMs);
  const pad = (n) => String(n).padStart(2, "0");
  return Object.freeze({
    date: start.toISOString().slice(0, 10),
    startTime: `${pad(start.getUTCHours())}:${pad(start.getUTCMinutes())}`,
    endTime: `${pad(end.getUTCHours())}:${pad(end.getUTCMinutes())}`,
    startAt: toIso(startMs),
    endAt: toIso(endMs),
  });
}

export function isFixedShared08000900PositiveDefault(plan) {
  const positives = (plan?.positiveCases || POSITIVE_FIXTURE_SCHEDULE_CASES)
    .map((key) => plan?.cases?.[key])
    .map(normalizeScheduleWindow)
    .filter(Boolean);
  if (positives.length < 2) return false;
  const shared = positives.every((row) => {
    const start = new Date(row.startMs);
    const end = new Date(row.endMs);
    return (
      start.getUTCHours() === 8 &&
      start.getUTCMinutes() === 0 &&
      end.getUTCHours() === 9 &&
      end.getUTCMinutes() === 0 &&
      start.toISOString().slice(0, 10) === positives[0].startAt.slice(0, 10)
    );
  });
  return shared;
}

export function planCapacitySafeFixtureSchedule(input = {}) {
  const horizonStartIso = String(input.horizonStartIso || FIXTURE_BASE_HORIZON_ISO);
  const slotMs = Number(input.slotMs || FIXTURE_CANONICAL_SLOT_MS);
  const positiveCases = Object.freeze([
    ...(Array.isArray(input.positiveCases) && input.positiveCases.length
      ? input.positiveCases
      : POSITIVE_FIXTURE_SCHEDULE_CASES),
  ]);
  const negativeOverlapCase = String(
    input.negativeOverlapCase || NEGATIVE_OVERLAP_FIXTURE_CASE
  );
  const negativeOverlapSourceCase = String(
    input.negativeOverlapSourceCase || NEGATIVE_OVERLAP_SOURCE_CASE
  );
  const blocking = collectAuthoritativeBlockingWindows(input.authoritativeBlockingWindows);
  const reserved = [];
  const cases = {};

  for (const key of positiveCases) {
    const selected = selectNextFreeCanonicalWindow({
      blockingWindows: blocking,
      reservedWindows: reserved,
      horizonStartIso,
      slotMs,
    });
    if (!selected.ok) {
      return proof(false, selected.detail, {
        planner: FIXTURE_SCHEDULE_PLANNER_ID,
        failedCase: key,
      });
    }
    cases[key] = Object.freeze({
      ...selected.window,
      kind: "POSITIVE_NON_OVERLAPPING",
      fixtureKey: key,
      slotIndex: selected.slotIndex,
      ...toMatchScheduleFields(selected.window),
    });
    reserved.push(selected.window);
  }

  const source = cases[negativeOverlapSourceCase];
  if (!source) {
    return proof(false, "negative overlap source window missing");
  }
  cases[negativeOverlapCase] = Object.freeze({
    startAt: source.startAt,
    endAt: source.endAt,
    startMs: source.startMs,
    endMs: source.endMs,
    kind: "EXPLICIT_NEGATIVE_OVERLAP",
    fixtureKey: negativeOverlapCase,
    overlapsCase: negativeOverlapSourceCase,
    ...toMatchScheduleFields(source),
  });

  const plan = Object.freeze({
    ok: true,
    planner: FIXTURE_SCHEDULE_PLANNER_ID,
    orchestrationOnly: true,
    authority: "TEST_ORCHESTRATION_NOT_CANONICAL_RUNTIME",
    horizonStartIso,
    slotMs,
    cases: Object.freeze(cases),
    positiveCases,
    negativeOverlapCase,
    negativeOverlapSourceCase,
    authoritativeBlockingWindowCount: blocking.length,
    FIXED_SHARED_08_00_09_00_POSITIVE_WINDOW: "DENY",
    spanningCourtSchedule: toSpanningCourtSchedule({ cases }),
  });
  const check = evaluateCapacitySafePlan(plan);
  if (!check.ok) return check;
  return plan;
}

export function evaluateCapacitySafePlan(plan) {
  if (!plan || plan.ok !== true) {
    return proof(false, plan?.detail || "schedule plan missing");
  }
  if (plan.planner !== FIXTURE_SCHEDULE_PLANNER_ID) {
    return proof(false, "unknown fixture schedule planner");
  }
  if (plan.authority !== "TEST_ORCHESTRATION_NOT_CANONICAL_RUNTIME") {
    return proof(false, "planner must remain test orchestration only");
  }
  if (isFixedShared08000900PositiveDefault(plan)) {
    return proof(false, "FIXED_SHARED_08_00_09_00_POSITIVE_WINDOW denied");
  }
  const positives = plan.positiveCases || [];
  for (let i = 0; i < positives.length; i += 1) {
    const left = plan.cases?.[positives[i]];
    if (!normalizeScheduleWindow(left)) {
      return proof(false, `missing positive window ${positives[i]}`);
    }
    for (let j = i + 1; j < positives.length; j += 1) {
      const right = plan.cases?.[positives[j]];
      if (windowsOverlapHalfOpen(left, right)) {
        return proof(
          false,
          `positive windows overlap: ${positives[i]} vs ${positives[j]}`
        );
      }
    }
  }
  const overlapA = plan.cases?.[plan.negativeOverlapSourceCase];
  const overlapB = plan.cases?.[plan.negativeOverlapCase];
  if (!windowsOverlapHalfOpen(overlapA, overlapB)) {
    return proof(false, "explicit negative overlap window is not overlapping");
  }
  for (const key of positives) {
    if (key === plan.negativeOverlapSourceCase) continue;
    if (windowsOverlapHalfOpen(plan.cases[key], overlapB) && key !== plan.negativeOverlapCase) {
      return proof(false, `positive case ${key} uses overlap-negative slot`);
    }
  }
  return proof(true, "capacity-safe-plan", { plan });
}
