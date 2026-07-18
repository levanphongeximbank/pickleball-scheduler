#!/usr/bin/env node
/**
 * Phase 1B — Apply ONLY club_update authz security gate to Staging, then
 * run targeted club_update authorization live QA.
 *
 * Hard-blocks Production. Does not re-apply the full Phase 1B bundle.
 */
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";
import { loadProjectEnv } from "./load-env.mjs";

const STAGING_REF = "qyewbxjsiiyufanzcjcq";
const PRODUCTION_REF = "expuvcohlcjzvrrauvud";
const PATCH = "docs/v5/phase1b/PHASE_1B_CLUB_UPDATE_AUTHZ_SECURITY_GATE.sql";
const APPROVED = "1d5ac6e57e73f38c1c29f6c09bc07e01f139e773";
const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(rootDir, "docs/v5/qa-evidence/phase1b-staging");

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

async function main() {
  loadProjectEnv();
  fs.mkdirSync(outDir, { recursive: true });
  const commit = execSync("git rev-parse HEAD", { cwd: rootDir, encoding: "utf8" }).trim();
  const token = String(process.env.SUPABASE_ACCESS_TOKEN || "").trim();
  const url = String(process.env.STAGING_SUPABASE_URL || `https://${STAGING_REF}.supabase.co`).trim();
  const report = {
    phase: "1B",
    kind: "CLUB_UPDATE_AUTHZ_GATE_APPLY_AND_QA",
    stagingRef: STAGING_REF,
    productionRef: PRODUCTION_REF,
    productionTouched: false,
    commit,
    approvedCommit: APPROVED,
    startedAt: new Date().toISOString(),
    apply: null,
    verify: null,
    matrix: [],
    persistence: null,
    audit: null,
    livePredicate: null,
    status: "PENDING",
  };
  const password = String(
    process.env.STAGING_QA_PASSWORD || process.env.PHASE42L_QA_PASSWORD || ""
  ).trim();
  if (!password) {
    report.status = "BLOCKED_NO_QA_PASSWORD";
    report.error = "Set STAGING_QA_PASSWORD or PHASE42L_QA_PASSWORD (no hardcoded defaults).";
    fs.writeFileSync(path.join(outDir, "CLUB_UPDATE_AUTHZ_GATE_REPORT.json"), JSON.stringify(report, null, 2));
    process.exitCode = 2;
    return;
  }

  console.log("=== Phase 1B club_update authz gate — Staging only ===");
  console.log(`COMMIT: ${commit}`);
  console.log(`PATCH: ${PATCH}`);

  if (commit !== APPROVED) {
    report.status = "BLOCKED_WRONG_COMMIT";
    report.error = `Expected ${APPROVED}, got ${commit}`;
    fs.writeFileSync(path.join(outDir, "CLUB_UPDATE_AUTHZ_GATE_REPORT.json"), JSON.stringify(report, null, 2));
    process.exitCode = 2;
    return;
  }
  if (!token) {
    report.status = "BLOCKED_NO_TOKEN";
    fs.writeFileSync(path.join(outDir, "CLUB_UPDATE_AUTHZ_GATE_REPORT.json"), JSON.stringify(report, null, 2));
    process.exitCode = 2;
    return;
  }
  if (url.includes(PRODUCTION_REF)) {
    report.status = "BLOCKED_PRODUCTION";
    fs.writeFileSync(path.join(outDir, "CLUB_UPDATE_AUTHZ_GATE_REPORT.json"), JSON.stringify(report, null, 2));
    process.exitCode = 2;
    return;
  }

  const sql = fs.readFileSync(path.join(rootDir, PATCH), "utf8");
  if (/^\s*TRUNCATE\b/im.test(sql) || /^\s*DROP\s+TABLE\b/im.test(sql) || /create policy/i.test(sql)) {
    throw new Error("Patch contains forbidden DDL");
  }
  if (/phase42_can_manage_vice_presidents|club_assign_vice_president|club_clear_vice_president/i.test(sql) === false) {
    // expected — VP not in patch
  }
  if (/club_assign_vice_president|club_clear_vice_president|phase42_can_manage_vice_presidents/i.test(sql)) {
    throw new Error("Patch must not modify VP authorization");
  }

  const checksum = createHash("sha256").update(sql, "utf8").digest("hex");
  console.log("\nApplying patch...");
  try {
    await managementSql(token, sql, PATCH);
    report.apply = { file: PATCH, checksum, result: "PASS", finishedAt: new Date().toISOString() };
    console.log("  APPLY PASS");
  } catch (err) {
    report.apply = { file: PATCH, checksum, result: "FAIL", error: String(err.message || err) };
    report.status = "APPLY_FAILED";
    report.finishedAt = new Date().toISOString();
    fs.writeFileSync(path.join(outDir, "CLUB_UPDATE_AUTHZ_GATE_REPORT.json"), JSON.stringify(report, null, 2));
    console.error(`  APPLY FAIL — ${report.apply.error}`);
    process.exitCode = 1;
    return;
  }

  const verifyBody = await managementSql(
    token,
    `
select json_build_object(
  'helper_exists', to_regprocedure('public.phase42_can_update_club(text)') is not null,
  'club_update_def', (
    select pg_get_functiondef(p.oid)
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname='public' and p.proname='club_update'
    limit 1
  ),
  'helper_def', (
    select pg_get_functiondef(p.oid)
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname='public' and p.proname='phase42_can_update_club'
    limit 1
  ),
  'vp_assign_untouched', (
    select pg_get_functiondef(p.oid) ilike '%phase42_can_manage_vice_presidents%'
      and pg_get_functiondef(p.oid) not ilike '%phase42_can_update_club%'
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname='public' and p.proname='club_assign_vice_president'
    limit 1
  )
) as v;
`,
    "verify"
  );
  const v = Array.isArray(verifyBody) ? verifyBody[0]?.v : verifyBody?.v;
  const def = String(v?.club_update_def || "");
  report.verify = {
    helper_exists: v?.helper_exists,
    uses_phase42_can_update_club: /phase42_can_update_club/i.test(def),
    no_bare_tenant_member: !/phase42_is_tenant_member/i.test(def),
    vp_assign_untouched: v?.vp_assign_untouched === true,
  };
  report.livePredicate = String(v?.helper_def || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 1200);
  console.log("  verify:", JSON.stringify(report.verify));

  if (!report.verify.helper_exists || !report.verify.uses_phase42_can_update_club || !report.verify.no_bare_tenant_member) {
    report.status = "VERIFY_FAILED";
    report.finishedAt = new Date().toISOString();
    fs.writeFileSync(path.join(outDir, "CLUB_UPDATE_AUTHZ_GATE_REPORT.json"), JSON.stringify(report, null, 2));
    process.exitCode = 1;
    return;
  }

  // ---- Live auth matrix ----
  const keys = await fetchKeys(token);
  const admin = clientFor(url, keys.serviceKey);
  const preferredClub = String(process.env.STAGING_QA_CLUB_ID || "club-smoke-42i1").trim();

  const fixtureRows = await managementSql(
    token,
    `
with pick as (
  select c.id, c.name, c.version, c.tenant_id
  from public.clubs c where c.id = '${preferredClub.replace(/'/g, "''")}'
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
  'ordinary_tenant', (
    select json_build_object('user_id', tm.user_id, 'email', p.email)
    from public.tenant_members tm
    join public.profiles p on p.id = tm.user_id
    join pick on pick.tenant_id = tm.tenant_id
    where coalesce(tm.role_code,'') <> 'tenant_owner'
      and coalesce(tm.status,'active')='active'
      and not exists (select 1 from gov g where g.user_id = tm.user_id and g.role_code in ('club_owner','president'))
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
  if (!clubId) throw new Error("club fixture missing");
  report.clubId = clubId;

  const roles = [
    { key: "SUPER_ADMIN", email: fixture.super_admin?.email, expect: true },
    { key: "Club Owner", email: fixture.owner?.email, expect: true },
    { key: "Club President", email: fixture.president?.email, expect: true },
    { key: "Authorized Tenant Owner/Admin", email: fixture.tenant_owner?.email, expect: true },
    { key: "Ordinary tenant member", email: fixture.ordinary_tenant?.email, expect: false },
    { key: "Unrelated authenticated user", email: fixture.unrelated?.email, expect: false },
  ];

  // Seed ordinary PLAYER club member + VP-alone for DENY
  const ownerSession = await (async () => {
    await ensurePassword(admin, fixture.owner.email, password);
    return signIn(url, keys.anonKey, fixture.owner.email, password);
  })();
  if (!ownerSession.ok) throw new Error(`owner sign-in: ${ownerSession.error}`);

  const playerEmail = `phase1b.authz.player.${Date.now().toString(36)}@staging.local`;
  const { data: playerUser } = await admin.auth.admin.createUser({
    email: playerEmail,
    password,
    email_confirm: true,
  });
  await admin.from("profiles").upsert({
    id: playerUser.user.id,
    email: playerEmail,
    role: "PLAYER",
    full_name: "Phase1B Authz Player",
  });
  let { data: g0 } = await ownerSession.sb.rpc("club_get", { p_club_id: clubId });
  let ver = versionOf(g0);
  await ownerSession.sb.rpc("club_add_member", {
    p_request_id: rid(),
    p_club_id: clubId,
    p_target_user_id: playerUser.user.id,
    p_membership_type: "regular",
    p_expected_version: null,
  });
  roles.push({ key: "Ordinary club member / Player", email: playerEmail, expect: false });

  // Separate VP-alone actor (must not also be Owner/President)
  const vpEmail = `phase1b.authz.vp.${Date.now().toString(36)}@staging.local`;
  const { data: vpUser } = await admin.auth.admin.createUser({
    email: vpEmail,
    password,
    email_confirm: true,
  });
  await admin.from("profiles").upsert({
    id: vpUser.user.id,
    email: vpEmail,
    role: "PLAYER",
    full_name: "Phase1B Authz VP Alone",
  });
  ({ data: g0 } = await ownerSession.sb.rpc("club_get", { p_club_id: clubId }));
  ver = versionOf(g0);
  await ownerSession.sb.rpc("club_add_member", {
    p_request_id: rid(),
    p_club_id: clubId,
    p_target_user_id: vpUser.user.id,
    p_membership_type: "regular",
    p_expected_version: null,
  });
  ({ data: g0 } = await ownerSession.sb.rpc("club_get", { p_club_id: clubId }));
  ver = versionOf(g0);
  await ownerSession.sb.rpc("club_clear_vice_president", {
    p_request_id: rid(),
    p_club_id: clubId,
    p_expected_club_version: ver,
    p_member_user_id: null,
  });
  ({ data: g0 } = await ownerSession.sb.rpc("club_get", { p_club_id: clubId }));
  ver = versionOf(g0);
  const { data: vpAssign } = await ownerSession.sb.rpc("club_assign_vice_president", {
    p_request_id: rid(),
    p_club_id: clubId,
    p_member_user_id: vpUser.user.id,
    p_expected_club_version: ver,
  });
  if (vpAssign?.ok) {
    roles.push({ key: "Vice President alone", email: vpEmail, expect: false });
  } else {
    report.warnings = report.warnings || [];
    report.warnings.push(`vp_seed_failed:${vpAssign?.code}`);
  }

  const record = (id, ok, detail = {}) => {
    report.matrix.push({ id, ok: Boolean(ok), ...detail });
    console.log(`${ok ? "PASS" : "FAIL"} — ${id}`);
  };

  console.log("\n--- club_update auth matrix ---");
  for (const role of roles) {
    if (!role.email) {
      record(`UPDATE_${role.key}`, false, { expected: role.expect ? "ALLOW" : "DENY", actual: "no_fixture" });
      continue;
    }
    await ensurePassword(admin, role.email, password);
    const session = await signIn(url, keys.anonKey, role.email, password);
    if (!session.ok) {
      record(`UPDATE_${role.key}`, false, {
        expected: role.expect ? "ALLOW" : "DENY",
        actual: `sign-in failed: ${session.error}`,
      });
      continue;
    }
    const verRows = await managementSql(
      token,
      `select version from public.clubs where id='${clubId.replace(/'/g, "''")}'`,
      "ver"
    );
    const vNow = Array.isArray(verRows) ? Number(verRows[0]?.version) : null;
    const marker = `AUTHZ ${role.key} ${Date.now().toString(36)}`;
    const { data: upd } = await session.sb.rpc("club_update", {
      p_request_id: rid(),
      p_club_id: clubId,
      p_expected_club_version: vNow,
      p_name: role.expect ? `CLB Smoke 42I1 [${marker}]` : "HACK DENY",
    });
    const allowed = upd?.ok === true;
    const ok = role.expect ? allowed : !allowed;
    record(`UPDATE_${role.key}`, ok, {
      expected: role.expect ? "ALLOW" : "DENY",
      actual: allowed ? "ALLOW" : `DENY:${upd?.code || "fail"}`,
      note: role.note || null,
    });
  }

  // Persistence / version / stale / audit — as Owner
  console.log("\n--- persistence / version / audit ---");
  await ensurePassword(admin, fixture.owner.email, password);
  const owner = await signIn(url, keys.anonKey, fixture.owner.email, password);
  const verBeforeRows = await managementSql(
    token,
    `select version, name from public.clubs where id='${clubId.replace(/'/g, "''")}'`,
    "before"
  );
  const beforeVer = Number(verBeforeRows[0]?.version);
  const newName = `CLB Smoke 42I1 [AUTHZ-QA ${Date.now().toString(36)}]`;
  const { data: updOk } = await owner.sb.rpc("club_update", {
    p_request_id: rid(),
    p_club_id: clubId,
    p_expected_club_version: beforeVer,
    p_name: newName,
  });
  const { data: afterGet } = await owner.sb.rpc("club_get", { p_club_id: clubId });
  const afterVer = versionOf(afterGet);
  const afterName = unwrap(afterGet)?.name;
  const { data: stale } = await owner.sb.rpc("club_update", {
    p_request_id: rid(),
    p_club_id: clubId,
    p_expected_club_version: beforeVer,
    p_name: "STALE",
  });
  const auditRows = await managementSql(
    token,
    `select count(*)::int as n from public.audit_logs
     where action='club.update'
       and (resource_id='${clubId.replace(/'/g, "''")}' or club_id='${clubId.replace(/'/g, "''")}')
       and created_at > now() - interval '15 minutes'`,
    "audit"
  );
  report.persistence = {
    authorized_update_ok: updOk?.ok === true,
    reload_name_matches: afterName === newName,
    version_before: beforeVer,
    version_after: afterVer,
    version_incremented: afterVer === beforeVer + 1,
    stale_rejected: stale?.ok === false && String(stale?.code || "").includes("VERSION"),
    stale_code: stale?.code || null,
  };
  report.audit = {
    club_update_recent_count: Array.isArray(auditRows) ? auditRows[0]?.n : null,
    ok: Array.isArray(auditRows) && Number(auditRows[0]?.n) > 0,
  };
  record("persistence_authorized_reload", report.persistence.authorized_update_ok && report.persistence.reload_name_matches, report.persistence);
  record("version_increment", report.persistence.version_incremented, {
    expected: beforeVer + 1,
    actual: afterVer,
  });
  record("stale_version_conflict", report.persistence.stale_rejected, {
    expected: "VERSION_CONFLICT",
    actual: stale?.code,
  });
  record("audit_club_update", report.audit.ok, report.audit);

  // Restore clean club name
  const verNowRows = await managementSql(
    token,
    `select version from public.clubs where id='${clubId.replace(/'/g, "''")}'`,
    "restore_ver"
  );
  await owner.sb.rpc("club_update", {
    p_request_id: rid(),
    p_club_id: clubId,
    p_expected_club_version: Number(verNowRows[0]?.version),
    p_name: "CLB Smoke 42I1",
  });
  // Clear VP + soft-remove seeded players
  const ver2 = await managementSql(
    token,
    `select version from public.clubs where id='${clubId.replace(/'/g, "''")}'`,
    "v2"
  );
  await owner.sb.rpc("club_clear_vice_president", {
    p_request_id: rid(),
    p_club_id: clubId,
    p_expected_club_version: Number(ver2[0]?.version),
    p_member_user_id: null,
  });
  for (const uid of [playerUser.user.id, vpUser?.user?.id].filter(Boolean)) {
    const mem = await managementSql(
      token,
      `select version, status from public.club_members
       where club_id='${clubId.replace(/'/g, "''")}' and user_id='${uid}'
       order by updated_at desc limit 1`,
      "mem"
    );
    if (mem?.[0]?.status === "active") {
      await owner.sb.rpc("club_remove_member", {
        p_request_id: rid(),
        p_club_id: clubId,
        p_target_user_id: uid,
        p_expected_version: Number(mem[0].version),
      });
    }
  }

  const failed = report.matrix.filter((m) => !m.ok);
  report.totals = { total: report.matrix.length, passed: report.matrix.length - failed.length, failed: failed.length };
  report.status = failed.length === 0 && report.apply?.result === "PASS" ? "PASS" : "PARTIAL_FAIL";
  report.productionTouched = false;
  report.finishedAt = new Date().toISOString();
  fs.writeFileSync(path.join(outDir, "CLUB_UPDATE_AUTHZ_GATE_REPORT.json"), JSON.stringify(report, null, 2));

  // Annotate APPLY_REPORT
  const applyPath = path.join(outDir, "APPLY_REPORT.json");
  if (fs.existsSync(applyPath)) {
    const apply = JSON.parse(fs.readFileSync(applyPath, "utf8"));
    apply.clubUpdateAuthzGate = {
      status: report.status,
      commit,
      patch: PATCH,
      finishedAt: report.finishedAt,
      evidence: "docs/v5/qa-evidence/phase1b-staging/CLUB_UPDATE_AUTHZ_GATE_REPORT.json",
    };
    fs.writeFileSync(applyPath, JSON.stringify(apply, null, 2));
  }

  console.log(`\nStatus: ${report.status} (${report.totals.passed}/${report.totals.total})`);
  console.log("Evidence: docs/v5/qa-evidence/phase1b-staging/CLUB_UPDATE_AUTHZ_GATE_REPORT.json");
  console.log("Production was NOT changed.");
  process.exitCode = report.status === "PASS" ? 0 : 1;
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
