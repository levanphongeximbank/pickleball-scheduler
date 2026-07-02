/**
 * Phase 11D — Supabase-backed API key runtime staging verify.
 *
 * Usage:
 *   STAGING_PREVIEW_URL=https://your-preview.vercel.app \
 *   VERCEL_AUTOMATION_BYPASS_SECRET=... \
 *   SUPABASE_SERVICE_ROLE_KEY=... \
 *   node scripts/verify-phase11d-api-key-runtime-staging.mjs
 *
 * Seeds probe keys → Preview HTTP verify → cleanup. Never logs raw API keys.
 */
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
import { loadProjectEnv } from "./load-env.mjs";

const DEFAULT_PREVIEW_URL =
  "https://pickleball-scheduler-git-v5-platfor-47ef4a-pickleball-scheduler.vercel.app";

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

function bodySnippet(text, maxLen = 200) {
  const snippet = String(text || "").replace(/\s+/g, " ").trim().slice(0, maxLen);
  return snippet ? `${snippet}${String(text || "").length > maxLen ? "…" : ""}` : "(empty)";
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
  logWarn(`  url: ${result.url}`);
  logWarn(`  status: ${result.res?.status ?? "—"}`);
  logWarn(`  bypass-header-sent: ${Boolean(getBypassSecret())}`);
  logWarn(`  body-snippet: ${redactSecrets(bodySnippet(result.text))}`);
  record(`preview:${testName}`, "HTTP verify", reason, "BLOCKED", result.res?.status ?? "—", "—");
}

function recordPreviewTransportError(testName, result, expected) {
  const error = result.transportError;
  logPreviewFetchError(error, { method: result.method, url: result.url });
  const networkError = isPreviewFetchNetworkError(error);
  const detail = networkError ? `network error — ${error.message}` : error?.message || "transport error";
  record(`preview:${testName}`, expected, detail, networkError ? "FAIL" : "BLOCKED");
}

function assertPreviewJson(testName, result, { expectedStatus, expectedCode, extraCheck = null }) {
  if (result.transportError) {
    recordPreviewTransportError(testName, result, `${expectedStatus} ${expectedCode}`);
    return false;
  }
  if (!result.jsonApi) {
    const reason = result.protectionHtml
      ? "Vercel Deployment Protection HTML"
      : `non-JSON (${result.res?.status})`;
    recordPreviewBlocked(testName, result, reason);
    return false;
  }
  if (result.jsonParseError) {
    record(`preview:${testName}`, `${expectedStatus} ${expectedCode}`, "JSON parse error", "FAIL", result.res?.status, "—");
    return false;
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
  return pass;
}

async function runPreviewHttpTests(baseUrl, fixtures) {
  logInfo("\n--- Preview HTTP (Supabase-backed runtime) ---\n");

  if (!baseUrl) {
    for (const name of [
      "health",
      "missing key",
      "invalid key",
      "valid key",
      "missing scope",
      "valid scope",
      "wrong tenant A→B",
      "wrong tenant B→A",
      "revoked key",
      "expired key",
      "rate limit",
      "webhook read",
      "webhook write denied",
      "webhook write ok",
    ]) {
      record(`preview:${name}`, "HTTP verify", "no preview URL", "BLOCKED");
    }
    return;
  }

  for (const fx of Object.values(fixtures)) {
    trackSecret(fx.plainKey);
  }

  const health = await callPreview(baseUrl, { path: "/api/v1/health" });
  assertPreviewJson("health", health, { expectedStatus: 200, expectedCode: "ok" });

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
  assertPreviewJson("valid key", valid, {
    expectedStatus: 200,
    expectedCode: "ok",
    extraCheck: (r) => r.json?.data?.tenantId === TENANT_A,
  });

  const missingScope = await callPreview(baseUrl, {
    path: "/api/v1/integrations",
    apiKey: fixtures.tenantANoIntegrations.plainKey,
  });
  assertPreviewJson("missing scope", missingScope, {
    expectedStatus: 403,
    expectedCode: EDGE_API_ERROR_CODES.SCOPE_DENIED,
  });

  const validScope = await callPreview(baseUrl, {
    path: "/api/v1/integrations",
    apiKey: fixtures.tenantAIntegrations.plainKey,
  });
  assertPreviewJson("valid scope", validScope, {
    expectedStatus: 200,
    expectedCode: "ok",
    extraCheck: (r) => r.json?.data?.tenantId === TENANT_A,
  });

  const wrongAtoB = await callPreview(baseUrl, {
    path: "/api/v1/tenant",
    query: { tenantId: TENANT_B },
    apiKey: fixtures.tenantARead.plainKey,
  });
  assertPreviewJson("wrong tenant A→B", wrongAtoB, {
    expectedStatus: 403,
    expectedCode: EDGE_API_ERROR_CODES.TENANT_NOT_FOUND,
  });

  const wrongBtoA = await callPreview(baseUrl, {
    path: "/api/v1/tenant",
    query: { tenantId: TENANT_A },
    apiKey: fixtures.tenantBRead.plainKey,
  });
  assertPreviewJson("wrong tenant B→A", wrongBtoA, {
    expectedStatus: 403,
    expectedCode: EDGE_API_ERROR_CODES.TENANT_NOT_FOUND,
  });

  const revoked = await callPreview(baseUrl, {
    path: "/api/v1/tenant",
    apiKey: fixtures.tenantARevoked.plainKey,
  });
  assertPreviewJson("revoked key", revoked, {
    expectedStatus: 401,
    expectedCode: EDGE_API_ERROR_CODES.INVALID_API_KEY,
  });

  const expired = await callPreview(baseUrl, {
    path: "/api/v1/tenant",
    apiKey: fixtures.tenantAExpired.plainKey,
  });
  assertPreviewJson("expired key", expired, {
    expectedStatus: 401,
    expectedCode: EDGE_API_ERROR_CODES.INVALID_API_KEY,
  });

  const rateKey = fixtures.tenantARateLimit.plainKey;
  await callPreview(baseUrl, { path: "/api/v1/tenant", apiKey: rateKey });
  const rateLimited = await callPreview(baseUrl, { path: "/api/v1/tenant", apiKey: rateKey });
  if (rateLimited.transportError) {
    recordPreviewTransportError("rate limit", rateLimited, "429 rate_limited");
  } else if (!rateLimited.jsonApi) {
    recordPreviewBlocked("rate limit", rateLimited, "non-JSON");
  } else {
    const ratePass =
      rateLimited.res.status === 429 &&
      rateLimited.json?.code === EDGE_API_ERROR_CODES.RATE_LIMITED &&
      rateLimited.res.headers.get("x-ratelimit-limit");
    record(
      "preview:rate limit",
      "429 rate_limited + X-RateLimit-*",
      ratePass ? "rate_limited" : `${rateLimited.res.status} ${rateLimited.json?.code}`,
      ratePass ? "PASS" : "FAIL",
      rateLimited.res.status,
      rateLimited.json?.code || "—"
    );
    if (!ratePass) {
      logWarn(
        "Rate limit FAIL — set API_RATE_LIMIT_REQUESTS_PER_MINUTE=1 on Vercel Preview for deterministic 429"
      );
    } else {
      logOk("Preview rate limit: PASS");
    }
  }

  const webhookRead = await callPreview(baseUrl, {
    path: "/api/v1/webhooks/test",
    apiKey: fixtures.tenantAWebhookRw.plainKey,
  });
  assertPreviewJson("webhook read", webhookRead, { expectedStatus: 200, expectedCode: "ok" });

  const webhookWriteDenied = await callPreview(baseUrl, {
    method: "POST",
    path: "/api/v1/webhooks/test",
    apiKey: fixtures.tenantAWebhookRo.plainKey,
    body: { eventType: "test.ping" },
  });
  assertPreviewJson("webhook write denied", webhookWriteDenied, {
    expectedStatus: 403,
    expectedCode: EDGE_API_ERROR_CODES.SCOPE_DENIED,
  });

  const webhookWriteOk = await callPreview(baseUrl, {
    method: "POST",
    path: "/api/v1/webhooks/test",
    apiKey: fixtures.tenantAWebhookRw.plainKey,
    body: { eventType: "test.ping", payload: { probe: true } },
  });
  assertPreviewJson("webhook write ok", webhookWriteOk, {
    expectedStatus: 200,
    expectedCode: "ok",
    extraCheck: (r) => r.json?.data?.accepted === true,
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
    console.error("Thiếu SUPABASE_SERVICE_ROLE_KEY — required for seed + verify.");
    process.exit(1);
  }

  const originalLog = console.log;
  console.log = (...args) => {
    capturedOutput += `${args.map((a) => String(a)).join(" ")}\n`;
    originalLog(...args);
  };

  logInfo("Phase 11D — Supabase API key runtime staging verify");
  logInfo(`Preview URL: ${previewBaseUrl}`);
  if (!getBypassSecret()) {
    logWarn("VERCEL_AUTOMATION_BYPASS_SECRET unset — Preview may BLOCK on Deployment Protection");
  }

  let seeded;
  try {
    logInfo("\n--- Seed Phase 11D fixtures ---\n");
    seeded = await seedPhase11dFixtures();
    if (!seeded.ok) {
      record("seed:fixtures", "all fixtures", seeded.error, "FAIL");
      logWarn(`Seed FAILED: ${seeded.error}`);
    } else {
      record("seed:fixtures", `${Object.keys(seeded.fixtures).length} keys`, "inserted", "PASS");
      logOk(`Seeded ${Object.keys(seeded.fixtures).length} fixtures (prefix only in logs)`);
      for (const [id, fx] of Object.entries(seeded.fixtures)) {
        logInfo(`  ${id}: ${fx.prefix}`);
        trackSecret(fx.plainKey);
      }
    }

    if (seeded.ok) {
      await runPreviewHttpTests(previewBaseUrl, seeded.fixtures);
    }
  } finally {
    logInfo("\n--- Cleanup Phase 11D fixtures ---\n");
    const cleaned = await cleanupPhase11dSeed();
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
    fail === 0 && blocked === 0 && partial === 0 && seeded?.ok ? "PASS" : partial > 0 && fail === 0 && blocked === 0 ? "PARTIAL" : "FAIL";
  console.log(`\nPhase 11D staging verify: ${verdict}`);
  process.exit(verdict === "PASS" ? 0 : 1);
}

main().catch((error) => {
  console.error(redactSecrets(error?.message || String(error)));
  process.exit(1);
});
