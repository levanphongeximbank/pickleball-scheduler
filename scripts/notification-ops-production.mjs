/**
 * Phase 2B — Production ops CLI (read-only by default).
 *
 * Commands (default read-only):
 *   queue-health | worker-heartbeat | stale-leases | failed-jobs
 *   replay-candidates | cancellations | env-verify | config-verify
 *
 * Write-capable operations require:
 *   --command explicit, --environment production, --tenant, --namespace, --confirm
 *
 * Phase 2B intentionally DOES NOT include a command to enable the Production worker.
 *
 * Live DB access requires NOTIFICATION_PHASE2B_PRODUCTION_PREFLIGHT_APPROVED=1
 * and Production project ref. Otherwise runs fixture/static mode.
 *
 * Usage:
 *   node scripts/notification-ops-production.mjs queue-health --tenant t1
 *   node scripts/notification-ops-production.mjs config-verify
 *   node scripts/notification-ops-production.mjs env-verify
 */
import { loadProjectEnv } from "./load-env.mjs";
import {
  PRODUCTION_PROJECT_REF,
  STAGING_PROJECT_REF,
  PRODUCTION_RUNTIME_DEFAULTS,
  assertProductionRuntimeConfig,
  requireProductionProjectRef,
} from "../src/features/notifications/config/productionSafetyConfig.js";

const READ_ONLY_COMMANDS = new Set([
  "queue-health",
  "worker-heartbeat",
  "stale-leases",
  "failed-jobs",
  "replay-candidates",
  "cancellations",
  "env-verify",
  "config-verify",
  "help",
]);

const WRITE_COMMANDS = new Set([
  // Intentionally empty for Phase 2B — no worker enable, no cleanup write path.
]);

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
  return { command: command || "help", flags };
}

function printHelp() {
  console.log(`Phase 2B Production Ops CLI (read-only default)

Usage: node scripts/notification-ops-production.mjs <command> [flags]

Read-only commands:
  queue-health          Queue health aggregates (tenant-scoped when --tenant set)
  worker-heartbeat      Recent worker run heartbeats
  stale-leases          Count of stale PROCESSING leases
  failed-jobs           Count of FAILED / DEAD_LETTERED jobs
  replay-candidates     Count of terminal jobs eligible for replay (info only)
  cancellations         Count of CANCELLED jobs
  env-verify            Verify environment=production + project ref
  config-verify         Verify fail-closed runtime config defaults

Flags:
  --environment production   Required for any scoped query (default: production)
  --tenant <id>              Tenant scope (recommended)
  --namespace <ns>           Namespace scope
  --fixture                  Force fixture mode (no DB)
  --confirm                  Required for any future write command (none in 2B)

NOT included in Phase 2B:
  enable-worker / allow-worker / cleanup-namespace (write)
`);
}

function fixtureHealth(flags) {
  return {
    mode: "fixture",
    environment: "production",
    tenantId: flags.tenant || null,
    runNamespace: flags.namespace || null,
    queued: 0,
    processing: 0,
    failed: 0,
    deadLettered: 0,
    cancelled: 0,
    staleLeases: 0,
    replayCandidates: 0,
    workerHeartbeatStale: 0,
    note: "fixture — no live Production query",
  };
}

function assertProductionFlags(flags, env) {
  const environment = String(flags.environment || "production").toLowerCase();
  if (environment !== "production") {
    return { ok: false, error: "environment_must_be_production" };
  }
  const ref =
    flags.projectRef ||
    env.NOTIFICATION_PROJECT_REF ||
    env.VITE_SUPABASE_PROJECT_REF ||
    PRODUCTION_PROJECT_REF;
  const check = requireProductionProjectRef(ref);
  if (!check.ok) return check;
  if (String(ref).includes(STAGING_PROJECT_REF)) {
    return { ok: false, error: "staging_project_ref_blocked" };
  }
  return { ok: true, environment, projectRef: PRODUCTION_PROJECT_REF };
}

async function withProductionPg(env, fn) {
  if (String(env.NOTIFICATION_PHASE2B_PRODUCTION_PREFLIGHT_APPROVED || "").trim() !== "1") {
    throw new Error("live_ops_requires_preflight_approval");
  }
  const dbUrl = String(env.SUPABASE_DB_URL || env.DATABASE_URL || "").trim();
  if (!dbUrl) throw new Error("SUPABASE_DB_URL required for live ops");
  if (!dbUrl.includes(PRODUCTION_PROJECT_REF)) {
    throw new Error("DB URL must target Production project ref");
  }
  if (dbUrl.includes(STAGING_PROJECT_REF)) {
    throw new Error("Staging project ref blocked");
  }
  const pg = await import("pg");
  const client = new pg.default.Client({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

export async function runProductionOpsCommand(command, flags = {}, env = process.env) {
  if (!command || command === "help") {
    return { ok: true, help: true };
  }

  if (WRITE_COMMANDS.has(command)) {
    return { ok: false, error: "write_command_not_available_phase2b" };
  }
  if (command === "enable-worker" || command === "allow-worker") {
    return { ok: false, error: "enable_worker_forbidden_phase2b" };
  }
  if (!READ_ONLY_COMMANDS.has(command)) {
    return { ok: false, error: "unknown_command" };
  }

  const gate = assertProductionFlags(flags, env);
  if (!gate.ok) return { ok: false, error: gate.error };

  if (command === "config-verify") {
    const config = flags.runtimeConfig || { ...PRODUCTION_RUNTIME_DEFAULTS };
    const result = assertProductionRuntimeConfig(config);
    return { ok: result.ok, verdict: result.verdict, findings: result.findings, config };
  }

  if (command === "env-verify") {
    return {
      ok: true,
      environment: gate.environment,
      projectRef: gate.projectRef,
      stagingBlocked: true,
      workerEnableCommandPresent: false,
    };
  }

  const useFixture =
    flags.fixture === true ||
    String(env.NOTIFICATION_PHASE2B_PRODUCTION_PREFLIGHT_APPROVED || "").trim() !== "1";

  if (useFixture) {
    const health = fixtureHealth(flags);
    if (command === "queue-health") return { ok: true, health };
    if (command === "worker-heartbeat") {
      return { ok: true, heartbeats: [], staleCount: 0, mode: "fixture" };
    }
    if (command === "stale-leases") {
      return { ok: true, count: 0, mode: "fixture" };
    }
    if (command === "failed-jobs") {
      return { ok: true, failed: 0, deadLettered: 0, mode: "fixture" };
    }
    if (command === "replay-candidates") {
      return { ok: true, count: 0, mode: "fixture", note: "replay remains blocked in production" };
    }
    if (command === "cancellations") {
      return { ok: true, count: 0, mode: "fixture" };
    }
  }

  return withProductionPg(env, async (client) => {
    const environment = gate.environment;
    const tenantId = flags.tenant || null;
    const namespace = flags.namespace || null;

    if (command === "queue-health") {
      const { rows } = await client.query(
        `select public.notification_queue_health($1,$2) as h`,
        [environment, tenantId]
      );
      return { ok: true, health: rows[0]?.h || null, tenantId, namespace };
    }

    if (command === "worker-heartbeat") {
      const { rows } = await client.query(
        `select run_id, worker_id, status, heartbeat_at, environment, tenant_id, run_namespace
         from public.notification_worker_runs
         where environment = $1
           and ($2::text is null or tenant_id = $2)
         order by heartbeat_at desc
         limit 20`,
        [environment, tenantId]
      );
      return { ok: true, heartbeats: rows };
    }

    if (command === "stale-leases") {
      const { rows } = await client.query(
        `select count(*)::int as count
         from public.notification_delivery_jobs
         where environment = $1
           and status = 'PROCESSING'
           and lease_expires_at < now()
           and ($2::text is null or tenant_id = $2)
           and ($3::text is null or run_namespace = $3)`,
        [environment, tenantId, namespace]
      );
      return { ok: true, count: rows[0]?.count || 0 };
    }

    if (command === "failed-jobs") {
      const { rows } = await client.query(
        `select
           count(*) filter (where status = 'FAILED')::int as failed,
           count(*) filter (where status = 'DEAD_LETTERED')::int as dead_lettered
         from public.notification_delivery_jobs
         where environment = $1
           and ($2::text is null or tenant_id = $2)
           and ($3::text is null or run_namespace = $3)`,
        [environment, tenantId, namespace]
      );
      return {
        ok: true,
        failed: rows[0]?.failed || 0,
        deadLettered: rows[0]?.dead_lettered || 0,
      };
    }

    if (command === "replay-candidates") {
      const { rows } = await client.query(
        `select count(*)::int as count
         from public.notification_delivery_jobs
         where environment = $1
           and status in ('FAILED','DEAD_LETTERED','CANCELLED')
           and ($2::text is null or tenant_id = $2)`,
        [environment, tenantId]
      );
      return {
        ok: true,
        count: rows[0]?.count || 0,
        note: "production replay remains blocked; count is informational",
      };
    }

    if (command === "cancellations") {
      const { rows } = await client.query(
        `select count(*)::int as count
         from public.notification_delivery_jobs
         where environment = $1
           and status = 'CANCELLED'
           and ($2::text is null or tenant_id = $2)`,
        [environment, tenantId]
      );
      return { ok: true, count: rows[0]?.count || 0 };
    }

    return { ok: false, error: "unhandled_command" };
  });
}

async function main() {
  loadProjectEnv();
  const { command, flags } = parseArgs(process.argv.slice(2));
  if (command === "help" || !command) {
    printHelp();
    process.exit(0);
  }

  try {
    const result = await runProductionOpsCommand(command, flags, process.env);
    if (result.help) {
      printHelp();
      process.exit(0);
    }
    console.log(JSON.stringify(result, null, 2));
    process.exit(result.ok ? 0 : 1);
  } catch (error) {
    console.error(JSON.stringify({ ok: false, error: String(error?.message || error) }));
    process.exit(1);
  }
}

const isDirect = process.argv[1] && process.argv[1].includes("notification-ops-production");
if (isDirect) {
  main();
}
