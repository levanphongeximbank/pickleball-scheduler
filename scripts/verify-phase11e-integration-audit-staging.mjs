/**
 * Phase 11E — Integration audit staging verify.
 *
 * Usage:
 *   STAGING_PREVIEW_URL=https://your-preview.vercel.app \
 *   VERCEL_AUTOMATION_BYPASS_SECRET=... \
 *   SUPABASE_SERVICE_ROLE_KEY=... \
 *   node scripts/verify-phase11e-integration-audit-staging.mjs
 */
import { createClient } from "@supabase/supabase-js";
import {
  buildPreviewFetchInit,
  buildPreviewUrl,
  getBypassSecret,
  isPreviewFetchNetworkError,
  logPreviewFetchError,
  normalizePreviewBaseUrl,
  previewHttpRequest,
} from "./phase11c-preview-http.mjs";
import {
  cleanupPhase11dSeed,
  seedPhase11dFixtures,
  TENANT_A,
} from "./seed-phase11d-api-keys-staging.mjs";
import { EDGE_API_ERROR_CODES } from "../src/features/api/constants/edgeApiErrors.js";
import { INTEGRATION_AUDIT_EVENTS } from "../src/features/api/constants/integrationAudit.js";
import { API_SCOPES } from "../src/features/api/constants/apiScopes.js";
import { getSupabaseEnv, loadProjectEnv } from "./load-env.mjs";

const DEFAULT_PREVIEW_URL =
  "https://pickleball-scheduler-git-v5-platfor-47ef4a-pickleball-scheduler.vercel.app";

const PROBE_TAG = "phase11e";
const AUDIT_POLL_MS = 1500;

const results = [];
const secretFingerprints = [];
let capturedOutput = "";
let runStartIso = new Date().toISOString();

function record(test, expected, actual, verdict, httpStatus = "—", errorCode = "—") {
  results.push({ test, expected, actual, verdict, httpStatus, errorCode });
}

function logOk(msg) {
  console.log(`✅ ${msg}`);
}

function logWarn(msg) {
  console.log(`⚠️  ${msg}`);
}

function logInfo(msg) {
  console.log(`ℹ️  ${msg}`);
}

function trackSecret(plainKey) {
  if (!plainKey) return;
  const secret = String(plainKey).split(".")[1] || "";
  if (secret.length >= 8) {
    secretFingerprints.push(secret);
  }
}

function redactSecrets(text) {
  const serviceKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  const bypass = getBypassSecret();
  let out = String(text);
  if (serviceKey) {
    out = out.split(serviceKey).join("[REDACTED_SERVICE_ROLE]");
  }
  if (bypass) {
    out = out.split(bypass).join("[REDACTED_BYPASS]");
  }
  for (const secret of secretFingerprints) {
    out = out.split(secret).join("[REDACTED_KEY_SECRET]");
  }
  out = out.replace(/pk_[a-z0-9]{8}\.[a-f0-9]{32,}/gi, "pk_[REDACTED]");
  return out;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function createAdminClient() {
  loadProjectEnv();
  const { url } = getSupabaseEnv();
  const serviceKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  if (!url || !serviceKey) {
    throw new Error("Thiếu VITE_SUPABASE_URL/SUPABASE_URL hoặc SUPABASE_SERVICE_ROLE_KEY.");
  }
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function legacyColumnExists(admin, columnName) {
  const { error } = await admin
    .from("integration_audit_logs")
    .select(`id, ${columnName}`)
    .limit(0);

  if (!error) {
    return true;
  }

  const message = String(error.message || "").toLowerCase();
  if (message.includes("does not exist") || error.code === "42703") {
    return false;
  }

  return false;
}

async function probeLegacyColumnNullability(admin) {
  const actionExists = await legacyColumnExists(admin, "action");
  const metaExists = await legacyColumnExists(admin, "meta");

  if (!actionExists && !metaExists) {
    record("schema:legacy columns", "none (11E-only table)", "skipped", "PASS");
    return true;
  }

  const probeRow = {
    event_type: INTEGRATION_AUDIT_EVENTS.API_KEY_DENIED,
    metadata: { probeTag: PROBE_TAG, schemaProbe: true },
    request_id: `phase11e_schema_probe_${Date.now()}`,
  };

  const { data, error } = await admin
    .from("integration_audit_logs")
    .insert(probeRow)
    .select("id")
    .single();

  if (error) {
    if (actionExists) {
      record("schema:legacy action nullable", "nullable", error.message, "FAIL");
    }
    if (metaExists) {
      record("schema:legacy meta nullable", "nullable", error.message, "FAIL");
    }
    return false;
  }

  await admin.from("integration_audit_logs").delete().eq("id", data.id);

  if (actionExists) {
    record("schema:legacy action nullable", "nullable", "ok", "PASS");
  }
  if (metaExists) {
    record("schema:legacy meta nullable", "nullable", "ok", "PASS");
  }

  return true;
}

async function probeIntegrationAuditSchema(admin) {
  const { data, error } = await admin
    .from("integration_audit_logs")
    .select(
      "id, request_id, tenant_id, api_client_id, api_key_id, key_prefix, event_type, route, method, status_code, result_code, scope_required, scopes_granted, metadata, created_at"
    )
    .limit(1);

  if (error) {
    record("schema:integration_audit_logs", "table readable", error.message, "FAIL");
    return false;
  }

  record("schema:integration_audit_logs", "table + 11E columns", "ok", "PASS");
  void data;

  const legacyOk = await probeLegacyColumnNullability(admin);
  return legacyOk;
}

async function clearProbeAuditRows(admin) {
  const { error } = await admin
    .from("integration_audit_logs")
    .delete()
    .eq("metadata->>probeTag", PROBE_TAG);
  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

async function fetchAuditByRequestId(admin, requestId, { retries = 3, delayMs = AUDIT_POLL_MS } = {}) {
  for (let attempt = 0; attempt < retries; attempt += 1) {
    const { data, error } = await admin
      .from("integration_audit_logs")
      .select("*")
      .eq("request_id", requestId)
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error(error.message);
    }
    if (data?.length) {
      return data;
    }
    if (attempt < retries - 1) {
      await sleep(delayMs);
    }
  }
  return [];
}

function isJsonApiResponse(contentType, body) {
  const ct = String(contentType || "").toLowerCase();
  if (ct.includes("application/json")) return true;
  const trimmed = String(body || "").trim();
  return trimmed.startsWith("{") && trimmed.endsWith("}");
}

function isVercelProtectionHtml(body) {
  const text = String(body || "");
  return (
    text.includes("zeit-theme") ||
    text.includes("x-is-human") ||
    (text.includes("<!DOCTYPE html>") && text.includes("data-dpl-id"))
  );
}

function classifyPreviewResponse(res, bodyText) {
  const protectionHtml = isVercelProtectionHtml(bodyText);
  const jsonApi = isJsonApiResponse(res.headers.get("content-type"), bodyText);
  if (!jsonApi) {
    return { jsonApi: false, json: null, protectionHtml, jsonParseError: false };
  }
  try {
    const json = JSON.parse(bodyText);
    return { jsonApi: true, json, protectionHtml: false, jsonParseError: false };
  } catch {
    return { jsonApi: true, json: null, protectionHtml: false, jsonParseError: true };
  }
}

async function callPreview(baseUrl, { method = "GET", path, apiKey = null, query = null, body = null } = {}) {
  let endpoint = path;
  if (query) {
    const params = new URLSearchParams(query);
    endpoint = `${path}?${params.toString()}`;
  }
  const url = buildPreviewUrl(baseUrl, endpoint);
  const init = buildPreviewFetchInit({ method, apiKey, body });

  try {
    const { res, text } = await previewHttpRequest(url, init);
    const classified = classifyPreviewResponse(res, text);
    return {
      method,
      url,
      res,
      text,
      ...classified,
      transportError: null,
    };
  } catch (error) {
    return {
      method,
      url,
      res: null,
      text: "",
      jsonApi: false,
      json: null,
      protectionHtml: false,
      jsonParseError: false,
      transportError: error,
    };
  }
}

function recordPreviewBlocked(testName, result, reason) {
  logWarn(`Preview HTTP BLOCKED: ${testName}`);
  record(`preview:${testName}`, "HTTP verify", reason, "BLOCKED", result.res?.status ?? "—", "—");
  return null;
}

function recordPreviewTransportError(testName, result, expected) {
  const error = result.transportError;
  logPreviewFetchError(error, { method: result.method, url: result.url });
  const networkError = isPreviewFetchNetworkError(error);
  record(`preview:${testName}`, expected, error?.message || "transport error", networkError ? "FAIL" : "BLOCKED");
  return null;
}

function assertPreviewJson(testName, result, { expectedStatus, expectedCode, extraCheck = null }) {
  if (result.transportError) {
    recordPreviewTransportError(testName, result, `${expectedStatus} ${expectedCode}`);
    return { ok: false, requestId: null };
  }
  if (!result.jsonApi) {
    const reason = result.protectionHtml
      ? "Vercel Deployment Protection HTML"
      : `non-JSON (${result.res?.status})`;
    recordPreviewBlocked(testName, result, reason);
    return { ok: false, requestId: null };
  }
  if (result.jsonParseError) {
    record(`preview:${testName}`, `${expectedStatus} ${expectedCode}`, "JSON parse error", "FAIL", result.res?.status, "—");
    return { ok: false, requestId: null };
  }

  const statusOk = result.res.status === expectedStatus;
  const codeOk = result.json?.code === expectedCode;
  const extraOk = extraCheck ? extraCheck(result) : true;
  const pass = statusOk && codeOk && extraOk;

  record(
    `preview:${testName}`,
    `${expectedStatus} ${expectedCode}`,
    pass ? result.json.code : `status=${result.res.status} code=${result.json?.code}`,
    pass ? "PASS" : "FAIL",
    result.res.status,
    result.json?.code || "—"
  );

  if (pass) {
    logOk(`Preview ${testName}: PASS`);
  }
  return { ok: pass, requestId: result.json?.requestId || null };
}

async function assertAuditRow(admin, testName, requestId, expected) {
  if (!requestId) {
    record(`audit:${testName}`, expected.summary, "no requestId", "BLOCKED");
    return false;
  }

  const rows = await fetchAuditByRequestId(admin, requestId);
  if (!rows.length) {
    record(`audit:${testName}`, expected.summary, "no audit row", "FAIL");
    return false;
  }

  if (rows.length > 1) {
    record(`audit:${testName}`, "single row per request", `${rows.length} rows`, "FAIL");
    return false;
  }

  const row = rows[0];
  const checks = [
    row.event_type === expected.eventType,
    expected.resultCode == null || row.result_code === expected.resultCode,
    expected.scopeRequired == null || row.scope_required === expected.scopeRequired,
    expected.statusCode == null || row.status_code === expected.statusCode,
    expected.keyPrefix == null || row.key_prefix === expected.keyPrefix,
    row.request_id === requestId,
  ];

  const pass = checks.every(Boolean);
  record(
    `audit:${testName}`,
    expected.summary,
    pass
      ? `${row.event_type} ${row.result_code}`
      : `event=${row.event_type} code=${row.result_code} scope=${row.scope_required}`,
    pass ? "PASS" : "FAIL"
  );

  if (pass) {
    logOk(`Audit ${testName}: PASS`);
  }
  return pass;
}

async function runVerifyMatrix(admin, baseUrl, fixtures) {
  logInfo("\n--- Preview HTTP + audit rows ---\n");

  if (!baseUrl) {
    for (const name of [
      "integrations read",
      "integrations write",
      "integrations write denied",
      "missing key",
      "invalid key",
      "revoked key",
      "webhook read",
      "webhook write",
    ]) {
      record(`preview:${name}`, "HTTP verify", "no preview URL", "BLOCKED");
    }
    return;
  }

  for (const fx of Object.values(fixtures)) {
    trackSecret(fx.plainKey);
  }

  const integrationsRead = await callPreview(baseUrl, {
    path: "/api/v1/integrations",
    apiKey: fixtures.tenantAIntegrations.plainKey,
  });
  const readHttp = assertPreviewJson("integrations read", integrationsRead, {
    expectedStatus: 200,
    expectedCode: "ok",
  });
  await assertAuditRow(admin, "integrations read", readHttp.requestId, {
    summary: `${INTEGRATION_AUDIT_EVENTS.INTEGRATION_READ}`,
    eventType: INTEGRATION_AUDIT_EVENTS.INTEGRATION_READ,
    resultCode: "ok",
    scopeRequired: API_SCOPES.INTEGRATIONS_READ,
    statusCode: 200,
    keyPrefix: fixtures.tenantAIntegrations.prefix,
  });

  const integrationsWrite = await callPreview(baseUrl, {
    method: "POST",
    path: "/api/v1/integrations/zalo/test-write",
    apiKey: fixtures.tenantAIntegrationsWrite.plainKey,
    body: { probe: true, probeTag: PROBE_TAG },
  });
  const writeHttp = assertPreviewJson("integrations write", integrationsWrite, {
    expectedStatus: 200,
    expectedCode: "ok",
    extraCheck: (r) => r.json?.data?.accepted === true,
  });
  await assertAuditRow(admin, "integrations write", writeHttp.requestId, {
    summary: `${INTEGRATION_AUDIT_EVENTS.INTEGRATION_WRITE}`,
    eventType: INTEGRATION_AUDIT_EVENTS.INTEGRATION_WRITE,
    resultCode: "ok",
    scopeRequired: API_SCOPES.INTEGRATIONS_WRITE,
    statusCode: 200,
    keyPrefix: fixtures.tenantAIntegrationsWrite.prefix,
  });

  const writeDenied = await callPreview(baseUrl, {
    method: "POST",
    path: "/api/v1/integrations/zalo/test-write",
    apiKey: fixtures.tenantAIntegrations.plainKey,
    body: { probe: true },
  });
  const deniedHttp = assertPreviewJson("integrations write denied", writeDenied, {
    expectedStatus: 403,
    expectedCode: EDGE_API_ERROR_CODES.SCOPE_DENIED,
  });
  await assertAuditRow(admin, "integrations write denied", deniedHttp.requestId, {
    summary: INTEGRATION_AUDIT_EVENTS.API_KEY_SCOPE_DENIED,
    eventType: INTEGRATION_AUDIT_EVENTS.API_KEY_SCOPE_DENIED,
    resultCode: EDGE_API_ERROR_CODES.SCOPE_DENIED,
    scopeRequired: API_SCOPES.INTEGRATIONS_WRITE,
    statusCode: 403,
    keyPrefix: fixtures.tenantAIntegrations.prefix,
  });

  const missing = await callPreview(baseUrl, { path: "/api/v1/integrations" });
  const missingHttp = assertPreviewJson("missing key", missing, {
    expectedStatus: 401,
    expectedCode: EDGE_API_ERROR_CODES.UNAUTHORIZED,
  });
  await assertAuditRow(admin, "missing key", missingHttp.requestId, {
    summary: INTEGRATION_AUDIT_EVENTS.API_KEY_DENIED,
    eventType: INTEGRATION_AUDIT_EVENTS.API_KEY_DENIED,
    resultCode: EDGE_API_ERROR_CODES.UNAUTHORIZED,
    scopeRequired: API_SCOPES.INTEGRATIONS_READ,
    statusCode: 401,
  });

  const invalid = await callPreview(baseUrl, {
    path: "/api/v1/integrations",
    apiKey: "pk_invalid.notarealkey000000000000000000000000",
  });
  const invalidHttp = assertPreviewJson("invalid key", invalid, {
    expectedStatus: 401,
    expectedCode: EDGE_API_ERROR_CODES.INVALID_API_KEY,
  });
  await assertAuditRow(admin, "invalid key", invalidHttp.requestId, {
    summary: INTEGRATION_AUDIT_EVENTS.API_KEY_DENIED,
    eventType: INTEGRATION_AUDIT_EVENTS.API_KEY_DENIED,
    resultCode: EDGE_API_ERROR_CODES.INVALID_API_KEY,
    scopeRequired: API_SCOPES.INTEGRATIONS_READ,
    statusCode: 401,
  });

  const revoked = await callPreview(baseUrl, {
    path: "/api/v1/integrations",
    apiKey: fixtures.tenantARevoked.plainKey,
  });
  const revokedHttp = assertPreviewJson("revoked key", revoked, {
    expectedStatus: 401,
    expectedCode: EDGE_API_ERROR_CODES.INVALID_API_KEY,
  });
  await assertAuditRow(admin, "revoked key", revokedHttp.requestId, {
    summary: INTEGRATION_AUDIT_EVENTS.API_KEY_DENIED,
    eventType: INTEGRATION_AUDIT_EVENTS.API_KEY_DENIED,
    resultCode: EDGE_API_ERROR_CODES.INVALID_API_KEY,
    scopeRequired: API_SCOPES.INTEGRATIONS_READ,
    statusCode: 401,
    keyPrefix: fixtures.tenantARevoked.prefix,
  });

  const webhookRead = await callPreview(baseUrl, {
    path: "/api/v1/webhooks/test",
    apiKey: fixtures.tenantAWebhookRo.plainKey,
  });
  const webhookReadHttp = assertPreviewJson("webhook read", webhookRead, {
    expectedStatus: 200,
    expectedCode: "ok",
  });
  await assertAuditRow(admin, "webhook read", webhookReadHttp.requestId, {
    summary: INTEGRATION_AUDIT_EVENTS.WEBHOOK_READ,
    eventType: INTEGRATION_AUDIT_EVENTS.WEBHOOK_READ,
    resultCode: "ok",
    scopeRequired: API_SCOPES.WEBHOOKS_READ,
    statusCode: 200,
    keyPrefix: fixtures.tenantAWebhookRo.prefix,
  });

  const webhookWrite = await callPreview(baseUrl, {
    method: "POST",
    path: "/api/v1/webhooks/test",
    apiKey: fixtures.tenantAWebhookRw.plainKey,
    body: { eventType: "test.ping", payload: { probeTag: PROBE_TAG } },
  });
  const webhookWriteHttp = assertPreviewJson("webhook write", webhookWrite, {
    expectedStatus: 200,
    expectedCode: "ok",
  });
  await assertAuditRow(admin, "webhook write", webhookWriteHttp.requestId, {
    summary: INTEGRATION_AUDIT_EVENTS.WEBHOOK_WRITE,
    eventType: INTEGRATION_AUDIT_EVENTS.WEBHOOK_WRITE,
    resultCode: "ok",
    scopeRequired: API_SCOPES.WEBHOOKS_WRITE,
    statusCode: 200,
    keyPrefix: fixtures.tenantAWebhookRw.prefix,
  });

  void runStartIso;
  void TENANT_A;
}

function printResultsTable() {
  console.log("\n=== Results ===\n");
  const header = ["Test", "Expected", "Actual", "Verdict", "HTTP", "Code"];
  const rows = results.map((r) => [
    r.test,
    r.expected,
    redactSecrets(String(r.actual).slice(0, 60)),
    r.verdict,
    String(r.httpStatus),
    String(r.errorCode),
  ]);

  const widths = header.map((h, i) =>
    Math.max(h.length, ...rows.map((row) => String(row[i]).length))
  );
  const formatRow = (cols) => cols.map((c, i) => String(c).padEnd(widths[i])).join(" | ");
  console.log(formatRow(header));
  console.log(widths.map((w) => "-".repeat(w)).join("-+-"));
  for (const row of rows) {
    console.log(formatRow(row));
  }
}

function runOutputSafetyCheck() {
  const leakedService = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  let leak = false;
  if (leakedService && capturedOutput.includes(leakedService)) {
    leak = true;
    record("safety:service role", "not in stdout", "LEAKED", "FAIL");
  }
  for (const secret of secretFingerprints) {
    if (capturedOutput.includes(secret)) {
      leak = true;
      record("safety:raw key secret", "not in stdout", "LEAKED", "FAIL");
      break;
    }
  }
  if (!leak) {
    record("safety:output redaction", "no secrets in stdout", "clean", "PASS");
    logOk("Output safety: PASS (no raw keys / service role in stdout)");
  }
}

async function main() {
  loadProjectEnv();
  runStartIso = new Date().toISOString();
  const previewBaseUrl = normalizePreviewBaseUrl(
    process.env.STAGING_PREVIEW_URL || DEFAULT_PREVIEW_URL
  );

  const serviceKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  if (!serviceKey) {
    console.error("Thiếu SUPABASE_SERVICE_ROLE_KEY — required for seed + audit verify.");
    process.exit(1);
  }

  const originalLog = console.log;
  console.log = (...args) => {
    capturedOutput += `${args.map((a) => String(a)).join(" ")}\n`;
    originalLog(...args);
  };

  logInfo("Phase 11E — Integration audit staging verify");
  logInfo(`Preview URL: ${previewBaseUrl}`);
  if (!getBypassSecret()) {
    logWarn("VERCEL_AUTOMATION_BYPASS_SECRET unset — Preview may BLOCK on Deployment Protection");
  }

  const admin = createAdminClient();
  let seeded = null;
  let schemaOk = false;

  try {
    schemaOk = await probeIntegrationAuditSchema(admin);
    if (!schemaOk) {
      logWarn("integration_audit_logs schema probe FAILED — apply phase11e migration first");
    }

    logInfo("\n--- Clear probe audit rows ---\n");
    const cleared = await clearProbeAuditRows(admin);
    if (cleared.ok) {
      logOk("Cleared prior phase11e probe audit rows");
    } else {
      logWarn(`Audit cleanup warning: ${cleared.error}`);
    }

    logInfo("\n--- Seed Phase 11D/11E fixtures ---\n");
    seeded = await seedPhase11dFixtures(admin);
    if (!seeded.ok) {
      record("seed:fixtures", "all fixtures", seeded.error, "FAIL");
      logWarn(`Seed FAILED: ${seeded.error}`);
    } else {
      record("seed:fixtures", `${Object.keys(seeded.fixtures).length} keys`, "inserted", "PASS");
      logOk(`Seeded ${Object.keys(seeded.fixtures).length} fixtures`);
      for (const [id, fx] of Object.entries(seeded.fixtures)) {
        logInfo(`  ${id}: ${fx.prefix}`);
        trackSecret(fx.plainKey);
      }
    }

    if (seeded?.ok && schemaOk) {
      await runVerifyMatrix(admin, previewBaseUrl, seeded.fixtures);
    } else if (!schemaOk) {
      record("verify:matrix", "schema + seed ok", "schema missing", "BLOCKED");
    }
  } finally {
    logInfo("\n--- Cleanup fixtures + probe audit ---\n");
    await clearProbeAuditRows(admin);
    const cleaned = await cleanupPhase11dSeed(admin);
    if (cleaned.ok) {
      logOk(`Cleanup: removed ${cleaned.removedClients} probe clients`);
    } else {
      logWarn(`Cleanup warning: ${cleaned.error}`);
    }
  }

  runOutputSafetyCheck();
  printResultsTable();

  const pass = results.filter((r) => r.verdict === "PASS").length;
  const fail = results.filter((r) => r.verdict === "FAIL").length;
  const blocked = results.filter((r) => r.verdict === "BLOCKED").length;
  const partial = results.filter((r) => r.verdict === "PARTIAL").length;

  console.log("\n=== Summary ===");
  console.log(`PASS: ${pass}`);
  console.log(`FAIL: ${fail}`);
  console.log(`BLOCKED: ${blocked}`);
  console.log(`PARTIAL: ${partial}`);

  const verdict =
    fail === 0 && blocked === 0 && partial === 0 && seeded?.ok && schemaOk ? "PASS" : fail > 0 ? "FAIL" : blocked > 0 ? "BLOCKED" : "PARTIAL";
  console.log(`\nPhase 11E staging verify: ${verdict}`);
  process.exit(verdict === "PASS" ? 0 : 1);
}

main().catch((error) => {
  console.error(redactSecrets(error?.message || String(error)));
  process.exit(1);
});
