#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const PRODUCTION_REF = "expuvcohlcjzvrrauvud";
const TABLES = [
  "profiles",
  "venues",
  "tenant_members",
  "club_data_v3",
  "ai_suggestions",
  "court_engine_stores",
  "court_engine_active_sessions",
  "team_tournament_referee_correction_requests",
  "ai_workflow_checklists",
];
const ANON_DENY_TABLES = [
  "profiles",
  "tenant_members",
  "club_data_v3",
  "ai_suggestions",
  "court_engine_stores",
  "court_engine_active_sessions",
  "team_tournament_referee_correction_requests",
  "ai_workflow_checklists",
];
const EXPECTED_BUCKETS = ["user-avatars", "tournament-broadcast-vods"];
const outputPath = path.resolve(
  process.argv[2] || "docs/v6/PHASE6_PRODUCTION_READ_ONLY_LIVE_EVIDENCE.json",
);

const envPath = path.resolve(process.env.PHASE6_PRODUCTION_ENV_FILE || ".env.phase6-production.local");
if (fs.existsSync(envPath)) {
  for (const rawLine of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const at = line.indexOf("=");
    if (at < 1) continue;
    const name = line.slice(0, at).trim();
    let value = line.slice(at + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!(name in process.env)) process.env[name] = value;
  }
}

const url = [process.env.SUPABASE_URL, process.env.VITE_SUPABASE_URL]
  .map((value) => String(value || "").replace(/\/$/, ""))
  .find((value) => value.includes(PRODUCTION_REF)) || "";
const serviceKey = String(
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE || "",
);
const anonKey = String(process.env.VITE_SUPABASE_ANON_KEY || "");

if (!url.includes(PRODUCTION_REF)) throw new Error("Production URL identity mismatch");
if (!serviceKey || !anonKey) throw new Error("Missing injected Production Supabase credentials");

async function request(endpoint, key, init = {}) {
  const response = await fetch(`${url}${endpoint}`, {
    ...init,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      ...(init.headers || {}),
    },
  });
  const text = await response.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = null; }
  return { status: response.status, ok: response.ok, body };
}

async function tableProbe(table, key) {
  const result = await request(`/rest/v1/${encodeURIComponent(table)}?select=*&limit=1`, key);
  return {
    table,
    status: result.status,
    rowVisible: Array.isArray(result.body) ? result.body.length : null,
  };
}

async function bucketInventory(bucket) {
  let pending = [""];
  let objectCount = 0;
  let bytes = 0;
  let requests = 0;
  while (pending.length) {
    const prefix = pending.pop();
    let offset = 0;
    for (;;) {
      const result = await request(`/storage/v1/object/list/${encodeURIComponent(bucket)}`, serviceKey, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prefix, limit: 1000, offset, sortBy: { column: "name", order: "asc" } }),
      });
      requests += 1;
      if (!result.ok || !Array.isArray(result.body)) {
        return { bucket, status: result.status, pass: false, objectCount, bytes, requests };
      }
      for (const item of result.body) {
        if (item.metadata == null) pending.push(prefix ? `${prefix}/${item.name}` : item.name);
        else {
          objectCount += 1;
          bytes += Number(item.metadata?.size || 0);
        }
      }
      if (result.body.length < 1000) break;
      offset += result.body.length;
    }
  }
  return { bucket, status: 200, pass: true, objectCount, bytes, requests };
}

const started = Date.now();
const [authSettings, bucketsResult, ...serviceTables] = await Promise.all([
  request("/auth/v1/settings", anonKey),
  request("/storage/v1/bucket", serviceKey),
  ...TABLES.map((table) => tableProbe(table, serviceKey)),
]);
const anonTables = await Promise.all(ANON_DENY_TABLES.map((table) => tableProbe(table, anonKey)));
const bucketNames = Array.isArray(bucketsResult.body) ? bucketsResult.body.map((b) => b.name || b.id).sort() : [];
const storage = await Promise.all(EXPECTED_BUCKETS.map(bucketInventory));

const failures = [];
if (!authSettings.ok) failures.push(`auth settings HTTP ${authSettings.status}`);
if (!bucketsResult.ok) failures.push(`bucket list HTTP ${bucketsResult.status}`);
for (const p of serviceTables) if (p.status !== 200) failures.push(`service read ${p.table} HTTP ${p.status}`);
for (const p of anonTables) {
  const denied = [401, 403, 404].includes(p.status) || (p.status === 200 && p.rowVisible === 0);
  if (!denied) failures.push(`anon visibility ${p.table} status=${p.status} rows=${p.rowVisible}`);
}
for (const name of EXPECTED_BUCKETS) if (!bucketNames.includes(name)) failures.push(`missing bucket ${name}`);
for (const item of storage) if (!item.pass) failures.push(`storage inventory ${item.bucket} HTTP ${item.status}`);

const evidence = {
  marker: "PHASE6_PRODUCTION_READ_ONLY_LIVE_EVIDENCE_V1",
  capturedAt: new Date().toISOString(),
  targetProjectRef: PRODUCTION_REF,
  access: { productionAccess: 1, databaseMutations: 0, storageMutations: 0, deployments: 0 },
  authSettingsReachable: authSettings.ok,
  serviceRoleTableReads: serviceTables,
  anonymousNegativeReads: anonTables,
  storage: { bucketNames, inventories: storage },
  elapsedSeconds: Math.round((Date.now() - started) / 100) / 10,
  limitations: [
    "PostgREST probes do not replace direct pg_catalog migration/RLS/ACL inventory",
    "Storage inventory records aggregate counts/bytes only and does not prove restore",
  ],
  pass: failures.length === 0,
  failures,
};

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(evidence, null, 2)}\n`);
console.log(JSON.stringify({ pass: evidence.pass, failures, elapsedSeconds: evidence.elapsedSeconds }, null, 2));
if (!evidence.pass) process.exit(1);
