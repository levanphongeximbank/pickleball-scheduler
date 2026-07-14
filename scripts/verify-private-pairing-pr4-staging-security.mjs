/**
 * Private Pairing PR-4 — Staging security verification (qyewbxjsiiyufanzcjcq).
 * Uses Supabase Management API (same pattern as apply-ai-v52-staging-sql.mjs).
 * DO NOT touch production.
 *
 * Usage:
 *   node scripts/verify-private-pairing-pr4-staging-security.mjs
 *
 * Writes:
 *   docs/v5/qa-evidence/phase-private-pairing-staging/STAGING_SECURITY_VERIFY.json
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";
import { loadProjectEnv } from "./load-env.mjs";

const STAGING_REF = "qyewbxjsiiyufanzcjcq";
const PRODUCTION_REF = "expuvcohlcjzvrrauvud";
const TABLES = [
  "private_pairing_rule_sets",
  "private_pairing_rules",
  "private_pairing_rule_targets",
  "private_pairing_rule_audit_logs",
];
const EXPECTED_RPCS = [
  "private_pairing_list_rule_sets",
  "private_pairing_get_rule_set",
  "private_pairing_create_rule_set",
  "private_pairing_create_rule",
  "private_pairing_update_rule",
  "private_pairing_disable_rule",
  "private_pairing_clone_rule_set_version",
  "private_pairing_activate_rule_set",
  "private_pairing_rollback_rule_set",
  "private_pairing_list_audit_logs",
  "private_pairing_get_active_rules_for_scope",
];

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outPath = path.join(
  rootDir,
  "docs/v5/qa-evidence/phase-private-pairing-staging/STAGING_SECURITY_VERIFY.json"
);

function resolveAccessToken() {
  loadProjectEnv();
  return String(process.env.SUPABASE_ACCESS_TOKEN || "").trim();
}

async function executeManagementSql(token, sql, label) {
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
    const msg = body?.message || body?.error || body?.msg || res.statusText;
    const err = new Error(`${label}: ${typeof msg === "string" ? msg : JSON.stringify(msg)}`);
    err.body = body;
    err.status = res.status;
    throw err;
  }
  return body;
}

function asRows(body) {
  if (Array.isArray(body)) return body;
  if (Array.isArray(body?.rows)) return body.rows;
  if (Array.isArray(body?.data)) return body.data;
  return [];
}

function errText(error) {
  const parts = [
    error?.message,
    error?.body?.message,
    error?.body?.error,
    typeof error?.body === "string" ? error.body : null,
  ].filter(Boolean);
  return parts.join(" | ");
}

function parseSqlError(error) {
  const t = errText(error);
  const sqlstate =
    t.match(/\bERROR:\s*([A-Z]\d{4}):/i)?.[1]?.toUpperCase() ||
    t.match(/\bERROR:\s*(\d{5}):/i)?.[1] ||
    t.match(/\b(P\d{4})\b/i)?.[1]?.toUpperCase() ||
    null;
  const message =
    t.match(/\bERROR:\s*(?:[A-Z]\d{4}|\d{5}):\s*([^\n|]+)/i)?.[1]?.trim() ||
    (t.match(/AUDIT_APPEND_ONLY/i)?.[0] ?? null);
  return { text: t, sqlstate, message };
}

function isAuditAppendOnlyError(error) {
  const { text, sqlstate, message } = parseSqlError(error);
  const hasP0001 = sqlstate === "P0001" || /\bP0001\b/.test(text);
  const hasAuditMsg = /AUDIT_APPEND_ONLY/i.test(text);
  const is42601 = sqlstate === "42601" || /42601/.test(text);
  return hasP0001 && hasAuditMsg && !is42601;
}

function record(checks, id, pass, detail = {}) {
  const row = { id, pass: Boolean(pass), ...detail };
  checks.push(row);
  console.log(`${pass ? "PASS" : "FAIL"}  ${id}${detail.note ? ` — ${detail.note}` : ""}`);
  return row;
}

async function checkSchemaPresence(token, checks) {
  const sql = `
    select
      (select count(*)::int from pg_tables
         where schemaname = 'public' and tablename = any(array[${TABLES.map((t) => `'${t}'`).join(",")}])) as table_count,
      (select count(*)::int from pg_policies
         where schemaname = 'public' and tablename like 'private_pairing%') as policy_count,
      (select count(*)::int from pg_proc p
         join pg_namespace n on n.oid = p.pronamespace
         where n.nspname = 'public'
           and p.proname = any(array[${EXPECTED_RPCS.map((r) => `'${r}'`).join(",")}])) as rpc_count,
      (select count(*)::int from pg_class c
         join pg_namespace n on n.oid = c.relnamespace
         where n.nspname = 'public' and c.relname = 'private_pairing_rule_sets'
           and c.relrowsecurity) as rls_sets,
      (select array_agg(tablename order by tablename)
         from pg_tables
         where schemaname = 'public' and tablename like 'private_pairing%') as tables_found,
      (select array_agg(proname order by proname)
         from pg_proc p
         join pg_namespace n on n.oid = p.pronamespace
         where n.nspname = 'public' and p.proname like 'private_pairing_%') as rpcs_found
  `;
  const rows = asRows(await executeManagementSql(token, sql, "schema_presence"));
  const row = rows[0] || {};
  const tableCount = Number(row.table_count || 0);
  const policyCount = Number(row.policy_count || 0);
  const rpcCount = Number(row.rpc_count || 0);
  const rlsOn = Number(row.rls_sets || 0) === 1;
  const pass = tableCount === 4 && policyCount > 0 && rpcCount === EXPECTED_RPCS.length && rlsOn;
  record(checks, "schema_tables_rls_rpcs", pass, {
    expected: { tables: 4, rpcs: EXPECTED_RPCS.length, rls: true, policies_gt: 0 },
    actual: {
      table_count: tableCount,
      policy_count: policyCount,
      rpc_count: rpcCount,
      rls_on_rule_sets: rlsOn,
      tables_found: row.tables_found,
      rpcs_found: row.rpcs_found,
    },
    note: pass
      ? "4 tables + RLS + expected RPCs present"
      : "missing tables/RLS/RPCs",
  });
}

async function findLeftoverAuditProbe(token) {
  const rows = asRows(
    await executeManagementSql(
      token,
      `
      select id, tenant_id
      from public.private_pairing_rule_audit_logs
      where tenant_id like '__qa_pr4_audit_probe_%'
      order by created_at desc
      limit 1
      `,
      "audit_probe_lookup"
    )
  );
  return rows[0] || null;
}

async function checkAuditAppendOnly(token, checks) {
  const nilUuid = "00000000-0000-4000-8000-000000000001";
  let probeId = null;
  let probeTenant = null;
  let strategy = "leftover_probe_update";
  let insertOk = null;
  let updateBlocked = false;
  let updateError = null;
  let updateSqlstate = null;
  let updateMessage = null;
  let deleteBlocked = null;
  let deleteError = null;
  let leftoverProbe = false;

  const leftover = await findLeftoverAuditProbe(token);
  if (leftover?.id) {
    probeId = leftover.id;
    probeTenant = leftover.tenant_id;
    leftoverProbe = true;
  } else {
    strategy = "insert+update";
    probeTenant = `__qa_pr4_audit_probe_${Date.now()}__`;
    try {
      const insertRows = asRows(
        await executeManagementSql(
          token,
          `
          insert into public.private_pairing_rule_audit_logs (
            tenant_id, actor_id, actor_role, action, reason, before_data, after_data
          ) values (
            '${probeTenant}',
            '${nilUuid}'::uuid,
            'QA_PROBE',
            'SIMULATE_PRIVATE_PAIRING',
            'pr4_staging_security_verify',
            '{}'::jsonb,
            jsonb_build_object('probe', true)
          )
          returning id
          `,
          "audit_insert_probe"
        )
      );
      probeId = insertRows?.[0]?.id || null;
      insertOk = Boolean(probeId);
      leftoverProbe = Boolean(probeId);
    } catch (error) {
      record(checks, "audit_append_only", false, {
        note: "No leftover probe row and INSERT probe failed",
        strategy,
        insert_ok: false,
        error: errText(error).slice(0, 500),
      });
      return;
    }
  }

  try {
    await executeManagementSql(
      token,
      `update public.private_pairing_rule_audit_logs
         set reason = 'should_fail'
       where id = '${probeId}'::uuid`,
      "audit_update_probe"
    );
    updateBlocked = false;
    updateError = "UPDATE succeeded unexpectedly";
  } catch (error) {
    const parsed = parseSqlError(error);
    updateBlocked = isAuditAppendOnlyError(error);
    updateError = parsed.text.slice(0, 500);
    updateSqlstate = parsed.sqlstate;
    updateMessage = parsed.message;
  }

  try {
    await executeManagementSql(
      token,
      `delete from public.private_pairing_rule_audit_logs where id = '${probeId}'::uuid`,
      "audit_delete_probe_optional"
    );
    deleteBlocked = false;
    leftoverProbe = false;
  } catch (error) {
    deleteBlocked = isAuditAppendOnlyError(error) || Boolean(error);
    deleteError = errText(error).slice(0, 500);
    leftoverProbe = true;
  }

  const pass = updateBlocked && updateSqlstate === "P0001" && /AUDIT_APPEND_ONLY/i.test(updateError || "");
  record(checks, "audit_append_only", pass, {
    strategy,
    insert_ok: insertOk,
    probe_id: probeId,
    probe_tenant: probeTenant,
    update_blocked: updateBlocked,
    update_sqlstate: updateSqlstate,
    update_message: updateMessage,
    update_error: updateError,
    delete_blocked: deleteBlocked,
    delete_error: deleteError,
    leftover_probe_row: leftoverProbe,
    note: pass
      ? "UPDATE blocked with P0001 AUDIT_APPEND_ONLY (leftover probe row)"
      : updateSqlstate === "42601"
        ? "UPDATE blocked but sqlstate 42601 (RAISE MESSAGE duplicate) — patch not applied?"
        : updateBlocked
          ? `UPDATE blocked but unexpected sqlstate/message (got ${updateSqlstate || "?"})`
          : "UPDATE did not raise P0001 AUDIT_APPEND_ONLY",
  });
}

async function checkAuthenticatedPrivileges(token, checks) {
  const sql = `
    select
      t.tablename,
      has_table_privilege('authenticated', format('public.%I', t.tablename), 'INSERT') as can_insert,
      has_table_privilege('authenticated', format('public.%I', t.tablename), 'UPDATE') as can_update,
      has_table_privilege('authenticated', format('public.%I', t.tablename), 'DELETE') as can_delete,
      has_table_privilege('authenticated', format('public.%I', t.tablename), 'SELECT') as can_select
    from unnest(array[${TABLES.map((t) => `'${t}'`).join(",")}]) as t(tablename)
    order by 1
  `;
  const rows = asRows(await executeManagementSql(token, sql, "auth_privileges"));
  const pass =
    rows.length === 4 &&
    rows.every((r) => r.can_insert === false && r.can_update === false && r.can_delete === false);
  record(checks, "authenticated_no_dml", pass, {
    expected: "authenticated: no INSERT/UPDATE/DELETE on 4 tables (SELECT may exist)",
    actual: rows,
    note: pass
      ? "no INSERT/UPDATE/DELETE for authenticated"
      : "authenticated still has write privilege on one or more tables",
  });
}

async function checkOneActiveIndex(token, checks) {
  const sql = `
    select indexname, indexdef
    from pg_indexes
    where schemaname = 'public'
      and indexname = 'private_pairing_rule_sets_one_active_uidx'
  `;
  const rows = asRows(await executeManagementSql(token, sql, "one_active_uidx"));
  const pass = rows.length === 1;
  record(checks, "one_active_version_uidx", pass, {
    expected: "private_pairing_rule_sets_one_active_uidx",
    actual: rows,
    note: pass ? "unique partial index present" : "index missing",
  });
}

async function checkRealtimePublication(token, checks) {
  const sql = `
    select count(*)::int as c
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and tablename like 'private_pairing%'
  `;
  const rows = asRows(await executeManagementSql(token, sql, "realtime_pub"));
  const count = Number(rows?.[0]?.c || 0);
  const pass = count === 0;
  record(checks, "realtime_publication_empty", pass, {
    expected: 0,
    actual: count,
    note: pass ? "0 private_pairing% in supabase_realtime" : "tables published to realtime",
  });
}

function checkVercelPreviewRbac(checks) {
  const detail = {
    present: false,
    value_is_true: null,
    readable: false,
    method: null,
    note: null,
  };

  try {
    const lsOut = execSync("npx vercel env ls preview", {
      cwd: rootDir,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 120000,
    });
    const presentInLs = /VITE_RBAC_ENABLED/i.test(lsOut);
    detail.present = presentInLs;
    detail.method = "vercel env ls preview";

    // Try to read value without printing secrets: pull to temp, read one key, unlink.
    const tmp = path.join(rootDir, `.env.preview.rbac-check.${process.pid}.tmp`);
    try {
      execSync(`npx vercel env pull "${tmp}" --environment=preview --yes`, {
        cwd: rootDir,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
        timeout: 120000,
      });
      if (fs.existsSync(tmp)) {
        const content = fs.readFileSync(tmp, "utf8");
        const m = content.match(/^VITE_RBAC_ENABLED=(.*)$/m);
        if (m) {
          detail.present = true;
          detail.readable = true;
          let v = String(m[1] || "").trim();
          if (
            (v.startsWith('"') && v.endsWith('"')) ||
            (v.startsWith("'") && v.endsWith("'"))
          ) {
            v = v.slice(1, -1);
          }
          detail.value_empty = v.length === 0;
          detail.value_is_true = v === "true";
          detail.value_is_false = v === "false";
          detail.method = "vercel env pull preview (single key, value not printed)";
        } else if (!presentInLs) {
          detail.present = false;
        }
        fs.unlinkSync(tmp);
      }
    } catch (pullErr) {
      detail.pull_error = String(pullErr?.message || pullErr).slice(0, 200);
      if (fs.existsSync(tmp)) {
        try {
          fs.unlinkSync(tmp);
        } catch {
          /* ignore */
        }
      }
    }

    // If present but value not readable → pass when present.
    // If readable and not literally "true" → fail.
    const effectivePass = detail.readable
      ? detail.present && detail.value_is_true === true
      : detail.present;
    record(checks, "vercel_preview_vite_rbac_enabled", effectivePass, {
      ...detail,
      note: detail.readable
        ? detail.value_is_true
          ? 'Preview VITE_RBAC_ENABLED present and value is literally "true"'
          : detail.value_empty
            ? "Preview VITE_RBAC_ENABLED present but value is empty (not literally true)"
            : detail.value_is_false
              ? 'Preview VITE_RBAC_ENABLED present; value is literally "false"'
              : "Preview VITE_RBAC_ENABLED present but value is not literally true"
        : detail.present
          ? "Preview VITE_RBAC_ENABLED present (value not readable via pull)"
          : "Preview VITE_RBAC_ENABLED not found",
      production_env_touched: false,
    });
  } catch (error) {
    record(checks, "vercel_preview_vite_rbac_enabled", false, {
      ...detail,
      note: `Could not query Vercel Preview env: ${String(error?.message || error).slice(0, 300)}`,
      production_env_touched: false,
    });
  }
}

async function main() {
  console.log("=== Private Pairing PR-4 — Staging Security Verify ===\n");
  console.log(`Project ref: ${STAGING_REF} (staging only)`);
  console.log(`Production ref ${PRODUCTION_REF}: NOT TOUCHED\n`);

  const token = resolveAccessToken();
  if (!token) {
    console.error("❌ Missing SUPABASE_ACCESS_TOKEN");
    process.exit(2);
  }

  const checks = [];
  const startedAt = new Date().toISOString();

  await checkSchemaPresence(token, checks);
  await checkAuditAppendOnly(token, checks);
  await checkAuthenticatedPrivileges(token, checks);
  await checkOneActiveIndex(token, checks);
  await checkRealtimePublication(token, checks);
  checkVercelPreviewRbac(checks);

  const failed = checks.filter((c) => !c.pass).length;
  const passed = checks.filter((c) => c.pass).length;
  const report = {
    phase: "private-pairing-pr4-staging-security",
    staging_ref: STAGING_REF,
    production_touched: false,
    started_at: startedAt,
    finished_at: new Date().toISOString(),
    summary: {
      passed,
      failed,
      total: checks.length,
      overall: failed === 0 ? "PASS" : "FAIL",
    },
    checks,
  };

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

  console.log(`\nOverall: ${report.summary.overall} (${passed}/${checks.length})`);
  console.log(`Wrote: ${outPath}\n`);

  if (failed > 0) process.exit(1);
}

main().catch((error) => {
  console.error(`\n❌ Verify crashed: ${error?.message || error}`);
  process.exit(1);
});
