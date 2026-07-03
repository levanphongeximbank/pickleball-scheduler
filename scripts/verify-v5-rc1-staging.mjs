/**
 * Phase 12 — V5.0 RC1 staging technical verify (automated gates only).
 *
 * Covers: health, API envelope, Supabase API key runtime, integration audit,
 * basic SPA route availability, output safety. Does NOT replace full manual QA.
 *
 * Usage:
 *   STAGING_PREVIEW_URL=https://your-preview.vercel.app \
 *   VERCEL_AUTOMATION_BYPASS_SECRET=... \
 *   SUPABASE_SERVICE_ROLE_KEY=... \
 *     node scripts/verify-v5-rc1-staging.mjs
 *
 * Optional cross-tenant RLS (JWT, not service role):
 *   STAGING_OWNER_A_PASSWORD=... STAGING_OWNER_B_PASSWORD=... \
 *     node scripts/verify-cross-tenant-rls-staging.mjs
 *
 * Never prints raw API keys or secrets.
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
  TENANT_B,
} from "./seed-phase11d-api-keys-staging.mjs";
import { EDGE_API_ERROR_CODES } from "../src/features/api/constants/edgeApiErrors.js";
import { INTEGRATION_AUDIT_EVENTS } from "../src/features/api/constants/integrationAudit.js";
import { getSupabaseEnv, loadProjectEnv } from "./load-env.mjs";

const DEFAULT_PREVIEW_URL =
  "https://pickleball-scheduler-git-v5-platfor-47ef4a-pickleball-scheduler.vercel.app";

const PROBE_TAG = "phase12-rc1";
const AUDIT_POLL_MS = 1500;

const SPA_ROUTES = [
  { path: "/login", name: "login", expectHtml: true },
  { path: "/", name: "home", expectHtml: true },
  { path: "/manifest.webmanifest", name: "manifest", expectJson: true },
];

const results = [];
const secretFingerprints = [];
let capturedOutput = "";

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
    return { method, url, res, text, ...classified, transportError: null };
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
  return { ok: false, requestId: null };
}

function recordPreviewTransportError(testName, result, expected) {
  const error = result.transportError;
  logPreviewFetchError(error, { method: result.method, url: result.url });
  const networkError = isPreviewFetchNetworkError(error);
  record(
    `preview:${testName}`,
    expected,
    error?.message || "transport error",
    networkError ? "FAIL" : "BLOCKED"
  );
  return { ok: false, requestId: null };
}

function assertPreviewJson(testName, result, { expectedStatus, expectedCode, extraCheck = null }) {
  if (result.transportError) {
    return recordPreviewTransportError(testName, result, `${expectedStatus} ${expectedCode}`);
  }
  if (!result.jsonApi) {
    const reason = result.protectionHtml
      ? "Vercel Deployment Protection HTML"
      : `non-JSON (${result.res?.status})`;
    return recordPreviewBlocked(testName, result, reason);
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

function assertApiEnvelope(testName, result) {
  if (result.transportError) {
    return recordPreviewTransportError(testName, result, "envelope ok/code/data/requestId");
  }
  if (!result.jsonApi || result.jsonParseError) {
    return recordPreviewBlocked(testName, result, "non-JSON");
  }

  const body = result.json;
  const hasOk = typeof body?.ok === "boolean";
  const hasCode = typeof body?.code === "string";
  const hasRequestId = typeof body?.requestId === "string" && body.requestId.length > 0;
  const pass = hasOk && hasCode && hasRequestId;

  record(
    `envelope:${testName}`,
    "ok + code + requestId",
    pass ? "valid envelope" : `ok=${hasOk} code=${hasCode} requestId=${hasRequestId}`,
    pass ? "PASS" : "FAIL",
    result.res?.status ?? "—",
    body?.code || "—"
  );

  if (pass) {
    logOk(`API envelope ${testName}: PASS`);
  }
  return pass;
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

  const row = rows[0];
  const pass =
    row.event_type === expected.eventType &&
    (expected.resultCode == null || row.result_code === expected.resultCode) &&
    (expected.statusCode == null || row.status_code === expected.statusCode);

  record(
    `audit:${testName}`,
    expected.summary,
    pass ? row.event_type : `event=${row.event_type} result=${row.result_code}`,
    pass ? "PASS" : "FAIL"
  );

  if (pass) {
    logOk(`Audit ${testName}: PASS`);
  }
  return pass;
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

async function probeSpaRoutes(baseUrl) {
  logInfo("\n--- SPA route availability (non-500) ---\n");

  for (const route of SPA_ROUTES) {
    const url = buildPreviewUrl(baseUrl, route.path);
    try {
      const { res, text } = await previewHttpRequest(url, buildPreviewFetchInit({ method: "GET" }));
      const protectionHtml = isVercelProtectionHtml(text);
      if (protectionHtml) {
        record(`spa:${route.name}`, "200 HTML/JSON", "Vercel protection HTML", "BLOCKED", res.status);
        logWarn(`SPA ${route.path}: BLOCKED (deployment protection)`);
        continue;
      }

      const statusOk = res.status >= 200 && res.status < 400;
      let contentOk = false;
      if (route.expectJson) {
        contentOk = isJsonApiResponse(res.headers.get("content-type"), text);
      } else if (route.expectHtml) {
        contentOk =
          String(text).includes("<!DOCTYPE html>") ||
          String(text).includes("<html") ||
          String(text).includes('id="root"');
      }

      const pass = statusOk && contentOk;
      record(
        `spa:${route.name}`,
        route.expectJson ? "200 JSON manifest" : "200 HTML shell",
        pass ? `${res.status}` : `status=${res.status} content mismatch`,
        pass ? "PASS" : "FAIL",
        res.status
      );
      if (pass) {
        logOk(`SPA ${route.path}: PASS (${res.status})`);
      }
    } catch (error) {
      const networkError = isPreviewFetchNetworkError(error);
      logPreviewFetchError(error, { method: "GET", url });
      record(
        `spa:${route.name}`,
        "200 reachable",
        error?.message || "fetch error",
        networkError ? "FAIL" : "BLOCKED"
      );
    }
  }
}

async function runApiKeyMatrix(baseUrl, fixtures) {
  logInfo("\n--- API key runtime (RC1 subset) ---\n");

  for (const fx of Object.values(fixtures)) {
    trackSecret(fx.plainKey);
  }

  const health = await callPreview(baseUrl, { path: "/api/v1/health" });
  assertPreviewJson("health", health, { expectedStatus: 200, expectedCode: "ok" });
  assertApiEnvelope("health", health);

  const missing = await callPreview(baseUrl, { path: "/api/v1/tenant" });
  assertPreviewJson("missing key", missing, {
    expectedStatus: 401,
    expectedCode: EDGE_API_ERROR_CODES.UNAUTHORIZED,
  });

  const invalid = await callPreview(baseUrl, {
    path: "/api/v1/tenant",
    apiKey: "pk_invalid.notarealkey000000000000000000000000",
  });
  assertPreviewJson("invalid key", invalid, {
    expectedStatus: 401,
    expectedCode: EDGE_API_ERROR_CODES.INVALID_API_KEY,
  });

  const valid = await callPreview(baseUrl, {
    path: "/api/v1/tenant",
    apiKey: fixtures.tenantARead.plainKey,
  });
  assertPreviewJson("valid key tenant A", valid, {
    expectedStatus: 200,
    expectedCode: "ok",
    extraCheck: (r) => r.json?.data?.tenantId === TENANT_A,
  });

  const wrongAtoB = await callPreview(baseUrl, {
    path: "/api/v1/tenant",
    query: { tenantId: TENANT_B },
    apiKey: fixtures.tenantARead.plainKey,
  });
  assertPreviewJson("cross-tenant A→B", wrongAtoB, {
    expectedStatus: 403,
    expectedCode: EDGE_API_ERROR_CODES.TENANT_NOT_FOUND,
  });

  const integrationsRead = await callPreview(baseUrl, {
    path: "/api/v1/integrations",
    apiKey: fixtures.tenantAIntegrations.plainKey,
  });
  assertPreviewJson("integrations read", integrationsRead, {
    expectedStatus: 200,
    expectedCode: "ok",
  });

  const integrationsWriteDenied = await callPreview(baseUrl, {
    method: "POST",
    path: "/api/v1/integrations/zalo/test-write",
    apiKey: fixtures.tenantAIntegrations.plainKey,
    body: { probeTag: PROBE_TAG },
  });
  assertPreviewJson("integrations write denied", integrationsWriteDenied, {
    expectedStatus: 403,
    expectedCode: EDGE_API_ERROR_CODES.SCOPE_DENIED,
  });

  const integrationsWrite = await callPreview(baseUrl, {
    method: "POST",
    path: "/api/v1/integrations/zalo/test-write",
    apiKey: fixtures.tenantAIntegrationsWrite.plainKey,
    body: { probeTag: PROBE_TAG },
  });
  const writeResult = assertPreviewJson("integrations write", integrationsWrite, {
    expectedStatus: 200,
    expectedCode: "ok",
  });

  const webhookRead = await callPreview(baseUrl, {
    path: "/api/v1/webhooks/test",
    apiKey: fixtures.tenantAWebhookRo.plainKey,
  });
  assertPreviewJson("webhook read", webhookRead, { expectedStatus: 200, expectedCode: "ok" });

  return { integrationsRead, integrationsWriteDenied, writeResult };
}

async function runAuditChecks(admin, httpResults) {
  logInfo("\n--- Integration audit logs (RC1 subset) ---\n");

  const { data: schemaProbe, error: schemaError } = await admin
    .from("integration_audit_logs")
    .select("id, request_id, event_type, result_code, status_code")
    .limit(1);

  if (schemaError) {
    record("schema:integration_audit_logs", "readable", schemaError.message, "FAIL");
    logWarn("integration_audit_logs schema probe FAILED");
    return;
  }
  record("schema:integration_audit_logs", "table readable", "ok", "PASS");
  void schemaProbe;

  const readReqId = httpResults.integrationsRead?.requestId;
  await assertAuditRow(admin, "integrations read", readReqId, {
    summary: "integration.read",
    eventType: INTEGRATION_AUDIT_EVENTS.INTEGRATION_READ,
    resultCode: "ok",
    statusCode: 200,
  });

  const deniedReqId = httpResults.integrationsWriteDenied?.requestId;
  await assertAuditRow(admin, "integrations write denied", deniedReqId, {
    summary: "api_key.scope_denied",
    eventType: INTEGRATION_AUDIT_EVENTS.API_KEY_SCOPE_DENIED,
    resultCode: EDGE_API_ERROR_CODES.SCOPE_DENIED,
    statusCode: 403,
  });

  const writeReqId = httpResults.writeResult?.requestId;
  await assertAuditRow(admin, "integrations write", writeReqId, {
    summary: "integration.write",
    eventType: INTEGRATION_AUDIT_EVENTS.INTEGRATION_WRITE,
    resultCode: "ok",
    statusCode: 200,
  });
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

  logInfo("Phase 12 — V5.0 RC1 staging technical verify");
  logInfo(`Preview URL: ${previewBaseUrl}`);
  if (!getBypassSecret()) {
    logWarn("VERCEL_AUTOMATION_BYPASS_SECRET unset — Preview may BLOCK on Deployment Protection");
  }

  const admin = createAdminClient();
  let seeded = null;
  let httpResults = null;

  try {
    await clearProbeAuditRows(admin);

    logInfo("\n--- Seed Phase 11D fixtures ---\n");
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

    if (seeded?.ok) {
      httpResults = await runApiKeyMatrix(previewBaseUrl, seeded.fixtures);
      await runAuditChecks(admin, httpResults);
    }

    await probeSpaRoutes(previewBaseUrl);
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

  console.log("\n=== Summary ===");
  console.log(`PASS: ${pass}`);
  console.log(`FAIL: ${fail}`);
  console.log(`BLOCKED: ${blocked}`);

  const verdict =
    fail === 0 && blocked === 0 && seeded?.ok ? "PASS" : fail > 0 ? "FAIL" : "BLOCKED";
  console.log(`\nV5.0 RC1 staging technical verify: ${verdict}`);
  console.log("\nManual QA: docs/v5/PHASE_12_V5_RC1_FULL_QA.md");
  console.log("Cross-tenant RLS: node scripts/verify-cross-tenant-rls-staging.mjs");
  process.exit(verdict === "PASS" ? 0 : 1);
}

main().catch((error) => {
  console.error(redactSecrets(error?.message || String(error)));
  process.exit(1);
});
