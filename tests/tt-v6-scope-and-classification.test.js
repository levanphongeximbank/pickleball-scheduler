import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  ensureRulesHaveScopeIds,
  resolveLivePairingScope,
} from "../src/features/private-pairing-rules/runtime/resolveLivePairingScope.js";
import { prepareLivePrivatePairingOptions } from "../src/features/private-pairing-rules/runtime/prepareLivePrivatePairingOptions.js";
import { FEATURE_FLAG_KEYS } from "../src/features/private-pairing-rules/constants/codes.js";
import { runTeamFormationWithCanonicalAdapter } from "../src/features/competition-core/formation/adapters/teamFormationAdapter.js";
import { FORMAT_PRESET } from "../src/features/team-tournament/constants.js";
import { COMPETITION_CLASS } from "../src/features/private-pairing-rules/constants/enums.js";
import { aggregateToTournamentView } from "../src/features/team-tournament/ui/teamTournamentUiOrchestrator.js";
import { mapTournamentToAggregate } from "../src/features/team-tournament/repositories/teamTournamentRepositoryAggregate.js";
import { getPlayerGenderKey } from "../src/models/player.js";

const FLAGS_ON = {
  [FEATURE_FLAG_KEYS.PRIVATE_PAIRING_RULES]: "true",
  [FEATURE_FLAG_KEYS.UNIFIED_CONSTRAINT_ENGINE]: "true",
};

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

describe("TT-V6 live pairing scope resolution", () => {
  it("tournament scope prefers tournamentId; club uses tournament.clubId over stale activeClubId", () => {
    const scope = resolveLivePairingScope({
      tournament: {
        id: "tour-1",
        clubId: "club-host",
        tenantId: "venue-staging-a",
      },
      clubId: "club-stale-prop",
      clubFromQuery: "club-from-query",
      activeClubId: "club-active-stale",
      tenantId: null,
    });

    assert.equal(scope.ok, true);
    assert.equal(scope.tournamentId, "tour-1");
    assert.equal(scope.clubId, "club-host");
    assert.equal(scope.tenantId, "venue-staging-a");
  });

  it("URL ?club= is fallback when tournament.clubId missing", () => {
    const scope = resolveLivePairingScope({
      tournamentId: "tour-2",
      clubFromQuery: "club-query",
      activeClubId: "club-active",
      tenantId: "venue-staging-a",
    });
    assert.equal(scope.clubId, "club-query");
  });

  it("missing tenant returns explicit SCOPE diagnostic", () => {
    const scope = resolveLivePairingScope({
      tournamentId: "tour-3",
      clubId: "club-a",
    });
    assert.equal(scope.ok, false);
    assert.ok(scope.missing.includes("tenantId"));
    assert.match(scope.diagnosticMessage, /tenantId/);
  });

  it("scopeId is always present on rules before resolution", () => {
    const fixed = ensureRulesHaveScopeIds(
      [
        { id: "r1", scopeType: "CLUB", scopeId: null, constraintType: "SAME_TEAM" },
        { id: "r2", scopeType: "CLUB", scopeId: "club-a", constraintType: "SAME_TEAM" },
      ],
      { scopeType: "CLUB", clubId: "club-a" }
    );
    assert.equal(fixed[0].scopeId, "club-a");
    assert.equal(fixed[1].scopeId, "club-a");
  });

  it("prepareLive fails with Vietnamese SCOPE_ID_REQUIRED when tenant missing (flags ON)", async () => {
    const result = await prepareLivePrivatePairingOptions({
      tournamentId: "tour-x",
      clubId: "club-x",
      competitionClass: COMPETITION_CLASS.INTERNAL,
      envSource: FLAGS_ON,
    });
    assert.equal(result.ok, false);
    assert.equal(result.error.code, "SCOPE_ID_REQUIRED");
    assert.match(result.error.message, /tenantId|phạm vi/i);
  });

  it("TEST MLP 4M+4F produces 2 teams / waiting 0", () => {
    const players = [
      { id: "m1", name: "TEST-NAM-01", gender: "male", rating: 4 },
      { id: "m2", name: "TEST-NAM-02", gender: "male", rating: 3.8 },
      { id: "m3", name: "TEST-NAM-03", gender: "male", rating: 3.5 },
      { id: "m4", name: "TEST-NAM-04", gender: "male", rating: 3.2 },
      { id: "f1", name: "TEST-NU-01", gender: "female", rating: 4 },
      { id: "f2", name: "TEST-NU-02", gender: "female", rating: 3.8 },
      { id: "f3", name: "TEST-NU-03", gender: "female", rating: 3.5 },
      { id: "f4", name: "TEST-NU-04", gender: "female", rating: 3.2 },
    ];
    const result = runTeamFormationWithCanonicalAdapter({
      players,
      selectedPlayerIds: players.map((p) => p.id),
      teamCount: 2,
      formatPreset: FORMAT_PRESET.MLP_4,
      randomFn: () => 0.42,
      envSource: { VITE_ENABLE_CANONICAL_FORMATION_RUNTIME: "false" },
    });
    assert.equal(result.teams.length, 2);
    assert.equal((result.waitingPlayerIds || []).length, 0);
    for (const team of result.teams) {
      const members = team.playerIds.map((id) => players.find((p) => p.id === id));
      const males = members.filter((p) => getPlayerGenderKey(p.gender) === "male");
      const females = members.filter((p) => getPlayerGenderKey(p.gender) === "female");
      assert.equal(males.length, 2);
      assert.equal(females.length, 2);
    }
  });

  it("TeamAiPairingDialog passes tenantId into prepareLive", () => {
    const src = readFileSync(
      path.join(ROOT, "src/components/tournament/team/TeamAiPairingDialog.jsx"),
      "utf8"
    );
    assert.match(src, /tenantId/);
    assert.match(src, /prepareLivePrivatePairingOptions\(\{/);
    assert.match(src, /tournament\?\.clubId/);
  });
});

describe("TT-V6 classification persistence contract", () => {
  it("aggregate + view promote tournamentLevel from header settings", () => {
    const aggregate = mapTournamentToAggregate(
      {
        id: "tour-c",
        clubId: "club-a",
        tenantId: "venue-staging-a",
        status: "draft",
        settings: {
          tournamentLevel: "club",
          certificationStatus: "not_required",
          rankingEnabled: false,
        },
        teamData: { teams: [], matchups: [], settings: { formatPreset: "mlp_4" } },
      },
      "cloud"
    );
    assert.equal(aggregate.tournamentLevel, "club");
    const view = aggregateToTournamentView(aggregate);
    assert.equal(view.tournamentLevel, "club");
  });

  it("TournamentVprPanel uses team cloud classification writer for team mode", () => {
    const src = readFileSync(
      path.join(ROOT, "src/features/vpr-ranking/components/TournamentVprPanel.jsx"),
      "utf8"
    );
    assert.match(src, /updateTeamTournamentClassification/);
    assert.match(src, /cloudSynced/);
    assert.match(src, /isTeamTournamentMode/);
  });

  it("cloudEnsureTournamentHeader merges tournamentLevel into settings", () => {
    const src = readFileSync(
      path.join(ROOT, "src/features/team-tournament/services/teamTournamentCloudSync.js"),
      "utf8"
    );
    assert.match(src, /baseSettings\.tournamentLevel/);
    assert.match(src, /tournamentLevel:/);
  });
});
