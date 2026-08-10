/**
 * OPERATION B1B — WP5 real PostgreSQL harness helpers.
 *
 * Safety: fail-closed local/disposable endpoints only.
 * Never connects to Supabase / Staging / Production project refs.
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const SQL_DIR = path.join(
  ROOT,
  "docs/v5/operations/production-qa-identity-operation-b1b-remediation/sql"
);
const BOOTSTRAP_SQL = path.join(
  ROOT,
  "tests/fixtures/operation-b1b-wp5-bootstrap.sql"
);

export const WP1_FORWARD = "10_QA_IDENTITY_QUARANTINES_FORWARD.sql";
export const WP2_FORWARD = "20_QA_IDENTITY_QUARANTINE_AUTHORITY_FORWARD.sql";
export const WP2_ROLLBACK = "80_QA_IDENTITY_QUARANTINE_AUTHORITY_ROLLBACK.sql";
export const WP1_ROLLBACK = "90_QA_IDENTITY_QUARANTINES_ROLLBACK.sql";

export const FORBIDDEN_HOST_MARKERS = Object.freeze([
  "supabase.co",
  "supabase.com",
  "expuvcohlcjzvrrauvud",
  "qyewbxjsiiyufanzcjcq",
  "pooler.supabase",
]);

export const LOCAL_HOSTS = Object.freeze(
  new Set(["localhost", "127.0.0.1", "::1", "[::1]"])
);

/** Explicit disposable DB name prefix required by safety gate. */
export const WP5_DB_NAME_PREFIX = "b1b_wp5_";

export const IMMUTABLE_FIELDS = Object.freeze([
  "profile_id",
  "auth_user_id",
  "venue_id",
  "batch_id",
  "source_operation",
  "original_auth_banned",
  "original_profile_status",
  "created_at",
  "created_by",
  "reason",
  "allowlist_sha256",
  "snapshot_sha256",
  "expected_email",
  "allowlist_label",
]);

export function repoRoot() {
  return ROOT;
}

export function readSqlFile(name) {
  return fs.readFileSync(path.join(SQL_DIR, name), "utf8");
}

export function readBootstrapSql() {
  return fs.readFileSync(BOOTSTRAP_SQL, "utf8");
}

function redactUrl(raw) {
  try {
    const u = new URL(raw);
    if (u.password) u.password = "***";
    return u.toString();
  } catch {
    return "[unparseable-url]";
  }
}

/**
 * Fail-closed connection safety gate.
 * @param {string} databaseUrl
 * @returns {{ ok: true, url: URL, hostClass: string } | { ok: false, reason: string }}
 */
export function assertSafeWp5DatabaseUrl(databaseUrl) {
  if (typeof databaseUrl !== "string" || databaseUrl.trim() === "") {
    return { ok: false, reason: "missing_database_url" };
  }
  const trimmed = databaseUrl.trim();
  const lower = trimmed.toLowerCase();

  for (const marker of FORBIDDEN_HOST_MARKERS) {
    if (lower.includes(marker)) {
      return { ok: false, reason: `forbidden_marker:${marker}` };
    }
  }

  let url;
  try {
    url = new URL(trimmed);
  } catch {
    return { ok: false, reason: "invalid_url" };
  }

  if (!["postgres:", "postgresql:"].includes(url.protocol)) {
    return { ok: false, reason: `invalid_protocol:${url.protocol}` };
  }

  const host = (url.hostname || "").toLowerCase();
  if (!LOCAL_HOSTS.has(host)) {
    return { ok: false, reason: `non_local_host:${host || "empty"}` };
  }

  const dbName = decodeURIComponent((url.pathname || "").replace(/^\//, ""));
  if (!dbName || !dbName.startsWith(WP5_DB_NAME_PREFIX)) {
    return {
      ok: false,
      reason: `database_name_not_wp5_scoped:${dbName || "empty"}`,
    };
  }

  const hostClass =
    host === "localhost" || host === "127.0.0.1" || host === "::1" || host === "[::1]"
      ? "LOCAL_LOOPBACK_OR_DISPOSABLE_DOCKER"
      : "UNKNOWN";

  return { ok: true, url, hostClass, redacted: redactUrl(trimmed) };
}

export function isWp5RealPostgresEnabled() {
  const flag = String(process.env.OPERATION_B1B_WP5_ENABLE_REAL_POSTGRES || "")
    .trim()
    .toLowerCase();
  if (flag === "1" || flag === "true" || flag === "yes") return true;
  if (process.env.OPERATION_B1B_WP5_DATABASE_URL) return true;
  return false;
}

export function detectLocalPostgresCapability() {
  const docker = spawnSync("docker", ["--version"], { encoding: "utf8" });
  const psql = spawnSync("psql", ["--version"], { encoding: "utf8" });
  const pgIsReady = spawnSync("pg_isready", ["--version"], { encoding: "utf8" });
  return {
    docker: docker.status === 0,
    psql: psql.status === 0,
    pgIsReady: pgIsReady.status === 0,
    dockerVersion: docker.status === 0 ? String(docker.stdout || "").trim() : null,
    psqlVersion: psql.status === 0 ? String(psql.stdout || "").trim() : null,
  };
}

/**
 * Create a pg Client only after safety gate passes.
 */
export function createSafeWp5Client(databaseUrl, overrides = {}) {
  const gate = assertSafeWp5DatabaseUrl(databaseUrl);
  if (!gate.ok) {
    throw new Error(`WP5_DB_SAFETY_GATE:${gate.reason}`);
  }
  return {
    client: new pg.Client({ connectionString: databaseUrl, ...overrides }),
    gate,
  };
}

export async function withSafeClient(databaseUrl, fn) {
  const { client, gate } = createSafeWp5Client(databaseUrl);
  await client.connect();
  try {
    return await fn(client, gate);
  } finally {
    await client.end().catch(() => {});
  }
}

/** Split SQL on semicolons outside dollar-quotes / quotes — used for bootstrap only. */
export function splitSqlStatements(sql) {
  const statements = [];
  let buf = "";
  let i = 0;
  let inSingle = false;
  let dollarTag = null;
  while (i < sql.length) {
    const ch = sql[i];
    if (dollarTag) {
      if (sql.startsWith(dollarTag, i)) {
        buf += dollarTag;
        i += dollarTag.length;
        dollarTag = null;
        continue;
      }
      buf += ch;
      i += 1;
      continue;
    }
    if (inSingle) {
      buf += ch;
      if (ch === "'" && sql[i + 1] === "'") {
        buf += "'";
        i += 2;
        continue;
      }
      if (ch === "'") inSingle = false;
      i += 1;
      continue;
    }
    if (ch === "'") {
      inSingle = true;
      buf += ch;
      i += 1;
      continue;
    }
    if (ch === "$") {
      const m = sql.slice(i).match(/^\$[A-Za-z0-9_]*\$/);
      if (m) {
        dollarTag = m[0];
        buf += dollarTag;
        i += dollarTag.length;
        continue;
      }
    }
    if (ch === ";") {
      const stmt = buf.trim();
      if (stmt) statements.push(stmt);
      buf = "";
      i += 1;
      continue;
    }
    buf += ch;
    i += 1;
  }
  const tail = buf.trim();
  if (tail) statements.push(tail);
  return statements;
}

export async function execSqlFile(client, sqlText) {
  // Prefer single simple query protocol for full scripts (DO blocks, functions).
  await client.query(sqlText);
}

export async function bootstrapWp5Database(client) {
  await execSqlFile(client, readBootstrapSql());
}

export async function applyWp1Forward(client) {
  await execSqlFile(client, readSqlFile(WP1_FORWARD));
}

export async function applyWp2Forward(client) {
  await execSqlFile(client, readSqlFile(WP2_FORWARD));
}

export async function applyWp2Rollback(client) {
  await execSqlFile(client, readSqlFile(WP2_ROLLBACK));
}

export async function applyWp1Rollback(client) {
  await execSqlFile(client, readSqlFile(WP1_ROLLBACK));
}

export async function resetSessionGuc(client) {
  try {
    await client.query("RESET ROLE");
  } catch {
    /* ignore */
  }
  // Session-level GUCs so AuthZ works outside an explicit transaction block.
  await client.query(`SELECT set_config('request.jwt.claim.sub', '', false)`);
  await client.query(`SELECT set_config('request.jwt.claim.role', '', false)`);
  await client.query(`SELECT set_config('request.jwt.claim.email', '', false)`);
}

/**
 * Establish JWT-claim + optional SET ROLE context for AuthZ proofs.
 */
export async function asRole(client, { role, sub = null, email = null } = {}) {
  await resetSessionGuc(client);
  if (sub) {
    await client.query(`SELECT set_config('request.jwt.claim.sub', $1, false)`, [
      String(sub),
    ]);
  }
  if (role) {
    await client.query(`SELECT set_config('request.jwt.claim.role', $1, false)`, [
      String(role),
    ]);
  }
  if (email) {
    await client.query(`SELECT set_config('request.jwt.claim.email', $1, false)`, [
      String(email),
    ]);
  }
  // SET ROLE for privilege checks (anon/authenticated/service_role).
  if (role && ["anon", "authenticated", "service_role", "wp5_tenant_role"].includes(role)) {
    await client.query(`SET ROLE ${role}`);
  }
}

export function sha256Hex(text) {
  return crypto.createHash("sha256").update(String(text), "utf8").digest("hex");
}

export function uuidFromInt(n, prefix = "aaaaaaaa-bbbb-4ccc-8ddd") {
  const hex = Number(n).toString(16).padStart(12, "0");
  return `${prefix}-${hex}`;
}

export async function seedAuthUser(client, { id, email, bannedUntil = null }) {
  await resetSessionGuc(client);
  await client.query(
    `INSERT INTO auth.users (id, email, banned_until)
     VALUES ($1::uuid, $2::text, $3::timestamptz)
     ON CONFLICT (id) DO UPDATE
       SET email = EXCLUDED.email,
           banned_until = EXCLUDED.banned_until`,
    [id, email, bannedUntil]
  );
}

export async function seedProfile(
  client,
  {
    id,
    email,
    role = "PLAYER",
    status = "active",
    venueId = "venue-wp5-local",
    displayName = "WP5 Fixture",
  }
) {
  await resetSessionGuc(client);
  await seedAuthUser(client, { id, email });
  await client.query(
    `INSERT INTO public.profiles (id, email, display_name, role, venue_id, status)
     VALUES ($1::uuid, $2::text, $3::text, $4::text, $5::text, $6::text)
     ON CONFLICT (id) DO UPDATE
       SET email = EXCLUDED.email,
           display_name = EXCLUDED.display_name,
           role = EXCLUDED.role,
           venue_id = EXCLUDED.venue_id,
           status = EXCLUDED.status`,
    [id, email, displayName, role, venueId, status]
  );
}

const RPC_ARG_CASTS = Object.freeze({
  p_profile_id: "uuid",
  p_auth_user_id: "uuid",
  p_batch_id: "uuid",
  p_quarantine_id: "uuid",
  p_allowlist_sha256: "text",
  p_snapshot_sha256: "text",
  p_reason: "text",
  p_original_profile_status: "text",
  p_original_auth_banned: "boolean",
  p_expected_email: "text",
  p_allowlist_label: "text",
  p_metadata: "jsonb",
  p_expected_lifecycle_version: "integer",
  p_auth_ban_readback_confirmed: "boolean",
  p_target_auth_ban_state: "text",
  p_failure_classification: "text",
  p_release_reason: "text",
  p_profile_ids: "uuid[]",
  p_bindings: "jsonb",
});

export async function callRpcJson(client, fnName, argsObject) {
  const keys = Object.keys(argsObject);
  const named = keys
    .map((k, i) => {
      const cast = RPC_ARG_CASTS[k] ? `::${RPC_ARG_CASTS[k]}` : "";
      return `${k} => $${i + 1}${cast}`;
    })
    .join(", ");
  const sql = `SELECT public.${fnName}(${named}) AS result`;
  const values = keys.map((k) => argsObject[k]);
  const { rows } = await client.query(sql, values);
  return rows[0]?.result ?? null;
}

export async function expectQueryRejects(client, sql, params = [], pattern = null) {
  try {
    await client.query(sql, params);
    assert.fail(`expected query to reject: ${sql}`);
  } catch (err) {
    if (pattern) {
      assert.match(String(err.message || err), pattern);
    }
    return err;
  }
}

/**
 * Admin/superuser path (no SET ROLE) for inserting authority rows that
 * violate constraints under test — bypasses RLS privilege revoke as table owner.
 */
export async function insertAuthorityRow(client, row) {
  const cols = Object.keys(row);
  const vals = cols.map((c) => row[c]);
  const placeholders = cols.map((_, i) => `$${i + 1}`).join(", ");
  const sql = `
    INSERT INTO public.qa_identity_quarantines (${cols.join(", ")})
    VALUES (${placeholders})
    RETURNING *
  `;
  const { rows } = await client.query(sql, vals);
  return rows[0];
}

export async function getProfileStatus(client, profileId) {
  const { rows } = await client.query(
    `SELECT status FROM public.profiles WHERE id = $1`,
    [profileId]
  );
  return rows[0]?.status ?? null;
}

export async function countActiveAuthority(client, profileId = null) {
  if (profileId) {
    const { rows } = await client.query(
      `SELECT count(*)::int AS n
       FROM public.qa_identity_quarantines
       WHERE lifecycle_state = 'active' AND profile_id = $1`,
      [profileId]
    );
    return rows[0].n;
  }
  const { rows } = await client.query(
    `SELECT count(*)::int AS n
     FROM public.qa_identity_quarantines
     WHERE lifecycle_state = 'active'`
  );
  return rows[0].n;
}

/**
 * Sanitize inet_server_addr() for diagnostic evidence only.
 * Never used to decide POSTGRES_REMOTE_CONNECTIONS.
 */
export function sanitizeObservedServerAddr(addr) {
  if (addr == null || addr === "") return "local/unix-or-loopback";
  return String(addr);
}

/**
 * Classify WP5 connection TARGET from the safety-gated database URL.
 * Authority is the URL host (loopback disposable only) — NOT inet_server_addr().
 * Private/RFC1918/Docker-bridge addresses are never treated as safe targets.
 */
export function classifyWp5ConnectionTarget(databaseUrl) {
  const gate = assertSafeWp5DatabaseUrl(databaseUrl);
  if (!gate.ok) {
    return {
      ok: false,
      reason: gate.reason,
      POSTGRES_HOST_CLASS: null,
      POSTGRES_REMOTE_CONNECTIONS: 1,
    };
  }
  return {
    ok: true,
    reason: null,
    hostClass: gate.hostClass,
    POSTGRES_HOST_CLASS: gate.hostClass,
    // Validated loopback/disposable Docker publish target ⇒ not remote.
    POSTGRES_REMOTE_CONNECTIONS: 0,
    redacted: gate.redacted,
  };
}

/**
 * Read sanitized server evidence after a safety-gated connection is open.
 * Remote/local classification uses the validated connection TARGET (databaseUrl),
 * re-checked via assertSafeWp5DatabaseUrl(). inet_server_addr() is diagnostic only
 * (Docker containers often report a bridge address even when the client target is
 * 127.0.0.1:<published-port>).
 *
 * @param {import('pg').Client} client
 * @param {{ databaseUrl: string }} options
 */
export async function readServerEvidence(client, { databaseUrl } = {}) {
  const target = classifyWp5ConnectionTarget(databaseUrl);
  if (!target.ok) {
    throw new Error(`WP5_DB_SAFETY_GATE:${target.reason}`);
  }

  const { rows } = await client.query(`
    SELECT
      version() AS version,
      inet_server_addr() AS addr,
      current_database() AS db,
      current_user AS current_user,
      session_user AS session_user
  `);
  const row = rows[0];
  return {
    POSTGRES_REAL_SERVER: "YES",
    POSTGRES_VERSION: String(row.version).split(",")[0].trim(),
    POSTGRES_HOST_CLASS: target.POSTGRES_HOST_CLASS,
    POSTGRES_REMOTE_CONNECTIONS: target.POSTGRES_REMOTE_CONNECTIONS,
    SUPABASE_CONNECTIONS: 0,
    database: row.db,
    // Diagnostic only — may be a Docker bridge IP; does not drive remote classification.
    POSTGRES_OBSERVED_SERVER_ADDR: sanitizeObservedServerAddr(row.addr),
  };
}

/**
 * Attempt to start a disposable embedded PostgreSQL in OS temp.
 * Does not mutate package.json / package-lock.
 * Returns connection URL + cleanup fn, or null if unavailable.
 */
export async function tryStartEmbeddedPostgres() {
  // Prefer a space-free base path on Windows (user profile paths often break initdb).
  const base =
    process.platform === "win32"
      ? path.join("C:\\PVN-WT", "b1b-wp5-embed-work")
      : path.join(os.tmpdir(), "b1b-wp5-embed-work");
  fs.mkdirSync(base, { recursive: true });
  const work = fs.mkdtempSync(path.join(base, "run-"));
  // PG16 binaries are proven on Windows via zonky/embedded-postgres; PG18 initdb
  // currently crashes on this host (0xC0000005). Keep package.json unchanged.
  const embedVersion = process.env.OPERATION_B1B_WP5_EMBEDDED_PG_VERSION || "16.4.0-beta.14";
  const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";
  const install = spawnSync(
    npmCmd,
    ["install", `embedded-postgres@${embedVersion}`, "--no-save", "--no-package-lock"],
    {
      cwd: work,
      encoding: "utf8",
      timeout: 600000,
      shell: process.platform === "win32",
      env: process.env,
    }
  );
  if (install.status !== 0) {
    return {
      ok: false,
      reason: "embedded_postgres_install_failed",
      detail: String(
        install.stderr ||
          install.stdout ||
          install.error?.message ||
          `status=${install.status}`
      ).slice(0, 800),
      cleanup: async () => {
        fs.rmSync(work, { recursive: true, force: true });
      },
    };
  }

  const modPath = path.join(work, "node_modules", "embedded-postgres", "dist", "index.js");
  if (!fs.existsSync(modPath)) {
    return {
      ok: false,
      reason: "embedded_postgres_module_missing",
      cleanup: async () => {
        fs.rmSync(work, { recursive: true, force: true });
      },
    };
  }

  const EmbeddedPostgres = (await import(pathToFileUrl(modPath))).default;
  const dataDir = path.join(work, "data");
  const port = 55432 + Math.floor(Math.random() * 200);
  const password = crypto.randomBytes(16).toString("hex");
  const dbName = `${WP5_DB_NAME_PREFIX}${crypto.randomBytes(4).toString("hex")}`;
  const server = new EmbeddedPostgres({
    databaseDir: dataDir,
    user: "postgres",
    password,
    port,
    persistent: false,
    // Merged B1B SQL contains UTF-8 punctuation in comments/strings; WIN1252 init fails.
    initdbFlags: ["--encoding=UTF8", "--locale=C"],
  });

  try {
    await server.initialise();
    await server.start();
    await server.createDatabase(dbName);
  } catch (err) {
    try {
      await server.stop();
    } catch {
      /* ignore */
    }
    return {
      ok: false,
      reason: "embedded_postgres_start_failed",
      detail: String(err?.message || err).slice(0, 500),
      cleanup: async () => {
        fs.rmSync(work, { recursive: true, force: true });
      },
    };
  }

  const url = `postgresql://postgres:${password}@127.0.0.1:${port}/${dbName}`;
  const gate = assertSafeWp5DatabaseUrl(url);
  if (!gate.ok) {
    try {
      await server.stop();
    } catch {
      /* ignore */
    }
    return {
      ok: false,
      reason: `embedded_url_rejected:${gate.reason}`,
      cleanup: async () => {
        fs.rmSync(work, { recursive: true, force: true });
      },
    };
  }

  return {
    ok: true,
    databaseUrl: url,
    hostClass: gate.hostClass,
    provisioner: "embedded-postgres",
    cleanup: async () => {
      try {
        await server.stop();
      } catch {
        /* ignore */
      }
      try {
        fs.rmSync(work, { recursive: true, force: true });
      } catch {
        /* Windows may briefly lock PG data files; disposable workdir is outside repo */
      }
    },
  };
}

function pathToFileUrl(p) {
  const resolved = path.resolve(p);
  if (process.platform === "win32") {
    return `file:///${resolved.replace(/\\/g, "/")}`;
  }
  return `file://${resolved}`;
}

/**
 * Try Docker disposable postgres if docker CLI exists.
 */
export async function tryStartDockerPostgres() {
  const cap = detectLocalPostgresCapability();
  if (!cap.docker) {
    return { ok: false, reason: "docker_unavailable" };
  }
  const name = `b1b-wp5-pg-${crypto.randomBytes(3).toString("hex")}`;
  const password = crypto.randomBytes(16).toString("hex");
  const dbName = `${WP5_DB_NAME_PREFIX}${crypto.randomBytes(4).toString("hex")}`;
  const port = 55432 + Math.floor(Math.random() * 200);
  const run = spawnSync(
    "docker",
    [
      "run",
      "-d",
      "--rm",
      "--name",
      name,
      "-e",
      `POSTGRES_PASSWORD=${password}`,
      "-e",
      `POSTGRES_DB=${dbName}`,
      "-p",
      `127.0.0.1:${port}:5432`,
      "postgres:16-alpine",
    ],
    { encoding: "utf8" }
  );
  if (run.status !== 0) {
    return {
      ok: false,
      reason: "docker_run_failed",
      detail: String(run.stderr || run.stdout || "").slice(0, 500),
    };
  }

  const url = `postgresql://postgres:${password}@127.0.0.1:${port}/${dbName}`;
  // Wait for readiness
  let ready = false;
  for (let i = 0; i < 40; i += 1) {
    try {
      const { client } = createSafeWp5Client(url);
      await client.connect();
      await client.query("SELECT 1");
      await client.end();
      ready = true;
      break;
    } catch {
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  if (!ready) {
    spawnSync("docker", ["rm", "-f", name], { encoding: "utf8" });
    return { ok: false, reason: "docker_postgres_not_ready" };
  }

  return {
    ok: true,
    databaseUrl: url,
    hostClass: "LOCAL_LOOPBACK_OR_DISPOSABLE_DOCKER",
    provisioner: "docker",
    cleanup: async () => {
      spawnSync("docker", ["rm", "-f", name], { encoding: "utf8" });
    },
  };
}

/**
 * Resolve a disposable local DB URL for WP5.
 * Order: explicit env URL → Docker → embedded-postgres.
 */
export async function resolveWp5Database() {
  const explicit = process.env.OPERATION_B1B_WP5_DATABASE_URL;
  if (explicit) {
    const gate = assertSafeWp5DatabaseUrl(explicit);
    if (!gate.ok) {
      return { ok: false, reason: `env_url_rejected:${gate.reason}` };
    }
    return {
      ok: true,
      databaseUrl: explicit.trim(),
      hostClass: gate.hostClass,
      provisioner: "env",
      cleanup: async () => {},
    };
  }

  if (!isWp5RealPostgresEnabled() && process.env.OPERATION_B1B_WP5_AUTO_PROVISION !== "1") {
    // Auto-provision when explicitly asked via ENABLE flag OR AUTO_PROVISION.
    // Also allow AUTO when ENABLE is set.
  }

  const wantProvision =
    isWp5RealPostgresEnabled() ||
    process.env.OPERATION_B1B_WP5_AUTO_PROVISION === "1";

  if (!wantProvision) {
    return { ok: false, reason: "real_postgres_not_enabled" };
  }

  const docker = await tryStartDockerPostgres();
  if (docker.ok) return docker;

  const embedded = await tryStartEmbeddedPostgres();
  if (embedded.ok) return embedded;

  return {
    ok: false,
    reason: "real_postgres_runtime_unavailable",
    dockerReason: docker.reason,
    embeddedReason: embedded.reason,
    embeddedDetail: embedded.detail,
  };
}
