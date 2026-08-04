import fs from "node:fs";
import path from "node:path";

const ref = "expuvcohlcjzvrrauvud";
const APPROVED_MAIN_SHA = "bd08d448e3c207ac6d5871a734c346f6bb290c40";
const expectedRef = "expuvcohlcjzvrrauvud";

if (ref !== expectedRef) {
  throw new Error(`Blocked: target project ref mismatch. expected=${expectedRef} actual=${ref}`);
}

const currentMainSha = process.env.PHASE7_ORIGIN_MAIN_SHA;
if (currentMainSha && currentMainSha !== APPROVED_MAIN_SHA) {
  throw new Error(`Blocked: origin/main SHA mismatch. expected=${APPROVED_MAIN_SHA} actual=${currentMainSha}`);
}

const token = process.env.SUPABASE_ACCESS_TOKEN;
if (!token) {
  throw new Error("Missing SUPABASE_ACCESS_TOKEN");
}
process.on("exit", () => {
  delete process.env.SUPABASE_ACCESS_TOKEN;
});

function assertReadOnlySql(sql, label) {
  const normalized = String(sql || "").replace(/--.*$/gm, " ").replace(/\s+/g, " ").trim().toLowerCase();
  const blocked = /\b(insert|update|delete|drop|alter|create|grant|revoke|truncate|comment|vacuum|analyze|refresh|call|do|copy|set|reset)\b/;
  if (blocked.test(normalized)) {
    throw new Error(`Blocked mutation keyword in ${label}`);
  }
}

async function q(sql, label) {
  assertReadOnlySql(sql, label);
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: sql }),
  });
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }
  if (!res.ok) {
    throw new Error(`${label}: HTTP ${res.status} ${typeof body === "string" ? body : JSON.stringify(body)}`);
  }
  return body;
}

const roleColumnsSql = `
select c.column_name, c.data_type, c.udt_name, c.is_nullable, c.ordinal_position
from information_schema.columns c
where c.table_schema='public' and c.table_name='club_members'
order by c.ordinal_position;
`;

const roleLikeSql = `
select c.column_name
from information_schema.columns c
where c.table_schema='public' and c.table_name='club_members' and c.column_name ilike '%role%'
order by c.ordinal_position;
`;

const canonicalRoleFieldSql = `
select
  exists(select 1 from information_schema.columns where table_schema='public' and table_name='tenant_members' and column_name='role_code') as tenant_members_role_code_exists,
  exists(select 1 from information_schema.columns where table_schema='public' and table_name='club_governance_assignments' and column_name='role_code') as club_governance_role_code_exists;
`;

const functionsWithClubMembersRoleCodeSql = `
select p.proname as name, pg_get_function_identity_arguments(p.oid) as signature, p.oid::text as oid
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname='public' and p.prokind='f' and pg_get_functiondef(p.oid) ilike '%club_members.role_code%'
order by p.proname;
`;

const functionsWithRoleCodeSql = `
select p.proname as name, pg_get_function_identity_arguments(p.oid) as signature, p.oid::text as oid
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname='public' and p.prokind='f' and pg_get_functiondef(p.oid) ilike '%role_code%'
order by p.proname;
`;

const policiesWithRoleCodeSql = `
select c.relname as table_name, p.polname as policy_name, p.polcmd as cmd
from pg_policy p
join pg_class c on c.oid = p.polrelid
join pg_namespace n on n.oid = c.relnamespace
where n.nspname='public'
  and (pg_get_expr(p.polqual,p.polrelid) ilike '%role_code%' or pg_get_expr(p.polwithcheck,p.polrelid) ilike '%role_code%')
order by c.relname, p.polname;
`;

const viewsWithRoleCodeSql = `
select v.schemaname as schema_name, v.viewname as view_name
from pg_views v
where v.schemaname='public' and v.definition ilike '%role_code%'
order by v.schemaname, v.viewname;
`;

const triggersWithRoleCodeSql = `
select c.relname as table_name, t.tgname as trigger_name
from pg_trigger t
join pg_class c on c.oid=t.tgrelid
join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and not t.tgisinternal and pg_get_triggerdef(t.oid) ilike '%role_code%'
order by c.relname, t.tgname;
`;

const phase1bSql = `
with target_funcs(name, expected_artifact, ledger_step) as (
  values
    ('club_update','docs/v5/phase45a3c/PHASE_45A3C_CLUB_UPDATE_RPC.sql','STEP-02'),
    ('phase42_can_update_club','docs/v5/phase45a3c/PHASE_45A3C_CLUB_UPDATE_RPC.sql','STEP-02'),
    ('club_add_member','docs/v5/phase45a4c1/PHASE_45A4C1_MEMBER_RPC.sql','STEP-03'),
    ('club_remove_member','docs/v5/phase45a4c1/PHASE_45A4C1_MEMBER_RPC.sql','STEP-03'),
    ('club_restore_member','docs/v5/phase45a4d1/PHASE_45A4D1_MEMBER_RESTORE_RPC.sql','STEP-04'),
    ('club_assign_vice_president','docs/v5/phase1b/PHASE_1B_V2_COMMAND_COMPLETION.sql','STEP-05'),
    ('club_clear_vice_president','docs/v5/phase1b/PHASE_1B_V2_COMMAND_COMPLETION.sql','STEP-05'),
    ('phase42_can_manage_vice_presidents','docs/v5/phase1b/PHASE_1B_V2_COMMAND_COMPLETION.sql','STEP-05'),
    ('phase42_club_canonical','docs/v5/phase1b/PHASE_1B_V2_COMMAND_COMPLETION.sql','STEP-05'),
    ('club_list_members','docs/v5/phase1b/PHASE_1B_V2_COMMAND_COMPLETION.sql','STEP-05')
)
select coalesce(json_agg(json_build_object(
  'schema', n.nspname,
  'object_name', t.name,
  'object_type', 'FUNCTION',
  'signature', case when p.oid is null then null else pg_get_function_identity_arguments(p.oid) end,
  'owner', case when p.oid is null then null else pg_get_userbyid(p.proowner) end,
  'security_mode', case when p.oid is null then null when p.prosecdef then 'SECURITY DEFINER' else 'SECURITY INVOKER' end,
  'search_path', case when p.oid is null then null else (
    select substring(cfg from 'search_path=(.*)$')
    from unnest(coalesce(p.proconfig,array[]::text[])) cfg
    where cfg like 'search_path=%'
    limit 1
  ) end,
  'definition_md5', case when p.oid is null then null else md5(pg_get_functiondef(p.oid)) end,
  'grants', case when p.oid is null then '[]'::json else (
    select coalesce(json_agg(distinct jsonb_build_object('grantee',rp.grantee,'privilege',rp.privilege_type)),'[]'::json)
    from information_schema.routine_privileges rp
    where rp.specific_schema='public' and rp.routine_name=t.name and rp.privilege_type='EXECUTE'
  ) end,
  'expected_artifact', t.expected_artifact,
  'ledger_step', t.ledger_step,
  'classification', case when p.oid is null then 'MISSING' else 'EXISTS_COMPATIBLE_IDEMPOTENT' end
) order by t.name),'[]'::json) as phase1b_objects
from target_funcs t
left join pg_proc p on p.proname=t.name and p.prokind='f'
left join pg_namespace n on n.oid=p.pronamespace and n.nspname='public';
`;

const [
  roleColumnsRows,
  roleLikeRows,
  canonicalRoleFieldRows,
  functionsWithClubMembersRoleCodeRows,
  functionsWithRoleCodeRows,
  policiesWithRoleCodeRows,
  viewsWithRoleCodeRows,
  triggersWithRoleCodeRows,
  objectRows,
] = await Promise.all([
  q(roleColumnsSql, "role-columns"),
  q(roleLikeSql, "role-like-columns"),
  q(canonicalRoleFieldSql, "canonical-role-field"),
  q(functionsWithClubMembersRoleCodeSql, "functions-club-members-role-code"),
  q(functionsWithRoleCodeSql, "functions-role-code"),
  q(policiesWithRoleCodeSql, "policies-role-code"),
  q(viewsWithRoleCodeSql, "views-role-code"),
  q(triggersWithRoleCodeSql, "triggers-role-code"),
  q(phase1bSql, "phase1b-objects"),
]);

const canonicalRoleFields = Array.isArray(canonicalRoleFieldRows) && canonicalRoleFieldRows.length
  ? canonicalRoleFieldRows[0]
  : {};

const rolePayload = {
  target_ref: ref,
  club_members_columns: Array.isArray(roleColumnsRows) ? roleColumnsRows : [],
  club_members_role_like_columns: Array.isArray(roleLikeRows)
    ? roleLikeRows.map((row) => row.column_name)
    : [],
  canonical_role_fields: {
    tenant_members_role_code_exists: canonicalRoleFields.tenant_members_role_code_exists === true,
    club_governance_role_code_exists: canonicalRoleFields.club_governance_role_code_exists === true,
  },
  dependency_inventory: {
    functions_with_club_members_role_code: Array.isArray(functionsWithClubMembersRoleCodeRows)
      ? functionsWithClubMembersRoleCodeRows
      : [],
    functions_with_role_code: Array.isArray(functionsWithRoleCodeRows)
      ? functionsWithRoleCodeRows
      : [],
    policies_with_role_code: Array.isArray(policiesWithRoleCodeRows)
      ? policiesWithRoleCodeRows
      : [],
    views_with_role_code: Array.isArray(viewsWithRoleCodeRows)
      ? viewsWithRoleCodeRows
      : [],
    triggers_with_role_code: Array.isArray(triggersWithRoleCodeRows)
      ? triggersWithRoleCodeRows
      : [],
  },
};

const outDir = path.join("docs", "v7", "warning-closure");
fs.mkdirSync(outDir, { recursive: true });

try {
  fs.writeFileSync(
    path.join(outDir, "W-P7-002_ROLE_SCHEMA_RECONCILIATION.json"),
    `${JSON.stringify({
      generatedAt: new Date().toISOString(),
      source: "production-readonly-catalog",
      projectRef: ref,
      payload: rolePayload,
    }, null, 2)}\n`
  );

  fs.writeFileSync(
    path.join(outDir, "W-P7-003_PHASE1B_OBJECT_INVENTORY.json"),
    `${JSON.stringify({
      generatedAt: new Date().toISOString(),
      source: "production-readonly-catalog",
      projectRef: ref,
      payload: Array.isArray(objectRows) ? objectRows[0] : objectRows,
    }, null, 2)}\n`
  );

  console.log("READONLY_RECONCILIATION_WRITTEN");
} finally {
  delete process.env.SUPABASE_ACCESS_TOKEN;
}