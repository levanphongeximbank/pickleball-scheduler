/**
 * Preview HTTP helpers for Phase 11C staging verify.
 * No app/src imports — captures native fetch before other modules load.
 */
export const httpFetch = globalThis.fetch.bind(globalThis);

export function normalizePreviewBaseUrl(raw) {
  let url = String(raw ?? "")
    .replace(/^\uFEFF/, "")
    .trim()
    .replace(/[\u0000-\u001F\u007F]+/g, "");

  for (let i = 0; i < 3; i += 1) {
    const trimmed = url.trim();
    if (
      (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
      (trimmed.startsWith("'") && trimmed.endsWith("'"))
    ) {
      url = trimmed.slice(1, -1).trim();
      continue;
    }
    url = trimmed;
    break;
  }

  return url.replace(/\/+$/, "");
}

export function buildPreviewUrl(baseUrl, endpoint) {
  const base = normalizePreviewBaseUrl(baseUrl);
  let path = String(endpoint ?? "").trim();
  if (!path.startsWith("/")) {
    path = `/${path}`;
  }
  path = path.replace(/\/+/g, "/");
  if (path.length > 1) {
    path = path.replace(/\/+$/, "");
  }
  return `${base}${path}`;
}

export function getBypassSecret() {
  let val = String(
    process.env.VERCEL_AUTOMATION_BYPASS_SECRET || process.env.VERCEL_PROTECTION_BYPASS || ""
  ).trim();
  if (
    (val.startsWith('"') && val.endsWith('"')) ||
    (val.startsWith("'") && val.endsWith("'"))
  ) {
    val = val.slice(1, -1).trim();
  }
  return val;
}

export function buildPreviewFetchInit({
  method = "GET",
  apiKey = null,
  body = null,
  extraHeaders = {},
} = {}) {
  const headers = {
    "x-vercel-protection-bypass": getBypassSecret(),
    ...extraHeaders,
  };
  if (apiKey) {
    headers["x-api-key"] = apiKey;
  }
  const init = { method, headers };
  if (body != null && method !== "GET" && method !== "HEAD") {
    headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(body);
  }
  return init;
}

export function describePreviewFetchHeaders(headers = {}) {
  const bypass = String(headers["x-vercel-protection-bypass"] || "");
  return {
    bypassSet: bypass.length > 0,
    bypassLength: bypass.length,
    headerNames: Object.keys(headers).sort(),
  };
}

export function enrichPreviewFetchError(error, { phase, url, headers } = {}) {
  const cause = error?.cause;
  const enriched = new Error(
    `[${phase || "fetch"}] ${error?.message || String(error)}`
  );
  enriched.name = error?.name || "Error";
  enriched.phase = phase || "fetch";
  enriched.url = url;
  enriched.headers = describePreviewFetchHeaders(headers);
  enriched.cause = cause;
  enriched.causeCode = cause?.code;
  enriched.causeHostname = cause?.hostname;
  enriched.causeAddress = cause?.address;
  return enriched;
}

export function logPreviewFetchError(error, { method = "GET", url } = {}) {
  const headers = error?.headers || {};
  console.log(`⚠️  Preview HTTP ${error?.phase || "error"}:`);
  console.log(`  method: ${method}`);
  console.log(`  url: ${url || error?.url || "—"}`);
  console.log(`  error.name: ${error?.name || "—"}`);
  console.log(`  error.message: ${error?.message || "—"}`);
  console.log(`  error.cause: ${error?.cause ? String(error.cause) : "—"}`);
  console.log(`  error.cause?.code: ${error?.causeCode ?? error?.cause?.code ?? "—"}`);
  console.log(`  error.cause?.hostname: ${error?.causeHostname ?? error?.cause?.hostname ?? "—"}`);
  console.log(`  error.cause?.address: ${error?.causeAddress ?? error?.cause?.address ?? "—"}`);
  console.log(`  bypass-header-set: ${headers.bypassSet ?? Boolean(getBypassSecret())}`);
  console.log(`  bypass-header-length: ${headers.bypassLength ?? getBypassSecret().length}`);
}

export function isPreviewFetchNetworkError(error) {
  if (!error) return false;
  if (error.phase === "body") return false;
  const message = String(error?.message || error || "");
  return (
    error?.name === "TypeError" ||
    message.includes("fetch failed") ||
    message.includes("ENOTFOUND") ||
    message.includes("getaddrinfo") ||
    message.includes("ECONNREFUSED") ||
    message.includes("ETIMEDOUT")
  );
}

/**
 * Minimal preview HTTP request — matches working Node one-liner:
 * fetch(url, { headers: { "x-vercel-protection-bypass": secret } })
 */
export async function previewHttpRequest(url, init = {}) {
  const finalUrl = String(url);
  const headers = { ...(init.headers || {}) };
  const requestInit = { ...init, headers };

  let res;
  try {
    res = await httpFetch(finalUrl, requestInit);
  } catch (error) {
    throw enrichPreviewFetchError(error, {
      phase: "fetch",
      url: finalUrl,
      headers,
    });
  }

  let text;
  try {
    text = await res.text();
  } catch (error) {
    throw enrichPreviewFetchError(error, {
      phase: "body",
      url: finalUrl,
      headers,
    });
  }

  return { res, text, url: finalUrl, method: requestInit.method || "GET" };
}
