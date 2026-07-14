/**
 * Schema audit for profiles.gender — Staging + optional Production.
 * Usage:
 *   node scripts/audit-profile-gender-schema.mjs
 *   node scripts/audit-profile-gender-schema.mjs --production
 *
 * Requires service role in env (does not print secrets).
 */
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { getStagingSupabaseEnv, loadProjectEnv } from "./load-env.mjs";

const PRODUCTION_REF = "expuvcohlcjzvrrauvud";
const OUT_DIR = path.resolve("docs/v5/qa-evidence/phase-profile-gender");

function getProductionEnv() {
  loadProjectEnv({ production: true });
  const url = String(process.env.PRODUCTION_SUPABASE_URL || process.env.VITE_SUPABASE_URL || "").trim();
  const serviceKey = String(
    process.env.PRODUCTION_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || ""
  ).trim();
  if (url && !url.includes(PRODUCTION_REF)) {
    throw new Error(`Refusing non-production URL (expected ${PRODUCTION_REF})`);
  }
  return { url, serviceKey };
}

async function runAudit(label, url, serviceKey) {
  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const columnsSql = `
    select column_name, data_type, udt_name, is_nullable, column_default
    from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles'
      and column_name in ('gender','birth_year','display_name','phone','avatar_url')
    order by ordinal_position`;

  const constraintsSql = `
    select c.conname, c.contype, pg_get_constraintdef(c.oid) as definition
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public' and t.relname = 'profiles'
      and (
        pg_get_constraintdef(c.oid) ilike '%gender%'
        or pg_get_constraintdef(c.oid) ilike '%birth_year%'
        or c.conname ilike '%gender%'
      )`;

  const distSql = `
    select gender, count(*)::int as n
    from public.profiles
    group by gender
    order by n desc
    limit 20`;

  const { data: columns, error: colErr } = await admin.rpc("exec_sql_readonly", {
    query: columnsSql,
  }).maybeSingle?.() ?? { data: null, error: { message: "rpc_unavailable" } };

  // Prefer PostgREST openapi / select if exec rpc missing: probe column via select
  const probe = await admin.from("profiles").select("id, gender, birth_year").limit(1);
  const dist = await admin
    .from("profiles")
    .select("gender")
    .not("gender", "is", null)
    .limit(1000);

  const genderCounts = {};
  for (const row of dist.data || []) {
    const key = row.gender == null ? null : String(row.gender);
    genderCounts[key] = (genderCounts[key] || 0) + 1;
  }

  return {
    label,
    urlHost: new URL(url).host,
    columnProbeError: probe.error?.message || null,
    columnProbeSample: probe.data?.[0]
      ? {
          hasGenderKey: Object.prototype.hasOwnProperty.call(probe.data[0], "gender"),
          hasBirthYearKey: Object.prototype.hasOwnProperty.call(probe.data[0], "birth_year"),
          genderSample: probe.data[0].gender ?? null,
        }
      : null,
    genderCountsSampled: genderCounts,
    rpcColumns: columns || null,
    rpcColumnsError: colErr?.message || null,
    note: "If columnProbeSample.hasGenderKey=true, public.profiles.gender exists. Do not ADD COLUMN.",
  };
}

async function main() {
  const wantProduction = process.argv.includes("--production");
  fs.mkdirSync(OUT_DIR, { recursive: true });

  loadProjectEnv();
  const staging = getStagingSupabaseEnv();
  if (!staging.serviceKey) {
    throw new Error("Missing STAGING_SUPABASE_SERVICE_ROLE_KEY");
  }

  const stagingReport = await runAudit("staging", staging.url, staging.serviceKey);
  const out = { generatedAt: new Date().toISOString(), staging: stagingReport };

  if (wantProduction) {
    const prod = getProductionEnv();
    if (!prod.serviceKey) {
      throw new Error("Missing PRODUCTION_SUPABASE_SERVICE_ROLE_KEY / SUPABASE_SERVICE_ROLE_KEY");
    }
    out.production = await runAudit("production", prod.url, prod.serviceKey);
  }

  const outPath = path.join(OUT_DIR, "SCHEMA_AUDIT.json");
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
  console.log(JSON.stringify(out, null, 2));
  console.log(`Wrote ${outPath}`);
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
