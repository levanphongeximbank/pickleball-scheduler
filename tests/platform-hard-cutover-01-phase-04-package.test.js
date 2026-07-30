import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const PHASE = path.join(ROOT, "docs/platform-hard-cutover-01/phase-04");

test("phase-04 package: destructive SQL files exist and forbid auth wipe", () => {
  const wipe = fs.readFileSync(
    path.join(PHASE, "sql/destructive/10_ORDERED_WIPE.sql"),
    "utf8"
  );
  assert.equal(wipe.includes("auth.users"), true);
  assert.equal(/DELETE\s+FROM\s+auth\.users/i.test(wipe), false);
  assert.equal(/TRUNCATE\s+TABLE\s+auth\.users/i.test(wipe), false);
  assert.equal(/TRUNCATE\s+TABLE\s+public\.profiles\b/i.test(wipe), false);
  assert.equal(/TRUNCATE\s+TABLE\s+public\.venues\b/i.test(wipe), false);
  assert.equal(/TRUNCATE\s+TABLE\s+public\.tenant_members\b/i.test(wipe), false);
  assert.equal(/^TRUNCATE\s+ALL/im.test(wipe), false);
});

test("phase-04 package: M8 finalize RPC is single writer name", () => {
  const rpc = fs.readFileSync(
    path.join(PHASE, "sql/m8-competition-remote-ssot/40_RPC_COMMAND_AND_FINALIZE.sql"),
    "utf8"
  );
  assert.equal(rpc.includes("competition_ssot_finalize_match_result"), true);
  assert.equal(rpc.includes("THE single finalized-result writer"), true);
  assert.equal(/p_tenant_id\s+uuid\b/.test(rpc), false);
  assert.equal(rpc.includes("p_tenant_id text"), true);
});

test("phase-04 package: M8 tables use text tenant_id", () => {
  const tables = fs.readFileSync(
    path.join(PHASE, "sql/m8-competition-remote-ssot/10_TABLES.sql"),
    "utf8"
  );
  assert.equal(/tenant_id\s+uuid\b/.test(tables), false);
  assert.equal(tables.includes("tenant_id text NOT NULL"), true);
});

test("phase-04 package: drop club_ai_data authored", () => {
  const drop = fs.readFileSync(
    path.join(PHASE, "sql/destructive/20_DROP_CLUB_AI_DATA.sql"),
    "utf8"
  );
  assert.equal(drop.includes("DROP TABLE IF EXISTS public.club_ai_data"), true);
});

test("phase-04 package: implementation marker present", () => {
  const manifest = JSON.parse(
    fs.readFileSync(path.join(PHASE, "IMPLEMENTATION_MANIFEST.json"), "utf8")
  );
  assert.equal(
    manifest.marker,
    "PLATFORM_HARD_CUTOVER_01_PHASE_04_PR_READY_FOR_OWNER_MERGE"
  );
  assert.equal(manifest.mutations.databaseWrites, 0);
  assert.equal(manifest.mutations.stagingApply, false);
  assert.equal(manifest.mutations.productionApply, false);
});

test("phase-04 wipe: forbids CASCADE and protected truncate/delete targets", () => {
  const wipe = fs.readFileSync(
    path.join(PHASE, "sql/destructive/10_ORDERED_WIPE.sql"),
    "utf8"
  );
  assert.equal(/TRUNCATE[\s\S]*\bCASCADE\b/i.test(wipe), false);
  assert.equal(/expuvcohlcjzvrrauvud/.test(wipe), false);
  for (const protectedTable of [
    "profiles",
    "venues",
    "tenant_members",
    "roles",
    "permissions",
    "role_permissions",
    "plans",
    "plan_limits",
  ]) {
    assert.equal(
      new RegExp(
        String.raw`(?:TRUNCATE\s+TABLE|DELETE\s+FROM)\s+public\.${protectedTable}\b`,
        "i"
      ).test(wipe),
      false,
      `protected table mutated: ${protectedTable}`
    );
  }
});

test("phase-04 wipe FK hard-stop evidence records out-of-manifest blockers", () => {
  const evidence = JSON.parse(
    fs.readFileSync(
      path.join(
        PHASE,
        "staging-rehearsal/evidence/07_ORDERED_WIPE_FK_GRAPH_HARD_STOP_2026-07-30.json"
      ),
      "utf8"
    )
  );
  assert.equal(
    evidence.marker,
    "PLATFORM_HARD_CUTOVER_01_ORDERED_WIPE_FK_HARD_STOP_OUT_OF_MANIFEST"
  );
  assert.equal(evidence.ownerDecision.cascadeAllowed, false);
  assert.equal(evidence.manifestMutation["10_ORDERED_WIPE.sql_changed"], false);
  assert.equal(evidence.mutations.database, 0);
  assert.equal(evidence.mutations.production, 0);
  const required = evidence.tablesRequiredToExpandWipeManifestForTruncateNoCascade;
  assert.equal(required.includes("referee_assignments"), true);
  assert.equal(required.includes("team_sub_match_referee_links"), true);
  assert.equal(
    required.includes("team_tournament_referee_correction_requests"),
    true
  );
  assert.equal(required.includes("team_tournament_referee_event_inbox"), true);
});

test("phase-04 wipe expand5: residual FK hard-stop blocks package rewrite", () => {
  const evidence = JSON.parse(
    fs.readFileSync(
      path.join(
        PHASE,
        "staging-rehearsal/evidence/08_ORDERED_WIPE_FK_EXPAND5_HARD_STOP_2026-07-30.json"
      ),
      "utf8"
    )
  );
  assert.equal(
    evidence.marker,
    "PLATFORM_HARD_CUTOVER_01_ORDERED_WIPE_FK_EXPAND5_HARD_STOP_RESIDUAL"
  );
  assert.equal(evidence.ownerDecision.cascadeAllowed, false);
  assert.equal(evidence.ownerDecision.expandBeyondFiveAllowed, false);
  assert.deepEqual(evidence.ownerDecision.approvedExpandTablesExact, [
    "referee_assignments",
    "team_sub_match_referee_links",
    "team_tournament_referee_correction_requests",
    "team_tournament_referee_event_inbox",
    "player_identity_links",
  ]);
  assert.equal(evidence.manifestMutation["10_ORDERED_WIPE.sql_changed"], false);
  assert.equal(evidence.cascadeOccurrencesInWipe, 0);
  assert.equal(evidence.mutations.database, 0);
  assert.equal(evidence.mutations.production, 0);
  assert.deepEqual(evidence.hardStop.furtherExpansionRequiredWithoutCascade, [
    "referee_device_sessions",
  ]);
  assert.equal(
    evidence.residualOutsideInboundFks[0].src_table,
    "referee_device_sessions"
  );
  assert.equal(
    evidence.residualOutsideInboundFks[0].tgt_table,
    "referee_assignments"
  );

  const wipe = fs.readFileSync(
    path.join(PHASE, "sql/destructive/10_ORDERED_WIPE.sql"),
    "utf8"
  );
  for (const table of evidence.ownerDecision.approvedExpandTablesExact) {
    assert.equal(
      new RegExp(
        String.raw`(?:TRUNCATE\s+TABLE|DELETE\s+FROM)\s+public\.${table}\b`,
        "i"
      ).test(wipe),
      false,
      `expand5 not authored under hard-stop: ${table}`
    );
  }
  assert.equal(/TRUNCATE[\s\S]*\bCASCADE\b/i.test(wipe), false);
  assert.equal(/expuvcohlcjzvrrauvud/.test(wipe), false);
});
