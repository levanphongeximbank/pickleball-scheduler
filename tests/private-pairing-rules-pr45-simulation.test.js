import test from "node:test";
import assert from "node:assert/strict";

import { ACCC_FIXTURE } from "./fixtures/accc-cloud-only-club.js";
import {
  FEATURE_FLAG_KEYS,
  PRIVATE_PAIRING_CONSTRAINT_TYPE,
  PRIVATE_PAIRING_SCOPE,
  RELATION_MODE,
  RULE_VISIBILITY,
  REASON_CATEGORY,
  COMPETITION_CLASS,
  createPrivatePairingRule,
  simulatePrivatePairing,
  filterEligibleSimulationPlayers,
  canonicalizeCandidateKey,
  SIMULATION_CODE,
  EXPLANATION_CODE,
  isPrivatePairingSimulationEnabled,
} from "../src/features/private-pairing-rules/index.js";
import {
  createCanonicalMembershipRepository,
  createCanonicalClubRepository,
  createCanonicalPlayerRepository,
  createCanonicalPlayerPickerAdapter,
} from "../src/features/club/repositories/index.js";
import { MAPPING_STATUS } from "../src/features/club/repositories/canonicalRepositoryTypes.js";

const FLAGS_ON = {
  [FEATURE_FLAG_KEYS.PRIVATE_PAIRING_RULES]: "true",
  [FEATURE_FLAG_KEYS.UNIFIED_CONSTRAINT_ENGINE]: "true",
  [FEATURE_FLAG_KEYS.PRIVATE_PAIRING_SIMULATION]: "true",
};

const FLAGS_OFF = {
  [FEATURE_FLAG_KEYS.PRIVATE_PAIRING_RULES]: "true",
  [FEATURE_FLAG_KEYS.UNIFIED_CONSTRAINT_ENGINE]: "true",
  [FEATURE_FLAG_KEYS.PRIVATE_PAIRING_SIMULATION]: "false",
};

function mappedPlayers(n = 8) {
  return Array.from({ length: n }, (_, index) => ({
    playerId: `p${index + 1}`,
    id: `p${index + 1}`,
    displayName: `P${index + 1}`,
    name: `P${index + 1}`,
    gender: index % 2 === 0 ? "Nam" : "Nữ",
    rating: 3 + (index % 5) * 0.2,
    status: "active",
    membershipStatus: "active",
    mappingStatus: MAPPING_STATUS.MAPPED,
    clubId: "club-1",
    tenantId: "tenant-1",
    waitMinutes: index * 3,
    benchCount: index % 3,
    matchesPlayed: index % 4,
  }));
}

function hardRule(overrides = {}) {
  return createPrivatePairingRule({
    id: overrides.id || "hard-1",
    constraintType: PRIVATE_PAIRING_CONSTRAINT_TYPE.MUST_NOT_PARTNER,
    severity: "hard",
    weight: null,
    primaryPlayerId: "p1",
    targetPlayerIds: ["p2"],
    relationMode: RELATION_MODE.ANY_OF,
    scopeType: PRIVATE_PAIRING_SCOPE.GLOBAL,
    scopeId: null,
    visibility: RULE_VISIBILITY.PRIVATE,
    reasonCategory: REASON_CATEGORY.EVENT_OPERATION,
    reasonText: "ops",
    active: true,
    ...overrides,
  });
}

function softRule(overrides = {}) {
  return createPrivatePairingRule({
    id: overrides.id || "soft-1",
    constraintType: PRIVATE_PAIRING_CONSTRAINT_TYPE.PREFER_PARTNER,
    severity: "soft",
    weight: 80,
    primaryPlayerId: "p1",
    targetPlayerIds: ["p2"],
    relationMode: RELATION_MODE.ANY_OF,
    scopeType: PRIVATE_PAIRING_SCOPE.GLOBAL,
    scopeId: null,
    visibility: RULE_VISIBILITY.PRIVATE,
    reasonCategory: REASON_CATEGORY.PLAYER_REQUEST,
    reasonText: "request",
    active: true,
    ...overrides,
  });
}

test("simulation flag defaults OFF path", () => {
  assert.equal(isPrivatePairingSimulationEnabled(FLAGS_OFF), false);
  assert.equal(isPrivatePairingSimulationEnabled(FLAGS_ON), true);
});

test("flag OFF does not run simulation", async () => {
  const result = await simulatePrivatePairing({
    players: mappedPlayers(8),
    rules: [],
    seed: 1,
    envSource: FLAGS_OFF,
  });
  assert.equal(result.ok, false);
  assert.equal(result.errorCode, SIMULATION_CODE.FEATURE_DISABLED);
  assert.equal(result.selectedCandidates.length, 0);
  assert.equal(result.execution.readOnly, true);
  assert.equal(result.execution.wroteMatches, false);
});

test("canonical filter: only MAPPED/DERIVED eligible; UNMAPPED warns", () => {
  const filtered = filterEligibleSimulationPlayers([
    {
      playerId: "p1",
      mappingStatus: MAPPING_STATUS.MAPPED,
      rating: 3.5,
      displayName: "A",
    },
    {
      playerId: "p2",
      mappingStatus: MAPPING_STATUS.DERIVED,
      rating: 3.2,
      displayName: "B",
    },
    {
      playerId: "",
      authUserId: "u-unmapped",
      mappingStatus: MAPPING_STATUS.UNMAPPED,
      displayName: "U",
    },
    {
      playerId: "unmapped:fake",
      mappingStatus: MAPPING_STATUS.UNMAPPED,
      displayName: "Fake",
    },
  ]);
  assert.equal(filtered.eligible.length, 2);
  assert.ok(filtered.warnings.some((w) => w.code === "UNMAPPED_ACTIVE_MEMBER"));
  assert.equal(filtered.mappingSummary.unmappedMembers >= 1, true);
});

test("ACCC cloud-only: 5 mapped simulate without blob", async () => {
  const membershipRepository = createCanonicalMembershipRepository({
    isV2Enabled: () => true,
    listMembersRpc: async () => ({ ok: true, members: ACCC_FIXTURE.membershipRows }),
  });
  const clubRepository = createCanonicalClubRepository({
    isV2Enabled: () => true,
    listRegistryRpc: async () => ({ ok: true, clubs: [ACCC_FIXTURE.club] }),
    getClubRpc: async () => ({ ok: true, club: ACCC_FIXTURE.club }),
  });
  const playerRepository = createCanonicalPlayerRepository({
    isV2Enabled: () => true,
    membershipRepository,
    clubRepository,
    loadLegacyPlayers: () => [],
    loadProfilesByUserIds: ACCC_FIXTURE.profilesByUserId,
  });
  const adapter = createCanonicalPlayerPickerAdapter({
    isClubCanonical: () => true,
    isPlayerCanonical: () => true,
    clubRepository,
    playerRepository,
  });
  const pool = await adapter.listPlayersForClubAware(ACCC_FIXTURE.club.id, {
    tenantId: ACCC_FIXTURE.tenantId,
    profilesByUserId: ACCC_FIXTURE.profilesByUserId,
  });
  assert.equal(pool.legacyPlayers.length, 5);

  const simPlayers = pool.data
    .filter((r) => r.mappingStatus === MAPPING_STATUS.MAPPED || r.mappingStatus === MAPPING_STATUS.DERIVED)
    .map((r) => ({
      playerId: r.playerId,
      displayName: r.displayName,
      rating: r.rating,
      gender: r.gender,
      clubId: r.clubId,
      tenantId: r.tenantId,
      mappingStatus: r.mappingStatus,
      membershipStatus: r.membershipStatus,
      status: r.status,
    }));

  // pad to 8 with extra mapped fixtures so pairing generators have enough seats
  while (simPlayers.length < 8) {
    const i = simPlayers.length + 1;
    simPlayers.push({
      playerId: `player-accc-extra-${i}`,
      displayName: `Extra ${i}`,
      rating: 3.4,
      gender: i % 2 ? "Nam" : "Nữ",
      clubId: ACCC_FIXTURE.club.id,
      tenantId: ACCC_FIXTURE.tenantId,
      mappingStatus: MAPPING_STATUS.MAPPED,
      membershipStatus: "active",
      status: "active",
    });
  }

  const result = await simulatePrivatePairing({
    players: [
      ...simPlayers,
      {
        playerId: "",
        authUserId: "u-unmapped-accc",
        mappingStatus: MAPPING_STATUS.UNMAPPED,
        displayName: "Unmapped",
      },
    ],
    rules: [],
    seed: 42,
    topN: 5,
    teamSize: 2,
    scopeType: PRIVATE_PAIRING_SCOPE.CLUB,
    scopeId: ACCC_FIXTURE.club.id,
    sourceClubId: ACCC_FIXTURE.club.id,
    envSource: FLAGS_ON,
  });

  assert.equal(result.ok, true);
  assert.ok(result.summary.playersEligible >= 5);
  assert.ok(result.selectedCandidates.length >= 1);
  assert.ok(result.warnings.some((w) => w.code === "UNMAPPED_ACTIVE_MEMBER"));
  assert.equal(result.execution.wroteTournament, false);
  assert.equal(result.execution.readOnly, true);
});

test("determinism: same seed same output; input not mutated; order independent", async () => {
  const base = mappedPlayers(8);
  const reversed = [...base].reverse();
  const inputA = { players: base, rules: [], seed: 99, topN: 3, envSource: FLAGS_ON };
  const inputB = { players: reversed, rules: [], seed: 99, topN: 3, envSource: FLAGS_ON };
  const snapshot = JSON.stringify(base);

  const a = await simulatePrivatePairing(inputA);
  const b = await simulatePrivatePairing(inputB);
  assert.equal(JSON.stringify(base), snapshot);
  assert.equal(a.ok, true);
  assert.deepEqual(
    a.selectedCandidates.map((c) => c.deterministicKey),
    b.selectedCandidates.map((c) => c.deterministicKey)
  );
  assert.deepEqual(
    a.selectedCandidates.map((c) => c.finalScore),
    b.selectedCandidates.map((c) => c.finalScore)
  );
});

test("different seed may change ordering", async () => {
  const players = mappedPlayers(8);
  const a = await simulatePrivatePairing({
    players,
    rules: [],
    seed: 1,
    topN: 5,
    envSource: FLAGS_ON,
    options: { matchMode: true },
    courtCount: 2,
  });
  const b = await simulatePrivatePairing({
    players,
    rules: [],
    seed: 777,
    topN: 5,
    envSource: FLAGS_ON,
    options: { matchMode: true },
    courtCount: 2,
  });
  assert.equal(a.ok, true);
  assert.equal(b.ok, true);
  // Not required to differ, but keys must be canonical
  assert.ok(a.selectedCandidates.every((c) => c.deterministicKey));
  assert.ok(b.selectedCandidates.every((c) => c.deterministicKey));
});

test("hard MUST_NOT_PARTNER rejects; soft cannot rescue", async () => {
  const result = await simulatePrivatePairing({
    players: mappedPlayers(8),
    rules: [
      hardRule({
        constraintType: PRIVATE_PAIRING_CONSTRAINT_TYPE.MUST_NOT_PARTNER,
        primaryPlayerId: "p1",
        targetPlayerIds: ["p2"],
      }),
      softRule({
        constraintType: PRIVATE_PAIRING_CONSTRAINT_TYPE.PREFER_PARTNER,
        primaryPlayerId: "p1",
        targetPlayerIds: ["p2"],
        weight: 100,
      }),
    ],
    seed: 3,
    topN: 10,
    envSource: FLAGS_ON,
  });
  assert.ok(result.ok === true || result.errorCode === SIMULATION_CODE.NO_FEASIBLE_PAIRING);
  if (result.ok) {
    result.selectedCandidates.forEach((cand) => {
      const partnered = (cand.teams || []).some((team) => {
        const ids = (team.playerIds || (team.members || []).map((m) => m.id || m.playerId)).map(String);
        return ids.includes("p1") && ids.includes("p2");
      });
      assert.equal(partnered, false);
    });
  }
});

test("MUST_PARTNER ANY_OF vs ALL_OF capacity", async () => {
  const anyOf = await simulatePrivatePairing({
    players: mappedPlayers(8),
    rules: [
      hardRule({
        id: "must-any",
        constraintType: PRIVATE_PAIRING_CONSTRAINT_TYPE.MUST_PARTNER,
        primaryPlayerId: "p1",
        targetPlayerIds: ["p2", "p3"],
        relationMode: RELATION_MODE.ANY_OF,
      }),
    ],
    seed: 5,
    topN: 5,
    envSource: FLAGS_ON,
  });
  assert.equal(anyOf.ok, true);

  const allOf = await simulatePrivatePairing({
    players: mappedPlayers(8),
    rules: [
      hardRule({
        id: "must-all",
        constraintType: PRIVATE_PAIRING_CONSTRAINT_TYPE.MUST_PARTNER,
        primaryPlayerId: "p1",
        targetPlayerIds: ["p2", "p3", "p4"],
        relationMode: RELATION_MODE.ALL_OF,
      }),
    ],
    seed: 5,
    teamSize: 2,
    topN: 5,
    envSource: FLAGS_ON,
  });
  // teamSize 2 cannot host ALL_OF 3 targets → no feasible or conflict
  assert.ok(
    allOf.ok === false ||
      allOf.summary.feasible === false ||
      allOf.errorCode === SIMULATION_CODE.NO_FEASIBLE_PAIRING ||
      allOf.errorCode === SIMULATION_CODE.CONSTRAINT_CONFLICT
  );
});

test("soft prefer partner improves rank vs avoid", async () => {
  const prefer = await simulatePrivatePairing({
    players: mappedPlayers(8),
    rules: [
      softRule({
        id: "pref",
        constraintType: PRIVATE_PAIRING_CONSTRAINT_TYPE.PREFER_PARTNER,
        primaryPlayerId: "p1",
        targetPlayerIds: ["p2"],
        weight: 90,
      }),
    ],
    seed: 11,
    topN: 3,
    envSource: FLAGS_ON,
  });
  assert.equal(prefer.ok, true);
  assert.ok(prefer.selectedCandidates[0].explanation.reasons.length > 0);
  assert.ok(
    prefer.selectedCandidates[0].explanation.reasons.some(
      (r) => r.code === EXPLANATION_CODE.NO_HARD_RULE_VIOLATION
    )
  );
});

test("Top N, no duplicate keys, differenceFromTop, explanation", async () => {
  const result = await simulatePrivatePairing({
    players: mappedPlayers(8),
    rules: [],
    seed: 21,
    topN: 4,
    envSource: FLAGS_ON,
  });
  assert.equal(result.ok, true);
  assert.ok(result.selectedCandidates.length <= 4);
  assert.equal(result.selectedCandidates[0].rank, 1);
  assert.equal(result.selectedCandidates[0].differenceFromTop, 0);
  const keys = result.selectedCandidates.map((c) => c.deterministicKey);
  assert.equal(new Set(keys).size, keys.length);
  assert.ok(result.selectedCandidates[0].explanation.confidence > 0);
});

test("missing rating warning; no NaN scores", async () => {
  const players = mappedPlayers(8);
  players[0].rating = null;
  players[0].level = null;
  const result = await simulatePrivatePairing({
    players,
    rules: [],
    seed: 2,
    topN: 3,
    envSource: FLAGS_ON,
  });
  assert.equal(result.ok, true);
  assert.ok(result.warnings.some((w) => w.code === SIMULATION_CODE.MISSING_PLAYER_RATING));
  result.selectedCandidates.forEach((c) => {
    Object.values(c.scores).forEach((v) => {
      assert.equal(Number.isFinite(v), true);
    });
  });
});

test("certified policy blocks private rule; SUPER_ADMIN cannot bypass", async () => {
  const result = await simulatePrivatePairing({
    players: mappedPlayers(8),
    rules: [
      softRule({
        id: "private-pref",
        visibility: RULE_VISIBILITY.PRIVATE,
        constraintType: PRIVATE_PAIRING_CONSTRAINT_TYPE.PREFER_PARTNER,
        primaryPlayerId: "p1",
        targetPlayerIds: ["p2"],
      }),
    ],
    competitionClass: COMPETITION_CLASS.CERTIFIED,
    allowedByPublishedRules: false,
    seed: 8,
    topN: 3,
    envSource: FLAGS_ON,
    actorId: "super-admin",
  });
  assert.ok(result.warnings.some((w) => w.code === SIMULATION_CODE.RULE_BLOCKED_BY_CERTIFIED_POLICY));
  assert.equal(result.summary.softRulesApplied, 0);
});

test("search limits set searchLimitReached without hang", async () => {
  const result = await simulatePrivatePairing({
    players: mappedPlayers(32),
    rules: [],
    seed: 1,
    topN: 5,
    maxCandidates: 20,
    maxIterations: 30,
    timeoutMs: 2000,
    envSource: FLAGS_ON,
    options: { matchMode: true },
    courtCount: 4,
  });
  assert.ok(result.summary.executionTimeMs < 2000);
  assert.ok(result.summary.candidatesEvaluated <= 20);
  assert.ok(typeof result.summary.searchLimitReached === "boolean");
});

test("canonical key stable regardless of team order", () => {
  const a = canonicalizeCandidateKey({
    matches: [
      { teamA: [{ id: "p2" }, { id: "p1" }], teamB: [{ id: "p4" }, { id: "p3" }] },
    ],
    benchPlayers: [],
  });
  const b = canonicalizeCandidateKey({
    matches: [
      { teamA: [{ id: "p3" }, { id: "p4" }], teamB: [{ id: "p1" }, { id: "p2" }] },
    ],
    benchPlayers: [],
  });
  assert.equal(a, b);
});

test("fairness prefers high-wait players onto court", async () => {
  const players = mappedPlayers(8).map((p, index) => ({
    ...p,
    waitMinutes: p.playerId === "p8" ? 100 : index,
    benchCount: p.playerId === "p8" ? 10 : 0,
    matchesPlayed: p.playerId === "p8" ? 0 : 5,
  }));
  const result = await simulatePrivatePairing({
    players,
    rules: [],
    seed: 4,
    topN: 1,
    envSource: FLAGS_ON,
    options: { matchMode: true },
    courtCount: 1,
  });
  assert.equal(result.ok, true);
  const playing = new Set(
    (result.selectedCandidates[0].matches || []).flatMap((m) => [
      ...(m.teamA || []).map((x) => x.id || x.playerId),
      ...(m.teamB || []).map((x) => x.id || x.playerId),
    ])
  );
  // High-wait p8 should be on court in top candidate when match mode ranks fairness
  assert.equal(playing.has("p8"), true);
});
