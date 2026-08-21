/**
 * Offline tests for Phase 5D post-apply runtime smoke lib + execute gate.
 * No database calls. No Staging/Production clients.
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
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
  buildSmokeReportSkeleton,
} from "../docs/platform-hard-cutover-01/phase-05d-tt5d-controlled-reconciliation/scripts/phase5d-post-apply-runtime-smoke-lib.mjs";
import {
  printOfflinePlan,
  runLiveSmoke,
} from "../docs/platform-hard-cutover-01/phase-05d-tt5d-controlled-reconciliation/scripts/phase5d-post-apply-runtime-smoke.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const DRIVER = path.join(
  ROOT,
  "docs/platform-hard-cutover-01/phase-05d-tt5d-controlled-reconciliation/scripts/phase5d-post-apply-runtime-smoke.mjs",
);
const LIB = path.join(
  ROOT,
  "docs/platform-hard-cutover-01/phase-05d-tt5d-controlled-reconciliation/scripts/phase5d-post-apply-runtime-smoke-lib.mjs",
);

test("case matrix places S0c before S1 and S2 is reject-only", () => {
  const matrix = buildOrderedCaseMatrix();
  const ids = matrix.map((c) => c.id);
  assert.ok(ids.indexOf("S0c") < ids.indexOf("S1"));
  const s2 = matrix.find((c) => c.id === "S2");
  assert.equal(s2.decision, "reject");
  assert.equal(S2_REVIEW_DECISION, "reject");
  assert.match(s2.note, /MUST|forbidden|Approve/i);
  assert.equal(PUBLIC_DENIAL_EVIDENCE.runtimeCase, false);
});

test("run-scoped probe namespace uniqueness", () => {
  const a = createRunScopedProbe("11111111-2222-3333-4444-555555555555");
  const b = createRunScopedProbe("aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee");
  assert.notEqual(a.namespace, b.namespace);
  assert.match(a.requestId, /^p5dsm_/);
});

test("staging ref gate and Production refusal", () => {
  assert.doesNotThrow(() =>
    assertStagingProjectRefGate({
      url: `https://${STAGING_PROJECT_REF}.supabase.co`,
      projectRef: STAGING_PROJECT_REF,
    }),
  );
  assert.throws(
    () =>
      assertStagingProjectRefGate({
        url: `https://${FORBIDDEN_PRODUCTION_REF}.supabase.co`,
      }),
    /PRODUCTION_FORBIDDEN/,
  );
});

test("execute gate is fail-closed", () => {
  assert.throws(() => assertExecuteGate({}), /EXECUTE_GATE_CLOSED/);
  assert.throws(
    () => assertExecuteGate({ PHASE5D_POST_APPLY_SMOKE_EXECUTE: "0" }),
    /EXECUTE_GATE_CLOSED/,
  );
  assert.doesNotThrow(() =>
    assertExecuteGate({ PHASE5D_POST_APPLY_SMOKE_EXECUTE: "1" }),
  );
});

test("runLiveSmoke refuses client construction without EXECUTE gate", async () => {
  let created = 0;
  await assert.rejects(
    () =>
      runLiveSmoke({
        env: { PHASE5D_POST_APPLY_SMOKE_EXECUTE: "" },
        createClient: () => {
          created += 1;
          throw new Error("should_not_construct");
        },
      }),
    /EXECUTE_GATE_CLOSED/,
  );
  assert.equal(created, 0);
});

test("distinct manager/referee required", () => {
  assert.throws(
    () =>
      assertDistinctIdentityFixtures(
        { email: "same@ex.com", userId: "1" },
        { email: "same@ex.com", userId: "2" },
      ),
    /DISTINCT_JWT_REQUIRED/,
  );
});

test("authorization denial classifier", () => {
  assert.equal(isAuthorizationDenialError({ code: "42501", message: "permission denied" }), true);
  assert.equal(isAuthorizationDenialError({ message: "invalid input syntax" }), false);
});

test("S1 exact row count/id/status", () => {
  assert.equal(
    evaluateS1SelectPass({
      rows: [{ id: "c1", status: "pending" }],
      expectedCorrectionId: "c1",
    }).pass,
    true,
  );
  assert.equal(
    evaluateS1SelectPass({
      rows: [{ id: "c1", status: "pending" }, { id: "c2", status: "pending" }],
      expectedCorrectionId: "c1",
    }).pass,
    false,
  );
});

test("S2 reject-only evaluator forbids approve", () => {
  assert.equal(
    evaluateS2RejectPass({
      decisionSent: "reject",
      reviewOk: true,
      resultingStatus: "rejected",
    }).pass,
    true,
  );
  assert.equal(
    evaluateS2RejectPass({
      decisionSent: "approve",
      reviewOk: true,
      resultingStatus: "approved",
    }).pass,
    false,
  );
  assert.equal(
    evaluateS2RejectPass({
      decisionSent: "reject",
      reviewOk: true,
      resultingStatus: "approved",
    }).pass,
    false,
  );
});

test("anon denial PASS requires authorization errors only", () => {
  assert.equal(
    evaluateAnonDenialPass([
      { rpc: "a", ok: false, error: { code: "42501", message: "permission denied" } },
    ]).pass,
    true,
  );
  assert.equal(
    evaluateAnonDenialPass([{ rpc: "a", ok: false, error: { message: "invalid uuid" } }]).pass,
    false,
  );
});

test("FK teardown order and tracker", () => {
  assert.equal(FK_SAFE_TEARDOWN_ORDER[0].key, "correctionRequestIds");
  const t = createIdTracker();
  trackId(t, "assignmentIds", "a1");
  assert.deepEqual(t.assignmentIds, ["a1"]);
});

test("redaction covers passwords JWTs keys emails authorization headers", () => {
  const red = redactReport({
    password: "secret",
    email: "a@b.com",
    managerEmail: "m@x.com",
    authorization: "Bearer abc",
    anonKey: "eyJhbGciOiJIUzI1NiJ9.aaa.bbb",
    service_role: "key",
    note: "user a@b.com token eyJhbGciOiJIUzI1NiJ9.aaa.bbb",
  });
  assert.equal(red.password, "[REDACTED]");
  assert.equal(red.email, "[REDACTED]");
  assert.equal(red.managerEmail, "[REDACTED]");
  assert.equal(red.authorization, "[REDACTED]");
  assert.equal(red.anonKey, "[REDACTED]");
  assert.equal(red.service_role, "[REDACTED]");
  assert.equal(red.note.includes("@"), false);
  assert.equal(red.note.includes("eyJ"), false);
  assert.match(redactText("Bearer secret-token"), /REDACTED/);
  assert.equal(safeErrorMessage(new Error("fail a@b.com")).includes("@"), false);
});

test("report path refuses repository destination even via symlink-style resolve", () => {
  const inside = path.join(ROOT, "tmp-should-refuse-report.json");
  assert.throws(
    () => assertReportPathOutsideRepository(inside, ROOT),
    /REPORT_MUST_BE_OUTSIDE_REPOSITORY/,
  );
  const outside = path.join(os.tmpdir(), `phase5d-smoke-test-${Date.now()}.json`);
  const ok = assertReportPathOutsideRepository(outside, ROOT);
  assert.ok(ok.includes(path.basename(outside)) || fs.existsSync(path.dirname(ok)));
});

test("provenance and fixtures docs", () => {
  assert.equal(PROVENANCE.version, "20260731150000");
  const f = requiredFixtureVariables();
  assert.ok(f.forbidden.join(" ").includes("S2 approve"));
  assert.ok(f.distinctJwt.includes("PHASE5D_SMOKE_REFEREE_EMAIL"));
});

test("offline plan and default driver spawn make no DB calls", () => {
  const plan = printOfflinePlan();
  assert.equal(plan.s2ReviewDecision, "reject");
  assert.equal(plan.historicalSqlPatches, "REFUSED_NOT_RETAINED");
  const r = spawnSync(process.execPath, [DRIVER], {
    cwd: ROOT,
    encoding: "utf8",
    env: {
      ...process.env,
      PHASE5D_POST_APPLY_SMOKE_EXECUTE: "",
      VITE_SUPABASE_URL: `https://${FORBIDDEN_PRODUCTION_REF}.supabase.co`,
    },
  });
  assert.equal(r.status, 0, r.stderr || r.stdout);
  assert.match(JSON.parse(r.stdout).executeGate, /no database calls/i);
});

test("driver source has no SQL_PATCHES and requires execute gate before clients", () => {
  const src = fs.readFileSync(DRIVER, "utf8");
  assert.doesNotMatch(src, /SQL_PATCHES\s*=/);
  assert.match(src, /assertExecuteGate/);
  assert.match(src, /S2_REVIEW_DECISION/);
  assert.match(src, /assertReportPathOutsideRepository/);
  assert.ok(src.indexOf("assertExecuteGate") < src.indexOf("createClient"));
  const lib = fs.readFileSync(LIB, "utf8");
  assert.match(lib, /S2_REVIEW_DECISION = "reject"/);
});

test("smoke report skeleton defaults", () => {
  const probe = createRunScopedProbe("00000000-0000-0000-0000-000000000001");
  const report = buildSmokeReportSkeleton({
    probe,
    headSha: "deadbeef",
    matrix: buildOrderedCaseMatrix(),
  });
  assert.equal(report.executeAuthorized, false);
  assert.equal(report.databaseCalls, 0);
  assert.equal(report.s2ReviewDecision, "reject");
});
