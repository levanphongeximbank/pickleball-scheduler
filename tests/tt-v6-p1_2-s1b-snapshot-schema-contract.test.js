import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import { SETUP_COMMAND_NAMES } from "../src/features/team-tournament/canonical/teamTournamentCanonicalRules.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const sqlPath = join(
  __dirname,
  "../docs/v5/team-tournament/p1/PHASE_P1_2_S1B_SNAPSHOT_SCHEMA.sql"
);
const reportPath = join(
  __dirname,
  "../docs/v5/team-tournament/p1/PHASE_P1_2_S1B_SNAPSHOT_SCHEMA_REPORT.md"
);
const sql = readFileSync(sqlPath, "utf8");
const report = readFileSync(reportPath, "utf8");

const REQUIRED_COLUMNS = [
  "id uuid primary key",
  "tenant_id text not null",
  "tournament_id text not null",
  "team_tournament_id uuid not null",
  "tournament_version integer not null",
  "schema_version integer not null default 7",
  "command_name text not null",
  "idempotency_key text not null",
  "payload_hash text not null",
  "engine_input_hash text not null",
  "engine_output_hash text not null",
  "snapshot_hash text not null",
  "engine_version text not null",
  "rules_version text null",
  "snapshot_json jsonb not null",
  "normalized_read_hash text not null",
  "actor_id uuid null",
  "retention_class text not null default 'active'",
  "archived_at timestamptz null",
  "legal_hold boolean not null default false",
  "created_at timestamptz not null default now()",
];

describe("P1.2 S1-B — snapshot schema SQL contract", () => {
  it("authors team_tournament_setup_snapshots table", () => {
    assert.match(sql, /create table if not exists public\.team_tournament_setup_snapshots/i);
    for (const column of REQUIRED_COLUMNS) {
      assert.match(sql, new RegExp(column.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"));
    }
  });

  it("defines required foreign keys to venues, team_tournaments, auth.users", () => {
    assert.match(sql, /team_tournament_setup_snapshots_tenant_id_fkey[\s\S]*references public\.venues\(id\)/i);
    assert.match(
      sql,
      /team_tournament_setup_snapshots_team_tournament_id_fkey[\s\S]*references public\.team_tournaments\(id\)/i
    );
    assert.match(
      sql,
      /team_tournament_setup_snapshots_actor_id_fkey[\s\S]*references auth\.users\(id\) on delete set null/i
    );
  });

  it("enforces version and hash constraints", () => {
    assert.match(sql, /tournament_version >= 1/i);
    assert.match(sql, /schema_version >= 7/i);
    assert.match(sql, /payload_hash ~ '\^\[0-9a-f\]\{64\}\$'/);
    assert.match(sql, /engine_input_hash ~ '\^\[0-9a-f\]\{64\}\$'/);
    assert.match(sql, /engine_output_hash ~ '\^\[0-9a-f\]\{64\}\$'/);
    assert.match(sql, /snapshot_hash ~ '\^\[0-9a-f\]\{64\}\$'/);
    assert.match(sql, /normalized_read_hash ~ '\^\[0-9a-f\]\{64\}\$'/);
    assert.match(sql, /char_length\(idempotency_key\) <= 128/i);
  });

  it("defines unique constraints for version and idempotency", () => {
    assert.match(sql, /unique \(tenant_id, tournament_id, tournament_version\)/i);
    assert.match(sql, /unique \(tenant_id, tournament_id, command_name, idempotency_key\)/i);
  });

  it("locks command_name to S1-A registry", () => {
    for (const commandName of SETUP_COMMAND_NAMES) {
      assert.match(sql, new RegExp(`'${commandName.replace(/\./g, "\\.")}'`));
    }
    assert.equal(SETUP_COMMAND_NAMES.length, 21);
  });

  it("authors non-redundant indexes", () => {
    assert.match(sql, /idx_team_tournament_setup_snapshots_latest/i);
    assert.match(sql, /idx_team_tournament_setup_snapshots_timeline/i);
    assert.match(sql, /idx_team_tournament_setup_snapshots_command_history/i);
    assert.match(sql, /idx_team_tournament_setup_snapshots_retention/i);
  });

  it("implements append-only immutability at database level", () => {
    assert.match(sql, /team_tournament_setup_snapshots_immutable_guard/i);
    assert.match(sql, /SNAPSHOT_IMMUTABLE/i);
    assert.match(sql, /SNAPSHOT_DELETE_FORBIDDEN/i);
    assert.match(sql, /before update or delete on public\.team_tournament_setup_snapshots/i);
    assert.match(sql, /team_tournament_setup_snapshot_archive/i);
    assert.match(sql, /team_tournament\.snapshot_maintenance/i);
  });

  it("denies direct authenticated writes via RLS", () => {
    assert.match(sql, /enable row level security/i);
    assert.match(sql, /revoke all on public\.team_tournament_setup_snapshots from anon, authenticated/i);
    assert.match(sql, /grant select on public\.team_tournament_setup_snapshots to authenticated/i);
    assert.match(sql, /team_tournament_setup_snapshots_select/i);
    assert.match(sql, /team_tournament_can_manage\(\)/i);
    assert.doesNotMatch(sql, /for insert to authenticated/i);
    assert.doesNotMatch(sql, /for update to authenticated/i);
    assert.doesNotMatch(sql, /for delete to authenticated/i);
  });

  it("authors hash helpers without generation logic", () => {
    assert.match(sql, /function public\.team_tournament_is_sha256_hex/i);
    assert.match(sql, /function public\.team_tournament_sha256_utf8/i);
    assert.match(sql, /function public\.team_tournament_verify_canonical_text_hash/i);
    assert.match(sql, /function public\.team_tournament_normalized_read_hash/i);
    assert.doesNotMatch(sql, /generate_groups/i);
    assert.doesNotMatch(sql, /generate_matchups/i);
    assert.doesNotMatch(sql, /reshuffle/i);
  });

  it("documents hash parity limitation for SQL canonicalization", () => {
    assert.match(sql, /NOT replicated in SQL/i);
    assert.match(sql, /Does NOT perform S1-A domain normalization/i);
    assert.match(report, /Hash parity limitation/i);
    assert.match(report, /does not generate teams, groups, matchups, or schedules/i);
  });

  it("defines internal SECURITY DEFINER snapshot helper", () => {
    assert.match(sql, /function public\.team_tournament_create_setup_snapshot/i);
    assert.match(sql, /security definer/i);
    assert.match(sql, /p_snapshot_canonical_text text/i);
    assert.match(sql, /IDEMPOTENCY_KEY_REUSED/i);
    assert.match(sql, /SNAPSHOT_VERSION_CONFLICT/i);
    assert.match(sql, /revoke all on function public\.team_tournament_create_setup_snapshot/i);
    assert.match(sql, /snapshotId/i);
    assert.match(sql, /normalizedReadHash/i);
  });

  it("integrates with command log contract without modifying domain RPCs", () => {
    assert.match(sql, /team_tournament_begin_command/i);
    assert.match(sql, /team_tournament_finish_command/i);
    assert.match(sql, /team_tournament_command_log/i);
    assert.match(sql, /result_json/i);
    assert.doesNotMatch(sql, /create or replace function public\.team_tournament_replace_disciplines/i);
    assert.doesNotMatch(sql, /create or replace function public\.team_tournament_get_setup/i);
  });

  it("includes staging rollback instructions", () => {
    assert.match(sql, /Rollback/i);
    assert.match(sql, /drop table if exists public\.team_tournament_setup_snapshots/i);
    assert.match(report, /Safe pre-data rollback/i);
    assert.match(report, /Rollback after snapshots exist/i);
  });

  it("is authoring-only — no staging or production apply", () => {
    assert.match(sql, /DO NOT apply to Staging or Production/i);
    assert.match(report, /NOT applied to Staging or Production/i);
    assert.doesNotMatch(sql, /apply_migration/i);
  });
});

describe("P1.2 S1-B — scope guards", () => {
  it("does not author get_setup v7", () => {
    assert.doesNotMatch(sql, /create or replace function public\.team_tournament_get_setup/i);
    assert.doesNotMatch(sql, /returns json[\s\S]*schemaVersion.*7.*get_setup/i);
  });

  it("does not author discipline domain RPCs", () => {
    assert.doesNotMatch(sql, /discipline\.save.*function/i);
    assert.doesNotMatch(sql, /team_tournament_save_discipline/i);
  });
});
