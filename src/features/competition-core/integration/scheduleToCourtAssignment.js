/**
 * CORE-11 Phase 1H-B — certified Schedule → CORE-12 CourtAssignmentRequest handoff.
 *
 * Integration-layer only. Imports public CORE-11 and CORE-12 barrels exclusively.
 * Does not mutate schedule inputs, repair times, invent courts, or emit publication results.
 */

import {
  BASELINE_CANDIDATE_STATUS,
  CONSTRAINT_CERTIFICATION,
  CONSTRAINT_CERTIFICATION_RESULT_STATUS,
  FORBIDDEN_CANONICAL_ASSIGNMENT_FIELDS,
  asciiCompare,
  collectForbiddenAssignmentFieldPaths,
  fingerprintBaselineScheduleCandidate,
  fingerprintScheduleRequest,
  isValidIdentifier,
  normalizeIdentifier,
  stableSortByKeys,
  validateScheduleRequest,
} from "../schedule-engine/index.js";

import {
  CAPABILITY_MATCH_MODE,
  CORE12_COURT_ASSIGNMENT_SCHEMA_V1,
  CORE12_FINGERPRINT_VERSION,
  CORE12_POLICY_VERSION,
  COURT_ASSIGNMENT_STATUS,
  INVALID_LOCK_BEHAVIOR,
  OVERLAP_MODE,
  assignCourtsDeterministic,
  createCourtAssignmentPolicy,
  createCourtAssignmentRequest,
  createSnapshotRef,
  fingerprintValue,
  validateCourtAssignmentRequest,
} from "../court-assignment/index.js";

/** Integration result status literal. */
export const SCHEDULE_TO_COURT_ASSIGNMENT_HANDOFF_RESULT_STATUS =
  "SCHEDULE_TO_COURT_ASSIGNMENT_HANDOFF_RESULT";

/** Optional assignment orchestration result status. */
export const CERTIFIED_SCHEDULE_COURT_ASSIGNMENT_RESULT_STATUS =
  "CERTIFIED_SCHEDULE_COURT_ASSIGNMENT_RESULT";

/**
 * Integration-owned request fingerprint projection version.
 * Bump when assignment-semantic projection fields change.
 */
export const HANDOFF_REQUEST_FINGERPRINT_PROJECTION_VERSION =
  "CORE11_CORE12_HANDOFF_REQUEST_FP_V1";

/**
 * Result verification mode: Approach C — deterministic replay of
 * `assignCourtsDeterministic` (no invented conflicting result projection).
 */
export const HANDOFF_RESULT_FINGERPRINT_VERIFICATION =
  "DETERMINISTIC_ASSIGNMENT_REPLAY_V1";

/**
 * Availability snapshot trust model:
 * Model A — caller supplies canonical courts + trusted snapshot ref;
 * adapter validates shape only (does not prove Venue inventory authority).
 */
export const HANDOFF_AVAILABILITY_SNAPSHOT_TRUST_MODEL =
  "MODEL_A_EXTERNAL_AUTHORITATIVE_SNAPSHOT";

/**
 * Integration-owned diagnostic codes (ASCII-stable).
 * @type {Readonly<Record<string, string>>}
 */
export const HANDOFF_DIAGNOSTIC_CODE = Object.freeze({
  SCHEDULE_REQUEST_INVALID: "SCHEDULE_REQUEST_INVALID",
  SCHEDULE_NOT_CERTIFIED: "SCHEDULE_NOT_CERTIFIED",
  SCHEDULE_CANDIDATE_INCOMPLETE: "SCHEDULE_CANDIDATE_INCOMPLETE",
  SCHEDULE_CERTIFICATION_MISMATCH: "SCHEDULE_CERTIFICATION_MISMATCH",
  PHYSICAL_ASSIGNMENT_FIELD_PRESENT: "PHYSICAL_ASSIGNMENT_FIELD_PRESENT",
  COURT_SCOPE_MISSING: "COURT_SCOPE_MISSING",
  COURT_SCOPE_MISMATCH: "COURT_SCOPE_MISMATCH",
  COURT_SNAPSHOT_MISSING: "COURT_SNAPSHOT_MISSING",
  COURT_SNAPSHOT_INVALID: "COURT_SNAPSHOT_INVALID",
  AVAILABILITY_SNAPSHOT_MISSING: "AVAILABILITY_SNAPSHOT_MISSING",
  AVAILABILITY_SNAPSHOT_INVALID: "AVAILABILITY_SNAPSHOT_INVALID",
  COURT_ASSIGNMENT_POLICY_INVALID: "COURT_ASSIGNMENT_POLICY_INVALID",
  COURT_ASSIGNMENT_REQUEST_INVALID: "COURT_ASSIGNMENT_REQUEST_INVALID",
  COURT_ASSIGNMENT_FINGERPRINT_MISMATCH: "COURT_ASSIGNMENT_FINGERPRINT_MISMATCH",
  COURT_ASSIGNMENT_PARTIAL: "COURT_ASSIGNMENT_PARTIAL",
  COURT_ASSIGNMENT_INFEASIBLE: "COURT_ASSIGNMENT_INFEASIBLE",
  COURT_ASSIGNMENT_REJECTED: "COURT_ASSIGNMENT_REJECTED",
  COURT_ASSIGNMENT_RESULT_INVALID: "COURT_ASSIGNMENT_RESULT_INVALID",
  MATCH_MAPPING_INVALID: "MATCH_MAPPING_INVALID",
  COURT_REQUIREMENTS_INVALID: "COURT_REQUIREMENTS_INVALID",
  LOCKED_ASSIGNMENT_INVALID: "LOCKED_ASSIGNMENT_INVALID",
  DUPLICATE_COURT_ID: "DUPLICATE_COURT_ID",
  DUPLICATE_LOCK: "DUPLICATE_LOCK",
});

export const HANDOFF_DIAGNOSTIC_CODE_VALUES = Object.freeze(
  Object.values(HANDOFF_DIAGNOSTIC_CODE).sort(asciiCompare)
);

const SCHEDULE_SNAPSHOT_ID = "CORE11_BASELINE_SCHEDULE_CANDIDATE";
const SCHEDULE_SNAPSHOT_VERSION = "BASELINE_ONLY";

/**
 * @param {object} [partial]
 * @returns {{ code: string, path: string, message: string, details: Readonly<Record<string, unknown>> }}
 */
function createHandoffDiagnostic(partial = {}) {
  return Object.freeze({
    code: String(partial.code ?? HANDOFF_DIAGNOSTIC_CODE.SCHEDULE_REQUEST_INVALID),
    path: String(partial.path ?? ""),
    message: String(partial.message ?? partial.code ?? ""),
    details: Object.freeze(
      partial.details && typeof partial.details === "object" && !Array.isArray(partial.details)
        ? { ...partial.details }
        : {}
    ),
  });
}

/**
 * @param {readonly object[]} diagnostics
 * @returns {ReadonlyArray<object>}
 */
function sortHandoffDiagnostics(diagnostics) {
  const copy = Array.isArray(diagnostics) ? [...diagnostics] : [];
  copy.sort((a, b) => {
    const byCode = asciiCompare(a?.code, b?.code);
    if (byCode !== 0) return byCode;
    const byPath = asciiCompare(a?.path, b?.path);
    if (byPath !== 0) return byPath;
    return asciiCompare(a?.message, b?.message);
  });
  return Object.freeze(copy.map((d) => createHandoffDiagnostic(d)));
}

/**
 * Integration-private canonical projection for CORE-12 CourtAssignmentRequest
 * fingerprinting. Assignment-semantic fields only; excludes opaque metadata and
 * internal ms. Not part of the stable public integration barrel.
 *
 * Consumers must use `fingerprintCourtAssignmentRequest` only.
 *
 * requestId is excluded by default to avoid circular derivation:
 * semantic projection → semantic fingerprint → derive requestId → create request
 * → final handoff fingerprint (same semantic projection, still without requestId).
 *
 * @param {object} request
 * @param {{ includeRequestId?: boolean }} [options]
 * @returns {object}
 */
function projectCourtAssignmentRequestForFingerprint(
  request,
  options = {}
) {
  const includeRequestId = options.includeRequestId === true;
  const req = request && typeof request === "object" ? request : {};
  const policy = req.policy && typeof req.policy === "object" ? req.policy : {};
  const matches = Array.isArray(req.matches) ? req.matches : [];
  const courts = Array.isArray(req.courts) ? req.courts : [];
  const locks = Array.isArray(req.lockedAssignments) ? req.lockedAssignments : [];
  const constraints = Array.isArray(req.constraints) ? req.constraints : [];

  // Preserve duplicate matchIds in projection order for fingerprint stability;
  // validation fails closed on duplicates before create. Sort is stable by id.
  const projectedMatches = stableSortByKeys(
    matches.map((m, index) => ({
      _order: index,
      matchId: normalizeIdentifier(m.matchId),
      competitionId: normalizeIdentifier(m.competitionId),
      tenantId: m.tenantId == null ? null : normalizeIdentifier(m.tenantId),
      clubId: m.clubId == null ? null : normalizeIdentifier(m.clubId),
      venueId: m.venueId == null ? null : normalizeIdentifier(m.venueId),
      scheduledStart: m.scheduledStart == null ? null : String(m.scheduledStart),
      scheduledEnd: m.scheduledEnd == null ? null : String(m.scheduledEnd),
      civilWindow:
        m.civilWindow == null
          ? null
          : {
              date: normalizeIdentifier(m.civilWindow.date),
              startTime: normalizeIdentifier(m.civilWindow.startTime),
              endTime: normalizeIdentifier(m.civilWindow.endTime),
            },
      timezone: m.timezone == null ? null : normalizeIdentifier(m.timezone),
      durationMinutes:
        typeof m.durationMinutes === "number" ? m.durationMinutes : null,
      status: m.status == null ? null : normalizeIdentifier(m.status),
      priority: typeof m.priority === "number" ? m.priority : 0,
      stage: m.stage == null ? null : normalizeIdentifier(m.stage),
      requiredCapabilities: projectCapabilities(m.requiredCapabilities),
      existingCourtId:
        m.existingCourtId == null
          ? null
          : normalizeIdentifier(m.existingCourtId),
      manualCourtLock: m.manualCourtLock === true,
      isBye: m.isBye === true,
    })),
    (m) => [m.matchId, String(m._order)]
  ).map(({ _order, ...rest }) => rest);

  const projectedCourts = stableSortByKeys(
    courts.map((c, index) => ({
      _order: index,
      courtId: normalizeIdentifier(c.courtId),
      tenantId: c.tenantId == null ? null : normalizeIdentifier(c.tenantId),
      venueId: normalizeIdentifier(c.venueId),
      clubId: normalizeIdentifier(c.clubId),
      availabilityStatus: normalizeIdentifier(c.availabilityStatus),
      active: c.active !== false,
      eligible: c.eligible !== false,
      unavailableReasons: Array.isArray(c.unavailableReasons)
        ? [...c.unavailableReasons].map(String).sort(asciiCompare)
        : [],
      capabilities: projectCapabilities(c.capabilities),
      priority: typeof c.priority === "number" ? c.priority : 0,
      availabilityIntervals: stableSortByKeys(
        (Array.isArray(c.availabilityIntervals)
          ? c.availabilityIntervals
          : []
        ).map((iv) => ({
          start: String(iv.start),
          end: String(iv.end),
        })),
        (iv) => [iv.start, iv.end]
      ),
    })),
    (c) => [c.courtId, String(c._order)]
  ).map(({ _order, ...rest }) => rest);

  const projectedLocks = stableSortByKeys(
    locks.map((l, index) => ({
      _order: index,
      matchId: normalizeIdentifier(l.matchId),
      courtId: normalizeIdentifier(l.courtId),
      lockSource: normalizeIdentifier(l.lockSource),
      reason: l.reason == null ? null : String(l.reason),
      overrideAllowed: l.overrideAllowed === true,
    })),
    (l) => [l.matchId, l.courtId, String(l._order)]
  ).map(({ _order, ...rest }) => rest);

  const projectedConstraints = stableSortByKeys(
    constraints.map((c, index) => ({
      _order: index,
      constraintId: normalizeIdentifier(c.constraintId),
      kind: normalizeIdentifier(c.kind),
      code: normalizeIdentifier(c.code),
      matchId: c.matchId == null ? null : normalizeIdentifier(c.matchId),
      courtId: c.courtId == null ? null : normalizeIdentifier(c.courtId),
    })),
    (c) => [c.constraintId, String(c._order)]
  ).map(({ _order, ...rest }) => rest);

  /** @type {Record<string, unknown>} */
  const projection = {
    handoffRequestFingerprintProjectionVersion:
      HANDOFF_REQUEST_FINGERPRINT_PROJECTION_VERSION,
    schemaVersion: normalizeIdentifier(req.schemaVersion),
    tenantId: normalizeIdentifier(req.tenantId),
    clubId: normalizeIdentifier(req.clubId),
    venueId: normalizeIdentifier(req.venueId),
    competitionId: normalizeIdentifier(req.competitionId),
    timezone: req.timezone == null ? null : normalizeIdentifier(req.timezone),
    matches: projectedMatches,
    courts: projectedCourts,
    lockedAssignments: projectedLocks,
    constraints: projectedConstraints,
    policy: {
      policyId: normalizeIdentifier(policy.policyId),
      policyVersion: normalizeIdentifier(policy.policyVersion),
      partialAssignmentAllowed: policy.partialAssignmentAllowed === true,
      overrideManualLocks: policy.overrideManualLocks === true,
      acceptLockedAssignments: policy.acceptLockedAssignments !== false,
      invalidLockBehavior: normalizeIdentifier(policy.invalidLockBehavior),
      allowUnscheduledMatches: policy.allowUnscheduledMatches === true,
      skipTerminalStatuses: policy.skipTerminalStatuses !== false,
      terminalStatuses: Array.isArray(policy.terminalStatuses)
        ? [...policy.terminalStatuses].map(String).sort(asciiCompare)
        : [],
      matchOrderingStrategy: normalizeIdentifier(policy.matchOrderingStrategy),
      courtOrderingStrategy: normalizeIdentifier(policy.courtOrderingStrategy),
      requireVenueTimezone: policy.requireVenueTimezone !== false,
      requireAvailabilitySnapshot: policy.requireAvailabilitySnapshot !== false,
      capabilityMatchMode: normalizeIdentifier(policy.capabilityMatchMode),
      overlapMode: normalizeIdentifier(policy.overlapMode),
      comparatorVersion: normalizeIdentifier(policy.comparatorVersion),
      courtSelectionStrategyVersion: normalizeIdentifier(
        policy.courtSelectionStrategyVersion
      ),
    },
    seed: req.seed == null ? null : String(req.seed),
    scheduleSnapshotRef: projectSnapshotRef(req.scheduleSnapshotRef),
    availabilitySnapshotRef: projectSnapshotRef(req.availabilitySnapshotRef),
    fingerprintAlgorithmVersion: CORE12_FINGERPRINT_VERSION,
  };

  if (includeRequestId) {
    projection.requestId = normalizeIdentifier(req.requestId);
  }

  return projection;
}

/**
 * @param {unknown} caps
 */
function projectCapabilities(caps) {
  if (caps == null) return null;
  if (Array.isArray(caps)) {
    return [...caps].map(String).sort(asciiCompare);
  }
  if (typeof caps === "object") {
    /** @type {Record<string, unknown>} */
    const out = {};
    for (const key of Object.keys(caps).sort(asciiCompare)) {
      out[key] = /** @type {Record<string, unknown>} */ (caps)[key];
    }
    return out;
  }
  return null;
}

/**
 * @param {unknown} ref
 */
function projectSnapshotRef(ref) {
  if (ref == null || typeof ref !== "object") return null;
  const r = /** @type {Record<string, unknown>} */ (ref);
  return {
    snapshotId: normalizeIdentifier(r.snapshotId),
    snapshotVersion: normalizeIdentifier(r.snapshotVersion),
    fingerprint: normalizeIdentifier(r.fingerprint),
  };
}

/**
 * @param {object} request
 * @returns {string}
 */
export function fingerprintCourtAssignmentRequest(request) {
  return fingerprintValue(
    projectCourtAssignmentRequestForFingerprint(request, {
      includeRequestId: false,
    })
  );
}

/**
 * Strip CORE-12 factory internal fields so the request can be re-fed to
 * `createCourtAssignmentRequest` / `assignCourtsDeterministic`.
 *
 * @param {object} normalized
 * @returns {object}
 */
function toPlainCourtAssignmentRequest(normalized) {
  const req = normalized && typeof normalized === "object" ? normalized : {};
  return {
    schemaVersion: req.schemaVersion,
    requestId: req.requestId,
    tenantId: req.tenantId,
    clubId: req.clubId,
    venueId: req.venueId,
    competitionId: req.competitionId,
    timezone: req.timezone,
    matches: (Array.isArray(req.matches) ? req.matches : []).map((m) => ({
      matchId: m.matchId,
      competitionId: m.competitionId,
      tenantId: m.tenantId,
      clubId: m.clubId,
      venueId: m.venueId,
      scheduledStart: m.scheduledStart,
      scheduledEnd: m.scheduledEnd,
      civilWindow: m.civilWindow,
      timezone: m.timezone,
      durationMinutes: m.durationMinutes,
      status: m.status,
      priority: m.priority,
      stage: m.stage,
      requiredCapabilities: m.requiredCapabilities,
      existingCourtId: m.existingCourtId,
      manualCourtLock: m.manualCourtLock,
      isBye: m.isBye,
      metadata: m.metadata,
    })),
    courts: (Array.isArray(req.courts) ? req.courts : []).map((c) => ({
      courtId: c.courtId,
      tenantId: c.tenantId,
      venueId: c.venueId,
      clubId: c.clubId,
      availabilityStatus: c.availabilityStatus,
      active: c.active,
      eligible: c.eligible,
      unavailableReasons: c.unavailableReasons,
      capabilities: c.capabilities,
      priority: c.priority,
      availabilityIntervals: (Array.isArray(c.availabilityIntervals)
        ? c.availabilityIntervals
        : []
      ).map((iv) => ({
        start: iv.start,
        end: iv.end,
      })),
      availabilityWindows: c.availabilityWindows,
      metadata: c.metadata,
    })),
    lockedAssignments: Array.isArray(req.lockedAssignments)
      ? req.lockedAssignments.map((l) => ({
          matchId: l.matchId,
          courtId: l.courtId,
          lockSource: l.lockSource,
          reason: l.reason,
          overrideAllowed: l.overrideAllowed,
        }))
      : [],
    constraints: Array.isArray(req.constraints)
      ? req.constraints.map((c) => ({
          constraintId: c.constraintId,
          kind: c.kind,
          code: c.code,
          matchId: c.matchId,
          courtId: c.courtId,
          params: c.params,
          message: c.message,
        }))
      : [],
    policy: req.policy
      ? {
          policyId: req.policy.policyId,
          policyVersion: req.policy.policyVersion,
          partialAssignmentAllowed: req.policy.partialAssignmentAllowed,
          overrideManualLocks: req.policy.overrideManualLocks,
          acceptLockedAssignments: req.policy.acceptLockedAssignments,
          invalidLockBehavior: req.policy.invalidLockBehavior,
          allowUnscheduledMatches: req.policy.allowUnscheduledMatches,
          skipTerminalStatuses: req.policy.skipTerminalStatuses,
          terminalStatuses: req.policy.terminalStatuses,
          matchOrderingStrategy: req.policy.matchOrderingStrategy,
          courtOrderingStrategy: req.policy.courtOrderingStrategy,
          requireVenueTimezone: req.policy.requireVenueTimezone,
          requireAvailabilitySnapshot: req.policy.requireAvailabilitySnapshot,
          capabilityMatchMode: req.policy.capabilityMatchMode,
          overlapMode: req.policy.overlapMode,
          comparatorVersion: req.policy.comparatorVersion,
          courtSelectionStrategyVersion:
            req.policy.courtSelectionStrategyVersion,
        }
      : undefined,
    seed: req.seed,
    scheduleSnapshotRef: req.scheduleSnapshotRef
      ? {
          snapshotId: req.scheduleSnapshotRef.snapshotId,
          snapshotVersion: req.scheduleSnapshotRef.snapshotVersion,
          fingerprint: req.scheduleSnapshotRef.fingerprint,
        }
      : null,
    availabilitySnapshotRef: req.availabilitySnapshotRef
      ? {
          snapshotId: req.availabilitySnapshotRef.snapshotId,
          snapshotVersion: req.availabilitySnapshotRef.snapshotVersion,
          fingerprint: req.availabilitySnapshotRef.fingerprint,
        }
      : null,
    metadata: req.metadata,
  };
}

/**
 * Result fingerprint verification uses Approach C only:
 * re-run public `assignCourtsDeterministic` and compare `resultFingerprint`
 * plus semantic partition/times. No invented conflicting result projection.
 */

/**
 * @param {number} minutes
 * @returns {string}
 */
function minutesToHhMm(minutes) {
  const m = Number(minutes);
  const hh = Math.floor(m / 60);
  const mm = m % 60;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

/**
 * @param {unknown} iso
 * @param {unknown} ms
 * @param {string} path
 * @param {object[]} diagnostics
 * @returns {{ ok: true, iso: string, ms: number } | { ok: false }}
 */
function resolveAbsoluteInstant(iso, ms, path, diagnostics) {
  let fromIso = null;
  let fromMs = null;

  if (iso != null && String(iso).trim() !== "") {
    const text = String(iso).trim();
    const parsed = Date.parse(text);
    if (!Number.isFinite(parsed)) {
      diagnostics.push(
        createHandoffDiagnostic({
          code: HANDOFF_DIAGNOSTIC_CODE.MATCH_MAPPING_INVALID,
          path,
          message: `${path} ISO instant is not finite`,
          details: { iso: text },
        })
      );
      return { ok: false };
    }
    fromIso = { iso: text, ms: parsed };
  }

  if (ms != null && ms !== "") {
    const n = Number(ms);
    if (!Number.isFinite(n)) {
      diagnostics.push(
        createHandoffDiagnostic({
          code: HANDOFF_DIAGNOSTIC_CODE.MATCH_MAPPING_INVALID,
          path,
          message: `${path} UTC milliseconds is not finite`,
          details: { ms },
        })
      );
      return { ok: false };
    }
    fromMs = { iso: new Date(n).toISOString(), ms: n };
  }

  if (!fromIso && !fromMs) {
    diagnostics.push(
      createHandoffDiagnostic({
        code: HANDOFF_DIAGNOSTIC_CODE.MATCH_MAPPING_INVALID,
        path,
        message: `${path} requires start/end ISO or UTC milliseconds`,
        details: {},
      })
    );
    return { ok: false };
  }

  if (fromIso && fromMs && fromIso.ms !== fromMs.ms) {
    diagnostics.push(
      createHandoffDiagnostic({
        code: HANDOFF_DIAGNOSTIC_CODE.MATCH_MAPPING_INVALID,
        path,
        message: `${path} ISO and UTC milliseconds disagree`,
        details: { iso: fromIso.iso, ms: fromMs.ms },
      })
    );
    return { ok: false };
  }

  if (fromIso) return { ok: true, iso: fromIso.iso, ms: fromIso.ms };
  return { ok: true, iso: /** @type {{iso:string,ms:number}} */ (fromMs).iso, ms: /** @type {{iso:string,ms:number}} */ (fromMs).ms };
}

/**
 * @param {object} args
 */
function emptyMappingSummary() {
  return Object.freeze({
    sourceScheduledMatchCount: 0,
    mappedMatchCount: 0,
    byeCount: 0,
    courtCount: 0,
    lockedAssignmentCount: 0,
  });
}

/**
 * @param {object} partial
 */
function createHandoffResult(partial = {}) {
  return Object.freeze({
    ok: partial.ok === true,
    status: SCHEDULE_TO_COURT_ASSIGNMENT_HANDOFF_RESULT_STATUS,
    courtAssignmentRequest:
      partial.ok === true ? partial.courtAssignmentRequest ?? null : null,
    courtAssignmentResult: null,
    diagnostics: sortHandoffDiagnostics(partial.diagnostics ?? []),
    mappingSummary: Object.freeze({
      ...emptyMappingSummary(),
      ...(partial.mappingSummary || {}),
    }),
    replay: Object.freeze({
      sourceScheduleRequestFingerprint:
        partial.replay?.sourceScheduleRequestFingerprint ?? "",
      sourceScheduleCandidateFingerprint:
        partial.replay?.sourceScheduleCandidateFingerprint ?? "",
      sourceCertificationFingerprint:
        partial.replay?.sourceCertificationFingerprint ?? "",
      courtAssignmentRequestFingerprint:
        partial.replay?.courtAssignmentRequestFingerprint ?? "",
      handoffRequestFingerprintProjectionVersion:
        HANDOFF_REQUEST_FINGERPRINT_PROJECTION_VERSION,
      availabilitySnapshotTrustModel: HANDOFF_AVAILABILITY_SNAPSHOT_TRUST_MODEL,
      resultFingerprintVerification: HANDOFF_RESULT_FINGERPRINT_VERIFICATION,
    }),
  });
}

/**
 * @param {unknown} scope
 * @param {object[]} diagnostics
 * @returns {{ ok: true, scope: { tenantId: string, clubId: string, venueId: string } } | { ok: false }}
 */
function validateScope(scope, diagnostics) {
  if (scope == null || typeof scope !== "object" || Array.isArray(scope)) {
    diagnostics.push(
      createHandoffDiagnostic({
        code: HANDOFF_DIAGNOSTIC_CODE.COURT_SCOPE_MISSING,
        path: "scope",
        message: "scope must be an explicit object with tenantId, clubId, venueId",
      })
    );
    return { ok: false };
  }
  const s = /** @type {Record<string, unknown>} */ (scope);
  const tenantId = normalizeIdentifier(s.tenantId);
  const clubId = normalizeIdentifier(s.clubId);
  const venueId = normalizeIdentifier(s.venueId);
  if (!tenantId) {
    diagnostics.push(
      createHandoffDiagnostic({
        code: HANDOFF_DIAGNOSTIC_CODE.COURT_SCOPE_MISSING,
        path: "scope.tenantId",
        message: "tenantId is required",
      })
    );
  }
  if (!clubId) {
    diagnostics.push(
      createHandoffDiagnostic({
        code: HANDOFF_DIAGNOSTIC_CODE.COURT_SCOPE_MISSING,
        path: "scope.clubId",
        message: "clubId is required",
      })
    );
  }
  if (!venueId) {
    diagnostics.push(
      createHandoffDiagnostic({
        code: HANDOFF_DIAGNOSTIC_CODE.COURT_SCOPE_MISSING,
        path: "scope.venueId",
        message: "venueId is required",
      })
    );
  }
  if (!tenantId || !clubId || !venueId) return { ok: false };
  return { ok: true, scope: { tenantId, clubId, venueId } };
}

/**
 * @param {unknown} value
 * @param {string} label
 * @param {object[]} diagnostics
 */
function rejectForbiddenPhysicalFields(value, label, diagnostics) {
  const hits = collectForbiddenAssignmentFieldPaths(value);
  if (hits.length === 0) return true;
  for (const hit of stableSortByKeys(hits, (h) => [h.path, h.field])) {
    diagnostics.push(
      createHandoffDiagnostic({
        code: HANDOFF_DIAGNOSTIC_CODE.PHYSICAL_ASSIGNMENT_FIELD_PRESENT,
        path: `${label}.${hit.path}`,
        message: `Forbidden physical assignment field present: ${hit.field}`,
        details: {
          field: hit.field,
          path: hit.path,
          forbidden: [...FORBIDDEN_CANONICAL_ASSIGNMENT_FIELDS].sort(asciiCompare),
        },
      })
    );
  }
  return false;
}

/**
 * Certified-schedule gate + CORE-12 CourtAssignmentRequest construction.
 *
 * @param {object} [input]
 * @returns {object}
 */
export function createCourtAssignmentRequestFromCertifiedSchedule(input = {}) {
  /** @type {object[]} */
  const diagnostics = [];
  const push = (partial) => diagnostics.push(createHandoffDiagnostic(partial));

  const fail = (replay = {}, summary = emptyMappingSummary()) =>
    createHandoffResult({
      ok: false,
      diagnostics,
      mappingSummary: summary,
      replay,
    });

  // --- Scope ---
  const scopeResult = validateScope(input.scope, diagnostics);
  if (!scopeResult.ok) return fail();
  const scope = scopeResult.scope;

  // --- ScheduleRequest validation ---
  const requestValidation = validateScheduleRequest(input.scheduleRequest);
  if (!requestValidation.ok || !requestValidation.request) {
    push({
      code: HANDOFF_DIAGNOSTIC_CODE.SCHEDULE_REQUEST_INVALID,
      path: "scheduleRequest",
      message: "ScheduleRequest failed public CORE-11 validation",
      details: {
        diagnosticCodes: (requestValidation.diagnostics || []).map((d) => d.code),
      },
    });
    return fail();
  }
  // Use the caller-supplied live request for certification replay matching.
  // validateScheduleRequest may normalize windowIds and must not alter the
  // fingerprint compared to the Phase 1F certification input.
  const scheduleRequest =
    input.scheduleRequest &&
    typeof input.scheduleRequest === "object" &&
    !Array.isArray(input.scheduleRequest)
      ? /** @type {Record<string, any>} */ (input.scheduleRequest)
      : requestValidation.request;

  if (!rejectForbiddenPhysicalFields(scheduleRequest, "scheduleRequest", diagnostics)) {
    return fail();
  }

  let sourceScheduleRequestFingerprint = "";
  try {
    sourceScheduleRequestFingerprint = fingerprintScheduleRequest(scheduleRequest);
  } catch (err) {
    push({
      code: HANDOFF_DIAGNOSTIC_CODE.SCHEDULE_REQUEST_INVALID,
      path: "scheduleRequest",
      message: "ScheduleRequest fingerprint failed",
      details: { name: err instanceof Error ? err.name : "Error" },
    });
    return fail();
  }

  if (!isValidIdentifier(scheduleRequest.competitionId)) {
    push({
      code: HANDOFF_DIAGNOSTIC_CODE.SCHEDULE_REQUEST_INVALID,
      path: "scheduleRequest.competitionId",
      message: "competitionId must be a non-empty trimmed string",
    });
    return fail({ sourceScheduleRequestFingerprint });
  }
  if (!isValidIdentifier(scheduleRequest.timezone)) {
    push({
      code: HANDOFF_DIAGNOSTIC_CODE.SCHEDULE_REQUEST_INVALID,
      path: "scheduleRequest.timezone",
      message: "timezone must be a non-empty IANA timezone",
    });
    return fail({ sourceScheduleRequestFingerprint });
  }

  // --- Candidate ---
  const candidate = input.candidate;
  if (candidate == null || typeof candidate !== "object" || Array.isArray(candidate)) {
    push({
      code: HANDOFF_DIAGNOSTIC_CODE.SCHEDULE_NOT_CERTIFIED,
      path: "candidate",
      message: "Baseline candidate must be a plain object",
    });
    return fail({ sourceScheduleRequestFingerprint });
  }

  if (!rejectForbiddenPhysicalFields(candidate, "candidate", diagnostics)) {
    return fail({ sourceScheduleRequestFingerprint });
  }

  const cand = /** @type {Record<string, unknown>} */ (candidate);
  const plan =
    cand.plan && typeof cand.plan === "object" && !Array.isArray(cand.plan)
      ? /** @type {Record<string, unknown>} */ (cand.plan)
      : cand;

  const candidateStatus = normalizeIdentifier(cand.status);
  if (candidateStatus !== BASELINE_CANDIDATE_STATUS) {
    push({
      code: HANDOFF_DIAGNOSTIC_CODE.SCHEDULE_NOT_CERTIFIED,
      path: "candidate.status",
      message: `candidate.status must be ${BASELINE_CANDIDATE_STATUS}`,
      details: { status: candidateStatus },
    });
    return fail({ sourceScheduleRequestFingerprint });
  }

  const candidateCertification = normalizeIdentifier(cand.constraintCertification);
  if (candidateCertification !== CONSTRAINT_CERTIFICATION.BASELINE_ONLY) {
    push({
      code: HANDOFF_DIAGNOSTIC_CODE.SCHEDULE_NOT_CERTIFIED,
      path: "candidate.constraintCertification",
      message: `candidate.constraintCertification must be ${CONSTRAINT_CERTIFICATION.BASELINE_ONLY}`,
      details: { constraintCertification: candidateCertification },
    });
    return fail({ sourceScheduleRequestFingerprint });
  }

  const planCompetitionId = normalizeIdentifier(plan.competitionId);
  if (planCompetitionId !== scheduleRequest.competitionId) {
    push({
      code: HANDOFF_DIAGNOSTIC_CODE.SCHEDULE_CERTIFICATION_MISMATCH,
      path: "candidate.plan.competitionId",
      message: "Candidate competitionId does not match ScheduleRequest",
      details: {
        requestCompetitionId: scheduleRequest.competitionId,
        candidateCompetitionId: planCompetitionId,
      },
    });
    return fail({ sourceScheduleRequestFingerprint });
  }

  let sourceScheduleCandidateFingerprint = "";
  try {
    sourceScheduleCandidateFingerprint =
      fingerprintBaselineScheduleCandidate(candidate);
  } catch (err) {
    push({
      code: HANDOFF_DIAGNOSTIC_CODE.SCHEDULE_NOT_CERTIFIED,
      path: "candidate",
      message: "Candidate fingerprint failed",
      details: { name: err instanceof Error ? err.name : "Error" },
    });
    return fail({ sourceScheduleRequestFingerprint });
  }

  const scheduled = Array.isArray(plan.scheduled) ? [...plan.scheduled] : [];
  const unscheduled = Array.isArray(plan.unscheduled) ? [...plan.unscheduled] : [];

  const requestMatchById = new Map(
    (scheduleRequest.matches || []).map((m) => [m.matchId, m])
  );

  /** @type {Set<string>} */
  const scheduledIds = new Set();
  for (let i = 0; i < scheduled.length; i += 1) {
    const row = scheduled[i];
    if (row == null || typeof row !== "object") {
      push({
        code: HANDOFF_DIAGNOSTIC_CODE.SCHEDULE_CANDIDATE_INCOMPLETE,
        path: `candidate.plan.scheduled[${i}]`,
        message: "Scheduled match must be an object",
      });
      continue;
    }
    const matchId = normalizeIdentifier(
      /** @type {Record<string, unknown>} */ (row).matchId
    );
    if (!matchId) {
      push({
        code: HANDOFF_DIAGNOSTIC_CODE.SCHEDULE_CANDIDATE_INCOMPLETE,
        path: `candidate.plan.scheduled[${i}].matchId`,
        message: "Scheduled matchId is required",
      });
      continue;
    }
    if (scheduledIds.has(matchId)) {
      push({
        code: HANDOFF_DIAGNOSTIC_CODE.SCHEDULE_CANDIDATE_INCOMPLETE,
        path: `candidate.plan.scheduled[${i}].matchId`,
        message: `Duplicate scheduled matchId: ${matchId}`,
        details: { matchId },
      });
      continue;
    }
    scheduledIds.add(matchId);
    if (!requestMatchById.has(matchId)) {
      push({
        code: HANDOFF_DIAGNOSTIC_CODE.SCHEDULE_CANDIDATE_INCOMPLETE,
        path: `candidate.plan.scheduled[${i}].matchId`,
        message: `Scheduled match is unknown to ScheduleRequest: ${matchId}`,
        details: { matchId },
      });
    }
  }

  for (let i = 0; i < unscheduled.length; i += 1) {
    const row = unscheduled[i];
    if (row == null || typeof row !== "object") continue;
    const matchId = normalizeIdentifier(
      /** @type {Record<string, unknown>} */ (row).matchId
    );
    const source = requestMatchById.get(matchId);
    if (source && source.isBye === true) continue;
    push({
      code: HANDOFF_DIAGNOSTIC_CODE.SCHEDULE_CANDIDATE_INCOMPLETE,
      path: `candidate.plan.unscheduled[${i}]`,
      message: `Non-bye match remains unscheduled: ${matchId || "(missing)"}`,
      details: { matchId },
    });
  }

  if (diagnostics.length > 0) {
    return fail({
      sourceScheduleRequestFingerprint,
      sourceScheduleCandidateFingerprint,
    });
  }

  // --- Phase 1F certification ---
  const certificationResult = input.certificationResult;
  if (
    certificationResult == null ||
    typeof certificationResult !== "object" ||
    Array.isArray(certificationResult)
  ) {
    push({
      code: HANDOFF_DIAGNOSTIC_CODE.SCHEDULE_NOT_CERTIFIED,
      path: "certificationResult",
      message: "Phase 1F certification result is required",
    });
    return fail({
      sourceScheduleRequestFingerprint,
      sourceScheduleCandidateFingerprint,
    });
  }

  const cert = /** @type {Record<string, unknown>} */ (certificationResult);
  if (normalizeIdentifier(cert.status) !== CONSTRAINT_CERTIFICATION_RESULT_STATUS) {
    push({
      code: HANDOFF_DIAGNOSTIC_CODE.SCHEDULE_NOT_CERTIFIED,
      path: "certificationResult.status",
      message: `certificationResult.status must be ${CONSTRAINT_CERTIFICATION_RESULT_STATUS}`,
      details: { status: cert.status },
    });
  }
  if (
    normalizeIdentifier(cert.certification) !==
    CONSTRAINT_CERTIFICATION.HARD_CONSTRAINTS_CERTIFIED
  ) {
    push({
      code: HANDOFF_DIAGNOSTIC_CODE.SCHEDULE_NOT_CERTIFIED,
      path: "certificationResult.certification",
      message: `certificationResult.certification must be ${CONSTRAINT_CERTIFICATION.HARD_CONSTRAINTS_CERTIFIED}`,
      details: { certification: cert.certification },
    });
  }
  if (cert.ok !== true) {
    push({
      code: HANDOFF_DIAGNOSTIC_CODE.SCHEDULE_NOT_CERTIFIED,
      path: "certificationResult.ok",
      message: "certificationResult.ok must be true",
    });
  }

  const violations = Array.isArray(cert.violations) ? cert.violations : [];
  if (violations.length > 0) {
    push({
      code: HANDOFF_DIAGNOSTIC_CODE.SCHEDULE_NOT_CERTIFIED,
      path: "certificationResult.violations",
      message: "Hard constraint violations remain on certification result",
      details: { count: violations.length },
    });
  }

  const replayMeta =
    cert.replay && typeof cert.replay === "object"
      ? /** @type {Record<string, unknown>} */ (cert.replay)
      : {};
  const replayRequestFp = normalizeIdentifier(replayMeta.inputFingerprint);
  const replayCandidateFp = normalizeIdentifier(replayMeta.resultFingerprint);

  if (
    !replayRequestFp ||
    replayRequestFp !== sourceScheduleRequestFingerprint
  ) {
    push({
      code: HANDOFF_DIAGNOSTIC_CODE.SCHEDULE_CERTIFICATION_MISMATCH,
      path: "certificationResult.replay.inputFingerprint",
      message: "Live ScheduleRequest fingerprint does not match certification replay",
      details: {
        live: sourceScheduleRequestFingerprint,
        replay: replayRequestFp,
      },
    });
  }
  if (
    !replayCandidateFp ||
    replayCandidateFp !== sourceScheduleCandidateFingerprint
  ) {
    push({
      code: HANDOFF_DIAGNOSTIC_CODE.SCHEDULE_CERTIFICATION_MISMATCH,
      path: "certificationResult.replay.resultFingerprint",
      message: "Live candidate fingerprint does not match certification replay",
      details: {
        live: sourceScheduleCandidateFingerprint,
        replay: replayCandidateFp,
      },
    });
  }

  const sourceCertificationFingerprint = fingerprintValue({
    status: normalizeIdentifier(cert.status),
    certification: normalizeIdentifier(cert.certification),
    ok: cert.ok === true,
    inputFingerprint: replayRequestFp,
    resultFingerprint: replayCandidateFp,
  });

  if (diagnostics.length > 0) {
    return fail({
      sourceScheduleRequestFingerprint,
      sourceScheduleCandidateFingerprint,
      sourceCertificationFingerprint,
    });
  }

  // --- Courts ---
  if (!Array.isArray(input.courts)) {
    push({
      code: HANDOFF_DIAGNOSTIC_CODE.COURT_SNAPSHOT_MISSING,
      path: "courts",
      message: "courts must be an array of canonical AvailableCourtInput records",
    });
    return fail({
      sourceScheduleRequestFingerprint,
      sourceScheduleCandidateFingerprint,
      sourceCertificationFingerprint,
    });
  }

  const courtsInput = [...input.courts];
  const assignableScheduledCount = scheduled.filter((row) => {
    const id = normalizeIdentifier(
      row && typeof row === "object"
        ? /** @type {Record<string, unknown>} */ (row).matchId
        : ""
    );
    const src = requestMatchById.get(id);
    return !(src && src.isBye === true);
  }).length;

  if (courtsInput.length === 0 && assignableScheduledCount > 0) {
    push({
      code: HANDOFF_DIAGNOSTIC_CODE.COURT_SNAPSHOT_MISSING,
      path: "courts",
      message: "Empty court snapshot is not allowed for assignable schedules",
    });
    return fail({
      sourceScheduleRequestFingerprint,
      sourceScheduleCandidateFingerprint,
      sourceCertificationFingerprint,
    });
  }

  for (let i = 0; i < courtsInput.length; i += 1) {
    const court = courtsInput[i];
    if (court == null || typeof court !== "object" || Array.isArray(court)) {
      push({
        code: HANDOFF_DIAGNOSTIC_CODE.COURT_SNAPSHOT_INVALID,
        path: `courts[${i}]`,
        message: "Court snapshot entry must be an object",
      });
      continue;
    }
    const c = /** @type {Record<string, unknown>} */ (court);
    const courtId = normalizeIdentifier(c.courtId);
    if (!courtId) {
      push({
        code: HANDOFF_DIAGNOSTIC_CODE.COURT_SNAPSHOT_INVALID,
        path: `courts[${i}].courtId`,
        message: "courtId is required",
      });
    }
    if (normalizeIdentifier(c.venueId) !== scope.venueId) {
      push({
        code: HANDOFF_DIAGNOSTIC_CODE.COURT_SCOPE_MISMATCH,
        path: `courts[${i}].venueId`,
        message: "Court venueId must equal explicit scope.venueId",
        details: { venueId: c.venueId, expected: scope.venueId },
      });
    }
    if (normalizeIdentifier(c.clubId) !== scope.clubId) {
      push({
        code: HANDOFF_DIAGNOSTIC_CODE.COURT_SCOPE_MISMATCH,
        path: `courts[${i}].clubId`,
        message: "Court clubId must equal explicit scope.clubId",
        details: { clubId: c.clubId, expected: scope.clubId },
      });
    }
    if (
      c.tenantId != null &&
      normalizeIdentifier(c.tenantId) !== scope.tenantId
    ) {
      push({
        code: HANDOFF_DIAGNOSTIC_CODE.COURT_SCOPE_MISMATCH,
        path: `courts[${i}].tenantId`,
        message: "Court tenantId must equal explicit scope.tenantId when present",
        details: { tenantId: c.tenantId, expected: scope.tenantId },
      });
    }
  }

  // Validate duplicate court IDs before sort (fail closed; no silent dedupe).
  /** @type {Map<string, number>} */
  const courtIdFirstIndex = new Map();
  for (let i = 0; i < courtsInput.length; i += 1) {
    const court = courtsInput[i];
    if (court == null || typeof court !== "object" || Array.isArray(court)) {
      continue;
    }
    const courtId = normalizeIdentifier(
      /** @type {Record<string, unknown>} */ (court).courtId
    );
    if (!courtId) continue;
    if (courtIdFirstIndex.has(courtId)) {
      push({
        code: HANDOFF_DIAGNOSTIC_CODE.DUPLICATE_COURT_ID,
        path: `courts[${i}].courtId`,
        message: `Duplicate courtId: ${courtId}`,
        details: {
          courtId,
          firstIndex: courtIdFirstIndex.get(courtId),
          duplicateIndex: i,
        },
      });
    } else {
      courtIdFirstIndex.set(courtId, i);
    }
  }

  if (diagnostics.length > 0) {
    return fail({
      sourceScheduleRequestFingerprint,
      sourceScheduleCandidateFingerprint,
      sourceCertificationFingerprint,
    });
  }

  // --- Availability snapshot ---
  if (input.availabilitySnapshotRef == null) {
    push({
      code: HANDOFF_DIAGNOSTIC_CODE.AVAILABILITY_SNAPSHOT_MISSING,
      path: "availabilitySnapshotRef",
      message: "availabilitySnapshotRef is required for certified handoff",
    });
    return fail({
      sourceScheduleRequestFingerprint,
      sourceScheduleCandidateFingerprint,
      sourceCertificationFingerprint,
    });
  }

  let availabilitySnapshotRef;
  try {
    availabilitySnapshotRef = createSnapshotRef(input.availabilitySnapshotRef);
  } catch (err) {
    push({
      code: HANDOFF_DIAGNOSTIC_CODE.AVAILABILITY_SNAPSHOT_INVALID,
      path: "availabilitySnapshotRef",
      message:
        err instanceof Error
          ? err.message
          : "availabilitySnapshotRef is invalid",
      details: {
        code:
          err && typeof err === "object" && "code" in err
            ? /** @type {{ code?: unknown }} */ (err).code
            : undefined,
      },
    });
    return fail({
      sourceScheduleRequestFingerprint,
      sourceScheduleCandidateFingerprint,
      sourceCertificationFingerprint,
    });
  }

  // --- Policy ---
  const policyPartial =
    input.courtAssignmentPolicy &&
    typeof input.courtAssignmentPolicy === "object" &&
    !Array.isArray(input.courtAssignmentPolicy)
      ? { .../** @type {Record<string, unknown>} */ (input.courtAssignmentPolicy) }
      : {};

  if (policyPartial.partialAssignmentAllowed === true) {
    push({
      code: HANDOFF_DIAGNOSTIC_CODE.COURT_ASSIGNMENT_POLICY_INVALID,
      path: "courtAssignmentPolicy.partialAssignmentAllowed",
      message:
        "partialAssignmentAllowed=true is rejected for integration-certified handoff",
    });
    return fail({
      sourceScheduleRequestFingerprint,
      sourceScheduleCandidateFingerprint,
      sourceCertificationFingerprint,
    });
  }

  if (policyPartial.acceptLockedAssignments === false) {
    push({
      code: HANDOFF_DIAGNOSTIC_CODE.COURT_ASSIGNMENT_POLICY_INVALID,
      path: "courtAssignmentPolicy.acceptLockedAssignments",
      message: "acceptLockedAssignments must remain true for certified handoff",
    });
    return fail({
      sourceScheduleRequestFingerprint,
      sourceScheduleCandidateFingerprint,
      sourceCertificationFingerprint,
    });
  }

  if (input.seed != null) {
    push({
      code: HANDOFF_DIAGNOSTIC_CODE.COURT_ASSIGNMENT_POLICY_INVALID,
      path: "seed",
      message: "seed must not be supplied; greedy runtime does not use PRNG",
    });
    return fail({
      sourceScheduleRequestFingerprint,
      sourceScheduleCandidateFingerprint,
      sourceCertificationFingerprint,
    });
  }

  const policyId =
    typeof policyPartial.policyId === "string" && policyPartial.policyId.trim()
      ? String(policyPartial.policyId).trim()
      : "core11-core12-handoff-policy";

  /** @type {Record<string, unknown>} */
  const certifiedPolicyInput = {
    ...policyPartial,
    policyId,
    policyVersion: CORE12_POLICY_VERSION,
    partialAssignmentAllowed: false,
    acceptLockedAssignments: true,
    overrideManualLocks: false,
    invalidLockBehavior: INVALID_LOCK_BEHAVIOR.CONFLICT,
    allowUnscheduledMatches: false,
    requireVenueTimezone: true,
    requireAvailabilitySnapshot: true,
    capabilityMatchMode: CAPABILITY_MATCH_MODE.HARD,
    overlapMode: OVERLAP_MODE.HALF_OPEN,
  };
  // Seed is request-level only; never forward into policy factory.
  delete certifiedPolicyInput.seed;

  let policy;
  try {
    policy = createCourtAssignmentPolicy(certifiedPolicyInput);
  } catch (err) {
    push({
      code: HANDOFF_DIAGNOSTIC_CODE.COURT_ASSIGNMENT_POLICY_INVALID,
      path: "courtAssignmentPolicy",
      message: err instanceof Error ? err.message : "Invalid court assignment policy",
    });
    return fail({
      sourceScheduleRequestFingerprint,
      sourceScheduleCandidateFingerprint,
      sourceCertificationFingerprint,
    });
  }

  // Explicit acceptLockedAssignments=false already rejected above.
  if (policy.acceptLockedAssignments !== true) {
    push({
      code: HANDOFF_DIAGNOSTIC_CODE.COURT_ASSIGNMENT_POLICY_INVALID,
      path: "courtAssignmentPolicy.acceptLockedAssignments",
      message: "acceptLockedAssignments must remain true for certified handoff",
    });
    return fail({
      sourceScheduleRequestFingerprint,
      sourceScheduleCandidateFingerprint,
      sourceCertificationFingerprint,
    });
  }

  // --- Court requirements ---
  const requirementsByMatchId =
    input.courtRequirementsByMatchId &&
    typeof input.courtRequirementsByMatchId === "object" &&
    !Array.isArray(input.courtRequirementsByMatchId)
      ? /** @type {Record<string, unknown>} */ (input.courtRequirementsByMatchId)
      : {};

  for (const key of Object.keys(requirementsByMatchId).sort(asciiCompare)) {
    const matchId = normalizeIdentifier(key);
    const sourceMatch = requestMatchById.get(matchId);
    if (sourceMatch?.isBye === true) {
      push({
        code: HANDOFF_DIAGNOSTIC_CODE.COURT_REQUIREMENTS_INVALID,
        path: `courtRequirementsByMatchId.${key}`,
        message: `Court requirements must not target a bye match: ${matchId}`,
        details: { matchId },
      });
      continue;
    }
    if (!scheduledIds.has(matchId)) {
      push({
        code: HANDOFF_DIAGNOSTIC_CODE.COURT_REQUIREMENTS_INVALID,
        path: `courtRequirementsByMatchId.${key}`,
        message: `Court requirements reference unknown scheduled matchId: ${key}`,
        details: { matchId: key },
      });
    }
  }
  if (diagnostics.length > 0) {
    return fail({
      sourceScheduleRequestFingerprint,
      sourceScheduleCandidateFingerprint,
      sourceCertificationFingerprint,
    });
  }

  // --- Map matches (stable by matchId) ---
  const orderedScheduled = stableSortByKeys(scheduled, (row) => [
    normalizeIdentifier(
      row && typeof row === "object"
        ? /** @type {Record<string, unknown>} */ (row).matchId
        : ""
    ),
  ]);

  /** @type {object[]} */
  const mappedMatches = [];
  let byeCount = 0;

  for (const row of orderedScheduled) {
    const rec = /** @type {Record<string, unknown>} */ (row);
    const matchId = normalizeIdentifier(rec.matchId);
    const sourceMatch = requestMatchById.get(matchId);

    if (sourceMatch?.isBye === true) {
      push({
        code: HANDOFF_DIAGNOSTIC_CODE.MATCH_MAPPING_INVALID,
        path: `candidate.plan.scheduled.${matchId}`,
        message: "Bye match must not appear as a scheduled match for handoff",
        details: { matchId },
      });
      byeCount += 1;
      continue;
    }

    // Count bye matches present on request but not scheduled (expected omit).
    // (byeCount in summary = request byes excluded from mapping)

    const startResolved = resolveAbsoluteInstant(
      rec.startUtcIso,
      rec.startUtcMs,
      `scheduled.${matchId}.start`,
      diagnostics
    );
    const endResolved = resolveAbsoluteInstant(
      rec.endUtcIso,
      rec.endUtcMs,
      `scheduled.${matchId}.end`,
      diagnostics
    );
    if (!startResolved.ok || !endResolved.ok) continue;

    if (!(startResolved.ms < endResolved.ms)) {
      push({
        code: HANDOFF_DIAGNOSTIC_CODE.MATCH_MAPPING_INVALID,
        path: `scheduled.${matchId}`,
        message: "scheduledStart must be strictly before scheduledEnd",
        details: { matchId },
      });
      continue;
    }

    /** @type {Record<string, unknown>} */
    const mapped = {
      matchId,
      competitionId: scheduleRequest.competitionId,
      tenantId: scope.tenantId,
      clubId: scope.clubId,
      venueId: scope.venueId,
      scheduledStart: startResolved.iso,
      scheduledEnd: endResolved.iso,
      timezone: scheduleRequest.timezone,
      isBye: false,
      manualCourtLock: false,
    };

    if (
      rec.start &&
      typeof rec.start === "object" &&
      rec.end &&
      typeof rec.end === "object"
    ) {
      const startCivil = /** @type {Record<string, unknown>} */ (rec.start);
      const endCivil = /** @type {Record<string, unknown>} */ (rec.end);
      const date = normalizeIdentifier(startCivil.date);
      const endDate = normalizeIdentifier(endCivil.date);
      if (
        date &&
        endDate &&
        date === endDate &&
        Number.isFinite(Number(startCivil.minutesFromMidnight)) &&
        Number.isFinite(Number(endCivil.minutesFromMidnight))
      ) {
        mapped.civilWindow = {
          date,
          startTime: minutesToHhMm(Number(startCivil.minutesFromMidnight)),
          endTime: minutesToHhMm(Number(endCivil.minutesFromMidnight)),
        };
      }
    }

    if (typeof rec.durationMinutes === "number") {
      mapped.durationMinutes = rec.durationMinutes;
    }

    if (sourceMatch?.stageId && isValidIdentifier(sourceMatch.stageId)) {
      mapped.stage = normalizeIdentifier(sourceMatch.stageId);
    }

    if (typeof sourceMatch?.priority === "number") {
      mapped.priority = sourceMatch.priority;
    }

    if (Object.prototype.hasOwnProperty.call(requirementsByMatchId, matchId)) {
      mapped.requiredCapabilities = requirementsByMatchId[matchId];
    }

    // Explicitly omit concurrencyIndex, abstractSlotIndex, capacityRelease*, sessionId.
    mappedMatches.push(mapped);
  }

  // byeCount = request byes that are correctly excluded (not scheduled).
  byeCount = (scheduleRequest.matches || []).filter((m) => m.isBye === true).length;

  if (diagnostics.length > 0) {
    return fail(
      {
        sourceScheduleRequestFingerprint,
        sourceScheduleCandidateFingerprint,
        sourceCertificationFingerprint,
      },
      {
        sourceScheduledMatchCount: scheduled.length,
        mappedMatchCount: 0,
        byeCount,
        courtCount: courtsInput.length,
        lockedAssignmentCount: 0,
      }
    );
  }

  // --- Locks ---
  const locksInput = Array.isArray(input.lockedAssignments)
    ? [...input.lockedAssignments]
    : [];
  const courtIdSet = new Set(
    courtsInput.map((c) =>
      normalizeIdentifier(
        c && typeof c === "object"
          ? /** @type {Record<string, unknown>} */ (c).courtId
          : ""
      )
    )
  );
  const mappedIdSet = new Set(mappedMatches.map((m) => m.matchId));

  for (let i = 0; i < locksInput.length; i += 1) {
    const lock = locksInput[i];
    if (lock == null || typeof lock !== "object" || Array.isArray(lock)) {
      push({
        code: HANDOFF_DIAGNOSTIC_CODE.LOCKED_ASSIGNMENT_INVALID,
        path: `lockedAssignments[${i}]`,
        message: "Lock entry must be an object",
      });
      continue;
    }
    const l = /** @type {Record<string, unknown>} */ (lock);
    const matchId = normalizeIdentifier(l.matchId);
    const courtId = normalizeIdentifier(l.courtId);
    const sourceMatch = requestMatchById.get(matchId);
    if (sourceMatch?.isBye === true) {
      push({
        code: HANDOFF_DIAGNOSTIC_CODE.LOCKED_ASSIGNMENT_INVALID,
        path: `lockedAssignments[${i}].matchId`,
        message: `Lock must not target a bye match: ${matchId}`,
        details: { matchId },
      });
    }
    if (!mappedIdSet.has(matchId)) {
      push({
        code: HANDOFF_DIAGNOSTIC_CODE.LOCKED_ASSIGNMENT_INVALID,
        path: `lockedAssignments[${i}].matchId`,
        message: `Lock references unknown mapped matchId: ${matchId}`,
        details: { matchId },
      });
    }
    if (!courtIdSet.has(courtId)) {
      push({
        code: HANDOFF_DIAGNOSTIC_CODE.LOCKED_ASSIGNMENT_INVALID,
        path: `lockedAssignments[${i}].courtId`,
        message: `Lock references unknown courtId: ${courtId}`,
        details: { courtId },
      });
    }
  }

  // Duplicate locks for the same match fail closed (no silent dedupe).
  /** @type {Map<string, number>} */
  const lockMatchFirstIndex = new Map();
  for (let i = 0; i < locksInput.length; i += 1) {
    const lock = locksInput[i];
    if (lock == null || typeof lock !== "object" || Array.isArray(lock)) continue;
    const matchId = normalizeIdentifier(
      /** @type {Record<string, unknown>} */ (lock).matchId
    );
    if (!matchId) continue;
    if (lockMatchFirstIndex.has(matchId)) {
      push({
        code: HANDOFF_DIAGNOSTIC_CODE.DUPLICATE_LOCK,
        path: `lockedAssignments[${i}].matchId`,
        message: `Duplicate locked assignment for matchId: ${matchId}`,
        details: {
          matchId,
          firstIndex: lockMatchFirstIndex.get(matchId),
          duplicateIndex: i,
        },
      });
    } else {
      lockMatchFirstIndex.set(matchId, i);
    }
  }

  const orderedLocks = stableSortByKeys(locksInput, (l) => [
    normalizeIdentifier(
      l && typeof l === "object"
        ? /** @type {Record<string, unknown>} */ (l).matchId
        : ""
    ),
    normalizeIdentifier(
      l && typeof l === "object"
        ? /** @type {Record<string, unknown>} */ (l).courtId
        : ""
    ),
  ]);

  if (diagnostics.length > 0) {
    return fail(
      {
        sourceScheduleRequestFingerprint,
        sourceScheduleCandidateFingerprint,
        sourceCertificationFingerprint,
      },
      {
        sourceScheduledMatchCount: scheduled.length,
        mappedMatchCount: mappedMatches.length,
        byeCount,
        courtCount: courtsInput.length,
        lockedAssignmentCount: locksInput.length,
      }
    );
  }

  const scheduleSnapshotRef = createSnapshotRef({
    snapshotId: SCHEDULE_SNAPSHOT_ID,
    snapshotVersion: SCHEDULE_SNAPSHOT_VERSION,
    fingerprint: sourceScheduleCandidateFingerprint,
  });

  const orderedCourts = stableSortByKeys(courtsInput, (c) => [
    normalizeIdentifier(
      c && typeof c === "object"
        ? /** @type {Record<string, unknown>} */ (c).courtId
        : ""
    ),
  ]);

  const plainCourts = orderedCourts.map((c) => {
    const src =
      c && typeof c === "object"
        ? /** @type {Record<string, unknown>} */ (c)
        : {};
    /** @type {Record<string, unknown>} */
    const plain = { ...src };
    if (Array.isArray(src.availabilityIntervals)) {
      plain.availabilityIntervals = src.availabilityIntervals.map((iv) => {
        const row =
          iv && typeof iv === "object"
            ? /** @type {Record<string, unknown>} */ (iv)
            : {};
        return {
          start: row.start,
          end: row.end,
        };
      });
    }
    if (plain.tenantId == null) {
      plain.tenantId = scope.tenantId;
    }
    return plain;
  });

  // Semantic projection without requestId → semantic fingerprint → derive requestId
  // → create request → final handoff fingerprint (same projection, still without requestId).
  /** @type {Record<string, unknown>} */
  const semanticRequestPartial = {
    schemaVersion: CORE12_COURT_ASSIGNMENT_SCHEMA_V1,
    tenantId: scope.tenantId,
    clubId: scope.clubId,
    venueId: scope.venueId,
    competitionId: scheduleRequest.competitionId,
    timezone: scheduleRequest.timezone,
    matches: mappedMatches,
    courts: plainCourts,
    lockedAssignments: orderedLocks,
    constraints: [],
    policy,
    scheduleSnapshotRef,
    availabilitySnapshotRef,
  };

  const semanticRequestFingerprint = fingerprintCourtAssignmentRequest(
    semanticRequestPartial
  );

  const requestId =
    input.requestId != null && String(input.requestId).trim()
      ? normalizeIdentifier(input.requestId)
      : `ca-handoff-${semanticRequestFingerprint}`;

  /** @type {Record<string, unknown>} */
  const requestPartial = {
    ...semanticRequestPartial,
    requestId,
    metadata: Object.freeze({
      handoff: "CORE11_TO_CORE12_PHASE_1H_B",
      sourceCandidateStatus: BASELINE_CANDIDATE_STATUS,
      sourceConstraintCertification: CONSTRAINT_CERTIFICATION.BASELINE_ONLY,
      handoffRequestFingerprintProjectionVersion:
        HANDOFF_REQUEST_FINGERPRINT_PROJECTION_VERSION,
      availabilitySnapshotTrustModel: HANDOFF_AVAILABILITY_SNAPSHOT_TRUST_MODEL,
    }),
  };

  // Never pass seed.
  delete requestPartial.seed;

  // Create + validate from the plain partial only (never re-feed normalized
  // objects that include internal _startMs/_endMs fields).
  try {
    createCourtAssignmentRequest(requestPartial);
  } catch (err) {
    push({
      code: HANDOFF_DIAGNOSTIC_CODE.COURT_ASSIGNMENT_REQUEST_INVALID,
      path: "courtAssignmentRequest",
      message:
        err instanceof Error
          ? err.message
          : "createCourtAssignmentRequest failed",
      details: {
        code:
          err && typeof err === "object" && "code" in err
            ? /** @type {{ code?: unknown }} */ (err).code
            : undefined,
      },
    });
    return fail(
      {
        sourceScheduleRequestFingerprint,
        sourceScheduleCandidateFingerprint,
        sourceCertificationFingerprint,
      },
      {
        sourceScheduledMatchCount: scheduled.length,
        mappedMatchCount: mappedMatches.length,
        byeCount,
        courtCount: courtsInput.length,
        lockedAssignmentCount: orderedLocks.length,
      }
    );
  }

  const validation = validateCourtAssignmentRequest(requestPartial);
  if (!validation.ok || !validation.request) {
    push({
      code: HANDOFF_DIAGNOSTIC_CODE.COURT_ASSIGNMENT_REQUEST_INVALID,
      path: "courtAssignmentRequest",
      message: validation.message || "CourtAssignmentRequest validation failed",
      details: {
        code: validation.code,
        ...(validation.details || {}),
      },
    });
    return fail(
      {
        sourceScheduleRequestFingerprint,
        sourceScheduleCandidateFingerprint,
        sourceCertificationFingerprint,
      },
      {
        sourceScheduledMatchCount: scheduled.length,
        mappedMatchCount: mappedMatches.length,
        byeCount,
        courtCount: courtsInput.length,
        lockedAssignmentCount: orderedLocks.length,
      }
    );
  }

  // Prefer the validated normalized instance for fingerprinting, then emit a
  // plain request that assignCourtsDeterministic can re-validate safely.
  const normalizedRequest = validation.request;
  const courtAssignmentRequest = toPlainCourtAssignmentRequest(normalizedRequest);

  // Final handoff fingerprint uses the same non-circular semantic projection
  // (excludes requestId; equals semanticRequestFingerprint).
  const courtAssignmentRequestFingerprint = semanticRequestFingerprint;

  return createHandoffResult({
    ok: true,
    courtAssignmentRequest,
    diagnostics,
    mappingSummary: {
      sourceScheduledMatchCount: scheduled.length,
      mappedMatchCount: mappedMatches.length,
      byeCount,
      courtCount: courtAssignmentRequest.courts.length,
      lockedAssignmentCount: courtAssignmentRequest.lockedAssignments.length,
    },
    replay: {
      sourceScheduleRequestFingerprint,
      sourceScheduleCandidateFingerprint,
      sourceCertificationFingerprint,
      courtAssignmentRequestFingerprint,
    },
  });
}

/**
 * Optional orchestration: gate + request + assignCourtsDeterministic + verify.
 *
 * @param {object} [input]
 * @returns {object}
 */
export function assignCourtsFromCertifiedSchedule(input = {}) {
  /** @type {object[]} */
  const diagnostics = [];
  const handoff = createCourtAssignmentRequestFromCertifiedSchedule(input);

  if (!handoff.ok || !handoff.courtAssignmentRequest) {
    return Object.freeze({
      ok: false,
      status: CERTIFIED_SCHEDULE_COURT_ASSIGNMENT_RESULT_STATUS,
      courtAssignmentRequest: null,
      courtAssignmentResult: null,
      diagnostics: sortHandoffDiagnostics([
        ...handoff.diagnostics,
        ...diagnostics,
      ]),
      mappingSummary: handoff.mappingSummary,
      replay: Object.freeze({
        ...handoff.replay,
        courtAssignmentResultFingerprint: "",
      }),
    });
  }

  const request = handoff.courtAssignmentRequest;
  const certifiedTimes = new Map(
    request.matches.map((m) => [
      m.matchId,
      { start: m.scheduledStart, end: m.scheduledEnd },
    ])
  );

  const result = assignCourtsDeterministic(request);

  const failAssign = (code, message, details = {}) => {
    diagnostics.push(
      createHandoffDiagnostic({
        code,
        path: "courtAssignmentResult",
        message,
        details,
      })
    );
    return Object.freeze({
      ok: false,
      status: CERTIFIED_SCHEDULE_COURT_ASSIGNMENT_RESULT_STATUS,
      courtAssignmentRequest: request,
      courtAssignmentResult: result,
      diagnostics: sortHandoffDiagnostics([
        ...handoff.diagnostics,
        ...diagnostics,
      ]),
      mappingSummary: handoff.mappingSummary,
      replay: Object.freeze({
        ...handoff.replay,
        courtAssignmentResultFingerprint: String(result?.resultFingerprint ?? ""),
      }),
    });
  };

  if (!result || typeof result !== "object") {
    return failAssign(
      HANDOFF_DIAGNOSTIC_CODE.COURT_ASSIGNMENT_RESULT_INVALID,
      "assignCourtsDeterministic returned a non-object"
    );
  }

  if (!result.resultFingerprint) {
    return failAssign(
      HANDOFF_DIAGNOSTIC_CODE.COURT_ASSIGNMENT_FINGERPRINT_MISMATCH,
      "resultFingerprint is absent"
    );
  }

  // Deterministic replay: second invocation must match fingerprint.
  const replayed = assignCourtsDeterministic(request);
  if (replayed.resultFingerprint !== result.resultFingerprint) {
    return failAssign(
      HANDOFF_DIAGNOSTIC_CODE.COURT_ASSIGNMENT_FINGERPRINT_MISMATCH,
      "resultFingerprint is not deterministic across equivalent invocations",
      {
        first: result.resultFingerprint,
        second: replayed.resultFingerprint,
      }
    );
  }

  if (
    result.replayMetadata?.scheduleSnapshotFingerprint != null &&
    result.replayMetadata.scheduleSnapshotFingerprint !==
      request.scheduleSnapshotRef?.fingerprint
  ) {
    return failAssign(
      HANDOFF_DIAGNOSTIC_CODE.COURT_ASSIGNMENT_FINGERPRINT_MISMATCH,
      "Result replay schedule snapshot fingerprint does not match request",
      {
        result: result.replayMetadata.scheduleSnapshotFingerprint,
        request: request.scheduleSnapshotRef?.fingerprint,
      }
    );
  }

  if (
    result.replayMetadata?.availabilitySnapshotFingerprint != null &&
    result.replayMetadata.availabilitySnapshotFingerprint !==
      request.availabilitySnapshotRef?.fingerprint
  ) {
    return failAssign(
      HANDOFF_DIAGNOSTIC_CODE.COURT_ASSIGNMENT_FINGERPRINT_MISMATCH,
      "Result replay availability snapshot fingerprint does not match request",
      {
        result: result.replayMetadata.availabilitySnapshotFingerprint,
        request: request.availabilitySnapshotRef?.fingerprint,
      }
    );
  }

  // Status gates before partition — REJECTED has empty assigned/unassigned.
  if (result.status === COURT_ASSIGNMENT_STATUS.PARTIAL) {
    return failAssign(
      HANDOFF_DIAGNOSTIC_CODE.COURT_ASSIGNMENT_PARTIAL,
      "PARTIAL court assignment is not integration-certified success"
    );
  }
  if (result.status === COURT_ASSIGNMENT_STATUS.INFEASIBLE) {
    return failAssign(
      HANDOFF_DIAGNOSTIC_CODE.COURT_ASSIGNMENT_INFEASIBLE,
      "Court assignment is INFEASIBLE",
      {
        unassignedCount: result.unassigned?.length ?? 0,
        committable: result.committable === true,
      }
    );
  }
  if (result.status === COURT_ASSIGNMENT_STATUS.REJECTED) {
    return failAssign(
      HANDOFF_DIAGNOSTIC_CODE.COURT_ASSIGNMENT_REJECTED,
      "Court assignment request was REJECTED",
      { failure: result.failure ?? null }
    );
  }
  if (result.status !== COURT_ASSIGNMENT_STATUS.SUCCESS) {
    return failAssign(
      HANDOFF_DIAGNOSTIC_CODE.COURT_ASSIGNMENT_RESULT_INVALID,
      `Unexpected court assignment status: ${result.status}`
    );
  }

  const assignedIds = new Set(
    (result.assignments || []).map((a) => normalizeIdentifier(a.matchId))
  );
  const unassignedIds = new Set(
    (result.unassigned || []).map((u) => normalizeIdentifier(u.matchId))
  );
  for (const id of assignedIds) {
    if (unassignedIds.has(id)) {
      return failAssign(
        HANDOFF_DIAGNOSTIC_CODE.COURT_ASSIGNMENT_RESULT_INVALID,
        `Match appears in both assignments and unassigned: ${id}`,
        { matchId: id }
      );
    }
  }

  const assignableIds = new Set(
    request.matches
      .filter((m) => m.isBye !== true)
      .map((m) => m.matchId)
  );
  for (const id of assignableIds) {
    if (!assignedIds.has(id) && !unassignedIds.has(id)) {
      const match = request.matches.find((m) => m.matchId === id);
      const terminal =
        request.policy.skipTerminalStatuses &&
        match?.status != null &&
        request.policy.terminalStatuses.includes(
          String(match.status).toLowerCase()
        );
      if (!terminal) {
        return failAssign(
          HANDOFF_DIAGNOSTIC_CODE.COURT_ASSIGNMENT_RESULT_INVALID,
          `Assignable match missing from assignments and unassigned: ${id}`,
          { matchId: id }
        );
      }
    }
  }

  for (const slot of result.assignments || []) {
    if (!assignableIds.has(slot.matchId) && !certifiedTimes.has(slot.matchId)) {
      return failAssign(
        HANDOFF_DIAGNOSTIC_CODE.COURT_ASSIGNMENT_RESULT_INVALID,
        `Assigned unknown matchId: ${slot.matchId}`,
        { matchId: slot.matchId }
      );
    }
    const expected = certifiedTimes.get(slot.matchId);
    if (
      expected &&
      (slot.scheduledStart !== expected.start ||
        slot.scheduledEnd !== expected.end)
    ) {
      return failAssign(
        HANDOFF_DIAGNOSTIC_CODE.COURT_ASSIGNMENT_RESULT_INVALID,
        `Assigned times differ from certified schedule for ${slot.matchId}`,
        {
          matchId: slot.matchId,
          assignedStart: slot.scheduledStart,
          assignedEnd: slot.scheduledEnd,
          certifiedStart: expected.start,
          certifiedEnd: expected.end,
        }
      );
    }
  }

  if (result.committable !== true) {
    return failAssign(
      HANDOFF_DIAGNOSTIC_CODE.COURT_ASSIGNMENT_RESULT_INVALID,
      "SUCCESS result must be committable"
    );
  }

  return Object.freeze({
    ok: true,
    status: CERTIFIED_SCHEDULE_COURT_ASSIGNMENT_RESULT_STATUS,
    courtAssignmentRequest: request,
    courtAssignmentResult: result,
    diagnostics: sortHandoffDiagnostics([
      ...handoff.diagnostics,
      ...diagnostics,
    ]),
    mappingSummary: handoff.mappingSummary,
    replay: Object.freeze({
      ...handoff.replay,
      courtAssignmentResultFingerprint: result.resultFingerprint,
    }),
  });
}
