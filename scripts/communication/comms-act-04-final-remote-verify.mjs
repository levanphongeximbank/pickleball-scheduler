#!/usr/bin/env node
/**
 * COMMS-ACT-04 — Final remote read-only verification (post-certification).
 * No SQL apply, no fixtures, no Production, no realtime mutation.
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
const CONV_IDS = [
  `${MARKER}CLUB_A`,
  `${MARKER}CLUB_B`,
  `${MARKER}DIRECT`,
  `${MARKER}SYSTEM`,
  `${MARKER}COMMUNITY`,
];

function extractProjectRef(url) {
  const m = String(url || "").match(/https?:\/\/([a-z0-9]+)\.supabase\.co/i);
  return m ? m[1] : null;
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
    throw new Error(body?.message || body?.error || JSON.stringify(body));
  }
  return Array.isArray(body) ? body : [];
}

async function rest(url, key, path) {
  const isRpc = path.startsWith("rpc/");
  const res = await fetch(`${url.replace(/\/$/, "")}/rest/v1/${path}`, {
    method: isRpc ? "POST" : "GET",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      Accept: "application/json",
      "Content-Type": "application/json",
      Prefer: "count=exact",
    },
    body: isRpc
      ? JSON.stringify(
          path.includes("allocate")
            ? { p_conversation_id: "final-verify" }
            : {
                p_conversation_id: "final-verify",
                p_participant_id: "final-verify",
                p_last_read_at: new Date().toISOString(),
                p_last_read_message_id: null,
                p_last_read_position: 1,
              }
        )
      : undefined,
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  const code = json && typeof json === "object" ? json.code || null : null;
  const cr = res.headers.get("content-range") || "";
  const totalMatch = cr.match(/\/(\d+|\*)/);
  const total =
    totalMatch && totalMatch[1] !== "*"
      ? Number(totalMatch[1])
      : Array.isArray(json)
        ? json.length
        : null;
  let classification = "UNKNOWN";
  if (res.status === 401 || res.status === 403 || code === "42501") {
    classification = "DENIED";
  } else if (res.ok) classification = "OPEN";
  return { http: res.status, code, classification, total, json, ok: res.ok };
}

function check(name, pass, detail) {
  return { name, pass: Boolean(pass), detail };
}

async function main() {
  loadProjectEnv();
  const url = process.env.STAGING_SUPABASE_URL || "";
  const anonKey = process.env.STAGING_SUPABASE_ANON_KEY || "";
  const serviceKey = process.env.STAGING_SUPABASE_SERVICE_ROLE_KEY || "";
  const token = process.env.SUPABASE_ACCESS_TOKEN || "";
  const projectRef = extractProjectRef(url);

  if (projectRef === COMMS_PRODUCTION_PROJECT_REF) {
    console.error(JSON.stringify({ verdict: "PRODUCTION_BLOCKED" }));
    process.exit(1);
  }
  if (projectRef !== COMMS_STAGING_PROJECT_REF) {
    console.error(JSON.stringify({ verdict: "TARGET_REF_MISMATCH", projectRef }));
    process.exit(1);
  }

  const checks = [];

  const tables = await managementSql(
    token,
    projectRef,
    `select c.relname as table_name, c.relrowsecurity as rls_enabled
     from pg_class c
     join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relname like 'communication_%'
       and c.relkind = 'r'
     order by 1;`
  );
  const expectedTables = [...COMMUNICATION_TABLE_NAME_VALUES];
  checks.push(
    check(
      "tables_14",
      tables.length === expectedTables.length &&
        expectedTables.every((t) => tables.some((r) => r.table_name === t)),
      `count=${tables.length}`
    )
  );
  checks.push(
    check(
      "rls_enabled_14",
      tables.length === 14 && tables.every((r) => r.rls_enabled === true),
      `enabled=${tables.filter((r) => r.rls_enabled).length}`
    )
  );

  const policies = await managementSql(
    token,
    projectRef,
    `select tablename, policyname, cmd
     from pg_policies
     where schemaname='public' and tablename like 'communication_%'
     order by 1,2;`
  );
  const denyAll = policies.filter((p) => String(p.policyname).endsWith("_deny_all"));
  const clubSelect = policies.filter((p) =>
    COMMS_ACT_03_CLUB_SELECT_POLICIES.includes(p.policyname)
  );
  checks.push(check("deny_all_14", denyAll.length === 14, `count=${denyAll.length}`));
  checks.push(
    check(
      "club_select_policies_6",
      clubSelect.length === 6 &&
        COMMS_ACT_03_CLUB_SELECT_POLICIES.every((n) =>
          clubSelect.some((p) => p.policyname === n)
        ),
      `count=${clubSelect.length}`
    )
  );

  const grants = await managementSql(
    token,
    projectRef,
    `select table_name, privilege_type, grantee
     from information_schema.role_table_grants
     where table_schema='public'
       and table_name like 'communication_%'
       and grantee in ('anon','authenticated')
     order by 1,2,3;`
  );
  const selectAuth = grants.filter(
    (g) =>
      g.grantee === "authenticated" &&
      g.privilege_type === "SELECT" &&
      COMMS_ACT_03_SELECT_GRANT_TABLES.includes(g.table_name)
  );
  const writeAuth = grants.filter(
    (g) =>
      g.grantee === "authenticated" &&
      ["INSERT", "UPDATE", "DELETE"].includes(String(g.privilege_type))
  );
  checks.push(
    check("authenticated_select_grants_6", selectAuth.length === 6, `count=${selectAuth.length}`)
  );
  checks.push(
    check("authenticated_write_grants_0", writeAuth.length === 0, `count=${writeAuth.length}`)
  );

  // Direct/System/Community: no client SELECT policies for those types
  const nonClubSelectPolicies = policies.filter(
    (p) =>
      /direct|system|community/i.test(p.policyname) &&
      !String(p.policyname).endsWith("_deny_all") &&
      String(p.cmd).toUpperCase() === "SELECT"
  );
  checks.push(
    check(
      "no_direct_system_community_client_select_policies",
      nonClubSelectPolicies.length === 0,
      `count=${nonClubSelectPolicies.length}`
    )
  );

  const helpers = await managementSql(
    token,
    projectRef,
    `select p.proname
     from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
     where n.nspname='public'
       and (p.proname like 'communication_auth_%' or p.proname='phase42_active_club_member_id')
     order by 1;`
  );
  const helperNames = helpers.map((h) => h.proname);
  checks.push(
    check(
      "act03_helpers_present",
      COMMS_ACT_03_EXPECTED_HELPERS.every((h) => helperNames.includes(h)),
      `helpers=${helperNames.length}`
    )
  );

  const realtime = await managementSql(
    token,
    projectRef,
    `select tablename from pg_publication_tables
     where pubname='supabase_realtime' and schemaname='public'
       and tablename like 'communication_%';`
  );
  checks.push(
    check("realtime_communication_0", realtime.length === 0, `count=${realtime.length}`)
  );

  const fixtureCount = await managementSql(
    token,
    projectRef,
    `select count(*)::int as n from public.communication_conversations
     where conversation_id like '${MARKER}%';`
  );
  const fixtureN = Number(fixtureCount[0]?.n || 0);
  checks.push(check("fixture_marker_conversations_0", fixtureN === 0, `count=${fixtureN}`));

  // Service-role fixture ID probe (exact IDs)
  const svc = await rest(
    url,
    serviceKey,
    `communication_conversations?select=conversation_id&conversation_id=in.(${CONV_IDS.join(",")})`
  );
  checks.push(
    check(
      "fixture_exact_ids_0",
      (svc.total ?? (Array.isArray(svc.json) ? svc.json.length : -1)) === 0,
      `total=${svc.total}`
    )
  );

  let anonDenied = 0;
  let anonOpen = 0;
  for (const table of expectedTables) {
    const r = await rest(url, anonKey, `${table}?select=*&limit=0`);
    if (r.classification === "DENIED") anonDenied += 1;
    if (r.classification === "OPEN") anonOpen += 1;
  }
  checks.push(
    check(
      "anon_tables_denied_14",
      anonDenied === 14 && anonOpen === 0,
      `denied=${anonDenied} open=${anonOpen}`
    )
  );

  for (const rpc of Object.values(COMMUNICATION_RPC)) {
    const r = await rest(url, anonKey, `rpc/${rpc}`);
    checks.push(
      check(
        `anon_rpc_denied_${rpc}`,
        r.classification === "DENIED",
        `http=${r.http} code=${r.code}`
      )
    );
  }

  const failed = checks.filter((c) => !c.pass);
  const payload = {
    phase: "COMMS-ACT-04",
    mode: "final-remote-readonly",
    target: { projectRef, productionBlocked: true },
    mutationCount: 0,
    sqlApplyExecuted: false,
    rollbackExecuted: false,
    fixturesCreated: false,
    realtimeChanged: false,
    checks,
    failed: failed.map((f) => f.name),
    pass: failed.length === 0,
    verdict:
      failed.length === 0
        ? "COMMS_ACT_04_FINAL_REMOTE_VERIFY_PASS"
        : "COMMS_ACT_04_BLOCKED_FINAL_VERIFICATION",
    capabilityState: {
      CLUB_SELECT_ONLY: "ACTIVE_ON_STAGING",
      DIRECT_SYSTEM: "TRUSTED_BACKEND_ONLY",
      CLUB_WRITES_ADMIN: "TRUSTED_BACKEND_ONLY",
      COMMUNITY: "BLOCKED_FAIL_CLOSED",
      REALTIME: "BLOCKED_FAIL_CLOSED",
      PRODUCTION: "UNTOUCHED",
    },
    secretsPrinted: false,
  };

  console.log(JSON.stringify(payload, null, 2));
  process.exit(payload.pass ? 0 : 1);
}

main().catch((err) => {
  console.error(
    JSON.stringify({
      verdict: "COMMS_ACT_04_BLOCKED_FINAL_VERIFICATION",
      error: String(err?.message || err),
      secretsPrinted: false,
    })
  );
  process.exit(1);
});
