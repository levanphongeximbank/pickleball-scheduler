#!/usr/bin/env node
/**
 * NEWS-05 — Production READ-ONLY inventory (no apply / no mutate / no fixtures).
 *
 * Hard guards:
 *  - Target MUST be Production ref expuvcohlcjzvrrauvud
 *  - Staging ref qyewbxjsiiyufanzcjcq must NEVER be queried
 *  - SELECT / catalog probes only
 *  - Secrets never printed
 *
 * Usage:
 *   node scripts/news/news-05-production-readonly-inventory.mjs
 */

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import {
  NEWS_03_PERMISSION_KEYS,
  NEWS_03_PRODUCTION_PROJECT_REF_BLOCKLIST,
  NEWS_03_STAGING_PROJECT_REF,
} from "./lib/news03Constants.js";
import { redactNews03SecretLike } from "./lib/news03Redact.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../..");
const PRODUCTION_REF = NEWS_03_PRODUCTION_PROJECT_REF_BLOCKLIST[0];
const STAGING_REF = NEWS_03_STAGING_PROJECT_REF;
const EVIDENCE_DIR_REL =
  "docs/news-public-content/news-05/evidence";

const MUTATION_RE =
  /(^|;)\s*(insert|update|delete|truncate|drop|alter|create|grant|revoke|vacuum|reindex|copy|call|do)\b/i;

/**
 * @param {string} content
 */
function parseEnvFile(content) {
  /** @type {Record<string, string>} */
  const values = {};
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const separatorIndex = line.indexOf("=");
    if (separatorIndex === -1) continue;
    const key = line.slice(0, separatorIndex).trim();
    let value = line.slice(separatorIndex + 1).trim();
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

function listProductionEnvCandidates() {
  const home = os.homedir();
  return [
    process.env.NEWS_05_PRODUCTION_ENV_FILE,
    path.join(REPO_ROOT, ".env.production.local"),
    path.join(home, "pickleball-scheduler", ".env.production.local"),
    path.join(REPO_ROOT, ".env.staging-qa.local"),
    path.join(home, "pickleball-scheduler", ".env.staging-qa.local"),
  ].filter(Boolean);
}

/**
 * Load only Management API token + production URL identity keys (never print).
 * Merges all candidates: production.local for identity, staging-qa.local may
 * supply SUPABASE_ACCESS_TOKEN when production file lacks it.
 */
function loadProductionInventoryEnv() {
  /** @type {Record<string, string>} */
  const env = { ...process.env };
  /** @type {string[]} */
  const loadedFrom = [];
  for (const filePath of listProductionEnvCandidates()) {
    if (!existsSync(filePath)) continue;
    const parsed = parseEnvFile(readFileSync(filePath, "utf8"));
    let used = false;
    for (const [key, value] of Object.entries(parsed)) {
      if (
        key === "SUPABASE_ACCESS_TOKEN" ||
        key === "PRODUCTION_SUPABASE_URL" ||
        key === "VITE_SUPABASE_URL" ||
        key === "PRODUCTION_SUPABASE_ANON_KEY" ||
        key === "VITE_SUPABASE_ANON_KEY" ||
        key === "VITE_APP_ENV"
      ) {
        if (!String(env[key] || "").trim() && String(value || "").trim()) {
          env[key] = value;
          used = true;
        }
      }
    }
    if (used) {
      loadedFrom.push(
        path.basename(path.dirname(filePath)) + "/" + path.basename(filePath)
      );
    }
  }
  return {
    env,
    loadedFrom: loadedFrom.length ? loadedFrom.join("+") : null,
  };
}

function assertReadOnlySql(sql, label) {
  const stripped = String(sql)
    .replace(/--[^\n]*/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "");
  if (MUTATION_RE.test(stripped)) {
    throw new Error(`REFUSED mutating SQL in ${label}`);
  }
  if (!/^\s*select\b/i.test(stripped.trim())) {
    throw new Error(`REFUSED non-SELECT SQL in ${label}`);
  }
  if (new RegExp(STAGING_REF, "i").test(sql)) {
    throw new Error(`REFUSED Staging ref inside Production inventory SQL (${label})`);
  }
}

function sha256Text(text) {
  return createHash("sha256").update(String(text), "utf8").digest("hex");
}

function writeEvidence(filename, payload) {
  const dir = path.join(REPO_ROOT, EVIDENCE_DIR_REL);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const target = path.join(dir, filename);
  const safe = JSON.parse(redactNews03SecretLike(JSON.stringify(payload)));
  writeFileSync(target, `${JSON.stringify(safe, null, 2)}\n`, "utf8");
  return {
    path: path.basename(target),
    sha256: sha256Text(JSON.stringify(safe)),
  };
}

async function fetchProductionMetadata(accessToken) {
  const res = await fetch(
    `https://api.supabase.com/v1/projects/${PRODUCTION_REF}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    }
  );
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      `metadata: ${redactNews03SecretLike(body.message || body.error || `HTTP ${res.status}`)}`
    );
  }
  const ref = String(body.ref || body.id || "").trim();
  if (ref && ref !== PRODUCTION_REF) {
    throw new Error("Production metadata ref mismatch");
  }
  if (ref === STAGING_REF) {
    throw new Error("Staging ref returned for Production metadata probe");
  }
  return {
    ref: ref || PRODUCTION_REF,
    status: String(body.status || "").slice(0, 40) || null,
    namePresent: Boolean(body.name),
    regionPresent: Boolean(body.region || body.region_id),
  };
}

async function executeProductionSelect(accessToken, sql, label) {
  assertReadOnlySql(sql, label);
  const res = await fetch(
    `https://api.supabase.com/v1/projects/${PRODUCTION_REF}/database/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: sql }),
    }
  );
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = { raw: String(text).slice(0, 200) };
  }
  if (!res.ok) {
    throw new Error(
      `${label}: ${redactNews03SecretLike(
        body.message || body.error || `HTTP ${res.status}`
      )}`
    );
  }
  return body;
}

const INVENTORY_SQL = `
SELECT jsonb_build_object(
  'target_ref_expected', '${PRODUCTION_REF}',
  'tables', (
    SELECT coalesce(jsonb_agg(c.relname ORDER BY c.relname), '[]'::jsonb)
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r'
      AND c.relname LIKE 'news_public_content_%'
  ),
  'functions', (
    SELECT coalesce(jsonb_agg(p.proname ORDER BY p.proname), '[]'::jsonb)
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname LIKE 'news_public_content_%'
  ),
  'permissions', (
    SELECT coalesce(jsonb_agg(id ORDER BY id), '[]'::jsonb)
    FROM public.permissions
    WHERE id IN (${NEWS_03_PERMISSION_KEYS.map((k) => `'${k}'`).join(",")})
  ),
  'query_public_def', (
    SELECT pg_get_functiondef(p.oid)
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'news_public_content_query_public'
    LIMIT 1
  ),
  'save_aggregate_exists', (
    SELECT EXISTS (
      SELECT 1 FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = 'news_public_content_save_aggregate'
    )
  ),
  'public_window_index', (
    SELECT coalesce(jsonb_agg(jsonb_build_object(
      'indexname', i.relname,
      'indexdef', pg_get_indexdef(i.oid)
    )), '[]'::jsonb)
    FROM pg_class t
    JOIN pg_namespace n ON n.oid = t.relnamespace
    JOIN pg_index x ON x.indrelid = t.oid
    JOIN pg_class i ON i.oid = x.indexrelid
    WHERE n.nspname = 'public'
      AND t.relname = 'news_public_content_items'
      AND i.relname = 'news_public_content_items_public_window_idx'
  ),
  'rls_forced', (
    SELECT bool_and(c.relrowsecurity AND c.relforcerowsecurity)
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'
      AND c.relname LIKE 'news_public_content_%'
  ),
  'using_true_policies', (
    SELECT count(*)::int
    FROM pg_policies
    WHERE tablename LIKE 'news_public_content_%'
      AND (qual ILIKE '%true%' OR with_check ILIKE '%true%')
  ),
  'policy_count', (
    SELECT count(*)::int
    FROM pg_policies
    WHERE tablename LIKE 'news_public_content_%'
  ),
  'grants_query_public', (
    SELECT coalesce(jsonb_agg(grantee ORDER BY grantee), '[]'::jsonb)
    FROM information_schema.routine_privileges
    WHERE routine_schema = 'public'
      AND routine_name = 'news_public_content_query_public'
      AND privilege_type = 'EXECUTE'
  ),
  'grants_save_aggregate', (
    SELECT coalesce(jsonb_agg(grantee ORDER BY grantee), '[]'::jsonb)
    FROM information_schema.routine_privileges
    WHERE routine_schema = 'public'
      AND routine_name = 'news_public_content_save_aggregate'
      AND privilege_type = 'EXECUTE'
  ),
  'row_counts', (
    SELECT coalesce(jsonb_object_agg(relname, n_live_tup), '{}'::jsonb)
    FROM (
      SELECT c.relname, s.n_live_tup
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      JOIN pg_stat_user_tables s ON s.relid = c.oid
      WHERE n.nspname = 'public' AND c.relkind = 'r'
        AND c.relname LIKE 'news_public_content_%'
      ORDER BY c.relname
    ) q
  )
) AS inventory;
`;

/**
 * @param {string|null|undefined} def
 */
function classifyQueryPublicBody(def) {
  const text = String(def || "");
  const hasLiveEq = /provenance\s*=\s*'LIVE'/i.test(text);
  const hasMockNeq = /provenance\s*<>\s*'MOCK'/i.test(text);
  if (!text) return "MISSING";
  if (hasLiveEq && !hasMockNeq) return "LIVE_ONLY";
  if (hasMockNeq && !hasLiveEq) return "MOCK_EXCLUDE_ONLY";
  return "UNKNOWN_OR_MIXED";
}

/**
 * @param {object} inventory
 */
function classifyPresence(inventory) {
  const tables = Array.isArray(inventory?.tables) ? inventory.tables : [];
  const functions = Array.isArray(inventory?.functions)
    ? inventory.functions
    : [];
  const permissions = Array.isArray(inventory?.permissions)
    ? inventory.permissions
    : [];
  if (tables.length === 0 && functions.length === 0 && permissions.length === 0) {
    return "ABSENT";
  }
  const expectedTables = 7;
  const hasQuery = functions.includes("news_public_content_query_public");
  const hasSave = functions.includes("news_public_content_save_aggregate");
  const permsOk = permissions.length === NEWS_03_PERMISSION_KEYS.length;
  if (
    tables.length >= expectedTables &&
    hasQuery &&
    hasSave &&
    permsOk &&
    inventory?.rls_forced === true
  ) {
    return "FULLY_PRESENT";
  }
  return "PARTIAL";
}

async function main() {
  const startedAt = new Date().toISOString();
  const { env, loadedFrom } = loadProductionInventoryEnv();
  const accessToken = String(env.SUPABASE_ACCESS_TOKEN || "").trim();

  /** @type {Record<string, unknown>} */
  const report = {
    phase: "NEWS-05",
    script: "news-05-production-readonly-inventory",
    expectedProductionRef: PRODUCTION_REF,
    stagingRefBlocked: STAGING_REF,
    startedAt,
    secretsPrinted: false,
    sqlApplied: false,
    fixturesCreated: false,
    productionMutated: false,
    envFileHint: loadedFrom || null,
    accessTokenPresent: Boolean(accessToken),
  };

  if (!accessToken) {
    report.ok = false;
    report.classification = "PRODUCTION_INVENTORY_UNAVAILABLE";
    report.verdict = "NEWS_05_PRODUCTION_INVENTORY_UNAVAILABLE";
    report.reason = "SUPABASE_ACCESS_TOKEN not available for Production Management API";
    report.finishedAt = new Date().toISOString();
    const evidence = writeEvidence(
      "NEWS_05_PRODUCTION_INVENTORY.json",
      report
    );
    report.evidence = evidence;
    console.log(JSON.stringify(report, null, 2));
    process.exitCode = 2;
    return;
  }

  try {
    const metadata = await fetchProductionMetadata(accessToken);
    report.metadata = metadata;

    const raw = await executeProductionSelect(
      accessToken,
      INVENTORY_SQL,
      "news-production-inventory"
    );
    const inventory = Array.isArray(raw)
      ? raw[0]?.inventory || raw[0]
      : raw?.inventory || raw;

    // Never persist full function body in evidence if huge; keep classification only.
    const queryDef = inventory?.query_public_def || null;
    const rpcClass = classifyQueryPublicBody(queryDef);
    const sanitized = {
      ...inventory,
      query_public_def: queryDef
        ? `[omitted; length=${String(queryDef).length}; class=${rpcClass}]`
        : null,
      query_public_class: rpcClass,
    };

    const presence = classifyPresence(inventory);
    report.ok = true;
    report.inventory = sanitized;
    report.presence = presence;
    report.classification =
      presence === "ABSENT"
        ? "PRODUCTION_NEWS_ABSENT"
        : presence === "FULLY_PRESENT"
          ? "PRODUCTION_NEWS_FULLY_PRESENT"
          : "PRODUCTION_NEWS_PARTIAL";
    report.verdict =
      presence === "ABSENT"
        ? "NEWS_05_PRODUCTION_INVENTORY_ABSENT"
        : presence === "FULLY_PRESENT"
          ? "NEWS_05_PRODUCTION_INVENTORY_FULL"
          : "NEWS_05_PRODUCTION_INVENTORY_PARTIAL";
    report.backupProbe = {
      note: "PITR/backup capability not asserted by this SELECT inventory; Owner must confirm dashboard backup/PITR separately.",
      claimedByHarness: false,
    };
    report.credentialIsolation = {
      productionRefQueried: PRODUCTION_REF,
      stagingRefQueried: false,
      note: "Harness hard-blocks Staging ref in SQL and Management API path.",
    };
  } catch (err) {
    report.ok = false;
    report.classification = "PRODUCTION_INVENTORY_UNAVAILABLE";
    report.verdict = "NEWS_05_PRODUCTION_INVENTORY_UNAVAILABLE";
    report.error = redactNews03SecretLike(
      err instanceof Error ? err.message : String(err)
    );
  }

  report.finishedAt = new Date().toISOString();
  const evidence = writeEvidence("NEWS_05_PRODUCTION_INVENTORY.json", report);
  report.evidence = evidence;
  console.log(JSON.stringify(report, null, 2));
  process.exitCode = report.ok ? 0 : 2;
}

main().catch((err) => {
  const payload = {
    ok: false,
    classification: "PRODUCTION_INVENTORY_UNAVAILABLE",
    verdict: "NEWS_05_PRODUCTION_INVENTORY_UNAVAILABLE",
    error: redactNews03SecretLike(
      err instanceof Error ? err.message : String(err)
    ),
    secretsPrinted: false,
    productionMutated: false,
  };
  console.log(JSON.stringify(payload, null, 2));
  process.exitCode = 2;
});
