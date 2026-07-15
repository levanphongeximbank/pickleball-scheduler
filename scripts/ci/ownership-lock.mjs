#!/usr/bin/env node
/**
 * Phase 44B.0 / 44B.0.1 — Ownership CI locks (CI only, no runtime dependency).
 *
 * Enforces canonical ownership boundaries for domains that are already FROZEN-LIVE
 * (Phase 44A). Two mechanisms, kept deliberately separate:
 *
 *   1. SCOPE_ALLOWLIST — explicit, permanent-ish scope exceptions for legitimate
 *      code (canonical gateways + server/serverless files under src/). Each entry is
 *      exact-file + exact-rule; NO wildcards. Edge Functions (supabase/functions/**)
 *      are NOT scanned by client rules at all (server realm), so they never need
 *      suppression.
 *
 *   2. BASELINE (scripts/ci/ownership-lock-baseline.json) — temporary DEBT only.
 *      The contract is per-(rule,file) OCCURRENCE COUNT + FINGERPRINT, so a NEW
 *      forbidden occurrence *inside an already-baselined file* is detected
 *      (count increase) and a changed occurrence is detected (fingerprint mismatch).
 *
 * Client rules scan `src/` only. Server realms are handled by scope, not baseline.
 *
 * Usage:
 *   node scripts/ci/ownership-lock.mjs          # check; exit 1 on new/changed violations
 *   node scripts/ci/ownership-lock.mjs --init   # (re)generate the debt baseline
 *   node scripts/ci/ownership-lock.mjs --report # print all current violations (no fail)
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import path from "node:path";
import { API_ERROR_CODES } from "../../src/features/api/constants/apiErrors.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
// BASELINE_PATH is overridable via OWNERSHIP_LOCK_BASELINE (used for self-tests only;
// CI uses the default committed baseline).
const BASELINE_PATH = process.env.OWNERSHIP_LOCK_BASELINE
  ? path.resolve(ROOT, process.env.OWNERSHIP_LOCK_BASELINE)
  : path.join(ROOT, "scripts", "ci", "ownership-lock-baseline.json");
const REGISTERED_CODES = new Set(Object.values(API_ERROR_CODES));

// Client rules scan the app source tree only. supabase/functions/** (Deno Edge
// Functions) is a server realm and is intentionally NOT scanned here.
const SCAN_DIRS = ["src"];
const SCAN_EXT = new Set([".js", ".jsx", ".ts", ".tsx"]);
const IGNORE_DIRS = new Set(["node_modules", "dist", ".git", "coverage"]);

/**
 * Explicit scope allowlist for legitimate (non-debt) code. Exact file + exact rule.
 * `permanent: true` = structural (canonical gateway / server-only file), no removal phase.
 */
const SCOPE_ALLOWLIST = [
  {
    rule: "auth-supabase-client-boundary",
    file: "src/auth/supabaseClient.js",
    symbol: "createClient (@supabase/supabase-js)",
    reason: "Canonical Supabase client — the single approved place to construct a client.",
    permanent: true,
  },
  {
    rule: "auth-supabase-client-boundary",
    file: "src/features/api/repositories/supabaseApiKeyRepository.js",
    symbol: "createClient with SERVICE_ROLE",
    reason:
      "Serverless API key store (Phase 11D). Uses the non-public SERVICE_ROLE key; runs server-side only, never browser-bundled with a real key.",
    permanent: true,
  },
  {
    rule: "auth-supabase-client-boundary",
    file: "src/features/api/repositories/supabaseIntegrationAuditRepository.js",
    symbol: "createClient with SERVICE_ROLE",
    reason:
      "Serverless integration audit store (Phase 11E). Uses the non-public SERVICE_ROLE key; runs server-side only.",
    permanent: true,
  },
  {
    rule: "secret-service-role-in-client-boundary",
    file: "src/features/api/config/apiKeyStoreConfig.js",
    symbol: 'readEnv("SUPABASE_SERVICE_ROLE_KEY")',
    reason: "Server config resolver for the serverless API key store (server-only env read).",
    permanent: true,
  },
  {
    rule: "secret-service-role-in-client-boundary",
    file: "src/features/api/config/auditStoreConfig.js",
    symbol: 'readEnv("SUPABASE_SERVICE_ROLE_KEY")',
    reason: "Server config resolver for the serverless audit store (server-only env read).",
    permanent: true,
  },
];

function scopeAllowFor(ruleId) {
  return SCOPE_ALLOWLIST.filter((a) => a.rule === ruleId).map((a) => a.file);
}

/**
 * Each rule: { id, description, allow[], onlyIn?[], match(content) => string[] }
 * `match` returns the list of forbidden occurrences (used for count + fingerprint).
 */
const RULES = [
  {
    id: "auth-supabase-client-boundary",
    description:
      "createClient()/@supabase/supabase-js may only be used by approved gateways/server files.",
    match: (c) => [
      ...(c.match(/createClient\s*\(/g) || []),
      ...(c.match(/from\s+["']@supabase\/supabase-js["']/g) || []),
    ],
  },
  {
    id: "profile-direct-write-boundary",
    description: "Writes to public.profiles must go through the profile/identity gateway.",
    allow: ["src/auth/profileService.js", "src/features/identity/"],
    match: (c) =>
      c.match(/\.from\(\s*["']profiles["']\s*\)[\s\S]{0,240}?\.(insert|update|upsert|delete)\s*\(/g) || [],
  },
  {
    id: "venue-direct-write-boundary",
    description: "Writes to public.venues must go through the venue service gateway.",
    allow: ["src/domain/venueService.js"],
    match: (c) =>
      c.match(/\.from\(\s*["']venues["']\s*\)[\s\S]{0,240}?\.(insert|update|upsert|delete)\s*\(/g) || [],
  },
  {
    id: "billing-direct-write-boundary",
    description: "Billing table writes must go through the billing repository gateway.",
    allow: ["src/features/billing/repositories/"],
    match: (c) =>
      c.match(
        /\.from\(\s*["'](subscriptions|tenant_subscriptions|plans|plan_limits|invoices|invoice_items|payments|billing_events|billing_audit_logs)["']\s*\)[\s\S]{0,240}?\.(insert|update|upsert|delete)\s*\(/g
      ) || [],
  },
  {
    id: "secret-service-role-in-client-boundary",
    description:
      "Service-role secrets must not be READ in client bundle code (server/edge only). Name-only mentions in strings are allowed.",
    // Matches actual env reads/use, NOT string-literal mentions in messages or redaction lists.
    match: (c) =>
      c.match(
        /(?:readEnv\(\s*["'][A-Z0-9_]*SERVICE_ROLE[A-Z0-9_]*["']|(?:process\.env|import\.meta\.env)\s*\.\s*[A-Za-z0-9_]*SERVICE_ROLE[A-Za-z0-9_]*|(?:process\.env|import\.meta\.env)\s*\[\s*["'][A-Z0-9_]*SERVICE_ROLE[A-Z0-9_]*["']\s*\])/g
      ) || [],
  },
  {
    id: "reporting-read-only",
    description: "Analytics/reporting modules must remain read-only (no table mutations).",
    onlyIn: ["src/features/dashboard-analytics/"],
    match: (c) => c.match(/\.(insert|update|upsert|delete)\s*\(/g) || [],
  },
  {
    id: "authorization-legacy-club-registry",
    description:
      "Club-scope authorization / API guards must resolve scope via clubScopeResolver (canonical cloud registry), never loadClubs()/pickleball-clubs-v1.",
    // Scoped to the club-scope authorization decision surface (Phase 44C.1 cutover).
    // The single allowed reader of the local registry is src/auth/clubScopeResolver.js
    // (NOT listed here, so it is never scanned by this rule).
    onlyIn: [
      "src/auth/rbac.js",
      "src/auth/guardAction.js",
      "src/features/api/services/clubScopeService.js",
      "src/features/api/router/handlers/clubsHandler.js",
      "src/features/api/router/handlers/playersHandler.js",
      "src/features/api/router/handlers/courtsHandler.js",
    ],
    match: (c) => [
      ...(c.match(/\bloadClubs\s*\(/g) || []),
      ...(c.match(/pickleball-clubs-v1/g) || []),
    ],
  },
  {
    id: "authorization-raw-role-compare",
    description:
      "Club-scope authorization code must use rbac role helpers (rolesEqual/isXScopedRole/rbac.can*), not raw role-string comparisons.",
    onlyIn: [
      "src/auth/rbac.js",
      "src/auth/guardAction.js",
      "src/features/api/services/clubScopeService.js",
      "src/features/api/router/handlers/clubsHandler.js",
      "src/features/api/router/handlers/playersHandler.js",
      "src/features/api/router/handlers/courtsHandler.js",
    ],
    match: (c) => c.match(/\.role\s*(?:===|==|!==|!=)\s*["'][A-Za-z_]+["']/g) || [],
  },
  {
    id: "governance-legacy-registry-read",
    description:
      "Governance authorization paths must decide elevation via governanceScopeResolver (canonical club_governance_assignments / phase42_has_gov_role), never the local registry (getClubById/loadClubs/pickleball-clubs-v1).",
    // Scoped to the governance authorization surface (Phase 44C.1A cutover).
    // The single allowed reader of the local registry for governance is
    // src/auth/governanceScopeResolver.js (NOT listed here → never scanned).
    onlyIn: [
      "src/features/club/services/governanceRoleElevation.js",
      "src/auth/menuAccess.js",
    ],
    match: (c) => [
      ...(c.match(/\bgetClubById\s*\(/g) || []),
      ...(c.match(/\bloadClubs\s*\(/g) || []),
      ...(c.match(/pickleball-clubs-v1/g) || []),
    ],
  },
  {
    id: "governance-elevation-owner",
    description:
      "PLAYER→CLUB_MANAGER governance elevation logic may only be DEFINED in the canonical governanceScopeResolver; other modules must import it, not reimplement it.",
    allow: ["src/auth/governanceScopeResolver.js"],
    match: (c) =>
      c.match(/function\s+(?:resolveGovernanceElevatedRole|hasClubGovernanceManagerAccess)\b/g) || [],
  },
  {
    id: "club-entity-registry-read-in-ui",
    description:
      "Club-entity registry list/get reads in the UI/context layer must go through canonicalClubRepository (Phase 45A.1 read cutover): no loadClubs()/pickleball-clubs-v1/direct club-registry RPC bypass.",
    // Scoped to the app UI/consumer surface. The canonical read gateway
    // (src/features/club/repositories/) and the offline authz resolver
    // (src/auth/clubScopeResolver.js) are NOT in these dirs → never scanned.
    onlyIn: ["src/context/", "src/pages/", "src/components/"],
    match: (c) => [
      ...(c.match(/\bloadClubs\s*\(/g) || []),
      ...(c.match(/pickleball-clubs-v1/g) || []),
      ...(c.match(/\brpcV2ClubListRegistry\s*\(/g) || []),
      ...(c.match(/\brpcV2ClubGet\s*\(/g) || []),
    ],
  },
  {
    id: "global-unregistered-error-code",
    description:
      "New string-literal error codes in the API layer must be registered in API_ERROR_CODES.",
    onlyIn: ["src/features/api/"],
    allow: ["src/features/api/constants/apiErrors.js", "src/features/api/constants/edgeApiErrors.js"],
    match: (c) => {
      const out = [];
      const re = /\bcode\s*(?::|===|==)\s*["']([A-Z][A-Z0-9_]{2,})["']/g;
      let m;
      while ((m = re.exec(c)) !== null) {
        if (!REGISTERED_CODES.has(m[1])) out.push(m[1]);
      }
      return out;
    },
  },
];

function rel(abs) {
  return path.relative(ROOT, abs).split(path.sep).join("/");
}

function isAllowed(relPath, rule) {
  const allow = [...(rule.allow || []), ...scopeAllowFor(rule.id)];
  return allow.some((a) => relPath === a || relPath.startsWith(a));
}

function fingerprint(matches) {
  const norm = [...matches].sort();
  return createHash("sha256").update(JSON.stringify(norm)).digest("hex").slice(0, 16);
}

function walk(dirAbs, out) {
  let entries;
  try {
    entries = readdirSync(dirAbs);
  } catch {
    return;
  }
  for (const name of entries) {
    if (IGNORE_DIRS.has(name)) continue;
    const abs = path.join(dirAbs, name);
    let st;
    try {
      st = statSync(abs);
    } catch {
      continue;
    }
    if (st.isDirectory()) walk(abs, out);
    else if (SCAN_EXT.has(path.extname(name))) out.push(abs);
  }
}

/** Returns Map<`ruleId::file`, { rule, file, symbol, count, fingerprint }> */
function collectViolations() {
  const files = [];
  for (const d of SCAN_DIRS) walk(path.join(ROOT, d), files);
  const found = new Map();
  for (const abs of files) {
    const relPath = rel(abs);
    let content;
    try {
      content = readFileSync(abs, "utf8");
    } catch {
      continue;
    }
    for (const rule of RULES) {
      if (rule.onlyIn && !rule.onlyIn.some((p) => relPath.startsWith(p))) continue;
      if (isAllowed(relPath, rule)) continue;
      const matches = rule.match(content);
      if (matches.length > 0) {
        found.set(`${rule.id}::${relPath}`, {
          rule: rule.id,
          file: relPath,
          symbol: [...new Set(matches)].join(" | "),
          count: matches.length,
          fingerprint: fingerprint(matches),
        });
      }
    }
  }
  return found;
}

function loadBaseline() {
  try {
    const data = JSON.parse(readFileSync(BASELINE_PATH, "utf8"));
    const map = new Map();
    for (const e of data.exceptions || []) map.set(`${e.rule}::${e.file}`, e);
    return map;
  } catch {
    return null;
  }
}

// Default reason/removal metadata for known temporary debt (used by --init).
const DEBT_META = {
  "auth-supabase-client-boundary::src/domain/matchLiveSync.js": {
    reason:
      "Realtime match-live sync constructs a dedicated no-persist ANON client instead of the canonical client; predates canonical realtime wiring.",
    removalPhase: "44B Realtime/Authorization cutover",
  },
  "club-entity-registry-read-in-ui::src/context/ClubContext.jsx": {
    reason:
      "Legacy blob-registry read path retained behind VITE_CANONICAL_CLUB_REPOSITORY_ENABLED=false for rollback / explicit offline mode. Canonical read gateway (canonicalClubRepository) is wired in Phase 45A.1 but not yet Production-authoritative (flag OFF).",
    removalPhase: "45A.5 blob/localStorage retirement",
  },
  "club-entity-registry-read-in-ui::src/pages/Players.jsx": {
    reason:
      "Player→club display mapping reads the club blob directly; migrate to the canonical club read after the ClubContext cutover is Production-verified.",
    removalPhase: "45A.5 blob/localStorage retirement",
  },
};

function runCli() {
  const mode = process.argv.includes("--init")
    ? "init"
    : process.argv.includes("--report")
      ? "report"
      : "check";

  const current = collectViolations();
  const sortedKeys = [...current.keys()].sort();

  if (mode === "init") {
    const exceptions = sortedKeys.map((k) => {
      const v = current.get(k);
      const meta = DEBT_META[k] || {};
      return {
        rule: v.rule,
        file: v.file,
        symbol: v.symbol,
        count: v.count,
        fingerprint: v.fingerprint,
        reason: meta.reason || "TODO: classify",
        removalPhase: meta.removalPhase || "unknown",
      };
    });
    writeFileSync(
      BASELINE_PATH,
      JSON.stringify(
        {
          note: "Phase 44B.0.1 baseline — TEMPORARY DEBT only. Lock fails on NEW files, count increases, or fingerprint changes. Legitimate server/gateway files live in SCOPE_ALLOWLIST inside ownership-lock.mjs, not here. No wildcards.",
          generatedAt: new Date().toISOString().slice(0, 10),
          rules: RULES.map((r) => ({ id: r.id, description: r.description })),
          exceptions,
        },
        null,
        2
      ) + "\n"
    );
    console.log(`ownership-lock: baseline written with ${exceptions.length} debt exception(s) → ${rel(BASELINE_PATH)}`);
    process.exit(0);
  }

  if (mode === "report") {
    console.log(`ownership-lock: ${sortedKeys.length} current violation(s)`);
    for (const k of sortedKeys) {
      const v = current.get(k);
      console.log(`  - ${k}  (count=${v.count}, fp=${v.fingerprint}, symbol=${v.symbol})`);
    }
    process.exit(0);
  }

  const baseline = loadBaseline();
  if (!baseline) {
    console.error("ownership-lock: FAIL — baseline missing. Run `node scripts/ci/ownership-lock.mjs --init`.");
    process.exit(1);
  }

  const failures = [];
  for (const k of sortedKeys) {
    const v = current.get(k);
    const base = baseline.get(k);
    if (!base) {
      failures.push(`NEW violation: ${k} (count=${v.count}, symbol=${v.symbol})`);
      continue;
    }
    if (v.count > base.count) {
      failures.push(`NEW occurrence in baselined file: ${k} (was ${base.count}, now ${v.count})`);
      continue;
    }
    if (v.count === base.count && v.fingerprint !== base.fingerprint) {
      failures.push(`CHANGED occurrence in baselined file: ${k} (fingerprint ${base.fingerprint} → ${v.fingerprint})`);
    }
  }

  const resolved = [...baseline.keys()].filter((k) => !current.has(k));

  if (failures.length > 0) {
    console.error(`ownership-lock: FAIL — ${failures.length} issue(s):`);
    for (const f of failures) console.error(`  + ${f}`);
    process.exit(1);
  }

  console.log(
    `ownership-lock: OK — 0 new/changed violation(s) (debt baseline: ${baseline.size}${resolved.length ? `, resolved: ${resolved.length}` : ""})`
  );
  process.exit(0);
}

// Only execute the CLI when run directly (not when imported by tests).
const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : "";
const selfPath = fileURLToPath(import.meta.url);
if (invokedPath && selfPath === invokedPath) {
  runCli();
}

export { RULES, collectViolations };
