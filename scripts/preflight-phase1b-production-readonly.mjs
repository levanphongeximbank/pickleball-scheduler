#!/usr/bin/env node
/**
 * Phase 1B — Production READ-ONLY preflight (planning only).
 *
 * Hard guards:
 *  - Target MUST be Production ref expuvcohlcjzvrrauvud
 *  - Staging ref qyewbxjsiiyufanzcjcq must NOT be queried
 *  - SELECT / catalog probes only — no DDL, DML, APPLY, or deploy
 *  - Refuses any SQL containing mutating keywords
 *
 * Requires: SUPABASE_ACCESS_TOKEN (Management API)
 *
 * Usage:
 *   node scripts/preflight-phase1b-production-readonly.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";
import { loadProjectEnv } from "./load-env.mjs";
import {
  PHASE_1B_KNOWN_AUDIT_ACTIONS,
  LEGACY_FIXED_45A3C_AUDIT_ACTIONS,
  parseActionLiteralsFromConstraintDef,
  assessAuditPreflight,
} from "./apply-phase1b-staging-sql.mjs";

const STAGING_REF = "qyewbxjsiiyufanzcjcq";
const PRODUCTION_REF = "expuvcohlcjzvrrauvud";
const APPROVED_MAIN_SHA = "959c8067ea756aa32e50b549a97cd4e762786ff7";
const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = path.join(rootDir, "docs/v5/qa-evidence/phase1b-production");
const OUT_JSON = path.join(OUT_DIR, "PRODUCTION_PREFLIGHT_REPORT.json");
const OUT_MD = path.join(OUT_DIR, "PRODUCTION_PREFLIGHT_REPORT.md");

/** Statement-leading mutations only (avoids false positives on string literals like 'UPDATE'). */
const MUTATION_RE =
  /(^|;)\s*(insert|update|delete|truncate|drop|alter|create|grant|revoke|vacuum|reindex|copy|call|do)\b/i;

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
}

async function executeProductionSelect(token, sql, label) {
  assertReadOnlySql(sql, label);
  const res = await fetch(
    `https://api.supabase.com/v1/projects/${PRODUCTION_REF}/database/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
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
    body = text;
  }
  if (!res.ok) {
    const msg = typeof body === "string" ? body : JSON.stringify(body);
    throw new Error(`Production query failed (${label}): HTTP ${res.status} ${msg}`);
  }
  return body;
}

function gitSha(rev) {
  try {
    return execSync(`git rev-parse ${rev}`, { cwd: rootDir, encoding: "utf8" }).trim();
  } catch {
    return null;
  }
}

const SNAPSHOT_SQL = `
select json_build_object(
  'target_safety', json_build_object(
    'expected_production_ref', '${PRODUCTION_REF}',
    'staging_ref_must_not_be_used', '${STAGING_REF}',
    'approved_main_sha', '${APPROVED_MAIN_SHA}'
  ),
  'audit', json_build_object(
    'constraint_exists', exists (
      select 1
      from pg_constraint c
      join pg_class t on t.oid = c.conrelid
      join pg_namespace n on n.oid = t.relnamespace
      where n.nspname = 'public'
        and t.relname = 'audit_logs'
        and c.conname = 'audit_logs_action_check'
    ),
    'constraint_def', (
      select pg_get_constraintdef(c.oid)
      from pg_constraint c
      join pg_class t on t.oid = c.conrelid
      join pg_namespace n on n.oid = t.relnamespace
      where n.nspname = 'public'
        and t.relname = 'audit_logs'
        and c.conname = 'audit_logs_action_check'
    ),
    'distinct_actions', (
      select coalesce(json_agg(json_build_object(
        'action', s.action,
        'row_count', s.row_count
      ) order by s.action), '[]'::json)
      from (
        select action, count(*)::bigint as row_count
        from public.audit_logs
        where action is not null
        group by action
      ) s
    ),
    'null_action_rows', (
      select count(*)::bigint from public.audit_logs where action is null
    )
  ),
  'rpc_inventory', (
    select coalesce(json_agg(json_build_object(
      'proname', p.proname,
      'identity_args', pg_get_function_identity_arguments(p.oid),
      'result', pg_get_function_result(p.oid),
      'security_definer', p.prosecdef,
      'proconfig', p.proconfig,
      'search_path_from_config', (
        select coalesce(
          (select substring(cfg from 'search_path=(.*)$')
           from unnest(coalesce(p.proconfig, array[]::text[])) cfg
           where cfg like 'search_path=%'
           limit 1),
          null
        )
      ),
      'oid', p.oid::text
    ) order by p.proname, pg_get_function_identity_arguments(p.oid)), '[]'::json)
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'club_update',
        'club_add_member',
        'club_remove_member',
        'club_restore_member',
        'club_assign_vice_president',
        'club_clear_vice_president',
        'phase42_can_update_club',
        'phase42_can_manage_vice_presidents',
        'phase42_club_canonical',
        'phase42_is_tenant_member',
        'phase42_write_audit',
        'club_list_members'
      )
  ),
  'rpc_body_checks', json_build_object(
    'club_update_exists', to_regprocedure('public.club_update(uuid, text, integer, text, text, text, text, text)') is not null,
    'club_update_uses_can_update_club', (
      select case when to_regprocedure('public.club_update(uuid, text, integer, text, text, text, text, text)') is null then null
        else pg_get_functiondef(to_regprocedure('public.club_update(uuid, text, integer, text, text, text, text, text)'))
          ilike '%phase42_can_update_club%'
      end
    ),
    'club_update_uses_bare_tenant_member', (
      select case when to_regprocedure('public.club_update(uuid, text, integer, text, text, text, text, text)') is null then null
        else pg_get_functiondef(to_regprocedure('public.club_update(uuid, text, integer, text, text, text, text, text)'))
          ilike '%phase42_is_tenant_member%'
      end
    ),
    'vp_assign_exists', to_regprocedure('public.club_assign_vice_president(uuid, uuid, text, integer)') is not null
      or exists (
        select 1 from pg_proc p
        join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public' and p.proname = 'club_assign_vice_president'
      ),
    'canonical_has_vp_fields', (
      select case when not exists (
        select 1 from pg_proc p
        join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public' and p.proname = 'phase42_club_canonical'
      ) then null
      else (
        select bool_or(pg_get_functiondef(p.oid) ilike '%vice_president_user_ids%')
        from pg_proc p
        join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public' and p.proname = 'phase42_club_canonical'
      )
      end
    )
  ),
  'schema', json_build_object(
    'clubs_columns', (
      select coalesce(json_agg(json_build_object(
        'column_name', c.column_name,
        'data_type', c.data_type,
        'udt_name', c.udt_name,
        'is_nullable', c.is_nullable
      ) order by c.ordinal_position), '[]'::json)
      from information_schema.columns c
      where c.table_schema = 'public' and c.table_name = 'clubs'
    ),
    'club_members_columns', (
      select coalesce(json_agg(json_build_object(
        'column_name', c.column_name,
        'data_type', c.data_type,
        'udt_name', c.udt_name,
        'is_nullable', c.is_nullable
      ) order by c.ordinal_position), '[]'::json)
      from information_schema.columns c
      where c.table_schema = 'public' and c.table_name = 'club_members'
    ),
    'tables_exist', json_build_object(
      'clubs', to_regclass('public.clubs') is not null,
      'club_members', to_regclass('public.club_members') is not null,
      'club_governance_assignments', to_regclass('public.club_governance_assignments') is not null,
      'audit_logs', to_regclass('public.audit_logs') is not null
    )
  ),
  'rls', (
    select coalesce(json_agg(json_build_object(
      'schemaname', n.nspname,
      'tablename', c.relname,
      'policyname', p.polname,
      'cmd', case p.polcmd
        when 'r' then 'SELECT'
        when 'a' then 'INSERT'
        when 'w' then 'UPDATE'
        when 'd' then 'DELETE'
        when '*' then 'ALL'
        else p.polcmd::text
      end,
      'permissive', case when p.polpermissive then 'PERMISSIVE' else 'RESTRICTIVE' end,
      'roles', (
        select coalesce(array_agg(r.rolname order by r.rolname), array[]::name[])
        from pg_roles r
        where r.oid = any (p.polroles)
      ),
      'qual', pg_get_expr(p.polqual, p.polrelid),
      'with_check', pg_get_expr(p.polwithcheck, p.polrelid)
    ) order by c.relname, p.polname), '[]'::json)
    from pg_policy p
    join pg_class c on c.oid = p.polrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname in ('clubs', 'club_members', 'club_governance_assignments', 'audit_logs')
  ),
  'rls_enabled', (
    select coalesce(json_agg(json_build_object(
      'table', c.relname,
      'rls_enabled', c.relrowsecurity,
      'rls_forced', c.relforcerowsecurity
    ) order by c.relname), '[]'::json)
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname in ('clubs', 'club_members', 'club_governance_assignments', 'audit_logs')
  ),
  'data', json_build_object(
    'club_status_counts', (
      select coalesce(json_agg(json_build_object(
        'status', s.status,
        'row_count', s.row_count
      ) order by s.status), '[]'::json)
      from (
        select status::text as status, count(*)::bigint as row_count
        from public.clubs
        group by status
      ) s
    ),
    'club_null_tenant', (
      select count(*)::bigint from public.clubs where tenant_id is null
    ),
    'club_total', (select count(*)::bigint from public.clubs),
    'member_status_counts', (
      select coalesce(json_agg(json_build_object(
        'status', s.status,
        'row_count', s.row_count
      ) order by s.status), '[]'::json)
      from (
        select status::text as status, count(*)::bigint as row_count
        from public.club_members
        group by status
      ) s
    ),
    'member_null_tenant', (
      select count(*)::bigint from public.club_members where tenant_id is null
    ),
    'member_total', (select count(*)::bigint from public.club_members),
    'duplicate_active_memberships', (
      select coalesce(json_agg(json_build_object(
        'club_id', d.club_id,
        'user_id', d.user_id,
        'active_rows', d.active_rows
      ) order by d.active_rows desc), '[]'::json)
      from (
        select club_id, user_id, count(*)::bigint as active_rows
        from public.club_members
        where status = 'active'
          and user_id is not null
        group by club_id, user_id
        having count(*) > 1
        limit 50
      ) d
    ),
    'duplicate_active_count', (
      select count(*)::bigint from (
        select club_id, user_id
        from public.club_members
        where status = 'active' and user_id is not null
        group by club_id, user_id
        having count(*) > 1
      ) x
    ),
    'vp_assignments_active', (
      select count(*)::bigint
      from public.club_governance_assignments
      where role_code = 'vice_president' and status = 'active'
    ),
    'vp_assignments_by_status', (
      select coalesce(json_agg(json_build_object(
        'status', s.status,
        'row_count', s.row_count
      ) order by s.status), '[]'::json)
      from (
        select status::text as status, count(*)::bigint as row_count
        from public.club_governance_assignments
        where role_code = 'vice_president'
        group by status
      ) s
    ),
    'clubs_with_gt_2_active_vp', (
      select coalesce(json_agg(json_build_object(
        'club_id', x.club_id,
        'active_vp_count', x.active_vp_count
      ) order by x.active_vp_count desc), '[]'::json)
      from (
        select club_id, count(*)::bigint as active_vp_count
        from public.club_governance_assignments
        where role_code = 'vice_president' and status = 'active'
        group by club_id
        having count(*) > 2
        limit 50
      ) x
    )
  )
) as snapshot;
`;

function requiredClubColumnsPresent(cols) {
  const names = new Set((cols || []).map((c) => c.column_name));
  const required = [
    "id",
    "tenant_id",
    "name",
    "code",
    "description",
    "status",
    "registered_cluster_id",
    "version",
  ];
  return {
    required,
    missing: required.filter((n) => !names.has(n)),
    present: required.filter((n) => names.has(n)),
  };
}

function requiredMemberColumnsPresent(cols) {
  const names = new Set((cols || []).map((c) => c.column_name));
  const required = ["id", "tenant_id", "club_id", "user_id", "status", "version", "role_code"];
  return {
    required,
    missing: required.filter((n) => !names.has(n)),
    present: required.filter((n) => names.has(n)),
  };
}

function buildVerdict(report) {
  const blockers = [];
  const warnings = [];

  if (report.targetSafety?.productionRef !== PRODUCTION_REF) {
    blockers.push("Production ref mismatch");
  }
  if (report.targetSafety?.stagingQueried) {
    blockers.push("Staging was queried — abort");
  }
  if (report.targetSafety?.approvedMainShaOnOrigin !== APPROVED_MAIN_SHA) {
    warnings.push(
      `origin/main SHA is ${report.targetSafety?.approvedMainShaOnOrigin}; expected ${APPROVED_MAIN_SHA}`
    );
  }

  const tables = report.snapshot?.schema?.tables_exist || {};
  for (const t of ["clubs", "club_members", "club_governance_assignments", "audit_logs"]) {
    if (!tables[t]) blockers.push(`Missing table public.${t}`);
  }

  const clubCols = requiredClubColumnsPresent(report.snapshot?.schema?.clubs_columns);
  const memberCols = requiredMemberColumnsPresent(report.snapshot?.schema?.club_members_columns);
  if (clubCols.missing.length) blockers.push(`clubs missing columns: ${clubCols.missing.join(", ")}`);
  if (memberCols.missing.length) {
    // role_code may be named differently — warn if only that
    if (memberCols.missing.length === 1 && memberCols.missing[0] === "role_code") {
      warnings.push("club_members.role_code not found — confirm member role column naming before apply");
    } else {
      blockers.push(`club_members missing columns: ${memberCols.missing.join(", ")}`);
    }
  }

  if ((report.snapshot?.data?.club_null_tenant || 0) > 0) {
    blockers.push(`clubs with null tenant_id: ${report.snapshot.data.club_null_tenant}`);
  }
  if ((report.snapshot?.data?.member_null_tenant || 0) > 0) {
    warnings.push(`club_members with null tenant_id: ${report.snapshot.data.member_null_tenant}`);
  }
  if ((report.snapshot?.data?.duplicate_active_count || 0) > 0) {
    warnings.push(
      `Duplicate active memberships (club_id,user_id): ${report.snapshot.data.duplicate_active_count}`
    );
  }
  if ((report.snapshot?.data?.clubs_with_gt_2_active_vp || []).length > 0) {
    warnings.push("Clubs with >2 active VP assignments exist — VP max-2 RPC will reject further assigns");
  }

  if (report.auditAssessment?.wouldRejectExistingRows) {
    blockers.push("Additive audit assessment unexpectedly incompatible with historical rows");
  }

  const partial = report.partialDeployment || {};
  const anyPhase1b = Object.values(partial.objects || {}).some(Boolean);
  if (anyPhase1b) {
    warnings.push("Some Phase 1B RPC/helper objects already exist on Production (partial or prior apply)");
  }

  const rls = report.snapshot?.rls_enabled || [];
  for (const row of rls) {
    if (!row.rls_enabled) warnings.push(`RLS disabled on public.${row.table}`);
  }

  let verdict = "READY_FOR_OWNER_GO";
  if (blockers.length) verdict = "BLOCKED";
  else if (warnings.length) verdict = "READY_WITH_WARNINGS";

  return { verdict, blockers, warnings, clubCols, memberCols };
}

function toMarkdown(report) {
  const v = report.verdict;
  const lines = [];
  lines.push("# Phase 1B — Production Preflight Report (READ-ONLY)");
  lines.push("");
  lines.push(`**Verdict:** ${v.verdict}`);
  lines.push(`**Generated:** ${report.generatedAt}`);
  lines.push(`**Production ref:** \`${report.targetSafety.productionRef}\``);
  lines.push(`**Staging ref (not targeted):** \`${report.targetSafety.stagingRef}\``);
  lines.push(`**Approved main SHA:** \`${report.targetSafety.approvedMainSha}\``);
  lines.push(`**origin/main at preflight:** \`${report.targetSafety.approvedMainShaOnOrigin}\``);
  lines.push(`**Production changes made:** **NONE** (SELECT-only)`);
  lines.push("");
  lines.push("## Blockers");
  if (!v.blockers.length) lines.push("- (none)");
  else v.blockers.forEach((b) => lines.push(`- ${b}`));
  lines.push("");
  lines.push("## Warnings");
  if (!v.warnings.length) lines.push("- (none)");
  else v.warnings.forEach((w) => lines.push(`- ${w}`));
  lines.push("");
  lines.push("## RPC inventory (Production)");
  const inv = report.snapshot?.rpc_inventory || [];
  if (!inv.length) lines.push("- (no Phase 1B target functions found)");
  else {
    lines.push("| Function | Args | SECURITY DEFINER | search_path |");
    lines.push("|----------|------|------------------|------------|");
    for (const f of inv) {
      lines.push(
        `| \`${f.proname}\` | \`${f.identity_args || ""}\` | ${f.security_definer} | \`${f.search_path_from_config || "(default)"}\` |`
      );
    }
  }
  lines.push("");
  lines.push("## Partial-deployment findings");
  lines.push("```json");
  lines.push(JSON.stringify(report.partialDeployment, null, 2));
  lines.push("```");
  lines.push("");
  lines.push("## Audit constraint");
  lines.push(`- Exists: ${report.snapshot?.audit?.constraint_exists}`);
  lines.push(`- Distinct actions: ${(report.snapshot?.audit?.distinct_actions || []).length}`);
  lines.push(
    `- Incompatible with additive whitelist: ${(report.auditAssessment?.incompatibleHistoricalValues || []).length}`
  );
  lines.push(
    `- Would be rejected by legacy fixed 45A.3C list: ${(report.auditAssessment?.incompatibleWithFixedLegacy || []).length}`
  );
  lines.push("");
  lines.push("## Data compatibility (counts only)");
  lines.push("```json");
  lines.push(
    JSON.stringify(
      {
        clubs: {
          total: report.snapshot?.data?.club_total,
          null_tenant: report.snapshot?.data?.club_null_tenant,
          statuses: report.snapshot?.data?.club_status_counts,
        },
        members: {
          total: report.snapshot?.data?.member_total,
          null_tenant: report.snapshot?.data?.member_null_tenant,
          statuses: report.snapshot?.data?.member_status_counts,
          duplicate_active_count: report.snapshot?.data?.duplicate_active_count,
        },
        vp: {
          active: report.snapshot?.data?.vp_assignments_active,
          by_status: report.snapshot?.data?.vp_assignments_by_status,
          clubs_gt_2: report.snapshot?.data?.clubs_with_gt_2_active_vp,
        },
      },
      null,
      2
    )
  );
  lines.push("```");
  lines.push("");
  lines.push("## Proposed Production SQL order");
  report.proposedSqlOrder.forEach((row, i) => {
    lines.push(`${i + 1}. \`${row.file}\` — ${row.purpose}`);
  });
  lines.push("");
  lines.push("## Proposed code deployment");
  lines.push(`1. Deploy app from main SHA \`${APPROVED_MAIN_SHA}\` **after** SQL catalog verification.`);
  lines.push("2. Do not enable Phase 1C.");
  lines.push("");
  lines.push("## Explicit confirmation");
  lines.push("No Production SQL was applied. No Production data was modified. No Production code was deployed by this preflight.");
  lines.push("");
  return lines.join("\n");
}

async function main() {
  loadProjectEnv();
  const token = String(process.env.SUPABASE_ACCESS_TOKEN || "").trim();
  if (!token) {
    console.error("Set SUPABASE_ACCESS_TOKEN");
    process.exitCode = 1;
    return;
  }

  const originMain = gitSha("origin/main");
  const report = {
    phase: "1B",
    kind: "PRODUCTION_PREFLIGHT_READONLY",
    generatedAt: new Date().toISOString(),
    productionTouched: false,
    sqlApplied: false,
    codeDeployed: false,
    targetSafety: {
      productionRef: PRODUCTION_REF,
      stagingRef: STAGING_REF,
      stagingQueried: false,
      approvedMainSha: APPROVED_MAIN_SHA,
      approvedMainShaOnOrigin: originMain,
      headSha: gitSha("HEAD"),
    },
    snapshot: null,
    auditAssessment: null,
    partialDeployment: null,
    proposedSqlOrder: [
      {
        file: "docs/v5/phase1b/PHASE_1B_AUDIT_WHITELIST_ADDITIVE.sql",
        purpose: "Additive audit_logs_action_check union (preserves history)",
      },
      {
        file: "docs/v5/phase45a3c/PHASE_45A3C_CLUB_UPDATE_RPC.sql",
        purpose: "phase42_can_update_club + club_update",
      },
      {
        file: "docs/v5/phase45a4c1/PHASE_45A4C1_MEMBER_RPC.sql",
        purpose: "club_add_member / club_remove_member",
      },
      {
        file: "docs/v5/phase45a4d1/PHASE_45A4D1_MEMBER_RESTORE_RPC.sql",
        purpose: "club_restore_member",
      },
      {
        file: "docs/v5/phase1b/PHASE_1B_V2_COMMAND_COMPLETION.sql",
        purpose: "VP hydrate + phase42_can_manage_vice_presidents + VP RPCs",
      },
      {
        file: "docs/v5/phase1b/PHASE_1B_CLUB_UPDATE_AUTHZ_SECURITY_GATE.sql",
        purpose: "Idempotent club_update authz gate (safe if already in 45A.3C)",
      },
      {
        file: "(catalog verification SELECT)",
        purpose: "Verify functions, auth predicates, audit constraint, canonical VP fields",
      },
      {
        file: `(code deploy) main@${APPROVED_MAIN_SHA}`,
        purpose: "Deploy application code after SQL verify; no Phase 1C",
      },
    ],
    orderSafeForProductionState: null,
    rollbackPlan: null,
    smokeTestPlan: null,
    verdict: null,
    error: null,
  };

  console.log("Phase 1B Production READ-ONLY preflight");
  console.log(`PRODUCTION: ${PRODUCTION_REF}`);
  console.log(`STAGING: ${STAGING_REF} (must NOT be queried)`);
  console.log(`APPROVED SHA: ${APPROVED_MAIN_SHA}`);
  console.log("Mode: SELECT-only — no apply / no deploy / no data mutation");

  try {
    const body = await executeProductionSelect(token, SNAPSHOT_SQL, "production-snapshot");
    const snapshot = Array.isArray(body) ? body[0]?.snapshot : body?.snapshot;
    if (!snapshot) {
      throw new Error(`Unexpected snapshot response: ${JSON.stringify(body).slice(0, 500)}`);
    }
    report.snapshot = snapshot;

    const assessment = assessAuditPreflight({
      constraintDef: snapshot.audit?.constraint_def,
      distinctActions: snapshot.audit?.distinct_actions,
      knownActions: PHASE_1B_KNOWN_AUDIT_ACTIONS,
      fixedLegacyActions: LEGACY_FIXED_45A3C_AUDIT_ACTIONS,
    });
    // Surface fixed-legacy incompatibles for diagnostics (additive remains safe).
    assessment.incompatibleWithFixedLegacy = (snapshot.audit?.distinct_actions || [])
      .map((r) => r.action)
      .filter((a) => a && !LEGACY_FIXED_45A3C_AUDIT_ACTIONS.includes(a))
      .sort();
    report.auditAssessment = {
      ...assessment,
      currentAcceptedActions: parseActionLiteralsFromConstraintDef(snapshot.audit?.constraint_def),
    };

    const byName = {};
    for (const f of snapshot.rpc_inventory || []) {
      byName[f.proname] = byName[f.proname] || [];
      byName[f.proname].push(f);
    }
    const has = (name) => Array.isArray(byName[name]) && byName[name].length > 0;
    report.partialDeployment = {
      anyPhase1bObjectsPresent: [
        "club_update",
        "club_add_member",
        "club_remove_member",
        "club_restore_member",
        "club_assign_vice_president",
        "club_clear_vice_president",
        "phase42_can_update_club",
        "phase42_can_manage_vice_presidents",
      ].some(has),
      objects: {
        club_update: has("club_update"),
        club_add_member: has("club_add_member"),
        club_remove_member: has("club_remove_member"),
        club_restore_member: has("club_restore_member"),
        club_assign_vice_president: has("club_assign_vice_president"),
        club_clear_vice_president: has("club_clear_vice_president"),
        phase42_can_update_club: has("phase42_can_update_club"),
        phase42_can_manage_vice_presidents: has("phase42_can_manage_vice_presidents"),
        phase42_club_canonical: has("phase42_club_canonical"),
        club_list_members: has("club_list_members"),
      },
      bodyChecks: snapshot.rpc_body_checks || null,
    };

    const verdict = buildVerdict(report);
    report.verdict = verdict;

    const orderSafe =
      !verdict.blockers.length &&
      !report.auditAssessment.wouldRejectExistingRows &&
      snapshot.schema?.tables_exist?.clubs &&
      snapshot.schema?.tables_exist?.club_members;
    report.orderSafeForProductionState = orderSafe
      ? "YES — proposed order matches Staging-proven sequence; additive audit first remains mandatory"
      : "NO — resolve blockers before apply";

    report.rollbackPlan = {
      database: [
        "Prefer CREATE OR REPLACE reverse of prior known-good function bodies if available; do not DROP tables.",
        "Audit whitelist: do not DROP constraint to a narrower fixed list; leave additive union in place (preserves history).",
        "If a single RPC misbehaves: replace that function only; leave others.",
        "FORBIDDEN: DELETE/TRUNCATE audit_logs, clubs, club_members, club_governance_assignments.",
      ],
      code: [
        `Redeploy previous production app SHA (pre-Phase-1B client cutover) if client regressions appear.`,
        `Approved Phase 1B code SHA to roll forward: ${APPROVED_MAIN_SHA}`,
        "Feature-flag Club Storage V2 OFF restores V1 fallbacks for add/remove where present.",
      ],
      conditions: [
        "Authz allow/deny matrix fails smoke tests",
        "Audit inserts fail (23514) despite additive apply",
        "Home/Members count divergence after restore/add",
        "Unexpected PRODUCTION data mutation outside RPC envelopes",
      ],
      auditPreservation:
        "Never delete or truncate audit_logs. Additive constraint must remain a superset of historical actions.",
    };

    report.smokeTestPlan = {
      productionRef: PRODUCTION_REF,
      codeSha: APPROVED_MAIN_SHA,
      cases: [
        "club profile update (authorized) + version increment + club.update audit",
        "stale expected version → VERSION_CONFLICT",
        "ordinary tenant member club_update → FORBIDDEN",
        "VP assign (1 then 2) + clear one + clear all",
        "third VP → rejection",
        "president-as-VP → rejection",
        "member add / duplicate ALREADY_MEMBER / remove / restore",
        "Home active_member_count == club_list_members active length",
        "notification recipients: active+user_id only; no left/removed",
        "audits: club.update, club.member.add/remove/restore, club.assign_vice_president, club.clear_vice_president",
        "V1 flag-OFF: legacy add/remove paths still reachable; restore remains V2-only",
      ],
      note: "Use dedicated Production smoke club; restore name/state after tests; no truncate.",
    };

    fs.mkdirSync(OUT_DIR, { recursive: true });
    // Strip potentially huge policy expressions from console; keep full in JSON.
    fs.writeFileSync(OUT_JSON, JSON.stringify(report, null, 2));
    fs.writeFileSync(OUT_MD, toMarkdown(report));

    console.log(`\nVerdict: ${verdict.verdict}`);
    console.log(`Evidence JSON: ${OUT_JSON}`);
    console.log(`Evidence MD:   ${OUT_MD}`);
    console.log(`Order safe: ${report.orderSafeForProductionState}`);
    console.log("Production touched: false");
    if (verdict.blockers.length) process.exitCode = 2;
  } catch (err) {
    report.error = String(err?.message || err);
    fs.mkdirSync(OUT_DIR, { recursive: true });
    fs.writeFileSync(OUT_JSON, JSON.stringify(report, null, 2));
    console.error(report.error);
    process.exitCode = 1;
  }
}

main();
