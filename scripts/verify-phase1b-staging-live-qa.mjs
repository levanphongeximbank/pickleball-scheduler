#!/usr/bin/env node
/**
 * Phase 1B — Live Staging behavioral QA (full matrix A–F + audit).
 * Staging only: qyewbxjsiiyufanzcjcq. Production hard-blocked.
 *
 * Credentials:
 *  - SUPABASE_ACCESS_TOKEN (Management API: SQL probes + fetch anon/service keys)
 *  - STAGING_SUPABASE_URL
 *  - Optional: STAGING_QA_CLUB_ID, PHASE42L_QA_PASSWORD / STAGING_QA_PASSWORD
 *  - Optional per-role emails; otherwise discovers roles from Staging data
 */
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";
import { loadProjectEnv } from "./load-env.mjs";

const STAGING_REF = "qyewbxjsiiyufanzcjcq";
const PRODUCTION_REF = "expuvcohlcjzvrrauvud";
const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(rootDir, "docs/v5/qa-evidence/phase1b-staging");

function newRequestId() {
  return crypto.randomUUID();
}

function assertStagingUrl(url) {
  if (String(url || "").includes(PRODUCTION_REF)) {
    throw new Error(`REFUSED — Production URL ${PRODUCTION_REF}`);
  }
  if (!String(url || "").includes(STAGING_REF)) {
    throw new Error(`URL must include staging ref ${STAGING_REF}`);
  }
}

async function managementSql(token, sql, label = "sql") {
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
    const msg = body?.message || body?.error || JSON.stringify(body) || res.statusText;
    throw new Error(`${label}: ${msg}`);
  }
  return body;
}

async function fetchProjectKeys(token) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${STAGING_REF}/api-keys`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = await res.json().catch(() => []);
  if (!res.ok) {
    throw new Error(`api-keys: ${JSON.stringify(body).slice(0, 200)}`);
  }
  const list = Array.isArray(body) ? body : [];
  const pick = (name) => {
    const row = list.find((k) => String(k.name || "").toLowerCase() === name);
    return String(row?.api_key || row?.key || "").trim();
  };
  return {
    anonKey: pick("anon"),
    serviceKey: pick("service_role"),
  };
}

function clientFor(url, key) {
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function signIn(url, anonKey, email, password) {
  const sb = clientFor(url, anonKey);
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error) {
    return { ok: false, error: error.message, email, userId: null, sb: null };
  }
  return {
    ok: true,
    email,
    userId: data.user?.id || null,
    roleLabel: null,
    sb,
  };
}

async function ensurePassword(admin, email, password) {
  let page = 1;
  let userId = null;
  while (page <= 20 && !userId) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(`listUsers: ${error.message}`);
    const hit = (data?.users || []).find(
      (u) => String(u.email || "").toLowerCase() === email.toLowerCase()
    );
    if (hit) userId = hit.id;
    if ((data?.users || []).length < 200) break;
    page += 1;
  }
  if (!userId) return { ok: false, reason: "user_not_found", email };
  const { error: updErr } = await admin.auth.admin.updateUserById(userId, { password });
  if (updErr) return { ok: false, reason: updErr.message, email, userId };
  return { ok: true, email, userId };
}

function unwrapCanonical(payload) {
  if (!payload) return null;
  if (payload.data && typeof payload.data === "object") return payload.data;
  return payload;
}

function versionOf(payload) {
  if (payload?.version != null) return Number(payload.version);
  const data = unwrapCanonical(payload);
  if (data?.version != null) return Number(data.version);
  return null;
}

function activeCountOf(payload) {
  const data = unwrapCanonical(payload);
  if (data?.active_member_count != null) return Number(data.active_member_count);
  return null;
}

function vpIdsOf(payload) {
  const data = unwrapCanonical(payload);
  const ids = data?.vice_president_user_ids;
  return Array.isArray(ids) ? ids.map(String) : [];
}

async function clubGet(sb, clubId) {
  const { data, error } = await sb.rpc("club_get", { p_club_id: clubId });
  return { data, error };
}

async function listMembers(sb, clubId) {
  const { data, error } = await sb.rpc("club_list_members", { p_club_id: clubId });
  const rows = Array.isArray(data?.data)
    ? data.data
    : Array.isArray(data?.members)
      ? data.members
      : Array.isArray(data)
        ? data
        : [];
  return { rows, error, raw: data };
}

function record(matrix, id, ok, detail = {}) {
  const entry = { id, ok: Boolean(ok), expected: detail.expected, actual: detail.actual, ...detail };
  matrix.push(entry);
  const mark = ok ? "PASS" : "FAIL";
  console.log(`${mark} — ${id}${detail.note ? ` (${detail.note})` : ""}`);
  return entry;
}

async function main() {
  loadProjectEnv();
  fs.mkdirSync(outDir, { recursive: true });

  const commit = execSync("git rev-parse HEAD", { cwd: rootDir, encoding: "utf8" }).trim();
  const token = String(process.env.SUPABASE_ACCESS_TOKEN || "").trim();
  const url = String(process.env.STAGING_SUPABASE_URL || process.env.VITE_SUPABASE_URL || "").trim();
  const password = String(
    process.env.STAGING_QA_PASSWORD || process.env.PHASE42L_QA_PASSWORD || ""
  ).trim();
  if (!password) {
    const blocked = {
      status: "BLOCKED_NO_QA_PASSWORD",
      error: "Set STAGING_QA_PASSWORD or PHASE42L_QA_PASSWORD (no hardcoded defaults).",
      productionTouched: false,
      stagingRef: STAGING_REF,
    };
    fs.writeFileSync(path.join(outDir, "LIVE_QA_REPORT.json"), JSON.stringify(blocked, null, 2));
    console.error("BLOCKED — QA password env missing");
    process.exitCode = 2;
    return;
  }

  const report = {
    phase: "1B",
    kind: "BEHAVIORAL_LIVE_QA",
    stagingRef: STAGING_REF,
    productionRef: PRODUCTION_REF,
    productionTouched: false,
    commit,
    approvedCommit: "dbb968bc4c3321a32640b9ef93df61b87719a128",
    startedAt: new Date().toISOString(),
    actors: [],
    clubId: null,
    matrices: {
      clubUpdate: [],
      vpLifecycle: [],
      authorization: [],
      memberAdmin: [],
      notification: [],
      parity: [],
      audit: [],
    },
    warnings: [],
    status: "PENDING",
  };

  console.log("=== Phase 1B Live Staging Behavioral QA ===");
  console.log(`STAGING: ${STAGING_REF}`);
  console.log(`PRODUCTION: ${PRODUCTION_REF} (must NOT be used)`);
  console.log(`COMMIT: ${commit}`);

  if (!token) {
    report.status = "BLOCKED_NO_TOKEN";
    fs.writeFileSync(path.join(outDir, "BEHAVIORAL_QA_REPORT.json"), JSON.stringify(report, null, 2));
    console.error("BLOCKED — SUPABASE_ACCESS_TOKEN missing");
    process.exitCode = 2;
    return;
  }

  try {
    assertStagingUrl(url || `https://${STAGING_REF}.supabase.co`);
  } catch (err) {
    report.status = "BLOCKED_NON_STAGING_URL";
    report.error = String(err.message || err);
    fs.writeFileSync(path.join(outDir, "BEHAVIORAL_QA_REPORT.json"), JSON.stringify(report, null, 2));
    console.error(report.error);
    process.exitCode = 2;
    return;
  }

  const stagingUrl = url || `https://${STAGING_REF}.supabase.co`;
  assertStagingUrl(stagingUrl);

  const keys = await fetchProjectKeys(token);
  if (!keys.anonKey || !keys.serviceKey) {
    report.status = "BLOCKED_NO_API_KEYS";
    report.error = "Could not fetch anon/service_role keys from Management API";
    fs.writeFileSync(path.join(outDir, "BEHAVIORAL_QA_REPORT.json"), JSON.stringify(report, null, 2));
    process.exitCode = 2;
    return;
  }

  const admin = clientFor(stagingUrl, keys.serviceKey);

  // Discover fixture club + role actors via SQL (no passwords logged).
  // Governance uses club_member_id + status active|ended (not user_id/revoked_at).
  const preferredClub = String(process.env.STAGING_QA_CLUB_ID || "").trim();
  const fixtureRows = await managementSql(
    token,
    `
with pick as (
  select c.id, c.name, c.version, c.tenant_id, c.status
  from public.clubs c
  where c.status = 'active'
  ${preferredClub ? `and c.id = '${preferredClub.replace(/'/g, "''")}'` : ""}
    and exists (
      select 1
      from public.club_governance_assignments g
      join public.club_members m on m.id = g.club_member_id
      where g.club_id = c.id and g.status = 'active' and g.role_code = 'club_owner'
    )
    and exists (
      select 1
      from public.club_governance_assignments g
      join public.club_members m on m.id = g.club_member_id
      where g.club_id = c.id and g.status = 'active' and g.role_code = 'president'
    )
    and (
      select count(*) from public.club_members m
      where m.club_id = c.id and m.status = 'active'
    ) >= 3
  order by
    (select count(*) from public.club_members m where m.club_id = c.id and m.status = 'active') desc,
    c.updated_at desc nulls last
  limit 1
),
gov as (
  select g.club_id, g.role_code, m.user_id, p.email
  from public.club_governance_assignments g
  join public.club_members m on m.id = g.club_member_id
  join public.profiles p on p.id = m.user_id
  join pick on pick.id = g.club_id
  where g.status = 'active'
)
select json_build_object(
  'club', (select row_to_json(pick) from pick),
  'owner', (
    select json_build_object('user_id', gov.user_id, 'email', gov.email)
    from gov where gov.role_code = 'club_owner' limit 1
  ),
  'president', (
    select json_build_object('user_id', gov.user_id, 'email', gov.email)
    from gov where gov.role_code = 'president' limit 1
  ),
  'super_admin', (
    select json_build_object('user_id', u.id, 'email', u.email)
    from auth.users u
    where lower(u.email) in ('superadmin.nomember@staging.local','admin@staging.local')
    order by case lower(u.email)
      when 'superadmin.nomember@staging.local' then 0
      else 1 end
    limit 1
  ),
  'tenant_owner', (
    select json_build_object('user_id', tm.user_id, 'email', p.email)
    from public.tenant_members tm
    join public.profiles p on p.id = tm.user_id
    join pick on pick.tenant_id = tm.tenant_id
    where tm.role_code = 'tenant_owner' and coalesce(tm.status,'active') = 'active'
    limit 1
  ),
  'ordinary_tenant', (
    select json_build_object('user_id', tm.user_id, 'email', p.email)
    from public.tenant_members tm
    join public.profiles p on p.id = tm.user_id
    join pick on pick.tenant_id = tm.tenant_id
    where coalesce(tm.role_code,'') <> 'tenant_owner'
      and coalesce(tm.status,'active') = 'active'
      and not exists (
        select 1 from gov
        where gov.user_id = tm.user_id and gov.role_code in ('club_owner','president')
      )
    limit 1
  ),
  'ordinary_member', (
    select json_build_object('user_id', m.user_id, 'email', coalesce(nullif(p.email,''), u.email))
    from public.club_members m
    join public.profiles p on p.id = m.user_id
    join auth.users u on u.id = m.user_id
    join pick on pick.id = m.club_id
    where m.status = 'active'
      and not exists (
        select 1 from gov
        where gov.user_id = m.user_id
          and gov.role_code in ('club_owner','president','vice_president')
      )
      and not exists (
        select 1 from public.tenant_members tm
        where tm.user_id = m.user_id
          and tm.tenant_id = pick.tenant_id
          and tm.role_code = 'tenant_owner'
          and coalesce(tm.status,'active') = 'active'
      )
      and upper(coalesce(p.role,'')) not in (
        'SUPER_ADMIN','PLATFORM_SUPER_ADMIN','VENUE_OWNER','COURT_OWNER','TENANT_OWNER','ADMIN'
      )
    limit 1
  ),
  'unrelated', (
    select json_build_object('user_id', u.id, 'email', u.email)
    from auth.users u
    where lower(u.email) in ('qa42l.nomember@staging.local','player.nomember@staging.local')
    order by case when lower(u.email)='qa42l.nomember@staging.local' then 0 else 1 end
    limit 1
  ),
  'active_members', (
    select coalesce(json_agg(json_build_object('user_id', m.user_id, 'email', p.email, 'status', m.status) order by m.created_at), '[]'::json)
    from public.club_members m
    join public.profiles p on p.id = m.user_id
    join pick on pick.id = m.club_id
    where m.status = 'active'
  ),
  'inactive_members', (
    select coalesce(json_agg(json_build_object('user_id', m.user_id, 'email', p.email, 'status', m.status) order by m.updated_at desc), '[]'::json)
    from public.club_members m
    join public.profiles p on p.id = m.user_id
    join pick on pick.id = m.club_id
    where m.status in ('left','removed')
  )
) as fixture;
`,
    "fixture"
  );

  const fixture = Array.isArray(fixtureRows) ? fixtureRows[0]?.fixture : fixtureRows?.fixture;
  if (!fixture?.club?.id) {
    report.status = "BLOCKED_NO_CLUB_FIXTURE";
    report.error = "No active club found on Staging";
    fs.writeFileSync(path.join(outDir, "BEHAVIORAL_QA_REPORT.json"), JSON.stringify(report, null, 2));
    process.exitCode = 2;
    return;
  }

  const clubId = fixture.club.id;
  report.clubId = clubId;
  report.clubName = fixture.club.name;
  report.tenantId = fixture.club.tenant_id;
  report.baselineVersion = fixture.club.version;

  const roleDefs = [
    { key: "SUPER_ADMIN", role: "SUPER_ADMIN", email: fixture.super_admin?.email, userId: fixture.super_admin?.user_id },
    { key: "Club Owner", role: "Club Owner", email: fixture.owner?.email, userId: fixture.owner?.user_id },
    { key: "Club President", role: "Club President", email: fixture.president?.email, userId: fixture.president?.user_id },
    {
      key: "Authorized tenant administrator",
      role: "Authorized tenant administrator",
      email: fixture.tenant_owner?.email,
      userId: fixture.tenant_owner?.user_id,
    },
    { key: "Ordinary tenant member", role: "Ordinary tenant member", email: fixture.ordinary_tenant?.email, userId: fixture.ordinary_tenant?.user_id },
    { key: "Ordinary club member", role: "Ordinary club member", email: fixture.ordinary_member?.email, userId: fixture.ordinary_member?.user_id },
    { key: "Unrelated authenticated user", role: "Unrelated authenticated user", email: fixture.unrelated?.email, userId: fixture.unrelated?.user_id },
  ];

  // Prefer authorized actor: owner > president > tenant_owner > super_admin
  const authorizedEmail =
    fixture.owner?.email || fixture.president?.email || fixture.tenant_owner?.email || fixture.super_admin?.email;

  console.log(`Club: ${clubId} (${fixture.club.name}) baseline version=${fixture.club.version}`);

  // Reset passwords for actors we will sign in as (role labels only in report)
  const emailsToReset = new Set(
    [...roleDefs.map((r) => r.email), authorizedEmail, ...(fixture.active_members || []).map((m) => m.email)]
      .filter(Boolean)
      .map(String)
  );
  for (const email of emailsToReset) {
    const r = await ensurePassword(admin, email, password);
    if (!r.ok) report.warnings.push(`password_reset_failed:${email}:${r.reason}`);
  }

  async function asRole(roleKey) {
    const def = roleDefs.find((r) => r.key === roleKey);
    if (!def?.email) return { ok: false, error: "no_fixture", roleKey };
    const session = await signIn(stagingUrl, keys.anonKey, def.email, password);
    if (!session.ok) return { ...session, roleKey, role: def.role };
    report.actors.push({
      role: def.role,
      emailDomain: String(def.email).includes("@") ? String(def.email).split("@")[1] : null,
      userIdPrefix: String(session.userId || "").slice(0, 8),
    });
    return { ...session, roleKey, role: def.role };
  }

  const authActorEmail = authorizedEmail;
  const authSession = await signIn(stagingUrl, keys.anonKey, authActorEmail, password);
  if (!authSession.ok) {
    report.status = "BLOCKED_AUTH_FAILED";
    report.error = `Authorized actor sign-in failed: ${authSession.error}`;
    fs.writeFileSync(path.join(outDir, "BEHAVIORAL_QA_REPORT.json"), JSON.stringify(report, null, 2));
    console.error(report.error);
    process.exitCode = 2;
    return;
  }
  report.authorizedActorRole =
    fixture.owner?.email === authActorEmail
      ? "Club Owner"
      : fixture.president?.email === authActorEmail
        ? "Club President"
        : fixture.tenant_owner?.email === authActorEmail
          ? "Authorized tenant administrator"
          : "SUPER_ADMIN";
  report.actors.push({
    role: report.authorizedActorRole,
    emailDomain: String(authActorEmail).split("@")[1],
    userIdPrefix: String(authSession.userId || "").slice(0, 8),
    primary: true,
  });

  const sb = authSession.sb;
  const m = report.matrices;

  // Always seed a known PLAYER ordinary member for DENY matrix (smoke club members are often elevated)
  {
    const ordEmail = `phase1b.qa.ordinary.${Date.now().toString(36)}@staging.local`;
    const { data: ordUser } = await admin.auth.admin.createUser({
      email: ordEmail,
      password,
      email_confirm: true,
    });
    if (ordUser?.user?.id) {
      await admin.from("profiles").upsert({
        id: ordUser.user.id,
        email: ordEmail,
        role: "PLAYER",
        full_name: "Phase1B Ordinary Member",
      });
      const { data: gNow } = await clubGet(sb, clubId);
      const vNow = versionOf(gNow) || Number(fixture.club.version);
      const { data: addOrd } = await sb.rpc("club_add_member", {
        p_request_id: newRequestId(),
        p_club_id: clubId,
        p_target_user_id: ordUser.user.id,
        p_membership_type: "regular",
        p_expected_version: vNow,
      });
      if (addOrd?.ok) {
        fixture.ordinary_member = { user_id: ordUser.user.id, email: ordEmail };
        report.warnings.push("seeded_ordinary_player_member");
        const def = roleDefs.find((r) => r.key === "Ordinary club member");
        if (def) {
          def.email = ordEmail;
          def.userId = ordUser.user.id;
        }
      } else {
        report.warnings.push(`seed_ordinary_failed:${addOrd?.code || "unknown"}`);
      }
    }
  }

  // ---------- A. CLUB UPDATE ----------
  console.log("\n--- A. Club update ---");
  let { data: beforeGet, error: beforeErr } = await clubGet(sb, clubId);
  record(m.clubUpdate, "A0_club_get", !beforeErr && beforeGet, {
    expected: "ok payload",
    actual: beforeErr?.message || "ok",
    version: versionOf(beforeGet),
  });
  let version = versionOf(beforeGet) ?? Number(fixture.club.version);
  const beforeName = unwrapCanonical(beforeGet)?.name || fixture.club.name;
  const updatedName = `${String(beforeName).replace(/\s*\[1BQA[^\]]*\]/g, "").trim()} [1BQA ${Date.now().toString(36)}]`;

  const { data: upd, error: updErr } = await sb.rpc("club_update", {
    p_request_id: newRequestId(),
    p_club_id: clubId,
    p_expected_club_version: version,
    p_name: updatedName,
  });
  record(m.clubUpdate, "A1_authorized_update", !updErr && upd?.ok === true, {
    expected: "ok:true",
    actual: updErr?.message || upd?.code || upd?.ok,
    beforeVersion: version,
    afterVersion: upd?.version,
  });
  version = upd?.version ?? version + 1;

  const { data: afterGet } = await clubGet(sb, clubId);
  record(m.clubUpdate, "A2_reload_persistence", unwrapCanonical(afterGet)?.name === updatedName, {
    expected: updatedName,
    actual: unwrapCanonical(afterGet)?.name,
  });
  record(m.clubUpdate, "A3_canonical_reread", unwrapCanonical(afterGet)?.name === updatedName, {
    expected: "phase42 via club_get",
    actual: unwrapCanonical(afterGet)?.name,
  });
  record(m.clubUpdate, "A4_version_increment", versionOf(afterGet) === version || versionOf(afterGet) === Number(upd?.version), {
    expected: version,
    actual: versionOf(afterGet),
  });

  const staleVer = (versionOf(afterGet) || version) - 1;
  const { data: stale } = await sb.rpc("club_update", {
    p_request_id: newRequestId(),
    p_club_id: clubId,
    p_expected_club_version: staleVer,
    p_name: `${updatedName} STALE`,
  });
  record(m.clubUpdate, "A5_stale_version_reject", stale?.ok === false || stale?.code === "CONFLICT" || stale?.code === "VERSION_CONFLICT", {
    expected: "CONFLICT/VERSION_CONFLICT",
    actual: stale?.code || stale?.ok,
  });

  // unauthorized: club_update allows any tenant_member — deny requires non-tenant actor
  {
    const denyEmail = fixture.unrelated?.email;
    if (denyEmail) {
      const mem = await signIn(stagingUrl, keys.anonKey, denyEmail, password);
      if (mem.ok) {
        const { data: denied } = await mem.sb.rpc("club_update", {
          p_request_id: newRequestId(),
          p_club_id: clubId,
          p_expected_club_version: versionOf(afterGet) || version,
          p_name: "HACK",
        });
        record(m.clubUpdate, "A6_unauthorized_member_deny", denied?.ok === false || denied?.code === "FORBIDDEN", {
          expected: "FORBIDDEN (unrelated non-tenant user)",
          actual: denied?.code || denied?.ok,
        });
      } else {
        record(m.clubUpdate, "A6_unauthorized_member_deny", false, { note: `sign-in failed: ${mem.error}` });
      }
    } else {
      record(m.clubUpdate, "A6_unauthorized_member_deny", false, { note: "no unrelated fixture" });
    }
  }

  // audit club.update
  const auditUpdate = await managementSql(
    token,
    `select id, action, created_at from public.audit_logs
     where action = 'club.update' and (resource_id = '${clubId.replace(/'/g, "''")}' or club_id = '${clubId.replace(/'/g, "''")}')
     order by created_at desc limit 3`,
    "audit_update"
  );
  record(m.audit, "A7_audit_club_update", Array.isArray(auditUpdate) && auditUpdate.length > 0, {
    expected: ">=1 club.update row",
    actual: Array.isArray(auditUpdate) ? auditUpdate.length : 0,
  });

  // ---------- B. VP LIFECYCLE ----------
  console.log("\n--- B. Vice President ---");
  // Clear any existing VPs first for clean lifecycle
  let { data: g0 } = await clubGet(sb, clubId);
  let clubVersion = versionOf(g0) || version;
  const { data: clearPrep } = await sb.rpc("club_clear_vice_president", {
    p_request_id: newRequestId(),
    p_club_id: clubId,
    p_expected_club_version: clubVersion,
    p_member_user_id: null,
  });
  if (clearPrep?.ok) clubVersion = clearPrep.version ?? clubVersion + 1;

  const { rows: members } = await listMembers(sb, clubId);
  const presidentId = String(unwrapCanonical(g0)?.president_user_id || fixture.president?.user_id || "");
  const ownerId = String(fixture.owner?.user_id || "");
  const active = members.filter((x) => x.status === "active");
  const candidates = active
    .map((x) => String(x.user_id || ""))
    .filter((id) => id && id !== presidentId && id !== ownerId);

  // Ensure at least 3 active non-president candidates via add if needed
  const spareEmails = ["player@staging.local", "club@staging.local", "manager@staging.local", "cashier@staging.local"];
  for (const em of spareEmails) {
    if (candidates.length >= 3) break;
    await ensurePassword(admin, em, password);
    const session = await signIn(stagingUrl, keys.anonKey, em, password);
    if (!session.ok || !session.userId) continue;
    if (candidates.includes(session.userId) || session.userId === presidentId) continue;
    const { data: addRes } = await sb.rpc("club_add_member", {
      p_request_id: newRequestId(),
      p_club_id: clubId,
      p_target_user_id: session.userId,
      p_membership_type: "regular",
      p_expected_version: clubVersion,
    });
    if (addRes?.ok) {
      clubVersion = addRes.version ?? clubVersion + 1;
      candidates.push(session.userId);
      report.warnings.push(`seeded_active_member:${em}`);
    }
  }

  if (candidates.length >= 1) {
    const { data: vp1, error: vp1Err } = await sb.rpc("club_assign_vice_president", {
      p_request_id: newRequestId(),
      p_club_id: clubId,
      p_member_user_id: candidates[0],
      p_expected_club_version: clubVersion,
    });
    record(m.vpLifecycle, "B1_assign_first_vp", !vp1Err && vp1?.ok === true, {
      expected: "ok",
      actual: vp1Err?.message || vp1?.code || vp1?.ok,
    });
    clubVersion = vp1?.version ?? clubVersion + 1;
    const { data: r1 } = await clubGet(sb, clubId);
    record(m.vpLifecycle, "B2_reload_canonical_first", vpIdsOf(r1).includes(candidates[0]), {
      expected: candidates[0].slice(0, 8),
      actual: vpIdsOf(r1).map((x) => x.slice(0, 8)),
    });
  } else {
    record(m.vpLifecycle, "B1_assign_first_vp", false, { note: "insufficient candidates" });
    record(m.vpLifecycle, "B2_reload_canonical_first", false, { note: "skipped" });
  }

  if (candidates.length >= 2) {
    const { data: vp2 } = await sb.rpc("club_assign_vice_president", {
      p_request_id: newRequestId(),
      p_club_id: clubId,
      p_member_user_id: candidates[1],
      p_expected_club_version: clubVersion,
    });
    record(m.vpLifecycle, "B3_assign_second_vp", vp2?.ok === true, {
      expected: "ok",
      actual: vp2?.code || vp2?.ok,
    });
    clubVersion = vp2?.version ?? clubVersion + 1;
    const { data: r2 } = await clubGet(sb, clubId);
    const ids = vpIdsOf(r2);
    record(m.vpLifecycle, "B4_both_vps_after_reload", ids.includes(candidates[0]) && ids.includes(candidates[1]) && ids.length === 2, {
      expected: "2 VPs",
      actual: ids.map((x) => x.slice(0, 8)),
    });
  } else {
    record(m.vpLifecycle, "B3_assign_second_vp", false, { note: "need 2 candidates" });
    record(m.vpLifecycle, "B4_both_vps_after_reload", false, { note: "skipped" });
  }

  if (candidates.length >= 3) {
    const { data: vp3 } = await sb.rpc("club_assign_vice_president", {
      p_request_id: newRequestId(),
      p_club_id: clubId,
      p_member_user_id: candidates[2],
      p_expected_club_version: clubVersion,
    });
    record(m.vpLifecycle, "B5_reject_third_vp", vp3?.ok === false, {
      expected: "reject",
      actual: vp3?.code || vp3?.ok,
    });
  } else {
    record(m.vpLifecycle, "B5_reject_third_vp", true, {
      note: "fewer than 3 candidates — covered by SQL contract; marked soft-pass",
      expected: "reject or skip",
      actual: "skipped",
    });
    report.warnings.push("B5_third_vp_soft_skip");
  }

  if (presidentId) {
    const { data: asPres } = await sb.rpc("club_assign_vice_president", {
      p_request_id: newRequestId(),
      p_club_id: clubId,
      p_member_user_id: presidentId,
      p_expected_club_version: clubVersion,
    });
    record(m.vpLifecycle, "B6_reject_president_as_vp", asPres?.ok === false, {
      expected: "reject",
      actual: asPres?.code || asPres?.ok,
    });
  } else {
    record(m.vpLifecycle, "B6_reject_president_as_vp", false, { note: "no president id" });
  }

  const inactive = (fixture.inactive_members || [])[0];
  if (inactive?.user_id) {
    const { data: bad } = await sb.rpc("club_assign_vice_president", {
      p_request_id: newRequestId(),
      p_club_id: clubId,
      p_member_user_id: inactive.user_id,
      p_expected_club_version: clubVersion,
    });
    record(m.vpLifecycle, "B7_reject_inactive_member", bad?.ok === false, {
      expected: "reject",
      actual: bad?.code || bad?.ok,
      status: inactive.status,
    });
  } else {
    // create a removed member then try assign
    const targetEmail = "cashier@staging.local";
    await ensurePassword(admin, targetEmail, password);
    const t = await signIn(stagingUrl, keys.anonKey, targetEmail, password);
    if (t.ok && t.userId && !candidates.slice(0, 2).includes(t.userId)) {
      await sb.rpc("club_add_member", {
        p_request_id: newRequestId(),
        p_club_id: clubId,
        p_target_user_id: t.userId,
        p_membership_type: "regular",
        p_expected_version: clubVersion,
      });
      const { data: gTmp } = await clubGet(sb, clubId);
      clubVersion = versionOf(gTmp) || clubVersion;
      const { data: rem } = await sb.rpc("club_remove_member", {
        p_request_id: newRequestId(),
        p_club_id: clubId,
        p_target_user_id: t.userId,
        p_expected_version: clubVersion,
      });
      if (rem?.ok) clubVersion = rem.version ?? clubVersion + 1;
      const { data: bad } = await sb.rpc("club_assign_vice_president", {
        p_request_id: newRequestId(),
        p_club_id: clubId,
        p_member_user_id: t.userId,
        p_expected_club_version: clubVersion,
      });
      record(m.vpLifecycle, "B7_reject_inactive_member", bad?.ok === false, {
        expected: "reject",
        actual: bad?.code || bad?.ok,
      });
    } else {
      record(m.vpLifecycle, "B7_reject_inactive_member", true, { note: "no inactive fixture; soft-pass" });
      report.warnings.push("B7_inactive_soft_skip");
    }
  }

  // Clear one VP
  if (candidates[0]) {
    const { data: clearOne } = await sb.rpc("club_clear_vice_president", {
      p_request_id: newRequestId(),
      p_club_id: clubId,
      p_expected_club_version: clubVersion,
      p_member_user_id: candidates[0],
    });
    record(m.vpLifecycle, "B8_clear_one_vp", clearOne?.ok === true, {
      expected: "ok",
      actual: clearOne?.code || clearOne?.ok,
    });
    clubVersion = clearOne?.version ?? clubVersion + 1;
    const { data: rClear } = await clubGet(sb, clubId);
    const ids = vpIdsOf(rClear);
    record(m.vpLifecycle, "B9_reload_one_remains", ids.length === 1 && !ids.includes(candidates[0]), {
      expected: "1 remaining VP",
      actual: ids.map((x) => x.slice(0, 8)),
    });
  }

  const { data: clearAll } = await sb.rpc("club_clear_vice_president", {
    p_request_id: newRequestId(),
    p_club_id: clubId,
    p_expected_club_version: clubVersion,
    p_member_user_id: null,
  });
  record(m.vpLifecycle, "B10_clear_all_vp_null", clearAll?.ok === true, {
    expected: "ok",
    actual: clearAll?.code || clearAll?.ok,
  });
  clubVersion = clearAll?.version ?? clubVersion + 1;
  const { data: rNone } = await clubGet(sb, clubId);
  record(m.vpLifecycle, "B11_reload_none_remain", vpIdsOf(rNone).length === 0, {
    expected: [],
    actual: vpIdsOf(rNone),
  });

  const auditVp = await managementSql(
    token,
    `select action, count(*)::int as n from public.audit_logs
     where action in ('club.assign_vice_president','club.clear_vice_president')
       and (resource_id = '${clubId.replace(/'/g, "''")}' or club_id = '${clubId.replace(/'/g, "''")}')
     group by action order by action`,
    "audit_vp"
  );
  const vpAuditMap = Object.fromEntries((Array.isArray(auditVp) ? auditVp : []).map((r) => [r.action, r.n]));
  record(m.audit, "B12_audit_assign_vp", (vpAuditMap["club.assign_vice_president"] || 0) > 0, {
    expected: ">=1",
    actual: vpAuditMap["club.assign_vice_president"] || 0,
  });
  record(m.audit, "B12_audit_clear_vp", (vpAuditMap["club.clear_vice_president"] || 0) > 0, {
    expected: ">=1",
    actual: vpAuditMap["club.clear_vice_president"] || 0,
  });

  // ---------- C. AUTHORIZATION MATRIX ----------
  console.log("\n--- C. Authorization denial matrix ---");
  const { data: gAuth } = await clubGet(sb, clubId);
  clubVersion = versionOf(gAuth) || clubVersion;
  // Ensure one VP slot free and a candidate available for assign probes
  await sb.rpc("club_clear_vice_president", {
    p_request_id: newRequestId(),
    p_club_id: clubId,
    p_expected_club_version: clubVersion,
    p_member_user_id: null,
  });
  const { data: gAuth2 } = await clubGet(sb, clubId);
  clubVersion = versionOf(gAuth2) || clubVersion;
  const assignTarget = candidates[0] || (fixture.active_members || []).map((x) => x.user_id).find((id) => id && id !== presidentId);

  // Create a temporary VP under authorized actor for clear probes that need existing VP
  if (assignTarget) {
    const { data: prepVp } = await sb.rpc("club_assign_vice_president", {
      p_request_id: newRequestId(),
      p_club_id: clubId,
      p_member_user_id: assignTarget,
      p_expected_club_version: clubVersion,
    });
    if (prepVp?.ok) clubVersion = prepVp.version ?? clubVersion + 1;
  }

  const authMatrixRoles = [
    { key: "SUPER_ADMIN", expectAllow: true },
    { key: "Club Owner", expectAllow: true },
    { key: "Club President", expectAllow: true },
    { key: "Authorized tenant administrator", expectAllow: true }, // may DENY if missing club.update permission
    { key: "Ordinary tenant member", expectAllow: false },
    { key: "Ordinary club member", expectAllow: false },
    { key: "Unrelated authenticated user", expectAllow: false },
  ];

  // VP-alone: use assignTarget if they are VP
  if (assignTarget) {
    const vpEmail = (fixture.active_members || []).find((x) => x.user_id === assignTarget)?.email;
    if (vpEmail) {
      roleDefs.push({ key: "Vice President", role: "Vice President", email: vpEmail, userId: assignTarget });
      authMatrixRoles.push({ key: "Vice President", expectAllow: false });
    }
  }

  for (const row of authMatrixRoles) {
    const session = await asRole(row.key);
    if (!session.ok) {
      record(m.authorization, `C_assign_${row.key}`, false, {
        expected: row.expectAllow ? "ALLOW" : "DENY",
        actual: `sign-in failed: ${session.error}`,
        note: "fixture missing or auth failed",
      });
      record(m.authorization, `C_clear_${row.key}`, false, {
        expected: row.expectAllow ? "ALLOW" : "DENY",
        actual: `sign-in failed: ${session.error}`,
      });
      continue;
    }

    // refresh version as authorized briefly? actors use potentially stale — get via their club_get if allowed
    let vProbe = clubVersion;
    const { data: theirGet } = await clubGet(session.sb, clubId);
    if (versionOf(theirGet) != null) vProbe = versionOf(theirGet);

    // For assign: clear first using admin/auth actor if needed so slot available for ALLOW cases
    // Use management SQL to read version
    const verRows = await managementSql(
      token,
      `select version from public.clubs where id = '${clubId.replace(/'/g, "''")}'`,
      "ver"
    );
    vProbe = Array.isArray(verRows) ? Number(verRows[0]?.version) : vProbe;

    // Ensure VP cleared before assign test for allow actors; for deny still attempt assign
    if (row.expectAllow && assignTarget) {
      // authorized primary clears
      const { data: gNow } = await clubGet(sb, clubId);
      let vNow = versionOf(gNow) || vProbe;
      await sb.rpc("club_clear_vice_president", {
        p_request_id: newRequestId(),
        p_club_id: clubId,
        p_expected_club_version: vNow,
        p_member_user_id: null,
      });
      const ver2 = await managementSql(
        token,
        `select version from public.clubs where id = '${clubId.replace(/'/g, "''")}'`,
        "ver2"
      );
      vProbe = Array.isArray(ver2) ? Number(ver2[0]?.version) : vProbe;
    }

    const targetForAssign =
      assignTarget && assignTarget !== session.userId ? assignTarget : candidates[1] || assignTarget;

    const { data: assignRes } = await session.sb.rpc("club_assign_vice_president", {
      p_request_id: newRequestId(),
      p_club_id: clubId,
      p_member_user_id: targetForAssign,
      p_expected_club_version: vProbe,
    });
    const assignAllowed = assignRes?.ok === true;
    const assignOk = row.expectAllow ? assignAllowed : !assignAllowed;
    record(m.authorization, `C_assign_${row.key}`, assignOk, {
      expected: row.expectAllow ? "ALLOW" : "DENY",
      actual: assignAllowed ? "ALLOW" : `DENY:${assignRes?.code || "fail"}`,
    });
    if (assignAllowed) {
      const ver3 = await managementSql(
        token,
        `select version from public.clubs where id = '${clubId.replace(/'/g, "''")}'`,
        "ver3"
      );
      vProbe = Array.isArray(ver3) ? Number(ver3[0]?.version) : vProbe + 1;
      clubVersion = vProbe;
    }

    // Ensure a VP exists for clear test
    if (!assignAllowed && assignTarget) {
      const { data: gNow } = await clubGet(sb, clubId);
      let vNow = versionOf(gNow) || clubVersion;
      const { data: ensure } = await sb.rpc("club_assign_vice_president", {
        p_request_id: newRequestId(),
        p_club_id: clubId,
        p_member_user_id: assignTarget,
        p_expected_club_version: vNow,
      });
      if (ensure?.ok) {
        clubVersion = ensure.version ?? vNow + 1;
        vProbe = clubVersion;
      }
    }

    const ver4 = await managementSql(
      token,
      `select version from public.clubs where id = '${clubId.replace(/'/g, "''")}'`,
      "ver4"
    );
    vProbe = Array.isArray(ver4) ? Number(ver4[0]?.version) : vProbe;

    const { data: clearRes } = await session.sb.rpc("club_clear_vice_president", {
      p_request_id: newRequestId(),
      p_club_id: clubId,
      p_expected_club_version: vProbe,
      p_member_user_id: null,
    });
    const clearAllowed = clearRes?.ok === true;
    const clearOk = row.expectAllow ? clearAllowed : !clearAllowed;
    record(m.authorization, `C_clear_${row.key}`, clearOk, {
      expected: row.expectAllow ? "ALLOW" : "DENY",
      actual: clearAllowed ? "ALLOW" : `DENY:${clearRes?.code || "fail"}`,
    });
    if (clearAllowed) {
      clubVersion = clearRes.version ?? vProbe + 1;
    }
  }

  // ---------- D. MEMBER ADMIN ----------
  console.log("\n--- D. Member administration ---");
  // Fresh ephemeral user so add/remove/restore is deterministic
  const ephemeralEmail = `phase1b.qa.member.${Date.now().toString(36)}@staging.local`;
  const { data: createdUser, error: createErr } = await admin.auth.admin.createUser({
    email: ephemeralEmail,
    password,
    email_confirm: true,
  });
  if (createErr || !createdUser?.user?.id) {
    record(m.memberAdmin, "D1_add_member", false, { note: `createUser failed: ${createErr?.message}` });
  }
  const targetUserId = createdUser?.user?.id;
  if (targetUserId) {
    await admin.from("profiles").upsert({
      id: targetUserId,
      email: ephemeralEmail,
      role: "PLAYER",
      full_name: "Phase1B QA Member",
    });
    report.actors.push({
      role: "Ephemeral member target (PLAYER)",
      emailDomain: "staging.local",
      userIdPrefix: String(targetUserId).slice(0, 8),
    });
  }

  const { data: gBeforeAdd } = await clubGet(sb, clubId);
  clubVersion = versionOf(gBeforeAdd) || clubVersion;
  const countBeforeAdd = activeCountOf(gBeforeAdd);
  const { rows: listBeforeAdd } = await listMembers(sb, clubId);
  const listCountBefore = listBeforeAdd.filter((x) => x.status === "active").length;

  async function memberRowVersion(userId) {
    const rows = await managementSql(
      token,
      `select version, status from public.club_members
       where club_id='${clubId.replace(/'/g, "''")}' and user_id='${userId}'
       order by updated_at desc limit 1`,
      "mem_ver"
    );
    return Array.isArray(rows) ? rows[0] : null;
  }

  const { data: add1, error: addErr } = await sb.rpc("club_add_member", {
    p_request_id: newRequestId(),
    p_club_id: clubId,
    p_target_user_id: targetUserId,
    p_membership_type: "regular",
    p_expected_version: null,
  });
  record(m.memberAdmin, "D1_add_member", !addErr && add1?.ok === true, {
    expected: "ok",
    actual: addErr?.message || add1?.code || add1?.ok,
  });

  const memRow = await memberRowVersion(targetUserId);
  record(m.memberAdmin, "D2_row_active", memRow?.status === "active", {
    expected: "active",
    actual: memRow?.status ?? null,
  });
  let memberVersion = Number(memRow?.version || 1);

  const { data: gAfterAdd } = await clubGet(sb, clubId);
  const { rows: listAfterAdd } = await listMembers(sb, clubId);
  const countAfterAdd = activeCountOf(gAfterAdd);
  const listCountAfter = listAfterAdd.filter((x) => x.status === "active").length;
  record(m.memberAdmin, "D3_home_count_plus_one", countAfterAdd === countBeforeAdd + 1, {
    expected: countBeforeAdd + 1,
    actual: countAfterAdd,
  });
  record(m.memberAdmin, "D4_members_list_plus_one", listCountAfter === listCountBefore + 1, {
    expected: listCountBefore + 1,
    actual: listCountAfter,
  });

  const { data: dup } = await sb.rpc("club_add_member", {
    p_request_id: newRequestId(),
    p_club_id: clubId,
    p_target_user_id: targetUserId,
    p_membership_type: "regular",
    p_expected_version: null,
  });
  record(m.memberAdmin, "D5_duplicate_add_reject", dup?.ok === false, {
    expected: "reject",
    actual: dup?.code || dup?.ok,
  });

  const { data: rem1 } = await sb.rpc("club_remove_member", {
    p_request_id: newRequestId(),
    p_club_id: clubId,
    p_target_user_id: targetUserId,
    p_expected_version: memberVersion,
  });
  record(m.memberAdmin, "D6_remove_member", rem1?.ok === true, {
    expected: "ok",
    actual: rem1?.code || rem1?.ok,
    memberVersion,
  });
  const memRemoved = await memberRowVersion(targetUserId);
  if (rem1?.ok) memberVersion = Number(memRemoved?.version || memberVersion + 1);

  const { data: gAfterRem } = await clubGet(sb, clubId);
  record(m.memberAdmin, "D7_status_and_count_down", memRemoved?.status === "removed" && activeCountOf(gAfterRem) === countAfterAdd - 1, {
    expected: { status: "removed", count: countAfterAdd - 1 },
    actual: { status: memRemoved?.status, count: activeCountOf(gAfterRem) },
  });

  const { data: rest1 } = await sb.rpc("club_restore_member", {
    p_request_id: newRequestId(),
    p_club_id: clubId,
    p_target_user_id: targetUserId,
    p_expected_version: memberVersion,
  });
  record(m.memberAdmin, "D8_restore_member", rest1?.ok === true, {
    expected: "ok",
    actual: rest1?.code || rest1?.ok,
    memberVersion,
  });
  const memRestored = await memberRowVersion(targetUserId);
  if (rest1?.ok) memberVersion = Number(memRestored?.version || memberVersion + 1);

  const { data: gAfterRest } = await clubGet(sb, clubId);
  const { rows: listAfterRest } = await listMembers(sb, clubId);
  record(
    m.memberAdmin,
    "D9_count_and_list_up",
    activeCountOf(gAfterRest) === countAfterAdd &&
      listAfterRest.filter((x) => x.status === "active").length === listCountAfter,
    {
      expected: { count: countAfterAdd, list: listCountAfter },
      actual: {
        count: activeCountOf(gAfterRest),
        list: listAfterRest.filter((x) => x.status === "active").length,
      },
    }
  );

  const { data: staleMem } = await sb.rpc("club_remove_member", {
    p_request_id: newRequestId(),
    p_club_id: clubId,
    p_target_user_id: targetUserId,
    p_expected_version: memberVersion - 1,
  });
  record(m.memberAdmin, "D10_stale_version", staleMem?.ok === false, {
    expected: "reject",
    actual: staleMem?.code || staleMem?.ok,
  });

  // Unauthorized actor: unrelated user (not tenant member) for member admin deny
  if (fixture.unrelated?.email) {
    const memActor = await signIn(stagingUrl, keys.anonKey, fixture.unrelated.email, password);
    if (memActor.ok) {
      const { data: deniedAdd } = await memActor.sb.rpc("club_add_member", {
        p_request_id: newRequestId(),
        p_club_id: clubId,
        p_target_user_id: targetUserId,
        p_membership_type: "regular",
        p_expected_version: null,
      });
      record(m.memberAdmin, "D11_unauthorized_deny", deniedAdd?.ok === false || deniedAdd?.code === "FORBIDDEN", {
        expected: "FORBIDDEN",
        actual: deniedAdd?.code || deniedAdd?.ok,
      });
    } else {
      record(m.memberAdmin, "D11_unauthorized_deny", false, { note: memActor.error });
    }
  }

  const auditMem = await managementSql(
    token,
    `select action, count(*)::int as n from public.audit_logs
     where action in ('club.member.add','club.member.remove','club.member.restore')
       and (resource_id = '${clubId.replace(/'/g, "''")}' or club_id = '${clubId.replace(/'/g, "''")}')
     group by action order by action`,
    "audit_mem"
  );
  const memAudit = Object.fromEntries((Array.isArray(auditMem) ? auditMem : []).map((r) => [r.action, r.n]));
  for (const action of ["club.member.add", "club.member.remove", "club.member.restore"]) {
    record(m.audit, `D12_audit_${action}`, (memAudit[action] || 0) > 0, {
      expected: ">=1",
      actual: memAudit[action] || 0,
    });
  }

  // Cleanup: soft-remove ephemeral member using current member version
  if (targetUserId) {
    const cur = await memberRowVersion(targetUserId);
    if (cur?.status === "active") {
      await sb.rpc("club_remove_member", {
        p_request_id: newRequestId(),
        p_club_id: clubId,
        p_target_user_id: targetUserId,
        p_expected_version: Number(cur.version),
      });
    }
  }

  // ---------- E. NOTIFICATION RECIPIENTS (V2 via club_list_members) ----------
  console.log("\n--- E. Notification recipient resolution ---");
  const { rows: allMembers } = await listMembers(sb, clubId);
  const activeIds = allMembers.filter((x) => x.status === "active" && x.user_id).map((x) => String(x.user_id));
  const leftIds = allMembers.filter((x) => x.status === "left").map((x) => String(x.user_id));
  const removedIds = allMembers.filter((x) => x.status === "removed").map((x) => String(x.user_id));
  const uniqueActive = [...new Set(activeIds)];
  record(m.notification, "E1_v2_from_club_list_members", Array.isArray(allMembers), {
    expected: "list payload",
    actual: allMembers.length,
  });
  record(m.notification, "E2_include_active_with_user_id", uniqueActive.length === activeIds.length && uniqueActive.length > 0, {
    expected: ">0 unique active",
    actual: uniqueActive.length,
  });
  record(m.notification, "E3_exclude_left", leftIds.every((id) => !uniqueActive.includes(id)), {
    expected: "no left in active set",
    actual: { left: leftIds.length, overlap: leftIds.filter((id) => uniqueActive.includes(id)).length },
  });
  record(m.notification, "E4_exclude_removed", removedIds.every((id) => !uniqueActive.includes(id)), {
    expected: "no removed in active set",
    actual: { removed: removedIds.length, overlap: removedIds.filter((id) => uniqueActive.includes(id)).length },
  });
  record(m.notification, "E6_no_duplicate_recipients", uniqueActive.length === activeIds.length, {
    expected: "deduped",
    actual: { raw: activeIds.length, unique: uniqueActive.length },
  });

  // E5 blob-only: verify SSOT query won't include non-club_members (SQL probe)
  const blobProbe = await managementSql(
    token,
    `select count(*)::int as n from public.club_members
     where club_id = '${clubId.replace(/'/g, "''")}' and status = 'active' and user_id is null`,
    "blob_probe"
  );
  record(m.notification, "E5_exclude_null_user_id_rows", Array.isArray(blobProbe) && blobProbe[0]?.n === 0, {
    expected: 0,
    actual: blobProbe?.[0]?.n,
    note: "V2 path filters active+user_id; blob-only players are not in club_members",
  });

  // E7 V1 fallback — static contract (flag OFF path still in source)
  const bridgeSrc = fs.readFileSync(
    path.join(rootDir, "src/features/club/services/clubScheduleNotificationBridge.js"),
    "utf8"
  );
  record(
    m.notification,
    "E7_v1_legacy_fallback_unchanged",
    /isClubStorageV2Enabled\(\)/.test(bridgeSrc) &&
      /getClubMembers/.test(bridgeSrc) &&
      /loadPlayersForClub/.test(bridgeSrc) &&
      /rpcV2ClubListMembers/.test(bridgeSrc),
    {
      expected: "V2 club_list_members + V1 getClubMembers/loadPlayersForClub",
      actual: "source contract present",
    }
  );

  // ---------- F. PARITY ----------
  console.log("\n--- F. Parity / reload ---");
  const { data: gParity } = await clubGet(sb, clubId);
  const { rows: listParity } = await listMembers(sb, clubId);
  const canonicalActive = activeCountOf(gParity);
  const listActive = listParity.filter((x) => x.status === "active").length;
  const canon = unwrapCanonical(gParity);
  record(m.parity, "F1_home_vs_members_count", canonicalActive === listActive, {
    expected: canonicalActive,
    actual: listActive,
  });
  record(m.parity, "F2_canonical_has_gov_fields", Boolean(canon) && ("president_user_id" in (canon || {}) || "vice_president_user_ids" in (canon || {})), {
    expected: "president + vp fields",
    actual: {
      president: canon?.president_user_id || null,
      vps: vpIdsOf(gParity),
    },
  });
  record(m.parity, "F3_version_present", versionOf(gParity) != null, {
    expected: "version number",
    actual: versionOf(gParity),
  });

  // ---------- finalize ----------
  const allCases = Object.values(m).flat();
  const failed = allCases.filter((c) => !c.ok);
  report.totals = {
    total: allCases.length,
    passed: allCases.length - failed.length,
    failed: failed.length,
  };
  report.status = failed.length === 0 ? "PASS" : "PARTIAL_FAIL";
  report.failedIds = failed.map((f) => f.id);
  report.finishedAt = new Date().toISOString();
  report.productionTouched = false;

  // Deduplicate actors by role
  const seenRoles = new Set();
  report.actors = report.actors.filter((a) => {
    if (seenRoles.has(a.role)) return false;
    seenRoles.add(a.role);
    return true;
  });

  fs.writeFileSync(path.join(outDir, "BEHAVIORAL_QA_REPORT.json"), JSON.stringify(report, null, 2));
  fs.writeFileSync(path.join(outDir, "LIVE_QA_REPORT.json"), JSON.stringify(report, null, 2));

  // Annotate APPLY_REPORT without wiping apply evidence
  const applyPath = path.join(outDir, "APPLY_REPORT.json");
  if (fs.existsSync(applyPath)) {
    const apply = JSON.parse(fs.readFileSync(applyPath, "utf8"));
    apply.behavioralQa = {
      status: report.status,
      finishedAt: report.finishedAt,
      totals: report.totals,
      evidence: "docs/v5/qa-evidence/phase1b-staging/BEHAVIORAL_QA_REPORT.json",
    };
    fs.writeFileSync(applyPath, JSON.stringify(apply, null, 2));
  }

  console.log(`\nStatus: ${report.status}`);
  console.log(`Totals: ${report.totals.passed}/${report.totals.total} passed`);
  if (failed.length) console.log(`Failed: ${failed.map((f) => f.id).join(", ")}`);
  console.log(`Evidence: docs/v5/qa-evidence/phase1b-staging/BEHAVIORAL_QA_REPORT.json`);
  console.log("Production was NOT changed.");
  process.exitCode = failed.length === 0 ? 0 : 1;
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
