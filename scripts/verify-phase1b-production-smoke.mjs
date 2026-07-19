#!/usr/bin/env node
/**
 * Phase 1B — Production live smoke (RPC matrix A–F).
 * Target: expuvcohlcjzvrrauvud only. Staging hard-blocked.
 *
 * Auth: admin magic-link OTP (no password reset on Production users).
 * Requires: SUPABASE_ACCESS_TOKEN, PHASE1B_PRODUCTION_GO=1
 */
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { fileURLToPath } from "node:url";
import { loadProjectEnv } from "./load-env.mjs";

const STAGING_REF = "qyewbxjsiiyufanzcjcq";
const PRODUCTION_REF = "expuvcohlcjzvrrauvud";
const APPROVED_MAIN_SHA = "959c8067ea756aa32e50b549a97cd4e762786ff7";
const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(rootDir, "docs/v5/qa-evidence/phase1b-production");

function newRequestId() {
  return crypto.randomUUID();
}

function clientFor(url, key) {
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function managementSql(token, sql, label = "sql") {
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
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`${label}: ${body?.message || body?.error || JSON.stringify(body)}`);
  }
  return body;
}

async function fetchProjectKeys(token) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${PRODUCTION_REF}/api-keys`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = await res.json().catch(() => []);
  if (!res.ok) throw new Error(`api-keys: ${JSON.stringify(body).slice(0, 200)}`);
  const list = Array.isArray(body) ? body : [];
  const pick = (name) => {
    const row = list.find((k) => String(k.name || "").toLowerCase() === name);
    return String(row?.api_key || row?.key || "").trim();
  };
  return { anonKey: pick("anon"), serviceKey: pick("service_role") };
}

async function signInMagic(admin, url, anonKey, email) {
  const { data, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  if (error || !data?.properties?.hashed_token) {
    return { ok: false, error: error?.message || "generateLink failed", email };
  }
  const sb = clientFor(url, anonKey);
  const { data: sessionData, error: verifyError } = await sb.auth.verifyOtp({
    type: "email",
    token_hash: data.properties.hashed_token,
  });
  if (verifyError || !sessionData?.session) {
    return { ok: false, error: verifyError?.message || "verifyOtp failed", email };
  }
  return {
    ok: true,
    email,
    userId: sessionData.user?.id || sessionData.session?.user?.id || null,
    sb,
  };
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

function errCode(error, data) {
  const msg = String(error?.message || data?.error || data?.code || data?.message || "");
  if (/FORBIDDEN|permission|không có quyền/i.test(msg) || data?.code === "FORBIDDEN") {
    return "FORBIDDEN";
  }
  if (/VERSION_CONFLICT|conflict/i.test(msg) || data?.code === "VERSION_CONFLICT") {
    return "VERSION_CONFLICT";
  }
  if (/ALREADY_MEMBER/i.test(msg) || data?.code === "ALREADY_MEMBER") return "ALREADY_MEMBER";
  if (/VALIDATION|INVALID/i.test(msg)) return "VALIDATION";
  return msg.slice(0, 120) || "ERROR";
}

function isDeny(error, data) {
  const code = errCode(error, data);
  return code === "FORBIDDEN" || /FORBIDDEN/i.test(code);
}

function isOkRpc(error, data) {
  if (error) return false;
  if (data?.ok === false) return false;
  if (data?.error || data?.code === "FORBIDDEN") return false;
  return true;
}

function record(matrix, id, ok, detail = {}) {
  const entry = { id, ok: Boolean(ok), ...detail };
  matrix.push(entry);
  console.log(`${ok ? "PASS" : "FAIL"} — ${id}${detail.note ? ` (${detail.note})` : ""}`);
  return entry;
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

async function main() {
  loadProjectEnv();
  fs.mkdirSync(outDir, { recursive: true });

  const go = String(process.env.PHASE1B_PRODUCTION_GO || "").trim() === "1";
  const token = String(process.env.SUPABASE_ACCESS_TOKEN || "").trim();
  const report = {
    phase: "1B",
    kind: "PRODUCTION_SMOKE",
    productionRef: PRODUCTION_REF,
    stagingRef: STAGING_REF,
    approvedMainSha: APPROVED_MAIN_SHA,
    startedAt: new Date().toISOString(),
    actors: [],
    matrices: {
      clubUpdate: [],
      vpLifecycle: [],
      memberAdmin: [],
      parity: [],
      notification: [],
      audit: [],
    },
    totals: { pass: 0, fail: 0 },
    warnings: [],
    status: "PENDING",
  };

  console.log("=== Phase 1B Production Smoke ===");
  console.log(`PRODUCTION: ${PRODUCTION_REF}`);
  console.log(`APPROVED SHA: ${APPROVED_MAIN_SHA}`);

  if (!go) {
    report.status = "BLOCKED_NO_GO";
    fs.writeFileSync(path.join(outDir, "SMOKE_REPORT.json"), JSON.stringify(report, null, 2));
    process.exitCode = 2;
    return;
  }
  if (!token) {
    report.status = "BLOCKED_NO_TOKEN";
    fs.writeFileSync(path.join(outDir, "SMOKE_REPORT.json"), JSON.stringify(report, null, 2));
    process.exitCode = 2;
    return;
  }

  const url = `https://${PRODUCTION_REF}.supabase.co`;
  if (url.includes(STAGING_REF)) throw new Error("Staging URL refused");

  try {
    const keys = await fetchProjectKeys(token);
    if (!keys.anonKey || !keys.serviceKey) throw new Error("Missing Production API keys");
    const admin = clientFor(url, keys.serviceKey);

    const preferredClub = String(process.env.PRODUCTION_QA_CLUB_ID || "").trim();
    const fixtureRows = await managementSql(
      token,
      `
with pick as (
  select c.id, c.name, c.version, c.tenant_id, c.status
  from public.clubs c
  where c.status = 'active' and c.deleted_at is null
  ${preferredClub ? `and c.id = '${preferredClub.replace(/'/g, "''")}'` : ""}
  order by c.updated_at desc nulls last
  limit 1
),
gov as (
  select g.club_id, g.role_code, m.user_id, p.email, p.role as profile_role
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
        select 1 from gov where gov.user_id = tm.user_id
          and gov.role_code in ('club_owner','president')
      )
    limit 1
  ),
  'player', (
    select json_build_object('user_id', m.user_id, 'email', coalesce(nullif(p.email,''), u.email))
    from public.club_members m
    join public.profiles p on p.id = m.user_id
    join auth.users u on u.id = m.user_id
    join pick on pick.id = m.club_id
    where m.status = 'active'
      and not exists (
        select 1 from gov where gov.user_id = m.user_id
          and gov.role_code in ('club_owner','president','vice_president')
      )
      and not exists (
        select 1 from public.tenant_members tm
        where tm.user_id = m.user_id and tm.tenant_id = pick.tenant_id
          and tm.role_code = 'tenant_owner'
      )
      and upper(coalesce(p.role,'')) in ('PLAYER','')
    limit 1
  ),
  'unrelated', (
    select json_build_object('user_id', u.id, 'email', u.email)
    from auth.users u
    where lower(u.email) like '%nomember%'
       or lower(u.email) = 'qa42l-prod-player-nomember@pickleball-scheduler.qa'
    order by case when lower(u.email) like '%nomember%' then 0 else 1 end
    limit 1
  ),
  'vp_candidates', (
    select coalesce(json_agg(json_build_object('user_id', m.user_id, 'email', p.email) order by m.created_at), '[]'::json)
    from public.club_members m
    join public.profiles p on p.id = m.user_id
    join pick on pick.id = m.club_id
    where m.status = 'active'
      and not exists (
        select 1 from gov where gov.user_id = m.user_id
          and gov.role_code in ('club_owner','president')
      )
    limit 5
  )
) as fixture;
`,
      "fixture"
    );

    const fixture = Array.isArray(fixtureRows) ? fixtureRows[0]?.fixture : fixtureRows?.fixture;
    if (!fixture?.club?.id) throw new Error("No Production club fixture");
    const clubId = fixture.club.id;
    report.clubId = clubId;
    report.clubName = fixture.club.name;
    report.baselineVersion = fixture.club.version;
    console.log(`Club: ${clubId} (${fixture.club.name}) v=${fixture.club.version}`);

    const roleMap = {
      Owner: fixture.owner,
      President: fixture.president,
      "Tenant admin": fixture.tenant_owner,
      "Ordinary tenant": fixture.ordinary_tenant,
      Player: fixture.player,
      Unrelated: fixture.unrelated,
    };

    // Ensure DENY actors exist (Production may lack ordinary tenant / nomember fixtures).
    async function ensureDenyActor(kind) {
      if (kind === "Ordinary tenant" && fixture.ordinary_tenant?.email) return;
      if (kind === "Unrelated" && fixture.unrelated?.email) return;

      const email = `phase1b-${kind === "Ordinary tenant" ? "ord-tenant" : "unrelated"}-${Date.now()}@pickleball-scheduler.qa`;
      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email,
        email_confirm: true,
        password: crypto.randomUUID() + "Aa1!",
      });
      if (createErr || !created?.user?.id) {
        throw new Error(`ensureDenyActor ${kind}: ${createErr?.message || "create failed"}`);
      }
      const userId = created.user.id;
      await managementSql(
        token,
        `
insert into public.profiles (id, email, role, status)
values ('${userId}'::uuid, '${email.replace(/'/g, "''")}', 'PLAYER', 'active')
on conflict (id) do update set email = excluded.email, status = 'active';
`,
        `profile-${kind}`
      );

      if (kind === "Ordinary tenant") {
        const tenantId = String(fixture.club.tenant_id || "").replace(/'/g, "''");
        await managementSql(
          token,
          `
insert into public.tenant_members (tenant_id, user_id, role_code, status)
select '${tenantId}', '${userId}'::uuid, 'tenant_staff', 'active'
where not exists (
  select 1 from public.tenant_members
  where tenant_id = '${tenantId}' and user_id = '${userId}'::uuid
);
`,
          "tenant-staff"
        );
        fixture.ordinary_tenant = { user_id: userId, email };
        roleMap["Ordinary tenant"] = fixture.ordinary_tenant;
      } else {
        fixture.unrelated = { user_id: userId, email };
        roleMap.Unrelated = fixture.unrelated;
      }
      report.warnings.push(`Ephemeral ${kind} actor seeded for DENY matrix`);
    }

    await ensureDenyActor("Ordinary tenant");
    await ensureDenyActor("Unrelated");

    async function asRole(label) {
      const row = roleMap[label];
      if (!row?.email) return { ok: false, error: "no_fixture", label };
      const session = await signInMagic(admin, url, keys.anonKey, row.email);
      if (session.ok) {
        report.actors.push({
          role: label,
          emailDomain: String(row.email).includes("@") ? String(row.email).split("@")[1] : null,
          userIdPrefix: String(session.userId || "").slice(0, 8),
        });
      }
      return { ...session, label };
    }

    function tally(ok) {
      if (ok) report.totals.pass += 1;
      else report.totals.fail += 1;
    }

    // ---------- A. club_update authz ----------
    const originalName = fixture.club.name;
    const get0 = await (async () => {
      const owner = await asRole("Owner");
      if (!owner.ok) throw new Error(`Owner sign-in failed: ${owner.error}`);
      return clubGet(owner.sb, clubId);
    })();
    let version = versionOf(get0.data) ?? Number(fixture.club.version);

    for (const [label, expectAllow] of [
      ["Owner", true],
      ["President", true],
      ["Tenant admin", true],
      ["Ordinary tenant", false],
      ["Player", false],
      ["Unrelated", false],
    ]) {
      const actor = await asRole(label);
      if (!actor.ok) {
        const ok = record(report.matrices.clubUpdate, `UPDATE_${label}`, false, {
          expected: expectAllow ? "ALLOW" : "DENY",
          actual: `NO_SESSION:${actor.error}`,
        });
        tally(ok.ok);
        continue;
      }
      const probeName = expectAllow ? `${originalName} · 1B` : originalName;
      const { data, error } = await actor.sb.rpc("club_update", {
        p_request_id: newRequestId(),
        p_club_id: clubId,
        p_expected_club_version: version,
        p_name: probeName,
        p_code: null,
        p_description: null,
        p_status: null,
        p_registered_cluster_id: null,
      });
      const allowed = isOkRpc(error, data);
      const denied = isDeny(error, data) || (!allowed && !expectAllow);
      const ok = expectAllow ? allowed : denied;
      record(report.matrices.clubUpdate, `UPDATE_${label}`, ok, {
        expected: expectAllow ? "ALLOW" : "DENY",
        actual: expectAllow ? (allowed ? "ALLOW" : errCode(error, data)) : denied ? "DENY" : "ALLOW_UNEXPECTED",
      });
      tally(ok);
      if (expectAllow && allowed) {
        version = versionOf(data) ?? version + 1;
      }
    }

    // Restore name + stale version
    {
      const owner = await asRole("Owner");
      const { data: cur } = await clubGet(owner.sb, clubId);
      version = versionOf(cur) ?? version;
      const { data, error } = await owner.sb.rpc("club_update", {
        p_request_id: newRequestId(),
        p_club_id: clubId,
        p_expected_club_version: version,
        p_name: originalName,
        p_code: null,
        p_description: null,
        p_status: null,
        p_registered_cluster_id: null,
      });
      const okRestore = isOkRpc(error, data);
      record(report.matrices.clubUpdate, "UPDATE_restore_name", okRestore, {
        expected: "ALLOW",
        actual: okRestore ? "ALLOW" : errCode(error, data),
      });
      tally(okRestore);
      if (okRestore) version = versionOf(data) ?? version + 1;

      const { data: staleData, error: staleErr } = await owner.sb.rpc("club_update", {
        p_request_id: newRequestId(),
        p_club_id: clubId,
        p_expected_club_version: Math.max(0, version - 2),
        p_name: originalName,
        p_code: null,
        p_description: null,
        p_status: null,
        p_registered_cluster_id: null,
      });
      const stale =
        errCode(staleErr, staleData) === "VERSION_CONFLICT" ||
        /VERSION_CONFLICT/i.test(String(staleData?.code || staleErr?.message || ""));
      record(report.matrices.clubUpdate, "UPDATE_stale_version", stale, {
        expected: "VERSION_CONFLICT",
        actual: errCode(staleErr, staleData),
      });
      tally(stale);
    }

    if (report.totals.fail > 0) {
      report.status = "FAILED_STOP";
      report.finishedAt = new Date().toISOString();
      fs.writeFileSync(path.join(outDir, "SMOKE_REPORT.json"), JSON.stringify(report, null, 2));
      console.error("STOP — club_update matrix failed");
      process.exitCode = 1;
      return;
    }

    // ---------- B. VP lifecycle ----------
    const owner = await asRole("Owner");
    const { data: beforeVp } = await clubGet(owner.sb, clubId);
    version = versionOf(beforeVp) ?? version;
    // Clear any existing VPs first
    {
      const { data, error } = await owner.sb.rpc("club_clear_vice_president", {
        p_request_id: newRequestId(),
        p_club_id: clubId,
        p_member_user_id: null,
        p_expected_club_version: version,
      });
      if (isOkRpc(error, data)) version = versionOf(data) ?? version + 1;
    }

    const candidates = (fixture.vp_candidates || []).filter(
      (c) =>
        c.user_id &&
        c.user_id !== fixture.owner?.user_id &&
        c.user_id !== fixture.president?.user_id
    );
    if (candidates.length < 2) {
      report.warnings.push("Fewer than 2 VP candidates — some VP cases may skip");
    }
    const vp1 = candidates[0];
    const vp2 = candidates[1];
    const vp3 = candidates[2] || candidates[0];

    async function assignVp(userId, ver) {
      return owner.sb.rpc("club_assign_vice_president", {
        p_request_id: newRequestId(),
        p_club_id: clubId,
        p_member_user_id: userId,
        p_expected_club_version: ver,
      });
    }

    if (vp1?.user_id) {
      const { data, error } = await assignVp(vp1.user_id, version);
      const ok = isOkRpc(error, data);
      record(report.matrices.vpLifecycle, "VP_assign_1", ok, {
        expected: "ALLOW",
        actual: ok ? "ALLOW" : errCode(error, data),
      });
      tally(ok);
      if (ok) version = versionOf(data) ?? version + 1;
    } else {
      record(report.matrices.vpLifecycle, "VP_assign_1", false, { note: "no candidate" });
      tally(false);
    }

    if (vp2?.user_id) {
      const { data, error } = await assignVp(vp2.user_id, version);
      const ok = isOkRpc(error, data);
      record(report.matrices.vpLifecycle, "VP_assign_2", ok, {
        expected: "ALLOW",
        actual: ok ? "ALLOW" : errCode(error, data),
      });
      tally(ok);
      if (ok) version = versionOf(data) ?? version + 1;
    } else {
      record(report.matrices.vpLifecycle, "VP_assign_2", false, { note: "no second candidate" });
      tally(false);
    }

    if (vp3?.user_id) {
      const { data, error } = await assignVp(vp3.user_id, version);
      const rejected = !isOkRpc(error, data);
      record(report.matrices.vpLifecycle, "VP_reject_third", rejected, {
        expected: "DENY",
        actual: rejected ? errCode(error, data) : "ALLOW_UNEXPECTED",
      });
      tally(rejected);
    }

    if (fixture.president?.user_id) {
      const { data, error } = await assignVp(fixture.president.user_id, version);
      const rejected = !isOkRpc(error, data);
      record(report.matrices.vpLifecycle, "VP_reject_president", rejected, {
        expected: "DENY",
        actual: rejected ? errCode(error, data) : "ALLOW_UNEXPECTED",
      });
      tally(rejected);
    }

    if (vp1?.user_id) {
      const { data, error } = await owner.sb.rpc("club_clear_vice_president", {
        p_request_id: newRequestId(),
        p_club_id: clubId,
        p_member_user_id: vp1.user_id,
        p_expected_club_version: version,
      });
      const ok = isOkRpc(error, data);
      record(report.matrices.vpLifecycle, "VP_clear_one", ok, {
        expected: "ALLOW",
        actual: ok ? "ALLOW" : errCode(error, data),
      });
      tally(ok);
      if (ok) version = versionOf(data) ?? version + 1;
    }

    {
      const { data, error } = await owner.sb.rpc("club_clear_vice_president", {
        p_request_id: newRequestId(),
        p_club_id: clubId,
        p_member_user_id: null,
        p_expected_club_version: version,
      });
      const ok = isOkRpc(error, data);
      const { data: after } = await clubGet(owner.sb, clubId);
      const empty = vpIdsOf(after).length === 0;
      record(report.matrices.vpLifecycle, "VP_clear_all", ok && empty, {
        expected: "ALLOW_EMPTY",
        actual: ok ? `ALLOW vp=${vpIdsOf(after).length}` : errCode(error, data),
      });
      tally(ok && empty);
      if (ok) version = versionOf(data) ?? version + 1;
    }

    if (report.totals.fail > 0) {
      report.status = "FAILED_STOP";
      report.finishedAt = new Date().toISOString();
      fs.writeFileSync(path.join(outDir, "SMOKE_REPORT.json"), JSON.stringify(report, null, 2));
      console.error("STOP — VP matrix failed");
      process.exitCode = 1;
      return;
    }

    // ---------- C. Member lifecycle ----------
    const ephemeralEmail = `phase1b-smoke-${Date.now()}@pickleball-scheduler.qa`;
    const { data: createdUser, error: createErr } = await admin.auth.admin.createUser({
      email: ephemeralEmail,
      email_confirm: true,
      password: crypto.randomUUID() + "Aa1!",
    });
    if (createErr || !createdUser?.user?.id) {
      throw new Error(`ephemeral user create failed: ${createErr?.message}`);
    }
    const targetUserId = createdUser.user.id;
    report.warnings.push("Ephemeral Auth user created for member smoke (soft-remove after)");

    // Ensure profile row exists lightly via SQL if needed
    await managementSql(
      token,
      `
insert into public.profiles (id, email, role, status)
values ('${targetUserId}'::uuid, '${ephemeralEmail.replace(/'/g, "''")}', 'PLAYER', 'active')
on conflict (id) do update set email = excluded.email;
`,
      "ensure-profile"
    );

    let memberVersion = null;
    {
      const { data, error } = await owner.sb.rpc("club_add_member", {
        p_request_id: newRequestId(),
        p_club_id: clubId,
        p_target_user_id: targetUserId,
        p_membership_type: "PLAYER",
        p_expected_version: null,
      });
      const ok = isOkRpc(error, data);
      memberVersion = data?.version ?? data?.data?.version ?? null;
      record(report.matrices.memberAdmin, "member_add", ok, {
        expected: "ALLOW",
        actual: ok ? "ALLOW" : errCode(error, data),
      });
      tally(ok);
    }

    {
      const { data, error } = await owner.sb.rpc("club_add_member", {
        p_request_id: newRequestId(),
        p_club_id: clubId,
        p_target_user_id: targetUserId,
        p_membership_type: "PLAYER",
        p_expected_version: memberVersion,
      });
      const dup =
        errCode(error, data) === "ALREADY_MEMBER" ||
        /ALREADY_MEMBER/i.test(String(data?.code || error?.message || ""));
      record(report.matrices.memberAdmin, "member_duplicate", dup, {
        expected: "ALREADY_MEMBER",
        actual: errCode(error, data),
      });
      tally(dup);
    }

    {
      // Resolve current member version
      const memRows = await managementSql(
        token,
        `select version from public.club_members
         where club_id = '${clubId.replace(/'/g, "''")}' and user_id = '${targetUserId}'::uuid
         order by updated_at desc limit 1`,
        "member-version"
      );
      const row = Array.isArray(memRows) ? memRows[0] : memRows;
      memberVersion = Number(row?.version ?? memberVersion);

      const { data, error } = await owner.sb.rpc("club_remove_member", {
        p_request_id: newRequestId(),
        p_club_id: clubId,
        p_target_user_id: targetUserId,
        p_expected_version: memberVersion,
      });
      const ok = isOkRpc(error, data);
      record(report.matrices.memberAdmin, "member_remove", ok, {
        expected: "ALLOW",
        actual: ok ? "ALLOW" : errCode(error, data),
      });
      tally(ok);
      if (ok) memberVersion = data?.version ?? memberVersion + 1;
    }

    {
      const memRows = await managementSql(
        token,
        `select version, status from public.club_members
         where club_id = '${clubId.replace(/'/g, "''")}' and user_id = '${targetUserId}'::uuid
         order by updated_at desc limit 1`,
        "member-version-2"
      );
      const row = Array.isArray(memRows) ? memRows[0] : memRows;
      memberVersion = Number(row?.version ?? memberVersion);

      const { data, error } = await owner.sb.rpc("club_restore_member", {
        p_request_id: newRequestId(),
        p_club_id: clubId,
        p_target_user_id: targetUserId,
        p_expected_version: memberVersion,
      });
      const ok = isOkRpc(error, data);
      record(report.matrices.memberAdmin, "member_restore", ok, {
        expected: "ALLOW",
        actual: ok ? "ALLOW" : errCode(error, data),
      });
      tally(ok);
      if (ok) memberVersion = data?.version ?? memberVersion + 1;
    }

    {
      const { data, error } = await owner.sb.rpc("club_remove_member", {
        p_request_id: newRequestId(),
        p_club_id: clubId,
        p_target_user_id: targetUserId,
        p_expected_version: 1,
      });
      const conflict =
        errCode(error, data) === "VERSION_CONFLICT" ||
        /VERSION_CONFLICT/i.test(String(data?.code || error?.message || ""));
      // If version happens to be 1, force a different stale value
      let okConflict = conflict;
      if (!conflict) {
        const { data: d2, error: e2 } = await owner.sb.rpc("club_remove_member", {
          p_request_id: newRequestId(),
          p_club_id: clubId,
          p_target_user_id: targetUserId,
          p_expected_version: 999999,
        });
        okConflict =
          errCode(e2, d2) === "VERSION_CONFLICT" ||
          /VERSION_CONFLICT/i.test(String(d2?.code || e2?.message || ""));
      }
      record(report.matrices.memberAdmin, "member_version_conflict", okConflict, {
        expected: "VERSION_CONFLICT",
        actual: okConflict ? "VERSION_CONFLICT" : errCode(error, data),
      });
      tally(okConflict);
    }

    {
      const unrelated = await asRole("Unrelated");
      if (!unrelated.ok) {
        record(report.matrices.memberAdmin, "member_unauthorized", false, {
          note: `no unrelated session: ${unrelated.error}`,
        });
        tally(false);
      } else {
        const { data, error } = await unrelated.sb.rpc("club_add_member", {
          p_request_id: newRequestId(),
          p_club_id: clubId,
          p_target_user_id: targetUserId,
          p_membership_type: "PLAYER",
          p_expected_version: null,
        });
        const denied = isDeny(error, data) || !isOkRpc(error, data);
        record(report.matrices.memberAdmin, "member_unauthorized", denied, {
          expected: "DENY",
          actual: denied ? "DENY" : "ALLOW_UNEXPECTED",
        });
        tally(denied);
      }
    }

    // Soft-remove ephemeral membership to leave club clean
    {
      const memRows = await managementSql(
        token,
        `select version, status from public.club_members
         where club_id = '${clubId.replace(/'/g, "''")}' and user_id = '${targetUserId}'::uuid
         order by updated_at desc limit 1`,
        "member-cleanup-ver"
      );
      const row = Array.isArray(memRows) ? memRows[0] : memRows;
      if (row?.status === "active") {
        await owner.sb.rpc("club_remove_member", {
          p_request_id: newRequestId(),
          p_club_id: clubId,
          p_target_user_id: targetUserId,
          p_expected_version: Number(row.version),
        });
      }
    }

    if (report.totals.fail > 0) {
      report.status = "FAILED_STOP";
      report.finishedAt = new Date().toISOString();
      fs.writeFileSync(path.join(outDir, "SMOKE_REPORT.json"), JSON.stringify(report, null, 2));
      console.error("STOP — member matrix failed");
      process.exitCode = 1;
      return;
    }

    // ---------- D. Parity ----------
    {
      const { data: canon, error: cErr } = await clubGet(owner.sb, clubId);
      const { rows, error: lErr } = await listMembers(owner.sb, clubId);
      const activeRows = rows.filter((r) => String(r.status || "").toLowerCase() === "active");
      const homeCount = activeCountOf(canon);
      const listCount = activeRows.length;
      const ok =
        !cErr &&
        !lErr &&
        homeCount != null &&
        homeCount === listCount &&
        versionOf(canon) != null &&
        Array.isArray(vpIdsOf(canon));
      record(report.matrices.parity, "home_members_canonical", ok, {
        expected: "counts_match",
        actual: `home=${homeCount} list=${listCount} version=${versionOf(canon)} vp=${vpIdsOf(canon).length}`,
      });
      tally(ok);
    }

    // ---------- E. Notification recipients ----------
    {
      const { rows } = await listMembers(owner.sb, clubId);
      const activeRows = rows.filter((r) => String(r.status || "").toLowerCase() === "active");
      const recipients = activeRows.filter((r) => r.user_id);
      const inactiveInRecipientList = recipients.some((r) =>
        ["left", "removed"].includes(String(r.status || "").toLowerCase())
      );
      const nullUser = recipients.some((r) => !r.user_id);
      const ok =
        recipients.length === activeRows.length &&
        !inactiveInRecipientList &&
        !nullUser &&
        recipients.length > 0;
      record(report.matrices.notification, "V2_recipients_active_userid", ok, {
        expected: "active+user_id only",
        actual: `active=${activeRows.length} recipients=${recipients.length}`,
      });
      tally(ok);

      // V1 fallback: source-contract check only (no flag flip on Production)
      const bridgePath = path.join(
        rootDir,
        "src/features/club/services/clubScheduleNotificationBridge.js"
      );
      const bridgeSrc = fs.readFileSync(bridgePath, "utf8");
      const v1 =
        /getClubMembers|loadPlayersForClub/.test(bridgeSrc) &&
        /isClubStorageV2Enabled|Club Storage V2/i.test(bridgeSrc);
      record(report.matrices.notification, "V1_fallback_source_contract", v1, {
        expected: "legacy path present under flag OFF",
        actual: v1 ? "PRESENT" : "MISSING",
      });
      tally(v1);
    }

    // ---------- F. Audit ----------
    const auditCheck = await managementSql(
      token,
      `
select json_build_object(
  'club_update', exists (
    select 1 from public.audit_logs
    where action = 'club.update' and club_id = '${clubId.replace(/'/g, "''")}'
      and created_at > now() - interval '2 hours'
  ),
  'vp_assign', exists (
    select 1 from public.audit_logs
    where action = 'club.assign_vice_president' and club_id = '${clubId.replace(/'/g, "''")}'
      and created_at > now() - interval '2 hours'
  ),
  'vp_clear', exists (
    select 1 from public.audit_logs
    where action = 'club.clear_vice_president' and club_id = '${clubId.replace(/'/g, "''")}'
      and created_at > now() - interval '2 hours'
  ),
  'member_add', exists (
    select 1 from public.audit_logs
    where action = 'club.member.add' and club_id = '${clubId.replace(/'/g, "''")}'
      and created_at > now() - interval '2 hours'
  ),
  'member_remove', exists (
    select 1 from public.audit_logs
    where action = 'club.member.remove' and club_id = '${clubId.replace(/'/g, "''")}'
      and created_at > now() - interval '2 hours'
  ),
  'member_restore', exists (
    select 1 from public.audit_logs
    where action = 'club.member.restore' and club_id = '${clubId.replace(/'/g, "''")}'
      and created_at > now() - interval '2 hours'
  )
) as audits;
`,
      "audits"
    );
    const audits = Array.isArray(auditCheck) ? auditCheck[0]?.audits : auditCheck?.audits;
    for (const [key, label] of [
      ["club_update", "audit_club.update"],
      ["vp_assign", "audit_club.assign_vice_president"],
      ["vp_clear", "audit_club.clear_vice_president"],
      ["member_add", "audit_club.member.add"],
      ["member_remove", "audit_club.member.remove"],
      ["member_restore", "audit_club.member.restore"],
    ]) {
      const ok = Boolean(audits?.[key]);
      record(report.matrices.audit, label, ok, {
        expected: "PRESENT",
        actual: ok ? "PRESENT" : "MISSING",
      });
      tally(ok);
    }

    report.status = report.totals.fail === 0 ? "PASS" : "FAIL";
    report.finishedAt = new Date().toISOString();
    fs.writeFileSync(path.join(outDir, "SMOKE_REPORT.json"), JSON.stringify(report, null, 2));

    const md = [
      "# Phase 1B — Production Smoke Report",
      "",
      `**Verdict:** ${report.status}`,
      `**Totals:** ${report.totals.pass} pass / ${report.totals.fail} fail`,
      `**Production:** \`${PRODUCTION_REF}\``,
      `**Code SHA:** \`${APPROVED_MAIN_SHA}\``,
      `**Club:** \`${clubId}\``,
      "",
      "## Authorization matrix (club_update)",
      ...report.matrices.clubUpdate.map(
        (r) => `- ${r.ok ? "PASS" : "FAIL"} ${r.id}: expected ${r.expected}, actual ${r.actual}`
      ),
      "",
      "## Audit",
      ...report.matrices.audit.map((r) => `- ${r.ok ? "PASS" : "FAIL"} ${r.id}`),
      "",
    ].join("\n");
    fs.writeFileSync(path.join(outDir, "SMOKE_REPORT.md"), md);

    console.log(`\nStatus: ${report.status} (${report.totals.pass} pass / ${report.totals.fail} fail)`);
    console.log(`Evidence: docs/v5/qa-evidence/phase1b-production/SMOKE_REPORT.json`);
    if (report.totals.fail > 0) process.exitCode = 1;
  } catch (err) {
    report.status = "ERROR";
    report.error = String(err?.message || err);
    report.finishedAt = new Date().toISOString();
    fs.writeFileSync(path.join(outDir, "SMOKE_REPORT.json"), JSON.stringify(report, null, 2));
    console.error(report.error);
    process.exitCode = 1;
  }
}

main();
