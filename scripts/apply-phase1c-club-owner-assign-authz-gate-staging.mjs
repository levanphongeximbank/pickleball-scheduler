#!/usr/bin/env node
/**
 * Phase 1C — Apply club_assign_owner / club_clear_owner authz gate to STAGING ONLY,
 * then run live authorization matrix + audit/version checks.
 *
 * Hard-blocks Production (expuvcohlcjzvrrauvud).
 * Does NOT enable optional Club Owner self-transfer.
 *
 * Requires: SUPABASE_ACCESS_TOKEN
 * Optional: STAGING_QA_PASSWORD / PHASE42L_QA_PASSWORD (else ephemeral session password)
 */
import fs from "node:fs";
import path from "node:path";
import { createHash, randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";
import { loadProjectEnv } from "./load-env.mjs";

const STAGING_REF = "qyewbxjsiiyufanzcjcq";
const PRODUCTION_REF = "expuvcohlcjzvrrauvud";
const PATCH = "docs/v5/phase1c/PHASE_1C_CLUB_OWNER_ASSIGN_AUTHZ_SECURITY_GATE.sql";
const APPROVED = "8f5de177779d6106a09903698b7fcf65884675d7";
const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(rootDir, "docs/v5/qa-evidence/phase1c-staging");

function rid() {
  return crypto.randomUUID();
}

async function managementSql(token, sql, label) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${STAGING_REF}/database/query`, {
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

async function fetchKeys(token) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${STAGING_REF}/api-keys`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`api-keys: ${JSON.stringify(body).slice(0, 200)}`);
  const list = Array.isArray(body) ? body : [];
  const pick = (n) => String(list.find((k) => String(k.name || "").toLowerCase() === n)?.api_key || "").trim();
  return { anonKey: pick("anon"), serviceKey: pick("service_role") };
}

function clientFor(url, key) {
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function ensurePassword(admin, email, password) {
  let page = 1;
  while (page <= 20) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(error.message);
    const hit = (data?.users || []).find((u) => String(u.email || "").toLowerCase() === email.toLowerCase());
    if (hit) {
      const { error: e2 } = await admin.auth.admin.updateUserById(hit.id, { password });
      return e2 ? { ok: false, reason: e2.message } : { ok: true, userId: hit.id };
    }
    if ((data?.users || []).length < 200) break;
    page += 1;
  }
  return { ok: false, reason: "user_not_found" };
}

async function signIn(url, anon, email, password) {
  const sb = clientFor(url, anon);
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error) return { ok: false, error: error.message };
  return { ok: true, sb, userId: data.user?.id };
}

function unwrap(p) {
  return p?.data && typeof p.data === "object" ? p.data : p;
}

function versionOf(p) {
  if (p?.version != null) return Number(p.version);
  const d = unwrap(p);
  return d?.version != null ? Number(d.version) : null;
}

function ownerUserIdOf(p) {
  const d = unwrap(p);
  return String(d?.owner_user_id || d?.governance?.ownerUserId || "").trim() || null;
}

async function clubVersion(token, clubId) {
  const rows = await managementSql(
    token,
    `select version from public.clubs where id='${clubId.replace(/'/g, "''")}'`,
    "club_version"
  );
  return Array.isArray(rows) ? Number(rows[0]?.version) : null;
}

async function main() {
  loadProjectEnv();
  fs.mkdirSync(outDir, { recursive: true });
  const commit = execSync("git rev-parse HEAD", { cwd: rootDir, encoding: "utf8" }).trim();
  const token = String(process.env.SUPABASE_ACCESS_TOKEN || "").trim();
  const url = String(process.env.STAGING_SUPABASE_URL || `https://${STAGING_REF}.supabase.co`).trim();
  const password =
    String(process.env.STAGING_QA_PASSWORD || process.env.PHASE42L_QA_PASSWORD || "").trim() ||
    `Phase1c!${randomBytes(9).toString("base64url")}`;

  const report = {
    phase: "1C",
    kind: "CLUB_OWNER_ASSIGN_AUTHZ_GATE_APPLY_AND_QA",
    stagingRef: STAGING_REF,
    productionRef: PRODUCTION_REF,
    productionTouched: false,
    commit,
    approvedCommit: APPROVED,
    decision: {
      A_apply_narrow_gate_staging: true,
      B_optional_club_owner_self_transfer: false,
    },
    startedAt: new Date().toISOString(),
    preflight: null,
    apply: null,
    catalog: null,
    assignMatrix: [],
    clearMatrix: [],
    memberRequired: null,
    versionAudit: null,
    uiQa: {
      status: "API_AND_UNIT_ONLY",
      note: "No Staging browser session in this harness; UI gate covered by unit tests + RPC matrix.",
    },
    status: "PENDING",
    warnings: [],
  };

  const writeReport = () => {
    fs.writeFileSync(path.join(outDir, "CLUB_OWNER_ASSIGN_AUTHZ_GATE_REPORT.json"), JSON.stringify(report, null, 2));
    const md = [
      `# Phase 1C — Club Owner Assign Authz Gate (Staging)`,
      ``,
      `- Status: **${report.status}**`,
      `- Staging ref: \`${report.stagingRef}\``,
      `- Production touched: \`${report.productionTouched}\``,
      `- Commit: \`${report.commit}\``,
      `- Optional Club Owner transfer: **DISABLED**`,
      ``,
      `## Preflight`,
      "```json",
      JSON.stringify(report.preflight, null, 2),
      "```",
      ``,
      `## Apply`,
      "```json",
      JSON.stringify(report.apply, null, 2),
      "```",
      ``,
      `## Catalog`,
      "```json",
      JSON.stringify(report.catalog, null, 2),
      "```",
      ``,
      `## Assign matrix`,
      "```json",
      JSON.stringify(report.assignMatrix, null, 2),
      "```",
      ``,
      `## Clear matrix`,
      "```json",
      JSON.stringify(report.clearMatrix, null, 2),
      "```",
      ``,
      `## Version / audit`,
      "```json",
      JSON.stringify(report.versionAudit, null, 2),
      "```",
      ``,
    ].join("\n");
    fs.writeFileSync(path.join(outDir, "CLUB_OWNER_ASSIGN_AUTHZ_GATE_REPORT.md"), md);
  };

  console.log("=== Phase 1C club_assign_owner authz gate — Staging only ===");
  console.log(`COMMIT: ${commit}`);
  console.log(`STAGING REF: ${STAGING_REF}`);
  console.log(`URL: ${url}`);

  if (commit !== APPROVED) {
    report.status = "BLOCKED_WRONG_COMMIT";
    report.error = `Expected ${APPROVED}, got ${commit}`;
    writeReport();
    process.exitCode = 2;
    return;
  }
  if (!token) {
    report.status = "BLOCKED_NO_TOKEN";
    writeReport();
    process.exitCode = 2;
    return;
  }
  if (url.includes(PRODUCTION_REF) || STAGING_REF === PRODUCTION_REF) {
    report.status = "BLOCKED_PRODUCTION";
    writeReport();
    process.exitCode = 2;
    return;
  }

  // ---- STEP 1/2 SQL review + preflight ----
  const sql = fs.readFileSync(path.join(rootDir, PATCH), "utf8");
  const review = {
    helperRoleSpecific: /role_code = 'tenant_owner'/.test(sql),
    noBareTenantMemberAuthz:
      !/if not \(public\.phase42_is_platform_super_admin\(\) or public\.phase42_is_tenant_member\(/.test(sql) &&
      /phase42_can_assign_club_owner/.test(sql),
    deniesManagers: !/VENUE_MANAGER|COURT_MANAGER/.test(sql.split("create or replace function public.phase42_can_assign_club_owner")[1]?.slice(0, 1200) || ""),
    optionalClubOwnerDisabled: /OPTIONAL \(Owner GO required\)/.test(sql) && !/phase42_has_gov_role\(p_club_id, array\['club_owner'\]\)/.test(
      sql.replace(/--.*$/gm, "")
    ),
    noDestructive: !/^\s*TRUNCATE\b/im.test(sql) && !/^\s*DROP\s+TABLE\b/im.test(sql) && !/DISABLE ROW LEVEL SECURITY/i.test(sql),
    createOrReplace: /create or replace function public\.phase42_can_assign_club_owner/i.test(sql),
  };

  const preflightBody = await managementSql(
    token,
    `
select json_build_object(
  'project_ok', true,
  'assign_def', (
    select pg_get_functiondef(p.oid)
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname='public' and p.proname='club_assign_owner' limit 1
  ),
  'clear_def', (
    select pg_get_functiondef(p.oid)
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname='public' and p.proname='club_clear_owner' limit 1
  ),
  'tenant_member_helper_exists', to_regprocedure('public.phase42_is_tenant_member(text)') is not null,
  'audit_assign_ok', exists (
    select 1 from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname='public' and t.relname='audit_logs' and c.contype='c'
      and pg_get_constraintdef(c.oid) ilike '%club.assign_owner%'
  ),
  'audit_clear_ok', exists (
    select 1 from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname='public' and t.relname='audit_logs' and c.contype='c'
      and pg_get_constraintdef(c.oid) ilike '%club.clear_owner%'
  ),
  'rls_clubs', (select relrowsecurity from pg_class where oid = 'public.clubs'::regclass)
) as v;
`,
    "preflight"
  );
  const pref = Array.isArray(preflightBody) ? preflightBody[0]?.v : preflightBody?.v;
  const assignBefore = String(pref?.assign_def || "");
  const clearBefore = String(pref?.clear_def || "");
  report.preflight = {
    stagingRef: STAGING_REF,
    notProduction: true,
    sqlReview: review,
    currentAssignUsesBareTenantMember: /phase42_is_tenant_member/i.test(assignBefore),
    currentClearUsesBareTenantMember: /phase42_is_tenant_member/i.test(clearBefore),
    audit_assign_ok: pref?.audit_assign_ok === true,
    audit_clear_ok: pref?.audit_clear_ok === true,
    rls_clubs: pref?.rls_clubs === true,
    tenant_member_helper_exists: pref?.tenant_member_helper_exists === true,
  };
  console.log("Preflight:", JSON.stringify(report.preflight.sqlReview));

  if (!review.helperRoleSpecific || !review.noBareTenantMemberAuthz || !review.optionalClubOwnerDisabled || !review.noDestructive) {
    report.status = "BLOCKED_SQL_REVIEW";
    writeReport();
    process.exitCode = 2;
    return;
  }
  if (!pref?.audit_assign_ok || !pref?.audit_clear_ok) {
    report.status = "BLOCKED_AUDIT_CONSTRAINT";
    writeReport();
    process.exitCode = 2;
    return;
  }

  // ---- STEP 3 apply ----
  const checksum = createHash("sha256").update(sql, "utf8").digest("hex");
  console.log("\nApplying patch...");
  try {
    await managementSql(token, sql, PATCH);
    report.apply = { file: PATCH, checksum, result: "PASS", finishedAt: new Date().toISOString() };
    console.log("  APPLY PASS");
  } catch (err) {
    report.apply = { file: PATCH, checksum, result: "FAIL", error: String(err.message || err) };
    report.status = "APPLY_FAILED";
    writeReport();
    console.error(`  APPLY FAIL — ${report.apply.error}`);
    process.exitCode = 1;
    return;
  }

  // ---- STEP 4 catalog ----
  const catalogBody = await managementSql(
    token,
    `
select json_build_object(
  'helper_exists', to_regprocedure('public.phase42_can_assign_club_owner(text)') is not null,
  'helper_def', (
    select pg_get_functiondef(p.oid)
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname='public' and p.proname='phase42_can_assign_club_owner' limit 1
  ),
  'assign_def', (
    select pg_get_functiondef(p.oid)
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname='public' and p.proname='club_assign_owner' limit 1
  ),
  'clear_def', (
    select pg_get_functiondef(p.oid)
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname='public' and p.proname='club_clear_owner' limit 1
  ),
  'assign_security', (
    select CASE WHEN p.prosecdef THEN 'DEFINER' ELSE 'INVOKER' END
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname='public' and p.proname='club_assign_owner' limit 1
  ),
  'rls_clubs', (select relrowsecurity from pg_class where oid = 'public.clubs'::regclass),
  'grant_authenticated', exists (
    select 1 from information_schema.routine_privileges
    where specific_schema='public' and routine_name='club_assign_owner'
      and grantee='authenticated' and privilege_type='EXECUTE'
  )
) as v;
`,
    "catalog"
  );
  const cat = Array.isArray(catalogBody) ? catalogBody[0]?.v : catalogBody?.v;
  const assignDef = String(cat?.assign_def || "");
  const clearDef = String(cat?.clear_def || "");
  const helperDef = String(cat?.helper_def || "");
  report.catalog = {
    helper_exists: cat?.helper_exists === true,
    assign_uses_narrow_helper: /phase42_can_assign_club_owner/i.test(assignDef),
    clear_uses_narrow_helper: /phase42_can_assign_club_owner/i.test(clearDef),
    assign_no_bare_tenant_member: !/phase42_is_tenant_member/i.test(assignDef),
    clear_no_bare_tenant_member: !/phase42_is_tenant_member/i.test(clearDef),
    helper_no_bare_tenant_member: !/phase42_is_tenant_member/i.test(helperDef),
    helper_no_club_owner_gov: !/phase42_has_gov_role\([^)]*club_owner/i.test(helperDef),
    helper_no_venue_manager: !/VENUE_MANAGER|COURT_MANAGER/i.test(helperDef),
    assign_security: cat?.assign_security,
    rls_clubs: cat?.rls_clubs === true,
    grant_authenticated: cat?.grant_authenticated === true,
  };
  console.log("Catalog:", JSON.stringify(report.catalog));

  if (
    !report.catalog.helper_exists ||
    !report.catalog.assign_uses_narrow_helper ||
    !report.catalog.clear_uses_narrow_helper ||
    !report.catalog.assign_no_bare_tenant_member ||
    !report.catalog.clear_no_bare_tenant_member ||
    !report.catalog.helper_no_club_owner_gov
  ) {
    report.status = "CATALOG_VERIFY_FAILED";
    writeReport();
    process.exitCode = 1;
    return;
  }

  // ---- STEP 5 live matrix ----
  const keys = await fetchKeys(token);
  const admin = clientFor(url, keys.serviceKey);
  const preferredClub = String(process.env.STAGING_QA_CLUB_ID || "club-smoke-42i1").trim();

  const fixtureRows = await managementSql(
    token,
    `
with pick as (
  select c.id, c.name, c.version, c.tenant_id
  from public.clubs c where c.id = '${preferredClub.replace(/'/g, "''")}' and c.deleted_at is null
),
gov as (
  select g.role_code, m.user_id, coalesce(nullif(p.email,''), u.email) as email
  from public.club_governance_assignments g
  join public.club_members m on m.id = g.club_member_id
  join public.profiles p on p.id = m.user_id
  join auth.users u on u.id = m.user_id
  join pick on pick.id = g.club_id
  where g.status = 'active'
)
select json_build_object(
  'club', (select row_to_json(pick) from pick),
  'owner', (select json_build_object('user_id', user_id, 'email', email) from gov where role_code='club_owner' limit 1),
  'president', (select json_build_object('user_id', user_id, 'email', email) from gov where role_code='president' limit 1),
  'super_admin', (
    select json_build_object('user_id', u.id, 'email', u.email)
    from auth.users u
    where lower(u.email) in ('superadmin.nomember@staging.local','admin@staging.local')
    order by case lower(u.email) when 'superadmin.nomember@staging.local' then 0 else 1 end
    limit 1
  ),
  'tenant_owner', (
    select json_build_object('user_id', tm.user_id, 'email', p.email)
    from public.tenant_members tm
    join public.profiles p on p.id = tm.user_id
    join pick on pick.tenant_id = tm.tenant_id
    where tm.role_code = 'tenant_owner' and coalesce(tm.status,'active')='active'
    limit 1
  ),
  'tenant_staff', (
    select json_build_object('user_id', tm.user_id, 'email', p.email)
    from public.tenant_members tm
    join public.profiles p on p.id = tm.user_id
    join pick on pick.tenant_id = tm.tenant_id
    where tm.role_code = 'tenant_staff' and coalesce(tm.status,'active')='active'
      and not exists (select 1 from gov g where g.user_id = tm.user_id and g.role_code in ('club_owner','president'))
    limit 1
  ),
  'active_member', (
    select json_build_object('user_id', m.user_id, 'email', coalesce(p.email, u.email))
    from public.club_members m
    join pick on pick.id = m.club_id
    left join public.profiles p on p.id = m.user_id
    join auth.users u on u.id = m.user_id
    where m.status='active'
      and not exists (
        select 1 from public.club_governance_assignments g
        where g.club_id = m.club_id and g.club_member_id = m.id and g.status='active' and g.role_code='club_owner'
      )
    limit 1
  ),
  'unrelated', (
    select json_build_object('user_id', u.id, 'email', u.email)
    from auth.users u
    where lower(u.email)='qa42l.nomember@staging.local'
    limit 1
  )
) as fixture;
`,
    "fixture"
  );
  const fixture = Array.isArray(fixtureRows) ? fixtureRows[0]?.fixture : fixtureRows?.fixture;
  const clubId = fixture?.club?.id;
  const tenantId = fixture?.club?.tenant_id;
  if (!clubId || !tenantId) throw new Error("club fixture missing");
  report.clubId = clubId;
  report.tenantId = tenantId;

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
      full_name: `Phase1C ${role}`,
    });
    return { id, email };
  }

  // Ephemeral DENY actors
  const venueManager = await createProfileUser(`phase1c.vm.${stamp}@staging.local`, "VENUE_MANAGER", tenantId);
  const courtManager = await createProfileUser(`phase1c.cm.${stamp}@staging.local`, "COURT_MANAGER", tenantId);
  const player = await createProfileUser(`phase1c.player.${stamp}@staging.local`, "PLAYER", null);

  // Ensure player is active club member for MEMBER_REQUIRED contrast later
  const allowActorEmail = fixture.tenant_owner?.email || fixture.super_admin?.email;
  if (!allowActorEmail) throw new Error("no ALLOW fixture (tenant_owner/SA)");
  await ensurePassword(admin, allowActorEmail, password);
  const allowSession = await signIn(url, keys.anonKey, allowActorEmail, password);
  if (!allowSession.ok) throw new Error(`allow actor sign-in: ${allowSession.error}`);

  let ver = await clubVersion(token, clubId);
  await allowSession.sb.rpc("club_add_member", {
    p_request_id: rid(),
    p_club_id: clubId,
    p_target_user_id: player.id,
    p_membership_type: "regular",
    p_expected_version: null,
  });

  // VP alone
  const vp = await createProfileUser(`phase1c.vp.${stamp}@staging.local`, "PLAYER", null);
  ver = await clubVersion(token, clubId);
  await allowSession.sb.rpc("club_add_member", {
    p_request_id: rid(),
    p_club_id: clubId,
    p_target_user_id: vp.id,
    p_membership_type: "regular",
    p_expected_version: null,
  });
  ver = await clubVersion(token, clubId);
  await allowSession.sb.rpc("club_assign_vice_president", {
    p_request_id: rid(),
    p_club_id: clubId,
    p_member_user_id: vp.id,
    p_expected_club_version: ver,
  });

  const targetMember =
    fixture.active_member ||
    { user_id: player.id, email: player.email };

  const assignRoles = [
    { key: "SUPER_ADMIN", email: fixture.super_admin?.email, expect: "ALLOW" },
    { key: "Tenant owner", email: fixture.tenant_owner?.email, expect: "ALLOW" },
    { key: "Approved tenant admin (TENANT_OWNER profile path)", email: fixture.tenant_owner?.email, expect: "ALLOW", note: "same fixture as tenant_owner when profile path overlaps" },
    { key: "Ordinary tenant_staff", email: fixture.tenant_staff?.email, expect: "FORBIDDEN" },
    { key: "VENUE_MANAGER profile fallback only", email: venueManager.email, expect: "FORBIDDEN" },
    { key: "COURT_MANAGER profile fallback only", email: courtManager.email, expect: "FORBIDDEN" },
    { key: "Club Owner without approved tenant-admin role", email: fixture.owner?.email, expect: "FORBIDDEN", skipIfAlsoTenantOwner: true },
    { key: "Club President", email: fixture.president?.email, expect: "FORBIDDEN" },
    { key: "Vice President", email: vp.email, expect: "FORBIDDEN" },
    { key: "Ordinary club player", email: player.email, expect: "FORBIDDEN" },
    { key: "Unrelated authenticated user", email: fixture.unrelated?.email, expect: "FORBIDDEN" },
  ];

  // Detect if club owner is also tenant_owner (would be ALLOW by policy)
  if (fixture.owner?.user_id && fixture.tenant_owner?.user_id && fixture.owner.user_id === fixture.tenant_owner.user_id) {
    report.warnings.push("Club Owner fixture equals Tenant Owner — Club-Owner-alone DENY row marked SKIP");
  }

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

  function record(matrix, id, ok, detail = {}) {
    matrix.push({ id, ok: Boolean(ok), ...detail });
    console.log(`${ok ? "PASS" : "FAIL"} — ${id}`);
  }

  console.log("\n--- club_assign_owner matrix ---");
  for (const role of assignRoles) {
    if (!role.email) {
      record(report.assignMatrix, `ASSIGN_${role.key}`, false, {
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
      record(report.assignMatrix, `ASSIGN_${role.key}`, true, {
        expected: role.expect,
        actual: "SKIP_OWNER_EQUALS_TENANT_OWNER",
      });
      continue;
    }

    await ensurePassword(admin, role.email, password);
    const session = await signIn(url, keys.anonKey, role.email, password);
    if (!session.ok) {
      record(report.assignMatrix, `ASSIGN_${role.key}`, false, {
        expected: role.expect,
        actual: `sign-in failed: ${session.error}`,
      });
      continue;
    }

    const vBefore = await clubVersion(token, clubId);
    const result = await callAssign(session, vBefore, targetMember.user_id);
    const allowed = result?.ok === true;
    const code = allowed ? "ALLOW" : String(result?.code || "FAIL");
    const expectAllow = role.expect === "ALLOW";
    const ok = expectAllow ? allowed : !allowed && (code === "FORBIDDEN" || code.startsWith("DENY") || code === "FORBIDDEN");
    // For deny, accept FORBIDDEN specifically when expected FORBIDDEN
    const ok2 = expectAllow
      ? allowed
      : !allowed && (role.expect === "FORBIDDEN" ? code === "FORBIDDEN" : true);

    // Restore owner if accidentally mutated by ALLOW path using non-canonical target
    if (allowed) {
      const v2 = await clubVersion(token, clubId);
      if (fixture.owner?.user_id) {
        await allowSession.sb.rpc("club_assign_owner", {
          p_request_id: rid(),
          p_club_id: clubId,
          p_member_user_id: fixture.owner.user_id,
          p_expected_club_version: v2,
        });
      }
    } else {
      const vAfter = await clubVersion(token, clubId);
      if (vAfter !== vBefore) {
        report.warnings.push(`version_bumped_on_deny:${role.key}`);
      }
    }

    record(report.assignMatrix, `ASSIGN_${role.key}`, ok2, {
      expected: role.expect,
      actual: code,
      note: role.note || null,
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
    record(report.assignMatrix, "ASSIGN_Anonymous", code === "NOT_AUTHENTICATED", {
      expected: "NOT_AUTHENTICATED",
      actual: code,
    });
  }

  // Stale version with allowed actor
  {
    await ensurePassword(admin, allowActorEmail, password);
    const session = await signIn(url, keys.anonKey, allowActorEmail, password);
    const vBefore = await clubVersion(token, clubId);
    const result = await callAssign(session, Math.max(1, vBefore - 1), targetMember.user_id);
    const code = result?.code || (result?.ok ? "ALLOW" : "FAIL");
    record(report.assignMatrix, "ASSIGN_stale_version", code === "VERSION_CONFLICT", {
      expected: "VERSION_CONFLICT",
      actual: code,
    });
  }

  // MEMBER_REQUIRED — non-member target
  {
    const stranger = await createProfileUser(`phase1c.stranger.${stamp}@staging.local`, "PLAYER", null);
    await ensurePassword(admin, allowActorEmail, password);
    const session = await signIn(url, keys.anonKey, allowActorEmail, password);
    const vBefore = await clubVersion(token, clubId);
    const result = await callAssign(session, vBefore, stranger.id);
    report.memberRequired = {
      expected: "MEMBER_REQUIRED",
      actual: result?.code || (result?.ok ? "ALLOW" : "FAIL"),
      ok: result?.code === "MEMBER_REQUIRED",
    };
    console.log(`${report.memberRequired.ok ? "PASS" : "FAIL"} — MEMBER_REQUIRED`);
  }

  console.log("\n--- club_clear_owner matrix ---");
  const clearRoles = [
    { key: "SUPER_ADMIN", email: fixture.super_admin?.email, expect: "ALLOW" },
    { key: "Tenant owner", email: fixture.tenant_owner?.email, expect: "ALLOW" },
    { key: "Ordinary tenant_staff", email: fixture.tenant_staff?.email, expect: "FORBIDDEN" },
    { key: "VENUE_MANAGER profile fallback only", email: venueManager.email, expect: "FORBIDDEN" },
    { key: "COURT_MANAGER profile fallback only", email: courtManager.email, expect: "FORBIDDEN" },
    { key: "Club Owner without approved tenant-admin role", email: fixture.owner?.email, expect: "FORBIDDEN", skipIfAlsoTenantOwner: true },
    { key: "Club President", email: fixture.president?.email, expect: "FORBIDDEN" },
    { key: "Vice President", email: vp.email, expect: "FORBIDDEN" },
    { key: "Ordinary club player", email: player.email, expect: "FORBIDDEN" },
    { key: "Unrelated authenticated user", email: fixture.unrelated?.email, expect: "FORBIDDEN" },
  ];

  for (const role of clearRoles) {
    if (!role.email) {
      record(report.clearMatrix, `CLEAR_${role.key}`, false, { expected: role.expect, actual: "no_fixture" });
      continue;
    }
    if (
      role.skipIfAlsoTenantOwner &&
      fixture.owner?.user_id &&
      fixture.tenant_owner?.user_id &&
      fixture.owner.user_id === fixture.tenant_owner.user_id
    ) {
      record(report.clearMatrix, `CLEAR_${role.key}`, true, {
        expected: role.expect,
        actual: "SKIP_OWNER_EQUALS_TENANT_OWNER",
      });
      continue;
    }
    await ensurePassword(admin, role.email, password);
    const session = await signIn(url, keys.anonKey, role.email, password);
    if (!session.ok) {
      record(report.clearMatrix, `CLEAR_${role.key}`, false, {
        expected: role.expect,
        actual: `sign-in failed: ${session.error}`,
      });
      continue;
    }
    const vBefore = await clubVersion(token, clubId);
    const result = await callClear(session, vBefore);
    const allowed = result?.ok === true;
    const code = allowed ? "ALLOW" : String(result?.code || "FAIL");
    const expectAllow = role.expect === "ALLOW";
    const ok = expectAllow ? allowed : !allowed && code === "FORBIDDEN";

    if (allowed) {
      // restore owner
      const v2 = await clubVersion(token, clubId);
      if (fixture.owner?.user_id) {
        await allowSession.sb.rpc("club_assign_owner", {
          p_request_id: rid(),
          p_club_id: clubId,
          p_member_user_id: fixture.owner.user_id,
          p_expected_club_version: v2,
        });
      }
    }
    record(report.clearMatrix, `CLEAR_${role.key}`, ok, { expected: role.expect, actual: code });
  }

  // Anonymous clear
  {
    const anon = clientFor(url, keys.anonKey);
    const vBefore = await clubVersion(token, clubId);
    const { data } = await anon.rpc("club_clear_owner", {
      p_request_id: rid(),
      p_club_id: clubId,
      p_expected_club_version: vBefore,
    });
    const code = data?.code || (data?.ok ? "ALLOW" : "FAIL");
    record(report.clearMatrix, "CLEAR_Anonymous", code === "NOT_AUTHENTICATED", {
      expected: "NOT_AUTHENTICATED",
      actual: code,
    });
  }

  // Stale clear
  {
    await ensurePassword(admin, allowActorEmail, password);
    const session = await signIn(url, keys.anonKey, allowActorEmail, password);
    const vBefore = await clubVersion(token, clubId);
    const result = await callClear(session, Math.max(1, vBefore - 1));
    const code = result?.code || (result?.ok ? "ALLOW" : "FAIL");
    record(report.clearMatrix, "CLEAR_stale_version", code === "VERSION_CONFLICT", {
      expected: "VERSION_CONFLICT",
      actual: code,
    });
  }

  // ---- STEP 6 version + audit for allowed ops ----
  console.log("\n--- version / audit ---");
  await ensurePassword(admin, allowActorEmail, password);
  const allow = await signIn(url, keys.anonKey, allowActorEmail, password);
  const v0 = await clubVersion(token, clubId);
  const assignReq = rid();
  const assignRes = await callAssign(allow, v0, targetMember.user_id);
  const v1 = await clubVersion(token, clubId);
  const clearReq = rid();
  const clearRes = await callClear(allow, v1);
  const v2 = await clubVersion(token, clubId);
  // restore original owner
  if (fixture.owner?.user_id) {
    await allow.sb.rpc("club_assign_owner", {
      p_request_id: rid(),
      p_club_id: clubId,
      p_member_user_id: fixture.owner.user_id,
      p_expected_club_version: v2,
    });
  }

  const auditRows = await managementSql(
    token,
    `
select json_build_object(
  'assign_audit', exists (
    select 1 from public.audit_logs
    where action = 'club.assign_owner'
      and (resource_id = '${clubId.replace(/'/g, "''")}' or club_id = '${clubId.replace(/'/g, "''")}')
      and created_at > now() - interval '15 minutes'
  ),
  'clear_audit', exists (
    select 1 from public.audit_logs
    where action = 'club.clear_owner'
      and (resource_id = '${clubId.replace(/'/g, "''")}' or club_id = '${clubId.replace(/'/g, "''")}')
      and created_at > now() - interval '15 minutes'
  )
) as v;
`,
    "audit"
  );
  const audit = Array.isArray(auditRows) ? auditRows[0]?.v : auditRows?.v;
  report.versionAudit = {
    assign_ok: assignRes?.ok === true,
    clear_ok: clearRes?.ok === true,
    version_before: v0,
    version_after_assign: v1,
    version_after_clear: v2,
    assign_bumped: Number.isFinite(v0) && Number.isFinite(v1) && v1 === v0 + 1,
    clear_bumped: Number.isFinite(v1) && Number.isFinite(v2) && v2 === v1 + 1,
    assign_audit: audit?.assign_audit === true,
    clear_audit: audit?.clear_audit === true,
    assign_request_id: assignReq,
    clear_request_id: clearReq,
  };
  console.log("version/audit:", JSON.stringify(report.versionAudit));

  const assignFails = report.assignMatrix.filter((r) => !r.ok);
  const clearFails = report.clearMatrix.filter((r) => !r.ok);
  const blockers = [];
  if (assignFails.length) blockers.push(`assign_matrix:${assignFails.length}`);
  if (clearFails.length) blockers.push(`clear_matrix:${clearFails.length}`);
  if (!report.memberRequired?.ok) blockers.push("member_required");
  if (!report.versionAudit?.assign_bumped || !report.versionAudit?.clear_bumped) blockers.push("version");
  if (!report.versionAudit?.assign_audit || !report.versionAudit?.clear_audit) blockers.push("audit");

  report.status = blockers.length ? `FAIL:${blockers.join(",")}` : "PASS";
  report.finishedAt = new Date().toISOString();
  writeReport();
  console.log(`\nSTATUS: ${report.status}`);
  process.exitCode = blockers.length ? 1 : 0;
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
