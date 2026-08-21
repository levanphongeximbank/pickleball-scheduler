/**
 * Phase 5D post-apply runtime smoke driver.
 *
 * Default: offline plan only — NO Supabase clients, NO network/database calls.
 * Live Staging requires PHASE5D_POST_APPLY_SMOKE_EXECUTE=1 plus Staging-only fixtures.
 *
 * Never re-applies TT5-D SQL_PATCHES. Never targets Production.
 * Credentials/emails/JWTs never printed or written unredacted.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";
import {
  STAGING_PROJECT_REF,
  FORBIDDEN_PRODUCTION_REF,
  PROVENANCE,
  PUBLIC_DENIAL_EVIDENCE,
  S2_REVIEW_DECISION,
  createRunScopedProbe,
  assertStagingProjectRefGate,
  assertExecuteGate,
  assertDistinctIdentityFixtures,
  assertReportPathOutsideRepository,
  isAuthorizationDenialError,
  FK_SAFE_TEARDOWN_ORDER,
  createIdTracker,
  trackId,
  buildOrderedCaseMatrix,
  requiredFixtureVariables,
  redactReport,
  redactText,
  safeErrorMessage,
  evaluateS1SelectPass,
  evaluateS2RejectPass,
  evaluateAnonDenialPass,
  defaultReportDir,
  buildSmokeReportSkeleton,
} from "./phase5d-post-apply-runtime-smoke-lib.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../../../..");

function gitHead() {
  const r = spawnSync("git", ["rev-parse", "HEAD"], { encoding: "utf8", cwd: ROOT });
  return r.status === 0 ? r.stdout.trim() : null;
}

function envFlagTrue(name) {
  return ["1", "true", "yes", "on"].includes(String(process.env[name] || "").trim().toLowerCase());
}

function readStagingOnlyConfig() {
  const url = String(process.env.STAGING_SUPABASE_URL || "").trim();
  const anonKey = String(process.env.STAGING_SUPABASE_ANON_KEY || "").trim();
  const serviceKey = String(process.env.STAGING_SUPABASE_SERVICE_ROLE_KEY || "").trim();
  assertStagingProjectRefGate({ url, projectRef: STAGING_PROJECT_REF });
  if (!anonKey) throw new Error("STAGING_SUPABASE_ANON_KEY required");
  if (!serviceKey) throw new Error("STAGING_SUPABASE_SERVICE_ROLE_KEY required");
  return { url, anonKey, serviceKey, stagingRef: STAGING_PROJECT_REF };
}

function readIdentityFixtures() {
  const managerEmail = String(process.env.PHASE5D_SMOKE_MANAGER_EMAIL || "").trim();
  const refereeEmail = String(process.env.PHASE5D_SMOKE_REFEREE_EMAIL || "").trim();
  const managerPassword = String(process.env.PHASE5D_SMOKE_MANAGER_PASSWORD || "").trim();
  const refereePassword = String(process.env.PHASE5D_SMOKE_REFEREE_PASSWORD || "").trim();
  assertDistinctIdentityFixtures({ email: managerEmail }, { email: refereeEmail });
  if (!managerPassword || !refereePassword) {
    throw new Error("MANAGER_AND_REFEREE_PASSWORDS_REQUIRED via secure env");
  }
  return {
    managerEmail,
    refereeEmail,
    managerPassword,
    refereePassword,
    tournamentId: String(process.env.PHASE5D_SMOKE_TOURNAMENT_ID || "").trim(),
    matchupExternalId: String(process.env.PHASE5D_SMOKE_MATCHUP_EXTERNAL_ID || "").trim(),
    subMatchExternalId: String(process.env.PHASE5D_SMOKE_SUB_MATCH_EXTERNAL_ID || "").trim(),
  };
}

function recordCase(report, id, name, pass, detail = {}) {
  report.cases.push(redactReport({
    id,
    name,
    pass: Boolean(pass),
    ...detail,
  }));
}

async function rpc(client, fn, args) {
  const { data, error } = await client.rpc(fn, args);
  if (error) {
    return {
      ok: false,
      error: { code: error.code, message: redactText(error.message || "") },
    };
  }
  if (data && typeof data === "object") {
    return { ok: data.ok !== false, ...data };
  }
  return { ok: true, data };
}

async function signIn(client, email, password) {
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) {
    throw new Error(`Sign-in failed for configured fixture role (${safeErrorMessage(error)})`);
  }
  return data.session;
}

function writeRedactedReport(report, reportDir) {
  const dir = reportDir || defaultReportDir();
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(
    dir,
    `phase5d_post_apply_smoke_${report.probe.namespace}_REDACTED.json`,
  );
  const safePath = assertReportPathOutsideRepository(file, ROOT);
  const redacted = redactReport(report);
  fs.writeFileSync(safePath, JSON.stringify(redacted, null, 2));
  return safePath;
}

async function assertProbeKeysAbsent(admin, probe) {
  const { data: corr, error: cErr } = await admin
    .from("team_tournament_referee_correction_requests")
    .select("id")
    .eq("request_id", probe.requestId)
    .limit(1);
  if (cErr) {
    const { data: byReason, error: rErr } = await admin
      .from("team_tournament_referee_correction_requests")
      .select("id")
      .ilike("reason", `%${probe.namespace}%`)
      .limit(1);
    if (rErr) throw new Error(`PROBE_PREFLIGHT_QUERY_FAILED: ${safeErrorMessage(cErr)}`);
    if (byReason?.length) {
      throw new Error("PROBE_KEY_EXISTS: namespace already present in corrections");
    }
  } else if (corr?.length) {
    throw new Error("PROBE_KEY_EXISTS: request_id already present");
  }

  const { data: assigns, error: aErr } = await admin
    .from("referee_assignments")
    .select("id")
    .ilike("revoke_reason", `%${probe.namespace}%`)
    .limit(1);
  if (!aErr && assigns?.length) {
    throw new Error("PROBE_KEY_EXISTS: assignment reason tag already present");
  }
}

async function teardownTrackedIds(admin, tracker) {
  const leftovers = [];
  for (const step of FK_SAFE_TEARDOWN_ORDER) {
    const ids = tracker[step.key] || [];
    for (const id of ids) {
      const { error } = await admin.from(step.table).delete().eq(step.column, id);
      if (error) {
        leftovers.push({ table: step.table, id, error: safeErrorMessage(error) });
        continue;
      }
      const { data: still } = await admin
        .from(step.table)
        .select(step.column)
        .eq(step.column, id)
        .limit(1);
      if (still?.length) {
        leftovers.push({ table: step.table, id, error: "still_present_after_delete" });
      }
    }
  }
  return leftovers;
}

/**
 * Live Staging execution — EXECUTE gate must be open before any client.
 */
export async function runLiveSmoke(deps = {}) {
  assertExecuteGate(deps.env || process.env);

  const cfg = readStagingOnlyConfig();
  const fixtures = readIdentityFixtures();
  if (!fixtures.tournamentId || !fixtures.matchupExternalId || !fixtures.subMatchExternalId) {
    throw new Error("PLAYABLE_FIXTURE_IDS_REQUIRED");
  }

  const createClient =
    deps.createClient ||
    (await import("@supabase/supabase-js")).createClient;

  const probe = createRunScopedProbe(
    (deps.env || process.env).PHASE5D_SMOKE_RUN_ID,
  );
  const matrix = buildOrderedCaseMatrix();
  const report = buildSmokeReportSkeleton({
    probe,
    headSha: gitHead(),
    matrix,
  });
  report.executeAuthorized = true;
  report.trackedIds = createIdTracker();

  let admin = null;
  let firstFailure = null;

  try {
    admin = createClient(cfg.url, cfg.serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const managerClient = createClient(cfg.url, cfg.anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const refereeClient = createClient(cfg.url, cfg.anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const anonClient = createClient(cfg.url, cfg.anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    report.databaseCalls += 1;

    const managerSession = await signIn(
      managerClient,
      fixtures.managerEmail,
      fixtures.managerPassword,
    );
    const refereeSession = await signIn(
      refereeClient,
      fixtures.refereeEmail,
      fixtures.refereePassword,
    );
    assertDistinctIdentityFixtures(
      { email: fixtures.managerEmail, userId: managerSession.user.id },
      { email: fixtures.refereeEmail, userId: refereeSession.user.id },
    );
    report.databaseCalls += 2;

    let provenanceOk = false;
    try {
      const mig = createClient(cfg.url, cfg.serviceKey, {
        auth: { persistSession: false, autoRefreshToken: false },
        db: { schema: "supabase_migrations" },
      });
      const { data, error } = await mig
        .from("schema_migrations")
        .select("version, name")
        .or(`version.eq.${PROVENANCE.version},name.eq.${PROVENANCE.name}`)
        .limit(5);
      report.databaseCalls += 1;
      if (!error && Array.isArray(data) && data.length) provenanceOk = true;
    } catch {
      provenanceOk = false;
    }
    if (!provenanceOk) {
      throw new Error(
        `PROVENANCE_ABSENT: required ${PROVENANCE.version} / ${PROVENANCE.name}`,
      );
    }
    recordCase(report, "S0", "preflight_gates", true, { provenance: PROVENANCE });

    await assertProbeKeysAbsent(admin, probe);
    report.databaseCalls += 1;
    recordCase(report, "S0a", "probe_keys_absent", true, { namespace: probe.namespace });

    const createAssign = await rpc(managerClient, "team_tournament_create_referee_assignment", {
      p_tournament_id: fixtures.tournamentId,
      p_matchup_id: fixtures.matchupExternalId,
      p_sub_match_id: fixtures.subMatchExternalId,
      p_referee_user_id: refereeSession.user.id,
      p_expires_at: new Date(Date.now() + 3600_000).toISOString(),
      p_activate: true,
      p_idempotency_key: probe.assignmentIdempotencyKey,
      p_reason: probe.namespace,
    });
    report.databaseCalls += 1;
    if (!createAssign.ok || !createAssign.assignmentId) {
      throw new Error(`S0b_ASSIGN_FAILED: ${safeErrorMessage(createAssign.error)}`);
    }
    trackId(report.trackedIds, "assignmentIds", createAssign.assignmentId);
    recordCase(report, "S0b", "create_assignment_for_referee", true, {
      assignmentId: createAssign.assignmentId,
    });

    const corrReq = await rpc(refereeClient, "team_tournament_request_referee_correction", {
      p_tournament_id: fixtures.tournamentId,
      p_match_id: fixtures.subMatchExternalId,
      p_result_revision_id: null,
      p_proposed_score: { teamA: 11, teamB: 9 },
      p_proposed_winner: null,
      p_reason: `phase5d smoke ${probe.namespace}`,
      p_request_id: probe.requestId,
      p_idempotency_key: `${probe.namespace}_corr_idem`,
      p_expected_version: null,
    });
    report.databaseCalls += 1;
    if (!corrReq.ok || !corrReq.correctionRequestId) {
      if (isAuthorizationDenialError(corrReq.error)) {
        throw new Error(`S0c_UNEXPECTED_AUTH_DENIAL: ${safeErrorMessage(corrReq.error)}`);
      }
      throw new Error(`S0c_CORRECTION_CREATE_FAILED: ${safeErrorMessage(corrReq.error)}`);
    }
    trackId(report.trackedIds, "correctionRequestIds", corrReq.correctionRequestId);
    const expectedStatus = String(corrReq.status || "pending");
    recordCase(report, "S0c", "create_isolated_correction_via_canonical_rpc", true, {
      correctionRequestId: corrReq.correctionRequestId,
      status: expectedStatus,
    });

    const { data: selectRows, error: selectErr } = await managerClient
      .from("team_tournament_referee_correction_requests")
      .select("id,status,request_id")
      .eq("id", corrReq.correctionRequestId);
    report.databaseCalls += 1;
    if (selectErr) throw new Error(`S1_SELECT_ERROR: ${safeErrorMessage(selectErr)}`);
    const s1 = evaluateS1SelectPass({
      rows: selectRows,
      expectedCorrectionId: corrReq.correctionRequestId,
      expectedStatus,
    });
    recordCase(report, "S1", "authenticated_correction_select", s1.pass, s1);
    if (!s1.pass) throw new Error(`S1_FAIL: ${s1.reason}`);

    // S2 — deterministic REJECT only (no approve fallback)
    if (S2_REVIEW_DECISION !== "reject") {
      throw new Error("S2_CONFIG_INVALID: S2_REVIEW_DECISION must be reject");
    }
    const review = await rpc(managerClient, "team_tournament_review_referee_correction", {
      p_tournament_id: fixtures.tournamentId,
      p_correction_request_id: corrReq.correctionRequestId,
      p_decision: S2_REVIEW_DECISION,
      p_review_reason: `phase5d smoke reject ${probe.namespace}`,
      p_expected_version: corrReq.version ?? 1,
      p_idempotency_key: probe.reviewIdempotencyKey,
    });
    report.databaseCalls += 1;
    const resultingStatus = review.status || review.decision || review.correctionStatus || null;
    const s2 = evaluateS2RejectPass({
      decisionSent: S2_REVIEW_DECISION,
      reviewOk: review.ok === true,
      resultingStatus,
    });
    recordCase(report, "S2", "authorized_correction_review_reject_only", s2.pass, {
      ...s2,
      decisionSent: S2_REVIEW_DECISION,
      resultingStatus,
    });
    if (!s2.pass) throw new Error(`S2_FAIL: ${s2.reason}`);

    const anonProbes = [];
    for (const fn of [
      "team_tournament_request_referee_correction",
      "team_tournament_create_referee_assignment",
      "team_tournament_referee_match_access_ops",
      "referee_v5_assignment_effective_status",
      "referee_v5_current_user_has_assignment",
    ]) {
      const args =
        fn === "team_tournament_referee_match_access_ops"
          ? { p_tournament_id: fixtures.tournamentId, p_match_id: fixtures.subMatchExternalId }
          : fn === "referee_v5_assignment_effective_status"
            ? {
                p_status: "active",
                p_assigned_at: new Date().toISOString(),
                p_expires_at: new Date(Date.now() + 60000).toISOString(),
              }
            : fn === "referee_v5_current_user_has_assignment"
              ? {
                  p_tenant_id: "x",
                  p_tournament_id: fixtures.tournamentId,
                  p_match_id: fixtures.subMatchExternalId,
                  p_statuses: ["active"],
                }
              : fn === "team_tournament_create_referee_assignment"
                ? {
                    p_tournament_id: fixtures.tournamentId,
                    p_matchup_id: fixtures.matchupExternalId,
                    p_sub_match_id: fixtures.subMatchExternalId,
                    p_referee_user_id: refereeSession.user.id,
                    p_expires_at: new Date(Date.now() + 60000).toISOString(),
                    p_activate: true,
                    p_idempotency_key: `${probe.namespace}_anon_assign`,
                    p_reason: "anon",
                  }
                : {
                    p_tournament_id: fixtures.tournamentId,
                    p_match_id: fixtures.subMatchExternalId,
                    p_result_revision_id: null,
                    p_proposed_score: { teamA: 1, teamB: 0 },
                    p_proposed_winner: null,
                    p_reason: "anon",
                    p_request_id: `${probe.namespace}_anon`,
                    p_idempotency_key: `${probe.namespace}_anon_idem`,
                  };
      const res = await rpc(anonClient, fn, args);
      report.databaseCalls += 1;
      anonProbes.push({ rpc: fn, ok: res.ok === true, error: res.error || null });
    }
    const s3 = evaluateAnonDenialPass(anonProbes);
    recordCase(report, "S3", "runtime_anon_execute_denial", s3.pass, {
      ...s3,
      publicDenial: "sql20_catalog_evidence_only",
      probes: anonProbes.map((p) => ({
        rpc: p.rpc,
        ok: p.ok,
        code: p.error?.code || null,
      })),
    });
    if (!s3.pass) throw new Error(`S3_FAIL: ${s3.reason}`);

    const access = await rpc(refereeClient, "team_tournament_referee_match_access_ops", {
      p_tournament_id: fixtures.tournamentId,
      p_match_id: fixtures.subMatchExternalId,
    });
    report.databaseCalls += 1;
    const list = await rpc(managerClient, "team_tournament_list_referee_assignments", {
      p_tournament_id: fixtures.tournamentId,
      p_match_id: fixtures.subMatchExternalId,
    });
    report.databaseCalls += 1;
    const revoke = await rpc(managerClient, "team_tournament_revoke_referee_assignment", {
      p_tournament_id: fixtures.tournamentId,
      p_assignment_id: createAssign.assignmentId,
      p_expected_version: createAssign.version ?? 1,
      p_reason: probe.namespace,
      p_idempotency_key: `${probe.namespace}_revoke`,
    });
    report.databaseCalls += 1;
    const s4Pass =
      access.ok !== false &&
      (access.canWrite === true || access.readOnly === true || access.ok === true) &&
      list.ok !== false &&
      revoke.ok === true;
    recordCase(report, "S4", "referee_assignment_authorized_flows", s4Pass, {
      accessOk: access.ok !== false,
      listOk: list.ok !== false,
      revokeOk: revoke.ok === true,
    });
    if (!s4Pass) throw new Error("S4_FAIL");
  } catch (err) {
    firstFailure = err;
    recordCase(report, "FAIL", "first_failure", false, {
      message: safeErrorMessage(err),
    });
  } finally {
    let leftovers = [];
    const hasTracked = Object.values(report.trackedIds || {}).some(
      (ids) => Array.isArray(ids) && ids.length > 0,
    );
    try {
      if (admin) {
        leftovers = await teardownTrackedIds(admin, report.trackedIds);
        report.databaseCalls += 1;
      } else if (hasTracked) {
        leftovers.push({ error: "admin_client_unavailable_for_teardown" });
      }
    } catch (tearErr) {
      leftovers.push({ error: safeErrorMessage(tearErr) });
    }
    const tearPass = leftovers.length === 0;
    recordCase(report, "T", "teardown_tracked_ids_fk_safe_finally", tearPass, {
      leftovers,
      teardownFailureEqualsFail: true,
      fkOrder: FK_SAFE_TEARDOWN_ORDER.map((s) => s.key),
    });
    if (!tearPass) {
      report.verdict = "FAIL";
      firstFailure = firstFailure || new Error("TEARDOWN_FAIL");
    } else if (firstFailure) {
      report.verdict = "FAIL";
    } else {
      report.verdict = "PASS";
    }
  }

  const reportPath = writeRedactedReport(
    report,
    (deps.env || process.env).PHASE5D_SMOKE_REPORT_DIR || defaultReportDir(),
  );
  return { report: redactReport(report), reportPath, firstFailure, verdict: report.verdict };
}

export function printOfflinePlan() {
  return {
    marker: "PHASE5D_POST_APPLY_RUNTIME_SMOKE_OFFLINE_PLAN",
    executeGate: "PHASE5D_POST_APPLY_SMOKE_EXECUTE not set — no database calls",
    stagingProjectRef: STAGING_PROJECT_REF,
    forbiddenProductionRef: FORBIDDEN_PRODUCTION_REF,
    provenanceRequired: PROVENANCE,
    publicDenialEvidence: PUBLIC_DENIAL_EVIDENCE,
    s2ReviewDecision: S2_REVIEW_DECISION,
    fixtures: requiredFixtureVariables(),
    caseMatrix: buildOrderedCaseMatrix(),
    historicalSqlPatches: "REFUSED_NOT_RETAINED",
  };
}

async function main() {
  if (!envFlagTrue("PHASE5D_POST_APPLY_SMOKE_EXECUTE")) {
    process.stdout.write(`${JSON.stringify(printOfflinePlan(), null, 2)}\n`);
    process.exitCode = 0;
    return;
  }
  try {
    const { verdict, reportPath, firstFailure } = await runLiveSmoke();
    process.stdout.write(
      `${JSON.stringify(
        redactReport({ verdict, reportPath, failed: Boolean(firstFailure) }),
        null,
        2,
      )}\n`,
    );
    process.exitCode = verdict === "PASS" ? 0 : 1;
  } catch (err) {
    process.stderr.write(`${safeErrorMessage(err)}\n`);
    process.exitCode = 1;
  }
}

const isDirect =
  process.argv[1] &&
  pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;

if (isDirect) {
  main();
}
