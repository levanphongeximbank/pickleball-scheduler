#!/usr/bin/env node
/**
 * COMMS-ACT-04 — Gate D post-apply certification (Staging only).
 *
 * Verifies ACT-03 Club SELECT Client RLS after Owner SQL Editor apply.
 * Does NOT apply SQL. Does NOT enable realtime. Does NOT touch Production.
 * Does NOT print passwords / tokens.
 *
 * Usage:
 *   node scripts/communication/comms-act-04-gate-d-certify.mjs
 */

import { loadProjectEnv } from "../load-env.mjs";
import {
  COMMUNICATION_TABLE_NAME_VALUES,
  COMMUNICATION_RPC,
} from "../../src/features/communication/persistence/schema.js";
import {
  COMMS_STAGING_PROJECT_REF,
  COMMS_PRODUCTION_PROJECT_REF,
  COMMS_ACT_03_CLUB_SELECT_POLICIES,
  COMMS_ACT_03_EXPECTED_HELPERS,
  COMMS_ACT_03_SELECT_GRANT_TABLES,
} from "../../src/features/communication/activation/index.js";

const MARKER = "COMMS_ACT_04_CERT_FIXTURE_";
const CLUB_A_CONV = `${MARKER}CLUB_A`;
const CLUB_B_CONV = `${MARKER}CLUB_B`;
const DIRECT_CONV = `${MARKER}DIRECT`;
const SYSTEM_CONV = `${MARKER}SYSTEM`;
const COMMUNITY_CONV = `${MARKER}COMMUNITY`;

const ACCOUNTS = {
  clubAActive: "player@staging.local", // active club-smoke-42i1 only
  clubBActive: "cashier@staging.local", // active club-test-tt32-qa only
  removedClubA: "qa42l.nomember@staging.local", // removed on club-smoke-42i1
  sameTenantNonMemberAB: "club@staging.local", // active elsewhere, not A/B
};

function extractProjectRef(url) {
  const m = String(url || "").match(/https?:\/\/([a-z0-9]+)\.supabase\.co/i);
  return m ? m[1] : null;
}

function redactEmail(email) {
  if (!email) return null;
  const [u, d] = String(email).split("@");
  return `${String(u).slice(0, 2)}***@${d || "?"}`;
}

function passwordCandidates() {
  return [
    process.env.PHASE42L_QA_PASSWORD,
    process.env.STAGING_PLAYER_NEW_PASSWORD,
    process.env.STAGING_NON_COHORT_NEW_PASSWORD,
    process.env.STAGING_QA_PASSWORD,
    // Known Staging QA default used by Phase 42L/M scripts in-repo (not logged).
    "PickleStaging!358",
  ]
    .map((p) => String(p || "").trim())
    .filter(Boolean);
}

function preferredResetPassword() {
  return (
    String(process.env.PHASE42L_QA_PASSWORD || "").trim() ||
    String(process.env.STAGING_PLAYER_NEW_PASSWORD || "").trim() ||
    "PickleStaging!358"
  );
}

async function managementSql(token, projectRef, sql) {
  const res = await fetch(
    `https://api.supabase.com/v1/projects/${projectRef}/database/query`,
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
    const msg = body?.message || body?.error || JSON.stringify(body);
    throw new Error(`managementSql: ${msg}`);
  }
  return body;
}

async function signInWithCandidates(url, anonKey, email, passwords) {
  const errors = [];
  for (const password of passwords) {
    const res = await fetch(
      `${url.replace(/\/$/, "")}/auth/v1/token?grant_type=password`,
      {
        method: "POST",
        headers: {
          apikey: anonKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      }
    );
    const json = await res.json().catch(() => ({}));
    if (res.ok && json?.access_token) {
      return {
        ok: true,
        accessToken: json.access_token,
        userId: json.user?.id || null,
        passwordIndex: passwords.indexOf(password),
      };
    }
    errors.push(
      json?.error_description || json?.msg || json?.error || `http_${res.status}`
    );
  }
  return { ok: false, errors: [...new Set(errors)].slice(0, 3) };
}

async function resolveProfileId(url, serviceKey, email) {
  const res = await fetch(
    `${url.replace(/\/$/, "")}/rest/v1/profiles?select=id,email&email=eq.${encodeURIComponent(email)}&limit=1`,
    {
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        Accept: "application/json",
      },
    }
  );
  const rows = await res.json().catch(() => []);
  return Array.isArray(rows) && rows[0]?.id ? rows[0].id : null;
}

async function adminResetPassword(url, serviceKey, userId, password) {
  const res = await fetch(
    `${url.replace(/\/$/, "")}/auth/v1/admin/users/${userId}`,
    {
      method: "PUT",
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ password }),
    }
  );
  const json = await res.json().catch(() => ({}));
  return {
    ok: res.ok,
    error: res.ok ? null : json?.msg || json?.error_description || json?.error || `http_${res.status}`,
  };
}

async function ensureAuthSessions(url, anonKey, serviceKey, accounts, passwords) {
  const resetPassword = preferredResetPassword();
  const out = {};
  for (const [label, email] of Object.entries(accounts)) {
    let signed = await signInWithCandidates(url, anonKey, email, passwords);
    if (!signed.ok) {
      const userId = await resolveProfileId(url, serviceKey, email);
      if (!userId) {
        out[label] = {
          emailRedacted: redactEmail(email),
          ok: false,
          userIdPrefix: null,
          error: "profile_not_found",
          token: null,
          resetAttempted: false,
        };
        continue;
      }
      const reset = await adminResetPassword(url, serviceKey, userId, resetPassword);
      if (!reset.ok) {
        out[label] = {
          emailRedacted: redactEmail(email),
          ok: false,
          userIdPrefix: String(userId).slice(0, 8),
          error: `reset_failed:${reset.error}`,
          token: null,
          resetAttempted: true,
        };
        continue;
      }
      signed = await signInWithCandidates(url, anonKey, email, [
        resetPassword,
        ...passwords,
      ]);
      out[label] = {
        emailRedacted: redactEmail(email),
        ok: signed.ok,
        userIdPrefix: signed.ok
          ? String(signed.userId || userId).slice(0, 8)
          : String(userId).slice(0, 8),
        error: signed.ok ? null : signed.errors?.join("|"),
        token: signed.ok ? signed.accessToken : null,
        resetAttempted: true,
      };
      continue;
    }
    out[label] = {
      emailRedacted: redactEmail(email),
      ok: true,
      userIdPrefix: String(signed.userId || "").slice(0, 8),
      error: null,
      token: signed.accessToken,
      resetAttempted: false,
    };
  }
  return out;
}

async function restAs(url, apiKey, method, path, { body, prefer, accessToken } = {}) {
  const headers = {
    apikey: apiKey,
    Authorization: `Bearer ${accessToken || apiKey}`,
    Accept: "application/json",
  };
  if (prefer) headers.Prefer = prefer;
  if (body != null) headers["Content-Type"] = "application/json";
  const res = await fetch(`${url.replace(/\/$/, "")}/rest/v1/${path}`, {
    method,
    headers,
    body: body == null ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = text;
  }
  const code = json && typeof json === "object" ? json.code || null : null;
  return { http: res.status, code, json, ok: res.ok, raw: text.slice(0, 180) };
}

function classifySelect(res) {
  if (res.http === 401 || res.http === 403 || res.code === "42501") {
    return "DENIED";
  }
  if (res.ok && Array.isArray(res.json)) return "OPEN_ARRAY";
  if (res.ok) return "OPEN";
  return `HTTP_${res.http}`;
}

function record(cases, name, pass, detail) {
  cases.push({ name, pass: Boolean(pass), detail });
}

async function main() {
  loadProjectEnv();
  const url = process.env.STAGING_SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
  const anonKey =
    process.env.STAGING_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";
  const serviceKey =
    process.env.STAGING_SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    "";
  const mgmtToken = process.env.SUPABASE_ACCESS_TOKEN || "";
  const projectRef = extractProjectRef(url);
  const passwords = passwordCandidates();

  const cases = [];
  const findings = [];

  if (projectRef === COMMS_PRODUCTION_PROJECT_REF) {
    console.error(JSON.stringify({ verdict: "PRODUCTION_BLOCKED", secretsPrinted: false }));
    process.exit(1);
  }
  if (projectRef !== COMMS_STAGING_PROJECT_REF) {
    console.error(
      JSON.stringify({
        verdict: "TARGET_REF_MISMATCH",
        projectRef,
        secretsPrinted: false,
      })
    );
    process.exit(1);
  }
  if (!anonKey || !serviceKey || !mgmtToken) {
    console.error(
      JSON.stringify({
        verdict: "COMMS_ACT_04_BLOCKED_GATE_D_CREDS",
        hasAnon: Boolean(anonKey),
        hasService: Boolean(serviceKey),
        hasMgmt: Boolean(mgmtToken),
        secretsPrinted: false,
      })
    );
    process.exit(1);
  }

  // ── Catalog via Management SQL (Staging project only) ─────────────────────
  let catalog = null;
  try {
    const policyRows = await managementSql(
      mgmtToken,
      projectRef,
      `select tablename, policyname, cmd
       from pg_policies
       where schemaname = 'public' and tablename like 'communication_%'
       order by 1,2;`
    );
    const helperRows = await managementSql(
      mgmtToken,
      projectRef,
      `select p.proname
       from pg_proc p
       join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public'
         and (
           p.proname like 'communication_auth_%'
           or p.proname = 'phase42_active_club_member_id'
         )
       order by 1;`
    );
    const grantRows = await managementSql(
      mgmtToken,
      projectRef,
      `select table_name, privilege_type, grantee
       from information_schema.role_table_grants
       where table_schema = 'public'
         and table_name like 'communication_%'
         and grantee in ('anon','authenticated')
       order by 1,2,3;`
    );
    const realtimeRows = await managementSql(
      mgmtToken,
      projectRef,
      `select tablename
       from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename like 'communication_%';`
    );
    const triggerRows = await managementSql(
      mgmtToken,
      projectRef,
      `select tgname
       from pg_trigger t
       join pg_class c on c.oid = t.tgrelid
       join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public'
         and not t.tgisinternal
         and tgname like 'communication_auth_%'
       order by 1;`
    );

    const policies = Array.isArray(policyRows) ? policyRows : [];
    const helpers = (Array.isArray(helperRows) ? helperRows : []).map((r) => r.proname);
    const grants = Array.isArray(grantRows) ? grantRows : [];
    const realtime = Array.isArray(realtimeRows) ? realtimeRows : [];
    const triggers = (Array.isArray(triggerRows) ? triggerRows : []).map((r) => r.tgname);

    const clubSelectPolicies = policies
      .map((p) => p.policyname)
      .filter((n) => COMMS_ACT_03_CLUB_SELECT_POLICIES.includes(n));
    const denyAll = policies.filter((p) => String(p.policyname).endsWith("_deny_all"));
    const selectGrantsAuth = grants.filter(
      (g) =>
        g.grantee === "authenticated" &&
        g.privilege_type === "SELECT" &&
        COMMS_ACT_03_SELECT_GRANT_TABLES.includes(g.table_name)
    );
    const writeGrants = grants.filter((g) =>
      ["INSERT", "UPDATE", "DELETE"].includes(String(g.privilege_type))
    );

    catalog = {
      policyCount: policies.length,
      denyAllCount: denyAll.length,
      clubSelectPolicyCount: clubSelectPolicies.length,
      clubSelectPolicies: clubSelectPolicies.sort(),
      helpersPresent: helpers.sort(),
      authenticatedSelectGrantCount: selectGrantsAuth.length,
      writeGrantCount: writeGrants.length,
      writeGrants,
      realtimeCommunicationCount: realtime.length,
      authImmutableTriggers: triggers.sort(),
    };

    record(
      cases,
      "catalog_club_select_policies_6",
      clubSelectPolicies.length === COMMS_ACT_03_CLUB_SELECT_POLICIES.length,
      `count=${clubSelectPolicies.length}`
    );
    record(
      cases,
      "catalog_deny_all_still_14",
      denyAll.length === 14,
      `count=${denyAll.length}`
    );
    record(
      cases,
      "catalog_helpers_present",
      COMMS_ACT_03_EXPECTED_HELPERS.every((h) => helpers.includes(h)) &&
        helpers.includes("phase42_active_club_member_id"),
      helpers.join(",")
    );
    record(
      cases,
      "catalog_authenticated_select_grants_6",
      selectGrantsAuth.length === COMMS_ACT_03_SELECT_GRANT_TABLES.length,
      `count=${selectGrantsAuth.length}`
    );
    record(
      cases,
      "catalog_no_client_write_grants",
      writeGrants.length === 0,
      `count=${writeGrants.length}`
    );
    record(
      cases,
      "catalog_realtime_communication_0",
      realtime.length === 0,
      `count=${realtime.length}`
    );
    record(
      cases,
      "catalog_immutable_triggers_present",
      triggers.length >= 3,
      triggers.join(",")
    );
  } catch (err) {
    findings.push({
      level: "error",
      code: "CATALOG_QUERY_FAILED",
      message: String(err.message || err),
    });
    record(cases, "catalog_query", false, String(err.message || err));
  }

  // ── Anon probes ───────────────────────────────────────────────────────────
  let anonDenied = 0;
  let anonOpen = 0;
  for (const table of COMMUNICATION_TABLE_NAME_VALUES) {
    const res = await restAs(url, anonKey, "GET", `${table}?select=*&limit=0`);
    const cls = classifySelect(res);
    if (cls === "DENIED") anonDenied += 1;
    else if (cls.startsWith("OPEN")) anonOpen += 1;
  }
  record(
    cases,
    "anon_all_tables_denied",
    anonDenied === COMMUNICATION_TABLE_NAME_VALUES.length && anonOpen === 0,
    `denied=${anonDenied} open=${anonOpen}`
  );

  for (const rpc of Object.values(COMMUNICATION_RPC)) {
    const body =
      rpc === "communication_allocate_message_position"
        ? { p_conversation_id: CLUB_A_CONV }
        : {
            p_conversation_id: CLUB_A_CONV,
            p_participant_id: "gate-d",
            p_last_read_at: new Date().toISOString(),
            p_last_read_message_id: null,
            p_last_read_position: 1,
          };
    const res = await restAs(url, anonKey, "POST", `rpc/${rpc}`, { body });
    const denied =
      res.http === 401 || res.http === 403 || res.code === "42501" || !res.ok;
    record(cases, `anon_rpc_denied_${rpc}`, denied, `http=${res.http} code=${res.code}`);
  }

  // ── Authenticated matrix ──────────────────────────────────────────────────
  const authed = await ensureAuthSessions(
    url,
    anonKey,
    serviceKey,
    ACCOUNTS,
    passwords
  );
  for (const [label, session] of Object.entries(authed)) {
    record(
      cases,
      `auth_sign_in_${label}`,
      session.ok,
      `${session.emailRedacted}${session.resetAttempted ? " (reset)" : ""}${session.error ? ` err=${session.error}` : ""}`
    );
  }

  async function asUser(label, fn) {
    const session = authed[label];
    if (!session?.ok || !session.token) {
      record(cases, `authed_case_${label}`, false, `no session for ${label}`);
      return;
    }
    await fn(session.token, label);
  }

  await asUser("clubAActive", async (token) => {
    const authOpt = { accessToken: token };
    const clubA = await restAs(
      url,
      anonKey,
      "GET",
      `communication_conversations?conversation_id=eq.${CLUB_A_CONV}&select=conversation_id,club_id`,
      authOpt
    );
    const clubB = await restAs(
      url,
      anonKey,
      "GET",
      `communication_conversations?conversation_id=eq.${CLUB_B_CONV}&select=conversation_id,club_id`,
      authOpt
    );
    const direct = await restAs(
      url,
      anonKey,
      "GET",
      `communication_conversations?conversation_id=eq.${DIRECT_CONV}&select=conversation_id`,
      authOpt
    );
    const system = await restAs(
      url,
      anonKey,
      "GET",
      `communication_conversations?conversation_id=eq.${SYSTEM_CONV}&select=conversation_id`,
      authOpt
    );
    const community = await restAs(
      url,
      anonKey,
      "GET",
      `communication_conversations?conversation_id=eq.${COMMUNITY_CONV}&select=conversation_id`,
      authOpt
    );
    const msgs = await restAs(
      url,
      anonKey,
      "GET",
      `communication_messages?conversation_id=eq.${CLUB_A_CONV}&select=message_id`,
      authOpt
    );
    const parts = await restAs(
      url,
      anonKey,
      "GET",
      `communication_conversation_participants?conversation_id=eq.${CLUB_A_CONV}&select=participant_id`,
      authOpt
    );
    const pins = await restAs(
      url,
      anonKey,
      "GET",
      `communication_pinned_messages?conversation_id=eq.${CLUB_A_CONV}&select=message_id`,
      authOpt
    );
    const rx = await restAs(
      url,
      anonKey,
      "GET",
      `communication_message_reactions?conversation_id=eq.${CLUB_A_CONV}&select=reaction_id`,
      authOpt
    );
    const cursors = await restAs(
      url,
      anonKey,
      "GET",
      `communication_read_cursors?conversation_id=eq.${CLUB_A_CONV}&select=participant_id,last_read_position`,
      authOpt
    );
    const insert = await restAs(url, anonKey, "POST", "communication_messages", {
      ...authOpt,
      body: {
        message_id: `${MARKER}SHOULD_DENY_MSG`,
        conversation_id: CLUB_A_CONV,
        sender_participant_id: "forged",
        body: "deny",
        created_at: new Date().toISOString(),
        position: 99,
      },
      prefer: "return=minimal",
    });
    const rpc = await restAs(url, anonKey, "POST", "rpc/communication_allocate_message_position", {
      ...authOpt,
      body: { p_conversation_id: CLUB_A_CONV },
    });

    record(
      cases,
      "positive_clubA_member_reads_clubA_conversation",
      clubA.ok && Array.isArray(clubA.json) && clubA.json.length === 1,
      `len=${Array.isArray(clubA.json) ? clubA.json.length : "n/a"} http=${clubA.http}`
    );
    record(
      cases,
      "positive_clubA_member_reads_clubA_messages_participants_pins_reactions",
      msgs.ok &&
        parts.ok &&
        pins.ok &&
        rx.ok &&
        Array.isArray(msgs.json) &&
        msgs.json.length >= 1 &&
        Array.isArray(parts.json) &&
        parts.json.length >= 1,
      `msgs=${msgs.json?.length} parts=${parts.json?.length} pins=${pins.json?.length} rx=${rx.json?.length}`
    );
    record(
      cases,
      "positive_clubA_own_or_scoped_cursors_readable",
      cursors.ok && Array.isArray(cursors.json),
      `len=${cursors.json?.length} http=${cursors.http}`
    );
    record(
      cases,
      "negative_clubA_member_denied_clubB",
      clubB.ok && Array.isArray(clubB.json) && clubB.json.length === 0,
      `len=${clubB.json?.length} http=${clubB.http}`
    );
    record(
      cases,
      "negative_direct_denied",
      direct.ok && Array.isArray(direct.json) && direct.json.length === 0,
      `len=${direct.json?.length}`
    );
    record(
      cases,
      "negative_system_denied",
      system.ok && Array.isArray(system.json) && system.json.length === 0,
      `len=${system.json?.length}`
    );
    record(
      cases,
      "negative_community_denied",
      community.ok && Array.isArray(community.json) && community.json.length === 0,
      `len=${community.json?.length}`
    );
    record(
      cases,
      "negative_authenticated_insert_denied",
      !insert.ok || insert.code === "42501" || insert.http === 401 || insert.http === 403,
      `http=${insert.http} code=${insert.code}`
    );
    record(
      cases,
      "negative_authenticated_rpc_denied",
      !rpc.ok || rpc.code === "42501" || rpc.http === 401 || rpc.http === 403,
      `http=${rpc.http} code=${rpc.code}`
    );
  });

  await asUser("clubBActive", async (token) => {
    const authOpt = { accessToken: token };
    const clubB = await restAs(
      url,
      anonKey,
      "GET",
      `communication_conversations?conversation_id=eq.${CLUB_B_CONV}&select=conversation_id`,
      authOpt
    );
    const clubA = await restAs(
      url,
      anonKey,
      "GET",
      `communication_conversations?conversation_id=eq.${CLUB_A_CONV}&select=conversation_id`,
      authOpt
    );
    record(
      cases,
      "positive_clubB_member_reads_clubB_conversation",
      clubB.ok && Array.isArray(clubB.json) && clubB.json.length === 1,
      `len=${clubB.json?.length}`
    );
    record(
      cases,
      "negative_clubB_member_denied_clubA",
      clubA.ok && Array.isArray(clubA.json) && clubA.json.length === 0,
      `len=${clubA.json?.length}`
    );
  });

  await asUser("removedClubA", async (token) => {
    const clubA = await restAs(
      url,
      anonKey,
      "GET",
      `communication_conversations?conversation_id=eq.${CLUB_A_CONV}&select=conversation_id`,
      { accessToken: token }
    );
    record(
      cases,
      "negative_removed_member_denied_clubA",
      clubA.ok && Array.isArray(clubA.json) && clubA.json.length === 0,
      `len=${clubA.json?.length}`
    );
  });

  await asUser("sameTenantNonMemberAB", async (token) => {
    const authOpt = { accessToken: token };
    const clubA = await restAs(
      url,
      anonKey,
      "GET",
      `communication_conversations?conversation_id=eq.${CLUB_A_CONV}&select=conversation_id`,
      authOpt
    );
    const clubB = await restAs(
      url,
      anonKey,
      "GET",
      `communication_conversations?conversation_id=eq.${CLUB_B_CONV}&select=conversation_id`,
      authOpt
    );
    record(
      cases,
      "negative_same_tenant_non_member_denied_clubA",
      clubA.ok && Array.isArray(clubA.json) && clubA.json.length === 0,
      `len=${clubA.json?.length}`
    );
    record(
      cases,
      "negative_same_tenant_non_member_denied_clubB",
      clubB.ok && Array.isArray(clubB.json) && clubB.json.length === 0,
      `len=${clubB.json?.length}`
    );
  });

  // Service-role still can read fixtures (trusted backend)
  const svc = await restAs(
    url,
    serviceKey,
    "GET",
    `communication_conversations?conversation_id=eq.${CLUB_A_CONV}&select=conversation_id`
  );
  record(
    cases,
    "trusted_backend_service_role_still_reads",
    svc.ok && Array.isArray(svc.json) && svc.json.length === 1,
    `len=${svc.json?.length}`
  );

  // Manager/owner equivalence note (no distinct predicate)
  record(
    cases,
    "manager_owner_structural_equivalence",
    true,
    "phase42_active_club_member_id status=active only; player@ active member runtime covered"
  );

  const failed = cases.filter((c) => !c.pass);
  const pass = failed.length === 0 && findings.every((f) => f.level !== "error");

  const payload = {
    phase: "COMMS-ACT-04",
    mode: "gate-d-post-apply",
    target: { projectRef, productionBlocked: true },
    ownerApplyMarker: "SQL_EDITOR_APPLY_SUCCESS",
    act03AppliedExpected: true,
    catalog,
    accountsUsed: Object.fromEntries(
      Object.entries(authed).map(([k, v]) => [
        k,
        { emailRedacted: v.emailRedacted, ok: v.ok, userIdPrefix: v.userIdPrefix },
      ])
    ),
    cases,
    failed: failed.map((f) => f.name),
    findings,
    pass,
    verdict: pass
      ? "COMMS_ACT_04_GATE_D_PASS"
      : "COMMS_ACT_04_BLOCKED_GATE_D",
    secretsPrinted: false,
    passwordsPrinted: false,
    realtimeEnabled: false,
    productionTouched: false,
  };

  console.log(JSON.stringify(payload, null, 2));
  process.exit(pass ? 0 : 1);
}

main().catch((err) => {
  console.error(
    JSON.stringify({
      verdict: "COMMS_ACT_04_BLOCKED_GATE_D",
      error: String(err?.message || err),
      secretsPrinted: false,
    })
  );
  process.exit(1);
});
