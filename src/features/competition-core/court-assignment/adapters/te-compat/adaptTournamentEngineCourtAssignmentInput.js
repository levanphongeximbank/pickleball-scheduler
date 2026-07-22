/**
 * CORE-12 Phase 1C — Tournament Engine anti-corruption adapter.
 *
 * Maps legacy TE-shaped court-assignment inputs + adapter-shaped availability
 * snapshots into a certified CourtAssignmentRequest.
 *
 * This is NOT an assignment engine. It does not generate matches/times,
 * calculate availability, fetch inventory, invent scope, mutate inputs,
 * call production TE services, or write assignments back to TE.
 */

import {
  CORE12_COMPARATOR_VERSION,
  CORE12_COURT_ASSIGNMENT_SCHEMA_V1,
  CORE12_COURT_SELECTION_STRATEGY_VERSION,
  CORE12_POLICY_VERSION,
  CORE12_TE_ADAPTER_CONTRACT_V1,
} from "../../constants/versions.js";
import { validateCourtAssignmentRequest } from "../../services/validateCourtAssignmentRequest.js";
import { COURT_AVAILABILITY_STATUS } from "../../enums/availabilityStatus.js";
import { COURT_LOCK_SOURCE } from "../../enums/assignmentSource.js";
import { CAPABILITY_MATCH_MODE, INVALID_LOCK_BEHAVIOR } from "../../enums/capabilityMatchMode.js";
import {
  COURT_ORDERING_STRATEGY,
  MATCH_ORDERING_STRATEGY,
} from "../../enums/orderingStrategy.js";
import { isCourtAssignmentContractError } from "../../errors/CourtAssignmentContractError.js";
import { requireAbsoluteInstant } from "../../deterministic/intervals.js";
import { compareStableString } from "../../deterministic/compare.js";
import {
  TE_ADAPTER_MAPPING_CODE,
  createTeAdapterMappingFailure,
} from "./mappingCodes.js";

const ABSOLUTE_INSTANT_RE =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,9})?(Z|[+-]\d{2}:\d{2})$/;

/** Stage importance scores mirrored from TE matchImportance (explicit stage fields only). */
const STAGE_IMPORTANCE = Object.freeze({
  final: 100,
  semifinal: 80,
  third_place: 70,
  quarterfinal: 60,
  round_of_16: 50,
  group: 30,
});

/**
 * @param {unknown} value
 * @returns {boolean}
 */
function isPlainObject(value) {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

/**
 * Deep clone via JSON for immutability proofs (fixtures are JSON-safe).
 * @param {unknown} value
 */
function deepCloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

/**
 * @param {unknown} id
 * @returns {string|null}
 */
function asNonEmptyId(id) {
  if (typeof id !== "string" && typeof id !== "number") return null;
  const s = String(id).trim();
  return s === "" ? null : s;
}

/**
 * Map TE stage + topSeed (explicit fields) into CORE-12 priority.
 * Does not invent stage when absent.
 * @param {Record<string, unknown>} match
 * @returns {number}
 */
export function mapLegacyMatchPriority(match) {
  if (typeof match.priority === "number" && Number.isFinite(match.priority)) {
    return match.priority;
  }
  const stage = String(match.stage || match.bracketStage || "group").toLowerCase();
  const seedBonus = Math.max(0, 10 - Number(match.topSeed || 99));
  const base = STAGE_IMPORTANCE[stage] ?? 30;
  return base + seedBonus;
}

/**
 * @param {unknown} instant
 * @param {string} field
 * @param {object[]} failures
 * @param {Record<string, unknown>} details
 * @returns {string|null}
 */
function requireMappedInstant(instant, field, failures, details) {
  if (instant == null || (typeof instant === "string" && instant.trim() === "")) {
    failures.push(
      createTeAdapterMappingFailure(
        TE_ADAPTER_MAPPING_CODE.MISSING_SCHEDULED_INTERVAL,
        `${field} is required`,
        details
      )
    );
    return null;
  }
  if (typeof instant !== "string") {
    failures.push(
      createTeAdapterMappingFailure(
        TE_ADAPTER_MAPPING_CODE.INVALID_SCHEDULED_INTERVAL,
        `${field} must be a string instant`,
        details
      )
    );
    return null;
  }
  const trimmed = instant.trim();
  if (!ABSOLUTE_INSTANT_RE.test(trimmed)) {
    failures.push(
      createTeAdapterMappingFailure(
        TE_ADAPTER_MAPPING_CODE.TIMEZONE_LESS_INSTANT,
        `${field} lacks explicit Z or numeric offset`,
        { ...details, value: trimmed }
      )
    );
    return null;
  }
  try {
    return requireAbsoluteInstant(trimmed, field);
  } catch (err) {
    const code = isCourtAssignmentContractError(err)
      ? TE_ADAPTER_MAPPING_CODE.INVALID_CALENDAR_INSTANT
      : TE_ADAPTER_MAPPING_CODE.INVALID_SCHEDULED_INTERVAL;
    failures.push(
      createTeAdapterMappingFailure(code, `${field} is not a valid absolute instant`, {
        ...details,
        value: trimmed,
      })
    );
    return null;
  }
}

/**
 * @param {unknown} caps
 * @returns {string[]|Record<string, unknown>|null}
 */
function mapRequiredCapabilities(caps) {
  if (caps == null) return null;
  if (Array.isArray(caps)) {
    return caps
      .filter((c) => typeof c === "string" && c.trim() !== "")
      .map((c) => c.trim());
  }
  if (isPlainObject(caps)) {
    return /** @type {Record<string, unknown>} */ ({ ...caps });
  }
  return null;
}

/**
 * @param {unknown} input
 * @returns {{
 *   ok: boolean,
 *   adapterContractVersion: string,
 *   request: object|null,
 *   failures: readonly object[],
 *   diagnostics: readonly object[],
 * }}
 */
export function adaptTournamentEngineCourtAssignmentInput(input) {
  const adapterContractVersion = CORE12_TE_ADAPTER_CONTRACT_V1;
  /** @type {object[]} */
  const failures = [];
  /** @type {object[]} */
  const diagnostics = [];

  if (!isPlainObject(input)) {
    return Object.freeze({
      ok: false,
      adapterContractVersion,
      request: null,
      failures: Object.freeze([
        createTeAdapterMappingFailure(
          TE_ADAPTER_MAPPING_CODE.MISSING_LEGACY_INPUT,
          "adapter input must be a plain object"
        ),
      ]),
      diagnostics: Object.freeze([]),
    });
  }

  // Defensive clone of caller-visible payload for mutation proofs; mapping uses original refs only for reads.
  const inputSnapshot = deepCloneJson(input);

  const tenantId = asNonEmptyId(input.tenantId);
  const clubId = asNonEmptyId(input.clubId);
  const venueId = asNonEmptyId(input.venueId);
  const competitionId = asNonEmptyId(input.competitionId);
  const timezone =
    typeof input.timezone === "string" && input.timezone.trim() !== ""
      ? input.timezone.trim()
      : null;

  if (!tenantId) {
    failures.push(
      createTeAdapterMappingFailure(
        TE_ADAPTER_MAPPING_CODE.MISSING_TENANT_SCOPE,
        "tenantId is required"
      )
    );
  }
  if (!clubId) {
    failures.push(
      createTeAdapterMappingFailure(
        TE_ADAPTER_MAPPING_CODE.MISSING_CLUB_SCOPE,
        "clubId is required"
      )
    );
  }
  if (!venueId) {
    failures.push(
      createTeAdapterMappingFailure(
        TE_ADAPTER_MAPPING_CODE.MISSING_VENUE_SCOPE,
        "venueId is required"
      )
    );
  }
  if (!competitionId) {
    failures.push(
      createTeAdapterMappingFailure(
        TE_ADAPTER_MAPPING_CODE.MISSING_COMPETITION_SCOPE,
        "competitionId is required"
      )
    );
  }
  if (!timezone) {
    failures.push(
      createTeAdapterMappingFailure(
        TE_ADAPTER_MAPPING_CODE.MISSING_TIMEZONE,
        "timezone is required"
      )
    );
  }

  if (!Array.isArray(input.matches)) {
    failures.push(
      createTeAdapterMappingFailure(
        TE_ADAPTER_MAPPING_CODE.UNSUPPORTED_LEGACY_SHAPE,
        "matches must be an explicit array"
      )
    );
  }
  if (!Array.isArray(input.courtAvailabilitySnapshots)) {
    failures.push(
      createTeAdapterMappingFailure(
        TE_ADAPTER_MAPPING_CODE.MISSING_AVAILABILITY_SNAPSHOT,
        "courtAvailabilitySnapshots must be an explicit adapter-shaped array"
      )
    );
  }

  if (failures.length > 0) {
    return Object.freeze({
      ok: false,
      adapterContractVersion,
      request: null,
      failures: Object.freeze(failures),
      diagnostics: Object.freeze(diagnostics),
      _inputSnapshot: Object.freeze(inputSnapshot),
    });
  }

  const matchesIn = /** @type {unknown[]} */ (input.matches);
  const snapshotsIn = /** @type {unknown[]} */ (input.courtAvailabilitySnapshots);

  /** @type {object[]} */
  const mappedMatches = [];
  /** @type {object[]} */
  const lockedAssignments = [];
  /** @type {Set<string>} */
  const seenMatchIds = new Set();

  for (let i = 0; i < matchesIn.length; i += 1) {
    const raw = matchesIn[i];
    if (!isPlainObject(raw)) {
      failures.push(
        createTeAdapterMappingFailure(
          TE_ADAPTER_MAPPING_CODE.UNSUPPORTED_LEGACY_SHAPE,
          "match must be a plain object",
          { index: i }
        )
      );
      continue;
    }
    const matchId = asNonEmptyId(raw.id ?? raw.matchId);
    if (!matchId) {
      failures.push(
        createTeAdapterMappingFailure(
          TE_ADAPTER_MAPPING_CODE.MISSING_MATCH_ID,
          "match id is required",
          { index: i }
        )
      );
      continue;
    }
    if (seenMatchIds.has(matchId)) {
      failures.push(
        createTeAdapterMappingFailure(
          TE_ADAPTER_MAPPING_CODE.DUPLICATE_MATCH_ID,
          "duplicate match id",
          { matchId, index: i }
        )
      );
      continue;
    }
    seenMatchIds.add(matchId);

    const matchTenant = asNonEmptyId(raw.tenantId);
    const matchClub = asNonEmptyId(raw.clubId);
    const matchVenue = asNonEmptyId(raw.venueId);
    const matchComp = asNonEmptyId(raw.competitionId);
    if (
      (matchTenant && matchTenant !== tenantId) ||
      (matchClub && matchClub !== clubId) ||
      (matchVenue && matchVenue !== venueId) ||
      (matchComp && matchComp !== competitionId)
    ) {
      failures.push(
        createTeAdapterMappingFailure(
          TE_ADAPTER_MAPPING_CODE.CROSS_SCOPE_DATA,
          "match scope identifiers conflict with request scope",
          { matchId, index: i }
        )
      );
      continue;
    }

    const status = raw.status == null ? null : String(raw.status);
    const isTerminal = status === "completed" || status === "forfeit";

    let scheduledStart = null;
    let scheduledEnd = null;
    if (isTerminal) {
      // Terminal occupancy is only representable with explicit valid intervals.
      const s = typeof raw.scheduledStart === "string" ? raw.scheduledStart.trim() : null;
      const e = typeof raw.scheduledEnd === "string" ? raw.scheduledEnd.trim() : null;
      if (s && e && ABSOLUTE_INSTANT_RE.test(s) && ABSOLUTE_INSTANT_RE.test(e)) {
        try {
          scheduledStart = requireAbsoluteInstant(s, "terminal.scheduledStart");
          scheduledEnd = requireAbsoluteInstant(e, "terminal.scheduledEnd");
          if (!(Date.parse(scheduledStart) < Date.parse(scheduledEnd))) {
            scheduledStart = null;
            scheduledEnd = null;
          }
        } catch {
          scheduledStart = null;
          scheduledEnd = null;
        }
      }
      if (!scheduledStart || !scheduledEnd) {
        diagnostics.push(
          Object.freeze({
            code: "TERMINAL_MATCH_OMITTED_UNREPRESENTABLE_INTERVAL",
            matchId,
            index: i,
          })
        );
        continue;
      }
    } else {
      scheduledStart = requireMappedInstant(
        raw.scheduledStart,
        `matches[${i}].scheduledStart`,
        failures,
        { matchId, index: i }
      );
      scheduledEnd = requireMappedInstant(
        raw.scheduledEnd,
        `matches[${i}].scheduledEnd`,
        failures,
        { matchId, index: i }
      );
      if (scheduledStart && scheduledEnd) {
        const startMs = Date.parse(scheduledStart);
        const endMs = Date.parse(scheduledEnd);
        if (!(startMs < endMs)) {
          failures.push(
            createTeAdapterMappingFailure(
              TE_ADAPTER_MAPPING_CODE.INVALID_SCHEDULED_INTERVAL,
              "scheduled interval must have positive duration",
              { matchId, index: i }
            )
          );
          scheduledStart = null;
          scheduledEnd = null;
        }
      }
      if (!scheduledStart || !scheduledEnd) {
        continue;
      }
    }

    const manualCourtLock = raw.manualCourtLock === true;
    const existingCourtId = asNonEmptyId(raw.courtId ?? raw.existingCourtId);

    if (manualCourtLock) {
      if (!existingCourtId) {
        failures.push(
          createTeAdapterMappingFailure(
            TE_ADAPTER_MAPPING_CODE.AMBIGUOUS_LOCKED_ASSIGNMENT,
            "manualCourtLock requires an explicit courtId",
            { matchId, index: i }
          )
        );
        continue;
      }
      lockedAssignments.push({
        matchId,
        courtId: existingCourtId,
        lockSource: COURT_LOCK_SOURCE.MANUAL,
        reason: "legacy manualCourtLock",
        overrideAllowed: false,
      });
    }

    const stage =
      raw.stage == null && raw.bracketStage == null
        ? null
        : String(raw.stage || raw.bracketStage);

    mappedMatches.push({
      matchId,
      competitionId,
      tenantId,
      clubId,
      venueId,
      scheduledStart,
      scheduledEnd,
      status,
      priority: mapLegacyMatchPriority(raw),
      stage,
      requiredCapabilities: mapRequiredCapabilities(raw.requiredCapabilities),
      existingCourtId: existingCourtId,
      manualCourtLock,
      isBye: raw.isBye === true,
    });
  }

  /** @type {object[]} */
  const mappedCourts = [];
  /** @type {Set<string>} */
  const seenCourtIds = new Set();

  for (let i = 0; i < snapshotsIn.length; i += 1) {
    const raw = snapshotsIn[i];
    if (!isPlainObject(raw)) {
      failures.push(
        createTeAdapterMappingFailure(
          TE_ADAPTER_MAPPING_CODE.UNSUPPORTED_LEGACY_SHAPE,
          "court availability snapshot must be a plain object",
          { index: i }
        )
      );
      continue;
    }
    const courtId = asNonEmptyId(raw.courtId ?? raw.id);
    if (!courtId) {
      failures.push(
        createTeAdapterMappingFailure(
          TE_ADAPTER_MAPPING_CODE.MISSING_COURT_ID,
          "courtId is required on availability snapshot",
          { index: i }
        )
      );
      continue;
    }
    if (seenCourtIds.has(courtId)) {
      failures.push(
        createTeAdapterMappingFailure(
          TE_ADAPTER_MAPPING_CODE.DUPLICATE_COURT_ID,
          "duplicate courtId in availability snapshots",
          { courtId, index: i }
        )
      );
      continue;
    }
    seenCourtIds.add(courtId);

    const courtTenant = asNonEmptyId(raw.tenantId);
    const courtClub = asNonEmptyId(raw.clubId);
    const courtVenue = asNonEmptyId(raw.venueId);
    if (
      (courtTenant && courtTenant !== tenantId) ||
      (courtClub && courtClub !== clubId) ||
      (courtVenue && courtVenue !== venueId)
    ) {
      failures.push(
        createTeAdapterMappingFailure(
          TE_ADAPTER_MAPPING_CODE.CROSS_SCOPE_DATA,
          "court snapshot scope identifiers conflict with request scope",
          { courtId, index: i }
        )
      );
      continue;
    }

    const intervalsField = raw.availabilityIntervals;
    if (intervalsField == null) {
      failures.push(
        createTeAdapterMappingFailure(
          TE_ADAPTER_MAPPING_CODE.EMPTY_COURT_AVAILABILITY,
          "availabilityIntervals is required and must contain at least one explicit absolute interval",
          { courtId, index: i, reason: "MISSING_OR_NULL" }
        )
      );
      continue;
    }
    if (!Array.isArray(intervalsField)) {
      failures.push(
        createTeAdapterMappingFailure(
          TE_ADAPTER_MAPPING_CODE.INVALID_AVAILABILITY_INTERVAL,
          "availabilityIntervals must be an array",
          { courtId, index: i }
        )
      );
      continue;
    }
    if (intervalsField.length === 0) {
      failures.push(
        createTeAdapterMappingFailure(
          TE_ADAPTER_MAPPING_CODE.EMPTY_COURT_AVAILABILITY,
          "availabilityIntervals must contain at least one explicit absolute interval (empty array is unrepresentable)",
          { courtId, index: i, reason: "EMPTY_ARRAY" }
        )
      );
      continue;
    }

    /** @type {{ start: string, end: string }[]} */
    const availabilityIntervals = [];
    let intervalFailed = false;
    for (let j = 0; j < intervalsField.length; j += 1) {
      const iv = intervalsField[j];
      if (!isPlainObject(iv)) {
        failures.push(
          createTeAdapterMappingFailure(
            TE_ADAPTER_MAPPING_CODE.INVALID_AVAILABILITY_INTERVAL,
            "availability interval must be an object with start/end",
            { courtId, index: i, intervalIndex: j }
          )
        );
        intervalFailed = true;
        break;
      }
      const start = requireMappedInstant(
        iv.start,
        `courtAvailabilitySnapshots[${i}].availabilityIntervals[${j}].start`,
        failures,
        { courtId, index: i, intervalIndex: j }
      );
      const end = requireMappedInstant(
        iv.end,
        `courtAvailabilitySnapshots[${i}].availabilityIntervals[${j}].end`,
        failures,
        { courtId, index: i, intervalIndex: j }
      );
      if (!start || !end) {
        intervalFailed = true;
        break;
      }
      if (!(Date.parse(start) < Date.parse(end))) {
        failures.push(
          createTeAdapterMappingFailure(
            TE_ADAPTER_MAPPING_CODE.INVALID_AVAILABILITY_INTERVAL,
            "availability interval must have positive duration",
            { courtId, index: i, intervalIndex: j }
          )
        );
        intervalFailed = true;
        break;
      }
      availabilityIntervals.push({ start, end });
    }
    // Deterministic policy: any invalid interval rejects the court (no partial keep).
    if (intervalFailed) continue;
    if (availabilityIntervals.length === 0) {
      failures.push(
        createTeAdapterMappingFailure(
          TE_ADAPTER_MAPPING_CODE.EMPTY_COURT_AVAILABILITY,
          "no valid availability interval remained after mapping",
          { courtId, index: i, reason: "NO_VALID_INTERVAL" }
        )
      );
      continue;
    }

    // TE court.locked (inventory lock) → ineligible for auto; must be explicit on snapshot.
    const inventoryLocked = raw.locked === true;
    const active = raw.active === false ? false : true;
    const eligible =
      raw.eligible === false || inventoryLocked ? false : true;
    const availabilityStatus =
      typeof raw.availabilityStatus === "string" && raw.availabilityStatus.trim() !== ""
        ? String(raw.availabilityStatus)
        : inventoryLocked
          ? COURT_AVAILABILITY_STATUS.UNAVAILABLE
          : COURT_AVAILABILITY_STATUS.AVAILABLE;

    let priority = 0;
    if (typeof raw.priority === "number" && Number.isFinite(raw.priority)) {
      priority = raw.priority;
    }

    mappedCourts.push({
      courtId,
      tenantId,
      venueId,
      clubId,
      availabilityStatus,
      active,
      eligible,
      unavailableReasons: Array.isArray(raw.unavailableReasons)
        ? raw.unavailableReasons.filter((r) => typeof r === "string" && r.trim() !== "")
        : inventoryLocked
          ? Object.freeze(["LEGACY_COURT_LOCKED"])
          : Object.freeze([]),
      capabilities:
        raw.capabilities == null
          ? Object.freeze({})
          : Array.isArray(raw.capabilities) || isPlainObject(raw.capabilities)
            ? raw.capabilities
            : Object.freeze({}),
      priority,
      availabilityIntervals,
    });
  }

  // Sort mapped collections deterministically before contract build (stable request shape).
  mappedMatches.sort((a, b) => compareStableString(a.matchId, b.matchId));
  mappedCourts.sort((a, b) => compareStableString(a.courtId, b.courtId));
  lockedAssignments.sort(
    (a, b) =>
      compareStableString(a.matchId, b.matchId) ||
      compareStableString(a.courtId, b.courtId)
  );

  if (failures.length > 0) {
    return Object.freeze({
      ok: false,
      adapterContractVersion,
      request: null,
      failures: Object.freeze(
        [...failures].sort(
          (a, b) =>
            compareStableString(a.code, b.code) ||
            compareStableString(JSON.stringify(a.details), JSON.stringify(b.details))
        )
      ),
      diagnostics: Object.freeze(diagnostics),
      _inputSnapshot: Object.freeze(inputSnapshot),
    });
  }

  const policyOverrides = isPlainObject(input.policy) ? input.policy : {};
  const overrideManual = input.overrideManual === true;

  const requestId =
    asNonEmptyId(input.requestId) ||
    `te-adapt-${tenantId}-${competitionId}-${mappedMatches.length}-${mappedCourts.length}`;

  try {
    // Emit a plain request payload (no factory-internal _startMs/_endMs fields)
    // so assignCourtsDeterministic can validate via createCourtAssignmentRequest.
    const plainRequest = {
      schemaVersion: CORE12_COURT_ASSIGNMENT_SCHEMA_V1,
      requestId,
      tenantId,
      clubId,
      venueId,
      competitionId,
      timezone,
      matches: mappedMatches,
      courts: mappedCourts,
      lockedAssignments,
      constraints: [],
      policy: {
        policyId:
          asNonEmptyId(/** @type {any} */ (policyOverrides).policyId) ||
          "te-parity-policy",
        policyVersion: CORE12_POLICY_VERSION,
        partialAssignmentAllowed:
          /** @type {any} */ (policyOverrides).partialAssignmentAllowed === true,
        overrideManualLocks:
          overrideManual ||
          /** @type {any} */ (policyOverrides).overrideManualLocks === true,
        acceptLockedAssignments:
          /** @type {any} */ (policyOverrides).acceptLockedAssignments === false
            ? false
            : true,
        invalidLockBehavior:
          /** @type {any} */ (policyOverrides).invalidLockBehavior ||
          INVALID_LOCK_BEHAVIOR.CONFLICT,
        allowUnscheduledMatches: false,
        skipTerminalStatuses: true,
        terminalStatuses: ["completed", "forfeit"],
        matchOrderingStrategy: MATCH_ORDERING_STRATEGY.STABLE_PRIORITY_THEN_ID,
        courtOrderingStrategy: COURT_ORDERING_STRATEGY.STABLE_PRIORITY_THEN_ID,
        requireVenueTimezone: true,
        requireAvailabilitySnapshot: true,
        capabilityMatchMode:
          /** @type {any} */ (policyOverrides).capabilityMatchMode ||
          CAPABILITY_MATCH_MODE.HARD,
        overlapMode: "HALF_OPEN",
        comparatorVersion: CORE12_COMPARATOR_VERSION,
        courtSelectionStrategyVersion: CORE12_COURT_SELECTION_STRATEGY_VERSION,
      },
      availabilitySnapshotRef: isPlainObject(input.availabilitySnapshotRef)
        ? input.availabilitySnapshotRef
        : {
            snapshotId: "te-parity-avail",
            snapshotVersion: "v1",
            fingerprint: "teparity01",
          },
      scheduleSnapshotRef: isPlainObject(input.scheduleSnapshotRef)
        ? input.scheduleSnapshotRef
        : {
            snapshotId: "te-parity-sched",
            snapshotVersion: "v1",
            fingerprint: "teparity02",
          },
      metadata: {
        source: "te-compat-adapter",
        adapterContractVersion,
      },
    };

    const validation = validateCourtAssignmentRequest(plainRequest);
    if (!validation.ok) {
      // Lock / eligibility feasibility against the snapshot is CORE-12 assign-time
      // behavior when the lock reference itself is unambiguous (explicit matchId+courtId).
      // Do not treat those as unrepresentable mapping failures.
      const assignTimeCodes = new Set([
        "LOCK_REFERENCES_UNKNOWN_COURT",
        "LOCK_REFERENCES_UNKNOWN_MATCH",
        "LOCK_COURT_UNAVAILABLE",
        "LOCK_OVERLAP",
        "LOCK_CAPABILITY_MISMATCH",
        "LOCK_SCOPE_MISMATCH",
      ]);
      const allowAssignTime =
        assignTimeCodes.has(String(validation.code)) &&
        lockedAssignments.length > 0;
      if (!allowAssignTime) {
        failures.push(
          createTeAdapterMappingFailure(
            TE_ADAPTER_MAPPING_CODE.CONTRACT_BUILD_FAILED,
            "mapped legacy input failed CORE-12 request validation",
            {
              contractCode: validation.code,
              message: validation.message,
            }
          )
        );
        return Object.freeze({
          ok: false,
          adapterContractVersion,
          request: null,
          failures: Object.freeze(failures),
          diagnostics: Object.freeze(diagnostics),
          _inputSnapshot: Object.freeze(inputSnapshot),
        });
      }
      diagnostics.push(
        Object.freeze({
          code: "TE_ADAPTER_DEFERRED_ASSIGN_TIME_VALIDATION",
          contractCode: validation.code,
        })
      );
    }

    diagnostics.push(
      Object.freeze({
        code: "TE_ADAPTER_MAPPED",
        matchCount: mappedMatches.length,
        courtCount: mappedCourts.length,
        lockCount: lockedAssignments.length,
      })
    );

    return Object.freeze({
      ok: true,
      adapterContractVersion,
      request: Object.freeze(plainRequest),
      failures: Object.freeze([]),
      diagnostics: Object.freeze(diagnostics),
      _inputSnapshot: Object.freeze(inputSnapshot),
    });
  } catch (err) {
    const code = isCourtAssignmentContractError(err)
      ? String(err.code)
      : TE_ADAPTER_MAPPING_CODE.CONTRACT_BUILD_FAILED;
    failures.push(
      createTeAdapterMappingFailure(
        TE_ADAPTER_MAPPING_CODE.CONTRACT_BUILD_FAILED,
        "failed to build CourtAssignmentRequest from mapped legacy input",
        { contractCode: code }
      )
    );
    return Object.freeze({
      ok: false,
      adapterContractVersion,
      request: null,
      failures: Object.freeze(failures),
      diagnostics: Object.freeze(diagnostics),
      _inputSnapshot: Object.freeze(inputSnapshot),
    });
  }
}
