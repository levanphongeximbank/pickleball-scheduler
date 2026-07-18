import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  createTeamResolver,
  createRosterResolver,
  createLegacyTeamAdapter,
  createLegacyRosterAdapter,
  buildTeamIdentityKey,
  createTeamIdentity,
  buildRosterIdentityKey,
  createRosterIdentity,
  buildRosterMemberIdentityKey,
  createRosterMemberIdentity,
  formatParticipantReferenceToken,
  TEAM_RUNTIME_ERROR_CODE,
  TeamRuntimeError,
  isTeamRuntimeError,
  createTeamRuntimeError,
  TEAM_ADAPTER_ID,
  ROSTER_ADAPTER_ID,
  TEAM_SOURCE_TYPE,
  mapLegacyTeamToCompetitionTeam,
  mapLegacyRosterToCompetitionRoster,
  createParticipantReference,
  PARTICIPANT_REFERENCE_KIND,
  resolveRuntimeDecision,
  resolveShadowEligibility,
  RUNTIME_MODE,
  RUNTIME_EXECUTOR,
} from "../src/features/competition-core/index.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function listJsFiles(dir) {
  const out = [];
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) out.push(...listJsFiles(full));
    else if (name.endsWith(".js") || name.endsWith(".jsx")) out.push(full);
  }
  return out;
}

test("3D Wave2: root exports approved Team Runtime public surface", () => {
  assert.equal(typeof createTeamResolver, "function");
  assert.equal(typeof createRosterResolver, "function");
  assert.equal(typeof createLegacyTeamAdapter, "function");
  assert.equal(typeof createLegacyRosterAdapter, "function");
  assert.equal(typeof buildTeamIdentityKey, "function");
  assert.equal(typeof createTeamIdentity, "function");
  assert.equal(typeof buildRosterIdentityKey, "function");
  assert.equal(typeof createRosterIdentity, "function");
  assert.equal(typeof buildRosterMemberIdentityKey, "function");
  assert.equal(typeof createRosterMemberIdentity, "function");
  assert.equal(typeof formatParticipantReferenceToken, "function");
  assert.equal(typeof TEAM_RUNTIME_ERROR_CODE.TEAM_NOT_FOUND, "string");
  assert.equal(typeof TeamRuntimeError, "function");
  assert.equal(typeof isTeamRuntimeError, "function");
  assert.equal(typeof createTeamRuntimeError, "function");
  assert.equal(TEAM_ADAPTER_ID.LEGACY, "LEGACY_TEAM");
  assert.equal(ROSTER_ADAPTER_ID.LEGACY, "LEGACY_ROSTER");
  assert.equal(TEAM_SOURCE_TYPE.LEGACY_TEAM, "LEGACY_TEAM");
  assert.equal(typeof mapLegacyTeamToCompetitionTeam, "function");
  assert.equal(typeof mapLegacyRosterToCompetitionRoster, "function");
});

test("3D Wave2: root does not export persistence ports or private internals", async () => {
  const root = await import("../src/features/competition-core/index.js");
  const forbidden = [
    "TEAM_PERSISTENCE_PORT_METHODS",
    "ROSTER_PERSISTENCE_PORT_METHODS",
    "createNoopTeamPersistencePort",
    "createNoopRosterPersistencePort",
    "createInMemoryTeamPersistencePort",
    "createInMemoryRosterPersistencePort",
    "createTeamIdentityLookup",
    "createRosterIdentityLookup",
    "normalizeAndValidateTeam",
    "normalizeAndValidateRoster",
    "teamResolveOk",
    "rosterResolveOk",
    "registerTeamCapability",
    "registerRosterCapability",
  ];
  for (const name of forbidden) {
    assert.equal(
      Object.prototype.hasOwnProperty.call(root, name),
      false,
      `root must not export ${name}`
    );
  }
});

test("3D Wave2: createTeamResolver works through root import", async () => {
  const resolver = createTeamResolver();
  const source = {
    id: "team-wave2",
    name: "Wave2 Alpha",
    captainPlayerId: "p-1",
    deputyPlayerIds: ["p-2"],
    playerIds: ["p-1", "p-2"],
    status: "active",
  };
  const result = await resolver.resolve({
    competitionId: "comp-wave2",
    source,
  });
  assert.equal(result.ok, true);
  assert.equal(result.team.id, "team-wave2");
  assert.equal(result.team.captainRef?.kind, PARTICIPANT_REFERENCE_KIND.PLAYER_PROFILE);
  assert.equal(result.team.captainRef?.id, "p-1");
  assert.equal(
    result.identity.key,
    buildTeamIdentityKey({
      competitionId: "comp-wave2",
      stableTeamId: "team-wave2",
    })
  );
  assert.equal(source.name, "Wave2 Alpha");
});

test("3D Wave2: createRosterResolver works through root import", async () => {
  const resolver = createRosterResolver();
  const result = await resolver.resolve({
    competitionId: "comp-wave2",
    source: {
      id: "team-wave2",
      playerIds: ["p-1", "p-2"],
      captainPlayerId: "p-1",
      locked: true,
    },
  });
  assert.equal(result.ok, true);
  assert.equal(result.roster.teamId, "team-wave2");
  assert.equal(result.roster.members.length, 2);
  assert.equal(
    result.roster.members[0].person.kind,
    PARTICIPANT_REFERENCE_KIND.PLAYER_PROFILE
  );
  assert.equal(
    result.identity.key,
    buildRosterIdentityKey({
      competitionId: "comp-wave2",
      teamId: "team-wave2",
    })
  );
});

test("3D Wave2: Team/Roster use Phase 3B ParticipantReference contracts", () => {
  const person = createParticipantReference({
    kind: PARTICIPANT_REFERENCE_KIND.ATHLETE,
    id: "ath-9",
    displayNameSnapshot: "Old Name",
  });
  const token = formatParticipantReferenceToken(person);
  assert.equal(token, "ATHLETE:ath-9");

  const memberKey = buildRosterMemberIdentityKey({
    competitionId: "comp-a",
    teamId: "team-1",
    person,
  });
  assert.equal(memberKey, "comp-a::ROSTER_MEMBER::team-1::ATHLETE:ath-9");

  const renamed = createParticipantReference({
    ...person,
    displayNameSnapshot: "New Name",
  });
  assert.equal(
    buildRosterMemberIdentityKey({
      competitionId: "comp-a",
      teamId: "team-1",
      person: renamed,
    }),
    memberKey
  );
});

test("3D Wave2: deterministic identities across competitions and display-name independence", () => {
  const teamA = createTeamIdentity({
    competitionId: "comp-a",
    stableTeamId: "team-1",
  });
  const teamB = createTeamIdentity({
    competitionId: "comp-b",
    stableTeamId: "team-1",
  });
  assert.equal(teamA.key, "comp-a::TEAM::team-1");
  assert.notEqual(teamA.key, teamB.key);

  const rosterA = createRosterIdentity({
    competitionId: "comp-a",
    teamId: "team-1",
  });
  assert.equal(rosterA.key, "comp-a::ROSTER::team-1");

  const member = createRosterMemberIdentity({
    competitionId: "comp-a",
    teamId: "team-1",
    person: { kind: "PLAYER_PROFILE", id: "p-1" },
  });
  assert.equal(member.key, "comp-a::ROSTER_MEMBER::team-1::PLAYER_PROFILE:p-1");
  assert.throws(() => {
    // @ts-expect-error frozen
    teamA.key = "mutated";
  });
});

test("3D Wave2: typed TeamRuntimeError via root export", () => {
  const err = createTeamRuntimeError(
    TEAM_RUNTIME_ERROR_CODE.INVALID_TEAM,
    "smoke",
    { competitionId: "c" }
  );
  assert.equal(isTeamRuntimeError(err), true);
  assert.equal(err.code, TEAM_RUNTIME_ERROR_CODE.INVALID_TEAM);
});

test("3D Wave2: teams modules do not import Participant Runtime or Registration Runtime", () => {
  const teamsRoot = path.join(ROOT, "src/features/competition-core/teams");
  for (const file of listJsFiles(teamsRoot)) {
    const content = readFileSync(file, "utf8");
    assert.doesNotMatch(content, /participants\/runtime/);
    assert.doesNotMatch(content, /registrations\//);
  }
});

test("3D Wave2: root import introduces no circular dependency (teams re-export resolves)", async () => {
  const root = await import("../src/features/competition-core/index.js");
  const teams = await import("../src/features/competition-core/teams/index.js");
  assert.equal(root.createTeamResolver, teams.createTeamResolver);
  assert.equal(root.createRosterResolver, teams.createRosterResolver);
});

test("3D Wave2: Production safety — Legacy only, Shadow OFF, persistence OFF", async () => {
  const decision = resolveRuntimeDecision({});
  assert.equal(decision.selectedMode, RUNTIME_MODE.LEGACY_ONLY);
  assert.equal(decision.selectedExecutor, RUNTIME_EXECUTOR.LEGACY);
  assert.equal(decision.shadowAllowed, false);
  assert.equal(decision.canonicalAllowed, false);
  assert.equal(resolveShadowEligibility({}).eligible, false);

  const resolver = createTeamResolver();
  const result = await resolver.resolve({
    competitionId: "comp-safe",
    source: { id: "t1", name: "Safe" },
  });
  assert.equal(result.ok, true);
  assert.equal(result.diagnostics?.persistenceEnabled, false);
});

test("3D Wave2: no Production page/API callers of Team Runtime", () => {
  const callerRoots = [
    path.join(ROOT, "src/pages"),
    path.join(ROOT, "src/components"),
    path.join(ROOT, "src/features/team-tournament"),
    path.join(ROOT, "src/features/individual-tournament"),
  ];
  const patterns = [
    /competition-core\/teams/,
    /createTeamResolver/,
    /createRosterResolver/,
  ];
  for (const dir of callerRoots) {
    if (!existsSync(dir)) continue;
    for (const file of listJsFiles(dir)) {
      const content = readFileSync(file, "utf8");
      for (const pattern of patterns) {
        assert.doesNotMatch(
          content,
          pattern,
          `Production caller in ${path.relative(ROOT, file)}`
        );
      }
    }
  }
});

test("3D Wave2: official manifest includes Phase 3D paths once; no Phase 3C entries added", () => {
  const official = JSON.parse(
    readFileSync(path.join(ROOT, "scripts/ci/unit-test-files.json"), "utf8")
  );
  const required = [
    "tests/competition-core-team-runtime-3d.test.js",
    "tests/competition-core-team-runtime-3d-architecture.test.js",
    "tests/competition-core-team-integrator-3d-wave2.test.js",
  ];
  for (const entry of required) {
    assert.equal(
      official.filter((f) => f === entry).length,
      1,
      `expected exactly one ${entry}`
    );
  }
  assert.equal(
    official.includes("tests/competition-core-registration-3c.test.js"),
    false
  );
  assert.equal(
    official.includes(
      "tests/competition-core-registration-3c-architecture.test.js"
    ),
    false
  );
});

test("3D Wave2: runtime-control and featureFlags files unchanged by Wave 2 (no TEAM registry wiring)", () => {
  const indexPath = path.join(ROOT, "src/features/competition-core/index.js");
  const content = readFileSync(indexPath, "utf8");
  assert.match(content, /from "\.\/teams\/index\.js"/);
  assert.doesNotMatch(content, /registerTeamCapability|registerRosterCapability/);
  assert.doesNotMatch(content, /from "\.\/registrations\//);

  const flags = readFileSync(
    path.join(ROOT, "src/features/competition-core/config/featureFlags.js"),
    "utf8"
  );
  // Wave 2 must not introduce team/roster V2 enablement markers.
  assert.doesNotMatch(flags, /TEAM_RUNTIME_V2|ROSTER_RUNTIME_V2|TEAM_V2_ENABLED/);
});
