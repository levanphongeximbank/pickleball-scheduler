#!/usr/bin/env node
/**
 * COMMS-ACT-04 — Staging Club SELECT preflight (read-only).
 *
 * Modes:
 *   --offline          static ACT-03 SQL + local gates
 *   --live-catalog     read-only PostgREST probes + optional backup schema inventory
 *   --backup-schema=PATH  parse schema.sql dump for policy/RLS/realtime inventory
 *
 * Does NOT apply SQL.
 * Does NOT enable realtime.
 * Does NOT target Production.
 * Refuses --apply.
 */

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

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
  verifyCommsAct03SqlPackage,
} from "../../src/features/communication/activation/index.js";

const MODULE_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../.."
);

const DENY_ALL_POLICY_SUFFIX = "_deny_all";
const EXPECTED_TABLES = [...COMMUNICATION_TABLE_NAME_VALUES];
const EXPECTED_RPCS = Object.values(COMMUNICATION_RPC);

function parseArgs(argv) {
  const args = {
    mode: "offline",
    json: false,
    applyRequested: false,
    backupSchemaPath: null,
    help: false,
  };
  for (const raw of argv) {
    if (raw === "--offline") args.mode = "offline";
    else if (raw === "--live-catalog" || raw === "--live") args.mode = "live-catalog";
    else if (raw.startsWith("--backup-schema=")) {
      args.backupSchemaPath = raw.slice("--backup-schema=".length);
    } else if (raw === "--apply" || raw === "--apply-staging") {
      args.applyRequested = true;
    } else if (raw === "--json") args.json = true;
    else if (raw === "--help" || raw === "-h") args.help = true;
  }
  return args;
}

function extractProjectRef(url) {
  if (!url) return null;
  const m = String(url).match(/https?:\/\/([a-z0-9]+)\.supabase\.co/i);
  return m ? m[1] : null;
}

function resolveStagingCredentials(env) {
  const url =
    env.STAGING_SUPABASE_URL ||
    env.VITE_SUPABASE_URL ||
    env.SUPABASE_URL ||
    "";
  const anonKey =
    env.STAGING_SUPABASE_ANON_KEY ||
    env.VITE_SUPABASE_ANON_KEY ||
    env.SUPABASE_ANON_KEY ||
    "";
  const serviceKey =
    env.STAGING_SUPABASE_SERVICE_ROLE_KEY ||
    env.SUPABASE_SERVICE_ROLE_KEY ||
    "";
  const projectRef = extractProjectRef(url);
  return { url, anonKey, serviceKey, projectRef };
}

function assertStagingOnly(projectRef) {
  if (!projectRef) {
    return { ok: false, code: "TARGET_URL_MISSING" };
  }
  if (projectRef === COMMS_PRODUCTION_PROJECT_REF) {
    return { ok: false, code: "PRODUCTION_BLOCKED" };
  }
  if (projectRef !== COMMS_STAGING_PROJECT_REF) {
    return { ok: false, code: "TARGET_REF_MISMATCH" };
  }
  return { ok: true, code: "STAGING_OK" };
}

/**
 * Parse a Supabase CLI schema dump for Communication catalog posture.
 * Read-only filesystem analysis of a fresh Staging logical dump.
 */
function inventoryFromSchemaDump(schemaSql) {
  const tablesFound = EXPECTED_TABLES.filter((t) =>
    new RegExp(`CREATE TABLE IF NOT EXISTS "public"\\."${t}"`, "i").test(
      schemaSql
    ) || new RegExp(`CREATE TABLE "public"\\."${t}"`, "i").test(schemaSql)
  );

  const rlsEnabled = EXPECTED_TABLES.filter((t) =>
    new RegExp(
      `ALTER TABLE "public"\\."${t}" ENABLE ROW LEVEL SECURITY`,
      "i"
    ).test(schemaSql)
  );

  const denyAllPolicies = [];
  const clubSelectPolicies = [];
  const policyNames = [];
  const policyRe =
    /CREATE POLICY "([^"]+)" ON "public"\."(communication_[^"]+)"/gi;
  let m;
  while ((m = policyRe.exec(schemaSql)) !== null) {
    const name = m[1];
    const table = m[2];
    policyNames.push({ name, table });
    if (name.endsWith(DENY_ALL_POLICY_SUFFIX) || /deny_all/i.test(name)) {
      denyAllPolicies.push(name);
    }
    if (COMMS_ACT_03_CLUB_SELECT_POLICIES.includes(name)) {
      clubSelectPolicies.push(name);
    }
  }

  const helpersPresent = COMMS_ACT_03_EXPECTED_HELPERS.filter((name) =>
    new RegExp(
      `CREATE (OR REPLACE )?FUNCTION "public"\\."${name}"`,
      "i"
    ).test(schemaSql)
  );

  const clubHelperPresent = /phase42_active_club_member_id/i.test(schemaSql);

  const selectGrants = [];
  for (const table of COMMS_ACT_03_SELECT_GRANT_TABLES) {
    const re = new RegExp(
      `GRANT SELECT ON TABLE "public"\\."${table}" TO "authenticated"`,
      "i"
    );
    if (re.test(schemaSql)) selectGrants.push(table);
  }

  const writeGrantHits = [];
  const writeRe =
    /GRANT (INSERT|UPDATE|DELETE|ALL)[^;]*ON TABLE "public"\."(communication_[^"]+)" TO "(anon|authenticated)"/gi;
  while ((m = writeRe.exec(schemaSql)) !== null) {
    writeGrantHits.push({ privilege: m[1], table: m[2], role: m[3] });
  }

  const rpcExecuteGrants = [];
  for (const rpc of EXPECTED_RPCS) {
    const re = new RegExp(
      `GRANT EXECUTE ON FUNCTION "public"\\."${rpc}"[^;]*TO "(anon|authenticated)"`,
      "i"
    );
    if (re.test(schemaSql)) rpcExecuteGrants.push(rpc);
  }

  // Publication rows for communication_* only (other app tables may already be published).
  const realtimeCommRe =
    /ALTER PUBLICATION\s+"supabase_realtime"\s+ADD TABLE(?: ONLY)?\s+"public"\."(communication_[^"]+)"/gi;
  const realtimeCommunicationTables = [];
  while ((m = realtimeCommRe.exec(schemaSql)) !== null) {
    realtimeCommunicationTables.push(m[1]);
  }

  return {
    source: "backup_schema_dump",
    tablesFound: tablesFound.length,
    tablesExpected: EXPECTED_TABLES.length,
    rlsEnabled: rlsEnabled.length,
    denyAllPolicies: denyAllPolicies.length,
    denyAllPolicyNames: denyAllPolicies.sort(),
    clubSelectPoliciesPresent: clubSelectPolicies.sort(),
    clubSelectPolicyCount: clubSelectPolicies.length,
    allPolicyNames: policyNames,
    act03HelpersPresent: helpersPresent.sort(),
    act03HelperCount: helpersPresent.length,
    phase42ClubHelperPresent: clubHelperPresent,
    authenticatedSelectGrants: selectGrants.sort(),
    authenticatedSelectGrantCount: selectGrants.length,
    writeGrantHits,
    rpcExecuteGrantsToClients: rpcExecuteGrants,
    realtimeCommunicationTables,
    realtimeCommunicationRowCount: realtimeCommunicationTables.length,
  };
}

async function probeRestTable(url, key, tableName, roleLabel) {
  const endpoint = `${url.replace(/\/$/, "")}/rest/v1/${tableName}?select=*&limit=0`;
  const res = await fetch(endpoint, {
    method: "GET",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      Accept: "application/json",
      Prefer: "count=exact",
    },
  });
  const text = await res.text();
  let code = null;
  try {
    const j = JSON.parse(text);
    code = j.code || j.error || null;
    if (Array.isArray(j) && res.ok) code = null;
  } catch {
    /* ignore */
  }
  let classification = "UNKNOWN";
  if (res.status === 404 || code === "PGRST205") classification = "ABSENT";
  else if (res.status === 401 || res.status === 403 || code === "42501") {
    classification = "PRESENT_DENIED";
  } else if (res.ok) classification = "PRESENT_OPEN";
  else classification = `HTTP_${res.status}`;
  return {
    role: roleLabel,
    table: tableName,
    http: res.status,
    code,
    classification,
  };
}

async function probeRpc(url, key, rpcName, roleLabel) {
  const endpoint = `${url.replace(/\/$/, "")}/rest/v1/rpc/${rpcName}`;
  const body =
    rpcName === "communication_allocate_message_position"
      ? { p_conversation_id: "preflight-deny" }
      : {
          p_conversation_id: "preflight-deny",
          p_participant_id: "preflight-deny",
          p_last_read_at: new Date().toISOString(),
          p_last_read_message_id: null,
          p_last_read_position: 0,
        };
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let code = null;
  try {
    const j = JSON.parse(text);
    code = j.code || null;
  } catch {
    /* ignore */
  }
  let classification = "UNKNOWN";
  if (res.status === 404 || code === "PGRST202" || code === "PGRST205") {
    classification = "ABSENT";
  } else if (res.status === 401 || res.status === 403 || code === "42501") {
    classification = "PRESENT_DENIED";
  } else if (res.ok) classification = "PRESENT_OPEN";
  else classification = `HTTP_${res.status}`;
  return {
    role: roleLabel,
    rpc: rpcName,
    http: res.status,
    code,
    classification,
  };
}

async function runLiveCatalog(env, backupSchemaPath) {
  const creds = resolveStagingCredentials(env);
  const target = assertStagingOnly(creds.projectRef);
  /** @type {Array<{level:string,code:string,message:string}>} */
  const findings = [];

  if (!target.ok) {
    findings.push({
      level: "error",
      code: target.code,
      message: `Target gate failed: ${target.code}`,
    });
  }
  if (!creds.anonKey) {
    findings.push({
      level: "error",
      code: "ANON_KEY_MISSING",
      message: "Staging anon key missing from env.",
    });
  }

  let schemaInventory = null;
  if (backupSchemaPath) {
    if (!existsSync(backupSchemaPath)) {
      findings.push({
        level: "error",
        code: "BACKUP_SCHEMA_MISSING",
        message: `Missing schema dump: ${backupSchemaPath}`,
      });
    } else {
      const sql = readFileSync(backupSchemaPath, "utf8");
      if (/expuvcohlcjzvrrauvud/i.test(sql)) {
        findings.push({
          level: "error",
          code: "PRODUCTION_REF_IN_SCHEMA_DUMP",
          message: "Schema dump unexpectedly references Production ref.",
        });
      }
      schemaInventory = inventoryFromSchemaDump(sql);
      if (schemaInventory.tablesFound !== EXPECTED_TABLES.length) {
        findings.push({
          level: "error",
          code: "TABLE_COUNT_MISMATCH",
          message: `Expected ${EXPECTED_TABLES.length} tables in dump, found ${schemaInventory.tablesFound}`,
        });
      }
      if (schemaInventory.rlsEnabled !== EXPECTED_TABLES.length) {
        findings.push({
          level: "error",
          code: "RLS_NOT_FULLY_ENABLED",
          message: `RLS enabled ${schemaInventory.rlsEnabled}/${EXPECTED_TABLES.length}`,
        });
      }
      if (schemaInventory.denyAllPolicies !== EXPECTED_TABLES.length) {
        findings.push({
          level: "error",
          code: "DENY_ALL_POLICY_COUNT",
          message: `Deny-all policies ${schemaInventory.denyAllPolicies}/${EXPECTED_TABLES.length}`,
        });
      }
      if (schemaInventory.clubSelectPolicyCount !== 0) {
        findings.push({
          level: "error",
          code: "CLUB_SELECT_ALREADY_PRESENT",
          message: "Club SELECT policies already present before ACT-04 apply.",
        });
      }
      if (schemaInventory.act03HelperCount !== 0) {
        findings.push({
          level: "error",
          code: "ACT03_HELPERS_ALREADY_PRESENT",
          message: "ACT-03 auth helpers already present before apply.",
        });
      }
      if (schemaInventory.authenticatedSelectGrantCount !== 0) {
        findings.push({
          level: "error",
          code: "SELECT_GRANTS_ALREADY_OPEN",
          message: "Authenticated SELECT grants already open before apply.",
        });
      }
      if (schemaInventory.writeGrantHits.length > 0) {
        findings.push({
          level: "error",
          code: "UNEXPECTED_WRITE_GRANTS",
          message: "Unexpected client write grants on communication_* tables.",
        });
      }
      if (schemaInventory.rpcExecuteGrantsToClients.length > 0) {
        findings.push({
          level: "error",
          code: "RPC_CLIENT_EXECUTE_OPEN",
          message: "RPC execute granted to anon/authenticated.",
        });
      }
      if (!schemaInventory.phase42ClubHelperPresent) {
        findings.push({
          level: "error",
          code: "PHASE42_HELPER_MISSING",
          message: "phase42_active_club_member_id missing — Club SELECT apply would fail.",
        });
      }
      if (schemaInventory.realtimeCommunicationRowCount !== 0) {
        findings.push({
          level: "error",
          code: "REALTIME_COMMUNICATION_ENABLED",
          message: "communication_* tables already in supabase_realtime publication.",
        });
      }
    }
  } else {
    findings.push({
      level: "error",
      code: "BACKUP_SCHEMA_REQUIRED",
      message: "Pass --backup-schema=<path-to-schema.sql> for catalog inventory.",
    });
  }

  const tableProbes = [];
  const rpcProbes = [];
  if (target.ok && creds.anonKey) {
    for (const table of EXPECTED_TABLES) {
      tableProbes.push(
        await probeRestTable(creds.url, creds.anonKey, table, "anon")
      );
    }
    for (const rpc of EXPECTED_RPCS) {
      rpcProbes.push(await probeRpc(creds.url, creds.anonKey, rpc, "anon"));
    }
  }

  const presentDenied = tableProbes.filter(
    (p) => p.classification === "PRESENT_DENIED"
  ).length;
  const presentOpen = tableProbes.filter(
    (p) => p.classification === "PRESENT_OPEN"
  ).length;
  const absent = tableProbes.filter((p) => p.classification === "ABSENT").length;

  if (tableProbes.length && presentDenied !== EXPECTED_TABLES.length) {
    findings.push({
      level: "error",
      code: "ANON_TABLE_PROBE_UNEXPECTED",
      message: `Expected 14 PRESENT_DENIED anon probes; got denied=${presentDenied} open=${presentOpen} absent=${absent}`,
    });
  }
  if (presentOpen > 0) {
    findings.push({
      level: "error",
      code: "ANON_OPEN_ACCESS",
      message: "Anon has open access to one or more communication_* tables.",
    });
  }
  for (const p of rpcProbes) {
    if (p.classification === "PRESENT_OPEN") {
      findings.push({
        level: "error",
        code: "ANON_RPC_OPEN",
        message: `Anon can execute ${p.rpc}`,
      });
    } else if (p.classification === "ABSENT") {
      findings.push({
        level: "error",
        code: "RPC_ABSENT",
        message: `RPC missing: ${p.rpc}`,
      });
    } else if (p.classification !== "PRESENT_DENIED") {
      findings.push({
        level: "warn",
        code: "RPC_PROBE_UNEXPECTED",
        message: `RPC ${p.rpc} classification=${p.classification} http=${p.http} code=${p.code}`,
      });
    }
  }

  const errors = findings.filter((f) => f.level === "error");
  return {
    phase: "COMMS-ACT-04",
    mode: "live-catalog",
    target: {
      projectRef: creds.projectRef,
      status: target.code,
      productionBlocked: creds.projectRef !== COMMS_PRODUCTION_PROJECT_REF,
    },
    schemaInventory,
    liveProbes: {
      mutationCount: 0,
      tableProbes,
      rpcProbes,
      presentDenied,
      presentOpen,
      absent,
    },
    findings,
    pass: errors.length === 0,
    verdict:
      errors.length === 0
        ? "COMMS_ACT_04_LIVE_PREFLIGHT_PASS"
        : "COMMS_ACT_04_BLOCKED_LIVE_PREFLIGHT",
    sqlApplyExecuted: false,
    realtimeEnabled: false,
    secretsPrinted: false,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(`COMMS-ACT-04 Staging preflight (read-only, no apply)

  --offline
  --live-catalog --backup-schema=<schema.sql>
`);
    process.exit(0);
  }

  loadProjectEnv();

  if (args.applyRequested) {
    console.error(
      JSON.stringify({
        verdict: "COMMS_ACT_04_BLOCKED_APPLY_REFUSED",
        message: "ACT-04 preflight refuses --apply.",
        secretsPrinted: false,
      })
    );
    process.exit(1);
  }

  if (args.mode === "offline") {
    const sql = verifyCommsAct03SqlPackage({ repoRoot: MODULE_ROOT });
    const payload = {
      phase: "COMMS-ACT-04",
      mode: "offline",
      sqlStatus: sql.status,
      forwardSha256: sql.forwardSha256,
      rollbackSha256: sql.rollbackSha256,
      findings: sql.findings,
      pass: sql.status === "PASS",
      verdict:
        sql.status === "PASS"
          ? "COMMS_ACT_04_SQL_PACKAGE_PASS"
          : "COMMS_ACT_04_BLOCKED_SQL_READINESS",
      secretsPrinted: false,
    };
    console.log(JSON.stringify(payload, null, 2));
    process.exit(payload.pass ? 0 : 1);
  }

  const result = await runLiveCatalog(process.env, args.backupSchemaPath);
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.pass ? 0 : 1);
}

main().catch((err) => {
  console.error(
    JSON.stringify({
      verdict: "COMMS_ACT_04_BLOCKED_LIVE_PREFLIGHT",
      error: String(err?.message || err),
      secretsPrinted: false,
    })
  );
  process.exit(1);
});
