/**
 * CORE-11 — shared helpers, JSDoc type contracts, and time utilities.
 *
 * Time helpers here are **validation-only** (structural/calendar/IANA checks).
 * They must not implement civil↔UTC conversion, offset/DST handling, or absolute
 * timestamp generation. Canonical conversion SSOT remains:
 *   `src/domain/civilTime.js`
 * Phase 1C absolute conversion is delegated via `scheduleCivilTime.js` only.
 *
 * Mutation expectation: factories return fresh plain records. Callers must not
 * mutate returned objects if they rely on canonical equality / fingerprints.
 * Values are not deep-frozen (matches lighter competition-core modules).
 */

import {
  CIVIL_DATE_RE,
  MINUTES_FROM_MIDNIGHT_MAX,
  MINUTES_FROM_MIDNIGHT_MIN,
} from "./scheduleConstants.js";

/**
 * ASCII / UTF-16 code-unit lexicographic compare (no locale-dependent collation).
 * @param {unknown} a
 * @param {unknown} b
 * @returns {number}
 */
export function asciiCompare(a, b) {
  const left = String(a ?? "");
  const right = String(b ?? "");
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

/**
 * @param {unknown} value
 * @returns {string}
 */
export function normalizeIdentifier(value) {
  if (value == null) return "";
  return String(value).trim();
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isValidIdentifier(value) {
  return normalizeIdentifier(value).length > 0;
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isNonNegativeInteger(value) {
  return Number.isInteger(value) && /** @type {number} */ (value) >= 0;
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isPositiveInteger(value) {
  return Number.isInteger(value) && /** @type {number} */ (value) > 0;
}

/**
 * Shallow-copy plain object; rejects arrays / null as non-objects.
 * Key order follows Object.keys of the source (callers must not rely on
 * iteration order for canonical array/list outputs — use explicit sorts).
 *
 * @param {unknown} value
 * @returns {Record<string, unknown>}
 */
export function copyPlainObject(value) {
  if (value == null || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return { .../** @type {Record<string, unknown>} */ (value) };
}

/**
 * Civil date YYYY-MM-DD — calendar-valid via UTC probe (host-local Date forbidden).
 * @param {unknown} value
 * @returns {boolean}
 */
export function isValidCivilDate(value) {
  if (typeof value !== "string" || !CIVIL_DATE_RE.test(value.trim())) {
    return false;
  }
  const text = value.trim();
  const [y, m, d] = text.split("-").map(Number);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) {
    return false;
  }
  if (m < 1 || m > 12 || d < 1 || d > 31) {
    return false;
  }
  const probe = new Date(Date.UTC(y, m - 1, d));
  return (
    probe.getUTCFullYear() === y &&
    probe.getUTCMonth() === m - 1 &&
    probe.getUTCDate() === d
  );
}

/**
 * Minutes from midnight: integer 0..1439.
 * @param {unknown} value
 * @returns {boolean}
 */
export function isValidMinutesFromMidnight(value) {
  return (
    Number.isInteger(value) &&
    /** @type {number} */ (value) >= MINUTES_FROM_MIDNIGHT_MIN &&
    /** @type {number} */ (value) <= MINUTES_FROM_MIDNIGHT_MAX
  );
}

/**
 * Explicit IANA timezone via Intl (same fail-closed pattern as civilTime.assertIanaTimezone).
 * @param {unknown} value
 * @returns {boolean}
 */
export function isValidIanaTimezone(value) {
  const tz = normalizeIdentifier(value);
  if (!tz) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz }).format(0);
    return true;
  } catch {
    return false;
  }
}

/**
 * Half-open civil intervals [start, end) overlap when startA < endB && startB < endA.
 * Same-day only (caller must already reject overnight).
 *
 * @param {{ startMinutes: number, endMinutes: number }} a
 * @param {{ startMinutes: number, endMinutes: number }} b
 * @returns {boolean}
 */
export function civilWindowsOverlap(a, b) {
  return a.startMinutes < b.endMinutes && b.startMinutes < a.endMinutes;
}

/**
 * Half-open containment: inner ⊆ outer on the same civil date
 * (inner.start >= outer.start && inner.end <= outer.end).
 *
 * @param {{ date: string, startMinutes: number, endMinutes: number }} inner
 * @param {{ date: string, startMinutes: number, endMinutes: number }} outer
 * @returns {boolean}
 */
export function isCivilWindowContained(inner, outer) {
  return (
    inner.date === outer.date &&
    inner.startMinutes >= outer.startMinutes &&
    inner.endMinutes <= outer.endMinutes
  );
}

/**
 * Deterministic operating-window identity when caller omits windowId.
 * ASCII-safe; not a UUID; derived only from civil fields + timezone.
 *
 * @param {{ date: string, startMinutes: number, endMinutes: number, timezone: string }} w
 * @returns {string}
 */
export function deriveOperatingWindowId(w) {
  return `ow:${w.date}:${w.startMinutes}:${w.endMinutes}:${w.timezone}`;
}

/**
 * Stable sort with complete numeric + string tie-breakers (ASCII).
 * @template T
 * @param {T[]} items
 * @param {(item: T) => Array<string|number|boolean|null|undefined>} keyFn
 * @returns {T[]}
 */
export function stableSortByKeys(items, keyFn) {
  return [...items]
    .map((item, index) => ({ item, index, keys: keyFn(item) }))
    .sort((left, right) => {
      const len = Math.max(left.keys.length, right.keys.length);
      for (let i = 0; i < len; i += 1) {
        const a = left.keys[i];
        const b = right.keys[i];
        if (typeof a === "number" && typeof b === "number") {
          if (a !== b) return a < b ? -1 : 1;
          continue;
        }
        if (typeof a === "boolean" && typeof b === "boolean") {
          if (a !== b) return a === false ? -1 : 1;
          continue;
        }
        const c = asciiCompare(a, b);
        if (c !== 0) return c;
      }
      return left.index - right.index;
    })
    .map((row) => row.item);
}

/**
 * Deterministic canonicalize for fingerprint / equality (sort object keys;
 * arrays preserve caller order). Excludes undefined. No Date.now / random.
 *
 * @param {unknown} value
 * @param {WeakSet<object>} [seen]
 * @returns {unknown}
 */
export function canonicalizeJsonValue(value, seen = new WeakSet()) {
  if (value === null || typeof value !== "object") {
    if (typeof value === "number" && !Number.isFinite(value)) {
      throw new Error("NON_CANONICAL_VALUE: non-finite number");
    }
    if (typeof value === "bigint" || typeof value === "function" || typeof value === "symbol") {
      throw new Error(`NON_CANONICAL_VALUE: ${typeof value}`);
    }
    if (typeof value === "undefined") return null;
    return value ?? null;
  }
  if (seen.has(value)) {
    throw new Error("NON_CANONICAL_VALUE: cyclic reference");
  }
  seen.add(value);
  if (Array.isArray(value)) {
    return value.map((item) => canonicalizeJsonValue(item, seen));
  }
  /** @type {Record<string, unknown>} */
  const out = {};
  for (const key of Object.keys(/** @type {Record<string, unknown>} */ (value)).sort(asciiCompare)) {
    out[key] = canonicalizeJsonValue(
      /** @type {Record<string, unknown>} */ (value)[key],
      seen
    );
  }
  return out;
}

/**
 * @param {unknown} value
 * @returns {string}
 */
export function serializeCanonical(value) {
  return JSON.stringify(canonicalizeJsonValue(value));
}

/* -------------------------------------------------------------------------- */
/* JSDoc domain contracts (Phase 1B)                                          */
/* -------------------------------------------------------------------------- */

/**
 * Canonical civil schedule instant (timezone usually owned by ScheduleRequest;
 * conversion adapters require an explicit IANA timezone argument or field).
 *
 * @typedef {Object} CivilScheduleTime
 * @property {string} date - YYYY-MM-DD
 * @property {number} minutesFromMidnight - integer 0..1439
 * @property {string} [timezone] - explicit IANA when present on a conversion input
 */

/**
 * @typedef {Object} SchedulingWindow
 * @property {string} date
 * @property {number} startMinutes - inclusive
 * @property {number} endMinutes - exclusive
 * @property {string} [timezone] - must match ScheduleRequest.timezone when present
 * @property {string} [windowId]
 * @property {string} [label] - non-semantic metadata
 * @property {number} [sequence] - assigned by normalization
 * @property {Readonly<Record<string, unknown>>} [metadata]
 */

/**
 * @typedef {Object} SessionWindow
 * @property {string} sessionId
 * @property {string} date
 * @property {number} startMinutes
 * @property {number} endMinutes
 * @property {string} [timezone] - must match ScheduleRequest.timezone when present
 * @property {string} [label] - non-semantic metadata
 * @property {number} [sequence] - assigned by normalization
 * @property {Readonly<Record<string, unknown>>} [metadata]
 */

/**
 * @typedef {Object} ScheduleParticipantReference
 * @property {string} participantId
 * @property {string} [kind] - PLAYER | TEAM | ENTRY | PLACEHOLDER
 * @property {string} [teamId]
 * @property {string} [side]
 * @property {string[]} [constraintResourceIds] - shared player/resource keys
 * @property {Readonly<Record<string, unknown>>} [metadata]
 */

/**
 * @typedef {Object} ScheduleDependency
 * @property {string} sourceMatchId
 * @property {string} [type] - Phase 1D graph construction requires a supported type
 * @property {Readonly<Record<string, unknown>>} [metadata]
 */

/**
 * @typedef {Object} ScheduleMatchInput
 * @property {string} matchId
 * @property {string} [divisionId]
 * @property {string} [stageId]
 * @property {number} [roundNumber]
 * @property {number} [sequence]
 * @property {ScheduleParticipantReference[]} [participants]
 * @property {ScheduleDependency[]} [dependencies]
 * @property {boolean} [isBye]
 * @property {number} [estimatedDurationMinutes]
 * @property {number} [priority]
 * @property {Readonly<Record<string, unknown>>} [metadata]
 */

/**
 * @typedef {Object} MatchDurationPolicy
 * @property {number} defaultDurationMinutes - positive integer
 * @property {number} [bufferMinutes] - non-negative integer
 * @property {Readonly<Record<string, number>>} [durationByRound]
 * @property {Readonly<Record<string, number>>} [durationByStage]
 */

/**
 * @typedef {Object} RestPolicy
 * @property {number} minParticipantRestMinutes - non-negative; 0 disables
 * @property {number} [minTeamRestMinutes] - non-negative; 0 disables
 */

/**
 * @typedef {Object} CapacityPolicy
 * @property {number} maxConcurrentMatches - positive integer; required; no silent default
 */

/**
 * @typedef {Object} SchedulePolicy
 * @property {MatchDurationPolicy} duration
 * @property {RestPolicy} rest
 * @property {CapacityPolicy} capacity
 */

/**
 * @typedef {Object} ScheduleRequest
 * @property {string} competitionId
 * @property {string} timezone - explicit IANA
 * @property {ScheduleMatchInput[]} matches
 * @property {SchedulePolicy} policy
 * @property {SchedulingWindow[]} [operatingWindows]
 * @property {SessionWindow[]} [sessionWindows]
 * @property {Readonly<Record<string, unknown>>} [metadata]
 */

/**
 * @typedef {Object} ScheduledMatch
 * @property {string} matchId
 * @property {CivilScheduleTime} start
 * @property {CivilScheduleTime} end
 * @property {string} [sessionId]
 * @property {number} sequence
 * @property {number} [abstractSlotIndex]
 * @property {number} [requiredCapacity]
 * @property {number} [durationMinutes]
 * @property {number} [bufferMinutes]
 * @property {number} [concurrencyIndex]
 * @property {number} [startUtcMs]
 * @property {number} [endUtcMs]
 * @property {string} [startUtcIso]
 * @property {string} [endUtcIso]
 * @property {number} [capacityReleaseUtcMs]
 * @property {string} [capacityReleaseUtcIso]
 * @property {string} [sourceWindowId]
 * @property {Readonly<Record<string, unknown>>} [metadata]
 */

/**
 * @typedef {Object} UnscheduledMatch
 * @property {string} matchId
 * @property {string} [reasonCode]
 * @property {string} [message]
 * @property {Readonly<Record<string, unknown>>} [metadata]
 */

/**
 * @typedef {Object} ScheduleReplayMetadata
 * @property {string} engineId
 * @property {string} engineVersion
 * @property {string} [inputFingerprint]
 * @property {string} [resultFingerprint]
 * @property {Readonly<Record<string, unknown>>} [details]
 */

/**
 * @typedef {Object} SchedulePlan
 * @property {string} competitionId
 * @property {string} timezone
 * @property {ScheduledMatch[]} scheduled
 * @property {UnscheduledMatch[]} unscheduled
 * @property {import('./scheduleDiagnostics.js').ScheduleDiagnostic[]} diagnostics
 * @property {ScheduleReplayMetadata} [replay]
 * @property {string} [producedAt] - non-semantic wall-clock metadata; excluded from fingerprint
 * @property {Readonly<Record<string, unknown>>} [metadata]
 */

/**
 * @typedef {Object} SchedulePolicyBundle
 * @property {string} timezone
 * @property {import('./scheduleTypes.js').SchedulingWindow[]} operatingWindows
 * @property {import('./scheduleTypes.js').SessionWindow[]} [sessionWindows]
 * @property {number} defaultDurationMinutes
 * @property {Readonly<Record<string, number>>} [durationByStage]
 * @property {Readonly<Record<string, number>>} [durationByRound]
 * @property {number} bufferMinutes - capacity occupancy buffer; maps to policy.duration.bufferMinutes
 * @property {number} dependencyBufferMinutes - adapter input for dependency earliest-start intent; must equal bufferMinutes under CORE-11 shared-buffer Outcome B (not stored as a second canonical field)
 * @property {number} minParticipantRestMinutes
 * @property {number} [minTeamRestMinutes]
 * @property {number} maxConcurrentMatches
 * @property {Readonly<Record<string, {
 *   kind?: string,
 *   teamId?: string,
 *   constraintResourceIds?: string[],
 * }>>} [identityByParticipantId]
 * @property {Readonly<Record<string, {
 *   participantId: string,
 *   kind?: string,
 *   teamId?: string,
 *   constraintResourceIds?: string[],
 * }>>} [placementIdentityByRef]
 * @property {string} [defaultDirectParticipantKind]
 * @property {Readonly<Record<string, number>>} [estimatedDurationByMatchId]
 * @property {Readonly<Record<string, number>>} [priorityByMatchId]
 * @property {string} [competitionId]
 */

/**
 * @typedef {Object} MatchPlanAdapterMappingSummary
 * @property {number} sourceMatchCount
 * @property {number} mappedMatchCount
 * @property {number} byeMatchCount
 * @property {number} dependencyCount
 * @property {number} concreteParticipantCount
 * @property {number} placeholderParticipantCount
 */

/**
 * @typedef {Object} MatchPlanToScheduleRequestResult
 * @property {boolean} ok
 * @property {string} status
 * @property {import('./scheduleTypes.js').ScheduleRequest|null} scheduleRequest
 * @property {import('./scheduleDiagnostics.js').ScheduleDiagnostic[]} diagnostics
 * @property {MatchPlanAdapterMappingSummary} mappingSummary
 * @property {Readonly<Record<string, unknown>>} replay
 */

/**
 * Optional CORE-10 port. Must not be called in Phase 1B.
 *
 * @typedef {Object} ScheduleOptimizerPort
 * @property {(request: ScheduleRequest, context?: unknown) => SchedulePlan|Promise<SchedulePlan>} optimizeSchedule
 */

/**
 * Future CORE-12 capacity derivation port (not implemented in Phase 1B).
 *
 * @typedef {Object} ScheduleCapacityPort
 * @property {(context?: unknown) => number|Promise<number>} resolveMaxConcurrentMatches
 */

/**
 * @typedef {Object} ScheduleResultValidator
 * @property {(plan: unknown) => import('./validateSchedulePlan.js').SchedulePlanValidationResult} validateSchedulePlan
 */
