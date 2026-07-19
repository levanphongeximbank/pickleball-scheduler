/**
 * Read-only Staging readiness probe for Phase 1D profile migration.
 * Refuses Production project refs. Does not apply SQL.
 */
import fs from "node:fs";
import path from "node:path";
import pg from "pg";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const envPath = path.join(root, ".env.staging-qa.local");
const PRODUCTION_REF = "expuvcohlcjzvrrauvud";

function loadEnv(file) {
  const out = {};
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    if (!line || line.startsWith("#")) continue;
    const i = line.indexOf("=");
    if (i < 0) continue;
    out[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  return out;
}

const env = loadEnv(envPath);
const url = env.SUPABASE_DB_URL || "";
if (!url) {
  console.error("NO_DB_URL");
  process.exit(2);
}
if (url.includes(PRODUCTION_REF) || JSON.stringify(env).includes(PRODUCTION_REF)) {
  console.error("REFUSING_PRODUCTION");
  process.exit(3);
}

const client = new pg.Client({
  connectionString: url,
  ssl: { rejectUnauthorized: false },
});

await client.connect();

const cols = await client.query(`
  select column_name
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'profiles'
    and column_name in (
      'birth_date',
      'handedness',
      'activity_region',
      'privacy_settings',
      'identity_verification_status',
      'birth_year'
    )
  order by 1
`);

const constraints = await client.query(`
  select conname
  from pg_constraint
  where conrelid = 'public.profiles'::regclass
    and conname in (
      'profiles_birth_date_not_future_check',
      'profiles_handedness_check',
      'profiles_identity_verification_status_check',
      'profiles_privacy_settings_object_check',
      'profiles_privacy_settings_booleans_check',
      'profiles_activity_region_object_check'
    )
  order by 1
`);

const guard = await client.query(`
  select
    position($$current_user = 'postgres'$$ in pg_get_functiondef(oid)) = 0 as no_bypass,
    position('Cannot self-modify identity_verification_status' in pg_get_functiondef(oid)) > 0 as self_block,
    position($$user_has_permission('user.manage')$$ in pg_get_functiondef(oid)) > 0 as user_manage
  from pg_proc
  where pronamespace = 'public'::regnamespace
    and proname = 'profiles_guard_privileged_update'
`);

const counts = await client.query(`
  select
    count(*)::int as total,
    count(*) filter (where privacy_settings is null)::int as privacy_null,
    count(*) filter (where identity_verification_status is null)::int as verification_null
  from public.profiles
`);

const report = {
  mode: "read_only_verify",
  appliedSqlThisSession: false,
  columns: cols.rows.map((r) => r.column_name),
  constraints: constraints.rows.map((r) => r.conname),
  guard: guard.rows[0] || null,
  counts: counts.rows[0],
};

const expectedCols = [
  "activity_region",
  "birth_date",
  "birth_year",
  "handedness",
  "identity_verification_status",
  "privacy_settings",
];
const missingCols = expectedCols.filter((c) => !report.columns.includes(c));
report.ready =
  missingCols.length === 0 &&
  report.constraints.length === 6 &&
  report.guard?.no_bypass === true &&
  report.guard?.self_block === true &&
  report.counts.privacy_null === 0 &&
  report.counts.verification_null === 0;
report.missingCols = missingCols;

console.log(JSON.stringify(report, null, 2));
await client.end();
process.exit(report.ready ? 0 : 1);
