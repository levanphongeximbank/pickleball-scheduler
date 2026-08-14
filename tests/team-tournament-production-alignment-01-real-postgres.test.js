/**
 * Local disposable PostgreSQL tests for the Production Team Tournament alignment package.
 * Never connects to Staging qyewbxjsiiyufanzcjcq or Production expuvcohlcjzvrrauvud.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import {
  FORBIDDEN_HOST_MARKERS,
  assertSafeWp5DatabaseUrl,
  execSqlFile,
  resolveWp5Database,
  withSafeClient,
} from "./helpers/operation-b1b-wp5-postgres.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pkgDir = path.join(
  root,
  "docs/v5/migrations/team-tournament-production-alignment-01"
);
const foundationDir = path.join(
  root,
  "docs/v5/migrations/team-tournament-production-referee-foundation-01"
);
const finalDir = path.join(
  root,
  "docs/v5/migrations/team-tournament-canonical-referee-lifecycle-01"
);
const foundationBootstrap = path.join(
  root,
  "tests/fixtures/team-tournament-production-referee-foundation-01-bootstrap.sql"
);
const extraPrestate = path.join(
  root,
  "tests/fixtures/team-tournament-production-alignment-01-extra-prestate.sql"
);

function readSql(dir, name) {
  return fs.readFileSync(path.join(dir, name), "utf8");
}

function optedIn() {
  const enable = String(process.env.OPERATION_B1B_WP5_ENABLE_REAL_POSTGRES || "")
    .trim()
    .toLowerCase();
  return (
    enable === "1" ||
    enable === "true" ||
    process.env.OPERATION_B1B_WP5_AUTO_PROVISION === "1" ||
    Boolean(process.env.OPERATION_B1B_WP5_DATABASE_URL)
  );
}

async function resetToProductionPrestate(client) {
  await client.query("drop schema if exists public cascade");
  await client.query("create schema public");
  await client.query("grant all on schema public to public");
  await client.query("drop schema if exists auth cascade");
  await execSqlFile(client, fs.readFileSync(foundationBootstrap, "utf8"));
  await execSqlFile(client, fs.readFileSync(extraPrestate, "utf8"));
  await execSqlFile(client, readSql(foundationDir, "02_APPLY.sql"));
}

async function expectFail(client, sql, needle) {
  let failed = false;
  let message = "";
  try {
    await client.query(sql);
  } catch (err) {
    failed = true;
    message = String(err?.message || err);
  }
  assert.equal(failed, true, `expected failure matching ${needle}`);
  assert.match(message, needle);
}

async function seedOwner(client) {
  const user = await client.query(
    `insert into auth.users (id) values (gen_random_uuid()) returning id`
  );
  const uid = user.rows[0].id;
  await client.query(
    `insert into public.profiles (id, email, display_name, role, venue_id, status, player_id)
     values ($1, 'owner@test.local', 'Owner', 'SUPER_ADMIN', 'venue-alignment', 'active', 'legacy-player')`,
    [uid]
  );
  await client.query(`select set_config('request.jwt.claim.sub', $1, false)`, [uid]);
  return uid;
}

test("alignment real-postgres safety gate forbids Staging/Production refs", () => {
  for (const marker of FORBIDDEN_HOST_MARKERS) {
    if (!["expuvcohlcjzvrrauvud", "qyewbxjsiiyufanzcjcq", "supabase.co"].includes(marker)) {
      continue;
    }
    const url = `postgresql://postgres:x@db.${marker}.supabase.co:5432/postgres`;
    const gate = assertSafeWp5DatabaseUrl(url);
    assert.equal(gate.ok, false, marker);
  }
});

test("alignment real-postgres package sequence", { timeout: 600000 }, async (t) => {
  if (!optedIn()) {
    t.skip(
      "REAL_POSTGRES_NOT_OPTED_IN (set OPERATION_B1B_WP5_ENABLE_REAL_POSTGRES=1 or AUTO_PROVISION=1)"
    );
    return;
  }

  const resolved = await resolveWp5Database();
  if (!resolved.ok) {
    assert.fail(
      `REAL_POSTGRES_UNAVAILABLE reason=${resolved.reason} docker=${resolved.dockerReason || ""} embedded=${resolved.embeddedReason || ""}`
    );
  }

  const precheck = readSql(pkgDir, "01_PRECHECK.sql");
  const apply = readSql(pkgDir, "02_APPLY.sql");
  const verify = readSql(pkgDir, "03_VERIFY.sql");
  const rollback = readSql(pkgDir, "04_ROLLBACK.sql");
  const finalPre = readSql(finalDir, "01_PRECHECK.sql");
  const finalApply = readSql(finalDir, "02_APPLY.sql");
  const finalVerify = readSql(finalDir, "03_VERIFY.sql");

  try {
    await withSafeClient(resolved.databaseUrl, async (client) => {
      const version = await client.query("select version() as v");
      assert.match(String(version.rows[0].v), /PostgreSQL/);

      await resetToProductionPrestate(client);
      const headers = await client.query("select count(*)::int as n from public.team_tournaments");
      assert.equal(headers.rows[0].n, 82);

      await client.query(precheck);
      await client.query(apply);
      await seedOwner(client);
      await client.query(verify);

      const after = await client.query("select count(*)::int as n from public.team_tournaments");
      assert.equal(after.rows[0].n, 82, "existing 82 tournaments preserved");

      const cap = await client.query(`
        select count(*)::int as n from public.team_tournaments
        where coalesce((settings->>'captainAccessEnabled')::boolean, false) is true
      `);
      assert.equal(cap.rows[0].n, 0, "no captain access backfill");

      await client.query(apply);
      await client.query(verify);

      await client.query(finalPre);

      await client.query(finalApply);
      await client.query(finalVerify);

      await resetToProductionPrestate(client);
      await client.query(precheck);
      await client.query(apply);
      await client.query(rollback);
      const restored = await client.query(`
        select
          to_regprocedure('public.team_tournament_create(text,text,text,text,text,text,jsonb)') is not null as create_fn,
          to_regprocedure('public.team_tournament_save_lineup_draft(text,text,text,jsonb)') is not null as save4,
          to_regprocedure('public.team_tournament_create_referee_assignment(text,text,text,uuid,timestamptz,boolean,text,text)') is not null as foundation
      `);
      assert.equal(restored.rows[0].create_fn, false);
      assert.equal(restored.rows[0].save4, true);
      assert.equal(restored.rows[0].foundation, true);

      await resetToProductionPrestate(client);
      await client.query(apply);
      await seedOwner(client);
      await client.query(`
        select public.team_tournament_create(
          'venue-alignment', 'club-x', 'Post-apply', null, null, null,
          jsonb_build_object('formatPreset','mlp_4')
        )
      `);
      await expectFail(client, rollback, /ROLLBACK_COMPLETE=NO post_alignment_canonical_team_tournaments/);

      await resetToProductionPrestate(client);
      await client.query(`
        create or replace function public.team_tournament_create(p_x integer)
        returns int language sql as $$ select 1 $$;
      `);
      await expectFail(client, precheck, /conflict=/);

      await resetToProductionPrestate(client);
      await client.query(apply);
      await client.query(`
        grant execute on function public.team_tournament_create(text,text,text,text,text,text,jsonb) to anon
      `);
      await expectFail(client, precheck, /unexpected_grants/);

      await resetToProductionPrestate(client);
      await client.query(`
        create or replace function public.team_tournament_create(
          p_tenant_id text, p_club_id text, p_name text,
          p_season_id text default null, p_league_id text default null,
          p_created_by text default null, p_settings jsonb default '{}'::jsonb
        ) returns jsonb
        language sql as $$ select jsonb_build_object('ok', true) $$;
      `);
      await expectFail(client, precheck, /partial_alignment_state/);
    });
  } finally {
    if (typeof resolved.cleanup === "function") {
      await resolved.cleanup();
    }
  }
});
