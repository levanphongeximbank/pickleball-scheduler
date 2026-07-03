/**
 * Phase 16 — KN-6 RLS verify for qr_tokens and checkins (staging only).
 *
 * Probes authenticated JWT + anon client. Does NOT use service_role for RLS conclusions.
 *
 * Usage:
 *   STAGING_OWNER_A_PASSWORD=... STAGING_OWNER_B_PASSWORD=... \
 *     node scripts/verify-phase16-kn6-rls-staging.mjs
 *
 * Prerequisites on staging:
 *   1. docs/supabase-phase16-kn6-qr-checkins-rls.sql applied
 *   2. docs/supabase-staging-phase16-kn6-seed.sql applied (recommended)
 */
import { createClient } from "@supabase/supabase-js";
import { getSupabaseEnv, loadProjectEnv } from "./load-env.mjs";

const STAGING_REF = "qyewbxjsiiyufanzcjcq";
const TENANT_A = "venue-staging-a";
const TENANT_B = "venue-staging-b";

const SEED_HASH_A =
  "phase16kn6seedhash000000000000000000000000000000000000000000000000a1";
const SEED_HASH_B =
  "phase16kn6seedhash000000000000000000000000000000000000000000000000b1";

const results = [];

function record(id, status, detail) {
  results.push({ id, status, detail });
}

function ok(message) {
  console.log(`✅ ${message}`);
}

function warn(message) {
  console.log(`⚠️  ${message}`);
}

function fail(message) {
  console.error(`\n❌ ${message}`);
  process.exit(1);
}

function assertStagingUrl(url) {
  if (!String(url || "").includes(STAGING_REF)) {
    fail(`URL không phải staging ${STAGING_REF} — dừng.`);
  }
}

function isRlsBlocked(error) {
  const message = String(error?.message || "").toLowerCase();
  return (
    error?.code === "42501" ||
    message.includes("row-level security") ||
    message.includes("permission denied")
  );
}

async function signIn(url, anonKey, email, password) {
  if (!email || !password) {
    return { client: null, profile: null, error: "missing_credentials" };
  }
  const client = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) {
    return { client: null, profile: null, error: error.message };
  }
  const { data: profile, error: profileError } = await client
    .from("profiles")
    .select("id, email, role, venue_id, status")
    .eq("id", data.user.id)
    .maybeSingle();
  if (profileError) {
    return { client, profile: null, error: profileError.message };
  }
  return { client, profile, error: null };
}

async function probeAnonDenied(url, anonKey) {
  const anon = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  for (const table of ["qr_tokens", "checkins"]) {
    const { data, error } = await anon.from(table).select("id").limit(1);
    if (error && isRlsBlocked(error)) {
      record(`anon-${table}`, "PASS", "RLS blocked");
      ok(`anon ${table}: blocked`);
    } else if (!error && (data || []).length === 0) {
      record(`anon-${table}`, "PASS", "0 rows (RLS empty deny)");
      ok(`anon ${table}: 0 rows`);
    } else if (!error) {
      record(`anon-${table}`, "FAIL", `anon read ${data.length} rows`);
      warn(`anon ${table}: FAIL — đọc được ${data.length} rows`);
    } else {
      record(`anon-${table}`, "PARTIAL", error.message);
      warn(`anon ${table}: ${error.message}`);
    }
  }
}

async function probeSameTenantRead({ label, client, ownTenantId, otherTenantId }) {
  for (const table of ["qr_tokens", "checkins"]) {
    const { data, error } = await client.from(table).select("*").limit(50);
    if (error) {
      record(`${label}-${table}-read`, "FAIL", error.message);
      warn(`${label} ${table} read: ERR ${error.message}`);
      continue;
    }

    const rows = data || [];
    const foreign = rows.filter((row) => row.tenant_id && row.tenant_id !== ownTenantId);
    if (foreign.length > 0) {
      record(`${label}-${table}-read`, "FAIL", `leak ${otherTenantId}`);
      warn(`${label} ${table} read: LEAK cross-tenant`);
      continue;
    }

    const ownRows = rows.filter((row) => row.tenant_id === ownTenantId);
    if (ownRows.length > 0) {
      record(`${label}-${table}-read`, "PASS", `${ownRows.length} own-tenant rows`);
      ok(`${label} ${table} read: own-tenant OK (${ownRows.length})`);
    } else {
      record(`${label}-${table}-read`, "PARTIAL", "0 rows — apply phase16 seed");
      warn(`${label} ${table} read: 0 rows — seed chưa apply?`);
    }
  }
}

async function probeCrossTenantFilter({ label, client, otherTenantId, table }) {
  const { data, error } = await client
    .from(table)
    .select("*")
    .eq("tenant_id", otherTenantId)
    .limit(10);

  if (error) {
    if (isRlsBlocked(error)) {
      record(`${label}-${table}-filter`, "PASS", "blocked");
      ok(`${label} ${table} filter other tenant: blocked`);
      return;
    }
    record(`${label}-${table}-filter`, "PARTIAL", error.message);
    warn(`${label} ${table} filter: ${error.message}`);
    return;
  }

  if ((data || []).length > 0) {
    record(`${label}-${table}-filter`, "FAIL", `read ${data.length} foreign rows`);
    warn(`${label} ${table} filter ${otherTenantId}: LEAK (${data.length})`);
  } else {
    record(`${label}-${table}-filter`, "PASS", "0 rows");
    ok(`${label} ${table} filter ${otherTenantId}: 0 rows`);
  }
}

async function probeCrossTenantInsert({ label, client, otherTenantId, table }) {
  const baseRow =
    table === "qr_tokens"
      ? {
          tenant_id: otherTenantId,
          entity_type: "player",
          entity_id: `probe-${Date.now()}`,
          token_hash: `probe-${label}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
          expires_at: new Date(Date.now() + 86400000).toISOString(),
        }
      : {
          tenant_id: otherTenantId,
          tournament_id: `probe-t-${Date.now()}`,
          entity_type: "player",
          entity_id: `probe-player-${Date.now()}`,
          source: "probe",
          status: "pending",
        };

  const { error } = await client.from(table).insert(baseRow);
  if (error && isRlsBlocked(error)) {
    record(`${label}-${table}-insert`, "PASS", "RLS blocked");
    ok(`${label} ${table} insert other tenant: blocked`);
  } else if (error) {
    record(`${label}-${table}-insert`, "PARTIAL", error.message);
    warn(`${label} ${table} insert: ${error.message}`);
  } else {
    record(`${label}-${table}-insert`, "FAIL", "insert succeeded");
    warn(`${label} ${table} insert other tenant: FAIL — không bị chặn`);
  }
}

async function probeTokenHashLookup({ label, client, ownHash, otherHash, ownTenantId }) {
  const { data: own, error: ownErr } = await client
    .from("qr_tokens")
    .select("*")
    .eq("token_hash", ownHash)
    .maybeSingle();

  if (ownErr) {
    record(`${label}-token-own`, "FAIL", ownErr.message);
    warn(`${label} token own hash: ERR ${ownErr.message}`);
  } else if (own && own.tenant_id === ownTenantId) {
    record(`${label}-token-own`, "PASS", "same-tenant token visible");
    ok(`${label} token own hash: visible`);
  } else if (!own) {
    record(`${label}-token-own`, "PARTIAL", "not found — apply seed");
    warn(`${label} token own hash: not found (seed?)`);
  } else {
    record(`${label}-token-own`, "FAIL", `wrong tenant ${own.tenant_id}`);
    warn(`${label} token own hash: wrong tenant`);
  }

  const { data: foreign, error: foreignErr } = await client
    .from("qr_tokens")
    .select("*")
    .eq("token_hash", otherHash)
    .maybeSingle();

  if (foreignErr && isRlsBlocked(foreignErr)) {
    record(`${label}-token-other`, "PASS", "blocked");
    ok(`${label} token other hash: blocked`);
  } else if (!foreign) {
    record(`${label}-token-other`, "PASS", "not visible (isolated)");
    ok(`${label} token other hash: not visible`);
  } else {
    record(`${label}-token-other`, "FAIL", `leak tenant ${foreign.tenant_id}`);
    warn(`${label} token other hash: LEAK`);
  }
}

async function main() {
  console.log("=== Phase 16 — KN-6 qr_tokens / checkins RLS Verify ===\n");

  const { url, anonKey } = getSupabaseEnv();
  if (!url || !anonKey) {
    fail("Thiếu VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY trong .env.local");
  }
  assertStagingUrl(url);
  loadProjectEnv();

  const tenantA = String(process.env.STAGING_TENANT_A_ID || TENANT_A).trim();
  const tenantB = String(process.env.STAGING_TENANT_B_ID || TENANT_B).trim();

  const ownerA = await signIn(
    url,
    anonKey,
    String(process.env.STAGING_OWNER_A_EMAIL || "owner@staging.local").trim(),
    String(process.env.STAGING_OWNER_A_PASSWORD || "").trim()
  );
  if (ownerA.error) {
    fail(`Owner A login failed: ${ownerA.error}`);
  }
  ok(`Owner A login: ${ownerA.profile.email}`);

  const ownerB = await signIn(
    url,
    anonKey,
    String(process.env.STAGING_OWNER_B_EMAIL || "owner-b@staging.local").trim(),
    String(process.env.STAGING_OWNER_B_PASSWORD || "").trim()
  );
  if (ownerB.error) {
    warn(`Owner B login skipped: ${ownerB.error}`);
    record("_setup", "BLOCKED", ownerB.error);
  } else {
    ok(`Owner B login: ${ownerB.profile.email}`);
  }

  console.log("\n--- Anon access (must be denied) ---\n");
  await probeAnonDenied(url, anonKey);

  console.log("\n--- Owner A probes ---\n");
  await probeSameTenantRead({
    label: "OwnerA",
    client: ownerA.client,
    ownTenantId: tenantA,
    otherTenantId: tenantB,
  });
  await probeCrossTenantFilter({
    label: "OwnerA",
    client: ownerA.client,
    otherTenantId: tenantB,
    table: "qr_tokens",
  });
  await probeCrossTenantFilter({
    label: "OwnerA",
    client: ownerA.client,
    otherTenantId: tenantB,
    table: "checkins",
  });
  await probeCrossTenantInsert({
    label: "OwnerA",
    client: ownerA.client,
    otherTenantId: tenantB,
    table: "qr_tokens",
  });
  await probeCrossTenantInsert({
    label: "OwnerA",
    client: ownerA.client,
    otherTenantId: tenantB,
    table: "checkins",
  });
  await probeTokenHashLookup({
    label: "OwnerA",
    client: ownerA.client,
    ownHash: SEED_HASH_A,
    otherHash: SEED_HASH_B,
    ownTenantId: tenantA,
  });

  if (ownerB.client) {
    console.log("\n--- Owner B probes ---\n");
    await probeSameTenantRead({
      label: "OwnerB",
      client: ownerB.client,
      ownTenantId: tenantB,
      otherTenantId: tenantA,
    });
    await probeCrossTenantFilter({
      label: "OwnerB",
      client: ownerB.client,
      otherTenantId: tenantA,
      table: "qr_tokens",
    });
    await probeCrossTenantFilter({
      label: "OwnerB",
      client: ownerB.client,
      otherTenantId: tenantA,
      table: "checkins",
    });
    await probeCrossTenantInsert({
      label: "OwnerB",
      client: ownerB.client,
      otherTenantId: tenantA,
      table: "qr_tokens",
    });
    await probeCrossTenantInsert({
      label: "OwnerB",
      client: ownerB.client,
      otherTenantId: tenantA,
      table: "checkins",
    });
    await probeTokenHashLookup({
      label: "OwnerB",
      client: ownerB.client,
      ownHash: SEED_HASH_B,
      otherHash: SEED_HASH_A,
      ownTenantId: tenantB,
    });
  }

  console.log("\n--- Summary ---\n");
  const counts = { PASS: 0, PARTIAL: 0, FAIL: 0, BLOCKED: 0 };
  for (const row of results) {
    counts[row.status] = (counts[row.status] || 0) + 1;
  }
  console.log(
    `PASS=${counts.PASS || 0} PARTIAL=${counts.PARTIAL || 0} FAIL=${counts.FAIL || 0}`
  );

  const fails = results.filter((row) => row.status === "FAIL");
  if (fails.length > 0) {
    fail(`KN-6 RLS verify: FAIL (${fails.length} findings)`);
  }

  if ((counts.PARTIAL || 0) > 0) {
    warn("KN-6 RLS verify: PARTIAL — apply SQL patch + seed on staging");
    process.exit(0);
  }

  ok("KN-6 RLS verify: PASS");
}

main().catch((error) => {
  fail(error?.message || String(error));
});
