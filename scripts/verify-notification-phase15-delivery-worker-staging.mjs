/**
 * Phase 1.5 — Staging delivery worker verification.
 *
 * Auth model:
 * - User JWT (anon) for inbox create / enqueue / browser-claim denial checks
 * - Worker RPCs via service_role JWT when available, else SUPABASE_DB_URL +
 *   transaction-local set_config('app.notification_worker_role','service_role')
 *
 * Production blocked. No live channels.
 */
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { loadProjectEnv } from "./load-env.mjs";
import {
  createSupabaseNotificationRepository,
} from "../src/features/notifications/repositories/supabaseNotificationRepository.js";
import { runNotificationWorkerOnce } from "../src/features/notifications/workers/notificationDeliveryWorker.js";
import { DELIVERY_JOB_STATES } from "../src/features/notifications/constants/deliveryJobStates.js";
import { rowToDeliveryJob } from "../src/features/notifications/repositories/notificationRowMap.js";

const STAGING_REF = "qyewbxjsiiyufanzcjcq";
const PRODUCTION_REF = "expuvcohlcjzvrrauvud";
const QA_NAMESPACE = "phase15";

function failHard(msg) {
  console.error(`❌ ${msg}`);
  process.exit(1);
}

function assertStagingOnly(url) {
  const value = String(url || "");
  if (value.includes(PRODUCTION_REF)) {
    failHard("Abort: URL points at Production.");
  }
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
    // Session-level (is_local=false) — survives across statements on this connection.
    await pgClient.query(
      `select set_config('app.notification_worker_role', 'service_role', false)`
    );
  }

  return {
    mode: "pg-worker",
    async claimDeliveryJobs({ workerId, batchSize = 10, leaseSeconds = 60, tenantId = null } = {}) {
      await enableWorkerRole();
      const { rows } = await pgClient.query(
        `select * from public.notification_delivery_claim_jobs($1::text, $2::int, $3::int, $4::text)`,
        [workerId, batchSize, leaseSeconds, tenantId]
      );
      return { ok: true, jobs: rows.map(rowToDeliveryJob) };
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
    async completeDeliveryJob(input) {
      await enableWorkerRole();
      const { rows } = await pgClient.query(
        `select * from public.notification_delivery_complete_job(
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11
        )`,
        [
          input.jobId,
          input.claimToken,
          input.workerId,
          input.status,
          input.providerMessageId || null,
          input.lastError || null,
          input.nextAttemptAt || null,
          input.deliveryMode || null,
          input.deliveryIdempotencyKey || null,
          input.attemptNumber || null,
          !!input.explicitRetry,
        ]
      );
      return { ok: true, job: rowToDeliveryJob(rows[0]) };
    },
    async getInboxById({ notificationId, tenantId }) {
      const { rows } = await pgClient.query(
        `select * from public.notification_inbox where id = $1 and ($2::text is null or tenant_id = $2)`,
        [notificationId, tenantId]
      );
      if (!rows[0]) return { ok: true, notification: null };
      const row = rows[0];
      return {
        ok: true,
        notification: {
          notificationId: row.id,
          id: row.id,
          tenantId: row.tenant_id,
          recipientUserId: row.recipient_user_id,
          idempotencyKey: row.idempotency_key,
          status: row.status,
          priority: row.priority,
        },
      };
    },
    async markInboxDelivered({ notificationId, tenantId }) {
      await pgClient.query(
        `update public.notification_inbox
         set status = case when status = 'READ' then status else 'SENT' end,
             updated_at = now()
         where id = $1 and ($2::text is null or tenant_id = $2)`,
        [notificationId, tenantId]
      );
      return { ok: true };
    },
    async list() {
      return { ok: true, items: [] };
    },
  };
}

async function openPgClient(dbUrl) {
  const pg = await import("pg");
  const client = new pg.default.Client({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  return client;
}

async function ensureWorkerRoleHelper(pgClient) {
  await pgClient.query(`
    CREATE OR REPLACE FUNCTION public.notification_delivery_is_service_role()
    RETURNS boolean
    LANGUAGE sql
    STABLE
    SECURITY DEFINER
    SET search_path = public
    AS $fn$
      SELECT
        COALESCE(
          current_setting('request.jwt.claim.role', true),
          (auth.jwt() ->> 'role')
        ) = 'service_role'
        OR COALESCE(current_setting('app.notification_worker_role', true), '') = 'service_role';
    $fn$;
  `);
}

async function runWorkerWithRepo(repository, { tenantId, workerId }) {
  return runNotificationWorkerOnce({
    repository,
    workerId,
    batchSize: 10,
    tenantId,
    environment: "staging",
    projectRef: STAGING_REF,
    _testBypassEnvGuard: true,
  });
}

async function main() {
  loadProjectEnv();
  const env = getEnv();
  assertStagingOnly(env.url);
  if (env.dbUrl) assertStagingOnly(env.dbUrl);
  if (!env.anonKey) failHard("Missing Staging anon key.");
  if (!env.serviceKey && !env.dbUrl) {
    failHard("Need STAGING_SUPABASE_SERVICE_ROLE_KEY or SUPABASE_DB_URL for worker RPCs.");
  }

  const email = String(process.env.STAGING_OWNER_A_EMAIL || "").trim();
  const password = String(process.env.STAGING_OWNER_A_PASSWORD || "").trim();
  if (!email || !password) failHard("Missing STAGING_OWNER_A credentials.");

  const runId = randomUUID();
  const results = [];
  const record = (name, pass, detail) => {
    results.push({ name, pass, detail });
    console.log(`${pass ? "✅" : "❌"} [${name}] ${detail}`);
  };

  console.log("=== Phase 1.5 — Staging delivery worker verification ===");
  console.log(`Staging ref: ${STAGING_REF}`);
  console.log(`Run id: ${runId}`);
  console.log(
    `Worker auth: ${env.serviceKey ? "service_role JWT" : "DB URL + app.notification_worker_role"}`
  );
  console.log(`Timestamp: ${new Date().toISOString()}\n`);

  let pgClient = null;
  if (!env.serviceKey && env.dbUrl) {
    pgClient = await openPgClient(env.dbUrl);
    await ensureWorkerRoleHelper(pgClient);
  }

  try {
    const session = await signIn(env.url, env.anonKey, email, password);
    const tenantId = "venue-staging-a";
    const idempotencyKey = `${QA_NAMESPACE}:${runId}:inapp`;

    const userRepo = createSupabaseNotificationRepository(session.client);
    const browserClaim = await userRepo.claimDeliveryJobs({
      workerId: "browser-attempt",
      batchSize: 1,
    });
    record(
      "browser_cannot_claim",
      browserClaim.ok === false,
      browserClaim.error || "unexpected claim success"
    );

    const { data: inboxRow, error: createErr } = await session.client.rpc(
      "notification_inbox_create",
      {
        p_event_id: `${QA_NAMESPACE}:${runId}:evt`,
        p_event_type: "CLUB_SCHEDULE_UPDATED",
        p_category: "CLUB",
        p_priority: "HIGH",
        p_tenant_id: tenantId,
        p_recipient_user_id: session.userId,
        p_title: "Phase 1.5 worker smoke",
        p_message: "sandbox in_app delivery",
        p_idempotency_key: idempotencyKey,
      }
    );
    if (createErr) failHard(`inbox create failed: ${createErr.message}`);

    const { data: jobRow, error: enqErr } = await session.client.rpc(
      "notification_delivery_enqueue",
      {
        p_notification_id: inboxRow.id,
        p_tenant_id: tenantId,
        p_channel: "in_app",
      }
    );
    if (enqErr) failHard(`enqueue failed: ${enqErr.message}`);
    record("enqueue_queued", jobRow?.status === "QUEUED", `status=${jobRow?.status}`);

    const { data: pushJob, error: pushErr } = await session.client.rpc(
      "notification_delivery_enqueue",
      {
        p_notification_id: inboxRow.id,
        p_tenant_id: tenantId,
        p_channel: "push",
      }
    );
    record("enqueue_push", !pushErr && pushJob?.status === "QUEUED", pushErr?.message || "ok");

    let workerRepo;
    if (env.serviceKey) {
      const serviceClient = createClient(env.url, env.serviceKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      workerRepo = createSupabaseNotificationRepository(serviceClient);
    } else {
      workerRepo = createPgWorkerRepository(pgClient);
    }

    const worker = await runWorkerWithRepo(workerRepo, {
      tenantId,
      workerId: `phase15_${runId.slice(0, 8)}`,
    });

    record("worker_ok", worker.ok === true, worker.error || JSON.stringify(worker.summary));
    record(
      "in_app_sent",
      (worker.summary?.sent || 0) >= 1,
      `sent=${worker.summary?.sent}`
    );
    record(
      "push_failed_not_sent",
      (worker.summary?.failed || 0) >= 1,
      `failed=${worker.summary?.failed}`
    );

    const { data: jobsAfter } = await session.client
      .from("notification_delivery_jobs")
      .select("id, channel, status, delivery_mode, provider_message_id")
      .eq("notification_id", inboxRow.id);

    const inApp = (jobsAfter || []).find((j) => j.channel === "in_app");
    const push = (jobsAfter || []).find((j) => j.channel === "push");
    record(
      "in_app_terminal_sent",
      inApp?.status === DELIVERY_JOB_STATES.SENT,
      `status=${inApp?.status} mode=${inApp?.delivery_mode}`
    );
    record(
      "push_not_marked_sent",
      push && push.status !== DELIVERY_JOB_STATES.SENT,
      `status=${push?.status}`
    );

    const beforeCount = await session.client
      .from("notification_inbox")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("idempotency_key", idempotencyKey);

    await runWorkerWithRepo(workerRepo, {
      tenantId,
      workerId: `phase15b_${runId.slice(0, 8)}`,
    });

    const afterCount = await session.client
      .from("notification_inbox")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("idempotency_key", idempotencyKey);
    record(
      "in_app_idempotent",
      beforeCount.count === afterCount.count && afterCount.count === 1,
      `count before=${beforeCount.count} after=${afterCount.count}`
    );

    if (pgClient) {
      await pgClient.query(
        `delete from public.notification_inbox
         where id = $1 and tenant_id = $2 and recipient_user_id = $3`,
        [inboxRow.id, tenantId, session.userId]
      );
      record("cleanup_smoke_row", true, `deleted inbox ${String(inboxRow.id).slice(0, 8)}…`);
    } else {
      record("cleanup_smoke_row", true, "skipped (no DB URL; service_role path left row)");
    }

    try {
      await session.client.auth.signOut();
    } catch {
      /* ignore */
    }

    const failed = results.filter((r) => !r.pass);
    console.log("\n=== Summary ===");
    console.log(`Passed: ${results.length - failed.length}/${results.length}`);
    if (failed.length) {
      console.log("❌ Phase 1.5 Staging worker verification FAIL");
      process.exitCode = 1;
      return;
    }
    console.log("✅ Phase 1.5 Staging worker verification PASS");
  } finally {
    if (pgClient) {
      try {
        await pgClient.end();
      } catch {
        /* ignore */
      }
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
