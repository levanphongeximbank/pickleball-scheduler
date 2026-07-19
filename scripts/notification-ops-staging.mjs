/**
 * Phase 1.6 — Staging operational CLI.
 *
 * Commands:
 *   worker-once | queue-health | dead-letters | recover-leases
 *   replay-job | cancel-job | cleanup-namespace
 *
 * Guards: staging project ref only, production hard-blocked, dry-run default for destructive.
 *
 * Usage examples:
 *   node scripts/notification-ops-staging.mjs queue-health
 *   node scripts/notification-ops-staging.mjs worker-once --namespace phase16:<uuid>
 *   node scripts/notification-ops-staging.mjs cancel-job --job <uuid> --reason "qa" --confirm
 *   node scripts/notification-ops-staging.mjs replay-job --job <uuid> --reason "ops" --confirm
 *   node scripts/notification-ops-staging.mjs cleanup-namespace --namespace phase16:<uuid> --confirm
 */
import { loadProjectEnv } from "./load-env.mjs";

const STAGING_REF = "qyewbxjsiiyufanzcjcq";
const PRODUCTION_REF = "expuvcohlcjzvrrauvud";

function parseArgs(argv) {
  const [command, ...rest] = argv;
  const flags = {};
  for (let i = 0; i < rest.length; i += 1) {
    const a = rest[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const next = rest[i + 1];
      if (!next || next.startsWith("--")) {
        flags[key] = true;
      } else {
        flags[key] = next;
        i += 1;
      }
    }
  }
  return { command, flags };
}

function assertStagingDbUrl(url) {
  const value = String(url || "");
  if (!value) throw new Error("SUPABASE_DB_URL required");
  if (value.includes(PRODUCTION_REF)) throw new Error("Production blocked");
  if (!value.includes(STAGING_REF) && !value.toLowerCase().includes("staging")) {
    throw new Error(`URL must include staging ref ${STAGING_REF}`);
  }
}

function requireConfirm(flags, action) {
  if (flags["dry-run"] || flags.dryRun) return false;
  if (flags.confirm === true || flags.confirm === "true") return true;
  console.error(`Refusing destructive action (${action}) without --confirm (or use --dry-run).`);
  process.exit(2);
}

async function withPg(fn) {
  loadProjectEnv();
  const dbUrl = String(process.env.SUPABASE_DB_URL || process.env.DATABASE_URL || "").trim();
  assertStagingDbUrl(dbUrl);
  const pg = await import("pg");
  const client = new pg.default.Client({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  await client.query(
    `select set_config('app.notification_worker_role', 'service_role', false)`
  );
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

async function main() {
  const { command, flags } = parseArgs(process.argv.slice(2));
  if (!command) {
    console.log(`Usage: node scripts/notification-ops-staging.mjs <command> [flags]
Commands: worker-once, queue-health, dead-letters, recover-leases, replay-job, cancel-job, cleanup-namespace`);
    process.exit(1);
  }

  const environment = String(flags.environment || "staging");
  if (environment === "production") {
    console.error("Production execution blocked in Phase 1.6");
    process.exit(1);
  }

  if (command === "queue-health") {
    await withPg(async (client) => {
      const { rows } = await client.query(
        `select public.notification_queue_health($1,$2) as h`,
        [environment, flags.tenant || null]
      );
      console.log(JSON.stringify(rows[0]?.h, null, 2));
    });
    return;
  }

  if (command === "dead-letters") {
    await withPg(async (client) => {
      const { rows } = await client.query(
        `select * from public.notification_delivery_list_dead_letters($1,$2,$3)`,
        [environment, flags.tenant || null, Number(flags.limit || 20)]
      );
      console.log(JSON.stringify(rows, null, 2));
    });
    return;
  }

  if (command === "recover-leases") {
    const confirm = requireConfirm(flags, "recover-leases");
    if (!confirm) {
      console.log("Dry-run only — pass --confirm to recover.");
      process.exit(0);
    }
    await withPg(async (client) => {
      const { rows } = await client.query(
        `select * from public.notification_delivery_recover_stale_leases($1,$2,$3,$4)`,
        [
          environment,
          flags.tenant || null,
          flags.namespace || null,
          Number(flags.limit || 50),
        ]
      );
      console.log(JSON.stringify({ recovered: rows.length, rows }, null, 2));
    });
    return;
  }

  if (command === "cancel-job") {
    if (!flags.job || !flags.reason) {
      console.error("--job and --reason required");
      process.exit(1);
    }
    requireConfirm(flags, "cancel-job");
    await withPg(async (client) => {
      const { rows } = await client.query(
        `select * from public.notification_delivery_cancel_job($1,$2,$3,$4,$5)`,
        [flags.job, flags.by || "ops-cli", flags.reason, environment, !!flags.force]
      );
      const job = rows[0];
      console.log(
        JSON.stringify(
          {
            id: job?.id,
            status: job?.status,
            cancel_requested: job?.cancel_requested,
            cancelled_at: job?.cancelled_at,
          },
          null,
          2
        )
      );
    });
    return;
  }

  if (command === "replay-job") {
    if (!flags.job || !flags.reason) {
      console.error("--job and --reason required");
      process.exit(1);
    }
    requireConfirm(flags, "replay-job");
    await withPg(async (client) => {
      const { rows } = await client.query(
        `select * from public.notification_delivery_replay_job($1,$2,$3,$4)`,
        [flags.job, flags.by || "ops-cli", flags.reason, environment]
      );
      const job = rows[0];
      console.log(
        JSON.stringify(
          {
            id: job?.id,
            status: job?.status,
            replay_generation: job?.replay_generation,
            replayed_from_job_id: job?.replayed_from_job_id,
          },
          null,
          2
        )
      );
    });
    return;
  }

  if (command === "cleanup-namespace") {
    if (!flags.namespace) {
      console.error("--namespace required (exact phase14s:|phase15:|phase16:...)");
      process.exit(1);
    }
    const dryRun = !requireConfirm(flags, "cleanup-namespace");
    await withPg(async (client) => {
      const { rows } = await client.query(
        `select public.notification_qa_cleanup_run_namespace($1,$2,$3,$4,$5) as r`,
        [
          environment,
          flags.namespace,
          flags.tenant || null,
          STAGING_REF,
          dryRun,
        ]
      );
      console.log(JSON.stringify(rows[0]?.r, null, 2));
    });
    return;
  }

  if (command === "worker-once") {
    const { rowToDeliveryJob } = await import(
      "../src/features/notifications/repositories/notificationRowMap.js"
    );
    const { runNotificationWorkerOnce } = await import(
      "../src/features/notifications/workers/notificationDeliveryWorker.js"
    );
    await withPg(async (client) => {
      const repo = {
        async claimDeliveryJobs(args) {
          const { rows } = await client.query(
            `select * from public.notification_delivery_claim_jobs(
              $1::text,$2::int,$3::int,$4::text,$5::text,$6::text,$7::text
            )`,
            [
              args.workerId,
              args.batchSize || 10,
              args.leaseSeconds || 60,
              args.tenantId || null,
              args.environment || environment,
              args.runNamespace || flags.namespace || null,
              args.jobSource || null,
            ]
          );
          return { ok: true, jobs: rows.map(rowToDeliveryJob) };
        },
        async createDeliveryAttempt(a) {
          return this.completeDeliveryAttempt(a);
        },
        async completeDeliveryAttempt(attempt) {
          await client.query(
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
          const { rows } = await client.query(
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
          const { rows } = await client.query(
            `select id, tenant_id, recipient_user_id, status, idempotency_key
             from public.notification_inbox where id=$1`,
            [notificationId]
          );
          if (!rows[0]) return { ok: true, notification: null };
          const r = rows[0];
          return {
            ok: true,
            notification: {
              notificationId: r.id,
              tenantId: r.tenant_id,
              recipientUserId: r.recipient_user_id,
              status: r.status,
              idempotencyKey: r.idempotency_key,
            },
          };
        },
        async markInboxDelivered({ notificationId, tenantId }) {
          await client.query(
            `update public.notification_inbox set status='SENT', updated_at=now()
             where id=$1 and tenant_id=$2 and status<>'READ'`,
            [notificationId, tenantId]
          );
          return { ok: true };
        },
        async startWorkerRun(args) {
          await client.query(
            `select public.notification_worker_run_start($1,$2,$3,$4,$5,$6,$7)`,
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
          return { ok: true };
        },
        async heartbeatWorkerRun({ runId }) {
          await client.query(`select public.notification_worker_run_heartbeat($1)`, [
            runId,
          ]);
          return { ok: true };
        },
        async completeWorkerRun({ runId, status, summary = {} }) {
          await client.query(
            `select public.notification_worker_run_complete(
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
          return { ok: true };
        },
      };

      const result = await runNotificationWorkerOnce({
        repository: repo,
        environment,
        runNamespace: flags.namespace || null,
        tenantId: flags.tenant || null,
        batchSize: Number(flags.batch || 10),
      });
      console.log(
        JSON.stringify(
          {
            ok: result.ok,
            error: result.error || null,
            workerId: result.workerId,
            runId: result.runId,
            environment: result.environment,
            summary: result.summary,
          },
          null,
          2
        )
      );
    });
    return;
  }

  console.error(`Unknown command: ${command}`);
  process.exit(1);
}

main().catch((err) => {
  console.error("❌", err.message || err);
  process.exit(1);
});
