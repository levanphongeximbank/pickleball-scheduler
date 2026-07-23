#!/usr/bin/env node
/**
 * Phase 1H — Staging RLS / tenant-isolation + adapter certification (controlled).
 * Staging only. Never prints secrets. Never writes Production.
 */
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { fileURLToPath } from "node:url";
import { createSupabaseFinanceRepositories } from "../src/features/finance/persistence/supabase/createSupabaseFinanceRepositories.js";

const STAGING_REF = "qyewbxjsiiyufanzcjcq";
const PRODUCTION_REF = "expuvcohlcjzvrrauvud";
const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const evidencePath = path.join(
  rootDir,
  "src/features/finance/persistence/staging/RLS_ADAPTER_QA_REPORT.json"
);

function parseEnvFile(content) {
  const values = {};
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const i = line.indexOf("=");
    if (i < 0) continue;
    let key = line.slice(0, i).trim();
    let value = line.slice(i + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    values[key] = value;
  }
  return values;
}

function loadCrmStagingEnv() {
  const candidates = [
    path.join(rootDir, "..", "crm", ".env.staging-qa.local"),
    path.join(rootDir, "..", "player-management", ".env.staging-qa.local"),
    path.join(rootDir, "..", "notification", ".env.staging-qa.local"),
    path.join(rootDir, ".env.staging-qa.local"),
  ];
  for (const filePath of candidates) {
    if (!fs.existsSync(filePath)) continue;
    const values = parseEnvFile(fs.readFileSync(filePath, "utf8"));
    const url = String(values.STAGING_SUPABASE_URL || values.VITE_SUPABASE_URL || "").trim();
    if (!url) continue;
    if (url.includes(PRODUCTION_REF)) {
      throw new Error("REFUSED Production URL");
    }
    if (!url.includes(STAGING_REF)) {
      throw new Error(`REFUSED non-staging URL in ${filePath}`);
    }
    return {
      source: path.relative(rootDir, filePath).replace(/\\/g, "/"),
      url,
      anonKey: String(values.STAGING_SUPABASE_ANON_KEY || values.VITE_SUPABASE_ANON_KEY || "").trim(),
      serviceKey: String(values.STAGING_SUPABASE_SERVICE_ROLE_KEY || "").trim(),
      ownerAEmail: String(values.STAGING_OWNER_A_EMAIL || "").trim(),
      ownerAPassword: String(values.STAGING_OWNER_A_PASSWORD || "").trim(),
      ownerBEmail: String(values.STAGING_OWNER_B_EMAIL || "").trim(),
      ownerBPassword: String(values.STAGING_OWNER_B_PASSWORD || "").trim(),
      tenantAId: String(values.STAGING_TENANT_A_ID || "").trim(),
      tenantBId: String(values.STAGING_TENANT_B_ID || "").trim(),
    };
  }
  throw new Error("No staging QA env with anon key / owner credentials found");
}

function writeReport(report) {
  fs.mkdirSync(path.dirname(evidencePath), { recursive: true });
  fs.writeFileSync(evidencePath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
}

async function signIn(url, anonKey, email, password) {
  const client = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`signIn ${email}: ${error.message}`);
  return { client, userId: data.user?.id || null };
}

async function main() {
  const env = loadCrmStagingEnv();
  const report = {
    phase: "1H",
    startedAt: new Date().toISOString(),
    stagingRef: STAGING_REF,
    stagingUrl: env.url,
    productionTouched: false,
    envSource: env.source,
    tenantAConfigured: Boolean(env.tenantAId),
    tenantBConfigured: Boolean(env.tenantBId),
    checks: {},
    status: "PENDING",
  };

  console.log("=== Finance Phase 1H RLS / Adapter QA ===");
  console.log(`STAGING: ${STAGING_REF}`);
  console.log(`Env source: ${env.source}`);
  if (!env.anonKey) throw new Error("anon key missing");
  if (!env.ownerAEmail || !env.ownerAPassword || !env.ownerBEmail || !env.ownerBPassword) {
    throw new Error("Owner A/B credentials incomplete");
  }

  const anonClient = createClient(env.url, env.anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Anon denied
  {
    const { data, error } = await anonClient
      .from("finance_fee_definitions")
      .select("id")
      .limit(1);
    report.checks.anonSelectDenied = {
      pass: Boolean(error) || !data || data.length === 0,
      errorCode: error?.code || null,
      errorMessage: error?.message || null,
      rowCount: Array.isArray(data) ? data.length : null,
    };
    console.log(`anon select denied: ${report.checks.anonSelectDenied.pass}`);
  }

  const a = await signIn(env.url, env.anonKey, env.ownerAEmail, env.ownerAPassword);
  const b = await signIn(env.url, env.anonKey, env.ownerBEmail, env.ownerBPassword);

  const { data: venueA, error: venueAErr } = await a.client.rpc("user_venue_id");
  const { data: venueB, error: venueBErr } = await b.client.rpc("user_venue_id");
  report.tenantContext = {
    ownerAUserIdPresent: Boolean(a.userId),
    ownerBUserIdPresent: Boolean(b.userId),
    venueA: venueA || null,
    venueB: venueB || null,
    venueAError: venueAErr?.message || null,
    venueBError: venueBErr?.message || null,
    configuredTenantA: env.tenantAId || null,
    configuredTenantB: env.tenantBId || null,
  };
  console.log(`venueA: ${venueA || "(null)"} venueB: ${venueB || "(null)"}`);

  if (!venueA || !venueB || venueA === venueB) {
    report.status = "INCOMPLETE_TENANT_CONTEXTS";
    report.error = "Could not obtain two distinct Staging tenant venues for authenticated QA";
    writeReport(report);
    console.error(report.error);
    process.exitCode = 3;
    return;
  }

  const feeAId = `FINANCE_QA_RLS_FEE_A_${Date.now()}`;
  const feeBId = `FINANCE_QA_RLS_FEE_B_${Date.now()}`;

  // Permission probe: can Owner A insert for own tenant?
  {
    const { data, error } = await a.client
      .from("finance_fee_definitions")
      .insert({
        id: feeAId,
        tenant_id: venueA,
        status: "DRAFT",
        fee_type: "OPERATIONAL",
        name: "FINANCE_QA_RLS_A",
        amount_minor: 1000,
        currency: "VND",
        version: 1,
      })
      .select("id, tenant_id, version")
      .maybeSingle();
    report.checks.tenantAInsertOwn = {
      pass: !error && data?.id === feeAId && data?.tenant_id === venueA,
      errorCode: error?.code || null,
      errorMessage: error?.message || null,
      row: data || null,
    };
    console.log(`tenantA insert own: ${report.checks.tenantAInsertOwn.pass}`);
  }

  {
    const { data, error } = await b.client
      .from("finance_fee_definitions")
      .insert({
        id: feeBId,
        tenant_id: venueB,
        status: "DRAFT",
        fee_type: "OPERATIONAL",
        name: "FINANCE_QA_RLS_B",
        amount_minor: 2000,
        currency: "VND",
        version: 1,
      })
      .select("id, tenant_id")
      .maybeSingle();
    report.checks.tenantBInsertOwn = {
      pass: !error && data?.id === feeBId && data?.tenant_id === venueB,
      errorCode: error?.code || null,
      errorMessage: error?.message || null,
      row: data || null,
    };
    console.log(`tenantB insert own: ${report.checks.tenantBInsertOwn.pass}`);
  }

  // Cross-tenant select
  {
    const { data, error } = await a.client
      .from("finance_fee_definitions")
      .select("id, tenant_id")
      .eq("id", feeBId);
    report.checks.tenantACannotSelectB = {
      pass: (!error && Array.isArray(data) && data.length === 0) || Boolean(error),
      errorCode: error?.code || null,
      errorMessage: error?.message || null,
      rowCount: Array.isArray(data) ? data.length : null,
    };
    console.log(`tenantA cannot select B: ${report.checks.tenantACannotSelectB.pass}`);
  }

  // Cross-tenant insert WITH CHECK
  {
    const { data, error } = await a.client
      .from("finance_fee_definitions")
      .insert({
        id: `FINANCE_QA_RLS_CROSS_${Date.now()}`,
        tenant_id: venueB,
        status: "DRAFT",
        fee_type: "OPERATIONAL",
        name: "FINANCE_QA_CROSS",
        amount_minor: 1,
        currency: "VND",
        version: 1,
      })
      .select("id")
      .maybeSingle();
    report.checks.tenantACannotInsertForB = {
      pass: Boolean(error) || !data,
      errorCode: error?.code || null,
      errorMessage: error?.message || null,
    };
    console.log(`tenantA cannot insert for B: ${report.checks.tenantACannotInsertForB.pass}`);
  }

  // Cross-tenant update
  {
    const { data, error } = await a.client
      .from("finance_fee_definitions")
      .update({ name: "FINANCE_QA_HACK" })
      .eq("id", feeBId)
      .select("id");
    report.checks.tenantACannotUpdateB = {
      pass: (!error && Array.isArray(data) && data.length === 0) || Boolean(error),
      errorCode: error?.code || null,
      errorMessage: error?.message || null,
      rowCount: Array.isArray(data) ? data.length : null,
    };
    console.log(`tenantA cannot update B: ${report.checks.tenantACannotUpdateB.pass}`);
  }

  // Cross-tenant delete (no delete grant expected)
  {
    const { data, error } = await a.client
      .from("finance_fee_definitions")
      .delete()
      .eq("id", feeBId)
      .select("id");
    report.checks.tenantACannotDeleteB = {
      pass: Boolean(error) || !data || data.length === 0,
      errorCode: error?.code || null,
      errorMessage: error?.message || null,
      rowCount: Array.isArray(data) ? data.length : null,
    };
    console.log(`tenantA cannot delete B: ${report.checks.tenantACannotDeleteB.pass}`);
  }

  // Own select
  {
    const { data, error } = await a.client
      .from("finance_fee_definitions")
      .select("id, tenant_id")
      .eq("id", feeAId)
      .maybeSingle();
    report.checks.tenantACanSelectOwn = {
      pass: !error && data?.id === feeAId,
      errorCode: error?.code || null,
      errorMessage: error?.message || null,
    };
    console.log(`tenantA can select own: ${report.checks.tenantACanSelectOwn.pass}`);
  }

  // Event immutability via authenticated
  {
    const evtId = `FINANCE_QA_RLS_EVT_${Date.now()}`;
    const { error: insErr } = await a.client.from("finance_events").insert({
      id: evtId,
      tenant_id: venueA,
      event_type: "FINANCE_OBLIGATION_CREATED",
      occurred_at: new Date().toISOString(),
      correlation_id: "FINANCE_QA_RLS_CORR",
      privacy_classification: "INTERNAL",
      payload: { qa: true },
      payload_schema_version: 1,
    });
    const { data: updData, error: updErr } = await a.client
      .from("finance_events")
      .update({ payload: { hacked: true } })
      .eq("id", evtId)
      .select("id");
    const { data: delData, error: delErr } = await a.client
      .from("finance_events")
      .delete()
      .eq("id", evtId)
      .select("id");
    report.checks.eventAppendOnlyAuthenticated = {
      insertPass: !insErr,
      insertError: insErr?.message || null,
      updateDenied: Boolean(updErr) || !updData || updData.length === 0,
      updateError: updErr?.message || null,
      deleteDenied: Boolean(delErr) || !delData || delData.length === 0,
      deleteError: delErr?.message || null,
      retainedEventId: evtId,
      pass: !insErr && (Boolean(updErr) || !updData || updData.length === 0),
    };
    console.log(
      `event append-only auth: insert=${!insErr} updateDenied=${report.checks.eventAppendOnlyAuthenticated.updateDenied}`
    );
  }

  // Adapter certification with injected Staging client (service role if available, else owner A)
  report.adapterCertification = { mode: null, results: {} };
  try {
    let adapterClient = a.client;
    let adapterTenant = venueA;
    let mode = "authenticated_owner_a_injected";
    if (env.serviceKey) {
      adapterClient = createClient(env.url, env.serviceKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      mode = "service_role_injected_explicit";
      report.adapterCertification.serviceRoleNote =
        "service_role bypasses RLS; used only for adapter API shape against real schema. Not application authorization.";
    }
    report.adapterCertification.mode = mode;
    const repos = createSupabaseFinanceRepositories(adapterClient);
    const feeId = `FINANCE_QA_ADAPTER_FEE_${Date.now()}`;
    const created = await repos.feeDefinitions.create(adapterTenant, {
      id: feeId,
      feeType: "OPERATIONAL",
      status: "DRAFT",
      amountMinor: 2500,
      currency: "VND",
      name: "FINANCE_QA_ADAPTER",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    report.adapterCertification.results.create = {
      pass: created?.id === feeId,
      version: created?.version ?? null,
    };
    const got = await repos.feeDefinitions.getById(adapterTenant, feeId);
    report.adapterCertification.results.getById = {
      pass: got?.id === feeId && got?.tenantId === adapterTenant,
    };
    const listed = await repos.feeDefinitions.list({
      tenantId: adapterTenant,
      limit: 10,
    });
    report.adapterCertification.results.boundedList = {
      pass: Array.isArray(listed) && listed.some((r) => r.id === feeId),
      count: Array.isArray(listed) ? listed.length : null,
    };
    const updated = await repos.feeDefinitions.update(adapterTenant, feeId, 1, {
      name: "FINANCE_QA_ADAPTER_V2",
    });
    report.adapterCertification.results.optimisticUpdate = {
      pass: updated?.version === 2 && updated?.name === "FINANCE_QA_ADAPTER_V2",
      version: updated?.version ?? null,
    };
    let staleRejected = false;
    try {
      await repos.feeDefinitions.update(adapterTenant, feeId, 1, { name: "STALE" });
    } catch (err) {
      staleRejected = true;
      report.adapterCertification.results.staleUpdateErrorName = err?.name || null;
      report.adapterCertification.results.staleUpdateCode = err?.code || null;
    }
    report.adapterCertification.results.staleUpdateRejected = { pass: staleRejected };

    const idemKey = `FINANCE_QA_ADAPTER_IDEM_${Date.now()}`;
    const nowIso = new Date().toISOString();
    const begun = await repos.idempotency.begin(adapterTenant, {
      operationType: "CREATE_FEE",
      idempotencyKey: idemKey,
      requestFingerprint: "fp_adapter_qa_1",
      createdAt: nowIso,
      updatedAt: nowIso,
    });
    report.adapterCertification.results.idempotencyBegin = {
      pass: Boolean(begun?.id || begun?.idempotencyKey || begun),
    };
    const gotIdem = await repos.idempotency.find(
      adapterTenant,
      "CREATE_FEE",
      idemKey
    );
    report.adapterCertification.results.idempotencyGet = { pass: Boolean(gotIdem) };

    report.adapterCertification.pass = Object.values(report.adapterCertification.results).every(
      (r) => r && r.pass !== false
    );
    console.log(`adapter certification pass: ${report.adapterCertification.pass} mode=${mode}`);
  } catch (err) {
    report.adapterCertification.error = String(err?.message || err);
    report.adapterCertification.pass = false;
    console.error(`adapter certification error: ${report.adapterCertification.error}`);
  }

  // Cleanup RLS synthetic fees via service SQL is done by apply script --cleanup;
  // here delete own rows if permitted (no delete grant — leave for service cleanup).
  report.cleanupNote =
    "Authenticated roles lack DELETE grants by design. Run apply-finance-phase1h-staging-sql.mjs --cleanup for FINANCE_QA_ fee/idempotency rows. Append-only events retained.";

  const required = [
    "anonSelectDenied",
    "tenantAInsertOwn",
    "tenantBInsertOwn",
    "tenantACannotSelectB",
    "tenantACannotInsertForB",
    "tenantACannotUpdateB",
    "tenantACannotDeleteB",
    "tenantACanSelectOwn",
  ];
  const rlsPass = required.every((k) => report.checks[k]?.pass === true);
  report.rlsTenantIsolationPass = rlsPass;
  report.status =
    rlsPass && report.adapterCertification?.pass
      ? "PASS"
      : rlsPass
        ? "PASS_RLS_ADAPTER_PARTIAL"
        : "FAIL";
  report.finishedAt = new Date().toISOString();
  writeReport(report);
  console.log(`Status: ${report.status}`);
  console.log(`Report: ${path.relative(rootDir, evidencePath)}`);
  if (report.status === "FAIL") process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
