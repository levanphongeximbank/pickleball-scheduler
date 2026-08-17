/**
 * Batch 10 — Staging SQL reservation cutover toggle (qyewbxjsiiyufanzcjcq only).
 * Usage:
 *   node scripts/court-operations/batch10-staging-set-sql-cutover.mjs on
 *   node scripts/court-operations/batch10-staging-set-sql-cutover.mjs off
 *   node scripts/court-operations/batch10-staging-set-sql-cutover.mjs status
 */
import pg from "pg";

const STAGING_REF = "qyewbxjsiiyufanzcjcq";
const PRODUCTION_REF = "expuvcohlcjzvrrauvud";
const dbUrl = String(process.env.STAGING_SUPABASE_DB_URL || "").trim();
if (!dbUrl || dbUrl.includes(PRODUCTION_REF) || !dbUrl.includes(STAGING_REF)) {
  console.error("BLOCKED: Staging DB URL required");
  process.exit(1);
}

const mode = String(process.argv[2] || "status").toLowerCase();
const client = new pg.Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
await client.connect();
try {
  const actor = (
    await client.query(
      `SELECT id::text AS id FROM public.profiles WHERE role='SUPER_ADMIN' AND status='active' LIMIT 1`,
    )
  ).rows[0]?.id;
  if (!actor) throw new Error("NO_SUPER_ADMIN");
  await client.query(`SELECT set_config('request.jwt.claim.sub', $1, false)`, [actor]);
  await client.query(`SELECT set_config('request.jwt.claim.role', 'authenticated', false)`);

  if (mode === "on" || mode === "off") {
    const enabled = mode === "on";
    const { rows } = await client.query(
      `SELECT public.court_resource_set_canonical_reservation_cutover($1) AS result`,
      [enabled],
    );
    console.log(JSON.stringify({ action: mode, result: rows[0].result }, null, 2));
  }

  const { rows: status } = await client.query(
    `SELECT cutover_id, enabled, updated_at FROM public.court_resource_reservation_cutover`,
  );
  console.log(JSON.stringify({ stagingProject: STAGING_REF, status }, null, 2));
} finally {
  await client.end();
}
