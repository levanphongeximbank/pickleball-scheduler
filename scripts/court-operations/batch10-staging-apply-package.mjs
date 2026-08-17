/**
 * Batch 10 — Staging-only SQL package apply runner (qyewbxjsiiyufanzcjcq).
 * Reads full SQL file and executes client.query(sqlText) — no semicolon split.
 * Never prints password/service-role. Blocks Production ref.
 *
 * Usage:
 *   node scripts/court-operations/batch10-staging-apply-package.mjs <pkgDir> <phase>
 * phase: precheck | apply | verify | all
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const STAGING_REF = "qyewbxjsiiyufanzcjcq";
const PRODUCTION_REF = "expuvcohlcjzvrrauvud";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

const dbUrl = String(process.env.STAGING_SUPABASE_DB_URL || "").trim();
if (!dbUrl) {
  console.error("MISSING STAGING_SUPABASE_DB_URL");
  process.exit(2);
}
if (dbUrl.includes(PRODUCTION_REF)) {
  console.error("BLOCKED: Production ref in DB URL");
  process.exit(1);
}
if (!dbUrl.includes(STAGING_REF)) {
  console.error("BLOCKED: DB URL must include Staging ref", STAGING_REF);
  process.exit(1);
}

const pkgRel = process.argv[2];
const phase = (process.argv[3] || "all").toLowerCase();
if (!pkgRel) {
  console.error("Usage: node ... <pkgRel> [precheck|apply|verify|all]");
  process.exit(2);
}

const pkgDir = path.join(root, pkgRel);
const files = {
  precheck: "01_PRECHECK.sql",
  apply: "02_APPLY.sql",
  verify: "03_VERIFY.sql",
};

function phasesFor(mode) {
  if (mode === "all") return ["precheck", "apply", "verify"];
  if (!files[mode]) throw new Error(`unknown phase ${mode}`);
  return [mode];
}

async function main() {
  const client = new pg.Client({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  try {
    const { rows } = await client.query("SELECT current_database() AS db");
    console.log(JSON.stringify({ ok: true, db: rows[0].db, package: pkgRel, phase }));
    for (const p of phasesFor(phase)) {
      const filePath = path.join(pkgDir, files[p]);
      if (!fs.existsSync(filePath)) throw new Error(`missing ${filePath}`);
      const sql = fs.readFileSync(filePath, "utf8");
      console.log(`▶ ${p.toUpperCase()} ${files[p]} bytes=${sql.length}`);
      await client.query(sql);
      console.log(`✅ ${p.toUpperCase()} OK`);
    }
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error("FAIL", err.message);
  process.exit(1);
});
