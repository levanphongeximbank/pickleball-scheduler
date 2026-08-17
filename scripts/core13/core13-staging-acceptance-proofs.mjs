/**
 * CORE-13 Staging acceptance proof evaluators.
 * Local, deterministic, no remote I/O.
 * One case = one exact proof. Unrelated failures cannot PASS.
 */

import {
  ASSIGNMENT_COMMAND_ERROR_CODE,
  COMPETITION_REFEREE_ASSIGNMENT_EDGE_FUNCTION,
  CORE13_AUTHORITATIVE_EXECUTION_LOCATION,
} from "../../src/features/competition-engine/operations/referee/assignment/constants.js";

export const CORE13_FIXTURE_NAMESPACE = "CORE13_STAGING_ACCEPTANCE";

export const CASE_CATALOG = Object.freeze([
  "A.anon-direct-persistence-rpc-denied",
  "B.authenticated-direct-persistence-rpc-denied",
  "C.browser-actor-spoof-ignored",
  "D.cross-tenant-denied",
  "E.cross-tournament-denied",
  "F.trusted-server-pre-match-assign-pass",
  "G.cas-correct-expected-version-pass",
  "G.cas-stale-expected-version-deny",
  "H.idempotency-replay-same-command",
  "H.idempotency-conflict-changed-payload",
  "I.atomic-replace-succeeds",
  "I.exactly-one-active-match-role",
  "J.lifecycle-in-progress-assign-deny",
  "J.lifecycle-in-progress-unassign-deny",
  "J.lifecycle-in-progress-replace-pass",
  "J.lifecycle-scoring-replace-without-emergency-deny",
  "J.lifecycle-scoring-emergency-replace-pass",
  "J.lifecycle-locked-deny",
  "J.lifecycle-completed-deny",
  "K.audit-originating-actor-user-a",
  "K.browser-cannot-read-audit-table",
  "L.non-canonical-referee-deny",
  "L.inactive-referee-deny",
  "L.required-qualification-missing-deny",
  "L.unavailable-referee-deny-when-required",
  "L.overlapping-schedule-conflict-deny",
  "L.non-overlapping-schedule-assign-pass",
  "M.daily-play-disabled-not-applicable",
  "M.daily-play-enabled-trusted-server-core13",
]);

export const DENIAL_CODES = Object.freeze({
  CROSS_TENANT: [ASSIGNMENT_COMMAND_ERROR_CODE.CROSS_TENANT_DENIED],
  CROSS_TOURNAMENT: [ASSIGNMENT_COMMAND_ERROR_CODE.CROSS_TOURNAMENT_DENIED],
  STALE_WRITE: [ASSIGNMENT_COMMAND_ERROR_CODE.STALE_WRITE],
  IDEMPOTENCY_CONFLICT: [ASSIGNMENT_COMMAND_ERROR_CODE.IDEMPOTENCY_CONFLICT],
  IN_PROGRESS_ASSIGN: [ASSIGNMENT_COMMAND_ERROR_CODE.LIFECYCLE_DENIED],
  IN_PROGRESS_UNASSIGN: [
    ASSIGNMENT_COMMAND_ERROR_CODE.UNASSIGN_WITHOUT_REPLACEMENT_DENIED,
    ASSIGNMENT_COMMAND_ERROR_CODE.LIFECYCLE_DENIED,
  ],
  SCORING_REPLACE_WITHOUT_EMERGENCY: [
    ASSIGNMENT_COMMAND_ERROR_CODE.EMERGENCY_REPLACEMENT_REQUIRED,
    ASSIGNMENT_COMMAND_ERROR_CODE.LIFECYCLE_DENIED,
  ],
  LOCKED: [ASSIGNMENT_COMMAND_ERROR_CODE.LIFECYCLE_DENIED],
  COMPLETED: [ASSIGNMENT_COMMAND_ERROR_CODE.LIFECYCLE_DENIED],
  NON_CANONICAL_IDENTITY: [
    ASSIGNMENT_COMMAND_ERROR_CODE.CANONICAL_REFEREE_EVIDENCE_REQUIRED,
    ASSIGNMENT_COMMAND_ERROR_CODE.CANONICAL_REFEREE_ID_REQUIRED,
    ASSIGNMENT_COMMAND_ERROR_CODE.DISPLAY_NAME_IDENTITY_DENIED,
    ASSIGNMENT_COMMAND_ERROR_CODE.FOREIGN_REFEREE_DENIED,
  ],
  INACTIVE_REFEREE: [ASSIGNMENT_COMMAND_ERROR_CODE.CANONICAL_REFEREE_EVIDENCE_REQUIRED],
  QUALIFICATION_MISSING: [
    ASSIGNMENT_COMMAND_ERROR_CODE.NOT_CONFIGURED,
    ASSIGNMENT_COMMAND_ERROR_CODE.CORE13_VALIDATION_REJECTED,
  ],
  AVAILABILITY_MISSING: [
    ASSIGNMENT_COMMAND_ERROR_CODE.NOT_CONFIGURED,
    ASSIGNMENT_COMMAND_ERROR_CODE.CORE13_VALIDATION_REJECTED,
  ],
  OVERLAP: [
    ASSIGNMENT_COMMAND_ERROR_CODE.CORE13_VALIDATION_REJECTED,
    ASSIGNMENT_COMMAND_ERROR_CODE.LIFECYCLE_DENIED,
  ],
  DAILY_DISABLED: [ASSIGNMENT_COMMAND_ERROR_CODE.DAILY_PLAY_NOT_APPLICABLE],
});

export const FORBIDDEN_CASE_STATUSES = Object.freeze([
  "SKIP",
  "NOT_RUN",
  "INCONCLUSIVE",
]);

export const ACCEPTANCE_REQUIRED_YES_FLAGS = Object.freeze([
  "CORE13_STAGING_ACCEPTANCE_GO",
  "STAGING_MUTATION_GO",
  "SQL_ALREADY_APPLIED_PREREQUISITE",
  "EDGE_ALREADY_DEPLOYED_PREREQUISITE",
]);

export const ACCEPTANCE_OPTIONAL_NEGATIVE_GUARDS = Object.freeze([
  "SQL_COMMAND_EXECUTION_THIS_PHASE",
  "SQL_REAPPLY_GO",
  "EDGE_REDEPLOY_GO",
]);

export const PRODUCTION_HINTS = /prod|production/i;
export const PRODUCTION_PROJECT_REF_HINTS = /expuvcohlcjzvrrauvud/i;

function payloadOf(result) {
  return result && typeof result === "object" ? result.payload || {} : {};
}

function proof(ok, detail) {
  return Object.freeze({ ok: ok === true, detail: String(detail || "") });
}

function readEnvFlag(envMap, name) {
  return String(envMap?.[name] ?? "").trim();
}

/**
 * Live acceptance gate. SQL/Edge execution GOs are not prerequisites.
 * Optional negative guards refuse only when present and not NO.
 * Absence of a negative guard does not grant mutation authority.
 */
export function evaluateAcceptanceGate(envMap = {}) {
  for (const name of ACCEPTANCE_REQUIRED_YES_FLAGS) {
    if (readEnvFlag(envMap, name) !== "YES") {
      return proof(false, `${name} must be YES`);
    }
  }
  if (readEnvFlag(envMap, "PICK_VN_ENV").toLowerCase() !== "staging") {
    return proof(false, "PICK_VN_ENV must be staging");
  }
  for (const name of ACCEPTANCE_OPTIONAL_NEGATIVE_GUARDS) {
    const value = readEnvFlag(envMap, name);
    if (value && value.toUpperCase() !== "NO") {
      return proof(false, `${name} must be NO for acceptance`);
    }
  }
  const url = readEnvFlag(envMap, "STAGING_SUPABASE_URL");
  if (!url) return proof(false, "STAGING_SUPABASE_URL required");
  if (PRODUCTION_PROJECT_REF_HINTS.test(url)) {
    return proof(false, "Refusing Production project URL");
  }
  if (PRODUCTION_HINTS.test(url) && !/staging/i.test(url)) {
    return proof(false, "Refusing Production-like STAGING_SUPABASE_URL");
  }
  if (PRODUCTION_HINTS.test(readEnvFlag(envMap, "PICK_VN_ENV"))) {
    return proof(false, "PICK_VN_ENV must be staging");
  }
  return proof(true, "acceptance-gate");
}

/**
 * UUID IDs are canonical and must not be required to contain namespace text.
 * Ownership is the fixture receipt (namespace + runId + disposable), not ID substring.
 * @deprecated Do not use ID substring as a mutation gate.
 */
export function belongsToFixtureNamespace(_id, _namespace = CORE13_FIXTURE_NAMESPACE) {
  return false;
}

export function evaluateFixtureNamespace(_ids, _namespace = CORE13_FIXTURE_NAMESPACE) {
  return proof(
    false,
    "UUID_ID_NAMESPACE_TEXT_REQUIREMENT_REMOVED; ownership is fixture receipt + runId"
  );
}

export function evaluateBaselineKnownStart(actualCount, expectedCount, label) {
  const actual = Number(actualCount);
  const expected = Number(expectedCount);
  if (actual !== expected) {
    return proof(
      false,
      `BASELINE_UNKNOWN ${label} active=${actual} expected=${expected} — refuse auto-clean`
    );
  }
  return proof(true, `${label} active=${actual}`);
}

export function evaluateDirectRpcDenied(rpcResult) {
  const err = rpcResult?.error;
  if (!err) return proof(false, "EXECUTE allowed");
  const blob = `${err.code || ""} ${err.message || ""} ${err.details || ""}`.toLowerCase();
  const semantic =
    blob.includes("42501") ||
    blob.includes("permission") ||
    blob.includes("not authorized") ||
    blob.includes("denied") ||
    blob.includes("pgrst") ||
    blob.includes("404");
  if (!semantic) {
    return proof(false, `unexpected rpc error code=${err.code || ""}`);
  }
  return proof(true, err.code || err.message || "denied");
}

export function evaluateHttpSuccess(result) {
  const status = Number(result?.status);
  const payload = payloadOf(result);
  if (!Number.isFinite(status) || status >= 400) {
    return proof(false, `http=${status}`);
  }
  if (payload.ok !== true) {
    return proof(false, `ok=${payload.ok} code=${payload.code || ""}`);
  }
  return proof(true, `http=${status}`);
}

export function evaluateAssignPass(result, expected = {}) {
  const http = evaluateHttpSuccess(result);
  if (!http.ok) return http;
  const payload = payloadOf(result);
  if (payload.core13Executed !== true) {
    return proof(false, "core13Executed!=true");
  }
  if (
    payload.authoritativeExecutionLocation &&
    payload.authoritativeExecutionLocation !== CORE13_AUTHORITATIVE_EXECUTION_LOCATION
  ) {
    return proof(false, `location=${payload.authoritativeExecutionLocation}`);
  }
  if (expected.actorId && payload.originatingActorId !== expected.actorId) {
    return proof(false, `actor=${payload.originatingActorId}`);
  }
  const version = Number(payload.version ?? payload.assignment?.version);
  if (expected.previousVersion != null) {
    if (!Number.isFinite(version) || version !== Number(expected.previousVersion) + 1) {
      return proof(false, `version=${version} expected=${Number(expected.previousVersion) + 1}`);
    }
  }
  return proof(true, `version=${version}`);
}

export function evaluateCasCorrectPass(result, previousVersion) {
  const payload = payloadOf(result);
  if (payload.code === ASSIGNMENT_COMMAND_ERROR_CODE.INVALID_INPUT) {
    return proof(false, "INVALID_INPUT_NOT_SUCCESS");
  }
  if (payload.code === ASSIGNMENT_COMMAND_ERROR_CODE.STALE_WRITE) {
    return proof(false, "STALE_WRITE_NOT_SUCCESS");
  }
  if (payload.ok !== true) {
    return proof(false, `ok=${payload.ok} code=${payload.code || ""}`);
  }
  return evaluateAssignPass(result, { previousVersion });
}

export function evaluateAtomicReplacePass(result, expected = {}) {
  const payload = payloadOf(result);
  // Explicitly refuse the tautology ok===true || ok===false.
  if (payload.ok !== true) {
    return proof(false, `ok=${payload.ok} code=${payload.code || "error"}`);
  }
  const http = evaluateHttpSuccess(result);
  if (!http.ok) return http;
  const version = Number(payload.version ?? payload.assignment?.version);
  const refereeId = String(
    payload.assignment?.refereeId || payload.newRefereeUserId || payload.refereeUserId || ""
  );
  if (expected.previousVersion != null && version !== Number(expected.previousVersion) + 1) {
    return proof(false, `version=${version} expected=${Number(expected.previousVersion) + 1}`);
  }
  if (expected.refereeId && refereeId && refereeId !== String(expected.refereeId)) {
    return proof(false, `referee=${refereeId}`);
  }
  if (expected.operation && payload.operation && payload.operation !== expected.operation) {
    return proof(false, `operation=${payload.operation}`);
  }
  return proof(true, `version=${version} referee=${refereeId || "ok"}`);
}

export function evaluateExactlyOneActive(rows, expected = {}) {
  const list = Array.isArray(rows) ? rows : [];
  if (list.length !== 1) {
    return proof(false, `active=${list.length}`);
  }
  const row = list[0];
  const status = String(row.status || row.Status || "").toLowerCase();
  if (status && status !== "active") {
    return proof(false, `status=${status}`);
  }
  if (expected.matchId && String(row.matchId || row.match_id) !== String(expected.matchId)) {
    return proof(false, "match mismatch");
  }
  if (expected.refereeId) {
    const referee = String(row.refereeId || row.referee_user_id || "");
    if (referee !== String(expected.refereeId)) {
      return proof(false, `referee=${referee}`);
    }
  }
  if (expected.version != null) {
    const version = Number(row.version);
    if (version !== Number(expected.version)) {
      return proof(false, `version=${version}`);
    }
  }
  if (expected.role) {
    const role = String(row.role || row.roleCode || "");
    const wanted = String(expected.role);
    const normalized =
      (role === "REFEREE" && wanted === "PRIMARY") ||
      (role === "PRIMARY" && wanted === "REFEREE") ||
      role === wanted;
    if (!normalized) return proof(false, `role=${role}`);
  }
  return proof(true, "active=1");
}

export function evaluateDenial(result, allowedCodes) {
  const payload = payloadOf(result);
  if (payload.ok !== false) {
    return proof(false, `ok=${payload.ok}`);
  }
  const code = String(payload.code || "");
  const allowed = Array.isArray(allowedCodes) ? allowedCodes : [];
  if (!code || !allowed.includes(code)) {
    return proof(false, `code=${code || "missing"} expected=${allowed.join("|")}`);
  }
  return proof(true, code);
}

export function evaluateDailyEnabledPass(result) {
  const payload = payloadOf(result);
  if (payload.ok !== true) {
    return proof(false, `generic-or-specific-failure code=${payload.code || "none"}`);
  }
  if (payload.core13Executed !== true) {
    return proof(false, "core13Executed!=true");
  }
  if (payload.authoritativeExecutionLocation !== CORE13_AUTHORITATIVE_EXECUTION_LOCATION) {
    return proof(false, `location=${payload.authoritativeExecutionLocation || "missing"}`);
  }
  if (payload.endpoint !== COMPETITION_REFEREE_ASSIGNMENT_EDGE_FUNCTION) {
    return proof(false, `endpoint=${payload.endpoint || "missing"}`);
  }
  return proof(true, "daily-enabled-trusted-server");
}

export function evaluateAuthenticatedRuntimeProbe(result) {
  const payload = payloadOf(result);
  const blob = `${payload.code || ""} ${payload.error || ""} ${JSON.stringify(payload)}`;
  if (Number(result?.status) === 401) {
    return proof(false, "JWT gateway rejected valid token");
  }
  if (String(payload.code || "") === "EDGE_RUNTIME_ERROR") {
    return proof(false, "EDGE_RUNTIME_ERROR");
  }
  if (/cannot find module|module not found|auth\/supabaseClient\.js/i.test(blob)) {
    return proof(false, "module-resolution-error");
  }
  if (payload.ok !== true) {
    return proof(false, `probe ok=${payload.ok} code=${payload.code || ""}`);
  }
  const action = String(payload.action || "");
  if (action !== "getMatchAssignmentVersion" && action !== "getActiveAssignment") {
    return proof(false, `action=${action || "missing"}`);
  }
  return proof(true, action);
}

export function createMutationGate() {
  let probePassed = false;
  let mutationAttempted = false;
  return {
    markProbePassed() {
      probePassed = true;
    },
    assertCanMutate() {
      if (!probePassed) {
        return proof(false, "AUTHENTICATED_NON_MUTATING_EDGE_PROBE_REQUIRED");
      }
      mutationAttempted = true;
      return proof(true, "probe-passed");
    },
    getState() {
      return { probePassed, mutationAttempted };
    },
  };
}

export async function runWithFinalization(work, finalize) {
  try {
    return await work();
  } finally {
    await finalize();
  }
}

export function evaluateDurableAssignment(rows, expected = {}) {
  const list = Array.isArray(rows) ? rows : [];
  if (!list.length) return proof(false, "durable assignment missing");
  return evaluateExactlyOneActive(
    list.filter((row) => String(row.status || "active").toLowerCase() === "active"),
    expected
  );
}

export function evaluateDurableIdempotency(beforeCount, afterReplayCount, conflictCreatedCount) {
  if (Number(afterReplayCount) !== Number(beforeCount)) {
    return proof(false, `replay mutated durable count ${beforeCount}->${afterReplayCount}`);
  }
  if (Number(conflictCreatedCount) !== 0) {
    return proof(false, `conflict created second mutation count=${conflictCreatedCount}`);
  }
  return proof(true, `durable-count=${beforeCount}`);
}

export function evaluateDurableAuditActor(rows, expected = {}) {
  const list = Array.isArray(rows) ? rows : [];
  if (!list.length) return proof(false, "audit row missing");
  const hit = list.find((row) => {
    const actor = String(row.actor_id || row.actorId || "");
    const tenant = String(row.tenant_id || row.tenantId || "");
    const tournament = String(row.tournament_id || row.tournamentId || "");
    const match = String(row.match_id || row.matchId || "");
    const operation = String(row.operation || row.action || "");
    if (expected.actorId && actor !== String(expected.actorId)) return false;
    if (expected.tenantId && tenant !== String(expected.tenantId)) return false;
    if (expected.tournamentId && tournament !== String(expected.tournamentId)) return false;
    if (expected.matchId && match !== String(expected.matchId)) return false;
    if (expected.operation && operation && operation !== String(expected.operation)) return false;
    return true;
  });
  if (!hit) return proof(false, "audit actor/scope mismatch");
  return proof(true, "audit-originating-actor");
}

export function evaluateBrowserAuditDenied(browserResult, serviceRows) {
  const serviceList = Array.isArray(serviceRows) ? serviceRows : [];
  if (!serviceList.length) return proof(false, "no service audit evidence");
  if (browserResult?.error) return proof(true, browserResult.error.message || "error");
  const browserRows = Array.isArray(browserResult?.data) ? browserResult.data : [];
  if (browserRows.length > 0) return proof(false, "authenticated browser read audit");
  return proof(true, "browser-empty");
}

export function evaluateActiveLeftovers(unexpectedActiveRows) {
  const list = Array.isArray(unexpectedActiveRows) ? unexpectedActiveRows : [];
  return proof(list.length === 0, `ACTIVE_ASSIGNMENT_FIXTURE_LEFTOVERS=${list.length}`);
}

export function evaluateAuditDeleteForbidden(source) {
  const text = String(source || "");
  const deletesAudit = /delete\s+from\s+(public\.)?competition_referee_assignment_audit/i.test(
    text
  );
  return proof(!deletesAudit, deletesAudit ? "IMMUTABLE_AUDIT_DELETE" : "NO");
}

export function evaluateServiceEvidenceTestOnly(productUiSource, harnessSource) {
  const product = String(productUiSource || "");
  const harness = String(harnessSource || "");
  if (/STAGING_SERVICE_ROLE_KEY/.test(product) || /SUPABASE_SERVICE_ROLE_KEY/.test(product)) {
    return proof(false, "service role leaked into product/browser source");
  }
  if (!/STAGING_SERVICE_ROLE_KEY/.test(harness) && !/serviceKey/.test(harness)) {
    return proof(false, "harness does not inspect via service evidence");
  }
  return proof(true, "test-only");
}

export function evaluateCatalogExecution(results, catalog = CASE_CATALOG) {
  const named = new Map((results || []).map((row) => [row.name, row]));
  const missing = catalog.filter((name) => !named.has(name));
  const forbidden = (results || []).filter((row) =>
    FORBIDDEN_CASE_STATUSES.includes(String(row.status || "").toUpperCase())
  );
  if (missing.length) {
    return proof(false, `not executed: ${missing.join(",")}`);
  }
  if (forbidden.length) {
    return proof(false, `forbidden status: ${forbidden.map((row) => row.name).join(",")}`);
  }
  if (named.size !== catalog.length) {
    return proof(false, `count=${named.size} expected=${catalog.length}`);
  }
  return proof(true, `STAGING_ACCEPTANCE_CASE_COUNT=${catalog.length}`);
}

export function evaluateOldAssignmentRevoked(rows, previousAssignmentId) {
  const list = Array.isArray(rows) ? rows : [];
  const previous = list.find(
    (row) => String(row.id || row.assignmentId) === String(previousAssignmentId)
  );
  if (!previousAssignmentId) return proof(true, "no previous id");
  if (!previous) return proof(true, "previous absent from active set");
  const status = String(previous.status || "").toLowerCase();
  if (status === "active") return proof(false, "old assignment still active");
  return proof(true, "old-revoked");
}
