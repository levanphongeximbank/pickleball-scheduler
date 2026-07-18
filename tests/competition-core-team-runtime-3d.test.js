import test from "node:test";
import assert from "node:assert/strict";

import {
  createTeamResolver,
  createRosterResolver,
  createTeamIdentityLookup,
  createRosterIdentityLookup,
  createInMemoryTeamPersistencePort,
  createInMemoryRosterPersistencePort,
  mapLegacyTeamToCompetitionTeam,
  mapLegacyRosterToCompetitionRoster,
  buildTeamIdentityKey,
  buildRosterIdentityKey,
  buildRosterMemberIdentityKey,
  createTeamIdentity,
  createRosterIdentity,
  TEAM_RUNTIME_ERROR_CODE,
  TEAM_ADAPTER_ID,
  ROSTER_ADAPTER_ID,
  TEAM_SOURCE_TYPE,
} from "../src/features/competition-core/teams/index.js";
import { PARTICIPANT_REFERENCE_KIND } from "../src/features/competition-core/participants/enums/identityKinds.js";
import {
  COMPETITION_TEAM_STATUS,
  COMPETITION_ROSTER_STATUS,
} from "../src/features/competition-core/participants/enums/statuses.js";

test("3D team resolve: valid legacy team mapping", async () => {
  const resolver = createTeamResolver();
  const source = {
    id: "team-1",
    name: "Alpha",
    status: "active",
    playerIds: ["p-1", "p-2"],
    captainPlayerId: "p-1",
    deputyPlayerIds: ["p-2"],
    seed: 3,
  };
  const result = await resolver.resolve({
    competitionId: "comp-1",
    source,
  });

  assert.equal(result.ok, true);
  assert.equal(result.adapterId, TEAM_ADAPTER_ID.LEGACY);
  assert.equal(result.team.id, "team-1");
  assert.equal(result.team.name, "Alpha");
  assert.equal(result.team.status, COMPETITION_TEAM_STATUS.ACTIVE);
  assert.equal(result.team.seed, 3);
  assert.equal(result.team.captainRef?.id, "p-1");
  assert.equal(result.team.deputyRefs.length, 1);
  assert.equal(
    result.identity.key,
    buildTeamIdentityKey({ competitionId: "comp-1", stableTeamId: "team-1" })
  );
  assert.equal(result.team.identityKey, result.identity.key);
  assert.equal(source.name, "Alpha");
  assert.equal(Object.keys(source).includes("identityKey"), false);
});

test("3D roster resolve: valid legacy roster mapping", async () => {
  const resolver = createRosterResolver();
  const result = await resolver.resolve({
    competitionId: "comp-1",
    source: {
      id: "team-9",
      name: "Bravo",
      playerIds: ["a", "b"],
      captainPlayerId: "a",
      locked: true,
      lockedAt: "2026-01-02T00:00:00.000Z",
    },
  });

  assert.equal(result.ok, true);
  assert.equal(result.adapterId, ROSTER_ADAPTER_ID.LEGACY);
  assert.equal(result.roster.teamId, "team-9");
  assert.equal(result.roster.id, "roster:team-9");
  assert.equal(result.roster.status, COMPETITION_ROSTER_STATUS.ROSTER_LOCKED);
  assert.equal(result.roster.members.length, 2);
  assert.equal(result.roster.members[0].role, "captain");
  assert.equal(result.roster.amendments.length, 0);
  assert.equal(
    result.identity.key,
    buildRosterIdentityKey({ competitionId: "comp-1", teamId: "team-9" })
  );
});

test("3D roster member identity is deterministic (no array index)", () => {
  const key = buildRosterMemberIdentityKey({
    competitionId: "comp-1",
    teamId: "team-9",
    person: { kind: PARTICIPANT_REFERENCE_KIND.PLAYER_PROFILE, id: "a" },
  });
  assert.equal(
    key,
    "comp-1::ROSTER_MEMBER::team-9::PLAYER_PROFILE:a"
  );
});

test("3D identity: team key frozen and display-name independent", () => {
  const identity = createTeamIdentity({
    competitionId: "c",
    stableTeamId: "team-1",
  });
  assert.equal(identity.key, "c::TEAM::team-1");
  assert.throws(() => {
    // @ts-expect-error frozen
    identity.key = "mutated";
  });
  assert.equal(
    buildTeamIdentityKey({ competitionId: "c", stableTeamId: "team-1" }),
    buildTeamIdentityKey({ competitionId: "c", stableTeamId: "team-1" })
  );
});

test("3D identity: roster key formula Owner-locked", () => {
  const identity = createRosterIdentity({
    competitionId: "c",
    teamId: "t1",
  });
  assert.equal(identity.key, "c::ROSTER::t1");
});

test("3D resolve: deterministic identity stable across resolves", async () => {
  const teamResolver = createTeamResolver({
    identityLookup: createTeamIdentityLookup(),
  });
  const source = { id: "team-stable", name: "Stable", playerIds: ["p-1"] };
  const a = await teamResolver.resolve({ competitionId: "comp-1", source });
  const b = await teamResolver.resolve({ competitionId: "comp-1", source });
  assert.equal(a.ok, true);
  assert.equal(b.ok, true);
  assert.equal(a.identity.key, b.identity.key);
});

test("3D resolve: team identity collision refuses overwrite", async () => {
  const lookup = createTeamIdentityLookup();
  const resolver = createTeamResolver({ identityLookup: lookup });
  const first = await resolver.resolve({
    competitionId: "comp-1",
    source: { id: "team-1", name: "A", status: "active" },
  });
  assert.equal(first.ok, true);
  const second = await resolver.resolve({
    competitionId: "comp-1",
    source: { id: "team-1", name: "B", status: "withdrawn" },
  });
  assert.equal(second.ok, false);
  assert.equal(second.error.code, TEAM_RUNTIME_ERROR_CODE.TEAM_IDENTITY_COLLISION);
});

test("3D resolve: roster identity collision refuses overwrite", async () => {
  const lookup = createRosterIdentityLookup();
  const resolver = createRosterResolver({ identityLookup: lookup });
  const first = await resolver.resolve({
    competitionId: "comp-1",
    source: { id: "team-1", playerIds: ["p-1"], locked: false },
  });
  assert.equal(first.ok, true);
  const second = await resolver.resolve({
    competitionId: "comp-1",
    source: { id: "team-1", playerIds: ["p-1", "p-2"], locked: true },
  });
  assert.equal(second.ok, false);
  assert.equal(second.error.code, TEAM_RUNTIME_ERROR_CODE.ROSTER_IDENTITY_COLLISION);
});

test("3D resolve: duplicate roster member identity fails", async () => {
  const resolver = createRosterResolver();
  const result = await resolver.resolve({
    competitionId: "comp-1",
    source: {
      id: "team-dup",
      playerIds: ["p-1", "p-1"],
    },
  });
  assert.equal(result.ok, false);
  assert.equal(
    result.error.code,
    TEAM_RUNTIME_ERROR_CODE.ROSTER_MEMBER_IDENTITY_COLLISION
  );
});

test("3D resolve: unsupported team status", async () => {
  const resolver = createTeamResolver();
  const result = await resolver.resolve({
    competitionId: "comp-1",
    source: { id: "team-1", name: "X", status: "mystery-status" },
  });
  assert.equal(result.ok, false);
  assert.equal(result.error.code, TEAM_RUNTIME_ERROR_CODE.UNSUPPORTED_TEAM_STATUS);
});

test("3D resolve: missing competitionId", async () => {
  const resolver = createTeamResolver();
  const result = await resolver.resolve({
    competitionId: "",
    source: { id: "team-1", name: "X" },
  });
  assert.equal(result.ok, false);
  assert.equal(result.error.code, TEAM_RUNTIME_ERROR_CODE.INVALID_TEAM);
});

test("3D resolve: missing team source", async () => {
  const resolver = createTeamResolver();
  const result = await resolver.resolve({
    competitionId: "comp-1",
    source: null,
  });
  assert.equal(result.ok, false);
  assert.equal(result.error.code, TEAM_RUNTIME_ERROR_CODE.TEAM_NOT_FOUND);
});

test("3D resolve: guest member preserved via playerById", async () => {
  const resolver = createRosterResolver();
  const result = await resolver.resolve({
    competitionId: "comp-1",
    source: {
      id: "team-g",
      playerIds: ["guest-9"],
    },
    context: {
      playerById: {
        "guest-9": { id: "guest-9", name: "Walk-in", isGuest: true },
      },
    },
  });
  assert.equal(result.ok, true);
  assert.equal(result.roster.members[0].person.kind, PARTICIPANT_REFERENCE_KIND.GUEST);
});

test("3D resolve: Participant DI callback (no runtime import)", async () => {
  let calls = 0;
  const resolver = createTeamResolver({
    resolveParticipant: async (player) => {
      calls += 1;
      return {
        ok: true,
        person: {
          kind: PARTICIPANT_REFERENCE_KIND.ATHLETE,
          id: String(player.id),
        },
      };
    },
  });
  const result = await resolver.resolve({
    competitionId: "comp-1",
    source: {
      id: "team-di",
      name: "DI",
      playerIds: ["ath-1"],
      captainPlayerId: "ath-1",
    },
  });
  assert.equal(result.ok, true);
  assert.equal(calls, 1);
  assert.equal(result.team.captainRef?.kind, PARTICIPANT_REFERENCE_KIND.ATHLETE);
});

test("3D resolve: batch preserves order", async () => {
  const resolver = createTeamResolver();
  const results = await resolver.resolveBatch([
    { competitionId: "c", source: { id: "t1", name: "One" } },
    { competitionId: "c", source: { id: "t2", name: "Two" } },
  ]);
  assert.equal(results.length, 2);
  assert.equal(results[0].team?.id, "t1");
  assert.equal(results[1].team?.id, "t2");
});

test("3D persistence stub opt-in only", async () => {
  const port = createInMemoryTeamPersistencePort();
  const resolver = createTeamResolver({
    persistence: port,
    enablePersistence: true,
  });
  const result = await resolver.resolve({
    competitionId: "comp-1",
    source: { id: "team-p", name: "Persist" },
  });
  assert.equal(result.ok, true);
  const saved = await port.getById("team-p");
  assert.equal(saved?.id, "team-p");

  const rosterPort = createInMemoryRosterPersistencePort();
  const rosterResolver = createRosterResolver({
    persistence: rosterPort,
    enablePersistence: true,
  });
  const rosterResult = await rosterResolver.resolve({
    competitionId: "comp-1",
    source: { id: "team-p", playerIds: ["p-1"] },
  });
  assert.equal(rosterResult.ok, true);
  const savedRoster = await rosterPort.getById("roster:team-p");
  assert.equal(savedRoster?.teamId, "team-p");
});

test("3D persistence default OFF does not write", async () => {
  const port = createInMemoryTeamPersistencePort();
  const resolver = createTeamResolver({ persistence: port });
  const result = await resolver.resolve({
    competitionId: "comp-1",
    source: { id: "team-no-write", name: "NoWrite" },
  });
  assert.equal(result.ok, true);
  assert.equal(await port.getById("team-no-write"), null);
});

test("3D mapper: direct team/roster map helpers", () => {
  const team = mapLegacyTeamToCompetitionTeam(
    { id: "t", name: "N", status: "draft" },
    { competitionId: "c" }
  );
  assert.equal(team.status, COMPETITION_TEAM_STATUS.DRAFT);
  assert.equal(team.identityKey, "c::TEAM::t");

  const roster = mapLegacyRosterToCompetitionRoster(
    { teamId: "t", playerIds: ["p1"], rosterStatus: "submitted" },
    { competitionId: "c" }
  );
  assert.equal(roster.status, COMPETITION_ROSTER_STATUS.SUBMITTED);
  assert.equal(roster.identityKey, "c::ROSTER::t");
  assert.equal(roster.sourceType, undefined);
  assert.equal(roster.extensions?.payload?.sourceType, TEAM_SOURCE_TYPE.LEGACY_ROSTER);
});
