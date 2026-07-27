/**
 * PROD-OPS-7D-01 — redacted Production SPA bundle scan.
 * Classifies VITE_RBAC_ENABLED without printing the env value.
 */
const BASE = process.env.PROD_OPS_BASE_URL || "https://pickvn.app";

function redactLong(s) {
  return String(s).replace(/[A-Za-z0-9_\-]{40,}/g, "[REDACTED_LONG]");
}

const html = await fetch(`${BASE}/`).then((r) => r.text());
const m = html.match(/assets\/index-[^"]+\.js/);
if (!m) {
  console.log(JSON.stringify({ ok: false, error: "NO_BUNDLE" }));
  process.exit(1);
}

const js = await fetch(`${BASE}/${m[0]}`).then((r) => r.text());

function countNeedle(needle) {
  let n = 0;
  let i = 0;
  while ((i = js.indexOf(needle, i)) !== -1) {
    n += 1;
    i += needle.length;
  }
  return n;
}

function serviceRoleContextsSafe(limit = 5) {
  const out = [];
  let i = 0;
  while ((i = js.indexOf("service_role", i)) !== -1 && out.length < limit) {
    const slice = js.slice(Math.max(0, i - 48), i + 48);
    // Strip any backtick-quoted env-style assignments to avoid value leakage
    const safe = redactLong(slice)
      .replace(/VITE_[A-Z0-9_]+\s*[:=]\s*[`'"][^`'"]*[`'"]/g, "VITE_*=[REDACTED]")
      .replace(/:[`'"][^`'"]{0,20}[`'"]/g, ":[REDACTED]");
    out.push(safe);
    i += "service_role".length;
  }
  return out;
}

// Detect diagnostic dump pattern: VITE_RBAC_ENABLED:`...` or VITE_RBAC_ENABLED:"..."
const diag = js.match(/VITE_RBAC_ENABLED\s*[:=]\s*[`'"]([^`'"]*)[`'"]/);
let classification = "NOT_VERIFIABLE";
let valuePrinted = false;
if (diag) {
  const raw = String(diag[1]).trim().toLowerCase();
  if (raw === "true") classification = "VERIFIED_ENABLED";
  else if (raw === "false") classification = "VERIFIED_DISABLED";
  else if (raw === "") classification = "NOT_VERIFIABLE";
  else classification = "MISCONFIGURED";
}

const result = {
  observedAtUtc: new Date().toISOString(),
  baseUrl: BASE,
  bundle: m[0],
  bundleBytes: js.length,
  viteRbacEnabledNamePresentInBundle: countNeedle("VITE_RBAC_ENABLED") > 0,
  viteRbacEnabledNameHitCount: countNeedle("VITE_RBAC_ENABLED"),
  diagnosticAssignmentPatternFound: Boolean(diag),
  viteRbacEnabledClassification: classification,
  valuePrinted,
  sourceFallbackContract: "fail-closed: PROD build defaults enabled when env unset (src/auth/config.js)",
  serviceRoleNameHitCount: countNeedle("service_role"),
  serviceRoleContextsRedacted: serviceRoleContextsSafe(),
  privateKeyPemHitCount: (js.match(/BEGIN (RSA |EC )?PRIVATE KEY/g) || []).length,
  htmlContainsViteRbacName: html.includes("VITE_RBAC_ENABLED"),
  secretsPrinted: false,
};

console.log(JSON.stringify(result, null, 2));
