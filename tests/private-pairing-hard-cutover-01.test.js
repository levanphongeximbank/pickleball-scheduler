import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import {
  RUNTIME_AUTHORITY_MATRIX,
  getRuntimeAuthorityEntry,
  HARD_CUTOVER_FLAG,
  COMPETITION_REMOTE_SSOT_FLAG,
  listRuntimeAuthorityDomains,
} from "../src/features/platform-hard-cutover/runtimeAuthorityMatrix.js";
import {
  assertPrivatePairingLegacyPickerAllowed,
  assertPrivatePairingSilentRatingDefaultAllowed,
  LEGACY_AUTHORITY_ERROR,
} from "../src/features/platform-hard-cutover/legacyAuthorityPolicy.js";
import { createPrivatePairingPlayerPickerAdapter } from "../src/features/private-pairing-rules/ui/privatePairingPlayerPickerAdapter.js";
import {
  generateTeamPairingCandidates,
  resolvePrivatePairingPlayerRating,
  computeBalanceScore,
  PRIVATE_PAIRING_RUNTIME_CODE,
  PRIVATE_PAIRING_RPC,
  PRIVATE_PAIRING_TABLES,
  loadActiveRulesForLiveScope,
  setPrivatePairingRpcClientForTests,
  FEATURE_FLAG_KEYS,
  COMPETITION_CLASS,
} from "../src/features/private-pairing-rules/index.js";
import { LOCAL_DEFAULT_CLUB_ID } from "../src/features/club/repositories/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const HC_ON = { [HARD_CUTOVER_FLAG]: "true" };
const HC_OFF = { [HARD_CUTOVER_FLAG]: "false" };

const FLAGS_ON = {
  [FEATURE_FLAG_KEYS.PRIVATE_PAIRING_RULES]: "true",
  [FEATURE_FLAG_KEYS.UNIFIED_CONSTRAINT_ENGINE]: "true",
};

test("authority matrix registers private_pairing_rules with exact writer/reader contract", () => {
  const entry = getRuntimeAuthorityEntry("private_pairing_rules");
  assert.ok(entry);
  assert.equal(entry.allowedFlag, HARD_CUTOVER_FLAG);
  assert.equal(entry.failClosedError, "PRIVATE_PAIRING_LEGACY_PICKER_FORBIDDEN");
  assert.ok(entry.forbiddenFallback.includes("legacy_blob picker (loadPlayersForClub / registry)"));
  assert.ok(entry.forbiddenFallback.some((f) => f.includes("silent rating=3.5")));
  assert.match(entry.productionAdapter, /RPC/);
  assert.match(entry.expectedBackend, /private_pairing_rule_sets/);
  assert.ok(listRuntimeAuthorityDomains().includes("private_pairing_rules"));
  assert.equal(
    new Set(listRuntimeAuthorityDomains()).size,
    RUNTIME_AUTHORITY_MATRIX.length
  );
});

test("legacy policy: private pairing picker + silent rating forbidden under hard cutover", () => {
  const picker = assertPrivatePairingLegacyPickerAllowed(HC_ON);
  assert.equal(picker.ok, false);
  assert.equal(picker.code, LEGACY_AUTHORITY_ERROR.PRIVATE_PAIRING_LEGACY_PICKER_FORBIDDEN);

  const open = assertPrivatePairingLegacyPickerAllowed(HC_OFF);
  assert.equal(open.ok, true);

  const rating = assertPrivatePairingSilentRatingDefaultAllowed(HC_ON);
  assert.equal(rating.ok, false);
  assert.equal(
    rating.code,
    LEGACY_AUTHORITY_ERROR.PRIVATE_PAIRING_SILENT_RATING_DEFAULT_FORBIDDEN
  );
});

test("picker hard cutover ON + canonical OFF fails closed (no legacy_blob)", async () => {
  const adapter = createPrivatePairingPlayerPickerAdapter({
    isClubCanonical: () => false,
    isPlayerCanonical: () => false,
    isHardCutover: () => true,
    legacyListClubs: () => [{ id: "club-local", name: "Local", tenantId: "t1" }],
    legacyLoadPlayers: () => [{ id: "blob-1", name: "Blob Player" }],
  });

  const clubs = await adapter.listSourceClubs({ tenantId: "t1" });
  assert.equal(clubs.ok, false);
  assert.equal(clubs.code, LEGACY_AUTHORITY_ERROR.PRIVATE_PAIRING_LEGACY_PICKER_FORBIDDEN);
  assert.equal(clubs.source, "forbidden");
  assert.equal(clubs.legacyBlocked, true);

  const players = await adapter.listPickerPlayers({ clubId: "club-local" });
  assert.equal(players.ok, false);
  assert.equal(players.code, LEGACY_AUTHORITY_ERROR.PRIVATE_PAIRING_LEGACY_PICKER_FORBIDDEN);
  assert.equal(players.source, "forbidden");
});

test("picker hard cutover OFF + canonical OFF keeps legacy_blob compatibility", async () => {
  const adapter = createPrivatePairingPlayerPickerAdapter({
    isClubCanonical: () => false,
    isPlayerCanonical: () => false,
    isHardCutover: () => false,
    legacyListClubs: () => [
      { id: "club-local", name: "Local", tenantId: "t1" },
      { id: LOCAL_DEFAULT_CLUB_ID, name: "CLB Mặc định", isDefault: true },
    ],
    legacyLoadPlayers: () => [{ id: "blob-1", name: "Blob Player" }],
  });

  const clubs = await adapter.listSourceClubs({ tenantId: "t1" });
  assert.equal(clubs.ok, true);
  assert.equal(clubs.source, "legacy_blob");
  assert.ok(!clubs.data.some((c) => c.id === LOCAL_DEFAULT_CLUB_ID));

  const players = await adapter.listPickerPlayers({ clubId: "club-local" });
  assert.equal(players.ok, true);
  assert.equal(players.source, "legacy_blob");
  assert.equal(players.options[0].id, "blob-1");
});

test("missing rating: hard cutover OFF still silently defaults to 3.5", () => {
  const resolved = resolvePrivatePairingPlayerRating(
    { id: "p1", name: "No Rating" },
    { hardCutover: false }
  );
  assert.equal(resolved.ok, true);
  assert.equal(resolved.rating, 3.5);
  assert.equal(resolved.defaulted, true);

  const generation = generateTeamPairingCandidates({
    hardCutover: false,
    players: [
      { id: "a", name: "A" },
      { id: "b", name: "B" },
      { id: "c", name: "C" },
      { id: "d", name: "D" },
    ],
    teamSize: 2,
    seed: 1,
    maxCandidates: 4,
  });
  assert.equal(generation.ok, true);
  assert.ok(generation.candidates.length >= 1);
  const usedIds = generation.candidates[0].teams.flatMap((t) => t.playerIds);
  assert.ok(usedIds.every((id) => ["a", "b", "c", "d"].includes(id)));
  // Silent legacy default: avgLevel computed with 3.5 for every unrated player.
  assert.equal(
    generation.candidates[0].teams[0].avgLevel,
    3.5
  );
});

test("missing rating: hard cutover ON excludes / fail-closed without inventing 3.5", () => {
  const resolved = resolvePrivatePairingPlayerRating(
    { id: "p1", name: "No Rating" },
    { hardCutover: true }
  );
  assert.equal(resolved.ok, false);
  assert.equal(resolved.rating, null);
  assert.equal(resolved.code, PRIVATE_PAIRING_RUNTIME_CODE.MISSING_PLAYER_RATING);

  const generation = generateTeamPairingCandidates({
    hardCutover: true,
    players: [
      { id: "a", name: "A", rating: 4.0 },
      { id: "b", name: "B" },
      { id: "c", name: "C", rating: 3.0 },
      { id: "d", name: "D", level: 3.2 },
    ],
    teamSize: 2,
    seed: 1,
    maxCandidates: 8,
  });
  assert.equal(generation.ok, true);
  assert.ok(generation.excludedPlayerIds.includes("b"));
  assert.ok(
    generation.warnings.some((w) => w.code === PRIVATE_PAIRING_RUNTIME_CODE.MISSING_PLAYER_RATING)
  );
  for (const candidate of generation.candidates) {
    for (const team of candidate.teams) {
      assert.ok(!team.playerIds.includes("b"));
    }
  }
  // Eligible ratings are 4.0 / 3.0 / 3.2 — never invent 3.5 for excluded player.
  assert.ok(
    !generation.warnings.some((w) => w.code === PRIVATE_PAIRING_RUNTIME_CODE.MISSING_RATING_LEGACY_DEFAULT)
  );
  assert.ok(generation.candidates.every((c) =>
    c.teams.every((t) => !t.playerIds.includes("b"))
  ));

  const failClosed = generateTeamPairingCandidates({
    hardCutover: true,
    players: [
      { id: "a", name: "A" },
      { id: "b", name: "B" },
    ],
    teamSize: 2,
    seed: 1,
  });
  assert.equal(failClosed.ok, false);
  assert.equal(failClosed.errorCode, PRIVATE_PAIRING_RUNTIME_CODE.INSUFFICIENT_RATED_PLAYERS);
  assert.equal(failClosed.candidates.length, 0);
});

test("computeBalanceScore hard cutover fail-closed on missing rating", () => {
  const teams = [
    { members: [{ id: "a", rating: 4 }, { id: "b" }] },
    { members: [{ id: "c", rating: 3 }, { id: "d", rating: 3 }] },
  ];
  assert.equal(computeBalanceScore(teams, {}, { hardCutover: true }), 0);
  assert.ok(computeBalanceScore(teams, {}, { hardCutover: false }) > 0);
});

test("runtime rule loading still uses canonical GET_ACTIVE_FOR_SCOPE RPC", async () => {
  assert.equal(
    PRIVATE_PAIRING_RPC.GET_ACTIVE_FOR_SCOPE,
    "private_pairing_get_active_rules_for_scope"
  );
  let seen = null;
  setPrivatePairingRpcClientForTests({
    rpc: async (name, args) => {
      seen = { name, args };
      return {
        data: {
          ok: true,
          rule_set: {
            id: "rs1",
            version: 1,
            scope_type: "CLUB",
            scope_id: "club-A",
            status: "active",
          },
          rules: [
            {
              id: "db-rule-1",
              constraint_type: "must_not_partner",
              severity: "hard",
              weight: null,
              primary_player_id: "p1",
              target_player_ids: ["p2"],
              relation_mode: "ANY_OF",
              visibility: "private",
              reason_category: "OTHER",
              reason_text: "ops",
              active: true,
            },
          ],
        },
        error: null,
      };
    },
  });

  const loaded = await loadActiveRulesForLiveScope({
    clubId: "club-A",
    competitionClass: COMPETITION_CLASS.DAILY_PLAY,
    envSource: FLAGS_ON,
  });
  assert.equal(loaded.ok, true);
  assert.equal(seen?.name, PRIVATE_PAIRING_RPC.GET_ACTIVE_FOR_SCOPE);
  assert.equal(loaded.rules.length, 1);
  setPrivatePairingRpcClientForTests(null);
});

test("admin CRUD surface remains RPC-only (repository + tables contract)", () => {
  const repo = readFileSync(
    join(root, "src/features/private-pairing-rules/repository/privatePairingRulesRepository.js"),
    "utf8"
  );
  assert.match(repo, /PRIVATE_PAIRING_RPC\.CREATE_RULE/);
  assert.match(repo, /PRIVATE_PAIRING_RPC\.UPDATE_RULE/);
  assert.match(repo, /PRIVATE_PAIRING_RPC\.GET_ACTIVE_FOR_SCOPE/);
  assert.doesNotMatch(repo, /\.from\(\s*["']private_pairing_rules["']/);
  assert.ok(PRIVATE_PAIRING_TABLES.includes("private_pairing_rules"));
  assert.equal(PRIVATE_PAIRING_TABLES.length, 4);
});

test("competition boundary: private_pairing_rules domain is distinct from competition_match_result", () => {
  const pairing = getRuntimeAuthorityEntry("private_pairing_rules");
  const competition = getRuntimeAuthorityEntry("competition_match_result");
  assert.ok(pairing);
  assert.ok(competition);
  assert.notEqual(pairing.domain, competition.domain);
  assert.equal(competition.allowedFlag, COMPETITION_REMOTE_SSOT_FLAG);
  assert.notEqual(pairing.failClosedError, competition.failClosedError);
  assert.doesNotMatch(pairing.expectedBackend, /competition_ssot/);
  assert.doesNotMatch(
    readFileSync(
      join(root, "src/features/private-pairing-rules/repository/privatePairingRulesRepository.js"),
      "utf8"
    ),
    /competition_ssot_finalize_match_result/
  );
});

test("docs: first-use reseed + staging acceptance markers exist", () => {
  const reseed = readFileSync(
    join(root, "docs/v5/PRIVATE_PAIRING_HARD_CUTOVER_01_FIRST_USE_RESEED.md"),
    "utf8"
  );
  const staging = readFileSync(
    join(root, "docs/v5/PRIVATE_PAIRING_HARD_CUTOVER_01_STAGING_ACCEPTANCE.md"),
    "utf8"
  );
  assert.match(reseed, /PRIVATE_PAIRING_HARD_CUTOVER_01_FIRST_USE_RESEED/);
  assert.match(staging, /PRIVATE_PAIRING_HARD_CUTOVER_01_STAGING_ACCEPTANCE_READY/);
  assert.match(staging, /No Production mutation/);
  assert.match(staging, /Owner GO/);
});

test("SUPER_ADMIN route + UI gate remain fail-closed for unauthorized roles", () => {
  const router = readFileSync(join(root, "src/router.jsx"), "utf8");
  assert.match(router, /path="\/admin\/ai-pairing\/private-rules"/);
  assert.match(router, /SuperAdminRouteGuard/);
  assert.match(router, /PrivatePairingRulesAdminPage/);

  const page = readFileSync(
    join(root, "src/pages/admin/PrivatePairingRulesAdminPage.jsx"),
    "utf8"
  );
  assert.match(page, /PrivatePairingRulesAdminView/);

  const view = readFileSync(
    join(root, "src/features/private-pairing-rules/components/PrivatePairingRulesAdminView.jsx"),
    "utf8"
  );
  assert.match(view, /SuperAdminFeatureGate/);
  assert.match(view, /403_FORBIDDEN/);

  const gate = readFileSync(
    join(root, "src/features/pairing-constraints/components/SuperAdminFeatureGate.jsx"),
    "utf8"
  );
  assert.match(gate, /!rbacEnabled \|\| !isSuperAdmin/);

  const sql = readFileSync(
    join(root, "docs/v5/PHASE_PRIVATE_PAIRING_RULES_V2_PR4.sql"),
    "utf8"
  );
  assert.match(sql, /pairing\.private_rules\.manage/);
  assert.match(sql, /is_super_admin\(\)/);
  assert.doesNotMatch(sql, /grant insert on public\.private_pairing_/i);
});

test("simulation remains read-only and does not write competition finalized results", () => {
  const sim = readFileSync(
    join(root, "src/features/private-pairing-rules/simulation/simulatePrivatePairing.js"),
    "utf8"
  );
  assert.match(sim, /Does NOT write tournaments, matches, lineups/);
  assert.match(sim, /readOnly:\s*true/);
  assert.doesNotMatch(sim, /competition_ssot_finalize_match_result/);
  assert.doesNotMatch(sim, /tournament_match_live/);
  assert.doesNotMatch(sim, /\.from\(\s*["']private_pairing_rules["']/);

  const rating = getRuntimeAuthorityEntry("player_rating");
  assert.ok(rating);
  assert.ok(rating.forbiddenFallback.includes("competition Elo as public rating"));
});
