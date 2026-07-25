/**
 * COMMS-ACT-06 — Production catalog read-only (Owner-operated).
 *
 * Allowlist: expuvcohlcjzvrrauvud
 * Blocklist: qyewbxjsiiyufanzcjcq
 * Never INSERT/UPDATE/DELETE/APPLY.
 *
 * Requires SUPABASE_ACCESS_TOKEN (Owner). Prints aggregates only — no auth PII rows.
 */
import {
  COMMS_PRODUCTION_PROJECT_REF,
  COMMS_STAGING_PROJECT_REF,
} from "../../src/features/communication/activation/stagingTarget.js";
import { COMMUNICATION_TABLE_NAME_VALUES } from "../../src/features/communication/persistence/schema.js";

const PRODUCTION_REF = COMMS_PRODUCTION_PROJECT_REF;
const STAGING_REF = COMMS_STAGING_PROJECT_REF;

function assertSafeSql(sql) {
  const normalized = String(sql || "").replace(/\s+/g, " ").trim();
  if (!/^(select|with)\b/i.test(normalized)) {
    throw new Error("Only SELECT/WITH queries allowed.");
  }
  if (/\b(insert|update|delete|alter|drop|create|truncate|grant|revoke|call|do)\b/i.test(normalized)) {
    throw new Error("Mutating SQL refused.");
  }
  return normalized;
}

async function runQuery(accessToken, sql) {
  const safe = assertSafeSql(sql);
  const res = await fetch(
    `https://api.supabase.com/v1/projects/${PRODUCTION_REF}/database/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: safe }),
    }
  );
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Catalog query failed HTTP ${res.status}`);
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new Error("Catalog response was not JSON.");
  }
}

async function main() {
  const accessToken = String(process.env.SUPABASE_ACCESS_TOKEN || "").trim();
  if (!accessToken) {
    console.log(
      JSON.stringify(
        {
          ok: false,
          verdict: "OWNER_ACTION_REQUIRED",
          code: "SUPABASE_ACCESS_TOKEN_MISSING",
          productionRef: PRODUCTION_REF,
          stagingRefBlocked: STAGING_REF,
          mutationCount: 0,
          message:
            "Set SUPABASE_ACCESS_TOKEN in the Owner shell (do not commit). Re-run this script.",
        },
        null,
        2
      )
    );
    process.exitCode = 2;
    return;
  }

  if (accessToken.includes(STAGING_REF)) {
    throw new Error("Refuse: access token environment appears to reference Staging ref.");
  }

  const tableList = COMMUNICATION_TABLE_NAME_VALUES.map((t) => `'${t}'`).join(",");
  const tables = await runQuery(
    accessToken,
    `select c.relname as table_name, c.relrowsecurity as rls_enabled
     from pg_class c
     join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public'
       and c.relkind = 'r'
       and c.relname in (${tableList})
     order by c.relname`
  );

  const present = Array.isArray(tables) ? tables : tables?.data || [];
  const presentNames = new Set(present.map((r) => r.table_name || r.relname));
  const missing = COMMUNICATION_TABLE_NAME_VALUES.filter((t) => !presentNames.has(t));

  const realtime = await runQuery(
    accessToken,
    `select count(*)::int as realtime_count
     from pg_publication_tables
     where pubname = 'supabase_realtime'
       and schemaname = 'public'
       and tablename like 'communication_%'`
  );
  const realtimeRow = Array.isArray(realtime) ? realtime[0] : realtime?.[0];
  const realtimeCount = Number(realtimeRow?.realtime_count ?? 0);

  let classification = "PRODUCTION_SCHEMA_PRESENT";
  if (missing.length === COMMUNICATION_TABLE_NAME_VALUES.length) {
    classification = "PRODUCTION_SCHEMA_NOT_APPLIED_EXPECTED";
  } else if (missing.length > 0) {
    classification = "PRODUCTION_SCHEMA_PARTIAL_DRIFT";
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        productionRef: PRODUCTION_REF,
        stagingRefBlocked: STAGING_REF,
        classification,
        expectedTableCount: COMMUNICATION_TABLE_NAME_VALUES.length,
        presentTableCount: presentNames.size,
        missingTables: missing,
        rlsRows: present.map((r) => ({
          table: r.table_name,
          rls_enabled: r.rls_enabled,
        })),
        realtimeCommunicationTables: realtimeCount,
        mutationCount: 0,
        secretsPrinted: false,
      },
      null,
      2
    )
  );
}

main().catch((err) => {
  console.error(
    JSON.stringify(
      {
        ok: false,
        error: String(err?.message || err),
        mutationCount: 0,
        secretsPrinted: false,
      },
      null,
      2
    )
  );
  process.exitCode = 1;
});
