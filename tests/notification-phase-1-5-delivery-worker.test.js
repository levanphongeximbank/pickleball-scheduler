/**
 * Notification Phase 1.5 — delivery worker foundation unit tests.
 */
import assert from "node:assert/strict";
import { describe, it, beforeEach, afterEach } from "node:test";

import {
  DELIVERY_JOB_STATES,
  assertDeliveryJobTransition,
  isWorkerOnlyDeliveryJobState,
} from "../src/features/notifications/constants/deliveryJobStates.js";
import {
  classifyDeliveryFailure,
  sanitizeDeliveryErrorMessage,
} from "../src/features/notifications/services/deliveryFailureClassification.js";
import {
  computeBackoffDelayMs,
  resolveRetryOutcome,
} from "../src/features/notifications/services/deliveryRetryPolicy.js";
import {
  createMemoryNotificationRepository,
  setNotificationRepository,
  resetNotificationRepository,
  runNotificationWorkerOnce,
  markDeliveryJobResult,
  NOTIFICATION_COMPATIBILITY,
} from "../src/features/notifications/index.js";
import { DELIVERY_MODES } from "../src/features/notifications/providers/sandboxDeliveryAdapters.js";
import { resolveWorkerProviderAdapter } from "../src/features/notifications/providers/sandboxDeliveryAdapters.js";

function seedInboxAndJob(repo, {
  tenantId = "tenant-a",
  notificationId = "n1",
  channel = "in_app",
  priority = "NORMAL",
  status = "QUEUED",
  nextAttemptAt = null,
  maxAttempts = 5,
} = {}) {
  const now = new Date().toISOString();
  const inbox = {
    notificationId,
    id: notificationId,
    eventId: "e1",
    eventType: "CLUB_SCHEDULE_UPDATED",
    category: "CLUB",
    priority,
    tenantId,
    recipientUserId: "user-a",
    title: "Test",
    message: "Hello",
    status: "QUEUED",
    idempotencyKey: `${tenantId}:test:${notificationId}`,
    createdAt: now,
    updatedAt: now,
  };
  return repo.create(inbox).then(async () => {
    const enq = await repo.enqueueDeliveryJob({
      notificationId,
      tenantId,
      channel,
      maxAttempts,
    });
    const dump = repo._dump();
    const job = dump.jobs.find((j) => j.id === enq.job.id);
    if (job) {
      const patched = { ...job };
      if (status !== "QUEUED") patched.status = status;
      if (nextAttemptAt) patched.nextAttemptAt = nextAttemptAt;
      if (priority === "HIGH") patched.priority = 30;
      if (priority === "URGENT") patched.priority = 10;
      if (priority === "LOW") patched.priority = 200;
      repo._seedJob(patched);
      return patched;
    }
    return enq.job;
  });
}

describe("Notification Phase 1.5 — state transitions", () => {
  it("accepts valid transitions", () => {
    assert.equal(assertDeliveryJobTransition("CREATED", "QUEUED").ok, true);
    assert.equal(assertDeliveryJobTransition("QUEUED", "PROCESSING").ok, true);
    assert.equal(assertDeliveryJobTransition("PROCESSING", "SENT").ok, true);
    assert.equal(assertDeliveryJobTransition("PROCESSING", "RETRY_SCHEDULED").ok, true);
    assert.equal(assertDeliveryJobTransition("PROCESSING", "FAILED").ok, true);
    assert.equal(assertDeliveryJobTransition("PROCESSING", "DEAD_LETTERED").ok, true);
    assert.equal(assertDeliveryJobTransition("RETRY_SCHEDULED", "PROCESSING").ok, true);
    assert.equal(
      assertDeliveryJobTransition("FAILED", "RETRY_SCHEDULED", { explicitRetry: true }).ok,
      true
    );
  });

  it("rejects invalid transitions", () => {
    assert.equal(assertDeliveryJobTransition("SENT", "QUEUED").ok, false);
    assert.equal(assertDeliveryJobTransition("QUEUED", "SENT").ok, false);
    assert.equal(assertDeliveryJobTransition("DEAD_LETTERED", "PROCESSING").ok, false);
    assert.equal(assertDeliveryJobTransition("FAILED", "RETRY_SCHEDULED").ok, false);
  });
});

describe("Notification Phase 1.5 — claim / lease", () => {
  let repo;

  beforeEach(() => {
    repo = createMemoryNotificationRepository();
    setNotificationRepository(repo);
  });

  afterEach(() => {
    resetNotificationRepository();
  });

  it("two workers cannot claim the same job", async () => {
    await seedInboxAndJob(repo, { notificationId: "n-claim-1" });
    const a = await repo.claimDeliveryJobs({ workerId: "w1", batchSize: 10 });
    const b = await repo.claimDeliveryJobs({ workerId: "w2", batchSize: 10 });
    assert.equal(a.jobs.length, 1);
    assert.equal(b.jobs.length, 0);
    assert.equal(a.jobs[0].workerId, "w1");
    assert.ok(a.jobs[0].claimToken);
  });

  it("expired lease may be reclaimed", async () => {
    const t0 = new Date("2026-01-01T00:00:00.000Z");
    await seedInboxAndJob(repo, {
      notificationId: "n-lease-1",
      nextAttemptAt: t0.toISOString(),
    });
    const claim1 = await repo.claimDeliveryJobs({
      workerId: "w1",
      leaseSeconds: 30,
      now: t0,
    });
    assert.equal(claim1.jobs.length, 1);

    const tExpired = new Date("2026-01-01T00:01:00.000Z");
    const claim2 = await repo.claimDeliveryJobs({
      workerId: "w2",
      leaseSeconds: 30,
      now: tExpired,
    });
    assert.equal(claim2.jobs.length, 1);
    assert.equal(claim2.jobs[0].workerId, "w2");
  });

  it("unexpired lease cannot be stolen", async () => {
    const t0 = new Date("2026-01-01T00:00:00.000Z");
    await seedInboxAndJob(repo, {
      notificationId: "n-lease-2",
      nextAttemptAt: t0.toISOString(),
    });
    await repo.claimDeliveryJobs({ workerId: "w1", leaseSeconds: 60, now: t0 });
    const tMid = new Date("2026-01-01T00:00:30.000Z");
    const claim2 = await repo.claimDeliveryJobs({
      workerId: "w2",
      leaseSeconds: 60,
      now: tMid,
    });
    assert.equal(claim2.jobs.length, 0);
  });

  it("orders by priority then next_attempt_at", async () => {
    await seedInboxAndJob(repo, {
      notificationId: "n-low",
      priority: "LOW",
    });
    await seedInboxAndJob(repo, {
      notificationId: "n-high",
      priority: "HIGH",
    });
    // Fix priorities on jobs
    for (const job of repo._dump().jobs) {
      if (job.notificationId === "n-high") {
        repo._seedJob({ ...job, priority: 30 });
      }
      if (job.notificationId === "n-low") {
        repo._seedJob({ ...job, priority: 200 });
      }
    }
    const claimed = await repo.claimDeliveryJobs({ workerId: "w1", batchSize: 1 });
    assert.equal(claimed.jobs[0].notificationId, "n-high");
  });

  it("respects next_attempt_at", async () => {
    const future = new Date("2026-06-01T12:00:00.000Z").toISOString();
    await seedInboxAndJob(repo, {
      notificationId: "n-future",
      nextAttemptAt: future,
      status: "RETRY_SCHEDULED",
    });
    for (const job of repo._dump().jobs) {
      repo._seedJob({
        ...job,
        status: DELIVERY_JOB_STATES.RETRY_SCHEDULED,
        nextAttemptAt: future,
      });
    }
    const now = new Date("2026-06-01T11:00:00.000Z");
    const claimed = await repo.claimDeliveryJobs({ workerId: "w1", now });
    assert.equal(claimed.jobs.length, 0);
  });

  it("cross-tenant claim is scoped when tenantId provided", async () => {
    await seedInboxAndJob(repo, { tenantId: "tenant-a", notificationId: "na" });
    await seedInboxAndJob(repo, { tenantId: "tenant-b", notificationId: "nb" });
    const claimed = await repo.claimDeliveryJobs({
      workerId: "w1",
      tenantId: "tenant-a",
    });
    assert.equal(claimed.jobs.length, 1);
    assert.equal(claimed.jobs[0].tenantId, "tenant-a");
  });
});

describe("Notification Phase 1.5 — retry / failure", () => {
  let repo;

  beforeEach(() => {
    repo = createMemoryNotificationRepository();
    setNotificationRepository(repo);
  });

  afterEach(() => {
    resetNotificationRepository();
  });

  it("transient failure schedules retry", async () => {
    const fixedNow = new Date("2026-01-01T00:00:00.000Z");
    await seedInboxAndJob(repo, {
      notificationId: "n-retry",
      channel: "email",
      nextAttemptAt: fixedNow.toISOString(),
    });
    const result = await runNotificationWorkerOnce({
      repository: repo,
      workerId: "w-retry",
      now: () => fixedNow,
      jitterSource: () => 0,
      _testBypassEnvGuard: true,
      environment: "staging",
      simulateFailureForJob: () => true,
      errorCodeForJob: () => "timeout",
    });
    assert.equal(result.ok, true);
    assert.equal(result.summary.retryScheduled, 1);
    const job = repo._dump().jobs[0];
    assert.equal(job.status, DELIVERY_JOB_STATES.RETRY_SCHEDULED);
    assert.ok(job.nextAttemptAt);
  });

  it("permanent failure does not retry", async () => {
    await seedInboxAndJob(repo, { notificationId: "n-perm", channel: "email" });
    const result = await runNotificationWorkerOnce({
      repository: repo,
      workerId: "w-perm",
      _testBypassEnvGuard: true,
      environment: "staging",
      simulatePermanentFailureForJob: () => true,
      errorCodeForJob: () => "invalid_recipient",
    });
    assert.equal(result.summary.failed, 1);
    assert.equal(repo._dump().jobs[0].status, DELIVERY_JOB_STATES.FAILED);
  });

  it("max attempts produces dead letter", async () => {
    await seedInboxAndJob(repo, {
      notificationId: "n-dl",
      channel: "email",
      maxAttempts: 2,
    });
    for (const job of repo._dump().jobs) {
      repo._seedJob({ ...job, attempts: 1, maxAttempts: 2 });
    }
    const result = await runNotificationWorkerOnce({
      repository: repo,
      workerId: "w-dl",
      _testBypassEnvGuard: true,
      environment: "staging",
      simulateFailureForJob: () => true,
      errorCodeForJob: () => "provider_unavailable",
    });
    assert.equal(result.summary.deadLettered, 1);
    assert.equal(repo._dump().jobs[0].status, DELIVERY_JOB_STATES.DEAD_LETTERED);
  });

  it("deterministic backoff with injected jitter", () => {
    const d1 = computeBackoffDelayMs(1, undefined, () => 0);
    const d2 = computeBackoffDelayMs(2, undefined, () => 0);
    const d3 = computeBackoffDelayMs(1, undefined, () => 0.5);
    assert.equal(d1, 1000);
    assert.equal(d2, 2000);
    assert.equal(d3, 1100);
    const outcome = resolveRetryOutcome({
      failureClass: "TRANSIENT",
      retryable: true,
      attemptNumber: 1,
      now: () => new Date("2026-01-01T00:00:00.000Z"),
      jitterSource: () => 0,
    });
    assert.equal(outcome.nextStatus, "RETRY_SCHEDULED");
    assert.equal(outcome.nextAttemptAt, "2026-01-01T00:00:01.000Z");
  });
});

describe("Notification Phase 1.5 — providers + in-app idempotency", () => {
  let repo;

  beforeEach(() => {
    repo = createMemoryNotificationRepository();
    setNotificationRepository(repo);
  });

  afterEach(() => {
    resetNotificationRepository();
  });

  it("in-app delivery is idempotent (no duplicate inbox rows)", async () => {
    await seedInboxAndJob(repo, { notificationId: "n-inapp" });
    const before = repo._dump().records.length;
    await runNotificationWorkerOnce({
      repository: repo,
      workerId: "w-inapp",
      _testBypassEnvGuard: true,
      environment: "staging",
    });
    await runNotificationWorkerOnce({
      repository: repo,
      workerId: "w-inapp-2",
      _testBypassEnvGuard: true,
      environment: "staging",
    });
    assert.equal(repo._dump().records.length, before);
    assert.equal(repo._dump().jobs[0].status, DELIVERY_JOB_STATES.SENT);
    assert.equal(repo._dump().records[0].status, "SENT");
  });

  it("sandbox result is explicit", async () => {
    const adapter = resolveWorkerProviderAdapter("email", { mode: DELIVERY_MODES.SANDBOX });
    const result = await adapter.send({ notificationId: "x" });
    assert.equal(result.ok, true);
    assert.equal(result.deliveryMode, "sandbox");
  });

  it("disabled provider is not marked SENT", async () => {
    await seedInboxAndJob(repo, { notificationId: "n-push", channel: "push" });
    const result = await runNotificationWorkerOnce({
      repository: repo,
      workerId: "w-push",
      _testBypassEnvGuard: true,
      environment: "staging",
    });
    assert.equal(result.summary.failed, 1);
    assert.notEqual(repo._dump().jobs[0].status, DELIVERY_JOB_STATES.SENT);
  });

  it("live mode is blocked", async () => {
    const adapter = resolveWorkerProviderAdapter("email", { mode: DELIVERY_MODES.LIVE });
    const result = await adapter.send({});
    assert.equal(result.ok, false);
    assert.equal(result.errorCode, "live_mode_blocked");
  });
});

describe("Notification Phase 1.5 — security boundaries", () => {
  let repo;

  beforeEach(() => {
    repo = createMemoryNotificationRepository();
    setNotificationRepository(repo);
  });

  afterEach(() => {
    resetNotificationRepository();
  });

  it("browser cannot set terminal states", async () => {
    await seedInboxAndJob(repo, { notificationId: "n-browser" });
    const job = repo._dump().jobs[0];
    const result = await markDeliveryJobResult({
      jobId: job.id,
      status: "SENT",
      repository: repo,
      caller: "browser",
    });
    assert.equal(result.ok, false);
    assert.equal(result.code, "forbidden");
    assert.equal(isWorkerOnlyDeliveryJobState("SENT"), true);
  });

  it("browser worker entry is forbidden when window exists", async () => {
    globalThis.window = {};
    try {
      const result = await runNotificationWorkerOnce({
        repository: repo,
        environment: "staging",
      });
      assert.equal(result.ok, false);
      assert.equal(result.error, "browser_worker_forbidden");
    } finally {
      delete globalThis.window;
    }
  });

  it("production worker blocked by default", async () => {
    const result = await runNotificationWorkerOnce({
      repository: repo,
      environment: "production",
      projectRef: "expuvcohlcjzvrrauvud",
      _testBypassEnvGuard: true,
    });
    assert.equal(result.ok, false);
    assert.equal(result.error, "production_worker_blocked");
  });

  it("sanitized errors contain no secrets", () => {
    const raw = "failed api_key=sk_live_abc password=hunter2 Bearer eyJhbGciOi";
    const clean = sanitizeDeliveryErrorMessage(raw);
    assert.ok(!clean.includes("sk_live"));
    assert.ok(!clean.includes("hunter2"));
    assert.ok(clean.includes("[redacted]"));
    const classified = classifyDeliveryFailure({ errorCode: "timeout" });
    assert.equal(classified.retryable, true);
  });
});

describe("Notification Phase 1.5 — QA cleanup", () => {
  it("cleanup only deletes namespaced tracked QA rows", async () => {
    const repo = createMemoryNotificationRepository();
    const keep = {
      notificationId: "keep-1",
      id: "keep-1",
      tenantId: "tenant-a",
      recipientUserId: "user-a",
      eventType: "X",
      category: "SYSTEM",
      priority: "NORMAL",
      title: "keep",
      message: "",
      status: "SENT",
      idempotencyKey: "normal:keep",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const qa = {
      ...keep,
      notificationId: "qa-1",
      id: "qa-1",
      idempotencyKey: "phase14s:run1:qa",
      title: "qa",
    };
    await repo.create(keep);
    await repo.create(qa);

    const result = await repo.cleanupNamespacedQaRows({
      tenantId: "tenant-a",
      recipientUserId: "user-a",
      namespacePrefix: "phase14s:run1:",
      ids: ["qa-1", "keep-1"],
      environment: "staging",
    });
    assert.equal(result.ok, true);
    assert.equal(result.deleted, 1);
    const dump = repo._dump();
    assert.equal(dump.records.length, 1);
    assert.equal(dump.records[0].notificationId, "keep-1");
  });

  it("unrelated inbox rows remain", async () => {
    const repo = createMemoryNotificationRepository();
    await repo.create({
      notificationId: "other",
      id: "other",
      tenantId: "tenant-a",
      recipientUserId: "user-b",
      eventType: "X",
      category: "SYSTEM",
      priority: "NORMAL",
      title: "other",
      message: "",
      status: "SENT",
      idempotencyKey: "phase14s:run1:other-user",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    const result = await repo.cleanupNamespacedQaRows({
      tenantId: "tenant-a",
      recipientUserId: "user-a",
      namespacePrefix: "phase14s:run1:",
      ids: ["other"],
      environment: "staging",
    });
    assert.equal(result.deleted, 0);
    assert.equal(repo._dump().records.length, 1);
  });
});

describe("Notification Phase 1.5 — compatibility flags", () => {
  it("reports phase 1.5 with live delivery disabled", () => {
    assert.equal(NOTIFICATION_COMPATIBILITY.phase, "1.5");
    assert.equal(NOTIFICATION_COMPATIBILITY.liveDeliveryEnabled, false);
    assert.equal(NOTIFICATION_COMPATIBILITY.workerLiveChannelsBlocked, true);
    assert.ok(
      NOTIFICATION_COMPATIBILITY.remainingLegacyPaths.includes("crm.campaigns")
    );
  });
});
