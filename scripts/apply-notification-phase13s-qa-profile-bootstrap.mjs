/**
 * Phase 1.3S — Apply Staging QA profile tenant bootstrap.
 *
 * Reads emails from:
 *   STAGING_OWNER_A_EMAIL
 *   STAGING_OWNER_B_EMAIL
 *
 * Requires SUPABASE_DB_URL (or DATABASE_URL) for Staging ref qyewbxjsiiyufanzcjcq.
 * Never Production. Never prints secrets.
 *
 * Usage:
 *   node scripts/apply-notification-phase13s-qa-profile-bootstrap.mjs
 *   node scripts/apply-notification-phase13s-qa-profile-bootstrap.mjs --rollback
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadProjectEnv } from "./load-env.mjs";

const STAGING_REF = "qyewbxjsiiyufanzcjcq";
const PRODUCTION_REF = "expuvcohlcjzvrrauvud";
const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function assertStagingDbUrl(url) {
  const value = String(url || "");
  if (value.includes(PRODUCTION_REF)) {
    console.error("❌ SUPABASE_DB_URL trỏ Production — dừng.");
    process.exit(1);
  }
  if (!value.includes(STAGING_REF)) {
    console.error(`❌ SUPABASE_DB_URL không khớp staging ${STAGING_REF} — dừng.`);
    process.exit(1);
  }
}

function requireEmail(name) {
  const value = String(process.env[name] || "").trim();
  if (!value) {
    console.error(`❌ Missing ${name} in env.`);
    process.exit(1);
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    console.error(`❌ Invalid ${name} format.`);
    process.exit(1);
  }
  return value;
}

/** Escape for safe single-quoted SQL literal (emails only). */
function sqlLiteral(value) {
  return String(value).replace(/'/g, "''");
}

function renderSql(template, ownerA, ownerB) {
  return template
    .replaceAll("{{OWNER_A_EMAIL}}", sqlLiteral(ownerA))
    .replaceAll("{{OWNER_B_EMAIL}}", sqlLiteral(ownerB));
}

async function main() {
  loadProjectEnv();
  const rollback = process.argv.includes("--rollback");
  const dbUrl = String(process.env.SUPABASE_DB_URL || process.env.DATABASE_URL || "").trim();
  if (!dbUrl) {
    console.error("❌ SUPABASE_DB_URL chưa set.");
    process.exit(1);
  }
  assertStagingDbUrl(dbUrl);

  const ownerA = requireEmail("STAGING_OWNER_A_EMAIL");
  const ownerB = requireEmail("STAGING_OWNER_B_EMAIL");
  if (ownerA.toLowerCase() === ownerB.toLowerCase()) {
    console.error("❌ Owner A and Owner B emails must differ for cross-tenant QA.");
    process.exit(1);
  }

  const rel = rollback
    ? "docs/supabase-notification-phase13s-qa-profile-bootstrap-rollback.sql"
    : "docs/supabase-notification-phase13s-qa-profile-bootstrap.sql";
  const template = fs.readFileSync(path.join(rootDir, rel), "utf8");
  const sql = renderSql(template, ownerA, ownerB);

  const pg = await import("pg");
  const client = new pg.default.Client({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false },
  });

  console.log("=== Phase 1.3S — QA profile bootstrap ===");
  console.log(`Staging ref: ${STAGING_REF}`);
  console.log(`Mode: ${rollback ? "rollback" : "apply"}`);
  console.log(`Owner A email present: yes`);
  console.log(`Owner B email present: yes`);

  try {
    await client.connect();
    const { rows: dbRows } = await client.query("select current_database() as db");
    console.log(`Connected database: ${dbRows[0]?.db}`);

    await client.query(sql);
    console.log(`✅ Applied ${rel}`);

    const { rows: profiles } = await client.query(
      `
      select p.email, p.role, p.venue_id, p.status,
             (v.id is not null) as venue_exists
      from public.profiles p
      left join public.venues v on v.id = p.venue_id
      where lower(p.email) in (lower($1), lower($2))
      order by p.email
      `,
      [ownerA, ownerB]
    );

    const { rows: roles } = await client.query(
      `
      select p.email, ur.role_id, ur.venue_id, ur.is_primary
      from public.profiles p
      join public.user_roles ur on ur.user_id = p.id
      where lower(p.email) in (lower($1), lower($2))
        and ur.is_primary = true
      order by p.email
      `,
      [ownerA, ownerB]
    );

    if (profiles.length < 2) {
      console.error("❌ Missing QA profile(s) — expected both Owner A and Owner B in public.profiles.");
      console.error(`   Found profiles: ${profiles.length}`);
      process.exit(1);
    }

    console.log(
      "PROFILES=" +
        JSON.stringify(
          profiles.map((r) => ({
            role: r.role,
            venue_id: r.venue_id,
            status: r.status,
            venue_exists: r.venue_exists,
          }))
        )
    );
    console.log(
      "USER_ROLES_PRIMARY=" +
        JSON.stringify(
          roles.map((r) => ({
            role_id: r.role_id,
            venue_id: r.venue_id,
            is_primary: r.is_primary,
          }))
        )
    );

    if (rollback) {
      console.log("✅ Rollback complete.");
      await client.end();
      return;
    }

    const byEmail = new Map(profiles.map((p) => [String(p.email).toLowerCase(), p]));
    const a = byEmail.get(ownerA.toLowerCase());
    const b = byEmail.get(ownerB.toLowerCase());
    const urByEmail = new Map(roles.map((r) => [String(r.email).toLowerCase(), r]));
    const urA = urByEmail.get(ownerA.toLowerCase());
    const urB = urByEmail.get(ownerB.toLowerCase());

    const checks = {
      ownerA_role: a?.role === "VENUE_OWNER",
      ownerA_venue: a?.venue_id === "venue-staging-a",
      ownerA_status: a?.status === "active",
      ownerA_venue_exists: a?.venue_exists === true,
      ownerB_role: b?.role === "VENUE_OWNER",
      ownerB_venue: b?.venue_id === "venue-staging-b",
      ownerB_status: b?.status === "active",
      ownerB_venue_exists: b?.venue_exists === true,
      urA_sync: !!urA && urA.role_id === a?.role && urA.venue_id === a?.venue_id,
      urB_sync: !!urB && urB.role_id === b?.role && urB.venue_id === b?.venue_id,
    };
    console.log("CHECKS=" + JSON.stringify(checks));
    const ok = Object.values(checks).every(Boolean);
    if (!ok) {
      console.error("❌ BOOTSTRAP_VERIFY=FAIL");
      process.exit(1);
    }
    console.log("✅ BOOTSTRAP_VERIFY=PASS");
  } finally {
    try {
      await client.end();
    } catch {
      /* ignore */
    }
  }
}

main().catch((error) => {
  console.error(`❌ ${error?.message || error}`);
  process.exit(1);
});
