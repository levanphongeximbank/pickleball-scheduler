/**
 * TEAM TOURNAMENT V6 — P0 roster identity hydration regression tests.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

import {
  computeTeamRosterStats,
} from "../src/features/team-tournament/engines/teamRosterEngine.js";
import {
  computeHydratedRosterStats,
  hydrateAllTeamRosters,
  hydrateTeamRoster,
  resolveRosterMemberIdentity,
  buildRosterAthleteIndex,
} from "../src/features/team-tournament/engines/teamRosterHydration.js";
import {
  buildHydratedTeamRosterReadModel,
} from "../src/features/team-tournament/services/teamTournamentService.js";
import {
  findAthleteInPool,
  resolveAthleteDisplayName,
} from "../src/features/team-tournament/services/teamTournamentAthletePoolService.js";
import { filterEligiblePlayersForDiscipline } from "../src/features/team-tournament/engines/lineupValidationEngine.js";
import { GENDER_REQUIREMENT } from "../src/features/team-tournament/constants.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function makePoolAthlete({
  athleteId,
  name,
  gender,
  rating = 3.5,
  profilePlayerId = null,
  legacyPlayerId = null,
  authUserId = null,
}) {
  return {
    id: athleteId,
    athleteId,
    pairingIdentityId: athleteId,
    name,
    displayName: name,
    gender,
    rating,
    level: rating,
    profilePlayerId,
    legacyPlayerId,
    authUserId,
    metadata: {
      profilePlayerId,
      legacyPlayerId,
      aliasIds: [profilePlayerId, legacyPlayerId].filter(Boolean),
    },
  };
}

const ATHLETE_POOL = [
  makePoolAthlete({
    athleteId: "ath-m1",
    name: "Nam One",
    gender: "Nam",
    rating: 4.0,
    profilePlayerId: "qa-mlp-test-nam-01",
    authUserId: "user-m1",
  }),
  makePoolAthlete({
    athleteId: "ath-m2",
    name: "Nam Two",
    gender: "male",
    rating: 3.8,
    profilePlayerId: "qa-mlp-test-nam-02",
    authUserId: "user-m2",
  }),
  makePoolAthlete({
    athleteId: "ath-f1",
    name: "Nu One",
    gender: "Nữ",
    rating: 3.6,
    profilePlayerId: "qa-mlp-test-nu-01",
    authUserId: "user-f1",
  }),
  makePoolAthlete({
    athleteId: "ath-f2",
    name: "Nu Two",
    gender: "female",
    rating: 3.7,
    legacyPlayerId: "blob-nu-02",
    authUserId: "user-f2",
  }),
];

const MLP_TEAM = {
  id: "team-alpha",
  name: "Alpha MLP",
  playerIds: [
    "qa-mlp-test-nam-01",
    "qa-mlp-test-nam-02",
    "qa-mlp-test-nu-01",
    "blob-nu-02",
  ],
  captainPlayerId: "qa-mlp-test-nam-01",
  deputyPlayerIds: ["qa-mlp-test-nu-01"],
};

describe("P0 roster hydration — identity mapper", () => {
  it("athletes.id lookup resolves directly", () => {
    const index = buildRosterAthleteIndex(ATHLETE_POOL);
    const resolved = resolveRosterMemberIdentity("ath-m1", index);
    assert.equal(resolved.ok, true);
    assert.equal(resolved.via, "athlete");
    assert.equal(resolved.athleteId, "ath-m1");
    assert.equal(resolved.athlete.name, "Nam One");
  });

  it("user_id fallback resolves athlete", () => {
    const index = buildRosterAthleteIndex(ATHLETE_POOL);
    const resolved = resolveRosterMemberIdentity("user-f2", index);
    assert.equal(resolved.ok, true);
    assert.equal(resolved.via, "alias");
    assert.equal(resolved.athleteId, "ath-f2");
  });

  it("user_id hint resolves when stored id misses", () => {
    const index = buildRosterAthleteIndex(ATHLETE_POOL);
    const resolved = resolveRosterMemberIdentity("unknown-stored", index, {
      userId: "user-m2",
    });
    assert.equal(resolved.ok, true);
    assert.equal(resolved.via, "user");
    assert.equal(resolved.athleteId, "ath-m2");
  });

  it("alias mismatch still hydrates via unique alias", () => {
    const hydrated = hydrateTeamRoster({
      team: {
        id: "t1",
        name: "T1",
        playerIds: ["qa-mlp-test-nam-01"],
      },
      athletePool: ATHLETE_POOL,
    });
    assert.equal(hydrated.members.length, 1);
    assert.equal(hydrated.members[0].resolved, true);
    assert.equal(hydrated.members[0].athleteId, "ath-m1");
    assert.equal(hydrated.members[0].displayName, "Nam One");
    assert.equal(hydrated.members[0].via, "alias");
  });

  it("missing identity is explicit — never silently dropped", () => {
    const hydrated = hydrateTeamRoster({
      team: {
        id: "t1",
        name: "T1",
        playerIds: ["ghost-player-99"],
        captainPlayerId: "ghost-player-99",
      },
      athletePool: ATHLETE_POOL,
    });
    assert.equal(hydrated.members.length, 1);
    assert.equal(hydrated.members[0].resolved, false);
    assert.match(hydrated.members[0].displayName, /thiếu identity/);
    assert.match(hydrated.members[0].diagnostic, /missing_identity/);
    assert.equal(hydrated.unresolvedCount, 1);
    assert.ok(hydrated.diagnostics.includes("missing_identity:ghost-player-99"));
  });

  it("teamMemberRows accept player_id + user_id", () => {
    const hydrated = hydrateTeamRoster({
      team: { id: "t1", name: "T1", playerIds: [] },
      teamMemberRows: [
        { player_id: "unknown-row", user_id: "user-f1", role: "member" },
      ],
      athletePool: ATHLETE_POOL,
    });
    assert.equal(hydrated.members.length, 1);
    assert.equal(hydrated.members[0].resolved, true);
    assert.equal(hydrated.members[0].athleteId, "ath-f1");
    assert.equal(hydrated.members[0].via, "user");
  });
});

describe("P0 roster hydration — 4 members / gender / captain", () => {
  it("4 stored members render as 4 hydrated athletes", () => {
    const hydrated = hydrateTeamRoster({
      team: MLP_TEAM,
      athletePool: ATHLETE_POOL,
    });
    assert.equal(hydrated.members.length, 4);
    assert.equal(hydrated.unresolvedCount, 0);
    assert.deepEqual(
      hydrated.members.map((m) => m.athleteId).sort(),
      ["ath-f1", "ath-f2", "ath-m1", "ath-m2"]
    );
    assert.ok(hydrated.members.every((m) => m.displayName && !m.displayName.includes("thiếu")));
    assert.ok(hydrated.members.every((m) => m.rating != null));
  });

  it("gender counters are 2 male + 2 female", () => {
    const stats = computeTeamRosterStats(MLP_TEAM, ATHLETE_POOL);
    assert.equal(stats.total, 4);
    assert.equal(stats.males, 2);
    assert.equal(stats.females, 2);

    const hydrated = hydrateTeamRoster({
      team: MLP_TEAM,
      athletePool: ATHLETE_POOL,
    });
    const hydratedStats = computeHydratedRosterStats(hydrated);
    assert.equal(hydratedStats.total, stats.total);
    assert.equal(hydratedStats.males, 2);
    assert.equal(hydratedStats.females, 2);
  });

  it("captain remains linked to a rendered member", () => {
    const hydrated = hydrateTeamRoster({
      team: MLP_TEAM,
      athletePool: ATHLETE_POOL,
    });
    const captain = hydrated.members.find((m) => m.isCaptain);
    assert.ok(captain);
    assert.equal(captain.athleteId, "ath-m1");
    assert.equal(captain.displayName, "Nam One");
    assert.equal(captain.storedPlayerId, "qa-mlp-test-nam-01");

    const deputy = hydrated.members.find((m) => m.isDeputy);
    assert.ok(deputy);
    assert.equal(deputy.athleteId, "ath-f1");
  });

  it("badge count equals rendered member count", () => {
    const hydrated = hydrateTeamRoster({
      team: MLP_TEAM,
      athletePool: ATHLETE_POOL,
    });
    const stats = computeHydratedRosterStats(hydrated);
    assert.equal(stats.total, hydrated.members.length);
    assert.equal(stats.total, MLP_TEAM.playerIds.length);
  });

  it("refresh preserves the same roster (re-hydrate is stable)", () => {
    const first = hydrateTeamRoster({
      team: MLP_TEAM,
      athletePool: ATHLETE_POOL,
    });
    const second = hydrateTeamRoster({
      team: structuredClone(MLP_TEAM),
      athletePool: ATHLETE_POOL.map((row) => ({ ...row })),
    });
    assert.deepEqual(
      first.members.map((m) => ({
        athleteId: m.athleteId,
        displayName: m.displayName,
        isCaptain: m.isCaptain,
      })),
      second.members.map((m) => ({
        athleteId: m.athleteId,
        displayName: m.displayName,
        isCaptain: m.isCaptain,
      }))
    );
  });
});

describe("P0 roster hydration — shared consumers", () => {
  it("findAthleteInPool / resolveAthleteDisplayName use shared mapper", () => {
    const athlete = findAthleteInPool(ATHLETE_POOL, "qa-mlp-test-nam-02");
    assert.equal(athlete?.athleteId, "ath-m2");
    assert.equal(
      resolveAthleteDisplayName(ATHLETE_POOL, "blob-nu-02"),
      "Nu Two"
    );
    assert.match(
      resolveAthleteDisplayName(ATHLETE_POOL, "missing-x"),
      /thiếu identity/
    );
  });

  it("service read model hydrates all teams", () => {
    const teamData = {
      teams: [
        MLP_TEAM,
        {
          id: "team-beta",
          name: "Beta",
          playerIds: ["ath-m1", "missing-beta"],
          captainPlayerId: "ath-m1",
        },
      ],
    };
    const readModel = buildHydratedTeamRosterReadModel(teamData, ATHLETE_POOL);
    assert.equal(readModel.teams.length, 2);
    assert.equal(readModel.teams[0].members.length, 4);
    assert.equal(readModel.teams[1].members.length, 2);
    assert.equal(readModel.teams[1].unresolvedCount, 1);
    assert.equal(readModel.memberCount, 6);
    assert.equal(readModel.unresolvedCount, 1);

    const all = hydrateAllTeamRosters(teamData, ATHLETE_POOL);
    assert.equal(all[0].members.length, readModel.teams[0].members.length);
  });

  it("lineup eligibility uses hydrated roster (alias playerIds)", () => {
    const eligible = filterEligiblePlayersForDiscipline({
      team: MLP_TEAM,
      discipline: {
        id: "md",
        genderRequirement: GENDER_REQUIREMENT.MALE,
      },
      players: ATHLETE_POOL,
    });
    assert.equal(eligible.length, 2);
    assert.ok(eligible.every((p) => ["Nam One", "Nam Two"].includes(p.name)));
    assert.ok(
      eligible.every((p) => MLP_TEAM.playerIds.includes(String(p.id))),
      "eligible id stays stored cloud player_id for membership contract"
    );
  });

  it("TeamRosterPanel, TeamPortal and TeamRefereePortal use hydrateTeamRoster", () => {
    const files = [
      "src/components/tournament/TeamRosterPanel.jsx",
      "src/pages/tournament/TeamPortal.jsx",
      "src/pages/tournament/TeamRefereePortal.jsx",
      "src/features/team-tournament/services/teamTournamentService.js",
    ];
    for (const rel of files) {
      const source = readFileSync(path.join(ROOT, rel), "utf8");
      assert.match(
        source,
        /hydrateTeamRoster/,
        `${rel} must use shared hydrateTeamRoster`
      );
      assert.doesNotMatch(
        source,
        /playerById\.get\(String\(playerId\)\)\s*\n\s*\.filter\(Boolean\)/,
        `${rel} must not silently drop unmatched roster ids`
      );
    }
  });

  it("TeamRosterPanel no longer silently filters unresolved members", () => {
    const source = readFileSync(
      path.join(ROOT, "src/components/tournament/TeamRosterPanel.jsx"),
      "utf8"
    );
    assert.match(source, /hydrateTeamRoster\(\{ team, athletePool \}\)/);
    assert.match(source, /teamMembers\.map/);
    assert.match(source, /thiếu identity/);
    assert.doesNotMatch(
      source,
      /team\.playerIds\s*\n\s*\.map\(\(playerId\) => playerById\.get/
    );
  });
});
