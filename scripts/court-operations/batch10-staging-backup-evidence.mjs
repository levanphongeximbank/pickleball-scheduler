/**
 * Batch 10 — Staging pre-mutation evidence freeze (definitions + counts).
 * Writes outside git. No secrets. Staging ref hard-gated.
 */
import fs from "node:fs";
import path from "node:path";
import pg from "pg";

const STAGING_REF = "qyewbxjsiiyufanzcjcq";
const PRODUCTION_REF = "expuvcohlcjzvrrauvud";
const outDir = process.argv[2];
const dbUrl = String(process.env.STAGING_SUPABASE_DB_URL || "").trim();

if (!outDir) {
  console.error("Usage: node ... <backupDir>");
  process.exit(2);
}
if (!dbUrl || dbUrl.includes(PRODUCTION_REF) || !dbUrl.includes(STAGING_REF)) {
  console.error("BLOCKED: invalid Staging DB URL");
  process.exit(1);
}

fs.mkdirSync(outDir, { recursive: true });

const TABLES = [
  "court_clusters",
  "court_resource_physical_courts",
  "court_resource_club_operational_access",
  "court_resource_reservations",
  "court_resource_reservation_commands",
  "court_resource_reservation_cutover",
  "court_resource_legacy_court_identity_mappings",
  "court_resource_cluster_identity_mappings",
  "venues",
  "clubs",
  "club_data_v3",
  "daily_play_court_leases",
  "daily_play_court_capacity_windows",
  "court_operations_bookings",
  "court_operations_resource_blocks",
  "court_operations_court_live_states",
  "court_operations_resource_sessions",
];

async function main() {
  const client = new pg.Client({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  try {
    const meta = await client.query(
      `SELECT version() AS pg_version, current_database() AS db, now() AS captured_at`
    );
    fs.writeFileSync(
      path.join(outDir, "00_meta.json"),
      JSON.stringify({ stagingRef: STAGING_REF, ...meta.rows[0] }, null, 2)
    );

    const counts = {};
    for (const table of TABLES) {
      const exists = await client.query(
        `SELECT to_regclass($1) IS NOT NULL AS ok`,
        [`public.${table}`]
      );
      if (!exists.rows[0].ok) {
        counts[table] = { present: false, n: null };
        continue;
      }
      const { rows } = await client.query(
        `SELECT count(*)::int AS n FROM public.${table}`
      );
      counts[table] = { present: true, n: rows[0].n };
    }
    fs.writeFileSync(path.join(outDir, "01_counts.json"), JSON.stringify(counts, null, 2));

    const cols = await client.query(
      `SELECT table_name, column_name, data_type, is_nullable
       FROM information_schema.columns
       WHERE table_schema='public'
         AND table_name = ANY($1::text[])
       ORDER BY table_name, ordinal_position`,
      [TABLES]
    );
    fs.writeFileSync(path.join(outDir, "02_columns.json"), JSON.stringify(cols.rows, null, 2));

    const fns = await client.query(
      `SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args,
              length(pg_get_functiondef(p.oid)) AS def_len,
              md5(pg_get_functiondef(p.oid)) AS def_md5
       FROM pg_proc p
       JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname='public'
         AND (p.proname LIKE 'court_resource_%' OR p.proname LIKE 'court_operations_%')
       ORDER BY 1,2`
    );
    fs.writeFileSync(path.join(outDir, "03_functions.json"), JSON.stringify(fns.rows, null, 2));

    const guard = await client.query(
      `SELECT pg_get_functiondef('public.court_resource_identity_guard()'::regprocedure) AS def`
    );
    fs.writeFileSync(path.join(outDir, "04_identity_guard.sql"), guard.rows[0].def);

    const ids = await client.query(
      `SELECT
         (SELECT jsonb_agg(jsonb_build_object('id', id, 'venue_id', venue_id, 'name', name))
            FROM public.court_clusters) AS clusters,
         (SELECT jsonb_agg(jsonb_build_object(
            'physical_court_id', physical_court_id,
            'tenant_id', tenant_id,
            'cluster_id', cluster_id,
            'display_name', display_name,
            'lifecycle_status', lifecycle_status
          )) FROM public.court_resource_physical_courts) AS physical_courts,
         (SELECT jsonb_agg(jsonb_build_object(
            'club_id', club_id,
            'physical_court_id', physical_court_id,
            'status', status,
            'tenant_id', tenant_id
          )) FROM public.court_resource_club_operational_access) AS access_rows,
         (SELECT enabled FROM public.court_resource_reservation_cutover
            WHERE cutover_id='canonical-reservation-phase3b') AS cutover_enabled`
    );
    fs.writeFileSync(path.join(outDir, "05_sanitized_ids.json"), JSON.stringify(ids.rows[0], null, 2));

    console.log(JSON.stringify({ ok: true, outDir, counts }, null, 2));
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error("FAIL", err.message);
  process.exit(1);
});
