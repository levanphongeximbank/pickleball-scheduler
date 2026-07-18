/**
 * Notification delivery worker — Phase 1.5 foundation.
 *
 * Server-side only. Browser must not import secrets or claim jobs.
 * Live Email/SMS/Zalo/Web Push are blocked; sandbox/in_app only.
 */

import {
  DELIVERY_JOB_STATES,
  assertDeliveryJobTransition,
  isTerminalDeliveryJobState,
} from "../constants/deliveryJobStates.js";
import {
  classifyDeliveryFailure,
  sanitizeDeliveryErrorMessage,
} from "../services/deliveryFailureClassification.js";
import {
  DEFAULT_RETRY_POLICY,
  resolveRetryOutcome,
} from "../services/deliveryRetryPolicy.js";
import {
  DELIVERY_MODES,
  resolveWorkerProviderAdapter,
} from "../providers/sandboxDeliveryAdapters.js";
import { buildDeliveryIdempotencyKey } from "../utils/deliveryIdempotency.js";
import { getNotificationRepository } from "../repositories/notificationRepository.js";
import { NOTIFICATION_STATUSES } from "../constants/notificationStatuses.js";

const PRODUCTION_REF = "expuvcohlcjzvrrauvud";

function emptySummary() {
  return {
    claimed: 0,
    sent: 0,
    retryScheduled: 0,
    failed: 0,
    deadLettered: 0,
    cancelled: 0,
    skipped: 0,
    errors: [],
  };
}

function assertServerSideWorker(options = {}) {
  if (options.allowBrowserWorker === true) {
    return { ok: true };
  }
  const g = globalThis;
  // Soft guard: Vite client bundles set import.meta.env.SSR === false.
  try {
    if (
      typeof import.meta !== "undefined" &&
      import.meta.env &&
      import.meta.env.SSR === false &&
      options.requireServer !== false &&
      !options._testBypassEnvGuard
    ) {
      // Still allow Node unit tests (no window) and explicit server runners.
      if (typeof g.window !== "undefined") {
        return { ok: false, error: "browser_worker_forbidden" };
      }
    }
  } catch {
    /* ignore */
  }
  if (typeof g.window !== "undefined" && !options._testBypassEnvGuard) {
    return { ok: false, error: "browser_worker_forbidden" };
  }
  return { ok: true };
}

function assertEnvironmentAllowed(options = {}) {
  const env = globalThis.process?.env || {};
  const envName = String(options.environment || env.NOTIFICATION_WORKER_ENV || "staging")
    .trim()
    .toLowerCase();
  const projectRef = String(
    options.projectRef ||
      env.NOTIFICATION_PROJECT_REF ||
      env.VITE_SUPABASE_PROJECT_REF ||
      ""
  ).trim();

  if (projectRef === PRODUCTION_REF || envName === "production") {
    if (options.allowProductionWorker !== true) {
      return {
        ok: false,
        error: "production_worker_blocked",
        environment: envName,
        projectRef,
      };
    }
  }
  return { ok: true, environment: envName, projectRef };
}

async function loadInboxForJob(repository, job) {
  if (typeof repository.getInboxById === "function") {
    const res = await repository.getInboxById({
      notificationId: job.notificationId,
      tenantId: job.tenantId,
    });
    return res?.notification || null;
  }
  const listed = await repository.list({
    tenantId: job.tenantId,
    limit: 500,
  });
  return (
    (listed.items || []).find(
      (r) => (r.notificationId || r.id) === job.notificationId
    ) || null
  );
}

/**
 * Process a single claimed job.
 */
export async function processClaimedDeliveryJob(job, options = {}) {
  const repository = options.repository || getNotificationRepository();
  const workerId = options.workerId || "worker-unknown";
  const nowFn = options.now || (() => new Date());
  const jitterSource = options.jitterSource || Math.random;
  const policy = options.retryPolicy || DEFAULT_RETRY_POLICY;
  const deliveryMode = options.deliveryMode || DELIVERY_MODES.SANDBOX;
  const summaryPatch = { status: null };

  if (!job?.id) {
    return { ok: false, error: "job_required", summaryPatch };
  }

  if (isTerminalDeliveryJobState(job.status) && job.status === DELIVERY_JOB_STATES.SENT) {
    return {
      ok: true,
      skipped: true,
      reason: "already_sent",
      job,
      summaryPatch: { status: "skipped" },
    };
  }

  const inbox = await loadInboxForJob(repository, job);
  const deliveryIdempotencyKey =
    job.deliveryIdempotencyKey ||
    buildDeliveryIdempotencyKey({
      notificationIdempotencyKey: inbox?.idempotencyKey || job.notificationId,
      recipientUserId: inbox?.recipientUserId || job.recipientUserId || "unknown",
      channel: job.channel,
      provider:
        job.channel === "in_app"
          ? "in_app"
          : job.channel === "push"
            ? "web_push_disabled"
            : `${job.channel}_sandbox`,
    });

  // Idempotent prior success
  if (job.status === DELIVERY_JOB_STATES.SENT || job.providerMessageId) {
    if (job.status === DELIVERY_JOB_STATES.SENT) {
      return {
        ok: true,
        skipped: true,
        reason: "prior_success",
        job,
        summaryPatch: { status: "skipped" },
      };
    }
  }

  const adapter = resolveWorkerProviderAdapter(job.channel, { mode: deliveryMode });
  const attemptNumber = (job.attempts || 0) + 1;
  const startedAt = (typeof nowFn === "function" ? nowFn() : nowFn).toISOString?.()
    || new Date(nowFn()).toISOString();

  let attemptRecord = {
    attemptId: `att_${job.id}_${attemptNumber}`,
    jobId: job.id,
    attemptNumber,
    workerId,
    channel: job.channel,
    provider: adapter.provider,
    startedAt,
    completedAt: null,
    result: null,
    errorCode: null,
    sanitizedErrorMessage: null,
    retryable: false,
    nextAttemptAt: null,
    providerMessageId: null,
    deliveryMode: adapter.deliveryMode,
  };

  if (typeof repository.createDeliveryAttempt === "function") {
    const created = await repository.createDeliveryAttempt(attemptRecord);
    if (created?.attempt) attemptRecord = { ...attemptRecord, ...created.attempt };
  }

  let providerResult;
  try {
    providerResult = await adapter.send({
      job,
      notificationId: job.notificationId,
      inboxRow: inbox,
      deliveryIdempotencyKey,
      tenantId: job.tenantId,
      simulateFailure: options.simulateFailureForJob?.(job),
      simulatePermanentFailure: options.simulatePermanentFailureForJob?.(job),
      errorCode: options.errorCodeForJob?.(job),
      errorMessage: options.errorMessageForJob?.(job),
    });
  } catch (err) {
    providerResult = {
      ok: false,
      errorCode: "provider_unavailable",
      error: sanitizeDeliveryErrorMessage(err?.message || String(err)),
      retryable: true,
      class: "TRANSIENT",
      deliveryMode: adapter.deliveryMode,
      provider: adapter.provider,
    };
  }

  const completedAt = (typeof nowFn === "function" ? nowFn() : nowFn).toISOString?.()
    || new Date(nowFn()).toISOString();

  if (providerResult?.ok) {
    const transition = assertDeliveryJobTransition(
      DELIVERY_JOB_STATES.PROCESSING,
      DELIVERY_JOB_STATES.SENT
    );
    if (!transition.ok) {
      return { ok: false, error: transition.error, summaryPatch };
    }

    attemptRecord = {
      ...attemptRecord,
      completedAt,
      result: "SUCCESS",
      providerMessageId: providerResult.providerMessageId || null,
      sanitizedErrorMessage: null,
      retryable: false,
    };

    if (typeof repository.completeDeliveryAttempt === "function") {
      await repository.completeDeliveryAttempt(attemptRecord);
    }

    const complete = await repository.completeDeliveryJob({
      jobId: job.id,
      claimToken: job.claimToken,
      workerId,
      status: DELIVERY_JOB_STATES.SENT,
      providerMessageId: providerResult.providerMessageId || null,
      lastError: null,
      deliveryMode: providerResult.deliveryMode || adapter.deliveryMode,
      deliveryIdempotencyKey,
      attemptNumber,
    });

    // in_app: mark inbox SENT without creating a new row (idempotent reuse)
    if (job.channel === "in_app" && inbox && typeof repository.markInboxDelivered === "function") {
      await repository.markInboxDelivered({
        notificationId: job.notificationId,
        tenantId: job.tenantId,
      });
    } else if (
      job.channel === "in_app" &&
      inbox &&
      inbox.status !== NOTIFICATION_STATUSES.READ &&
      inbox.status !== NOTIFICATION_STATUSES.SENT
    ) {
      if (typeof repository.updateInboxStatus === "function") {
        await repository.updateInboxStatus({
          notificationId: job.notificationId,
          tenantId: job.tenantId,
          status: NOTIFICATION_STATUSES.SENT,
        });
      }
    }

    return {
      ok: true,
      job: complete?.job || { ...job, status: DELIVERY_JOB_STATES.SENT },
      attempt: attemptRecord,
      summaryPatch: { status: "sent" },
    };
  }

  const classified = classifyDeliveryFailure({
    errorCode: providerResult?.errorCode,
    message: providerResult?.error || "",
  });
  const retryable =
    providerResult?.retryable != null ? !!providerResult.retryable : classified.retryable;
  const failureClass = providerResult?.class || classified.class;

  const outcome = resolveRetryOutcome({
    failureClass,
    retryable,
    attemptNumber,
    maxAttempts: job.maxAttempts || policy.maxAttempts,
    policy,
    now: nowFn,
    jitterSource,
  });

  const transition = assertDeliveryJobTransition(
    DELIVERY_JOB_STATES.PROCESSING,
    outcome.nextStatus
  );
  if (!transition.ok) {
    return { ok: false, error: transition.error, summaryPatch };
  }

  const sanitized = sanitizeDeliveryErrorMessage(
    providerResult?.error || classified.errorCode
  );

  attemptRecord = {
    ...attemptRecord,
    completedAt,
    result: retryable ? "TRANSIENT_FAILURE" : "PERMANENT_FAILURE",
    errorCode: classified.errorCode || providerResult?.errorCode,
    sanitizedErrorMessage: sanitized,
    retryable,
    nextAttemptAt: outcome.nextAttemptAt,
    providerMessageId: providerResult?.providerMessageId || null,
  };

  if (typeof repository.completeDeliveryAttempt === "function") {
    await repository.completeDeliveryAttempt(attemptRecord);
  }

  const complete = await repository.completeDeliveryJob({
    jobId: job.id,
    claimToken: job.claimToken,
    workerId,
    status: outcome.nextStatus,
    providerMessageId: null,
    lastError: sanitized,
    nextAttemptAt: outcome.nextAttemptAt,
    deliveryMode: providerResult?.deliveryMode || adapter.deliveryMode,
    deliveryIdempotencyKey,
    attemptNumber,
  });

  const statusKey =
    outcome.nextStatus === DELIVERY_JOB_STATES.RETRY_SCHEDULED
      ? "retryScheduled"
      : outcome.nextStatus === DELIVERY_JOB_STATES.DEAD_LETTERED
        ? "deadLettered"
        : "failed";

  return {
    ok: true,
    job: complete?.job || { ...job, status: outcome.nextStatus },
    attempt: attemptRecord,
    summaryPatch: { status: statusKey },
  };
}

/**
 * Run one worker poll cycle: claim → process → summarize.
 */
export async function runNotificationWorkerOnce(options = {}) {
  const guard = assertServerSideWorker(options);
  if (!guard.ok) {
    return { ok: false, error: guard.error, summary: emptySummary() };
  }

  const envGuard = assertEnvironmentAllowed(options);
  if (!envGuard.ok) {
    return { ok: false, error: envGuard.error, summary: emptySummary() };
  }

  const repository = options.repository || getNotificationRepository();
  const workerId =
    options.workerId ||
    `worker_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  const batchSize = Math.min(50, Math.max(1, Number(options.batchSize) || 10));
  const leaseSeconds = Math.min(300, Math.max(5, Number(options.leaseSeconds) || 60));
  const summary = emptySummary();

  if (typeof repository.claimDeliveryJobs !== "function") {
    return {
      ok: false,
      error: "claimDeliveryJobs_not_supported",
      summary,
    };
  }

  const claim = await repository.claimDeliveryJobs({
    workerId,
    batchSize,
    leaseSeconds,
    tenantId: options.tenantId || null,
    now: options.now,
  });

  if (!claim?.ok) {
    summary.errors.push(sanitizeDeliveryErrorMessage(claim?.error || "claim_failed"));
    return { ok: false, error: claim?.error || "claim_failed", summary, workerId };
  }

  const jobs = Array.isArray(claim.jobs) ? claim.jobs : [];
  summary.claimed = jobs.length;

  for (const job of jobs) {
    try {
      const result = await processClaimedDeliveryJob(job, {
        ...options,
        repository,
        workerId,
      });
      if (result.skipped) {
        summary.skipped += 1;
        continue;
      }
      if (!result.ok) {
        summary.errors.push(
          sanitizeDeliveryErrorMessage(result.error || `job_${job.id}_failed`)
        );
        continue;
      }
      const key = result.summaryPatch?.status;
      if (key && summary[key] != null) summary[key] += 1;
    } catch (err) {
      summary.errors.push(sanitizeDeliveryErrorMessage(err?.message || String(err)));
    }
  }

  return {
    ok: true,
    workerId,
    environment: envGuard.environment,
    summary,
  };
}

export {
  assertServerSideWorker,
  assertEnvironmentAllowed,
  emptySummary,
};
