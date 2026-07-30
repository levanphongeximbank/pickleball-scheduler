import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const PHASE = path.join(ROOT, "docs/platform-hard-cutover-01/phase-04");
const WIPE_PATH = path.join(PHASE, "sql/destructive/10_ORDERED_WIPE.sql");

const APPROVED_6 = [
  "referee_assignments",
  "team_sub_match_referee_links",
  "team_tournament_referee_correction_requests",
  "team_tournament_referee_event_inbox",
  "player_identity_links",
  "referee_device_sessions",
];

const ORIGINAL_WIPE_TABLES = [
  "team_tournament_lineup_entries",
  "team_tournament_lineup_revisions",
  "team_tournament_lineups",
  "team_tournament_dreambreaker_states",
  "team_tournament_forfeit_events",
  "team_tournament_sub_matches",
  "team_tournament_matchups",
  "team_tournament_standings",
  "team_tournament_team_members",
  "team_tournament_teams",
  "team_tournament_groups",
  "team_tournament_disciplines",
  "team_tournament_setup_snapshots",
  "team_tournament_sync_mismatch",
  "team_tournament_command_log",
  "team_tournament_audit_logs",
  "team_tournaments",
  "rating_v5_reassessment_approvals",
  "rating_v5_pilot_enrollments",
  "rating_v5_idempotency",
  "rating_snapshots",
  "rating_review_cases",
  "rating_evidence",
  "player_rating_profiles",
  "player_rating_events",
  "player_skill_assessments",
  "pick_vn_player_ratings",
  "rating_calibration_versions",
  "rating_v5_rollout_config",
  "vpr_point_ledger",
  "vpr_leaderboard",
  "vpr_audit_logs",
  "vpr_athlete_links",
  "vpr_athletes",
  "vpr_point_config",
  "private_pairing_rule_targets",
  "private_pairing_rule_audit_logs",
  "private_pairing_rules",
  "private_pairing_rule_sets",
  "ai_suggestions",
  "ai_workflow_checklists",
  "notifications",
  "notification_logs",
  "push_subscriptions",
  "qr_tokens",
  "checkins",
  "payment_events",
  "payment_transactions",
  "payments",
  "invoice_items",
  "invoices",
  "billing_events",
  "billing_audit_logs",
  "marketplace_orders",
  "marketplace_products",
  "webhook_events",
  "webhook_endpoints",
  "tenant_integration_settings",
  "integration_audit_logs",
  "api_logs",
  "api_keys",
  "api_clients",
  "idempotency_requests",
  "tournament_certifications",
  "tournament_match_live",
  "password_reset_tokens",
  "_phase19b_test_accounts",
  "subscriptions",
  "public_catalog_rankings",
  "public_catalog_tournaments",
  "public_catalog_courts",
  "court_engine_active_sessions",
  "court_engine_stores",
  "court_claim_requests",
  "user_cluster_assignments",
  "club_governance_assignments",
  "club_membership_requests",
  "club_membership_requests_v42",
  "club_members",
  "club_governance",
  "club_data_v3",
  "clubs",
  "athletes",
  "court_clusters",
  "tenant_subscriptions",
  "audit_logs",
];

function parseWipeTargets(sql) {
  const targets = [];
  const re =
    /(?:TRUNCATE\s+TABLE|DELETE\s+FROM)\s+([\s\S]*?);/gi;
  let m;
  while ((m = re.exec(sql))) {
    const chunk = m[1];
    const names = [...chunk.matchAll(/public\.([a-zA-Z0-9_]+)/g)].map(
      (x) => x[1]
    );
    targets.push(...names);
  }
  return targets;
}

function parseTruncateStatements(sql) {
  const stmts = [];
  const re = /TRUNCATE\s+TABLE\s+([\s\S]*?);/gi;
  let m;
  while ((m = re.exec(sql))) {
    const names = [...m[1].matchAll(/public\.([a-zA-Z0-9_]+)/g)].map(
      (x) => x[1]
    );
    stmts.push(new Set(names));
  }
  return stmts;
}

test("phase-04 package: destructive SQL files exist and forbid auth wipe", () => {
  const wipe = fs.readFileSync(WIPE_PATH, "utf8");
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
  const wipe = fs.readFileSync(WIPE_PATH, "utf8");
  assert.equal(/\bCASCADE\b/i.test(wipe), false);
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

test("phase-04 wipe expand5: historical residual FK hard-stop evidence retained", () => {
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
  assert.deepEqual(evidence.hardStop.furtherExpansionRequiredWithoutCascade, [
    "referee_device_sessions",
  ]);
});

test("phase-04 wipe: exact +6 expansion with no scope drift", () => {
  const wipe = fs.readFileSync(WIPE_PATH, "utf8");
  const targets = parseWipeTargets(wipe);
  const unique = new Set(targets);
  assert.equal(targets.length, unique.size, "duplicate wipe targets");

  for (const table of ORIGINAL_WIPE_TABLES) {
    assert.equal(unique.has(table), true, `missing original: ${table}`);
  }
  for (const table of APPROVED_6) {
    assert.equal(unique.has(table), true, `missing approved6: ${table}`);
  }

  const expected = new Set([...ORIGINAL_WIPE_TABLES, ...APPROVED_6]);
  const unexpected = [...unique].filter((t) => !expected.has(t));
  assert.deepEqual(unexpected, []);
  assert.equal(unique.size, expected.size);
  assert.equal(/\bCASCADE\b/i.test(wipe), false);
  assert.equal(/expuvcohlcjzvrrauvud/.test(wipe), false);
});

test("phase-04 wipe: FK closure complete evidence + connected components co-truncated", () => {
  const evidence = JSON.parse(
    fs.readFileSync(
      path.join(
        PHASE,
        "staging-rehearsal/evidence/09_ORDERED_WIPE_FK_CLOSURE_COMPLETE_2026-07-30.json"
      ),
      "utf8"
    )
  );
  assert.equal(
    evidence.marker,
    "PLATFORM_HARD_CUTOVER_01_ORDERED_WIPE_FK_CLOSURE_COMPLETE_2026-07-30"
  );
  assert.deepEqual(evidence.ownerDecision.approvedExpandTablesExact, APPROVED_6);
  assert.deepEqual(evidence.fkClosureFixedPoint.newlyDiscoveredOutsideApproved, []);
  assert.equal(evidence.fkClosureFixedPoint.unresolvedInboundCount, 0);
  assert.equal(evidence.manifestProof.missing, 0);
  assert.equal(evidence.manifestProof.unexpectedAdditions, 0);
  assert.equal(evidence.manifestProof.duplicate, 0);
  assert.equal(evidence.manifestProof.cascadeOccurrences, 0);
  assert.equal(evidence.mutations.database, 0);
  assert.equal(evidence.mutations.production, 0);

  const wipe = fs.readFileSync(WIPE_PATH, "utf8");
  const stmts = parseTruncateStatements(wipe);
  for (const component of evidence.connectedComponentsMultiTruncate) {
    const covered = stmts.some((stmt) =>
      component.tables.every((t) => stmt.has(t))
    );
    assert.equal(
      covered,
      true,
      `component not co-truncated: ${component.id}`
    );
  }

  const tt = stmts.find(
    (s) => s.has("referee_device_sessions") && s.has("referee_assignments")
  );
  assert.equal(Boolean(tt), true);

  const pilIdx = wipe.indexOf("TRUNCATE TABLE public.player_identity_links");
  const clubsIdx = wipe.indexOf("DELETE FROM public.clubs");
  assert.equal(pilIdx > -1, true);
  assert.equal(clubsIdx > pilIdx, true);
});
