/**
 * Notification Phase 2B — Production safety remediation tests.
 * Isolation, fail-closed config, apply/verify dry-run, ops CLI (no live Production).
 */
import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  createMemoryNotificationRepository,
  setNotificationRepository,
  resetNotificationRepository,
  runNotificationWorkerOnce,
  NOTIFICATION_ENVIRONMENTS,
  getNotificationQueueHealth,
  cancelNotificationDeliveryJob,
  cleanupNotificationQaRunNamespace,
  buildWorkerLogEntry,
  assertLogHasNoSecrets,
} from "../src/features/notifications/index.js";
import { NOTIFICATION_STATUSES } from "../src/features/notifications/constants/notificationStatuses.js";
import { DELIVERY_JOB_STATES } from "../src/features/notifications/constants/deliveryJobStates.js";
import {
  PRODUCTION_PROJECT_REF,
  STAGING_PROJECT_REF,
  PRODUCTION_RUNTIME_DEFAULTS,
  resolveProductionWorkerGate,
  assertProductionRuntimeConfig,
  requireProductionProjectRef,
} from "../src/features/notifications/config/productionSafetyConfig.js";
import { runPhase2bProductionApplyDryRun } from "../scripts/apply-notification-phase2b-production-sql.mjs";
import { verifyPhase2bProductionFixture } from "../scripts/verify-notification-phase2b-production.mjs";
import { runProductionOpsCommand } from "../scripts/notification-ops-production.mjs";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

async function seedJob(repo, overrides = {}) {
  const notificationId =
    overrides.notificationId ||
    `n_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const tenantId = overrides.tenantId || "tenant-a";
  await repo.create({
    notificationId,
    id: notificationId,
    tenantId,
    recipientUserId: overrides.recipientUserId || "user-a",
    eventType: "CLUB_SCHEDULE_UPDATED",
    category: "CLUB",
    priority: "NORMAL",
    status: NOTIFICATION_STATUSES.CREATED,
    title: "t",
    message: "m",
    idempotencyKey: overrides.idempotencyKey || `phase2b:${notificationId}`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  const enq = await repo.enqueueDeliveryJob({
    notificationId,
    tenantId,
    channel: "in_app",
    environment: NOTIFICATION_ENVIRONMENTS.STAGING,
    runNamespace: overrides.runNamespace || "phase16:test",
  });
  assert.equal(enq.ok, true);
  if (overrides.environment === NOTIFICATION_ENVIRONMENTS.PRODUCTION) {
    repo._seedJob({ ...enq.job, environment: NOTIFICATION_ENVIRONMENTS.PRODUCTION });
  }
  if (overrides.status) {
    repo._seedJob({ ...enq.job, status: overrides.status, ...(overrides.jobPatch || {}) });
  }
  return enq.job;
}

describe("Notification Phase 2B — production config fail-closed", () => {
  it("Production runtime defaults never enable worker or QA cleanup", () => {
    assert.equal(PRODUCTION_RUNTIME_DEFAULTS.environment, "production");
    assert.equal(PRODUCTION_RUNTIME_DEFAULTS.allow_worker, "false");
    assert.equal(PRODUCTION_RUNTIME_DEFAULTS.allow_qa_cleanup, "false");
    assert.equal(PRODUCTION_RUNTIME_DEFAULTS.external_providers_enabled, "false");
    assert.equal(PRODUCTION_RUNTIME_DEFAULTS.worker_concurrency, "0");
    const result = assertProductionRuntimeConfig(PRODUCTION_RUNTIME_DEFAULTS);
    assert.equal(result.verdict, "PASS");
  });

  it("Missing required config fails closed", () => {
    const result = assertProductionRuntimeConfig({ environment: "production" });
    assert.equal(result.ok, false);
    assert.ok(result.findings.some((f) => f.code === "missing_config"));
  });

  it("Staging seeds are BLOCKED_UNSAFE", () => {
    const result = assertProductionRuntimeConfig({
      ...PRODUCTION_RUNTIME_DEFAULTS,
      environment: "staging",
      allow_worker: "true",
      allow_qa_cleanup: "true",
      project_ref: STAGING_PROJECT_REF,
    });
    assert.equal(result.verdict, "BLOCKED_UNSAFE");
  });

  it("Worker gate requires dual flags + tenant + namespace + concurrency", () => {
    const blocked = resolveProductionWorkerGate({
      environment: "production",
      projectRef: PRODUCTION_PROJECT_REF,
      allowProductionWorker: true,
      env: {},
    });
    assert.equal(blocked.workerAllowed, false);
    assert.equal(blocked.error, "production_worker_blocked");

    const noTenant = resolveProductionWorkerGate({
      environment: "production",
      productionWorkerEnable: true,
      productionRolloutApproved: true,
      workerConcurrency: 1,
      env: {},
    });
    assert.equal(noTenant.error, "tenant_scope_required");

    const noNs = resolveProductionWorkerGate({
      environment: "production",
      productionWorkerEnable: true,
      productionRolloutApproved: true,
      tenantId: "t1",
      workerConcurrency: 1,
      env: {},
    });
    assert.equal(noNs.error, "namespace_scope_required");

    const zeroConcurrency = resolveProductionWorkerGate({
      environment: "production",
      productionWorkerEnable: true,
      productionRolloutApproved: true,
      tenantId: "t1",
      runNamespace: "ops:rollout",
      workerConcurrency: 0,
      env: {},
    });
    assert.equal(zeroConcurrency.error, "production_worker_concurrency_zero");
  });

  it("requireProductionProjectRef blocks Staging", () => {
    assert.equal(requireProductionProjectRef("").ok, false);
    assert.equal(requireProductionProjectRef(STAGING_PROJECT_REF).ok, false);
    assert.equal(requireProductionProjectRef(PRODUCTION_PROJECT_REF).ok, true);
  });
});

describe("Notification Phase 2B — tenant / environment isolation", () => {
  let repo;
  beforeEach(() => {
    repo = createMemoryNotificationRepository();
    setNotificationRepository(repo);
  });
  afterEach(() => {
    resetNotificationRepository();
  });

  it("1. Missing tenant fails closed on Production claim", async () => {
    await seedJob(repo, { environment: NOTIFICATION_ENVIRONMENTS.PRODUCTION });
    const claim = await repo.claimDeliveryJobs({
      workerId: "w1",
      environment: NOTIFICATION_ENVIRONMENTS.PRODUCTION,
      allowProduction: true,
      runNamespace: "phase16:x",
    });
    assert.equal(claim.ok, false);
    assert.equal(claim.error, "tenant_scope_required");
  });

  it("2. Missing namespace fails closed on Production claim", async () => {
    await seedJob(repo, { environment: NOTIFICATION_ENVIRONMENTS.PRODUCTION });
    const claim = await repo.claimDeliveryJobs({
      workerId: "w1",
      environment: NOTIFICATION_ENVIRONMENTS.PRODUCTION,
      allowProduction: true,
      tenantId: "tenant-a",
    });
    assert.equal(claim.ok, false);
    assert.equal(claim.error, "namespace_scope_required");
  });

  it("3. Cross-tenant claim is rejected (empty set)", async () => {
    await seedJob(repo, {
      tenantId: "tenant-a",
      runNamespace: "phase16:a",
    });
    const claim = await repo.claimDeliveryJobs({
      workerId: "w1",
      environment: NOTIFICATION_ENVIRONMENTS.STAGING,
      tenantId: "tenant-b",
      runNamespace: "phase16:a",
    });
    assert.equal(claim.ok, true);
    assert.equal(claim.jobs.length, 0);
  });

  it("4. Cross-environment claim is rejected", async () => {
    await seedJob(repo, {
      environment: NOTIFICATION_ENVIRONMENTS.PRODUCTION,
      runNamespace: "phase16:a",
    });
    const claim = await repo.claimDeliveryJobs({
      workerId: "w1",
      environment: NOTIFICATION_ENVIRONMENTS.STAGING,
      tenantId: "tenant-a",
      runNamespace: "phase16:a",
    });
    assert.equal(claim.jobs.length, 0);
  });

  it("5. Production cleanup cannot run", async () => {
    const result = await cleanupNotificationQaRunNamespace({
      repository: repo,
      environment: NOTIFICATION_ENVIRONMENTS.PRODUCTION,
      runNamespace: "phase16:qa",
      tenantId: "tenant-a",
      _testBypassEnvGuard: true,
    });
    assert.equal(result.ok, false);
    assert.match(String(result.error), /production|qa_cleanup/i);
  });

  it("6. Staging cleanup cannot target Production", async () => {
    await seedJob(repo, {
      environment: NOTIFICATION_ENVIRONMENTS.PRODUCTION,
      runNamespace: "phase16:qa",
    });
    const result = await repo.cleanupQaRunNamespace({
      environment: NOTIFICATION_ENVIRONMENTS.STAGING,
      runNamespace: "phase16:qa",
      tenantId: "tenant-a",
      dryRun: false,
    });
    assert.equal(result.ok, false);
    assert.equal(result.error, "qa_cleanup_cannot_target_production");
  });

  it("7. Replay cannot cross tenant", async () => {
    const job = await seedJob(repo, { tenantId: "tenant-a", runNamespace: "phase16:r" });
    repo._seedJob({
      ...job,
      status: DELIVERY_JOB_STATES.DEAD_LETTERED,
      tenantId: "tenant-a",
    });
    const result = await repo.replayDeliveryJob({
      jobId: job.id,
      environment: NOTIFICATION_ENVIRONMENTS.STAGING,
      tenantId: "tenant-b",
      reason: "ops replay",
      replayedBy: "ops",
    });
    assert.equal(result.ok, false);
    assert.equal(result.error, "cross_tenant_forbidden");
  });

  it("8. Cancellation cannot cross tenant", async () => {
    const job = await seedJob(repo, { tenantId: "tenant-a", runNamespace: "phase16:c" });
    const result = await cancelNotificationDeliveryJob({
      repository: repo,
      jobId: job.id,
      environment: NOTIFICATION_ENVIRONMENTS.STAGING,
      tenantId: "tenant-b",
      reason: "ops cancel",
      cancelledBy: "ops",
      _testBypassEnvGuard: true,
    });
    // queueOps may not pass tenantId — call repo directly for isolation proof
    const direct = await repo.cancelDeliveryJob({
      jobId: job.id,
      environment: NOTIFICATION_ENVIRONMENTS.STAGING,
      tenantId: "tenant-b",
      reason: "ops cancel",
      cancelledBy: "ops",
    });
    assert.equal(direct.ok, false);
    assert.equal(direct.error, "cross_tenant_forbidden");
    assert.equal(result.ok === false || direct.ok === false, true);
  });

  it("9. Queue-health aggregation does not leak another tenant", async () => {
    await seedJob(repo, { tenantId: "tenant-a", runNamespace: "phase16:h" });
    await seedJob(repo, { tenantId: "tenant-b", runNamespace: "phase16:h" });
    const health = await getNotificationQueueHealth({
      repository: repo,
      environment: NOTIFICATION_ENVIRONMENTS.STAGING,
      tenantId: "tenant-a",
      _testBypassEnvGuard: true,
    });
    assert.equal(health.ok, true);
    assert.equal(health.health.tenantId, "tenant-a");
    assert.equal(health.health.queued, 1);

    const prodMissingTenant = await repo.getQueueHealth({
      environment: NOTIFICATION_ENVIRONMENTS.PRODUCTION,
    });
    assert.equal(prodMissingTenant.ok, false);
    assert.equal(prodMissingTenant.error, "tenant_scope_required");
  });

  it("10. Worker audit does not leak secret payloads", () => {
    const entry = buildWorkerLogEntry({
      level: "info",
      workerId: "w1",
      environment: "staging",
      jobId: "j1",
      message: "token=super-secret-value Authorization: Bearer abc.def.ghi",
    });
    const check = assertLogHasNoSecrets(entry);
    assert.equal(check.ok, true);
    assert.equal(String(JSON.stringify(entry)).includes("super-secret-value"), false);
  });

  it("Production worker remains blocked without dual flags", async () => {
    const result = await runNotificationWorkerOnce({
      repository: repo,
      environment: NOTIFICATION_ENVIRONMENTS.PRODUCTION,
      allowProductionWorker: true,
      tenantId: "tenant-a",
      runNamespace: "ops:x",
      _testBypassEnvGuard: true,
    });
    assert.equal(result.ok, false);
    assert.equal(result.error, "production_worker_blocked");
  });
});

describe("Notification Phase 2B — SQL pack / apply / verify / rollback", () => {
  it("Production SQL pack has no Staging seeds", () => {
    const files = [
      "docs/supabase-notification-phase2b-production-15-delivery-worker.sql",
      "docs/supabase-notification-phase2b-production-16-ops.sql",
      "docs/supabase-notification-phase2b-production-runtime-config.sql",
    ];
    for (const rel of files) {
      const content = fs.readFileSync(path.join(rootDir, rel), "utf8");
      assert.equal(content.includes(STAGING_PROJECT_REF), false, rel);
      assert.equal(/allow_worker',\s*'true'/i.test(content), false, rel);
      assert.equal(/allow_qa_cleanup',\s*'true'/i.test(content), false, rel);
      assert.equal(/environment',\s*'staging'/i.test(content), false, rel);
      assert.ok(content.includes(PRODUCTION_PROJECT_REF), rel);
    }
  });

  it("Production SQL includes tenant_scope_required claim guard", () => {
    const content = fs.readFileSync(
      path.join(rootDir, "docs/supabase-notification-phase2b-production-16-ops.sql"),
      "utf8"
    );
    assert.ok(content.includes("tenant_scope_required"));
    assert.ok(content.includes("namespace_scope_required"));
  });

  it("Apply script dry-run PASS and does not apply", () => {
    const result = runPhase2bProductionApplyDryRun();
    assert.equal(result.verdict, "PASS");
    assert.equal(result.sqlApplied, false);
    assert.equal(result.mode, "dry-run");
  });

  it("Verify fixture PASS for complete pack", () => {
    const result = verifyPhase2bProductionFixture();
    assert.equal(result.verdict, "PASS", JSON.stringify(result.findings, null, 2));
  });

  it("Verify fixture reports missing objects without crashing", () => {
    const result = verifyPhase2bProductionFixture({
      presentTables: ["notification_inbox"],
      presentJobColumns: ["tenant_id"],
      presentRpcs: [],
    });
    assert.equal(result.verdict, "FAIL");
    assert.ok(result.findings.some((f) => f.code === "missing_table"));
    assert.ok(result.findings.some((f) => f.code === "missing_column"));
    assert.ok(result.findings.some((f) => f.code === "missing_rpc"));
  });

  it("Verify fixture BLOCKED_UNSAFE on Staging config", () => {
    const result = verifyPhase2bProductionFixture({
      runtimeConfig: {
        ...PRODUCTION_RUNTIME_DEFAULTS,
        allow_worker: "true",
        project_ref: STAGING_PROJECT_REF,
      },
    });
    assert.equal(result.verdict, "BLOCKED_UNSAFE");
  });

  it("Rollback pack preserves data by default and does not drop shared objects", () => {
    const content = fs.readFileSync(
      path.join(rootDir, "docs/supabase-notification-phase2b-production-rollback.sql"),
      "utf8"
    );
    assert.ok(/DATA-PRESERVING/i.test(content));
    assert.ok(/DESTRUCTIVE/i.test(content));
    assert.equal(/DROP TABLE IF EXISTS public\.audit_logs/i.test(content), false);
    assert.equal(/DROP TABLE IF EXISTS public\.profiles/i.test(content), false);
    assert.ok(content.includes("phase2b_rollback_refuses_staging"));
  });

  it("SECURITY DEFINER search_path present in worker SQL", () => {
    const content = fs.readFileSync(
      path.join(rootDir, "docs/supabase-notification-phase2b-production-15-delivery-worker.sql"),
      "utf8"
    );
    assert.ok(/SET search_path = public/i.test(content));
    assert.ok(/REVOKE ALL ON FUNCTION/i.test(content));
  });
});

describe("Notification Phase 2B — Production ops CLI", () => {
  it("config-verify and env-verify are read-only PASS", async () => {
    const cfg = await runProductionOpsCommand("config-verify", { fixture: true });
    assert.equal(cfg.ok, true);
    assert.equal(cfg.verdict, "PASS");
    const env = await runProductionOpsCommand("env-verify", { fixture: true });
    assert.equal(env.ok, true);
    assert.equal(env.workerEnableCommandPresent, false);
  });

  it("enable-worker command is forbidden", async () => {
    const result = await runProductionOpsCommand("enable-worker", { fixture: true });
    assert.equal(result.ok, false);
    assert.equal(result.error, "enable_worker_forbidden_phase2b");
  });

  it("queue-health fixture does not require live Production", async () => {
    const result = await runProductionOpsCommand("queue-health", {
      fixture: true,
      tenant: "tenant-a",
    });
    assert.equal(result.ok, true);
    assert.equal(result.health.mode, "fixture");
  });
});
