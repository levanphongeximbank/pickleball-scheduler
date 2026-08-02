/**
 * Phase 5D post-apply runtime smoke — pure helpers (offline-testable).
 * No Supabase clients. No credentials. No SQL package execution.
 */

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export const STAGING_PROJECT_REF = "qyewbxjsiiyufanzcjcq";
export const FORBIDDEN_PRODUCTION_REF = "expuvcohlcjzvrrauvud";

/** S2 review decision is fixed — never approve. */
export const S2_REVIEW_DECISION = "reject";

export const PROVENANCE = {
  version: "20260731150000",
  name: "phase5d_tt5d_controlled_reconciliation",
};

/** Catalog-only evidence retained in sql/20 — not a runtime smoke case. */
export const PUBLIC_DENIAL_EVIDENCE = {
  source: "sql/20_TT5D_POST_APPLY_VERIFY.sql",
  scope: "has_function_privilege / PUBLIC EXECUTE denied guards for all 13 TT5D functions",
  runtimeCase: false,
};

const AUTH_DENIAL_CODE_RE =
  /^(42501|PGRST301|PGRST302|401|403)$/i;
const AUTH_DENIAL_MESSAGE_RE =
  /permission denied|not authorized|unauthorized|jwt|row-level security|rls|login required|not authenticated|auth\.uid\(\)|execute.*denied|forbidden/i;
const BUSINESS_OR_VALIDATION_RE =
  /invalid|validation|check constraint|foreign key|not null|duplicate|idempotency|baseline_mismatch|business|conflict|already exists|missing required|null value/i;

const SENSITIVE_KEY_RE =
  /(password|passwd|secret|token|authorization|apikey|api_key|service_role|service[_-]?key|anon[_-]?key|refresh_token|access_token|bearer|email)/i;
const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const JWT_RE = /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g;
const PASSWORD_ASSIGN_RE = /password\s*[:=]\s*\S+/gi;
const BEARER_RE = /Bearer\s+\S+/gi;

export function createRunScopedProbe(runId = crypto.randomUUID()) {
  const compact = String(runId).replace(/-/g, "").slice(0, 16);
  const namespace = `p5dsm_${compact}`;
  return {
    runId: String(runId),
    namespace,
    requestId: `${namespace}_corr_req`,
    assignmentIdempotencyKey: `${namespace}_assign`,
    reviewIdempotencyKey: `${namespace}_review`,
    accessProbeReason: `${namespace}_access`,
    listProbeTag: `${namespace}_list`,
  };
}

export function assertStagingProjectRefGate({ url, projectRef } = {}) {
  const u = String(url || "").trim();
  const ref = String(projectRef || "").trim();
  if (u.includes(FORBIDDEN_PRODUCTION_REF) || ref === FORBIDDEN_PRODUCTION_REF) {
    throw new Error(
      `PRODUCTION_FORBIDDEN: refusing Production ref ${FORBIDDEN_PRODUCTION_REF}`,
    );
  }
  if (ref && ref !== STAGING_PROJECT_REF) {
    throw new Error(
      `TARGET_REF_MISMATCH: expected ${STAGING_PROJECT_REF}, got ${ref}`,
    );
  }
  if (!u) {
    throw new Error("STAGING_URL_REQUIRED: empty Staging URL");
  }
  if (!u.includes(STAGING_PROJECT_REF)) {
    throw new Error(
      `STAGING_REF_REQUIRED: URL must identify ${STAGING_PROJECT_REF} before any client construction`,
    );
  }
  return { url: u, projectRef: STAGING_PROJECT_REF };
}

export function assertExecuteGate(env = process.env) {
  const raw = String(env.PHASE5D_POST_APPLY_SMOKE_EXECUTE || "").trim().toLowerCase();
  if (!["1", "true", "yes", "on"].includes(raw)) {
    throw new Error(
      "EXECUTE_GATE_CLOSED: PHASE5D_POST_APPLY_SMOKE_EXECUTE=1 required before any Supabase client or network call",
    );
  }
  return true;
}

export function isAuthorizationDenialError(error) {
  if (!error) return false;
  const code = String(error.code || error.status || error.statusCode || "").trim();
  const message = String(error.message || error.error || error.details || "").trim();
  const combined = `${code} ${message}`;
  if (BUSINESS_OR_VALIDATION_RE.test(message) && !AUTH_DENIAL_MESSAGE_RE.test(message)) {
    return false;
  }
  if (AUTH_DENIAL_CODE_RE.test(code)) return true;
  if (AUTH_DENIAL_MESSAGE_RE.test(combined)) return true;
  return false;
}

export const FK_SAFE_TEARDOWN_ORDER = [
  { key: "correctionRequestIds", table: "team_tournament_referee_correction_requests", column: "id" },
  { key: "refereeEventInboxIds", table: "team_tournament_referee_event_inbox", column: "id" },
  { key: "refereeLinkIds", table: "team_sub_match_referee_links", column: "id" },
  { key: "outboxIds", table: "match_integration_outbox", column: "id" },
  { key: "syncMutationIds", table: "match_sync_mutations", column: "id" },
  { key: "resultRevisionIds", table: "match_result_revisions", column: "id" },
  { key: "liveStateIds", table: "match_live_states", column: "id" },
  { key: "assignmentIds", table: "referee_assignments", column: "id" },
];

export function createIdTracker() {
  const tracker = {};
  for (const step of FK_SAFE_TEARDOWN_ORDER) {
    tracker[step.key] = [];
  }
  return tracker;
}

export function trackId(tracker, key, id) {
  if (!tracker[key]) {
    throw new Error(`UNKNOWN_TRACKER_KEY: ${key}`);
  }
  if (id == null || id === "") return tracker;
  const s = String(id);
  if (!tracker[key].includes(s)) tracker[key].push(s);
  return tracker;
}

export function buildOrderedCaseMatrix() {
  return [
    {
      id: "S0",
      name: "preflight_gates",
      steps: [
        "gate_exact_staging_ref_before_any_client",
        "refuse_production_ref_and_production_config",
        "assert_distinct_manager_and_referee_jwt_fixtures",
        "assert_provenance_row",
        "generate_run_scoped_probe_namespace",
        "stop_if_any_generated_probe_key_exists",
      ],
    },
    {
      id: "S0b",
      name: "create_assignment_for_referee",
      rpc: "team_tournament_create_referee_assignment",
      actor: "manager",
      track: ["assignmentIds"],
    },
    {
      id: "S0c",
      name: "create_isolated_correction_via_canonical_rpc",
      rpc: "team_tournament_request_referee_correction",
      actor: "referee",
      requires: "S0b",
      track: ["correctionRequestIds"],
      note: "Must complete before S1. Creates exactly one pending correction.",
    },
    {
      id: "S1",
      name: "authenticated_correction_select",
      actor: "manager_or_referee",
      passRequires: {
        rowCount: 1,
        matchFields: ["id", "status"],
        expectedStatus: "pending",
        idEqualsTracked: "correctionRequestIds[0]",
      },
    },
    {
      id: "S2",
      name: "authorized_correction_review_reject_only",
      rpc: "team_tournament_review_referee_correction",
      actor: "manager",
      decision: S2_REVIEW_DECISION,
      note: "MUST send p_decision=reject only. Approve is forbidden. No approve fallback.",
    },
    {
      id: "S3",
      name: "runtime_anon_execute_denial",
      actor: "anon_no_jwt",
      rpcs: [
        "team_tournament_request_referee_correction",
        "team_tournament_create_referee_assignment",
        "team_tournament_referee_match_access_ops",
        "referee_v5_assignment_effective_status",
        "referee_v5_current_user_has_assignment",
      ],
      passRequires: "authorization_denial_only",
      publicDenial: "sql20_catalog_evidence_only",
    },
    {
      id: "S4",
      name: "referee_assignment_authorized_flows",
      actor: "manager_and_referee",
      rpcs: [
        "team_tournament_referee_match_access_ops",
        "team_tournament_list_referee_assignments",
        "team_tournament_revoke_referee_assignment",
      ],
    },
    {
      id: "T",
      name: "teardown_tracked_ids_fk_safe_finally",
      order: FK_SAFE_TEARDOWN_ORDER.map((s) => s.key),
      assertZeroLeftovers: true,
      teardownFailureEqualsFail: true,
    },
  ];
}

export function requiredFixtureVariables() {
  return {
    executeGate: "PHASE5D_POST_APPLY_SMOKE_EXECUTE=1",
    stagingOnly: [
      "STAGING_SUPABASE_URL",
      "STAGING_SUPABASE_ANON_KEY",
      "STAGING_SUPABASE_SERVICE_ROLE_KEY",
    ],
    distinctJwt: [
      "PHASE5D_SMOKE_MANAGER_EMAIL",
      "PHASE5D_SMOKE_MANAGER_PASSWORD",
      "PHASE5D_SMOKE_REFEREE_EMAIL",
      "PHASE5D_SMOKE_REFEREE_PASSWORD",
    ],
    playableFixture: [
      "PHASE5D_SMOKE_TOURNAMENT_ID",
      "PHASE5D_SMOKE_MATCHUP_EXTERNAL_ID",
      "PHASE5D_SMOKE_SUB_MATCH_EXTERNAL_ID",
    ],
    optional: ["PHASE5D_SMOKE_REPORT_DIR", "PHASE5D_SMOKE_RUN_ID"],
    forbidden: [
      "Production URL/keys",
      "VITE_SUPABASE_* fallback for client construction",
      "password/email/JWT in argv/chat/report/console",
      "SQL_PATCHES re-apply",
      "S2 approve decision",
    ],
  };
}

export function redactText(text) {
  return String(text ?? "")
    .replace(JWT_RE, "[REDACTED_JWT]")
    .replace(BEARER_RE, "Bearer [REDACTED]")
    .replace(PASSWORD_ASSIGN_RE, "password=[REDACTED]")
    .replace(EMAIL_RE, "[REDACTED_EMAIL]");
}

export function redactReport(report) {
  function walk(value, keyHint = "") {
    if (value == null) return value;
    if (typeof value === "string") {
      if (SENSITIVE_KEY_RE.test(keyHint)) return "[REDACTED]";
      return redactText(value);
    }
    if (Array.isArray(value)) return value.map((v) => walk(v, keyHint));
    if (typeof value === "object") {
      const out = {};
      for (const [k, v] of Object.entries(value)) {
        out[k] = SENSITIVE_KEY_RE.test(k) ? "[REDACTED]" : walk(v, k);
      }
      return out;
    }
    return value;
  }
  return walk(report);
}

export function safeErrorMessage(err) {
  return redactText(String(err?.message || err || "unknown_error"));
}

/**
 * Resolve real paths (symlink-aware) and refuse any report path inside the repo.
 */
export function assertReportPathOutsideRepository(reportFilePath, repositoryRoot) {
  const realpath = (p) => {
    try {
      return fs.realpathSync.native ? fs.realpathSync.native(p) : fs.realpathSync(p);
    } catch {
      return path.resolve(p);
    }
  };

  const rootReal = realpath(repositoryRoot);
  const fileAbs = path.resolve(reportFilePath);
  let fileReal;
  try {
    fileReal = realpath(fileAbs);
  } catch {
    // Parent may not exist yet — realpath the parent and join basename.
    const parent = path.dirname(fileAbs);
    fs.mkdirSync(parent, { recursive: true });
    const parentReal = realpath(parent);
    fileReal = path.join(parentReal, path.basename(fileAbs));
  }

  const rootPrefix = rootReal.endsWith(path.sep) ? rootReal : rootReal + path.sep;
  if (fileReal === rootReal || fileReal.startsWith(rootPrefix)) {
    throw new Error("REPORT_MUST_BE_OUTSIDE_REPOSITORY");
  }
  return fileReal;
}

export function assertDistinctIdentityFixtures(manager, referee) {
  const me = String(manager?.email || "").trim().toLowerCase();
  const re = String(referee?.email || "").trim().toLowerCase();
  const mid = String(manager?.userId || "").trim();
  const rid = String(referee?.userId || "").trim();
  if (!me || !re) {
    throw new Error("DISTINCT_JWT_REQUIRED: manager and referee emails required");
  }
  if (me === re) {
    throw new Error("DISTINCT_JWT_REQUIRED: manager and referee emails must differ (no BTC collapse)");
  }
  if (mid && rid && mid === rid) {
    throw new Error("DISTINCT_JWT_REQUIRED: manager and referee user ids must differ");
  }
  return true;
}

export function evaluateS1SelectPass({
  rows,
  expectedCorrectionId,
  expectedStatus = "pending",
}) {
  const list = Array.isArray(rows) ? rows : [];
  if (list.length !== 1) {
    return {
      pass: false,
      reason: `expected_row_count=1 actual=${list.length}`,
    };
  }
  const row = list[0];
  const id = String(row.id || "");
  const status = String(row.status || "");
  if (id !== String(expectedCorrectionId)) {
    return {
      pass: false,
      reason: "id_mismatch",
    };
  }
  if (status !== expectedStatus) {
    return {
      pass: false,
      reason: `status_mismatch expected=${expectedStatus} actual=${status}`,
    };
  }
  return { pass: true, reason: "row_count=1 id_status_match" };
}

export function evaluateS2RejectPass({ decisionSent, reviewOk, resultingStatus }) {
  if (decisionSent !== S2_REVIEW_DECISION) {
    return { pass: false, reason: "decision_must_be_reject" };
  }
  if (reviewOk !== true) {
    return { pass: false, reason: "review_rpc_not_ok" };
  }
  if (resultingStatus != null && String(resultingStatus).toLowerCase() === "approved") {
    return { pass: false, reason: "approve_outcome_forbidden" };
  }
  if (
    resultingStatus != null &&
    !["rejected", "reject", "declined"].includes(String(resultingStatus).toLowerCase())
  ) {
    // Allow null/undefined when RPC omits status; forbid approved explicitly above.
    // If status present, require reject family.
    return { pass: false, reason: `unexpected_status=${resultingStatus}` };
  }
  return { pass: true, reason: "reject_only" };
}

export function evaluateAnonDenialPass(results) {
  const list = Array.isArray(results) ? results : [];
  if (!list.length) {
    return { pass: false, reason: "no_anon_probes" };
  }
  for (const r of list) {
    if (r.ok === true) {
      return { pass: false, reason: `unexpected_success rpc=${r.rpc}` };
    }
    if (!isAuthorizationDenialError(r.error || r)) {
      return {
        pass: false,
        reason: `non_authorization_error rpc=${r.rpc} code=${r.error?.code || "n/a"}`,
      };
    }
  }
  return { pass: true, reason: "all_anon_probes_authorization_denied" };
}

export function defaultReportDir(envTemp = process.env.TEMP || process.env.TMPDIR || "/tmp") {
  return String(envTemp);
}

export function buildSmokeReportSkeleton({ probe, headSha, matrix }) {
  return {
    marker: "PHASE5D_POST_APPLY_RUNTIME_SMOKE_REPORT",
    generatedAt: new Date().toISOString(),
    stagingProjectRef: STAGING_PROJECT_REF,
    forbiddenProductionRef: FORBIDDEN_PRODUCTION_REF,
    provenanceExpected: PROVENANCE,
    publicDenialEvidence: PUBLIC_DENIAL_EVIDENCE,
    s2ReviewDecision: S2_REVIEW_DECISION,
    headSha: headSha || null,
    probe: {
      runId: probe.runId,
      namespace: probe.namespace,
      requestId: probe.requestId,
    },
    caseMatrix: matrix,
    cases: [],
    trackedIds: createIdTracker(),
    verdict: "PENDING",
    executeAuthorized: false,
    databaseCalls: 0,
  };
}
