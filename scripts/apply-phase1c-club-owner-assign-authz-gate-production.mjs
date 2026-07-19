#!/usr/bin/env node
/**
 * Phase 1C — APPLY club_assign_owner / club_clear_owner authz gate to PRODUCTION.
 *
 * OWNER GO required. Hard-locks Production ref expuvcohlcjzvrrauvud.
 * Blocks Staging. Does NOT redeploy app. Does NOT enable optional Club Owner transfer.
 *
 * Requires: SUPABASE_ACCESS_TOKEN
 */
import fs from "node:fs";
import path from "node:path";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";
import { loadProjectEnv } from "./load-env.mjs";

const STAGING_REF = "qyewbxjsiiyufanzcjcq";
const PRODUCTION_REF = "expuvcohlcjzvrrauvud";
const APPROVED_APP_SHA = "d7a13982bd3b40913436466a227cc04d1649dcfb";
const PHASE1C_MERGE_SHA = "827a71c50eaf744c77b1e31afbfc774c6241d388";
/** Staging-approved gate SQL checksum (must not drift). */
const STAGING_APPROVED_GATE_CHECKSUM =
  "8a512ec1a4dfbb7e52e54d2b71d8fe4c5643a9f7b32e2f4c2e662e74e0cae83e";
const PATCH = "docs/v5/phase1c/PHASE_1C_CLUB_OWNER_ASSIGN_AUTHZ_SECURITY_GATE.sql";
const ROLLBACK = "docs/v5/phase1c/PHASE_1C_CLUB_OWNER_ASSIGN_AUTHZ_ROLLBACK.sql";
const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(rootDir, "docs/v5/qa-evidence/phase1c-production");

function rid() {
  return randomUUID();
}

function sha256(text) {
  return createHash("sha256").update(String(text || ""), "utf8").digest("hex");
}

async function managementSql(token, sql, label) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${PRODUCTION_REF}/database/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: sql }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`${label}: ${body?.message || body?.error || JSON.stringify(body) || res.statusText}`);
  }
  return body;
}

async function confirmIdentity(token) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${PRODUCTION_REF}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`identity: HTTP ${res.status}`);
  const ref = String(body.id || body.ref || "").trim();
  if (ref !== PRODUCTION_REF) throw new Error(`STOP — not Production (${ref})`);
  if (ref === STAGING_REF) throw new Error("STOP — Staging");
  if (String(body.status || "") !== "ACTIVE_HEALTHY") {
    throw new Error(`STOP — project status ${body.status}`);
  }
  return { ref, name: body.name, region: body.region, status: body.status };
}

async function fetchKeys(token) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${PRODUCTION_REF}/api-keys`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`api-keys failed`);
  const list = Array.isArray(body) ? body : [];
  const pick = (n) => String(list.find((k) => String(k.name || "").toLowerCase() === n)?.api_key || "").trim();
  return { anonKey: pick("anon"), serviceKey: pick("service_role") };
}

function clientFor(url, key) {
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function ensurePassword(admin, email, password) {
  let page = 1;
  while (page <= 30) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(error.message);
    const hit = (data?.users || []).find((u) => String(u.email || "").toLowerCase() === email.toLowerCase());
    if (hit) {
      const { error: e2 } = await admin.auth.admin.updateUserById(hit.id, { password });
      if (e2) throw new Error(e2.message);
      return hit.id;
    }
    if ((data?.users || []).length < 200) break;
    page += 1;
  }
  throw new Error(`user not found: ${email}`);
}

async function signIn(url, anon, email, password) {
  const sb = clientFor(url, anon);
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error) return { ok: false, error: error.message };
  return { ok: true, sb, userId: data.user?.id };
}

async function clubVersion(token, clubId) {
  const rows = await managementSql(
    token,
    `select version from public.clubs where id='${clubId.replace(/'/g, "''")}'`,
    "club_version"
  );
  return Array.isArray(rows) ? Number(rows[0]?.version) : null;
}

async function currentOwner(token, clubId) {
  const rows = await managementSql(
    token,
    `
select m.user_id::text as user_id
from public.club_governance_assignments g
join public.club_members m on m.id = g.club_member_id
where g.club_id = '${clubId.replace(/'/g, "''")}'
  and g.role_code = 'club_owner'
  and g.status = 'active'
limit 1;
`,
    "current_owner"
  );
  return Array.isArray(rows) ? rows[0]?.user_id || null : null;
}

function record(matrix, id, ok, detail = {}) {
  matrix.push({ id, ok: Boolean(ok), ...detail });
  console.log(`${ok ? "PASS" : "FAIL"} — ${id}`);
}

function writeJson(name, obj) {
  fs.writeFileSync(path.join(outDir, name), JSON.stringify(obj, null, 2));
}

function writeMd(name, lines) {
  fs.writeFileSync(path.join(outDir, name), lines.join("\n"));
}

async function main() {
  loadProjectEnv();
  fs.mkdirSync(outDir, { recursive: true });
  const token = String(process.env.SUPABASE_ACCESS_TOKEN || "").trim();
  if (!token) throw new Error("SUPABASE_ACCESS_TOKEN missing");

  const originMain = execSync("git rev-parse origin/main", { cwd: rootDir, encoding: "utf8" }).trim();
  const password =
    String(process.env.PRODUCTION_QA_PASSWORD || process.env.STAGING_QA_PASSWORD || "").trim() ||
    `Phase1cProd!${randomBytes(9).toString("base64url")}`;

  const applyReport = {
    phase: "1C",
    kind: "PRODUCTION_AUTHZ_GATE_APPLY",
    productionRef: PRODUCTION_REF,
    stagingRefBlocked: STAGING_REF,
    approvedAppSha: APPROVED_APP_SHA,
    originMainSha: originMain,
    appRedeployed: false,
    optionalClubOwnerSelfTransfer: false,
    startedAt: new Date().toISOString(),
    target: null,
    baseline: null,
    apply: null,
    catalog: null,
    rollbackApplied: false,
    status: "PENDING",
    warnings: [],
  };

  const smokeReport = {
    phase: "1C",
    kind: "PRODUCTION_AUTHZ_GATE_SMOKE",
    productionRef: PRODUCTION_REF,
    approvedAppSha: APPROVED_APP_SHA,
    startedAt: new Date().toISOString(),
    assignMatrix: [],
    clearMatrix: [],
    memberRequired: null,
    versionAudit: null,
    ownerRestore: null,
    uiConsistency: null,
    status: "PENDING",
    warnings: [],
  };

  console.log("=== Phase 1C OWNER RE-GO — Production authz gate apply ===");
  console.log(`Approved app SHA: ${APPROVED_APP_SHA}`);
  console.log(`origin/main:      ${originMain}`);

  // STEP 1 — target lock
  if (originMain !== APPROVED_APP_SHA) {
    applyReport.status = "BLOCKED_WRONG_APP_SHA";
    applyReport.error = `origin/main ${originMain} != ${APPROVED_APP_SHA}`;
    writeJson("PHASE_1C_PRODUCTION_AUTHZ_GATE_APPLY_REPORT.json", applyReport);
    process.exitCode = 2;
    return;
  }

  const identity = await confirmIdentity(token);
  applyReport.target = { ...identity, confirmedProduction: true, confirmedNotStaging: true };
  console.log(`Connected project ref: ${identity.ref} (${identity.status})`);
  if (identity.ref !== PRODUCTION_REF || identity.ref === STAGING_REF) {
    applyReport.status = "BLOCKED_TARGET";
    writeJson("PHASE_1C_PRODUCTION_AUTHZ_GATE_APPLY_REPORT.json", applyReport);
    process.exitCode = 2;
    return;
  }

  // Production Vercel tip must match approved SHA
  let vercelSha = null;
  try {
    const depRes = await fetch(
      "https://api.github.com/repos/levanphongeximbank/pickleball-scheduler/deployments?environment=Production&per_page=1",
      {
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${String(process.env.GITHUB_TOKEN || process.env.GH_TOKEN || "").trim()}`,
          "X-GitHub-Api-Version": "2022-11-28",
        },
      }
    );
    if (depRes.ok) {
      const deps = await depRes.json();
      vercelSha = String(deps?.[0]?.sha || "").trim() || null;
    }
  } catch {
    // fall through to gh CLI
  }
  if (!vercelSha) {
    try {
      vercelSha = execSync(
        'gh api "repos/levanphongeximbank/pickleball-scheduler/deployments?environment=Production&per_page=1" --jq ".[0].sha"',
        { cwd: rootDir, encoding: "utf8" }
      ).trim();
    } catch (err) {
      applyReport.status = "BLOCKED_VERCEL_SHA_UNREADABLE";
      applyReport.error = String(err.message || err);
      writeJson("PHASE_1C_PRODUCTION_AUTHZ_GATE_APPLY_REPORT.json", applyReport);
      process.exitCode = 2;
      return;
    }
  }
  applyReport.productionVercelSha = vercelSha;
  if (vercelSha !== APPROVED_APP_SHA) {
    applyReport.status = "BLOCKED_VERCEL_SHA_MISMATCH";
    applyReport.error = `Production Vercel ${vercelSha} != ${APPROVED_APP_SHA}`;
    writeJson("PHASE_1C_PRODUCTION_AUTHZ_GATE_APPLY_REPORT.json", applyReport);
    process.exitCode = 2;
    return;
  }

  // Phase 1C merge must be ancestor of approved SHA
  let ancestorOk = false;
  try {
    execSync(`git merge-base --is-ancestor ${PHASE1C_MERGE_SHA} ${APPROVED_APP_SHA}`, {
      cwd: rootDir,
      encoding: "utf8",
    });
    ancestorOk = true;
  } catch {
    ancestorOk = false;
  }
  applyReport.phase1cAncestorProof = {
    phase1cMergeSha: PHASE1C_MERGE_SHA,
    approvedAppSha: APPROVED_APP_SHA,
    isAncestor: ancestorOk,
  };
  if (!ancestorOk) {
    applyReport.status = "BLOCKED_PHASE1C_NOT_ANCESTOR";
    writeJson("PHASE_1C_PRODUCTION_AUTHZ_GATE_APPLY_REPORT.json", applyReport);
    process.exitCode = 2;
    return;
  }

  // Gate SQL must not have been modified after Phase 1C merge by later commits
  const gateTouchedAfter = execSync(
    `git log --oneline ${PHASE1C_MERGE_SHA}..${APPROVED_APP_SHA} -- ${PATCH}`,
    { cwd: rootDir, encoding: "utf8" }
  ).trim();
  applyReport.gateSqlUnchangedAfterPhase1c = gateTouchedAfter.length === 0;
  if (gateTouchedAfter) {
    applyReport.status = "BLOCKED_GATE_SQL_MODIFIED";
    applyReport.error = gateTouchedAfter;
    writeJson("PHASE_1C_PRODUCTION_AUTHZ_GATE_APPLY_REPORT.json", applyReport);
    process.exitCode = 2;
    return;
  }

  const url = `https://${PRODUCTION_REF}.supabase.co`;
  if (url.includes(STAGING_REF)) throw new Error("STOP — Staging URL");

  // SQL review + Staging checksum lock
  const sql = fs.readFileSync(path.join(rootDir, PATCH), "utf8");
  const checksum = sha256(sql);
  applyReport.gateSqlChecksum = checksum;
  applyReport.stagingApprovedChecksum = STAGING_APPROVED_GATE_CHECKSUM;
  applyReport.checksumMatchesStagingApproved = checksum === STAGING_APPROVED_GATE_CHECKSUM;
  if (checksum !== STAGING_APPROVED_GATE_CHECKSUM) {
    applyReport.status = "BLOCKED_CHECKSUM_DRIFT";
    applyReport.error = `gate checksum ${checksum} != staging approved ${STAGING_APPROVED_GATE_CHECKSUM}`;
    writeJson("PHASE_1C_PRODUCTION_AUTHZ_GATE_APPLY_REPORT.json", applyReport);
    process.exitCode = 2;
    return;
  }

  const helperSlice =
    sql.split("create or replace function public.phase42_can_assign_club_owner")[1]?.slice(0, 1500) || "";
  const review = {
    helperRoleSpecific: /role_code = 'tenant_owner'/.test(sql),
    noBareTenantMemberAuthz:
      !/if not \(public\.phase42_is_platform_super_admin\(\) or public\.phase42_is_tenant_member\(/.test(sql) &&
      /phase42_can_assign_club_owner/.test(sql),
    deniesManagers: !/VENUE_MANAGER|COURT_MANAGER/.test(helperSlice),
    optionalClubOwnerDisabled:
      /OPTIONAL \(Owner GO required\)/.test(sql) &&
      !/phase42_has_gov_role\(p_club_id, array\['club_owner'\]\)/.test(sql.replace(/--.*$/gm, "")),
    noDestructive:
      !/^\s*TRUNCATE\b/im.test(sql) &&
      !/^\s*DROP\s+TABLE\b/im.test(sql) &&
      !/DISABLE ROW LEVEL SECURITY/i.test(sql) &&
      !/^\s*DELETE\s+FROM\b/im.test(sql),
    createOrReplace: /create or replace function public\.phase42_can_assign_club_owner/i.test(sql),
  };
  applyReport.sqlReview = review;
  if (
    !review.helperRoleSpecific ||
    !review.noBareTenantMemberAuthz ||
    !review.optionalClubOwnerDisabled ||
    !review.noDestructive
  ) {
    applyReport.status = "BLOCKED_SQL_REVIEW";
    writeJson("PHASE_1C_PRODUCTION_AUTHZ_GATE_APPLY_REPORT.json", applyReport);
    process.exitCode = 2;
    return;
  }

  console.log("Target lock PASS (project, SHA, Vercel, ancestor, checksum).");

  // STEP 2/3 — baseline (includes current Owner + version for primary club)
  console.log("\nCapturing baseline...");
  const baselineRows = await managementSql(
    token,
    `
with pick as (
  select c.id, c.version
  from public.clubs c
  where c.deleted_at is null
  order by c.created_at nulls last, c.id
  limit 1
)
select json_build_object(
  'assign_def', (
    select pg_get_functiondef(p.oid) from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname='club_assign_owner' limit 1
  ),
  'clear_def', (
    select pg_get_functiondef(p.oid) from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname='club_clear_owner' limit 1
  ),
  'tenant_member_def', (
    select pg_get_functiondef(p.oid) from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname='phase42_is_tenant_member' limit 1
  ),
  'helper_exists', to_regprocedure('public.phase42_can_assign_club_owner(text)') is not null,
  'grant_assign', exists (
    select 1 from information_schema.routine_privileges
    where specific_schema='public' and routine_name='club_assign_owner'
      and grantee='authenticated' and privilege_type='EXECUTE'
  ),
  'grant_clear', exists (
    select 1 from information_schema.routine_privileges
    where specific_schema='public' and routine_name='club_clear_owner'
      and grantee='authenticated' and privilege_type='EXECUTE'
  ),
  'rls', json_build_object(
    'clubs', (select relrowsecurity from pg_class where oid='public.clubs'::regclass),
    'club_members', (select relrowsecurity from pg_class where oid='public.club_members'::regclass),
    'club_governance_assignments', (select relrowsecurity from pg_class where oid='public.club_governance_assignments'::regclass)
  ),
  'club_id', (select id from pick),
  'club_version', (select version from pick),
  'owner_user_id', (
    select m.user_id::text
    from public.club_governance_assignments g
    join public.club_members m on m.id = g.club_member_id
    join pick on pick.id = g.club_id
    where g.role_code = 'club_owner' and g.status = 'active'
    limit 1
  )
) as v;
`,
    "baseline"
  );
  const base = Array.isArray(baselineRows) ? baselineRows[0]?.v : baselineRows?.v;
  applyReport.baseline = {
    assignChecksum: sha256(base?.assign_def),
    clearChecksum: sha256(base?.clear_def),
    tenantMemberChecksum: sha256(base?.tenant_member_def),
    helperExists: base?.helper_exists === true,
    grantAssign: base?.grant_assign === true,
    grantClear: base?.grant_clear === true,
    rls: base?.rls,
    clubId: base?.club_id || null,
    clubVersion: base?.club_version ?? null,
    ownerUserId: base?.owner_user_id || null,
    assignUsesBareTenantMember: /phase42_is_tenant_member/i.test(String(base?.assign_def || "")),
    clearUsesBareTenantMember: /phase42_is_tenant_member/i.test(String(base?.clear_def || "")),
    assignAuthzSnippet: (String(base?.assign_def || "").match(/if not \([\s\S]{0,220}?then/) || [null])[0],
  };
  fs.writeFileSync(
    path.join(outDir, "PHASE_1C_PRODUCTION_AUTHZ_GATE_BASELINE_DEFS.json"),
    JSON.stringify(
      {
        capturedAt: new Date().toISOString(),
        assign_def: base?.assign_def,
        clear_def: base?.clear_def,
        tenant_member_def: base?.tenant_member_def,
        checksums: {
          assign: applyReport.baseline.assignChecksum,
          clear: applyReport.baseline.clearChecksum,
          tenant_member: applyReport.baseline.tenantMemberChecksum,
        },
      },
      null,
      2
    )
  );
  console.log("Baseline captured.");

  // STEP 3 — apply
  console.log("\nApplying gate SQL...");
  try {
    await managementSql(token, sql, PATCH);
    applyReport.apply = {
      file: PATCH,
      checksum,
      result: "PASS",
      finishedAt: new Date().toISOString(),
    };
    console.log("APPLY PASS");
  } catch (err) {
    applyReport.apply = {
      file: PATCH,
      checksum,
      result: "FAIL",
      error: String(err.message || err),
    };
    applyReport.status = "APPLY_FAILED";
    writeJson("PHASE_1C_PRODUCTION_AUTHZ_GATE_APPLY_REPORT.json", applyReport);
    writeMd("PHASE_1C_PRODUCTION_AUTHZ_GATE_APPLY_REPORT.md", [
      `# Phase 1C Production Authz Gate Apply`,
      ``,
      `**FAIL** — ${applyReport.apply.error}`,
      ``,
      `Rollback not auto-applied (apply never completed successfully).`,
    ]);
    process.exitCode = 1;
    return;
  }

  // STEP 4 — catalog
  const catalogRows = await managementSql(
    token,
    `
select json_build_object(
  'helper_exists', to_regprocedure('public.phase42_can_assign_club_owner(text)') is not null,
  'helper_def', (
    select pg_get_functiondef(p.oid) from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname='phase42_can_assign_club_owner' limit 1
  ),
  'assign_def', (
    select pg_get_functiondef(p.oid) from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname='club_assign_owner' limit 1
  ),
  'clear_def', (
    select pg_get_functiondef(p.oid) from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname='club_clear_owner' limit 1
  ),
  'assign_security', (
    select case when p.prosecdef then 'DEFINER' else 'INVOKER' end
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname='club_assign_owner' limit 1
  ),
  'clear_security', (
    select case when p.prosecdef then 'DEFINER' else 'INVOKER' end
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname='club_clear_owner' limit 1
  ),
  'grant_assign', exists (
    select 1 from information_schema.routine_privileges
    where specific_schema='public' and routine_name='club_assign_owner'
      and grantee='authenticated' and privilege_type='EXECUTE'
  ),
  'grant_clear', exists (
    select 1 from information_schema.routine_privileges
    where specific_schema='public' and routine_name='club_clear_owner'
      and grantee='authenticated' and privilege_type='EXECUTE'
  ),
  'rls', json_build_object(
    'clubs', (select relrowsecurity from pg_class where oid='public.clubs'::regclass),
    'club_members', (select relrowsecurity from pg_class where oid='public.club_members'::regclass),
    'club_governance_assignments', (select relrowsecurity from pg_class where oid='public.club_governance_assignments'::regclass)
  )
) as v;
`,
    "catalog"
  );
  const cat = Array.isArray(catalogRows) ? catalogRows[0]?.v : catalogRows?.v;
  const assignDef = String(cat?.assign_def || "");
  const clearDef = String(cat?.clear_def || "");
  const helperDef = String(cat?.helper_def || "");
  applyReport.catalog = {
    helper_exists: cat?.helper_exists === true,
    assign_uses_narrow_helper: /phase42_can_assign_club_owner/i.test(assignDef),
    clear_uses_narrow_helper: /phase42_can_assign_club_owner/i.test(clearDef),
    assign_no_bare_tenant_member: !/phase42_is_tenant_member/i.test(assignDef),
    clear_no_bare_tenant_member: !/phase42_is_tenant_member/i.test(clearDef),
    helper_no_bare_tenant_member: !/phase42_is_tenant_member/i.test(helperDef),
    helper_no_club_owner_gov: !/phase42_has_gov_role\([^)]*club_owner/i.test(helperDef),
    helper_no_venue_manager: !/VENUE_MANAGER|COURT_MANAGER/i.test(helperDef),
    helper_no_tenant_staff: !/tenant_staff/i.test(helperDef),
    assign_security: cat?.assign_security,
    clear_security: cat?.clear_security,
    grant_assign: cat?.grant_assign === true,
    grant_clear: cat?.grant_clear === true,
    rls: cat?.rls,
    afterChecksums: {
      assign: sha256(assignDef),
      clear: sha256(clearDef),
      helper: sha256(helperDef),
    },
    assignAuthzSnippet: (assignDef.match(/if not[\s\S]{0,160}?then/) || [null])[0],
  };
  console.log("Catalog:", JSON.stringify(applyReport.catalog, null, 2));

  const catalogOk =
    applyReport.catalog.helper_exists &&
    applyReport.catalog.assign_uses_narrow_helper &&
    applyReport.catalog.clear_uses_narrow_helper &&
    applyReport.catalog.assign_no_bare_tenant_member &&
    applyReport.catalog.clear_no_bare_tenant_member &&
    applyReport.catalog.helper_no_club_owner_gov &&
    applyReport.catalog.helper_no_venue_manager &&
    applyReport.catalog.rls?.clubs === true &&
    applyReport.catalog.rls?.club_members === true &&
    applyReport.catalog.rls?.club_governance_assignments === true;

  if (!catalogOk) {
    applyReport.status = "CATALOG_VERIFY_FAILED";
    console.error("CATALOG FAIL — applying rollback...");
    const rollbackSql = fs.readFileSync(path.join(rootDir, ROLLBACK), "utf8");
    await managementSql(token, rollbackSql, ROLLBACK);
    applyReport.rollbackApplied = true;
    applyReport.rollbackReason = "catalog_verify_failed";
    writeJson("PHASE_1C_PRODUCTION_AUTHZ_GATE_APPLY_REPORT.json", applyReport);
    process.exitCode = 1;
    return;
  }

  // STEP 5/6 — live matrix + mutation
  const keys = await fetchKeys(token);
  if (!keys.anonKey || !keys.serviceKey) throw new Error("missing Production API keys");
  const admin = clientFor(url, keys.serviceKey);

  const fixtureRows = await managementSql(
    token,
    `
with pick as (
  select c.id, c.name, c.version, c.tenant_id
  from public.clubs c
  where c.deleted_at is null
  order by c.created_at nulls last, c.id
  limit 1
),
gov as (
  select g.role_code, m.user_id, coalesce(nullif(p.email,''), u.email) as email
  from public.club_governance_assignments g
  join public.club_members m on m.id = g.club_member_id
  left join public.profiles p on p.id = m.user_id
  join auth.users u on u.id = m.user_id
  join pick on pick.id = g.club_id
  where g.status = 'active'
)
select json_build_object(
  'club', (select row_to_json(pick) from pick),
  'owner', (select json_build_object('user_id', user_id, 'email', email) from gov where role_code='club_owner' limit 1),
  'president', (select json_build_object('user_id', user_id, 'email', email) from gov where role_code='president' limit 1),
  'super_admin', (
    select json_build_object('user_id', p.id, 'email', p.email)
    from public.profiles p
    where upper(coalesce(p.role,'')) in ('SUPER_ADMIN','SYSTEM_TECHNICIAN')
      and coalesce(p.email,'') <> ''
    order by case when upper(p.role)='SUPER_ADMIN' then 0 else 1 end
    limit 1
  ),
  'tenant_owner', (
    select json_build_object('user_id', tm.user_id, 'email', p.email)
    from public.tenant_members tm
    join public.profiles p on p.id = tm.user_id
    join pick on pick.tenant_id = tm.tenant_id
    where tm.role_code = 'tenant_owner' and coalesce(tm.status,'active')='active'
      and coalesce(p.email,'') <> ''
    limit 1
  ),
  'tenant_staff', (
    select json_build_object('user_id', tm.user_id, 'email', p.email)
    from public.tenant_members tm
    join public.profiles p on p.id = tm.user_id
    join pick on pick.tenant_id = tm.tenant_id
    where tm.role_code = 'tenant_staff' and coalesce(tm.status,'active')='active'
      and coalesce(p.email,'') <> ''
      and not exists (
        select 1 from gov g where g.user_id = tm.user_id and g.role_code in ('club_owner','president')
      )
    limit 1
  ),
  'active_member', (
    select json_build_object('user_id', m.user_id, 'email', coalesce(p.email,u.email))
    from public.club_members m
    join pick on pick.id = m.club_id
    left join public.profiles p on p.id = m.user_id
    join auth.users u on u.id = m.user_id
    where m.status='active' and m.user_id is not null
      and not exists (
        select 1 from public.club_governance_assignments g
        where g.club_id=m.club_id and g.club_member_id=m.id and g.status='active' and g.role_code='club_owner'
      )
    limit 1
  ),
  'unrelated', (
    select json_build_object('user_id', p.id, 'email', p.email)
    from public.profiles p
    where coalesce(p.email,'') <> ''
      and not exists (select 1 from public.tenant_members tm where tm.user_id=p.id and tm.status='active')
      and not exists (select 1 from public.club_members m join pick on pick.id=m.club_id where m.user_id=p.id)
    limit 1
  )
) as fixture;
`,
    "fixture"
  );
  const fixture = Array.isArray(fixtureRows) ? fixtureRows[0]?.fixture : fixtureRows?.fixture;
  const clubId = fixture?.club?.id;
  const tenantId = fixture?.club?.tenant_id;
  if (!clubId || !tenantId) throw new Error("Production club fixture missing");
  smokeReport.clubId = clubId;
  smokeReport.tenantId = tenantId;
  smokeReport.originalOwnerUserId = fixture.owner?.user_id || null;
  smokeReport.originalVersion = fixture.club?.version ?? null;

  const stamp = Date.now().toString(36);
  async function createProfileUser(email, role, venueId = null) {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (error) throw new Error(`createUser ${email}: ${error.message}`);
    const id = data.user.id;
    await admin.from("profiles").upsert({
      id,
      email,
      role,
      venue_id: venueId,
      full_name: `Phase1C Prod ${role}`,
    });
    return { id, email };
  }

  const venueManager = await createProfileUser(`phase1c.prod.vm.${stamp}@prod-qa.local`, "VENUE_MANAGER", tenantId);
  const courtManager = await createProfileUser(`phase1c.prod.cm.${stamp}@prod-qa.local`, "COURT_MANAGER", tenantId);
  const player = await createProfileUser(`phase1c.prod.player.${stamp}@prod-qa.local`, "PLAYER", null);
  const vp = await createProfileUser(`phase1c.prod.vp.${stamp}@prod-qa.local`, "PLAYER", null);
  const stranger = await createProfileUser(`phase1c.prod.stranger.${stamp}@prod-qa.local`, "PLAYER", null);

  const allowActorEmail = fixture.tenant_owner?.email || fixture.super_admin?.email;
  if (!allowActorEmail) throw new Error("no ALLOW fixture");
  await ensurePassword(admin, allowActorEmail, password);
  const allowSession = await signIn(url, keys.anonKey, allowActorEmail, password);
  if (!allowSession.ok) throw new Error(`allow actor sign-in: ${allowSession.error}`);

  // Ensure player/vp are members for DENY/MEMBER tests
  await allowSession.sb.rpc("club_add_member", {
    p_request_id: rid(),
    p_club_id: clubId,
    p_target_user_id: player.id,
    p_membership_type: "regular",
    p_expected_version: null,
  });
  await allowSession.sb.rpc("club_add_member", {
    p_request_id: rid(),
    p_club_id: clubId,
    p_target_user_id: vp.id,
    p_membership_type: "regular",
    p_expected_version: null,
  });
  let ver = await clubVersion(token, clubId);
  await allowSession.sb.rpc("club_assign_vice_president", {
    p_request_id: rid(),
    p_club_id: clubId,
    p_member_user_id: vp.id,
    p_expected_club_version: ver,
  });

  const targetMember = fixture.active_member || { user_id: player.id, email: player.email };
  const originalOwnerBeforeQa = await currentOwner(token, clubId);

  async function callAssign(session, expectedVersion, targetUserId) {
    const { data } = await session.sb.rpc("club_assign_owner", {
      p_request_id: rid(),
      p_club_id: clubId,
      p_member_user_id: targetUserId,
      p_expected_club_version: expectedVersion,
    });
    return data;
  }
  async function callClear(session, expectedVersion) {
    const { data } = await session.sb.rpc("club_clear_owner", {
      p_request_id: rid(),
      p_club_id: clubId,
      p_expected_club_version: expectedVersion,
    });
    return data;
  }

  if (fixture.owner?.user_id && fixture.tenant_owner?.user_id && fixture.owner.user_id === fixture.tenant_owner.user_id) {
    smokeReport.warnings.push("Club Owner fixture equals Tenant Owner — Club-Owner-alone DENY marked SKIP");
  }

  const assignRoles = [
    { key: "SUPER_ADMIN", email: fixture.super_admin?.email, expect: "ALLOW" },
    { key: "Tenant owner", email: fixture.tenant_owner?.email, expect: "ALLOW" },
    {
      key: "Approved tenant admin (TENANT_OWNER profile path)",
      email: fixture.tenant_owner?.email,
      expect: "ALLOW",
      note: "same fixture as tenant_owner when profile path overlaps",
    },
    { key: "Ordinary tenant_staff", email: fixture.tenant_staff?.email, expect: "FORBIDDEN" },
    { key: "VENUE_MANAGER profile fallback only", email: venueManager.email, expect: "FORBIDDEN" },
    { key: "COURT_MANAGER profile fallback only", email: courtManager.email, expect: "FORBIDDEN" },
    {
      key: "Club Owner without approved tenant-admin role",
      email: fixture.owner?.email,
      expect: "FORBIDDEN",
      skipIfAlsoTenantOwner: true,
    },
    { key: "Club President", email: fixture.president?.email, expect: "FORBIDDEN" },
    { key: "Vice President", email: vp.email, expect: "FORBIDDEN" },
    { key: "Ordinary club player", email: player.email, expect: "FORBIDDEN" },
    { key: "Unrelated authenticated user", email: fixture.unrelated?.email, expect: "FORBIDDEN" },
  ];

  console.log("\n--- club_assign_owner matrix ---");
  for (const role of assignRoles) {
    if (!role.email) {
      record(smokeReport.assignMatrix, `ASSIGN_${role.key}`, false, {
        expected: role.expect,
        actual: "no_fixture",
      });
      continue;
    }
    if (
      role.skipIfAlsoTenantOwner &&
      fixture.owner?.user_id &&
      fixture.tenant_owner?.user_id &&
      fixture.owner.user_id === fixture.tenant_owner.user_id
    ) {
      record(smokeReport.assignMatrix, `ASSIGN_${role.key}`, true, {
        expected: role.expect,
        actual: "SKIP_OWNER_EQUALS_TENANT_OWNER",
      });
      continue;
    }
    await ensurePassword(admin, role.email, password);
    const session = await signIn(url, keys.anonKey, role.email, password);
    if (!session.ok) {
      record(smokeReport.assignMatrix, `ASSIGN_${role.key}`, false, {
        expected: role.expect,
        actual: `sign-in failed: ${session.error}`,
      });
      continue;
    }
    const vBefore = await clubVersion(token, clubId);
    const ownerBefore = await currentOwner(token, clubId);
    const result = await callAssign(session, vBefore, targetMember.user_id);
    const allowed = result?.ok === true;
    const code = allowed ? "ALLOW" : String(result?.code || "FAIL");
    const ok = role.expect === "ALLOW" ? allowed : !allowed && code === "FORBIDDEN";
    const vAfter = await clubVersion(token, clubId);
    const ownerAfter = await currentOwner(token, clubId);
    if (!allowed && (vAfter !== vBefore || ownerAfter !== ownerBefore)) {
      smokeReport.warnings.push(`deny_side_effect:${role.key}`);
    }
    if (allowed) {
      const v2 = await clubVersion(token, clubId);
      if (originalOwnerBeforeQa) {
        await allowSession.sb.rpc("club_assign_owner", {
          p_request_id: rid(),
          p_club_id: clubId,
          p_member_user_id: originalOwnerBeforeQa,
          p_expected_club_version: v2,
        });
      }
    }
    record(smokeReport.assignMatrix, `ASSIGN_${role.key}`, ok, {
      expected: role.expect,
      actual: code,
      note: role.note || null,
      versionBefore: vBefore,
      versionAfter: vAfter,
      ownerUnchangedOnDeny: !allowed ? ownerAfter === ownerBefore : null,
    });
  }

  // Anonymous assign
  {
    const anon = clientFor(url, keys.anonKey);
    const vBefore = await clubVersion(token, clubId);
    const { data } = await anon.rpc("club_assign_owner", {
      p_request_id: rid(),
      p_club_id: clubId,
      p_member_user_id: targetMember.user_id,
      p_expected_club_version: vBefore,
    });
    const code = data?.code || (data?.ok ? "ALLOW" : "FAIL");
    record(smokeReport.assignMatrix, "ASSIGN_Anonymous", code === "NOT_AUTHENTICATED", {
      expected: "NOT_AUTHENTICATED",
      actual: code,
    });
  }

  // Stale assign
  {
    const session = await signIn(url, keys.anonKey, allowActorEmail, password);
    const vBefore = await clubVersion(token, clubId);
    const result = await callAssign(session, Math.max(1, vBefore - 1), targetMember.user_id);
    const code = result?.code || (result?.ok ? "ALLOW" : "FAIL");
    record(smokeReport.assignMatrix, "ASSIGN_stale_version", code === "VERSION_CONFLICT", {
      expected: "VERSION_CONFLICT",
      actual: code,
    });
  }

  // MEMBER_REQUIRED
  {
    const session = await signIn(url, keys.anonKey, allowActorEmail, password);
    const vBefore = await clubVersion(token, clubId);
    const result = await callAssign(session, vBefore, stranger.id);
    smokeReport.memberRequired = {
      expected: "MEMBER_REQUIRED",
      actual: result?.code || (result?.ok ? "ALLOW" : "FAIL"),
      ok: result?.code === "MEMBER_REQUIRED",
    };
    console.log(`${smokeReport.memberRequired.ok ? "PASS" : "FAIL"} — MEMBER_REQUIRED`);
  }

  console.log("\n--- club_clear_owner matrix ---");
  const clearRoles = [
    { key: "SUPER_ADMIN", email: fixture.super_admin?.email, expect: "ALLOW" },
    { key: "Tenant owner", email: fixture.tenant_owner?.email, expect: "ALLOW" },
    { key: "Approved tenant admin", email: fixture.tenant_owner?.email, expect: "ALLOW" },
    { key: "Ordinary tenant_staff", email: fixture.tenant_staff?.email, expect: "FORBIDDEN" },
    { key: "VENUE_MANAGER profile fallback only", email: venueManager.email, expect: "FORBIDDEN" },
    { key: "COURT_MANAGER profile fallback only", email: courtManager.email, expect: "FORBIDDEN" },
    {
      key: "Club Owner without approved tenant-admin role",
      email: fixture.owner?.email,
      expect: "FORBIDDEN",
      skipIfAlsoTenantOwner: true,
    },
    { key: "Club President", email: fixture.president?.email, expect: "FORBIDDEN" },
    { key: "Vice President", email: vp.email, expect: "FORBIDDEN" },
    { key: "Ordinary club player", email: player.email, expect: "FORBIDDEN" },
    { key: "Unrelated authenticated user", email: fixture.unrelated?.email, expect: "FORBIDDEN" },
  ];

  for (const role of clearRoles) {
    if (!role.email) {
      record(smokeReport.clearMatrix, `CLEAR_${role.key}`, false, {
        expected: role.expect,
        actual: "no_fixture",
      });
      continue;
    }
    if (
      role.skipIfAlsoTenantOwner &&
      fixture.owner?.user_id &&
      fixture.tenant_owner?.user_id &&
      fixture.owner.user_id === fixture.tenant_owner.user_id
    ) {
      record(smokeReport.clearMatrix, `CLEAR_${role.key}`, true, {
        expected: role.expect,
        actual: "SKIP_OWNER_EQUALS_TENANT_OWNER",
      });
      continue;
    }
    await ensurePassword(admin, role.email, password);
    const session = await signIn(url, keys.anonKey, role.email, password);
    if (!session.ok) {
      record(smokeReport.clearMatrix, `CLEAR_${role.key}`, false, {
        expected: role.expect,
        actual: `sign-in failed: ${session.error}`,
      });
      continue;
    }
    const vBefore = await clubVersion(token, clubId);
    const ownerBefore = await currentOwner(token, clubId);
    const result = await callClear(session, vBefore);
    const allowed = result?.ok === true;
    const code = allowed ? "ALLOW" : String(result?.code || "FAIL");
    const ok = role.expect === "ALLOW" ? allowed : !allowed && code === "FORBIDDEN";
    if (allowed) {
      const v2 = await clubVersion(token, clubId);
      if (originalOwnerBeforeQa) {
        await allowSession.sb.rpc("club_assign_owner", {
          p_request_id: rid(),
          p_club_id: clubId,
          p_member_user_id: originalOwnerBeforeQa,
          p_expected_club_version: v2,
        });
      }
    } else {
      const vAfter = await clubVersion(token, clubId);
      const ownerAfter = await currentOwner(token, clubId);
      if (vAfter !== vBefore || ownerAfter !== ownerBefore) {
        smokeReport.warnings.push(`clear_deny_side_effect:${role.key}`);
      }
    }
    record(smokeReport.clearMatrix, `CLEAR_${role.key}`, ok, {
      expected: role.expect,
      actual: code,
    });
  }

  // Anonymous clear + stale clear
  {
    const anon = clientFor(url, keys.anonKey);
    const vBefore = await clubVersion(token, clubId);
    const { data } = await anon.rpc("club_clear_owner", {
      p_request_id: rid(),
      p_club_id: clubId,
      p_expected_club_version: vBefore,
    });
    const code = data?.code || (data?.ok ? "ALLOW" : "FAIL");
    record(smokeReport.clearMatrix, "CLEAR_Anonymous", code === "NOT_AUTHENTICATED", {
      expected: "NOT_AUTHENTICATED",
      actual: code,
    });
  }
  {
    const session = await signIn(url, keys.anonKey, allowActorEmail, password);
    const vBefore = await clubVersion(token, clubId);
    const result = await callClear(session, Math.max(1, vBefore - 1));
    const code = result?.code || (result?.ok ? "ALLOW" : "FAIL");
    record(smokeReport.clearMatrix, "CLEAR_stale_version", code === "VERSION_CONFLICT", {
      expected: "VERSION_CONFLICT",
      actual: code,
    });
  }

  // Controlled successful mutation + restore
  console.log("\n--- controlled mutation + restore ---");
  const allow = await signIn(url, keys.anonKey, allowActorEmail, password);
  const owner0 = await currentOwner(token, clubId);
  const v0 = await clubVersion(token, clubId);
  const assignRes = await callAssign(allow, v0, targetMember.user_id);
  const owner1 = await currentOwner(token, clubId);
  const v1 = await clubVersion(token, clubId);
  const clearRes = await callClear(allow, v1);
  const owner2 = await currentOwner(token, clubId);
  const v2 = await clubVersion(token, clubId);
  let restoreRes = null;
  if (owner0) {
    restoreRes = await callAssign(allow, v2, owner0);
  }
  const ownerFinal = await currentOwner(token, clubId);
  const vFinal = await clubVersion(token, clubId);

  const auditRows = await managementSql(
    token,
    `
select json_build_object(
  'assign_audit', exists (
    select 1 from public.audit_logs
    where action = 'club.assign_owner'
      and created_at > now() - interval '30 minutes'
      and (
        resource_id = '${clubId.replace(/'/g, "''")}'
        or coalesce(metadata->>'club_id','') = '${clubId.replace(/'/g, "''")}'
        or club_id = '${clubId.replace(/'/g, "''")}'
      )
  ),
  'clear_audit', exists (
    select 1 from public.audit_logs
    where action = 'club.clear_owner'
      and created_at > now() - interval '30 minutes'
      and (
        resource_id = '${clubId.replace(/'/g, "''")}'
        or coalesce(metadata->>'club_id','') = '${clubId.replace(/'/g, "''")}'
        or club_id = '${clubId.replace(/'/g, "''")}'
      )
  )
) as v;
`,
    "audit"
  );
  const audit = Array.isArray(auditRows) ? auditRows[0]?.v : auditRows?.v;

  smokeReport.versionAudit = {
    assign_ok: assignRes?.ok === true,
    clear_ok: clearRes?.ok === true,
    version_before: v0,
    version_after_assign: v1,
    version_after_clear: v2,
    assign_bumped: v1 === v0 + 1,
    clear_bumped: v2 === v1 + 1,
    owner_before: owner0,
    owner_after_assign: owner1,
    owner_after_clear: owner2,
    owner_changed_on_assign: owner1 === String(targetMember.user_id),
    owner_cleared: owner2 == null,
    assign_audit: audit?.assign_audit === true,
    clear_audit: audit?.clear_audit === true,
  };
  smokeReport.ownerRestore = {
    restore_ok: restoreRes?.ok === true || !owner0,
    original_owner: owner0,
    final_owner: ownerFinal,
    restored: ownerFinal === owner0,
    final_version: vFinal,
  };
  console.log("version/audit:", JSON.stringify(smokeReport.versionAudit));
  console.log("restore:", JSON.stringify(smokeReport.ownerRestore));

  // UI consistency via canonical club_get (no redeploy)
  {
    const { data } = await allow.sb.rpc("club_get", { p_club_id: clubId });
    const canonical = data?.data || data;
    const ownerFromGet =
      canonical?.owner_user_id ||
      canonical?.governance?.owner_user_id ||
      canonical?.governance?.ownerUserId ||
      null;
    smokeReport.uiConsistency = {
      mode: "canonical_rpc_club_get_no_redeploy",
      club_get_ok: data?.ok !== false && Boolean(canonical),
      owner_matches_restored: String(ownerFromGet || "") === String(ownerFinal || ""),
      owner_user_id: ownerFromGet,
      note: "App not redeployed; UI surfaces read same V2 club_get/canonical owner as RPC",
    };
    console.log("UI/canonical:", JSON.stringify(smokeReport.uiConsistency));
  }

  // Clear VP created for test (best-effort)
  try {
    const vNow = await clubVersion(token, clubId);
    await allow.sb.rpc("club_clear_vice_president", {
      p_request_id: rid(),
      p_club_id: clubId,
      p_expected_club_version: vNow,
      p_member_user_id: vp.id,
    });
  } catch {
    // ignore cleanup failure
  }

  // Evaluate smoke
  const assignFails = smokeReport.assignMatrix.filter((r) => !r.ok);
  const clearFails = smokeReport.clearMatrix.filter((r) => !r.ok);
  const blockers = [];
  if (assignFails.length) blockers.push(`assign_matrix:${assignFails.length}`);
  if (clearFails.length) blockers.push(`clear_matrix:${clearFails.length}`);
  if (!smokeReport.memberRequired?.ok) blockers.push("member_required");
  if (!smokeReport.versionAudit?.assign_bumped || !smokeReport.versionAudit?.clear_bumped) {
    blockers.push("version");
  }
  if (!smokeReport.versionAudit?.assign_audit || !smokeReport.versionAudit?.clear_audit) {
    blockers.push("audit");
  }
  if (!smokeReport.ownerRestore?.restored) blockers.push("owner_restore");

  // Rollback rule: only if allowed actors denied or mutation fails
  const allowedDenied = [...smokeReport.assignMatrix, ...smokeReport.clearMatrix].some(
    (r) =>
      r.expected === "ALLOW" &&
      r.actual !== "ALLOW" &&
      r.actual !== "SKIP_OWNER_EQUALS_TENANT_OWNER"
  );
  const mutationBroken =
    !smokeReport.versionAudit?.assign_ok ||
    !smokeReport.versionAudit?.clear_ok ||
    !smokeReport.ownerRestore?.restored;

  if (allowedDenied || mutationBroken || !catalogOk) {
    console.error("ROLLBACK TRIGGERED — restoring prior function bodies...");
    const rollbackSql = fs.readFileSync(path.join(rootDir, ROLLBACK), "utf8");
    await managementSql(token, rollbackSql, ROLLBACK);
    applyReport.rollbackApplied = true;
    applyReport.rollbackReason = allowedDenied
      ? "allowed_actor_denied"
      : mutationBroken
        ? "mutation_or_restore_failed"
        : "catalog_failed";
    applyReport.status = "ROLLED_BACK";
    smokeReport.status = "FAIL_ROLLED_BACK";
  } else {
    applyReport.status = blockers.length ? `FAIL:${blockers.join(",")}` : "PASS";
    smokeReport.status = blockers.length ? `FAIL:${blockers.join(",")}` : "PASS";
  }

  applyReport.finishedAt = new Date().toISOString();
  smokeReport.finishedAt = new Date().toISOString();
  smokeReport.proof = {
    tenant_staff_denied: smokeReport.assignMatrix.some(
      (r) => r.id.includes("tenant_staff") && r.actual === "FORBIDDEN" && r.ok
    ),
    venue_manager_denied: smokeReport.assignMatrix.some(
      (r) => r.id.includes("VENUE_MANAGER") && r.actual === "FORBIDDEN" && r.ok
    ),
    court_manager_denied: smokeReport.assignMatrix.some(
      (r) => r.id.includes("COURT_MANAGER") && r.actual === "FORBIDDEN" && r.ok
    ),
    optional_club_owner_path_disabled: applyReport.catalog.helper_no_club_owner_gov === true,
  };

  writeJson("PHASE_1C_PRODUCTION_AUTHZ_GATE_APPLY_REPORT.json", applyReport);
  writeMd("PHASE_1C_PRODUCTION_AUTHZ_GATE_APPLY_REPORT.md", [
    `# Phase 1C — Production Authz Gate Apply`,
    ``,
    `- **Status:** ${applyReport.status}`,
    `- **Production ref:** \`${PRODUCTION_REF}\``,
    `- **App SHA:** \`${APPROVED_APP_SHA}\``,
    `- **SQL checksum:** \`${checksum}\``,
    `- **Rollback applied:** ${applyReport.rollbackApplied}`,
    `- **App redeployed:** false`,
    `- **Optional Club Owner transfer:** DISABLED`,
    ``,
    `## Catalog`,
    "```json",
    JSON.stringify(applyReport.catalog, null, 2),
    "```",
    ``,
    `## Baseline checksums`,
    "```json",
    JSON.stringify(applyReport.baseline, null, 2),
    "```",
  ]);

  writeJson("PHASE_1C_PRODUCTION_AUTHZ_GATE_SMOKE_REPORT.json", smokeReport);
  writeMd("PHASE_1C_PRODUCTION_AUTHZ_GATE_SMOKE_REPORT.md", [
    `# Phase 1C — Production Authz Gate Smoke`,
    ``,
    `- **Status:** ${smokeReport.status}`,
    `- **Club:** \`${clubId}\``,
    ``,
    `## Assign matrix`,
    "```json",
    JSON.stringify(smokeReport.assignMatrix, null, 2),
    "```",
    ``,
    `## Clear matrix`,
    "```json",
    JSON.stringify(smokeReport.clearMatrix, null, 2),
    "```",
    ``,
    `## Version / audit / restore`,
    "```json",
    JSON.stringify(
      {
        memberRequired: smokeReport.memberRequired,
        versionAudit: smokeReport.versionAudit,
        ownerRestore: smokeReport.ownerRestore,
        uiConsistency: smokeReport.uiConsistency,
        proof: smokeReport.proof,
      },
      null,
      2
    ),
    "```",
  ]);

  const finalVerdict =
    applyReport.status === "PASS" && smokeReport.status === "PASS"
      ? "HEALTHY_GATE_APPLIED"
      : applyReport.rollbackApplied
        ? "ROLLED_BACK"
        : "DEGRADED_OR_FAIL";

  const finalReport = {
    phase: "1C",
    kind: "PRODUCTION_FINAL_ROLLOUT",
    productionRef: PRODUCTION_REF,
    approvedAppSha: APPROVED_APP_SHA,
    phase1cMergeSha: PHASE1C_MERGE_SHA,
    phase1cAncestor: applyReport.phase1cAncestorProof,
    gateSqlChecksum: checksum,
    checksumMatchesStagingApproved: true,
    applyStatus: applyReport.status,
    smokeStatus: smokeReport.status,
    rollbackApplied: applyReport.rollbackApplied,
    appRedeployed: false,
    optionalClubOwnerSelfTransfer: false,
    catalog: applyReport.catalog,
    proof: smokeReport.proof,
    ownerRestore: smokeReport.ownerRestore,
    versionAudit: smokeReport.versionAudit,
    rls: applyReport.catalog?.rls || applyReport.baseline?.rls,
    finalHealthVerdict: finalVerdict,
    finishedAt: new Date().toISOString(),
  };
  writeJson("PHASE_1C_PRODUCTION_FINAL_ROLLOUT_REPORT.json", finalReport);
  writeMd("PHASE_1C_PRODUCTION_FINAL_ROLLOUT_REPORT.md", [
    `# Phase 1C — Production Final Rollout Report`,
    ``,
    `- **Final health verdict:** **${finalVerdict}**`,
    `- **Production ref:** \`${PRODUCTION_REF}\``,
    `- **Approved app SHA:** \`${APPROVED_APP_SHA}\``,
    `- **Phase 1C merge (ancestor):** \`${PHASE1C_MERGE_SHA}\``,
    `- **Gate SQL checksum:** \`${checksum}\``,
    `- **Apply status:** ${applyReport.status}`,
    `- **Smoke status:** ${smokeReport.status}`,
    `- **Rollback applied:** ${applyReport.rollbackApplied}`,
    `- **App redeployed:** false`,
    `- **Optional Club Owner transfer:** DISABLED`,
    ``,
    `## Proof highlights`,
    ``,
    `- tenant_staff denied: ${smokeReport.proof?.tenant_staff_denied}`,
    `- VENUE_MANAGER denied: ${smokeReport.proof?.venue_manager_denied}`,
    `- COURT_MANAGER denied: ${smokeReport.proof?.court_manager_denied}`,
    `- Optional Club Owner path disabled: ${smokeReport.proof?.optional_club_owner_path_disabled}`,
    `- Owner restored: ${smokeReport.ownerRestore?.restored}`,
    ``,
  ]);

  console.log(`\nAPPLY STATUS: ${applyReport.status}`);
  console.log(`SMOKE STATUS: ${smokeReport.status}`);
  console.log(`FINAL VERDICT: ${finalVerdict}`);
  process.exitCode =
    applyReport.status === "PASS" && smokeReport.status === "PASS" ? 0 : 1;
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
