/**
 * Notification Phase 1.6 — worker ops, environment isolation, queue hygiene.
 */
import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import {
  createMemoryNotificationRepository,
  setNotificationRepository,
  resetNotificationRepository,
  runNotificationWorkerOnce,
  DELIVERY_JOB_STATES,
  NOTIFICATION_ENVIRONMENTS,
  WORKER_RUN_STATUSES,
  NOTIFICATION_COMPATIBILITY,
  getNotificationQueueHealth,
  cancelNotificationDeliveryJob,
  replayNotificationDeliveryJob,
  recoverStaleNotificationLeases,
  cleanupNotificationQaRunNamespace,
  markAbandonedNotificationWorkerRuns,
  buildWorkerLogEntry,
  assertLogHasNoSecrets,
  redactSecrets,
} from "../src/features/notifications/index.js";
import { NOTIFICATION_STATUSES } from "../src/features/notifications/constants/notificationStatuses.js";

async function seedInboxAndJob(repo, overrides = {}) {
  const notificationId =
    overrides.notificationId ||
    `n_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const tenantId = overrides.tenantId || "tenant-a";
  const inbox = {
    notificationId,
    id: notificationId,
    tenantId,
    recipientUserId: overrides.recipientUserId || "user-a",
    eventType: "CLUB_SCHEDULE_UPDATED",
    category: "CLUB",
    priority: overrides.priorityLabel || "NORMAL",
    status: NOTIFICATION_STATUSES.CREATED,
    title: "t",
    message: "m",
    idempotencyKey:
      overrides.idempotencyKey ||
      `phase16:test:${notificationId}`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await repo.create(inbox);
  const env = overrides.environment || NOTIFICATION_ENVIRONMENTS.STAGING;
  let enq;
  if (env === NOTIFICATION_ENVIRONMENTS.PRODUCTION) {
    // Enqueue path blocks production; seed staging then override for isolation tests.
    enq = await repo.enqueueDeliveryJob({
      notificationId,
      tenantId,
      channel: overrides.channel || "in_app",
      environment: NOTIFICATION_ENVIRONMENTS.STAGING,
      runNamespace: overrides.runNamespace || null,
      jobSource: overrides.jobSource || null,
      priority: overrides.priority,
    });
    repo._seedJob({
      ...enq.job,
      environment: NOTIFICATION_ENVIRONMENTS.PRODUCTION,
    });
  } else {
    enq = await repo.enqueueDeliveryJob({
      notificationId,
      tenantId,
      channel: overrides.channel || "in_app",
      environment: env,
      runNamespace: overrides.runNamespace || null,
      jobSource: overrides.jobSource || null,
      priority: overrides.priority,
    });
  }
  if (!enq?.ok) {
    throw new Error(`enqueue failed: ${enq?.error || "unknown"}`);
  }
  if (overrides.status || overrides.nextAttemptAt || overrides.maxAttempts) {
    repo._seedJob({
      ...enq.job,
      status: overrides.status || enq.job.status,
      nextAttemptAt: overrides.nextAttemptAt || enq.job.nextAttemptAt,
      maxAttempts: overrides.maxAttempts || enq.job.maxAttempts,
      attempts: overrides.attempts ?? enq.job.attempts,
      environment: env,
      runNamespace: overrides.runNamespace ?? enq.job.runNamespace,
      deliveryIdempotencyKey: overrides.deliveryIdempotencyKey || null,
    });
  }
  const dump = repo._dump();
  const job = dump.jobs.find((j) => j.notificationId === notificationId);
  return { inbox, job };
}

describe("Notification Phase 1.6 — environment isolation", () => {
  let repo;
  beforeEach(() => {
    repo = createMemoryNotificationRepository();
    setNotificationRepository(repo);
  });
  afterEach(() => {
    resetNotificationRepository();
  });

  it("Staging worker cannot claim Production job", async () => {
    const { job } = await seedInboxAndJob(repo, {
      environment: NOTIFICATION_ENVIRONMENTS.PRODUCTION,
    });
    // Force production env on job (enqueue blocks production; seed bypass)
    repo._seedJob({ ...job, environment: NOTIFICATION_ENVIRONMENTS.PRODUCTION });

    const claim = await repo.claimDeliveryJobs({
      workerId: "w1",
      environment: NOTIFICATION_ENVIRONMENTS.STAGING,
    });
    assert.equal(claim.ok, true);
    assert.equal(claim.jobs.length, 0);
  });

  it("Worker cannot claim another run namespace", async () => {
    await seedInboxAndJob(repo, { runNamespace: "phase16:run-a" });
    await seedInboxAndJob(repo, { runNamespace: "phase16:run-b" });
    const claim = await repo.claimDeliveryJobs({
      workerId: "w1",
      environment: NOTIFICATION_ENVIRONMENTS.STAGING,
      runNamespace: "phase16:run-a",
    });
    assert.equal(claim.jobs.length, 1);
    assert.equal(claim.jobs[0].runNamespace, "phase16:run-a");
  });

  it("Worker cannot claim another tenant’s job", async () => {
    await seedInboxAndJob(repo, { tenantId: "tenant-a" });
    await seedInboxAndJob(repo, { tenantId: "tenant-b", notificationId: "n_b" });
    const claim = await repo.claimDeliveryJobs({
      workerId: "w1",
      environment: NOTIFICATION_ENVIRONMENTS.STAGING,
      tenantId: "tenant-a",
    });
    assert.equal(claim.jobs.every((j) => j.tenantId === "tenant-a"), true);
    assert.equal(claim.jobs.length, 1);
  });

  it("Old unrelated Staging job is not claimed by QA worker", async () => {
    await seedInboxAndJob(repo, { runNamespace: null, idempotencyKey: "legacy:old" });
    await seedInboxAndJob(repo, { runNamespace: "phase16:qa-1" });
    const claim = await repo.claimDeliveryJobs({
      workerId: "qa-w",
      environment: NOTIFICATION_ENVIRONMENTS.STAGING,
      runNamespace: "phase16:qa-1",
    });
    assert.equal(claim.jobs.length, 1);
    assert.equal(claim.jobs[0].runNamespace, "phase16:qa-1");
  });

  it("Production execution blocked", async () => {
    const result = await runNotificationWorkerOnce({
      repository: repo,
      environment: NOTIFICATION_ENVIRONMENTS.PRODUCTION,
      _testBypassEnvGuard: true,
    });
    assert.equal(result.ok, false);
    assert.equal(result.error, "production_worker_blocked");
  });
});

describe("Notification Phase 1.6 — worker-run audit + heartbeat", () => {
  let repo;
  let clock;
  beforeEach(() => {
    repo = createMemoryNotificationRepository();
    setNotificationRepository(repo);
    clock = new Date("2026-07-19T10:00:00.000Z");
  });
  afterEach(() => {
    resetNotificationRepository();
  });

  it("Worker-run audit created and heartbeat updated", async () => {
    await seedInboxAndJob(repo);
    const result = await runNotificationWorkerOnce({
      repository: repo,
      workerId: "w-audit",
      runId: "run-audit-1",
      environment: NOTIFICATION_ENVIRONMENTS.STAGING,
      now: () => clock,
      _testBypassEnvGuard: true,
    });
    assert.equal(result.ok, true);
    assert.ok(result.workerRun);
    assert.equal(result.workerRun.runId, "run-audit-1");
    assert.equal(result.workerRun.status, WORKER_RUN_STATUSES.COMPLETED);
    assert.ok(result.workerRun.heartbeatAt);
    assert.equal(result.workerRun.claimedCount, 1);
    assert.equal(result.workerRun.sentCount, 1);
  });

  it("Stale worker run detected; active run not abandoned", async () => {
    await repo.startWorkerRun({
      runId: "stale-1",
      workerId: "w-stale",
      environment: NOTIFICATION_ENVIRONMENTS.STAGING,
      now: () => new Date("2026-07-19T09:00:00.000Z"),
    });
    await repo.startWorkerRun({
      runId: "active-1",
      workerId: "w-active",
      environment: NOTIFICATION_ENVIRONMENTS.STAGING,
      now: () => clock,
    });
    const marked = await markAbandonedNotificationWorkerRuns({
      repository: repo,
      environment: NOTIFICATION_ENVIRONMENTS.STAGING,
      staleMs: 60_000,
      now: () => clock,
      _testBypassEnvGuard: true,
    });
    assert.equal(marked.ok, true);
    assert.equal(marked.runs.length, 1);
    assert.equal(marked.runs[0].runId, "stale-1");
    assert.equal(marked.runs[0].status, WORKER_RUN_STATUSES.ABANDONED);
    const dump = repo._dump();
    const active = dump.workerRuns.find((r) => r.runId === "active-1");
    assert.ok(active.status === WORKER_RUN_STATUSES.STARTED || active.status === WORKER_RUN_STATUSES.RUNNING);
  });
});

describe("Notification Phase 1.6 — stale lease recovery", () => {
  let repo;
  beforeEach(() => {
    repo = createMemoryNotificationRepository();
    setNotificationRepository(repo);
  });
  afterEach(() => {
    resetNotificationRepository();
  });

  it("Expired lease with stale worker recovered; active lease not recovered", async () => {
    const now = new Date("2026-07-19T10:00:00.000Z");
    const { job: staleJob } = await seedInboxAndJob(repo, {
      notificationId: "n_stale_lease",
    });
    const { job: activeJob } = await seedInboxAndJob(repo, {
      notificationId: "n_active_lease",
    });
    repo._seedJob({
      ...staleJob,
      status: DELIVERY_JOB_STATES.PROCESSING,
      workerId: "dead-worker",
      claimedAt: "2026-07-19T09:00:00.000Z",
      leaseExpiresAt: "2026-07-19T09:01:00.000Z",
      claimToken: "tok-stale",
    });
    repo._seedJob({
      ...activeJob,
      status: DELIVERY_JOB_STATES.PROCESSING,
      workerId: "live-worker",
      claimedAt: "2026-07-19T09:59:00.000Z",
      leaseExpiresAt: "2026-07-19T10:05:00.000Z",
      claimToken: "tok-live",
    });
    await repo.startWorkerRun({
      runId: "live-run",
      workerId: "live-worker",
      environment: NOTIFICATION_ENVIRONMENTS.STAGING,
      now: () => now,
    });

    const recovered = await recoverStaleNotificationLeases({
      repository: repo,
      environment: NOTIFICATION_ENVIRONMENTS.STAGING,
      now: () => now,
      _testBypassEnvGuard: true,
    });
    assert.equal(recovered.ok, true);
    assert.equal(recovered.recovered.length, 1);
    assert.equal(recovered.recovered[0].jobId, staleJob.id);
    assert.ok(recovered.recovered[0].recoveryCount >= 1);

    const dump = repo._dump();
    const stillActive = dump.jobs.find((j) => j.id === activeJob.id);
    assert.equal(stillActive.status, DELIVERY_JOB_STATES.PROCESSING);
    assert.equal(stillActive.claimToken, "tok-live");
  });
});

describe("Notification Phase 1.6 — queue health", () => {
  let repo;
  beforeEach(() => {
    repo = createMemoryNotificationRepository();
    setNotificationRepository(repo);
  });
  afterEach(() => {
    resetNotificationRepository();
  });

  it("Queue health counts accurate and hides sensitive data", async () => {
    await seedInboxAndJob(repo, { channel: "in_app" });
    await seedInboxAndJob(repo, {
      notificationId: "n_push",
      channel: "push",
      status: DELIVERY_JOB_STATES.FAILED,
    });
    const health = await getNotificationQueueHealth({
      repository: repo,
      environment: NOTIFICATION_ENVIRONMENTS.STAGING,
      callerRole: "service_role",
      _testBypassEnvGuard: true,
    });
    assert.equal(health.ok, true);
    assert.ok(health.health.queued >= 1);
    assert.ok(health.health.failed >= 1);
    assert.ok(health.health.byChannel.in_app >= 1 || health.health.byChannel.push >= 1);
    const raw = JSON.stringify(health.health);
    assert.equal(raw.includes("@"), false);
    assert.equal(raw.includes("password"), false);
    assert.equal(raw.includes("payload"), false);
  });

  it("Normal browser user cannot inspect queue", async () => {
    const denied = await getNotificationQueueHealth({
      repository: repo,
      environment: NOTIFICATION_ENVIRONMENTS.STAGING,
      callerRole: "player",
      allowBrowser: true,
      _testBypassEnvGuard: true,
    });
    assert.equal(denied.ok, false);
    assert.equal(denied.error, "queue_health_forbidden");
  });
});

describe("Notification Phase 1.6 — cancel / replay", () => {
  let repo;
  beforeEach(() => {
    repo = createMemoryNotificationRepository();
    setNotificationRepository(repo);
  });
  afterEach(() => {
    resetNotificationRepository();
  });

  it("Valid queued job cancellation; SENT rejected", async () => {
    const { job } = await seedInboxAndJob(repo);
    const cancelled = await cancelNotificationDeliveryJob({
      repository: repo,
      jobId: job.id,
      reason: "qa cancel",
      environment: NOTIFICATION_ENVIRONMENTS.STAGING,
      _testBypassEnvGuard: true,
    });
    assert.equal(cancelled.ok, true);
    assert.equal(cancelled.job.status, DELIVERY_JOB_STATES.CANCELLED);
    assert.ok(cancelled.job.cancelledAt);

    const { job: sentJob } = await seedInboxAndJob(repo, {
      notificationId: "n_sent",
      status: DELIVERY_JOB_STATES.SENT,
    });
    const reject = await cancelNotificationDeliveryJob({
      repository: repo,
      jobId: sentJob.id,
      reason: "should fail",
      environment: NOTIFICATION_ENVIRONMENTS.STAGING,
      _testBypassEnvGuard: true,
    });
    assert.equal(reject.ok, false);
    assert.equal(reject.error, "cancel_rejected_terminal");
  });

  it("Dead-letter replay creates auditable generation and stays idempotent for in-app", async () => {
    const { job } = await seedInboxAndJob(repo, {
      status: DELIVERY_JOB_STATES.DEAD_LETTERED,
      deliveryIdempotencyKey: "idem-inapp-1",
      attempts: 5,
    });
    const replay = await replayNotificationDeliveryJob({
      repository: repo,
      jobId: job.id,
      reason: "ops replay after fix",
      environment: NOTIFICATION_ENVIRONMENTS.STAGING,
      _testBypassEnvGuard: true,
    });
    assert.equal(replay.ok, true);
    assert.equal(replay.job.status, DELIVERY_JOB_STATES.QUEUED);
    assert.equal(replay.job.replayedFromJobId, job.id);
    assert.equal(replay.job.replayGeneration, 1);
    assert.equal(replay.job.deliveryIdempotencyKey, "idem-inapp-1");

    const result = await runNotificationWorkerOnce({
      repository: repo,
      workerId: "w-replay",
      environment: NOTIFICATION_ENVIRONMENTS.STAGING,
      runNamespace: null,
      _testBypassEnvGuard: true,
    });
    assert.equal(result.ok, true);
    const inbox = repo._dump().records.filter(
      (r) => (r.notificationId || r.id) === job.notificationId
    );
    assert.equal(inbox.length, 1);

    // Exceed replay limit
    let last = replay.job;
    for (let i = 0; i < 5; i += 1) {
      repo._seedJob({
        ...last,
        status: DELIVERY_JOB_STATES.DEAD_LETTERED,
      });
      const next = await replayNotificationDeliveryJob({
        repository: repo,
        jobId: last.id,
        reason: `replay ${i + 2}`,
        environment: NOTIFICATION_ENVIRONMENTS.STAGING,
        maxReplayCount: 3,
        _testBypassEnvGuard: true,
      });
      if (!next.ok) {
        assert.equal(next.error, "replay_count_exceeded");
        break;
      }
      last = next.job;
    }
  });
});

describe("Notification Phase 1.6 — QA cleanup + logging", () => {
  let repo;
  beforeEach(() => {
    repo = createMemoryNotificationRepository();
    setNotificationRepository(repo);
  });
  afterEach(() => {
    resetNotificationRepository();
  });

  it("QA cleanup deletes only exact run namespace; sentinel remains", async () => {
    const ns = "phase16:run-clean";
    await seedInboxAndJob(repo, {
      runNamespace: ns,
      idempotencyKey: `${ns}:a`,
      notificationId: "n_qa_a",
    });
    await seedInboxAndJob(repo, {
      runNamespace: "phase16:other",
      idempotencyKey: "phase16:other:b",
      notificationId: "n_sentinel",
    });
    const dry = await cleanupNotificationQaRunNamespace({
      repository: repo,
      environment: NOTIFICATION_ENVIRONMENTS.STAGING,
      runNamespace: ns,
      dryRun: true,
      _testBypassEnvGuard: true,
    });
    assert.equal(dry.ok, true);
    assert.equal(dry.jobs, 1);

    const cleaned = await cleanupNotificationQaRunNamespace({
      repository: repo,
      environment: NOTIFICATION_ENVIRONMENTS.STAGING,
      runNamespace: ns,
      dryRun: false,
      _testBypassEnvGuard: true,
    });
    assert.equal(cleaned.ok, true);
    const dump = repo._dump();
    assert.equal(dump.jobs.some((j) => j.runNamespace === ns), false);
    assert.equal(dump.jobs.some((j) => j.notificationId === "n_sentinel"), true);
    assert.equal(dump.records.some((r) => (r.notificationId || r.id) === "n_sentinel"), true);
  });

  it("Structured logs contain no secrets", () => {
    const entry = buildWorkerLogEntry({
      runId: "run_abcdefghijklmnopqrstuvwxyz",
      workerId: "worker_secret_token_abcdef",
      environment: "staging",
      jobId: "11111111-2222-3333-4444-555555555555",
      transition: "PROCESSING->SENT",
      result: "SUCCESS",
      durationMs: 12,
      retryDecision: "none",
      message: "user alice@example.com phone +84901234567 token=supersecret password=hunter2",
    });
    const check = assertLogHasNoSecrets(entry);
    assert.equal(check.ok, true);
    assert.ok(entry.message.includes("***") || entry.message.includes("[REDACTED]"));
    assert.equal(entry.message.includes("supersecret"), false);
    assert.equal(entry.message.includes("hunter2"), false);
    assert.ok(redactSecrets("postgresql://u:p@host/db").includes("[REDACTED]"));
  });

  it("Compatibility flags phase 1.6 with live delivery disabled", () => {
    assert.equal(NOTIFICATION_COMPATIBILITY.phase, "1.6");
    assert.equal(NOTIFICATION_COMPATIBILITY.liveDeliveryEnabled, false);
    assert.equal(NOTIFICATION_COMPATIBILITY.environmentIsolation, true);
    assert.equal(NOTIFICATION_COMPATIBILITY.productionWorkerBlocked, true);
  });
});
