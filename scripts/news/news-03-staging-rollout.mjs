#!/usr/bin/env node
/**
 * NEWS-03 — Controlled Staging rollout harness (Customer-07 Management API pattern).
 *
 * Modes: preflight | plan | apply | verify | rollback
 * DEFAULT: read-only preflight (no side-effect SQL).
 *
 * Live apply requires ALL of:
 *   --mode=apply --execute --confirm=NEWS_03_OWNER_GO_STAGING_ONLY
 *   exact Staging ref qyewbxjsiiyufanzcjcq
 *   clean Git worktree
 *   preflight NOT_APPLIED
 *
 * Live rollback requires:
 *   --mode=rollback --execute --confirm=NEWS_03_OWNER_GO_ROLLBACK_STAGING_ONLY
 *
 * Never Production. Never force allowlist override. Never log secrets.
 * Stop on first error. No automatic rollback on apply failure.
 *
 * Tests: inject transport via options / NEWS_03_TEST_TRANSPORT (module only).
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import {
  NEWS_03_APPLY_CONFIRM_PHRASE,
  NEWS_03_BACKUP_CLASSIFICATION,
  NEWS_03_ENVIRONMENT_LABEL,
  NEWS_03_EVIDENCE_DIR_RELATIVE,
  NEWS_03_MODES,
  NEWS_03_PERMISSION_KEYS,
  NEWS_03_PREFLIGHT_STATES,
  NEWS_03_PRODUCTION_PROJECT_REF_BLOCKLIST,
  NEWS_03_ROLLBACK_CONFIRM_PHRASE,
  NEWS_03_STAGING_PROJECT_REF,
  NEWS_03_VERDICTS,
} from "./lib/news03Constants.js";
import {
  getNews03RepoRoot,
  loadNews03StagingEnv,
} from "./lib/news03Env.js";
import {
  evaluateNews03StaticGates,
  inspectNews03EnvironmentIdentity,
  probeNews03GitFacts,
} from "./lib/news03Gates.js";
import {
  redactNews03Error,
  redactNews03SecretLike,
} from "./lib/news03Redact.js";
import {
  NEWS_03_APPLY_SQL_ORDER,
  NEWS_03_ROLLBACK_SQL_ORDER,
  NEWS_03_VERIFY_SQL_ORDER,
  loadNews03ApplyPackage,
  sha256File,
} from "./lib/news03SqlPackage.js";

/**
 * @param {string[]} argv
 */
export function parseNews03Args(argv) {
  const args = {
    mode: NEWS_03_MODES.PREFLIGHT,
    execute: false,
    confirm: null,
    evidenceDir: null,
  };
  for (const raw of argv) {
    if (raw === "--execute") {
      args.execute = true;
    } else if (raw.startsWith("--mode=")) {
      args.mode = String(raw.slice("--mode=".length)).toLowerCase();
    } else if (raw.startsWith("--confirm=")) {
      args.confirm = raw.slice("--confirm=".length);
    } else if (raw.startsWith("--evidence-dir=")) {
      args.evidenceDir = raw.slice("--evidence-dir=".length);
    } else if (raw === "--preflight") {
      args.mode = NEWS_03_MODES.PREFLIGHT;
    } else if (raw === "--plan") {
      args.mode = NEWS_03_MODES.PLAN;
    } else if (raw === "--apply") {
      args.mode = NEWS_03_MODES.APPLY;
    } else if (raw === "--verify") {
      args.mode = NEWS_03_MODES.VERIFY;
    } else if (raw === "--rollback") {
      args.mode = NEWS_03_MODES.ROLLBACK;
    }
  }
  if (!Object.values(NEWS_03_MODES).includes(args.mode)) {
    args.mode = NEWS_03_MODES.PREFLIGHT;
  }
  return args;
}

/**
 * Default Management API transport (real network). Tests inject a mock.
 * @param {{ method: string, url: string, headers: Record<string,string>, body?: string }} req
 */
async function defaultTransport(req) {
  const res = await fetch(req.url, {
    method: req.method,
    headers: req.headers,
    body: req.body,
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text.slice(0, 500) };
  }
  return { ok: res.ok, status: res.status, body: json };
}

function managementQueryUrl() {
  return `https://api.supabase.com/v1/projects/${NEWS_03_STAGING_PROJECT_REF}/database/query`;
}

function managementProjectUrl() {
  return `https://api.supabase.com/v1/projects/${NEWS_03_STAGING_PROJECT_REF}`;
}

/**
 * @param {object} transport
 * @param {string} accessToken
 * @param {string} sql
 * @param {string} label
 */
async function executeStagingSql(transport, accessToken, sql, label) {
  const res = await transport({
    method: "POST",
    url: managementQueryUrl(),
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: sql }),
  });
  if (!res.ok) {
    const msg =
      res.body?.message ||
      res.body?.error ||
      `HTTP ${res.status}` ||
      "query failed";
    throw new Error(`${label}: ${redactNews03SecretLike(msg)}`);
  }
  return res.body;
}

/**
 * @param {object} transport
 * @param {string} accessToken
 */
async function fetchProjectMetadata(transport, accessToken) {
  const res = await transport({
    method: "GET",
    url: managementProjectUrl(),
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  });
  if (!res.ok) {
    const msg =
      res.body?.message ||
      res.body?.error ||
      `HTTP ${res.status}` ||
      "project metadata failed";
    throw new Error(redactNews03SecretLike(msg));
  }
  const body = res.body || {};
  const ref = String(body.ref || body.id || "").trim();
  const name = String(body.name || "").toLowerCase();
  const status = String(body.status || body.subscription_id || "").toLowerCase();
  const errors = [];
  if (ref && ref !== NEWS_03_STAGING_PROJECT_REF) {
    errors.push(`Project metadata ref mismatch (expected Staging allowlist).`);
  }
  if (NEWS_03_PRODUCTION_PROJECT_REF_BLOCKLIST.includes(ref)) {
    errors.push("Production project ref in metadata.");
  }
  const looksStaging =
    !name ||
    name.includes("staging") ||
    name.includes("stage") ||
    name.includes("qa") ||
    ref === NEWS_03_STAGING_PROJECT_REF;
  if (!looksStaging) {
    errors.push("Project metadata name does not classify as Staging.");
  }
  const healthy =
    !status ||
    status.includes("active") ||
    status.includes("active_healthy") ||
    status === "active_healthy" ||
    status === "active";
  // Supabase returns status like ACTIVE_HEALTHY — accept common healthy tokens.
  const statusOk =
    !status ||
    /active|healthy|ok|running/i.test(String(body.status || ""));
  if (!statusOk && !healthy) {
    errors.push("Project status not healthy.");
  }
  return {
    ok: errors.length === 0,
    errors,
    ref: ref || NEWS_03_STAGING_PROJECT_REF,
    nameHint: name ? "[present]" : "[absent]",
    statusHint: body.status ? String(body.status).slice(0, 40) : null,
    environmentClassification: NEWS_03_ENVIRONMENT_LABEL,
    secretsPrinted: false,
  };
}

const PREFLIGHT_INVENTORY_SQL = `
SELECT jsonb_build_object(
  'tables', (
    SELECT coalesce(jsonb_agg(c.relname ORDER BY c.relname), '[]'::jsonb)
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r'
      AND c.relname LIKE 'news_public_content_%'
  ),
  'rls', (
    SELECT coalesce(jsonb_agg(jsonb_build_object(
      'relname', c.relname,
      'rls', c.relrowsecurity,
      'force_rls', c.relforcerowsecurity
    ) ORDER BY c.relname), '[]'::jsonb)
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r'
      AND c.relname LIKE 'news_public_content_%'
  ),
  'policies', (
    SELECT coalesce(jsonb_agg(jsonb_build_object(
      'tablename', tablename,
      'policyname', policyname
    ) ORDER BY tablename, policyname), '[]'::jsonb)
    FROM pg_policies
    WHERE tablename LIKE 'news_public_content_%'
  ),
  'functions', (
    SELECT coalesce(jsonb_agg(p.proname ORDER BY p.proname), '[]'::jsonb)
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND (
      p.proname LIKE 'news_public_content_%'
      OR p.proname LIKE 'news_phase02_%'
    )
  ),
  'triggers', (
    SELECT coalesce(jsonb_agg(t.tgname ORDER BY t.tgname), '[]'::jsonb)
    FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND NOT t.tgisinternal
      AND c.relname LIKE 'news_public_content_%'
  ),
  'permissions', (
    SELECT coalesce(jsonb_agg(p.id ORDER BY p.id), '[]'::jsonb)
    FROM public.permissions p
    WHERE p.id IN (
      'news.view','news.edit','news.review',
      'news.approve','news.publish','news.admin'
    )
  ),
  'helpers', jsonb_build_object(
    'user_has_permission', to_regprocedure('public.user_has_permission(text)') IS NOT NULL,
    'is_super_admin', to_regprocedure('public.is_super_admin()') IS NOT NULL,
    'user_venue_id', to_regprocedure('public.user_venue_id()') IS NOT NULL
  )
) AS inventory;
`.trim();

const EXPECTED_TABLES = Object.freeze([
  "news_public_content_approvals",
  "news_public_content_category_refs",
  "news_public_content_items",
  "news_public_content_media_refs",
  "news_public_content_revisions",
  "news_public_content_reviews",
  "news_public_content_tag_refs",
]);

/**
 * @param {any} inventory
 */
export function classifyNews03PreflightState(inventory) {
  if (!inventory || typeof inventory !== "object") {
    return NEWS_03_PREFLIGHT_STATES.STATE_UNKNOWN;
  }
  const tables = Array.isArray(inventory.tables) ? inventory.tables : [];
  const functions = Array.isArray(inventory.functions)
    ? inventory.functions
    : [];
  const permissions = Array.isArray(inventory.permissions)
    ? inventory.permissions
    : [];
  const rls = Array.isArray(inventory.rls) ? inventory.rls : [];
  const helpers = inventory.helpers || {};

  const tableCount = tables.length;
  const expectedTableCount = EXPECTED_TABLES.length;
  const allTables =
    expectedTableCount > 0 &&
    EXPECTED_TABLES.every((t) => tables.includes(t));
  const anyNewsObject =
    tableCount > 0 ||
    functions.length > 0 ||
    permissions.length > 0;

  if (!anyNewsObject) {
    return NEWS_03_PREFLIGHT_STATES.NOT_APPLIED;
  }

  const rlsOk =
    rls.length === expectedTableCount &&
    rls.every((row) => row.rls === true && row.force_rls === true);
  const permsOk =
    permissions.length === NEWS_03_PERMISSION_KEYS.length &&
    NEWS_03_PERMISSION_KEYS.every((k) => permissions.includes(k));
  const helpersOk =
    helpers.user_has_permission === true &&
    helpers.is_super_admin === true &&
    helpers.user_venue_id === true;
  const hasSaveRpc = functions.includes("news_public_content_save_aggregate");
  const hasPublicRpc = functions.includes("news_public_content_query_public");

  const fullyPresent =
    allTables && rlsOk && permsOk && helpersOk && hasSaveRpc && hasPublicRpc;

  if (!fullyPresent) {
    return NEWS_03_PREFLIGHT_STATES.PARTIALLY_APPLIED;
  }

  // Verification marker is not stored in DB; harness sets VERIFIED after verify mode.
  return NEWS_03_PREFLIGHT_STATES.FULLY_APPLIED_UNVERIFIED;
}

function writeEvidence(evidenceDir, filename, payload) {
  if (!existsSync(evidenceDir)) mkdirSync(evidenceDir, { recursive: true });
  const target = path.join(evidenceDir, filename);
  const safe = JSON.parse(redactNews03SecretLike(JSON.stringify(payload)));
  writeFileSync(target, `${JSON.stringify(safe, null, 2)}\n`, "utf8");
  return target;
}

function extractInventoryRow(body) {
  const row = Array.isArray(body) ? body[0] : body?.[0] || body;
  return row?.inventory || row || null;
}

/**
 * @param {{
 *   argv?: string[],
 *   env?: NodeJS.ProcessEnv,
 *   repoRoot?: string,
 *   transport?: Function,
 *   evidenceDir?: string,
 *   now?: () => string,
 *   skipEnvLoad?: boolean,
 *   gitFacts?: object,
 * }} [options]
 */
export async function runNews03StagingRollout(options = {}) {
  const repoRoot = options.repoRoot || getNews03RepoRoot();
  const env = options.env || process.env;
  if (!options.skipEnvLoad) {
    loadNews03StagingEnv({ repoRoot, env });
  }

  const args = parseNews03Args(options.argv || process.argv.slice(2));
  if (options.evidenceDir) args.evidenceDir = options.evidenceDir;

  const evidenceDir =
    args.evidenceDir ||
    path.join(repoRoot, NEWS_03_EVIDENCE_DIR_RELATIVE);

  const transport = options.transport || defaultTransport;
  const startedAt = (options.now || (() => new Date().toISOString()))();
  const gitFacts = options.gitFacts || probeNews03GitFacts({ repoRoot });
  const pkg = loadNews03ApplyPackage(repoRoot);

  /** Base report skeleton */
  const base = {
    phase: "NEWS-03",
    script: "news-03-staging-rollout",
    mode: args.mode,
    execute: args.execute,
    stagingProjectRef: NEWS_03_STAGING_PROJECT_REF,
    productionProjectRefBlocked: NEWS_03_PRODUCTION_PROJECT_REF_BLOCKLIST[0],
    environmentClassification: NEWS_03_ENVIRONMENT_LABEL,
    gitHead: gitFacts.head || null,
    workingTreeClean: gitFacts.workingTreeClean,
    sqlPackage: pkg.files,
    applyOrder: NEWS_03_APPLY_SQL_ORDER,
    rollbackOrder: NEWS_03_ROLLBACK_SQL_ORDER,
    verifyOrder: NEWS_03_VERIFY_SQL_ORDER,
    permissionKeys: NEWS_03_PERMISSION_KEYS,
    backupClassification: NEWS_03_BACKUP_CLASSIFICATION,
    pitr: false,
    verifiedBackup: false,
    automaticRollback: false,
    stopOnFirstError: true,
    secretsPrinted: false,
    sqlApplied: false,
    stagingConnected: false,
    productionConnected: false,
    startedAt,
  };

  // Hard production identity check on env URL before anything else.
  const identityEarly = inspectNews03EnvironmentIdentity(env);
  if (identityEarly.isProduction) {
    const blocked = {
      ...base,
      ok: false,
      verdict: NEWS_03_VERDICTS.BLOCKED_PRODUCTION,
      errors: identityEarly.errors,
      finishedAt: new Date().toISOString(),
    };
    writeEvidence(evidenceDir, "NEWS_03_BLOCKED_PRODUCTION.json", blocked);
    return blocked;
  }

  // ---------- PLAN (static, no network) ----------
  if (args.mode === NEWS_03_MODES.PLAN) {
    const gates = evaluateNews03StaticGates({
      env,
      repoRoot,
      mode: NEWS_03_MODES.PLAN,
      execute: false,
      confirm: null,
      gitFacts,
      preflightState: null,
    });
    const report = {
      ...base,
      mode: NEWS_03_MODES.PLAN,
      ok: pkg.ok,
      verdict: NEWS_03_VERDICTS.READ_ONLY_OK,
      migrationsWouldApply: pkg.files,
      gates: {
        identityOk: gates.identity.ok,
        identityErrors: gates.identity.errors,
        packageOk: pkg.ok,
        credentialsPresence: gates.credentials.presence,
      },
      applyRequires: {
        mode: "apply",
        execute: true,
        confirm: NEWS_03_APPLY_CONFIRM_PHRASE,
        cleanWorktree: true,
        preflightState: NEWS_03_PREFLIGHT_STATES.NOT_APPLIED,
      },
      rollbackRequires: {
        mode: "rollback",
        execute: true,
        confirm: NEWS_03_ROLLBACK_CONFIRM_PHRASE,
      },
      finishedAt: new Date().toISOString(),
    };
    writeEvidence(evidenceDir, "NEWS_03_PLAN.json", report);
    return report;
  }

  // ---------- Read-only modes that need network: preflight / verify / gated writes ----------
  const needsNetwork =
    args.mode === NEWS_03_MODES.PREFLIGHT ||
    args.mode === NEWS_03_MODES.APPLY ||
    args.mode === NEWS_03_MODES.VERIFY ||
    args.mode === NEWS_03_MODES.ROLLBACK;

  let inventory = null;
  let preflightState = NEWS_03_PREFLIGHT_STATES.STATE_UNKNOWN;
  let projectMeta = null;
  const accessToken = String(env.SUPABASE_ACCESS_TOKEN || "").trim();

  if (needsNetwork && args.mode === NEWS_03_MODES.PREFLIGHT && !accessToken) {
    // Offline preflight: package + identity only.
    const gates = evaluateNews03StaticGates({
      env,
      repoRoot,
      mode: NEWS_03_MODES.PREFLIGHT,
      execute: false,
      gitFacts,
    });
    const report = {
      ...base,
      ok: pkg.ok && !identityEarly.isProduction,
      verdict: NEWS_03_VERDICTS.READ_ONLY_OK,
      preflightState: NEWS_03_PREFLIGHT_STATES.STATE_UNKNOWN,
      preflightNote:
        "SUPABASE_ACCESS_TOKEN ABSENT — static package/identity preflight only; no Staging query.",
      credentialsPresence: gates.credentials.presence,
      identity: {
        ok: gates.identity.ok,
        errors: gates.identity.errors,
        urlPresent: gates.identity.urlPresent,
        containsStagingAllowlist: gates.identity.containsStagingAllowlist,
        containsProductionRef: gates.identity.containsProductionRef,
      },
      finishedAt: new Date().toISOString(),
    };
    writeEvidence(evidenceDir, "NEWS_03_PREFLIGHT.json", report);
    return report;
  }

  if (needsNetwork && accessToken) {
    try {
      projectMeta = await fetchProjectMetadata(transport, accessToken);
      if (!projectMeta.ok) {
        const blocked = {
          ...base,
          ok: false,
          verdict: NEWS_03_VERDICTS.BLOCKED_ENVIRONMENT,
          stagingConnected: true,
          errors: projectMeta.errors,
          projectMeta,
          finishedAt: new Date().toISOString(),
        };
        writeEvidence(evidenceDir, "NEWS_03_BLOCKED_ENVIRONMENT.json", blocked);
        return blocked;
      }
      const invBody = await executeStagingSql(
        transport,
        accessToken,
        PREFLIGHT_INVENTORY_SQL,
        "preflight-inventory"
      );
      inventory = extractInventoryRow(invBody);
      preflightState = classifyNews03PreflightState(inventory);
    } catch (err) {
      if (args.mode === NEWS_03_MODES.PREFLIGHT) {
        const report = {
          ...base,
          ok: false,
          verdict: NEWS_03_VERDICTS.READ_ONLY_OK,
          preflightState: NEWS_03_PREFLIGHT_STATES.STATE_UNKNOWN,
          error: redactNews03Error(err),
          finishedAt: new Date().toISOString(),
        };
        writeEvidence(evidenceDir, "NEWS_03_PREFLIGHT.json", report);
        return report;
      }
      const blocked = {
        ...base,
        ok: false,
        verdict:
          args.mode === NEWS_03_MODES.ROLLBACK
            ? NEWS_03_VERDICTS.ROLLBACK_BLOCKED
            : NEWS_03_VERDICTS.APPLY_BLOCKED,
        error: redactNews03Error(err),
        finishedAt: new Date().toISOString(),
      };
      writeEvidence(evidenceDir, "NEWS_03_GATE_REFUSAL.json", blocked);
      return blocked;
    }
  }

  // ---------- PREFLIGHT ----------
  if (args.mode === NEWS_03_MODES.PREFLIGHT) {
    const report = {
      ...base,
      ok: true,
      verdict: NEWS_03_VERDICTS.READ_ONLY_OK,
      stagingConnected: Boolean(accessToken),
      preflightState,
      inventory,
      projectMeta,
      finishedAt: new Date().toISOString(),
    };
    writeEvidence(evidenceDir, "NEWS_03_PREFLIGHT.json", report);
    return report;
  }

  // ---------- VERIFY ----------
  if (args.mode === NEWS_03_MODES.VERIFY) {
    if (!accessToken) {
      const blocked = {
        ...base,
        ok: false,
        verdict: NEWS_03_VERDICTS.VERIFY_FAILED,
        errors: ["SUPABASE_ACCESS_TOKEN ABSENT"],
        finishedAt: new Date().toISOString(),
      };
      writeEvidence(evidenceDir, "NEWS_03_VERIFY.json", blocked);
      return blocked;
    }
    const steps = [];
    try {
      for (const rel of NEWS_03_VERIFY_SQL_ORDER) {
        const abs = path.join(repoRoot, rel);
        const sql = readFileSync(abs, "utf8");
        await executeStagingSql(
          transport,
          accessToken,
          sql,
          `verify-${path.basename(rel)}`
        );
        steps.push({
          path: rel,
          sha256: sha256File(abs),
          status: "verified",
        });
      }
      const report = {
        ...base,
        ok: true,
        verdict: NEWS_03_VERDICTS.VERIFY_OK,
        stagingConnected: true,
        preflightState: NEWS_03_PREFLIGHT_STATES.FULLY_APPLIED_VERIFIED,
        inventory,
        verificationSteps: steps,
        finishedAt: new Date().toISOString(),
      };
      writeEvidence(evidenceDir, "NEWS_03_VERIFY.json", report);
      return report;
    } catch (err) {
      const report = {
        ...base,
        ok: false,
        verdict: NEWS_03_VERDICTS.VERIFY_FAILED,
        stagingConnected: true,
        verificationSteps: steps,
        error: redactNews03Error(err),
        finishedAt: new Date().toISOString(),
      };
      writeEvidence(evidenceDir, "NEWS_03_VERIFY.json", report);
      return report;
    }
  }

  // ---------- APPLY / ROLLBACK write paths ----------
  const gates = evaluateNews03StaticGates({
    env,
    repoRoot,
    mode: args.mode,
    execute: args.execute,
    confirm: args.confirm,
    preflightState,
    gitFacts,
  });

  if (!gates.ownerGo.canWrite) {
    const refused = {
      ...base,
      ok: false,
      verdict:
        args.mode === NEWS_03_MODES.ROLLBACK
          ? NEWS_03_VERDICTS.ROLLBACK_BLOCKED
          : NEWS_03_VERDICTS.APPLY_BLOCKED,
      preflightState,
      inventory,
      projectMeta,
      gateErrors: gates.ownerGo.errors,
      identityErrors: gates.identity.errors,
      finishedAt: new Date().toISOString(),
    };
    writeEvidence(evidenceDir, "NEWS_03_GATE_REFUSAL.json", refused);
    return refused;
  }

  const order =
    args.mode === NEWS_03_MODES.ROLLBACK
      ? NEWS_03_ROLLBACK_SQL_ORDER
      : NEWS_03_APPLY_SQL_ORDER;

  const applied = [];
  try {
    for (const rel of order) {
      const abs = path.join(repoRoot, rel);
      const sha = sha256File(abs);
      const sql = readFileSync(abs, "utf8");
      await executeStagingSql(
        transport,
        accessToken,
        sql,
        `${args.mode}-${path.basename(rel)}`
      );
      applied.push({
        path: rel,
        sha256: sha,
        status: "applied",
        appliedAt: new Date().toISOString(),
      });
    }

    const success = {
      ...base,
      ok: true,
      verdict:
        args.mode === NEWS_03_MODES.ROLLBACK
          ? NEWS_03_VERDICTS.ROLLBACK_OK
          : NEWS_03_VERDICTS.APPLY_OK,
      sqlApplied: true,
      stagingConnected: true,
      preflightState,
      inventory,
      projectMeta,
      steps: applied,
      cleanupSummary:
        args.mode === NEWS_03_MODES.ROLLBACK
          ? "Permission seed rollback then NEWS-02 schema rollback executed."
          : null,
      verificationSummary:
        args.mode === NEWS_03_MODES.APPLY
          ? "Apply sequence included NEWS-02 and NEWS-03 verification SQL (read-only tails)."
          : null,
      finishedAt: new Date().toISOString(),
    };
    writeEvidence(
      evidenceDir,
      args.mode === NEWS_03_MODES.ROLLBACK
        ? "NEWS_03_ROLLBACK_RESULT.json"
        : "NEWS_03_APPLY_RESULT.json",
      success
    );
    return success;
  } catch (err) {
    // Stop on first error — NO automatic rollback.
    let postInventory = null;
    try {
      const invBody = await executeStagingSql(
        transport,
        accessToken,
        PREFLIGHT_INVENTORY_SQL,
        "post-failure-inventory"
      );
      postInventory = extractInventoryRow(invBody);
    } catch {
      postInventory = null;
    }
    const failed = {
      ...base,
      ok: false,
      verdict:
        applied.length > 0
          ? NEWS_03_VERDICTS.APPLY_PARTIAL_STOPPED
          : args.mode === NEWS_03_MODES.ROLLBACK
            ? NEWS_03_VERDICTS.ROLLBACK_BLOCKED
            : NEWS_03_VERDICTS.APPLY_BLOCKED,
      sqlApplied: applied.length > 0,
      stagingConnected: true,
      automaticRollback: false,
      steps: applied,
      stoppedOn: applied.length + 1,
      error: redactNews03Error(err),
      inventoryAfterFailure: postInventory,
      ownerAction:
        "Do not auto-resume. Record evidence, remediate, then Owner re-GO.",
      finishedAt: new Date().toISOString(),
    };
    writeEvidence(evidenceDir, "NEWS_03_APPLY_RESULT.json", failed);
    return failed;
  }
}

async function main() {
  const result = await runNews03StagingRollout();
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.ok ? 0 : 1);
}

const news03IsDirectRun =
  process.argv[1] != null &&
  path.resolve(process.argv[1]) ===
    path.resolve(fileURLToPath(import.meta.url));

if (news03IsDirectRun) {
  main();
}

export {
  NEWS_03_APPLY_CONFIRM_PHRASE,
  NEWS_03_ROLLBACK_CONFIRM_PHRASE,
  NEWS_03_APPLY_SQL_ORDER,
  NEWS_03_MODES,
  NEWS_03_PREFLIGHT_STATES,
  NEWS_03_STAGING_PROJECT_REF,
};
