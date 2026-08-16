/**
 * Batch10 controlled activation smoke after each cutover step.
 * Reuses Staging backend cert with fixtures; expects SQL cutover state as arg.
 * Usage: node scripts/court-operations/batch10-staging-activation-smoke.mjs [expectOn|expectOff]
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const STAGING_REF = "qyewbxjsiiyufanzcjcq";
const PRODUCTION_REF = "expuvcohlcjzvrrauvud";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const dbUrl = String(process.env.STAGING_SUPABASE_DB_URL || "").trim();
if (!dbUrl || dbUrl.includes(PRODUCTION_REF) || !dbUrl.includes(STAGING_REF)) {
  console.error("BLOCKED");
  process.exit(1);
}

const expect = String(process.argv[2] || "expectOff");
const client = new pg.Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
await client.connect();
try {
  const { rows } = await client.query(
    `SELECT enabled FROM public.court_resource_reservation_cutover WHERE cutover_id='canonical-reservation-phase3b'`,
  );
  const enabled = rows[0]?.enabled === true;
  if (expect === "expectOn" && !enabled) throw new Error("EXPECTED_SQL_CUTOVER_ON");
  if (expect === "expectOff" && enabled) throw new Error("EXPECTED_SQL_CUTOVER_OFF");
  console.log(JSON.stringify({ sqlCutoverEnabled: enabled, expect }, null, 2));
} finally {
  await client.end();
}

const cert = spawnSync(
  process.execPath,
  [
    path.join(root, "scripts/court-operations/batch10-staging-backend-cert.mjs"),
    ...(expect === "expectOn" ? ["--allow-cutover-on"] : []),
  ],
  {
    encoding: "utf8",
    env: process.env,
    timeout: 180000,
  },
);
console.log(cert.stdout);
if (cert.status !== 0) {
  console.error(cert.stderr);
  process.exit(cert.status || 1);
}
