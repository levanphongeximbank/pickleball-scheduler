#!/usr/bin/env node
/**
 * Phase 2D — Apply club_transfer_president authz gate to STAGING ONLY.
 * Hard-blocks Production (expuvcohlcjzvrrauvud).
 *
 * Requires: SUPABASE_ACCESS_TOKEN (via load-env)
 */
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { loadProjectEnv } from "./load-env.mjs";

const STAGING_REF = "qyewbxjsiiyufanzcjcq";
const PRODUCTION_REF = "expuvcohlcjzvrrauvud";
const PATCH = "docs/v5/phase2d/PHASE_2D_TRANSFER_PRESIDENT_AUTHZ_GATE.sql";
const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(rootDir, "docs/v5/qa-evidence/phase2d-staging");

loadProjectEnv();

function sha256(buf) {
  return createHash("sha256").update(buf).digest("hex");
}

async function managementSql(token, sql, label) {
  const res = await fetch(
    `https://api.supabase.com/v1/projects/${STAGING_REF}/database/query`,
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
    throw new Error(
      `${label}: ${body?.message || body?.error || JSON.stringify(body) || res.statusText}`
    );
  }
  return body;
}

async function main() {
  const token = String(process.env.SUPABASE_ACCESS_TOKEN || "").trim();
  if (!token) {
    console.error("MISSING SUPABASE_ACCESS_TOKEN");
    process.exit(2);
  }

  if (STAGING_REF === PRODUCTION_REF) {
    console.error("REF_COLLISION");
    process.exit(3);
  }

  const sqlPath = path.join(rootDir, PATCH);
  const sql = fs.readFileSync(sqlPath, "utf8");
  const checksum = sha256(Buffer.from(sql.replace(/\r\n/g, "\n"), "utf8"));

  fs.mkdirSync(outDir, { recursive: true });

  console.log("Applying Phase 2D president authz gate to Staging…");
  console.log(`ref=${STAGING_REF}`);
  console.log(`checksum=${checksum}`);

  await managementSql(token, sql, "apply-phase2d-gate");

  const verify = await managementSql(
    token,
    `
    select jsonb_build_object(
      'helper_exists', to_regprocedure('public.phase42_can_transfer_president(text)') is not null,
      'transfer_uses_helper', (
        select pg_get_functiondef(to_regprocedure('public.club_transfer_president(uuid,text,uuid,integer)'))
      ) ilike '%phase42_can_transfer_president%',
      'transfer_no_bare_tenant_member', (
        select pg_get_functiondef(to_regprocedure('public.club_transfer_president(uuid,text,uuid,integer)'))
      ) not ilike '%phase42_is_tenant_member(%',
      'search_path_public', (
        select prosecdef and (proconfig::text ilike '%search_path%public%')
        from pg_proc
        where oid = to_regprocedure('public.club_transfer_president(uuid,text,uuid,integer)')
      )
    ) as result;
    `,
    "verify-phase2d-gate"
  );

  const row = Array.isArray(verify) ? verify[0]?.result || verify[0] : verify;
  const report = {
    appliedAt: new Date().toISOString(),
    stagingRef: STAGING_REF,
    productionRef: PRODUCTION_REF,
    sqlFile: PATCH,
    checksumSha256: checksum,
    verify: row,
    productionApplied: false,
  };

  fs.writeFileSync(
    path.join(outDir, "APPLY_REPORT.json"),
    JSON.stringify(report, null, 2) + "\n"
  );
  fs.writeFileSync(
    path.join(outDir, "APPLY_REPORT.md"),
    [
      "# Phase 2D Staging Apply — Transfer President Authz Gate",
      "",
      `- Staging ref: \`${STAGING_REF}\``,
      `- SQL: \`${PATCH}\``,
      `- Checksum (LF): \`${checksum}\``,
      `- Production applied: **false**`,
      "",
      "```json",
      JSON.stringify(row, null, 2),
      "```",
      "",
    ].join("\n")
  );

  const ok =
    row?.helper_exists === true &&
    row?.transfer_uses_helper === true &&
    row?.transfer_no_bare_tenant_member === true;

  console.log(JSON.stringify(report, null, 2));
  if (!ok) {
    console.error("VERIFY_FAILED");
    process.exit(4);
  }
  console.log("STAGING_APPLY_PASS");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
