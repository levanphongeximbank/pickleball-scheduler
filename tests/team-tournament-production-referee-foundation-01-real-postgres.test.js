/**
 * Local disposable PostgreSQL tests for the Production referee foundation package.
 *
 * Ordinary unit CI does not require a database (skipped unless opted in).
 * Real PASS evidence requires:
 *   OPERATION_B1B_WP5_ENABLE_REAL_POSTGRES=1
 *   or OPERATION_B1B_WP5_AUTO_PROVISION=1
 *   or OPERATION_B1B_WP5_DATABASE_URL=postgresql://...@127.0.0.1/.../b1b_wp5_...
 *
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
  "docs/v5/migrations/team-tournament-production-referee-foundation-01"
);
const finalDir = path.join(
  root,
  "docs/v5/migrations/team-tournament-canonical-referee-lifecycle-01"
);
const bootstrapPath = path.join(
  root,
  "tests/fixtures/team-tournament-production-referee-foundation-01-bootstrap.sql"
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

async function resetPublic(client) {
  await client.query("drop schema if exists public cascade");
  await client.query("create schema public");
  await client.query("grant all on schema public to public");
  await client.query("drop schema if exists auth cascade");
  await execSqlFile(client, fs.readFileSync(bootstrapPath, "utf8"));
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

test("foundation real-postgres safety gate forbids Staging/Production refs", () => {
  for (const marker of FORBIDDEN_HOST_MARKERS) {
    if (!["expuvcohlcjzvrrauvud", "qyewbxjsiiyufanzcjcq", "supabase.co"].includes(marker)) {
      continue;
    }
    const url = `postgresql://postgres:x@db.${marker}.supabase.co:5432/postgres`;
    const gate = assertSafeWp5DatabaseUrl(url);
    assert.equal(gate.ok, false, marker);
  }
});

test("foundation real-postgres package sequence", { timeout: 600000 }, async (t) => {
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

      // --- greenfield PRECHECK → APPLY → VERIFY → second APPLY ---
      await resetPublic(client);
      await client.query(precheck);
      await client.query(apply);
      await client.query(verify);
      await client.query(apply);
      await client.query(verify);

      const objects = await client.query(`
        select
          to_regclass('public.referee_assignments') is not null as ra,
          to_regclass('public.match_live_states') is not null as mls,
          to_regclass('public.team_sub_match_referee_links') is not null as links
      `);
      assert.equal(objects.rows[0].ra, true);
      assert.equal(objects.rows[0].mls, true);
      assert.equal(objects.rows[0].links, true);

      // --- empty rollback restores prestate ---
      await client.query(rollback);
      const gone = await client.query(`
        select
          to_regclass('public.referee_assignments') is not null as ra,
          to_regprocedure('public.team_tournament_create_referee_assignment(text,text,text,uuid,timestamptz,boolean,text,text)') is not null as create_fn,
          to_regprocedure('public.team_tournament_start_dreambreaker(text,text,integer,text)') is not null as start_fn
      `);
      assert.equal(gone.rows[0].ra, false);
      assert.equal(gone.rows[0].create_fn, false);
      assert.equal(gone.rows[0].start_fn, true, "pre-existing start_dreambreaker must remain");
      await client.query(precheck);

      // --- composition: foundation → final PRECHECK → final APPLY → final VERIFY ---
      await client.query(apply);
      await client.query(verify);
      await client.query(finalPre);
      await client.query(finalApply);
      await client.query(finalVerify);

      const composed = await client.query(`
        select
          to_regprocedure('public.team_tournament_resolve_effective_referee_assignment(team_tournaments,team_tournament_matchups,team_tournament_sub_matches)') is not null as resolve,
          to_regprocedure('public.team_tournament_result_write_guard(team_tournaments,team_tournament_matchups,team_tournament_sub_matches)') is not null as guard,
          to_regprocedure('public.team_tournament_ensure_referee_runtime_for_matchup(team_tournaments,team_tournament_matchups,text)') is not null as ensure
      `);
      assert.equal(composed.rows[0].resolve, true);
      assert.equal(composed.rows[0].guard, true);
      assert.equal(composed.rows[0].ensure, true);

      const createDef = await client.query(`
        select pg_get_functiondef('public.team_tournament_create_referee_assignment(text,text,text,uuid,timestamptz,boolean,text,text)'::regprocedure) as def
      `);
      assert.match(createDef.rows[0].def, /v_parent/);

      // Foundation rollback must refuse once final continuation is present
      await expectFail(client, rollback, /ROLLBACK_REFUSED final_continuation/);

      // --- partial apply → PRECHECK refuses ---
      await resetPublic(client);
      await client.query(`
        create table public.referee_assignments (
          id uuid primary key,
          tenant_id text not null,
          tournament_id text not null,
          match_id text not null
        )
      `);
      await expectFail(client, precheck, /partial_foundation_state/);

      // --- conflicting object → PRECHECK refuses ---
      await resetPublic(client);
      await client.query(`
        create table public.referee_assignments (
          id uuid primary key,
          tenant_id text not null,
          tournament_id text not null,
          match_id text not null,
          referee_user_id uuid,
          role text,
          status text,
          assigned_at timestamptz default now(),
          expires_at timestamptz,
          revoked_at timestamptz,
          sub_match_id uuid,
          matchup_id uuid,
          external_matchup_id text,
          external_sub_match_id text,
          version integer
        );
        create table public.match_live_states (
          id text primary key,
          tenant_id text not null,
          tournament_id text not null,
          match_id text not null,
          team_a_id text not null,
          team_b_id text not null,
          state_payload jsonb,
          state_version integer,
          version integer,
          status text,
          last_event_sequence bigint,
          participants jsonb,
          scoring_format jsonb,
          points_to_win integer,
          win_by integer,
          best_of smallint,
          scoring_system text
        );
        create table public.team_sub_match_referee_links (
          id uuid primary key,
          tenant_id text not null,
          tournament_id text not null,
          team_tournament_id uuid,
          matchup_id uuid,
          external_matchup_id text,
          sub_match_id uuid,
          external_sub_match_id text,
          referee_match_id text,
          referee_assignment_id uuid,
          status text,
          snapshot jsonb,
          version integer
        );
      `);
      // Drop expires_at to create a shape conflict while all three tables exist.
      await client.query("alter table public.referee_assignments drop column expires_at");
      await expectFail(client, precheck, /conflict=/);

      // --- anon grants → VERIFY refuses ---
      await resetPublic(client);
      await client.query(apply);
      await client.query("grant insert, update, delete on public.referee_assignments to anon");
      await expectFail(client, verify, /anon_denied/);

      // --- live rows → destructive rollback refuses ---
      await resetPublic(client);
      await client.query(apply);
      await client.query(`
        insert into public.referee_assignments (
          tenant_id, tournament_id, match_id, referee_display_name, role, status
        ) values ('t1', 'tour-1', 'm1', 'Ref', 'REFEREE', 'active')
      `);
      await expectFail(client, rollback, /ROLLBACK_REFUSED live_data=/);
    });
  } finally {
    if (typeof resolved.cleanup === "function") {
      await resolved.cleanup();
    }
  }
});
