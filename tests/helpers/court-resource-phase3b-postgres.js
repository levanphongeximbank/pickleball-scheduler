/**
 * Local disposable PostgreSQL helper for Court Resource Phase 3B.
 * Never connects to Staging qyewbxjsiiyufanzcjcq or Production expuvcohlcjzvrrauvud.
 */
import pg from "pg";

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

export const PHASE3B_DB_NAME_PREFIX = "cr_p3b_";

export function assertSafePhase3bDatabaseUrl(databaseUrl) {
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
  if (!dbName || !dbName.startsWith(PHASE3B_DB_NAME_PREFIX)) {
    return {
      ok: false,
      reason: `database_name_not_phase3b_scoped:${dbName || "empty"}`,
    };
  }
  return { ok: true, url };
}

export function isPhase3bRealPostgresEnabled() {
  const flag = String(process.env.COURT_RESOURCE_PHASE3B_ENABLE_REAL_POSTGRES || "")
    .trim()
    .toLowerCase();
  return flag === "1" || flag === "true" || Boolean(process.env.COURT_RESOURCE_PHASE3B_DATABASE_URL);
}

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
      const match = sql.slice(i).match(/^\$[A-Za-z0-9_]*\$/);
      if (match) {
        dollarTag = match[0];
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

export async function execSql(client, sql) {
  for (const statement of splitSqlStatements(sql)) {
    await client.query(statement);
  }
}

export async function withSafeClient(databaseUrl, fn) {
  const gate = assertSafePhase3bDatabaseUrl(databaseUrl);
  if (!gate.ok) {
    throw new Error(`PHASE3B_DB_SAFETY_GATE:${gate.reason}`);
  }
  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    return await fn(client, gate);
  } finally {
    await client.end().catch(() => {});
  }
}

export function quoteIdent(name) {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
    throw new Error(`PHASE3B_UNSAFE_IDENT:${name}`);
  }
  return `"${name}"`;
}

export async function installPgcryptoInSchema(client, schemaName) {
  await client.query("DROP EXTENSION IF EXISTS pgcrypto CASCADE");
  if (!schemaName) {
    return;
  }
  const ident = quoteIdent(schemaName);
  await client.query(`CREATE SCHEMA IF NOT EXISTS ${ident}`);
  await client.query(`CREATE EXTENSION pgcrypto WITH SCHEMA ${ident}`);
}

export async function dropPgcryptoDigestByteaText(client, schemaName) {
  const ident = quoteIdent(schemaName);
  await client.query(
    `ALTER EXTENSION pgcrypto DROP FUNCTION ${ident}.digest(bytea, text)`
  );
  await client.query(`DROP FUNCTION ${ident}.digest(bytea, text)`);
}

/** Two or more local connections for concurrency acceptance (F / L3). */
export async function withSafeClients(databaseUrl, count, fn) {
  const gate = assertSafePhase3bDatabaseUrl(databaseUrl);
  if (!gate.ok) {
    throw new Error(`PHASE3B_DB_SAFETY_GATE:${gate.reason}`);
  }
  const n = Math.max(2, Number(count) || 2);
  const clients = [];
  try {
    for (let i = 0; i < n; i += 1) {
      const client = new pg.Client({ connectionString: databaseUrl });
      await client.connect();
      clients.push(client);
    }
    return await fn(clients, gate);
  } finally {
    await Promise.all(clients.map((client) => client.end().catch(() => {})));
  }
}
