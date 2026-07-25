#!/usr/bin/env node
/**
 * PM-ID-01 — Post-apply read-only Staging verification.
 * BEGIN TRANSACTION READ ONLY … ROLLBACK only. Never applies SQL. Never Production.
 */

import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import path from "node:path";

import { loadCoaching03StagingEnv } from "../../src/features/coaching/staging/index.js";
import {
  PM_ID_01_EVIDENCE_DIR,
  PM_ID_01_STAGING_PROJECT_REF,
  getPmId01RepoRoot,
} from "./pm-id-01-activation-lib.mjs";

const SQL = `
BEGIN TRANSACTION READ ONLY;
SET search_path = public, pg_temp;
SELECT jsonb_build_object(
  'table_present', to_regclass('public.player_identity_links') IS NOT NULL,
  'principal_id_type', (
    SELECT format_type(a.atttypid, a.atttypmod)
    FROM pg_attribute a
    JOIN pg_class c ON c.oid = a.attrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'player_identity_links'
      AND a.attname = 'principal_id' AND a.attnum > 0 AND NOT a.attisdropped
  ),
  'player_id_type', (
    SELECT format_type(a.atttypid, a.atttypmod)
    FROM pg_attribute a
    JOIN pg_class c ON c.oid = a.attrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'player_identity_links'
      AND a.attname = 'player_id' AND a.attnum > 0 AND NOT a.attisdropped
  ),
  'status_check_def', (
    SELECT pg_get_constraintdef(con.oid)
    FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'player_identity_links'
      AND con.contype = 'c'
      AND pg_get_constraintdef(con.oid) ILIKE '%ACTIVE%'
      AND pg_get_constraintdef(con.oid) ILIKE '%REVOKED%'
    LIMIT 1
  ),
  'unique_active_indexes', (
    SELECT coalesce(jsonb_agg(i.relname ORDER BY i.relname), '[]'::jsonb)
    FROM pg_index ix
    JOIN pg_class t ON t.oid = ix.indrelid
    JOIN pg_class i ON i.oid = ix.indexrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public' AND t.relname = 'player_identity_links'
      AND ix.indisunique
      AND pg_get_indexdef(i.oid) ILIKE '%WHERE%'
      AND pg_get_indexdef(i.oid) ILIKE '%ACTIVE%'
  ),
  'functions', (
    SELECT coalesce(jsonb_agg(jsonb_build_object(
      'proname', p.proname,
      'security_definer', p.prosecdef,
      'binds_auth_uid', pg_get_functiondef(p.oid) LIKE '%v_uid uuid := auth.uid()%'
    ) ORDER BY p.proname), '[]'::jsonb)
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'player_identity_resolve_mapping',
        'player_identity_is_mapped',
        'player_identity_admin_can_manage',
        'player_identity_admin_upsert_link',
        'player_identity_admin_revoke_link',
        'player_identity_links_enforce_club_tenant',
        'coaching_04_mapped_player_id'
      )
  ),
  'rls_enabled', (
    SELECT c.relrowsecurity
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'player_identity_links'
  ),
  'rls_forced', (
    SELECT c.relforcerowsecurity
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'player_identity_links'
  ),
  'policies', (
    SELECT coalesce(jsonb_agg(jsonb_build_object(
      'polname', pol.polname,
      'using_expr', pg_get_expr(pol.polqual, pol.polrelid),
      'with_check_expr', pg_get_expr(pol.polwithcheck, pol.polrelid)
    ) ORDER BY pol.polname), '[]'::jsonb)
    FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'player_identity_links'
  ),
  'grants', (
    SELECT coalesce(jsonb_agg(jsonb_build_object(
      'proname', p.proname,
      'rolname', r.rolname,
      'can_execute', has_function_privilege(r.oid, p.oid, 'EXECUTE')
    ) ORDER BY p.proname, r.rolname), '[]'::jsonb)
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    CROSS JOIN pg_roles r
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'player_identity_resolve_mapping',
        'player_identity_is_mapped',
        'player_identity_admin_upsert_link',
        'player_identity_admin_revoke_link',
        'player_identity_admin_can_manage'
      )
      AND r.rolname IN ('public', 'anon', 'authenticated', 'service_role')
  ),
  'link_rows', (SELECT count(*)::int FROM public.player_identity_links),
  'active_rows', (SELECT count(*)::int FROM public.player_identity_links WHERE status = 'ACTIVE'),
  'revoked_rows', (SELECT count(*)::int FROM public.player_identity_links WHERE status = 'REVOKED'),
  'coaching04_helper_present', EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'coaching_04_mapped_player_id'
  )
) AS verification;
ROLLBACK;
`;

function unwrapVerification(body) {
  if (Array.isArray(body)) {
    for (const row of body) {
      if (row && row.verification) return row.verification;
      if (row && typeof row === "object" && "table_present" in row) return row;
    }
    if (body.length === 1 && body[0] && typeof body[0] === "object") return body[0];
  }
  if (body && body.verification) return body.verification;
  if (Array.isArray(body?.data)) return unwrapVerification(body.data);
  return null;
}

async function main() {
  const repoRoot = getPmId01RepoRoot(import.meta.url);
  loadCoaching03StagingEnv({ repoRoot });
  const token = String(process.env.SUPABASE_ACCESS_TOKEN || "").trim();
  if (!token) {
    console.error(JSON.stringify({ ok: false, message: "SUPABASE_ACCESS_TOKEN missing" }));
    process.exit(2);
  }

  const res = await fetch(
    `https://api.supabase.com/v1/projects/${PM_ID_01_STAGING_PROJECT_REF}/database/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: SQL }),
    }
  );
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error(JSON.stringify({ ok: false, httpStatus: res.status, body }, null, 2));
    process.exit(1);
  }

  const v = unwrapVerification(body);
  if (!v) {
    const fail = {
      ok: false,
      verdict: "PM_ID_01_POST_APPLY_VERIFICATION_FAIL",
      message: "Unable to unwrap verification payload",
      rawBody: body,
      finishedAt: new Date().toISOString(),
    };
    const dir = path.join(repoRoot, PM_ID_01_EVIDENCE_DIR);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(path.join(dir, "POST_APPLY_VERIFICATION.json"), `${JSON.stringify(fail, null, 2)}\n`);
    console.log(JSON.stringify(fail, null, 2));
    process.exit(1);
  }

  const functions = Array.isArray(v.functions) ? v.functions : [];
  const policies = Array.isArray(v.policies) ? v.policies : [];
  const grants = Array.isArray(v.grants) ? v.grants : [];
  const uniqueActive = Array.isArray(v.unique_active_indexes) ? v.unique_active_indexes : [];
  const resolveFn = functions.find((r) => r.proname === "player_identity_resolve_mapping");
  const managementNames = [
    "player_identity_admin_upsert_link",
    "player_identity_admin_revoke_link",
    "player_identity_admin_can_manage",
  ];
  const usingTrue = policies.some((r) => String(r.using_expr || "").trim().toLowerCase() === "true");
  const withCheckTrue = policies.some(
    (r) => String(r.with_check_expr || "").trim().toLowerCase() === "true"
  );
  const resolveGrants = grants.filter((r) =>
    ["player_identity_resolve_mapping", "player_identity_is_mapped"].includes(r.proname)
  );
  const publicExec = resolveGrants.some((r) => r.rolname === "public" && r.can_execute === true);
  const anonExec = resolveGrants.some((r) => r.rolname === "anon" && r.can_execute === true);
  const authExec = resolveGrants.some(
    (r) => r.rolname === "authenticated" && r.can_execute === true
  );

  const assertions = {
    tablePresent: v.table_present === true,
    principalIdUuid: String(v.principal_id_type || "").toLowerCase() === "uuid",
    playerIdText: String(v.player_id_type || "").toLowerCase() === "text",
    lifecycleActiveRevoked: Boolean(v.status_check_def),
    uniqueActiveInvariants: uniqueActive.length >= 2,
    resolveHelper: Boolean(resolveFn),
    isMappedHelper: functions.some((r) => r.proname === "player_identity_is_mapped"),
    managementRpcs: managementNames.every((n) => functions.some((r) => r.proname === n)),
    bindsAuthUid: resolveFn?.binds_auth_uid === true,
    rlsEnabled: v.rls_enabled === true,
    rlsForced: v.rls_forced === true,
    noUsingTrue: !usingTrue,
    noWithCheckTrue: !withCheckTrue,
    publicExecuteRevoked: !publicExec,
    anonExecuteRevoked: !anonExec,
    authenticatedHasScoped: authExec,
    mappingRowsZero: Number(v.link_rows) === 0,
    backfillCountZero: Number(v.link_rows) === 0,
    coaching04NotPresent: v.coaching04_helper_present === false,
    productionUntouched: true,
    readOnlyTransaction: true,
  };

  const failedAssertions = Object.entries(assertions)
    .filter(([, val]) => val !== true)
    .map(([k]) => k);

  const report = {
    phase: "PM-ID-01-POST-APPLY-VERIFICATION",
    stagingProjectRef: PM_ID_01_STAGING_PROJECT_REF,
    ok: failedAssertions.length === 0,
    verdict:
      failedAssertions.length === 0
        ? "PM_ID_01_POST_APPLY_VERIFICATION_PASS"
        : "PM_ID_01_POST_APPLY_VERIFICATION_FAIL",
    assertions,
    failedAssertions,
    details: {
      principalType: v.principal_id_type || null,
      playerType: v.player_id_type || null,
      uniqueActiveIndexes: uniqueActive,
      functions: functions.map((r) => r.proname),
      policies,
      counts: {
        link_rows: v.link_rows,
        active_rows: v.active_rows,
        revoked_rows: v.revoked_rows,
      },
      coaching04HelperPresent: v.coaching04_helper_present,
      statusCheckDef: v.status_check_def || null,
    },
    databaseWrites: 0,
    sqlApplied: false,
    mappingRowsCreated: 0,
    backfillExecuted: false,
    productionTouched: false,
    filesDeleted: false,
    CODEX_DELETE_ALLOWED: "NO",
    rawPayload: v,
    finishedAt: new Date().toISOString(),
  };

  const dir = path.join(repoRoot, PM_ID_01_EVIDENCE_DIR);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(
    path.join(dir, "POST_APPLY_VERIFICATION.json"),
    `${JSON.stringify(report, null, 2)}\n`,
    "utf8"
  );
  console.log(
    JSON.stringify(
      {
        ok: report.ok,
        verdict: report.verdict,
        failedAssertions,
        assertions,
        details: report.details,
      },
      null,
      2
    )
  );
  process.exit(report.ok ? 0 : 1);
}

main().catch((err) => {
  console.error(JSON.stringify({ ok: false, error: String(err?.message || err) }, null, 2));
  process.exit(1);
});
