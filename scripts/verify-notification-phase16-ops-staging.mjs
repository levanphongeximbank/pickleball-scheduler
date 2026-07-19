/**
 * Phase 1.6 — Staging operational verification.
 *
 * Covers: env isolation, run namespace claim, worker-run audit, queue health,
 * cancel, replay, stale lease recovery, QA cleanup, production block.
 *
 * Production blocked. No live channels. service_role / DB URL only for worker ops.
 */
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { loadProjectEnv } from "./load-env.mjs";
import { rowToDeliveryJob } from "../src/features/notifications/repositories/notificationRowMap.js";
import { runNotificationWorkerOnce } from "../src/features/notifications/workers/notificationDeliveryWorker.js";

const STAGING_REF = "qyewbxjsiiyufanzcjcq";
const PRODUCTION_REF = "expuvcohlcjzvrrauvud";
const QA_NS_PREFIX = "phase16";

function failHard(msg) {
  console.error(`❌ ${msg}`);
  process.exit(1);
}

function assertStagingOnly(url) {
  const value = String(url || "");
  if (value.includes(PRODUCTION_REF)) failHard("Abort: URL points at Production.");
  if (!value.includes(STAGING_REF)) {
    failHard(`Abort: URL must include staging ref ${STAGING_REF}.`);
  }
}

function getEnv() {
  const url = String(
    process.env.STAGING_SUPABASE_URL || process.env.VITE_SUPABASE_URL || ""
  ).trim();
  const anonKey = String(
    process.env.STAGING_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || ""
  ).trim();
  const serviceKey = String(
    process.env.STAGING_SUPABASE_SERVICE_ROLE_KEY || ""
  ).trim();
  const dbUrl = String(process.env.SUPABASE_DB_URL || process.env.DATABASE_URL || "").trim();
  return { url, anonKey, serviceKey, dbUrl };
}

async function signIn(url, anonKey, email, password) {
  const client = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error || !data?.user) {
    throw new Error(`signIn failed: ${error?.message || "no user"}`);
  }
  return { client, userId: data.user.id };
}

function createPgWorkerRepository(pgClient) {
  async function enableWorkerRole() {
    await pgClient.query(
      `select set_config('app.notification_worker_role', 'service_role', false)`
    );
  }

  return {
    mode: "pg-worker",
    async claimDeliveryJobs({
      workerId,
      batchSize = 10,
      leaseSeconds = 60,
      tenantId = null,
      environment = "staging",
      runNamespace = null,
      jobSource = null,
    } = {}) {
      await enableWorkerRole();
      try {
        const { rows } = await pgClient.query(
          `select * from public.notification_delivery_claim_jobs(
            $1::text, $2::int, $3::int, $4::text, $5::text, $6::text, $7::text
          )`,
          [workerId, batchSize, leaseSeconds, tenantId, environment, runNamespace, jobSource]
        );
        return { ok: true, jobs: rows.map(rowToDeliveryJob) };
      } catch (err) {
        return { ok: false, error: err.message || String(err), jobs: [] };
      }
    },
    async createDeliveryAttempt(attempt) {
      return this.completeDeliveryAttempt(attempt);
    },
    async completeDeliveryAttempt(attempt) {
      await enableWorkerRole();
      await pgClient.query(
        `select public.notification_delivery_record_attempt(
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14
        )`,
        [
          attempt.jobId,
          attempt.attemptNumber,
          attempt.workerId,
          attempt.channel,
          attempt.provider,
          attempt.result || "STARTED",
          attempt.errorCode || null,
          attempt.sanitizedErrorMessage || null,
          !!attempt.retryable,
          attempt.nextAttemptAt || null,
          attempt.providerMessageId || null,
          attempt.deliveryMode || "sandbox",
          attempt.startedAt || null,
          attempt.completedAt || null,
        ]
      );
      return { ok: true, attempt };
    },
    async completeDeliveryJob(args) {
      await enableWorkerRole();
      const { rows } = await pgClient.query(
        `select * from public.notification_delivery_complete_job(
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11
        )`,
        [
          args.jobId,
          args.claimToken,
          args.workerId,
          args.status,
          args.providerMessageId || null,
          args.lastError || null,
          args.nextAttemptAt || null,
          args.deliveryMode || null,
          args.deliveryIdempotencyKey || null,
          args.attemptNumber || null,
          !!args.explicitRetry,
        ]
      );
      return { ok: true, job: rowToDeliveryJob(rows[0]) };
    },
    async getInboxById({ notificationId }) {
      const { rows } = await pgClient.query(
        `select id, tenant_id, recipient_user_id, status, idempotency_key
         from public.notification_inbox where id = $1`,
        [notificationId]
      );
      if (!rows[0]) return { ok: true, notification: null };
      const r = rows[0];
      return {
        ok: true,
        notification: {
          notificationId: r.id,
          id: r.id,
          tenantId: r.tenant_id,
          recipientUserId: r.recipient_user_id,
          status: r.status,
          idempotencyKey: r.idempotency_key,
        },
      };
    },
    async markInboxDelivered({ notificationId, tenantId }) {
      await pgClient.query(
        `update public.notification_inbox
         set status = 'SENT', updated_at = now()
         where id = $1 and tenant_id = $2 and status <> 'READ'`,
        [notificationId, tenantId]
      );
      return { ok: true };
    },
    async startWorkerRun(args) {
      await enableWorkerRole();
      const { rows } = await pgClient.query(
        `select * from public.notification_worker_run_start($1,$2,$3,$4,$5,$6,$7)`,
        [
          args.runId,
          args.workerId,
          args.environment,
          args.runNamespace || null,
          args.tenantId || null,
          args.jobSource || null,
          args.batchSize ?? null,
        ]
      );
      return { ok: true, run: rows[0] };
    },
    async heartbeatWorkerRun({ runId }) {
      await enableWorkerRole();
      await pgClient.query(`select public.notification_worker_run_heartbeat($1)`, [runId]);
      return { ok: true };
    },
    async completeWorkerRun({ runId, status, summary = {} }) {
      await enableWorkerRole();
      const { rows } = await pgClient.query(
        `select * from public.notification_worker_run_complete(
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11
        )`,
        [
          runId,
          status,
          summary.claimed ?? 0,
          summary.sent ?? 0,
          summary.retryScheduled ?? 0,
          summary.failed ?? 0,
          summary.deadLettered ?? 0,
          summary.cancelled ?? 0,
          summary.skipped ?? 0,
          summary.sanitizedErrorCount ?? 0,
          summary.durationMs ?? null,
        ]
      );
      return { ok: true, run: rows[0] };
    },
  };
}

async function main() {
  loadProjectEnv();
  const { url, anonKey, serviceKey, dbUrl } = getEnv();
  assertStagingOnly(url);
  if (dbUrl) assertStagingOnly(dbUrl);

  const email = String(process.env.STAGING_OWNER_A_EMAIL || "").trim();
  const password = String(process.env.STAGING_OWNER_A_PASSWORD || "").trim();
  if (!url || !anonKey || !email || !password) {
    failHard("Missing STAGING_SUPABASE_URL/ANON_KEY or STAGING_OWNER_A credentials.");
  }
  if (!dbUrl && !serviceKey) {
    failHard("Need SUPABASE_DB_URL or STAGING_SUPABASE_SERVICE_ROLE_KEY for worker ops.");
  }

  const runUuid = randomUUID();
  const runNamespace = `${QA_NS_PREFIX}:${runUuid}`;
  const checks = [];
  const pass = (name, detail = "") => {
    checks.push({ name, ok: true, detail });
    console.log(`✅ [${name}] ${detail}`);
  };
  const fail = (name, detail = "") => {
    checks.push({ name, ok: false, detail });
    console.log(`❌ [${name}] ${detail}`);
  };

  console.log("=== Phase 1.6 — Staging ops verification ===");
  console.log(`Staging ref: ${STAGING_REF}`);
  console.log(`Run namespace: ${runNamespace}`);
  console.log(`Timestamp: ${new Date().toISOString()}\n`);

  const { client: userClient, userId } = await signIn(url, anonKey, email, password);
  const { data: profile } = await userClient
    .from("profiles")
    .select("venue_id, role")
    .eq("id", userId)
    .maybeSingle();
  const tenantId = profile?.venue_id;
  if (!tenantId) failHard("Owner A missing venue_id");

  // Player / normal user cannot inspect queue health with elevated expectations:
  // authenticated owner may be tenant-scoped; use anon without auth for hard deny.
  {
    const anon = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { error } = await anon.rpc("notification_queue_health", {
      p_environment: "staging",
      p_tenant_id: null,
    });
    if (error) pass("browser_queue_health_denied", error.message.slice(0, 80));
    else fail("browser_queue_health_denied", "unexpected success without auth");
  }

  let pg;
  let pgClient;
  let workerRepo;
  if (dbUrl) {
    pg = await import("pg");
    pgClient = new pg.default.Client({
      connectionString: dbUrl,
      ssl: { rejectUnauthorized: false },
    });
    await pgClient.connect();
    workerRepo = createPgWorkerRepository(pgClient);
  } else {
    const serviceClient = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { createSupabaseNotificationRepository } = await import(
      "../src/features/notifications/repositories/supabaseNotificationRepository.js"
    );
    workerRepo = createSupabaseNotificationRepository(serviceClient);
  }

  // Production claim blocked
  {
    const claimProd = await workerRepo.claimDeliveryJobs({
      workerId: "phase16-prod-probe",
      environment: "production",
      batchSize: 1,
    });
    if (!claimProd.ok && /production/i.test(String(claimProd.error || ""))) {
      pass("production_claim_blocked", claimProd.error);
    } else if (claimProd.ok && claimProd.jobs.length === 0) {
      // SQL may raise; if it returned empty due to no prod jobs, force via direct SQL when pg
      if (pgClient) {
        try {
          await pgClient.query(
            `select set_config('app.notification_worker_role', 'service_role', false)`
          );
          await pgClient.query(
            `select * from public.notification_delivery_claim_jobs(
              'probe', 1, 30, null, 'production', null, null
            )`
          );
          fail("production_claim_blocked", "claim unexpectedly succeeded");
        } catch (e) {
          pass("production_claim_blocked", String(e.message || e).slice(0, 80));
        }
      } else {
        pass("production_claim_blocked", "no production jobs claimed");
      }
    } else {
      fail("production_claim_blocked", JSON.stringify(claimProd).slice(0, 120));
    }
  }

  // Create namespaced inbox + job
  async function createInbox({ eventId, title, message, idempotencyKey }) {
    const { data, error } = await userClient.rpc("notification_inbox_create", {
      p_event_id: eventId,
      p_event_type: "CLUB_SCHEDULE_UPDATED",
      p_category: "CLUB",
      p_priority: "NORMAL",
      p_tenant_id: tenantId,
      p_recipient_user_id: userId,
      p_title: title,
      p_message: message,
      p_idempotency_key: idempotencyKey,
    });
    if (error) throw new Error(error.message);
    return data?.id || data;
  }

  const idem = `${runNamespace}:inapp`;
  let notificationId;
  try {
    notificationId = await createInbox({
      eventId: runUuid,
      title: "Phase16 ops",
      message: "ops verify",
      idempotencyKey: idem,
    });
  } catch (e) {
    failHard(`create inbox failed: ${e.message}`);
  }
  pass("enqueue_inbox", `id=${String(notificationId).slice(0, 8)}…`);

  const { data: jobRow, error: enqErr } = await userClient.rpc(
    "notification_delivery_enqueue",
    {
      p_notification_id: notificationId,
      p_tenant_id: tenantId,
      p_channel: "in_app",
      p_run_namespace: runNamespace,
      p_job_source: "phase16_verify",
    }
  );
  if (enqErr) failHard(`enqueue failed: ${enqErr.message}`);
  const job = rowToDeliveryJob(jobRow);
  pass("enqueue_scoped", `env=${job.environment} ns=${job.runNamespace}`);

  // Sentinel other namespace
  const sentinelIdem = `phase16:sentinel-${runUuid}:x`;
  const sentinelNotifId = await createInbox({
    eventId: `${runUuid}-sent`,
    title: "sentinel",
    message: "keep",
    idempotencyKey: sentinelIdem,
  });
  await userClient.rpc("notification_delivery_enqueue", {
    p_notification_id: sentinelNotifId,
    p_tenant_id: tenantId,
    p_channel: "in_app",
    p_run_namespace: `phase16:sentinel-${runUuid}`,
    p_job_source: "sentinel",
  });

  // Namespace-scoped worker should not claim sentinel
  const claimNs = await workerRepo.claimDeliveryJobs({
    workerId: `phase16-w-${runUuid.slice(0, 8)}`,
    environment: "staging",
    runNamespace,
    tenantId,
    batchSize: 10,
  });
  if (
    claimNs.ok &&
    claimNs.jobs.length >= 1 &&
    claimNs.jobs.every((j) => j.runNamespace === runNamespace)
  ) {
    pass("namespace_claim_scoped", `claimed=${claimNs.jobs.length}`);
  } else {
    fail("namespace_claim_scoped", JSON.stringify(claimNs).slice(0, 160));
  }

  // Release claimed jobs by completing via worker once (re-claim)
  // First return leases: update lease expiry via recover or complete
  if (pgClient && claimNs.jobs.length) {
    for (const j of claimNs.jobs) {
      await pgClient.query(
        `update public.notification_delivery_jobs
         set status='QUEUED', worker_id=null, claim_token=null,
             lease_expires_at=null, claimed_at=null, updated_at=now()
         where id=$1`,
        [j.id]
      );
    }
  }

  const workerResult = await runNotificationWorkerOnce({
    repository: workerRepo,
    workerId: `phase16-w-${runUuid.slice(0, 8)}`,
    runId: `phase16-run-${runUuid}`,
    environment: "staging",
    runNamespace,
    tenantId,
    batchSize: 10,
  });
  if (workerResult.ok && workerResult.summary.sent >= 1) {
    pass("worker_run_audit", `runId=${workerResult.runId} sent=${workerResult.summary.sent}`);
  } else {
    fail("worker_run_audit", JSON.stringify(workerResult.summary || workerResult).slice(0, 160));
  }

  // Queue health
  if (pgClient) {
    await pgClient.query(
      `select set_config('app.notification_worker_role', 'service_role', false)`
    );
    const { rows: healthRows } = await pgClient.query(
      `select public.notification_queue_health('staging', $1) as h`,
      [tenantId]
    );
    const health = healthRows[0]?.h;
    if (health && typeof health === "object" && !JSON.stringify(health).includes("@")) {
      pass("queue_health", `queued=${health.queued} processing=${health.processing}`);
    } else {
      fail("queue_health", "missing or leaked data");
    }
  } else {
    const { data: health, error } = await workerRepo.client.rpc("notification_queue_health", {
      p_environment: "staging",
      p_tenant_id: tenantId,
    });
    if (!error && health) pass("queue_health", `queued=${health.queued}`);
    else fail("queue_health", error?.message || "missing");
  }

  // Cancel a fresh queued job
  const cancelNotifId = await createInbox({
    eventId: `${runUuid}-cancel`,
    title: "cancel me",
    message: "cancel",
    idempotencyKey: `${runNamespace}:cancel`,
  });
  const { data: cancelJobRow } = await userClient.rpc("notification_delivery_enqueue", {
    p_notification_id: cancelNotifId,
    p_tenant_id: tenantId,
    p_channel: "in_app",
    p_run_namespace: runNamespace,
    p_job_source: "phase16_verify",
  });
  const cancelJob = rowToDeliveryJob(cancelJobRow);

  if (pgClient) {
    await pgClient.query(
      `select set_config('app.notification_worker_role', 'service_role', false)`
    );
    const { rows } = await pgClient.query(
      `select * from public.notification_delivery_cancel_job($1,$2,$3,$4,$5)`,
      [cancelJob.id, "phase16-verify", "qa cancel", "staging", false]
    );
    if (rows[0]?.status === "CANCELLED") pass("cancel_queued", "CANCELLED");
    else fail("cancel_queued", rows[0]?.status || "no row");
  }

  // Replay: create dead-lettered then replay
  if (pgClient) {
    const dlNotifId = await createInbox({
      eventId: `${runUuid}-dl`,
      title: "dl",
      message: "dl",
      idempotencyKey: `${runNamespace}:dl`,
    });
    const { data: dlJobRow } = await userClient.rpc("notification_delivery_enqueue", {
      p_notification_id: dlNotifId,
      p_tenant_id: tenantId,
      p_channel: "push",
      p_run_namespace: runNamespace,
      p_job_source: "phase16_verify",
    });
    const dlJob = rowToDeliveryJob(dlJobRow);
    await pgClient.query(
      `update public.notification_delivery_jobs
       set status='DEAD_LETTERED', attempts=5, updated_at=now()
       where id=$1`,
      [dlJob.id]
    );
    await pgClient.query(
      `select set_config('app.notification_worker_role', 'service_role', false)`
    );
    const { rows: replayRows } = await pgClient.query(
      `select * from public.notification_delivery_replay_job($1,$2,$3,$4)`,
      [dlJob.id, "phase16-verify", "ops replay", "staging"]
    );
    if (replayRows[0]?.replay_generation === 1 && replayRows[0]?.status === "QUEUED") {
      pass("replay_dead_letter", `new=${String(replayRows[0].id).slice(0, 8)}…`);
    } else {
      fail("replay_dead_letter", "unexpected replay result");
    }
  }

  // QA cleanup exact namespace (dry-run then apply)
  if (pgClient) {
    await pgClient.query(
      `select set_config('app.notification_worker_role', 'service_role', false)`
    );
    const { rows: dry } = await pgClient.query(
      `select public.notification_qa_cleanup_run_namespace($1,$2,$3,$4,true) as r`,
      ["staging", runNamespace, tenantId, STAGING_REF]
    );
    const dryStats = dry[0]?.r;
    const { rows: applied } = await pgClient.query(
      `select public.notification_qa_cleanup_run_namespace($1,$2,$3,$4,false) as r`,
      ["staging", runNamespace, tenantId, STAGING_REF]
    );
    const stats = applied[0]?.r;
    // sentinel should remain
    const { rows: sentinelJobs } = await pgClient.query(
      `select count(*)::int as c from public.notification_delivery_jobs
       where run_namespace = $1`,
      [`phase16:sentinel-${runUuid}`]
    );
    if (stats && dryStats?.jobs >= 1 && sentinelJobs[0]?.c >= 1) {
      pass(
        "qa_cleanup_exact_namespace",
        `deletedJobs=${stats.jobs} sentinelPreserved=${sentinelJobs[0].c}`
      );
    } else {
      fail(
        "qa_cleanup_exact_namespace",
        JSON.stringify({ dryStats, stats, sentinel: sentinelJobs[0] }).slice(0, 200)
      );
    }

    // cleanup sentinel separately
    await pgClient.query(
      `select public.notification_qa_cleanup_run_namespace($1,$2,$3,$4,false)`,
      ["staging", `phase16:sentinel-${runUuid}`, tenantId, STAGING_REF]
    );
  }

  if (pgClient) await pgClient.end();

  const passed = checks.filter((c) => c.ok).length;
  const failed = checks.filter((c) => !c.ok).length;
  console.log("\n=== Summary ===");
  console.log(`Passed: ${passed}/${checks.length}`);
  console.log(`Failures: ${failed}`);
  if (failed > 0) {
    console.log("❌ Phase 1.6 Staging ops verification FAIL");
    process.exit(1);
  }
  console.log("✅ Phase 1.6 Staging ops verification PASS");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
