#!/usr/bin/env node
/**
 * Phase 1C — Production READ-ONLY preflight for club owner assign authz gate.
 *
 * Hard guards:
 *  - Target MUST be Production ref expuvcohlcjzvrrauvud
 *  - Staging ref qyewbxjsiiyufanzcjcq must NOT be queried
 *  - SELECT / catalog probes only — no DDL, DML, APPLY, or deploy
 *
 * Requires: SUPABASE_ACCESS_TOKEN
 *
 * Usage:
 *   node scripts/preflight-phase1c-club-owner-assign-authz-production-readonly.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";
import { loadProjectEnv } from "./load-env.mjs";

const STAGING_REF = "qyewbxjsiiyufanzcjcq";
const PRODUCTION_REF = "expuvcohlcjzvrrauvud";
const APPROVED_APP_SHA = "827a71c50eaf744c77b1e31afbfc774c6241d388";
const GATE_SQL = "docs/v5/phase1c/PHASE_1C_CLUB_OWNER_ASSIGN_AUTHZ_SECURITY_GATE.sql";
const ROLLBACK_SQL = "docs/v5/phase1c/PHASE_1C_CLUB_OWNER_ASSIGN_AUTHZ_ROLLBACK.sql";
const STAGING_EVIDENCE =
  "docs/v5/qa-evidence/phase1c-staging/CLUB_OWNER_ASSIGN_AUTHZ_GATE_REPORT.json";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(rootDir, "docs/v5/qa-evidence/phase1c-production");

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

async function confirmProjectIdentity(token) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${PRODUCTION_REF}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`Cannot prove Production project identity: HTTP ${res.status}`);
  }
  const id = String(body.id || body.ref || "").trim();
  if (id !== PRODUCTION_REF) {
    throw new Error(`STOP — project identity mismatch: got ${id}`);
  }
  if (id === STAGING_REF) {
    throw new Error("STOP — Staging ref resolved as Production");
  }
  return {
    ref: id,
    name: body.name || null,
    region: body.region || null,
    status: body.status || null,
  };
}

function analyzeGateSql(text) {
  const noComments = text.replace(/--[^\n]*/g, "").replace(/\/\*[\s\S]*?\*\//g, "");
  return {
    hasCreateOrReplace: /create\s+or\s+replace\s+function/i.test(text),
    hasDelete: /\bdelete\s+from\b/i.test(noComments),
    hasTruncate: /\btruncate\b/i.test(noComments),
    hasDropTable: /\bdrop\s+table\b/i.test(noComments),
    hasRlsDisable: /disable\s+row\s+level\s+security/i.test(noComments),
    hasAuditCleanup: /delete\s+from\s+.*audit/i.test(noComments),
    usesNarrowHelper: /phase42_can_assign_club_owner/i.test(text),
    usesBareTenantMemberInActiveBody: (() => {
      // OPTIONAL commented block may mention club_owner; live authz must use helper
      const helperIdx = text.indexOf("create or replace function public.phase42_can_assign_club_owner");
      const assignIdx = text.indexOf("CREATE OR REPLACE FUNCTION public.club_assign_owner");
      const optionalIdx = text.indexOf("OPTIONAL (Owner GO required)");
      const live = text.slice(assignIdx, optionalIdx > 0 ? optionalIdx : text.length);
      return /phase42_is_tenant_member\s*\(/.test(live);
    })(),
    optionalClubOwnerEnabled: (() => {
      const optional = text.slice(text.indexOf("OPTIONAL (Owner GO required)"));
      // live (uncommented) has_gov_role club_owner in helper body before OPTIONAL?
      const helperBody = text.slice(
        text.indexOf("create or replace function public.phase42_can_assign_club_owner"),
        text.indexOf("CREATE OR REPLACE FUNCTION public.club_assign_owner")
      );
      return /phase42_has_gov_role\s*\([^\)]*club_owner/i.test(helperBody);
    })(),
  };
}

function analyzeRollbackSql(text) {
  const noComments = text.replace(/--[^\n]*/g, "").replace(/\/\*[\s\S]*?\*\//g, "");
  return {
    restoresAssign: /create\s+or\s+replace\s+function\s+public\.club_assign_owner/i.test(text),
    restoresClear: /create\s+or\s+replace\s+function\s+public\.club_clear_owner/i.test(text),
    dropsHelper: /drop\s+function\s+if\s+exists\s+public\.phase42_can_assign_club_owner/i.test(text),
    restoresBareTenantMember: /phase42_is_tenant_member\s*\(/i.test(text),
    hasDelete: /\bdelete\s+from\b/i.test(noComments),
    hasTruncate: /\btruncate\b/i.test(noComments),
    hasDropTable: /\bdrop\s+table\b/i.test(noComments),
    hasAuditCleanup: /delete\s+from\s+.*audit/i.test(noComments),
    revertsAppCode: false,
  };
}

const CATALOG_SQL = `
select json_build_object(
  'project_guard', json_build_object(
    'queried_via_api_path', '${PRODUCTION_REF}',
    'must_not_be_staging', '${STAGING_REF}'
  ),
  'functions', json_build_object(
    'club_assign_owner', (
      select json_build_object(
        'exists', true,
        'oid', p.oid::text,
        'security_definer', p.prosecdef,
        'volatility', p.provolatile,
        'arguments', pg_get_function_identity_arguments(p.oid),
        'definition', pg_get_functiondef(p.oid)
      )
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = 'club_assign_owner'
      order by p.oid
      limit 1
    ),
    'club_clear_owner', (
      select json_build_object(
        'exists', true,
        'oid', p.oid::text,
        'security_definer', p.prosecdef,
        'arguments', pg_get_function_identity_arguments(p.oid),
        'definition', pg_get_functiondef(p.oid)
      )
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = 'club_clear_owner'
      order by p.oid
      limit 1
    ),
    'phase42_is_tenant_member', (
      select json_build_object(
        'exists', true,
        'oid', p.oid::text,
        'security_definer', p.prosecdef,
        'arguments', pg_get_function_identity_arguments(p.oid),
        'definition', pg_get_functiondef(p.oid)
      )
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = 'phase42_is_tenant_member'
      order by p.oid
      limit 1
    ),
    'phase42_can_assign_club_owner', (
      select case when to_regprocedure('public.phase42_can_assign_club_owner(text)') is null then
        json_build_object('exists', false)
      else json_build_object(
        'exists', true,
        'oid', to_regprocedure('public.phase42_can_assign_club_owner(text)')::oid::text,
        'security_definer', (
          select prosecdef from pg_proc where oid = to_regprocedure('public.phase42_can_assign_club_owner(text)')::oid
        ),
        'definition', pg_get_functiondef(to_regprocedure('public.phase42_can_assign_club_owner(text)'))
      ) end
    ),
    'user_has_permission', (
      select json_build_object(
        'exists', to_regprocedure('public.user_has_permission(text)') is not null
      )
    ),
    'phase42_is_platform_super_admin', (
      select json_build_object(
        'exists', to_regprocedure('public.phase42_is_platform_super_admin()') is not null
      )
    ),
    'phase42_write_audit', (
      select json_build_object(
        'exists', exists (
          select 1 from pg_proc p
          join pg_namespace n on n.oid = p.pronamespace
          where n.nspname='public' and p.proname='phase42_write_audit'
        )
      )
    )
  ),
  'grants', json_build_object(
    'club_assign_owner_authenticated', exists (
      select 1 from information_schema.routine_privileges
      where specific_schema='public' and routine_name='club_assign_owner'
        and grantee='authenticated' and privilege_type='EXECUTE'
    ),
    'club_clear_owner_authenticated', exists (
      select 1 from information_schema.routine_privileges
      where specific_schema='public' and routine_name='club_clear_owner'
        and grantee='authenticated' and privilege_type='EXECUTE'
    )
  ),
  'rls', json_build_object(
    'clubs_rls_enabled', (
      select c.relrowsecurity from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname='public' and c.relname='clubs'
    ),
    'club_members_rls_enabled', (
      select c.relrowsecurity from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname='public' and c.relname='club_members'
    ),
    'club_governance_assignments_rls_enabled', (
      select c.relrowsecurity from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname='public' and c.relname='club_governance_assignments'
    )
  ),
  'tables', json_build_object(
    'clubs', to_regclass('public.clubs') is not null,
    'club_members', to_regclass('public.club_members') is not null,
    'club_governance_assignments', to_regclass('public.club_governance_assignments') is not null,
    'tenant_members', to_regclass('public.tenant_members') is not null,
    'profiles', to_regclass('public.profiles') is not null,
    'audit_logs', to_regclass('public.audit_logs') is not null
  ),
  'columns', json_build_object(
    'clubs_id', exists (select 1 from information_schema.columns where table_schema='public' and table_name='clubs' and column_name='id'),
    'clubs_tenant_id', exists (select 1 from information_schema.columns where table_schema='public' and table_name='clubs' and column_name='tenant_id'),
    'clubs_version', exists (select 1 from information_schema.columns where table_schema='public' and table_name='clubs' and column_name='version'),
    'clubs_deleted_at', exists (select 1 from information_schema.columns where table_schema='public' and table_name='clubs' and column_name='deleted_at'),
    'club_members_user_id', exists (select 1 from information_schema.columns where table_schema='public' and table_name='club_members' and column_name='user_id'),
    'club_members_status', exists (select 1 from information_schema.columns where table_schema='public' and table_name='club_members' and column_name='status'),
    'tenant_members_role_code', exists (select 1 from information_schema.columns where table_schema='public' and table_name='tenant_members' and column_name='role_code'),
    'profiles_role', exists (select 1 from information_schema.columns where table_schema='public' and table_name='profiles' and column_name='role'),
    'profiles_venue_id', exists (select 1 from information_schema.columns where table_schema='public' and table_name='profiles' and column_name='venue_id'),
    'gov_role_code', exists (select 1 from information_schema.columns where table_schema='public' and table_name='club_governance_assignments' and column_name='role_code'),
    'gov_status', exists (select 1 from information_schema.columns where table_schema='public' and table_name='club_governance_assignments' and column_name='status')
  ),
  'roles_present', json_build_object(
    'tenant_owner_in_tenant_members', exists (
      select 1 from public.tenant_members where role_code='tenant_owner' and status='active' limit 1
    ),
    'tenant_staff_in_tenant_members', exists (
      select 1 from public.tenant_members where role_code='tenant_staff' and status='active' limit 1
    ),
    'venue_owner_profiles', exists (
      select 1 from public.profiles where upper(coalesce(role,'')) in ('VENUE_OWNER','COURT_OWNER','TENANT_OWNER') limit 1
    ),
    'venue_manager_profiles', exists (
      select 1 from public.profiles where upper(coalesce(role,''))='VENUE_MANAGER' limit 1
    ),
    'court_manager_profiles', exists (
      select 1 from public.profiles where upper(coalesce(role,''))='COURT_MANAGER' limit 1
    )
  ),
  'audit', (
    select json_build_object(
      'constraint_name', c.conname,
      'definition', pg_get_constraintdef(c.oid),
      'accepts_club_assign_owner', pg_get_constraintdef(c.oid) ilike '%club.assign_owner%',
      'accepts_club_clear_owner', pg_get_constraintdef(c.oid) ilike '%club.clear_owner%'
    )
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname='public' and t.relname='audit_logs'
      and c.contype='c'
      and pg_get_constraintdef(c.oid) ilike '%action%'
    order by c.conname
    limit 1
  ),
  'compat_counts', json_build_object(
    'clubs_active', (select count(*)::int from public.clubs where deleted_at is null),
    'club_members_active', (select count(*)::int from public.club_members where status='active'),
    'gov_owner_active', (
      select count(*)::int from public.club_governance_assignments
      where role_code='club_owner' and status='active'
    )
  )
) as snapshot;
`;

async function main() {
  loadProjectEnv();
  fs.mkdirSync(outDir, { recursive: true });
  const token = String(process.env.SUPABASE_ACCESS_TOKEN || "").trim();
  if (!token) throw new Error("SUPABASE_ACCESS_TOKEN missing");

  const mainSha = execSync("git rev-parse origin/main", { cwd: rootDir, encoding: "utf8" }).trim();
  const headSha = execSync("git rev-parse HEAD", { cwd: rootDir, encoding: "utf8" }).trim();

  console.log("=== Phase 1C Production READ-ONLY preflight ===");
  console.log(`Approved app SHA: ${APPROVED_APP_SHA}`);
  console.log(`origin/main:      ${mainSha}`);

  const identity = await confirmProjectIdentity(token);
  console.log(`Connected project ref: ${identity.ref}`);
  if (identity.ref !== PRODUCTION_REF) throw new Error("STOP — not Production");
  if (identity.ref === STAGING_REF) throw new Error("STOP — Staging");

  const rows = await executeProductionSelect(token, CATALOG_SQL, "catalog_snapshot");
  const snapshot = Array.isArray(rows) ? rows[0]?.snapshot : rows?.snapshot;
  if (!snapshot) throw new Error("Empty catalog snapshot");

  const assignDef = String(snapshot.functions?.club_assign_owner?.definition || "");
  const clearDef = String(snapshot.functions?.club_clear_owner?.definition || "");
  const tenantMemberDef = String(snapshot.functions?.phase42_is_tenant_member?.definition || "");
  const helperExists = snapshot.functions?.phase42_can_assign_club_owner?.exists === true;
  const helperDef = String(snapshot.functions?.phase42_can_assign_club_owner?.definition || "");

  const assignUsesBareTenantMember = /phase42_is_tenant_member\s*\(/.test(assignDef);
  const clearUsesBareTenantMember = /phase42_is_tenant_member\s*\(/.test(clearDef);
  const assignUsesNarrowHelper = /phase42_can_assign_club_owner\s*\(/.test(assignDef);
  const clearUsesNarrowHelper = /phase42_can_assign_club_owner\s*\(/.test(clearDef);

  const gatePath = path.join(rootDir, GATE_SQL);
  const rollbackPath = path.join(rootDir, ROLLBACK_SQL);
  const gateText = fs.readFileSync(gatePath, "utf8");
  const rollbackText = fs.readFileSync(rollbackPath, "utf8");
  const gateAnalysis = analyzeGateSql(gateText);
  const rollbackAnalysis = analyzeRollbackSql(rollbackText);

  let stagingEvidence = null;
  const stagingEvidencePath = path.join(rootDir, STAGING_EVIDENCE);
  if (fs.existsSync(stagingEvidencePath)) {
    stagingEvidence = JSON.parse(fs.readFileSync(stagingEvidencePath, "utf8"));
  }

  // Expected current Production authz from bare phase42_is_tenant_member semantics
  const tenantMemberAllowsManagers =
    /VENUE_MANAGER|COURT_MANAGER/.test(tenantMemberDef) &&
    /tenant_staff|tenant_owner/.test(tenantMemberDef);

  const currentExpected = {
    SUPER_ADMIN: "ALLOW (phase42_is_platform_super_admin)",
    tenant_owner: "ALLOW (tenant_members.role_code=tenant_owner via phase42_is_tenant_member)",
    approved_tenant_admin: "ALLOW (VENUE_OWNER/COURT_OWNER/TENANT_OWNER profile via phase42_is_tenant_member)",
    tenant_staff: "ALLOW (EXCESSIVE — any active tenant_members including tenant_staff)",
    VENUE_MANAGER_profile_fallback: "ALLOW (EXCESSIVE — profiles.role VENUE_MANAGER in phase42_is_tenant_member)",
    COURT_MANAGER_profile_fallback: "ALLOW (EXCESSIVE — profiles.role COURT_MANAGER in phase42_is_tenant_member)",
    club_owner_without_tenant_admin: "FORBIDDEN unless also tenant_member/manager profile",
    president: "FORBIDDEN unless also tenant_member/manager profile",
    vice_president: "FORBIDDEN unless also tenant_member/manager profile",
    ordinary_player: "FORBIDDEN unless also tenant_member/manager profile",
    unrelated_authenticated: "FORBIDDEN",
    anonymous: "NOT_AUTHENTICATED",
  };

  const excessiveActors = [];
  if (assignUsesBareTenantMember || clearUsesBareTenantMember) {
    excessiveActors.push(
      "tenant_staff",
      "VENUE_MANAGER (profile fallback)",
      "COURT_MANAGER (profile fallback)"
    );
  }

  const columnsOk = Object.values(snapshot.columns || {}).every(Boolean);
  const tablesOk = Object.values(snapshot.tables || {}).every(Boolean);
  const depsOk =
    snapshot.functions?.user_has_permission?.exists === true &&
    snapshot.functions?.phase42_is_platform_super_admin?.exists === true &&
    snapshot.functions?.phase42_write_audit?.exists === true;

  const auditOk =
    snapshot.audit?.accepts_club_assign_owner === true &&
    snapshot.audit?.accepts_club_clear_owner === true;

  const sqlSafe =
    gateAnalysis.hasCreateOrReplace &&
    !gateAnalysis.hasDelete &&
    !gateAnalysis.hasTruncate &&
    !gateAnalysis.hasDropTable &&
    !gateAnalysis.hasRlsDisable &&
    !gateAnalysis.hasAuditCleanup &&
    !gateAnalysis.usesBareTenantMemberInActiveBody &&
    !gateAnalysis.optionalClubOwnerEnabled &&
    gateAnalysis.usesNarrowHelper;

  const appShaMatch = mainSha === APPROVED_APP_SHA;
  const gateApplied = assignUsesNarrowHelper && clearUsesNarrowHelper && !assignUsesBareTenantMember;

  let rolloutVerdict = "READY";
  const warnings = [];
  if (!appShaMatch) {
    warnings.push(`origin/main (${mainSha}) differs from approved app SHA ${APPROVED_APP_SHA}`);
    rolloutVerdict = "READY_WITH_WARNINGS";
  }
  if (!auditOk) {
    warnings.push("Audit constraint may reject club.assign_owner / club.clear_owner");
    rolloutVerdict = "BLOCKED";
  }
  if (!columnsOk || !tablesOk || !depsOk) {
    warnings.push("Missing tables/columns/dependencies required by gate SQL");
    rolloutVerdict = "BLOCKED";
  }
  if (!sqlSafe) {
    warnings.push("Gate SQL safety analysis failed");
    rolloutVerdict = "BLOCKED";
  }
  if (gateApplied) {
    warnings.push("Gate appears already applied on Production — re-apply may be no-op/idempotent");
    rolloutVerdict = rolloutVerdict === "BLOCKED" ? "BLOCKED" : "READY_WITH_WARNINGS";
  }
  if (excessiveActors.length && !gateApplied) {
    warnings.push(
      "SECURITY RISK ACTIVE: Production assign/clear still broad via phase42_is_tenant_member"
    );
    // Still READY to apply the fix — risk is why we apply
    if (rolloutVerdict === "READY") rolloutVerdict = "READY_WITH_WARNINGS";
  }

  // Compare vs Staging evidence catalog if present
  const stagingCatalog = stagingEvidence?.catalog || stagingEvidence?.postApplyCatalog || null;

  const report = {
    phase: "1C",
    kind: "PRODUCTION_PREFLIGHT_READONLY",
    startedAt: new Date().toISOString(),
    productionTouched: false,
    sqlApplied: false,
    deployPerformed: false,
    mutationsPerformed: false,
    target: {
      productionRef: PRODUCTION_REF,
      stagingRefMustNotBeUsed: STAGING_REF,
      identity,
      confirmedProduction: identity.ref === PRODUCTION_REF,
      confirmedNotStaging: identity.ref !== STAGING_REF,
    },
    app: {
      approvedSha: APPROVED_APP_SHA,
      originMainSha: mainSha,
      localHeadSha: headSha,
      matchesApproved: appShaMatch,
      note: "Vercel Git Integration auto-deploys Production app on push to main; Phase 1C gate SQL not applied",
    },
    currentRpcAuthorization: {
      club_assign_owner: {
        exists: !!snapshot.functions?.club_assign_owner?.exists,
        securityDefiner: snapshot.functions?.club_assign_owner?.security_definer === true,
        usesBarePhase42IsTenantMember: assignUsesBareTenantMember,
        usesNarrowHelper: assignUsesNarrowHelper,
        executeGrantAuthenticated: snapshot.grants?.club_assign_owner_authenticated === true,
      },
      club_clear_owner: {
        exists: !!snapshot.functions?.club_clear_owner?.exists,
        securityDefiner: snapshot.functions?.club_clear_owner?.security_definer === true,
        usesBarePhase42IsTenantMember: clearUsesBareTenantMember,
        usesNarrowHelper: clearUsesNarrowHelper,
        executeGrantAuthenticated: snapshot.grants?.club_clear_owner_authenticated === true,
      },
      phase42_can_assign_club_owner: {
        exists: helperExists,
        securityDefiner: helperExists
          ? snapshot.functions?.phase42_can_assign_club_owner?.security_definer === true
          : null,
        usedByAssignClear: assignUsesNarrowHelper || clearUsesNarrowHelper,
      },
      phase42_is_tenant_member: {
        exists: !!snapshot.functions?.phase42_is_tenant_member?.exists,
        securityDefiner: snapshot.functions?.phase42_is_tenant_member?.security_definer === true,
        includesManagersAndStaff: tenantMemberAllowsManagers,
      },
      rls: snapshot.rls,
      gateAppliedOnProduction: gateApplied,
    },
    catalogComparisonVsStaging: {
      stagingEvidencePath: STAGING_EVIDENCE,
      stagingStatus: stagingEvidence?.status || null,
      stagingProductionTouched: stagingEvidence?.productionTouched ?? null,
      stagingHelperWired: stagingEvidence?.catalog?.helper_used_by_assign ?? stagingEvidence?.verify?.helper_wired ?? null,
      productionHelperExists: helperExists,
      productionStillBroad: assignUsesBareTenantMember && clearUsesBareTenantMember,
      note: "Staging has gate PASS; Production still broad until Owner GO apply",
      stagingCatalogPresent: Boolean(stagingCatalog),
    },
    compatibility: {
      tables: snapshot.tables,
      columns: snapshot.columns,
      columnsOk,
      tablesOk,
      depsOk,
      rolesPresent: snapshot.roles_present,
      compatCounts: snapshot.compat_counts,
      dataRewriteRequired: false,
      createOrReplaceSafe: true,
    },
    audit: {
      ...snapshot.audit,
      compatible: auditOk,
    },
    gateSqlSafety: {
      file: GATE_SQL,
      ...gateAnalysis,
      sqlSafe,
    },
    rollback: {
      file: ROLLBACK_SQL,
      ...rollbackAnalysis,
      ready:
        rollbackAnalysis.restoresAssign &&
        rollbackAnalysis.restoresClear &&
        rollbackAnalysis.dropsHelper &&
        rollbackAnalysis.restoresBareTenantMember &&
        !rollbackAnalysis.hasDelete &&
        !rollbackAnalysis.hasTruncate &&
        !rollbackAnalysis.hasDropTable &&
        !rollbackAnalysis.hasAuditCleanup,
      note: "Rollback restores vulnerable broad authz — break-glass only",
    },
    currentExpectedAuthorization: currentExpected,
    excessiveAccessActors: excessiveActors,
    postGateExpectedAuthorization: {
      SUPER_ADMIN: "ALLOW",
      tenant_owner: "ALLOW",
      approved_tenant_admin: "ALLOW (VENUE_OWNER/COURT_OWNER/TENANT_OWNER + permission)",
      tenant_staff: "FORBIDDEN",
      VENUE_MANAGER_profile_fallback: "FORBIDDEN",
      COURT_MANAGER_profile_fallback: "FORBIDDEN",
      club_owner_without_tenant_admin: "FORBIDDEN (optional path disabled)",
      president: "FORBIDDEN",
      vice_president: "FORBIDDEN",
      ordinary_player: "FORBIDDEN",
      unrelated_authenticated: "FORBIDDEN",
      anonymous: "NOT_AUTHENTICATED",
    },
    uiDbConsistency: {
      appServesApprovedSha: appShaMatch,
      uiExpectsNarrowAuthz: true,
      dbStillBroad: !gateApplied,
      classification: !gateApplied
        ? "UI_NARROW_EXPECTATION_VS_DB_BROAD_AUTHZ"
        : "ALIGNED",
    },
    applyPlanDoNotExecute: [
      "1. Capture current Production function definitions (club_assign_owner, club_clear_owner, phase42_can_assign_club_owner if any)",
      "2. Apply docs/v5/phase1c/PHASE_1C_CLUB_OWNER_ASSIGN_AUTHZ_SECURITY_GATE.sql to Production ONLY after Owner GO",
      "3. Catalog verification: helper exists; assign/clear use phase42_can_assign_club_owner; no bare phase42_is_tenant_member; optional club_owner path absent; RLS still enabled",
      "4. Live authorization smoke (ALLOW: SUPER_ADMIN, tenant_owner, approved tenant admin; DENY: tenant_staff, VENUE_MANAGER, COURT_MANAGER, Club Owner alone, President, VP, player, unrelated, anonymous)",
      "5. Verify VERSION_CONFLICT + MEMBER_REQUIRED + version bump + audit for assign/clear",
      "6. Confirm app UI consistency (transfer hidden for Club Owner alone; assign/clear succeed for tenant owner/SA)",
      "7. Roll back with PHASE_1C_CLUB_OWNER_ASSIGN_AUTHZ_ROLLBACK.sql only if allowed actor incorrectly denied or system mutation fails",
    ],
    rolloutVerdict,
    warnings,
    finishedAt: new Date().toISOString(),
  };

  // Omit full function bodies from written report (large); keep fingerprints
  report.definitionFingerprints = {
    club_assign_owner_len: assignDef.length,
    club_clear_owner_len: clearDef.length,
    phase42_is_tenant_member_len: tenantMemberDef.length,
    helper_len: helperDef.length,
    assign_authz_snippet: (assignDef.match(/if not \([\s\S]{0,200}?then/) || [null])[0],
    clear_authz_snippet: (clearDef.match(/if not \([\s\S]{0,200}?then/) || [null])[0],
  };

  const jsonPath = path.join(outDir, "PHASE_1C_PRODUCTION_AUTHZ_GATE_PREFLIGHT.json");
  const mdPath = path.join(outDir, "PHASE_1C_PRODUCTION_AUTHZ_GATE_PREFLIGHT.md");
  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));

  const md = [
    `# Phase 1C — Production Owner-Assign Authz Gate Preflight (READ-ONLY)`,
    ``,
    `- **Verdict:** ${rolloutVerdict}`,
    `- **Production ref:** \`${PRODUCTION_REF}\` (confirmed)`,
    `- **Not Staging:** \`${STAGING_REF}\``,
    `- **Approved app SHA:** \`${APPROVED_APP_SHA}\``,
    `- **origin/main:** \`${mainSha}\``,
    `- **SQL applied:** false`,
    `- **Deploy performed:** false`,
    `- **Mutations:** false`,
    ``,
    `## Current RPC authorization`,
    ``,
    `- \`club_assign_owner\` uses bare \`phase42_is_tenant_member\`: **${assignUsesBareTenantMember}**`,
    `- \`club_clear_owner\` uses bare \`phase42_is_tenant_member\`: **${clearUsesBareTenantMember}**`,
    `- Narrow helper \`phase42_can_assign_club_owner\` exists: **${helperExists}**`,
    `- SECURITY DEFINER assign/clear: **${snapshot.functions?.club_assign_owner?.security_definer === true}** / **${snapshot.functions?.club_clear_owner?.security_definer === true}**`,
    `- EXECUTE grant authenticated: assign **${snapshot.grants?.club_assign_owner_authenticated}**, clear **${snapshot.grants?.club_clear_owner_authenticated}**`,
    `- RLS enabled on clubs: **${snapshot.rls?.clubs_rls_enabled}**`,
    ``,
    `## Excessive Production access (current)`,
    ``,
    ...(excessiveActors.length ? excessiveActors.map((a) => `- ${a}`) : ["- none"]),
    ``,
    `## Compatibility`,
    ``,
    `- Tables/columns OK: ${tablesOk && columnsOk}`,
    `- Dependencies OK: ${depsOk}`,
    `- Audit accepts club.assign_owner / club.clear_owner: ${auditOk}`,
    `- Data rewrite required: false`,
    `- Gate SQL CREATE OR REPLACE safe: ${sqlSafe}`,
    `- Optional Club Owner self-transfer enabled in gate file: ${gateAnalysis.optionalClubOwnerEnabled}`,
    ``,
    `## Rollback readiness`,
    ``,
    `- Ready: ${report.rollback.ready}`,
    `- Restores prior function bodies only; no audit delete; no app revert`,
    ``,
    `## Apply order (DO NOT EXECUTE in this step)`,
    ``,
    ...report.applyPlanDoNotExecute.map((s) => `${s}`),
    ``,
    `## Warnings`,
    ``,
    ...(warnings.length ? warnings.map((w) => `- ${w}`) : ["- none"]),
    ``,
    `## Evidence`,
    ``,
    `- \`${path.relative(rootDir, jsonPath).replace(/\\\\/g, "/")}\``,
    `- \`${path.relative(rootDir, mdPath).replace(/\\\\/g, "/")}\``,
    `- Staging: \`${STAGING_EVIDENCE}\``,
    `- Gate: \`${GATE_SQL}\``,
    `- Rollback: \`${ROLLBACK_SQL}\``,
    ``,
  ].join("\n");
  fs.writeFileSync(mdPath, md);

  console.log(`\nVERDICT: ${rolloutVerdict}`);
  console.log(`Evidence: ${path.relative(rootDir, jsonPath)}`);
  console.log("Confirmation: no SQL applied, no deploy, no mutations.");
  if (rolloutVerdict === "BLOCKED") process.exitCode = 2;
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
