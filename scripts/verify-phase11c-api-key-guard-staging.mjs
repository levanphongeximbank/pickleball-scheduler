/**
 * Phase 11C — Edge API key guard staging verify.
 *
 * Usage:
 *   STAGING_PREVIEW_URL=https://your-preview.vercel.app \
 *   VERCEL_AUTOMATION_BYPASS_SECRET=... \
 *   STAGING_OWNER_A_PASSWORD=... STAGING_OWNER_B_PASSWORD=... STAGING_PLAYER_PASSWORD=... \
 *     node scripts/verify-phase11c-api-key-guard-staging.mjs
 *
 * Preview deployments with Vercel Deployment Protection require
 * VERCEL_AUTOMATION_BYPASS_SECRET (header x-vercel-protection-bypass).
 *
 * Never prints raw API keys or secrets.
 */
import {
  buildPreviewFetchInit,
  buildPreviewUrl,
  getBypassSecret,
  httpFetch,
  isPreviewFetchNetworkError,
  logPreviewFetchError,
  normalizePreviewBaseUrl,
  previewHttpRequest,
} from "./phase11c-preview-http.mjs";
import { createClient } from "@supabase/supabase-js";
import { can } from "../src/auth/rbac.js";
import { normalizeUser } from "../src/models/user.js";
import { PERMISSIONS } from "../src/auth/permissions.js";
import { getSupabaseEnv, loadProjectEnv } from "./load-env.mjs";
import { signInStagingUser } from "./staging-auth-resolve.mjs";
import {
  createApiClientWithKey,
  revokeApiKey,
  listApiKeys,
} from "../src/features/api/services/apiKeyService.js";
import { clearApiStorage, loadApiKeys, saveApiKeys } from "../src/features/api/storage/apiStorage.js";
import { guardApiKey } from "../src/features/api/guards/apiKeyGuard.js";
import { invokeEdgeApi } from "../src/features/api/router/edgeApiRouter.js";
import { API_SCOPES } from "../src/features/api/constants/apiScopes.js";
import { hashApiKey, generateApiKey } from "../src/features/api/utils/hashKey.js";
import { EDGE_API_ERROR_CODES } from "../src/features/api/constants/edgeApiErrors.js";
import {
  clearApiKeyAuditStorage,
  listApiKeyAuditEvents,
} from "../src/features/api/services/apiKeyAuditService.js";
import { resetRateLimitCounters } from "../src/features/api/guards/rateLimitGuard.js";

const STAGING_REF = "qyewbxjsiiyufanzcjcq";
const EXPECTED_COMMIT = "f028503";
const TENANT_A = "venue-staging-a";
const TENANT_B = "venue-staging-b";
const EXPECTED_INDEXES = ["api_keys_prefix_tenant_idx", "api_keys_tenant_status_idx"];
const REQUIRED_COLUMNS = [
  "key_prefix",
  "hashed_key",
  "status",
  "scopes",
  "tenant_id",
  "expires_at",
];
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

function resolvePreviewBaseUrl() {
  const rawEnv = process.env.STAGING_PREVIEW_URL;
  const previewBaseUrl = normalizePreviewBaseUrl(rawEnv || DEFAULT_PREVIEW_URL);
  logInfo(`[debug] raw STAGING_PREVIEW_URL: ${rawEnv ?? "(unset)"}`);
  logInfo(`[debug] DEFAULT_PREVIEW_URL: ${DEFAULT_PREVIEW_URL}`);
  logInfo(`[debug] normalized previewBaseUrl: ${previewBaseUrl}`);
  return previewBaseUrl;
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

function createLocalStorageMock() {
  const store = new Map();
  return {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(key, String(value));
    },
    removeItem(key) {
      store.delete(key);
    },
    clear() {
      store.clear();
    },
  };
}

function tenantValues(rows, column) {
  return [...new Set((rows || []).map((row) => row[column]).filter(Boolean))];
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

function logBlockedPreviewRequest(method, url, res, bodyText) {
  const contentType = res?.headers?.get?.("content-type") || "—";
  const protectionHtml = isVercelProtectionHtml(bodyText);
  logWarn("Preview HTTP BLOCKED:");
  logWarn(`  method: ${method}`);
  logWarn(`  url: ${url}`);
  logWarn(`  status: ${res?.status ?? "—"}`);
  logWarn(`  content-type: ${contentType}`);
  logWarn(`  bypass-header-sent: ${Boolean(getBypassSecret())}`);
  logWarn(`  vercel-sso-html: ${protectionHtml}`);
  logWarn(`  body-snippet: ${redactSecrets(bodySnippet(bodyText))}`);
  if (getBypassSecret() && protectionHtml) {
    logWarn(
      "  hint: bypass header sent but Vercel SSO HTML returned — verify secret in Project Settings → Deployment Protection"
    );
  }
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

async function probeApiKeysSchema(url, serviceKey) {
  logInfo("\n--- A. api_keys schema (service role — no secrets logged) ---\n");

  if (!serviceKey) {
    for (const col of [...REQUIRED_COLUMNS, "indexes"]) {
      record(`schema:${col}`, "exists", "missing service role", "NOT_APPLICABLE");
    }
    logWarn("Thiếu SUPABASE_SERVICE_ROLE_KEY — bỏ qua schema probes");
    return;
  }

  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const selectCols = ["id", ...REQUIRED_COLUMNS].join(", ");
  const { error: colError } = await admin.from("api_keys").select(selectCols).limit(1);
  if (colError) {
    const missingCol = REQUIRED_COLUMNS.find((c) => colError.message?.includes(c));
    if (missingCol || colError.code === "42703") {
      record("schema:columns", "all required columns", colError.message, "FAIL");
      logWarn(`api_keys columns: FAIL (${colError.code || "error"})`);
    } else {
      record("schema:columns", "queryable", colError.message, "FAIL");
      logWarn(`api_keys columns: FAIL (${colError.code || "error"})`);
    }
  } else {
    record("schema:columns", REQUIRED_COLUMNS.join(", "), "present", "PASS");
    logOk(`api_keys columns: PASS (${REQUIRED_COLUMNS.join(", ")})`);
  }

  const { error: filterError } = await admin
    .from("api_keys")
    .select("id")
    .eq("key_prefix", "pk_probe")
    .eq("tenant_id", TENANT_A)
    .eq("status", "active")
    .limit(1);
  if (filterError) {
    record("schema:indexes", EXPECTED_INDEXES.join(", "), filterError.message, "FAIL");
    logWarn(`api_keys index columns: FAIL (${filterError.code || "error"})`);
    return;
  }

  const accessToken = String(process.env.SUPABASE_ACCESS_TOKEN || "").trim();
  if (!accessToken) {
    record("schema:indexes", EXPECTED_INDEXES.join(", "), "column filters OK", "PASS");
    logOk("api_keys indexes: PASS (column filters OK; index names not introspected without SUPABASE_ACCESS_TOKEN)");
    return;
  }

  const indexRes = await httpFetch(`https://api.supabase.com/v1/projects/${STAGING_REF}/database/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query: `select indexname from pg_indexes where schemaname = 'public' and tablename = 'api_keys'`,
    }),
  });
  if (!indexRes.ok) {
    record("schema:indexes", EXPECTED_INDEXES.join(", "), "column filters OK", "PASS");
    logOk("api_keys indexes: PASS (column filters OK; Management API query failed)");
    return;
  }

  const payload = await indexRes.json();
  const names = (Array.isArray(payload) ? payload : payload?.result || [])
    .map((row) => row.indexname)
    .filter(Boolean);
  const missing = EXPECTED_INDEXES.filter((name) => !names.includes(name));
  if (missing.length > 0) {
    record("schema:indexes", EXPECTED_INDEXES.join(", "), `missing ${missing.join(", ")}`, "FAIL");
    logWarn(`api_keys indexes: FAIL (missing ${missing.join(", ")})`);
    return;
  }

  record("schema:indexes", EXPECTED_INDEXES.join(", "), "present", "PASS");
  logOk(`api_keys indexes: PASS (${EXPECTED_INDEXES.join(", ")})`);
}

async function seedSupabaseProbeKey(admin, { tenantId, scopes, label, expiresAt = null, status = "active" }) {
  const { plainKey, prefix, hashedKey } = await generateApiKey();
  trackSecret(plainKey);

  const clientInsert = await admin
    .from("api_clients")
    .insert({
      name: `Phase11C Probe ${label}`,
      tenant_id: tenantId,
      status: "active",
    })
    .select("id")
    .single();

  if (clientInsert.error) {
    return { ok: false, error: clientInsert.error.message, plainKey: null };
  }

  const keyInsert = await admin
    .from("api_keys")
    .insert({
      client_id: clientInsert.data.id,
      tenant_id: tenantId,
      key_prefix: prefix,
      hashed_key: hashedKey,
      scopes,
      status,
      expires_at: expiresAt,
    })
    .select("id, key_prefix, tenant_id, status")
    .single();

  if (keyInsert.error) {
    await admin.from("api_clients").delete().eq("id", clientInsert.data.id);
    return { ok: false, error: keyInsert.error.message, plainKey: null };
  }

  return {
    ok: true,
    plainKey,
    prefix,
    keyId: keyInsert.data.id,
    clientId: clientInsert.data.id,
    tenantId,
  };
}

async function cleanupSupabaseProbe(admin, ids) {
  if (!admin || !ids?.keyId) return;
  await admin.from("api_keys").delete().eq("id", ids.keyId);
  if (ids.clientId) {
    await admin.from("api_clients").delete().eq("id", ids.clientId);
  }
}

async function probePreviewDeployment(previewBaseUrl) {
  logInfo("\n--- B. Preview deployment probe ---\n");

  if (!previewBaseUrl) {
    record("preview:url", "STAGING_PREVIEW_URL set", "missing", "BLOCKED");
    logWarn("Thiếu STAGING_PREVIEW_URL — bỏ qua Preview HTTP tests");
    return { baseUrl: null, apiReady: false, commitHint: null };
  }

  record("preview:url", "configured", previewBaseUrl, "PASS");
  logInfo(`Preview URL: ${previewBaseUrl}`);
  if (previewBaseUrl.endsWith(".vercel.appp")) {
    logWarn(
      "Preview base URL ends with .vercel.appp — kiểm tra STAGING_PREVIEW_URL (hostname không được sửa trong script)"
    );
  }

  const bypass = getBypassSecret();
  if (!bypass) {
    logWarn(
      "Không có VERCEL_AUTOMATION_BYPASS_SECRET — Preview có Deployment Protection có thể trả HTML thay vì JSON"
    );
  } else {
    logInfo(`Vercel bypass header: set (length ${bypass.length})`);
  }

  const healthUrl = buildPreviewUrl(previewBaseUrl, "/api/v1/health");
  logInfo(`[debug] fetch URL: ${healthUrl}`);
  let healthRes;
  let bodyText;
  try {
    const health = await previewHttpRequest(healthUrl, buildPreviewFetchInit({ method: "GET" }));
    healthRes = health.res;
    bodyText = health.text;
  } catch (error) {
    logPreviewFetchError(error, { method: "GET", url: healthUrl });
    const networkError = isPreviewFetchNetworkError(error);
    const bodyReadError = error?.phase === "body";
    const verdict = networkError || bodyReadError ? "FAIL" : "BLOCKED";
    const detail = bodyReadError
      ? `response body read failed (${error.message})`
      : networkError
        ? `network error (${error.message})`
        : error.message;
    record("preview:health", "JSON 200 ok:true", detail, verdict);
    if (networkError && healthUrl.includes("/api//")) {
      logWarn("  hint: malformed path — expected /api/v1/* not /api//v1/*");
    }
    return { baseUrl: previewBaseUrl, apiReady: false, commitHint: null };
  }

  const { jsonApi, json: parsedHealth, protectionHtml, jsonParseError } = classifyPreviewResponse(healthRes, bodyText);
  const commitHeader =
    healthRes.headers.get("x-vercel-git-commit-sha") ||
    healthRes.headers.get("x-deployment-sha") ||
    null;

  if (!jsonApi) {
    logBlockedPreviewRequest("GET", healthUrl, healthRes, bodyText);
    const reason = protectionHtml
      ? `Vercel Deployment Protection HTML (${healthRes.status}) — check VERCEL_AUTOMATION_BYPASS_SECRET`
      : `HTML/non-JSON (${healthRes.status}) — redeploy ${EXPECTED_COMMIT} + VITE_API_ENABLED=true`;
    record("preview:health", "JSON 200 ok:true", reason, "BLOCKED", healthRes.status);
    return { baseUrl: previewBaseUrl, apiReady: false, commitHint: commitHeader, protectionBlocked: protectionHtml };
  }

  const body = parsedHealth;
  if (parsedHealth === null && jsonParseError) {
    record("preview:health", "JSON 200 ok:true", "JSON parse error", "FAIL", healthRes.status);
    return { baseUrl: previewBaseUrl, apiReady: false, commitHint: commitHeader };
  }
  if (!body) {
    record("preview:health", "JSON 200 ok:true", "invalid JSON", "FAIL", healthRes.status);
    return { baseUrl: previewBaseUrl, apiReady: false, commitHint: commitHeader };
  }

  const healthPass = healthRes.status === 200 && body?.ok === true;
  record(
    "preview:health",
    "200 ok:true",
    healthPass ? "ok" : `status=${healthRes.status} ok=${body?.ok}`,
    healthPass ? "PASS" : "FAIL",
    healthRes.status,
    body?.code || "—"
  );
  if (healthPass) {
    logOk("Preview GET /api/v1/health: PASS");
  } else {
    logWarn(`Preview GET /api/v1/health: FAIL (${healthRes.status})`);
  }

  if (commitHeader) {
    const commitOk = String(commitHeader).startsWith(EXPECTED_COMMIT);
    record(
      "preview:commit",
      EXPECTED_COMMIT,
      commitHeader.slice(0, 7),
      commitOk ? "PASS" : "NOT_APPLICABLE",
      "—",
      "—"
    );
    logInfo(`Preview commit header: ${commitHeader.slice(0, 7)}`);
  } else {
    record("preview:commit", EXPECTED_COMMIT, "header unavailable", "NOT_APPLICABLE");
    logInfo(`Preview commit header unavailable — expected ${EXPECTED_COMMIT} (verify in Vercel dashboard)`);
  }

  return { baseUrl: previewBaseUrl, apiReady: healthPass, commitHint: commitHeader };
}

async function callPreview(baseUrl, { method = "GET", path, apiKey = null, body = null } = {}) {
  const url = buildPreviewUrl(baseUrl, path);
  logInfo(`[debug] fetch URL: ${url}`);
  try {
    const { res, text } = await previewHttpRequest(
      url,
      buildPreviewFetchInit({ method, apiKey, body })
    );
    const { jsonApi, json, protectionHtml } = classifyPreviewResponse(res, text);
    return {
      res,
      text,
      json,
      jsonApi,
      protectionHtml,
      url,
      method,
      fetchError: null,
      bodyReadError: null,
    };
  } catch (error) {
    return {
      res: null,
      text: "",
      json: null,
      jsonApi: false,
      protectionHtml: false,
      url,
      method,
      fetchError: error?.phase === "fetch" ? error : null,
      bodyReadError: error?.phase === "body" ? error : null,
      transportError: error,
    };
  }
}

const PHASE_11D_PREVIEW_TESTS = [
  "valid key",
  "missing scope",
  "valid scope",
  "wrong tenant",
  "revoked key",
  "expired key",
  "rate limit",
  "webhook read",
  "webhook write denied",
  "webhook write ok",
];

function recordPreviewProtectionBlocked(testName, result, reason) {
  logBlockedPreviewRequest(result.method, result.url, result.res, result.text);
  record(`preview:${testName}`, "HTTP verify", reason, "BLOCKED", result.res?.status ?? "—", "—");
}

function recordPreviewTransportError(testName, result, expected) {
  const error = result.transportError || result.fetchError || result.bodyReadError;
  logPreviewFetchError(error, { method: result.method, url: result.url });
  const networkError = isPreviewFetchNetworkError(error);
  const bodyReadError = error?.phase === "body";
  const detail = bodyReadError
    ? `response body read failed — ${error.message}`
    : networkError
      ? `network error — ${error.message}`
      : error?.message || "transport error";
  record(`preview:${testName}`, expected, detail, networkError || bodyReadError ? "FAIL" : "BLOCKED");
}

async function runPreviewHttpTests(baseUrl) {
  logInfo("\n--- C. Preview HTTP API key guard ---\n");

  if (!baseUrl) {
    for (const name of ["not found", "missing key", "invalid key", ...PHASE_11D_PREVIEW_TESTS]) {
      record(`preview:${name}`, "HTTP verify", "no preview URL", "BLOCKED");
    }
    return;
  }

  const protectionReason =
    "Vercel Deployment Protection — set VERCEL_AUTOMATION_BYPASS_SECRET or verify in browser";

  const notFound = await callPreview(baseUrl, { path: "/api/v1/does-not-exist-route" });
  if (notFound.transportError) {
    recordPreviewTransportError("not found", notFound, "404 not_found");
  } else if (!notFound.jsonApi) {
    recordPreviewProtectionBlocked(
      "not found",
      notFound,
      notFound.protectionHtml ? protectionReason : `non-JSON (${notFound.res.status})`
    );
  } else {
    const notFoundPass =
      notFound.res.status === 404 && notFound.json?.code === EDGE_API_ERROR_CODES.NOT_FOUND;
    record(
      "preview:not found",
      "404 not_found",
      notFoundPass ? notFound.json.code : notFound.res.status,
      notFoundPass ? "PASS" : "FAIL",
      notFound.res.status,
      notFound.json?.code || "—"
    );
    if (notFoundPass) {
      logOk("Preview GET /api/v1/does-not-exist-route: PASS");
    }
  }

  const missing = await callPreview(baseUrl, { path: "/api/v1/tenant" });
  if (missing.transportError) {
    recordPreviewTransportError("missing key", missing, "401 unauthorized");
  } else if (!missing.jsonApi) {
    recordPreviewProtectionBlocked(
      "missing key",
      missing,
      missing.protectionHtml ? protectionReason : `non-JSON (${missing.res.status})`
    );
  } else {
    const missingPass =
      missing.res.status === 401 && missing.json?.code === EDGE_API_ERROR_CODES.UNAUTHORIZED;
    record(
      "preview:missing key",
      "401 unauthorized",
      missingPass ? missing.json.code : missing.res.status,
      missingPass ? "PASS" : "FAIL",
      missing.res.status,
      missing.json?.code || "—"
    );
    if (missingPass) {
      logOk("Preview GET /api/v1/tenant (no key): PASS");
    }
  }

  const invalid = await callPreview(baseUrl, {
    path: "/api/v1/tenant",
    apiKey: "pk_invalid.notarealkey000000000000000000000000",
  });
  if (invalid.transportError) {
    recordPreviewTransportError("invalid key", invalid, "401 invalid_api_key");
  } else if (!invalid.jsonApi) {
    recordPreviewProtectionBlocked(
      "invalid key",
      invalid,
      invalid.protectionHtml ? protectionReason : `non-JSON (${invalid.res.status})`
    );
  } else {
    const invalidPass =
      invalid.res.status === 401 &&
      [EDGE_API_ERROR_CODES.INVALID_API_KEY, EDGE_API_ERROR_CODES.UNAUTHORIZED].includes(
        invalid.json?.code
      );
    record(
      "preview:invalid key",
      "401 invalid_api_key",
      invalidPass ? invalid.json.code : invalid.res.status,
      invalidPass ? "PASS" : "FAIL",
      invalid.res.status,
      invalid.json?.code || "—"
    );
    if (invalidPass) {
      logOk("Preview GET /api/v1/tenant (invalid key): PASS");
    }
  }

  const deferredReason =
    "Phase 11D — Supabase-backed key lookup on serverless Preview (covered by §D in-memory edge)";
  for (const name of PHASE_11D_PREVIEW_TESTS) {
    record(`preview:${name}`, "HTTP verify", deferredReason, "NOT_APPLICABLE");
  }
  logInfo(`Preview valid-key/scenario HTTP: NOT_APPLICABLE (${PHASE_11D_PREVIEW_TESTS.length} tests — Phase 11D)`);
}

async function runInMemoryEdgeTests() {
  logInfo("\n--- D. In-memory edge invoke (same router as Vercel) ---\n");

  globalThis.localStorage = createLocalStorageMock();
  process.env.VITE_API_ENABLED = "true";
  clearApiStorage();
  clearApiKeyAuditStorage();
  resetRateLimitCounters();

  const health = await invokeEdgeApi({ method: "GET", path: "/api/v1/health" });
  record(
    "edge:public health",
    "200 ok:true",
    health.body?.ok ? "ok" : health.body?.code,
    health.statusCode === 200 && health.body?.ok === true ? "PASS" : "FAIL",
    health.statusCode,
    health.body?.code
  );

  const missing = await invokeEdgeApi({ method: "GET", path: "/api/v1/tenant" });
  record(
    "edge:missing key",
    "401 unauthorized",
    missing.body?.code,
    missing.statusCode === 401 && missing.body?.code === EDGE_API_ERROR_CODES.UNAUTHORIZED ? "PASS" : "FAIL",
    missing.statusCode,
    missing.body?.code
  );

  const invalid = await invokeEdgeApi({
    method: "GET",
    path: "/api/v1/tenant",
    headers: { "x-api-key": "pk_badformat" },
  });
  record(
    "edge:invalid key",
    "401 invalid_api_key",
    invalid.body?.code,
    invalid.statusCode === 401 && invalid.body?.code === EDGE_API_ERROR_CODES.INVALID_API_KEY ? "PASS" : "FAIL",
    invalid.statusCode,
    invalid.body?.code
  );

  const notFound = await invokeEdgeApi({ method: "GET", path: "/api/v1/does-not-exist-route" });
  record(
    "edge:not found",
    "404 not_found",
    notFound.body?.code,
    notFound.statusCode === 404 && notFound.body?.code === EDGE_API_ERROR_CODES.NOT_FOUND ? "PASS" : "FAIL",
    notFound.statusCode,
    notFound.body?.code
  );

  const keyTenantRead = await createApiClientWithKey({
    name: "Staging Tenant A Read",
    tenantId: TENANT_A,
    scopes: [API_SCOPES.TENANT_READ],
  });
  trackSecret(keyTenantRead.plainKey);

  const validTenant = await invokeEdgeApi({
    method: "GET",
    path: "/api/v1/tenant",
    headers: { "x-api-key": keyTenantRead.plainKey },
  });
  const validTenantPass =
    validTenant.statusCode === 200 &&
    validTenant.body?.ok === true &&
    validTenant.body?.data?.tenantId === TENANT_A;
  record(
    "edge:valid key",
    "200 tenant A",
    validTenantPass ? TENANT_A : validTenant.body?.data?.tenantId,
    validTenantPass ? "PASS" : "FAIL",
    validTenant.statusCode,
    validTenant.body?.code
  );

  const keyReadOnly = await createApiClientWithKey({
    name: "Staging Read Only",
    tenantId: TENANT_A,
    scopes: [API_SCOPES.TENANT_READ],
  });
  trackSecret(keyReadOnly.plainKey);

  const missingScope = await invokeEdgeApi({
    method: "GET",
    path: "/api/v1/integrations",
    headers: { "x-api-key": keyReadOnly.plainKey },
  });
  record(
    "edge:missing scope",
    "403 scope_denied",
    missingScope.body?.code,
    missingScope.statusCode === 403 && missingScope.body?.code === EDGE_API_ERROR_CODES.SCOPE_DENIED
      ? "PASS"
      : "FAIL",
    missingScope.statusCode,
    missingScope.body?.code
  );

  const keyIntegrations = await createApiClientWithKey({
    name: "Staging Integrations",
    tenantId: TENANT_A,
    scopes: [API_SCOPES.TENANT_READ, API_SCOPES.INTEGRATIONS_READ],
  });
  trackSecret(keyIntegrations.plainKey);

  const validScope = await invokeEdgeApi({
    method: "GET",
    path: "/api/v1/integrations",
    headers: { "x-api-key": keyIntegrations.plainKey },
  });
  const validScopePass =
    validScope.statusCode === 200 &&
    validScope.body?.ok === true &&
    validScope.body?.data?.tenantId === TENANT_A;
  record(
    "edge:valid scope",
    "200 integrations tenant A",
    validScopePass ? "ok" : validScope.body?.code,
    validScopePass ? "PASS" : "FAIL",
    validScope.statusCode,
    validScope.body?.code
  );

  const keyB = await createApiClientWithKey({
    name: "Staging Tenant B",
    tenantId: TENANT_B,
    scopes: [API_SCOPES.TENANT_READ],
  });
  trackSecret(keyB.plainKey);

  const wrongTenantA = await invokeEdgeApi({
    method: "GET",
    path: "/api/v1/tenant",
    query: { tenantId: TENANT_B },
    headers: { "x-api-key": keyTenantRead.plainKey },
  });
  const wrongTenantB = await invokeEdgeApi({
    method: "GET",
    path: "/api/v1/tenant",
    query: { tenantId: TENANT_A },
    headers: { "x-api-key": keyB.plainKey },
  });
  const wrongPass =
    wrongTenantA.statusCode === 403 &&
    wrongTenantA.body?.code === EDGE_API_ERROR_CODES.TENANT_NOT_FOUND &&
    wrongTenantB.statusCode === 403 &&
    wrongTenantB.body?.code === EDGE_API_ERROR_CODES.TENANT_NOT_FOUND;
  record(
    "edge:wrong tenant",
    "403 tenant_not_found",
    wrongPass ? "blocked both directions" : "mismatch",
    wrongPass ? "PASS" : "FAIL",
    wrongTenantA.statusCode,
    wrongTenantA.body?.code
  );

  const revokedKey = await createApiClientWithKey({
    name: "Staging Revoked",
    tenantId: TENANT_A,
    scopes: [API_SCOPES.TENANT_READ],
  });
  trackSecret(revokedKey.plainKey);
  revokeApiKey(revokedKey.apiKey.id);
  const revoked = await invokeEdgeApi({
    method: "GET",
    path: "/api/v1/tenant",
    headers: { "x-api-key": revokedKey.plainKey },
  });
  record(
    "edge:revoked key",
    "401 invalid_api_key",
    revoked.body?.code,
    revoked.statusCode === 401 && revoked.body?.code === EDGE_API_ERROR_CODES.INVALID_API_KEY ? "PASS" : "FAIL",
    revoked.statusCode,
    revoked.body?.code
  );

  const expiredKey = await createApiClientWithKey({
    name: "Staging Expired",
    tenantId: TENANT_A,
    scopes: [API_SCOPES.TENANT_READ],
  });
  trackSecret(expiredKey.plainKey);
  const keys = loadApiKeys();
  const expiredIdx = keys.findIndex((k) => k.id === expiredKey.apiKey.id);
  if (expiredIdx >= 0) {
    keys[expiredIdx] = {
      ...keys[expiredIdx],
      expiresAt: new Date(Date.now() - 60_000).toISOString(),
    };
    saveApiKeys(keys);
  }
  const expired = await invokeEdgeApi({
    method: "GET",
    path: "/api/v1/tenant",
    headers: { "x-api-key": expiredKey.plainKey },
  });
  record(
    "edge:expired key",
    "401 invalid_api_key",
    expired.body?.code,
    expired.statusCode === 401 && expired.body?.code === EDGE_API_ERROR_CODES.INVALID_API_KEY ? "PASS" : "FAIL",
    expired.statusCode,
    expired.body?.code
  );

  const rateKey = await createApiClientWithKey({
    name: "Staging Rate",
    tenantId: TENANT_A,
    scopes: [API_SCOPES.TENANT_READ],
  });
  trackSecret(rateKey.plainKey);
  const rateHeaders = { "x-api-key": rateKey.plainKey };
  const rateLimits = { requestsPerMinute: 1 };
  await invokeEdgeApi({ method: "GET", path: "/api/v1/tenant", headers: rateHeaders, rateLimits });
  const rateLimited = await invokeEdgeApi({
    method: "GET",
    path: "/api/v1/tenant",
    headers: rateHeaders,
    rateLimits,
  });
  const ratePass =
    rateLimited.statusCode === 429 && rateLimited.body?.code === EDGE_API_ERROR_CODES.RATE_LIMITED;
  record(
    "edge:rate limit",
    "429 rate_limited + X-RateLimit-*",
    ratePass ? "rate_limited" : rateLimited.body?.code,
    ratePass ? "PASS" : "FAIL",
    rateLimited.statusCode,
    rateLimited.body?.code
  );

  const webhookKey = await createApiClientWithKey({
    name: "Staging Webhooks",
    tenantId: TENANT_A,
    scopes: [API_SCOPES.WEBHOOKS_READ, API_SCOPES.WEBHOOKS_WRITE],
  });
  trackSecret(webhookKey.plainKey);

  const webhookRead = await invokeEdgeApi({
    method: "GET",
    path: "/api/v1/webhooks/test",
    headers: { "x-api-key": webhookKey.plainKey },
  });
  record(
    "edge:webhook read",
    "200 ok",
    webhookRead.body?.ok ? "ok" : webhookRead.body?.code,
    webhookRead.statusCode === 200 && webhookRead.body?.ok === true ? "PASS" : "FAIL",
    webhookRead.statusCode,
    webhookRead.body?.code
  );

  const webhookReadOnly = await createApiClientWithKey({
    name: "Staging Webhook ReadOnly",
    tenantId: TENANT_A,
    scopes: [API_SCOPES.WEBHOOKS_READ],
  });
  trackSecret(webhookReadOnly.plainKey);

  const webhookWriteDenied = await invokeEdgeApi({
    method: "POST",
    path: "/api/v1/webhooks/test",
    headers: { "x-api-key": webhookReadOnly.plainKey },
    body: { eventType: "test.ping" },
  });
  record(
    "edge:webhook write denied",
    "403 scope_denied",
    webhookWriteDenied.body?.code,
    webhookWriteDenied.statusCode === 403 &&
      webhookWriteDenied.body?.code === EDGE_API_ERROR_CODES.SCOPE_DENIED
      ? "PASS"
      : "FAIL",
    webhookWriteDenied.statusCode,
    webhookWriteDenied.body?.code
  );

  const webhookWriteOk = await invokeEdgeApi({
    method: "POST",
    path: "/api/v1/webhooks/test",
    headers: { "x-api-key": webhookKey.plainKey },
    body: { eventType: "test.ping", payload: { probe: true } },
  });
  record(
    "edge:webhook write ok",
    "200 accepted mock",
    webhookWriteOk.body?.ok ? "accepted" : webhookWriteOk.body?.code,
    webhookWriteOk.statusCode === 200 && webhookWriteOk.body?.data?.accepted === true ? "PASS" : "FAIL",
    webhookWriteOk.statusCode,
    webhookWriteOk.body?.code
  );

  const listed = listApiKeys({ tenantId: TENANT_A });
  const listSafe = listed.every((k) => k.hashedKey === undefined);
  record("edge:listApiKeys safety", "no hashed_key", listSafe ? "sanitized" : "leak", listSafe ? "PASS" : "FAIL");

  const auditBlob = JSON.stringify(listApiKeyAuditEvents({ tenantId: TENANT_A }));
  const auditSafe = !secretFingerprints.some((s) => auditBlob.includes(s));
  record("edge:audit safety", "no raw key", auditSafe ? "clean" : "leak", auditSafe ? "PASS" : "FAIL");

  const hashOnly = await hashApiKey(keyB.plainKey);
  const hashSafe = !String(hashOnly).includes(keyB.plainKey.split(".")[1]);
  record("edge:hash safety", "hash != secret", hashSafe ? "ok" : "leak", hashSafe ? "PASS" : "FAIL");
}

async function probeApiKeysRls(client, ownTenantId, otherTenantId, label) {
  if (!client) {
    record(`rls:${label}`, "tenant isolated", "missing JWT", "NOT_APPLICABLE");
    logWarn(`${label}: sign-in skipped`);
    return;
  }

  const { data, error } = await client
    .from("api_keys")
    .select("id, tenant_id, key_prefix, status, expires_at, hashed_key")
    .limit(50);

  if (error) {
    if (error.message?.includes("does not exist") || error.code === "42P01") {
      record(`rls:${label}`, "tenant isolated", "table missing", "NOT_APPLICABLE");
      logWarn(`${label}: api_keys MISSING`);
      return;
    }
    record(`rls:${label}`, "tenant isolated", error.message, "BLOCKED");
    logOk(`${label}: api_keys blocked (${error.code || "RLS"})`);
    return;
  }

  const tenants = tenantValues(data, "tenant_id");
  if (otherTenantId && tenants.includes(otherTenantId)) {
    record(`rls:${label}`, "no cross-tenant", `leak ${otherTenantId}`, "FAIL");
    logWarn(`${label}: api_keys LEAK other tenant`);
    return;
  }
  if (tenants.length > 0 && !tenants.every((id) => id === ownTenantId)) {
    record(`rls:${label}`, "no cross-tenant", tenants.join(","), "FAIL");
    logWarn(`${label}: api_keys foreign tenant leak`);
    return;
  }

  const exposesHash = (data || []).some((row) => row.hashed_key);
  if (exposesHash) {
    record(`rls:${label}`, "no hashed_key in JWT select", "hashed_key visible", "PARTIAL");
    logWarn(`${label}: hashed_key visible via select — review column exposure`);
  } else {
    record(`rls:${label}`, "tenant isolated", `${(data || []).length} rows`, "PASS");
    logOk(`${label}: api_keys isolated (${(data || []).length} rows)`);
  }
}

async function probeSupabaseSeededKeyRls(url, serviceKey, ownerAClient) {
  logInfo("\n--- E. Supabase seeded key RLS (service role setup only) ---\n");

  if (!serviceKey || !ownerAClient) {
    record("rls:seeded key", "Owner A sees tenant A only", "missing service/JWT", "NOT_APPLICABLE");
    return;
  }

  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const seeded = await seedSupabaseProbeKey(admin, {
    tenantId: TENANT_A,
    scopes: [API_SCOPES.TENANT_READ],
    label: "RLS-A",
  });

  if (!seeded.ok) {
    record("rls:seeded key", "insert ok", seeded.error, "BLOCKED");
    logWarn(`Supabase seed key: BLOCKED (${seeded.error})`);
    return;
  }

  const { data, error } = await ownerAClient
    .from("api_keys")
    .select("id, tenant_id, key_prefix, status")
    .eq("key_prefix", seeded.prefix)
    .maybeSingle();

  if (error) {
    record("rls:seeded key", "Owner A read own key", error.message, "FAIL");
  } else if (!data || data.tenant_id !== TENANT_A) {
    record("rls:seeded key", "Owner A read own key", "not found/wrong tenant", "FAIL");
  } else {
    record("rls:seeded key", "Owner A read own key", data.key_prefix, "PASS");
    logOk("Owner A reads seeded api_keys row: PASS");
  }

  await cleanupSupabaseProbe(admin, seeded);
}

function runRbacProbe(profile, label) {
  if (!profile?.id) {
    record(`rbac:${label}`, "api.manage gate", "missing profile", "NOT_APPLICABLE");
    return null;
  }
  const user = normalizeUser({
    id: profile.id,
    email: profile.email,
    role: profile.role,
    venueId: profile.venue_id,
    tenantId: profile.venue_id,
    clubId: profile.club_id,
    status: profile.status,
  });
  const rbac = { rbacEnabled: true };
  const scope = { venueId: profile.venue_id, tenantId: profile.venue_id };
  const apiManage = can(user, PERMISSIONS.API_MANAGE, scope, rbac);
  return { apiManage, label };
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
  console.log(widths.map((w) => "-".repeat(w)).join("-|-"));
  for (const row of rows) {
    console.log(formatRow(row));
  }
}

function assertNoSecretLeakInOutput() {
  for (const secret of secretFingerprints) {
    if (capturedOutput.includes(secret)) {
      record("output:raw key safety", "no secret in stdout", "leaked", "FAIL");
      return false;
    }
  }
  record("output:raw key safety", "no secret in stdout", "clean", "PASS");
  return true;
}

function summarize(previewMeta) {
  assertNoSecretLeakInOutput();
  printResultsTable();

  const passed = results.filter((r) => r.verdict === "PASS").length;
  const failed = results.filter((r) => r.verdict === "FAIL").length;
  const blocked = results.filter((r) => r.verdict === "BLOCKED").length;
  const partial = results.filter((r) => r.verdict === "PARTIAL").length;
  const skipped = results.filter((r) => r.verdict === "NOT_APPLICABLE").length;

  console.log("\n=== Summary ===");
  console.log(`PASS: ${passed}`);
  console.log(`FAIL: ${failed}`);
  console.log(`BLOCKED: ${blocked}`);
  console.log(`PARTIAL: ${partial}`);
  if (skipped > 0) {
    console.log(`NOT_APPLICABLE: ${skipped}`);
  }

  if (previewMeta?.baseUrl) {
    console.log(`\nPreview URL tested: ${previewMeta.baseUrl}`);
  }
  if (previewMeta?.commitHint) {
    console.log(`Preview commit header: ${previewMeta.commitHint.slice(0, 7)}`);
  } else {
    console.log(`Expected Preview commit: ${EXPECTED_COMMIT} (verify in Vercel dashboard)`);
  }

  const blockedPreview = results.filter(
    (r) => r.verdict === "BLOCKED" && String(r.test).startsWith("preview:")
  );
  if (blockedPreview.length > 0) {
    console.log("\n=== Blocked Preview endpoints ===");
    for (const row of blockedPreview) {
      console.log(`- ${row.test}: ${redactSecrets(String(row.actual))}`);
    }
  }

  let verdict = "PASS";
  if (failed > 0) {
    verdict = "FAIL";
  } else if (blocked > 0) {
    verdict = "PARTIAL";
  } else if (partial > 0) {
    verdict = "PARTIAL";
  }

  console.log(`\nPhase 11C staging verify: ${verdict}`);

  if (verdict === "FAIL") {
    process.exit(1);
  }
}

async function main() {
  const originalLog = console.log;
  console.log = (...args) => {
    capturedOutput += `${args.map((a) => String(a)).join(" ")}\n`;
    originalLog(...args);
  };

  console.log("=== Phase 11C — Edge API Key Guard Staging Verify ===\n");

  loadProjectEnv();
  const previewBaseUrl = resolvePreviewBaseUrl();
  const { url, anonKey } = getSupabaseEnv();

  let previewMeta = { baseUrl: previewBaseUrl, apiReady: false, commitHint: null, protectionBlocked: false };
  previewMeta = await probePreviewDeployment(previewBaseUrl);
  await runPreviewHttpTests(previewMeta.baseUrl);

  await runInMemoryEdgeTests();

  if (!url || !anonKey) {
    logWarn("Thiếu Supabase env — bỏ qua schema/RLS probes");
    summarize(previewMeta);
    return;
  }

  if (!String(url).includes(STAGING_REF)) {
    logWarn(`URL không phải staging ${STAGING_REF} — bỏ qua Supabase probes`);
    summarize(previewMeta);
    return;
  }

  const serviceKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  await probeApiKeysSchema(url, serviceKey);

  logInfo("\n--- F. Staging JWT RLS probes ---\n");

  const ownerA = await signInStagingUser(process.env.STAGING_OWNER_A_EMAIL || "owner@staging.local");
  const ownerB = await signInStagingUser(process.env.STAGING_OWNER_B_EMAIL || "owner-b@staging.local");
  const player = await signInStagingUser(process.env.STAGING_PLAYER_EMAIL || "player@staging.local");

  if (ownerA.error) {
    logWarn(`Owner A sign-in skipped: ${ownerA.error}`);
  } else {
    logOk(`Owner A: ${ownerA.profile?.email} @ ${ownerA.profile?.venue_id}`);
  }
  if (ownerB.error) {
    logWarn(`Owner B sign-in skipped: ${ownerB.error}`);
  } else {
    logOk(`Owner B: ${ownerB.profile?.email} @ ${ownerB.profile?.venue_id}`);
  }
  if (player.error) {
    logWarn(`Player sign-in skipped: ${player.error}`);
  } else {
    logOk(`Player: ${player.profile?.email} @ ${player.profile?.venue_id}`);
  }

  await probeApiKeysRls(ownerA.client, TENANT_A, TENANT_B, "Owner A");
  await probeApiKeysRls(ownerB.client, TENANT_B, TENANT_A, "Owner B");
  await probeApiKeysRls(player.client, player.profile?.venue_id, TENANT_A, "PLAYER");

  await probeSupabaseSeededKeyRls(url, serviceKey, ownerA.client);

  const rbacA = runRbacProbe(ownerA.profile, "Owner A");
  const rbacP = runRbacProbe(player.profile, "PLAYER");
  if (rbacA && rbacA.apiManage) {
    record("rbac:Owner A", "api.manage allowed", "allowed", "PASS");
    logOk("Owner A API manage: PASS");
  } else if (rbacA) {
    record("rbac:Owner A", "api.manage allowed", "denied", "FAIL");
    logWarn("Owner A API manage: FAIL");
  }
  if (rbacP && rbacP.apiManage) {
    record("rbac:PLAYER", "api.manage denied", "allowed", "FAIL");
    logWarn("PLAYER API manage: UNEXPECTEDLY allowed");
  } else if (rbacP) {
    record("rbac:PLAYER", "api.manage denied", "blocked", "PASS");
    logOk("PLAYER API manage: BLOCKED");
  }

  summarize(previewMeta);
}

main().catch((error) => {
  console.error(redactSecrets(error?.stack || error?.message || String(error)));
  process.exit(1);
});
