import test from "node:test";
import assert from "node:assert/strict";

import {
  createLineupResolver,
  createLineupIdentityLookup,
  createInMemoryLineupPersistencePort,
  mapLegacyLineupToCompetitionLineup,
  mapLegacyLineupStatus,
  buildLineupIdentityKey,
  buildLineupSlotId,
  createLineupIdentity,
  createNoopLineupPolicy,
  assertLineupTransitionAllowed,
  LINEUP_ACTION,
  LINEUP_RUNTIME_ERROR_CODE,
  LINEUP_ADAPTER_ID,
  LINEUP_SOURCE_TYPE,
  createCompetitionLineupSlot,
  LineupRuntimeError,
} from "../src/features/competition-core/lineups/index.js";
import { PARTICIPANT_REFERENCE_KIND } from "../src/features/competition-core/participants/enums/identityKinds.js";
import { COMPETITION_LINEUP_STATUS } from "../src/features/competition-core/participants/enums/statuses.js";
import { createCompetitionRosterMember } from "../src/features/competition-core/participants/contracts/teamRosterLineup.js";
import { createParticipantReference } from "../src/features/competition-core/participants/contracts/identity.js";

function legacyLineup(overrides = {}) {
  return {
    matchupId: "mu-1",
    teamId: "team-1",
    status: "submitted",
    selections: {
      md: ["p-1", "p-2"],
      ms: ["p-3"],
    },
    submittedAt: "2026-07-01T10:00:00.000Z",
    ...overrides,
  };
}

function rosterWith(...playerIds) {
  return {
    id: "roster:team-1",
    competitionId: "comp-1",
    teamId: "team-1",
    members: playerIds.map((id) =>
      createCompetitionRosterMember({
        id: `rm:team-1:PLAYER_PROFILE:${id}`,
        rosterId: "roster:team-1",
        person: createParticipantReference({
          kind: PARTICIPANT_REFERENCE_KIND.PLAYER_PROFILE,
          id,
        }),
      })
    ),
  };
}

test("3E lineup resolve: valid legacy lineup mapping", async () => {
  const resolver = createLineupResolver();
  const source = legacyLineup();
  const result = await resolver.resolve({
    competitionId: "comp-1",
    source,
  });

  assert.equal(result.ok, true);
  assert.equal(result.adapterId, LINEUP_ADAPTER_ID.LEGACY);
  assert.equal(result.sourceType, LINEUP_SOURCE_TYPE.LEGACY_LINEUP);
  assert.equal(result.lineup.teamId, "team-1");
  assert.equal(result.lineup.contextId, "mu-1");
  assert.equal(result.lineup.status, COMPETITION_LINEUP_STATUS.SUBMITTED);
  assert.equal(result.lineup.slots.length, 3);
  assert.equal(
    result.identity.key,
    buildLineupIdentityKey({
      competitionId: "comp-1",
      contextId: "mu-1",
      teamId: "team-1",
    })
  );
  assert.equal(result.lineup.identityKey, result.identity.key);
  assert.equal(result.lineup.id, result.identity.key);
  assert.equal(source.status, "submitted");
  assert.equal(Object.keys(source).includes("identityKey"), false);
});

test("3E status mapping: legacy → canonical", () => {
  assert.equal(mapLegacyLineupStatus("not_submitted"), COMPETITION_LINEUP_STATUS.DRAFT);
  assert.equal(mapLegacyLineupStatus("draft"), COMPETITION_LINEUP_STATUS.DRAFT);
  assert.equal(mapLegacyLineupStatus("submitted"), COMPETITION_LINEUP_STATUS.SUBMITTED);
  assert.equal(mapLegacyLineupStatus("locked"), COMPETITION_LINEUP_STATUS.LOCKED);
  assert.equal(mapLegacyLineupStatus("published"), COMPETITION_LINEUP_STATUS.PUBLISHED);
  assert.equal(mapLegacyLineupStatus("overridden"), COMPETITION_LINEUP_STATUS.SUPERSEDED);
  assert.equal(mapLegacyLineupStatus("withdrawn"), COMPETITION_LINEUP_STATUS.VOIDED);
  assert.equal(mapLegacyLineupStatus("expired"), COMPETITION_LINEUP_STATUS.VOIDED);
});

test("3E identity: lineup key frozen and display-name independent", () => {
  const identity = createLineupIdentity({
    competitionId: "c",
    contextId: "mu",
    teamId: "t1",
  });
  assert.equal(identity.key, "c::LINEUP::mu::t1");
  assert.throws(() => {
    // @ts-expect-error frozen
    identity.key = "mutated";
  });
  assert.equal(
    buildLineupIdentityKey({ competitionId: "c", contextId: "mu", teamId: "t1" }),
    buildLineupIdentityKey({ competitionId: "c", contextId: "mu", teamId: "t1" })
  );
  assert.equal(
    buildLineupSlotId({
      lineupIdentityKey: identity.key,
      disciplineOrSideKey: "md",
      index: 0,
    }),
    "c::LINEUP::mu::t1::md::0"
  );
});

test("3E resolve: deterministic identity stable across resolves", async () => {
  const resolver = createLineupResolver({
    identityLookup: createLineupIdentityLookup(),
  });
  const source = legacyLineup({ status: "draft" });
  const a = await resolver.resolve({ competitionId: "comp-1", source });
  const b = await resolver.resolve({ competitionId: "comp-1", source });
  assert.equal(a.ok, true);
  assert.equal(b.ok, true);
  assert.equal(a.identity.key, b.identity.key);
});

test("3E resolve: identity collision refuses overwrite", async () => {
  const lookup = createLineupIdentityLookup();
  const resolver = createLineupResolver({ identityLookup: lookup });
  const first = await resolver.resolve({
    competitionId: "comp-1",
    source: legacyLineup({ status: "draft", selections: { ms: ["p-1"] } }),
  });
  assert.equal(first.ok, true);
  const second = await resolver.resolve({
    competitionId: "comp-1",
    source: legacyLineup({ status: "submitted", selections: { ms: ["p-2"] } }),
  });
  assert.equal(second.ok, false);
  assert.equal(
    second.error.code,
    LINEUP_RUNTIME_ERROR_CODE.LINEUP_IDENTITY_COLLISION
  );
});

test("3E resolve: invalid input / missing competitionId", async () => {
  const resolver = createLineupResolver();
  const result = await resolver.resolve({
    competitionId: "",
    source: legacyLineup(),
  });
  assert.equal(result.ok, false);
  assert.equal(result.error.code, LINEUP_RUNTIME_ERROR_CODE.INVALID_LINEUP);
});

test("3E resolve: missing lineup source", async () => {
  const resolver = createLineupResolver();
  const result = await resolver.resolve({
    competitionId: "comp-1",
    source: null,
  });
  assert.equal(result.ok, false);
  assert.equal(result.error.code, LINEUP_RUNTIME_ERROR_CODE.LINEUP_NOT_FOUND);
});

test("3E resolve: unsupported status", async () => {
  const resolver = createLineupResolver();
  const result = await resolver.resolve({
    competitionId: "comp-1",
    source: legacyLineup({ status: "mystery-status" }),
  });
  assert.equal(result.ok, false);
  assert.equal(
    result.error.code,
    LINEUP_RUNTIME_ERROR_CODE.UNSUPPORTED_LINEUP_STATUS
  );
});

test("3E resolve: duplicate participant fails", async () => {
  const resolver = createLineupResolver();
  const result = await resolver.resolve({
    competitionId: "comp-1",
    source: legacyLineup({
      selections: {
        md: ["p-1", "p-1"],
      },
    }),
  });
  assert.equal(result.ok, false);
  assert.equal(
    result.error.code,
    LINEUP_RUNTIME_ERROR_CODE.LINEUP_DUPLICATE_PARTICIPANT
  );
});

test("3E resolve: roster membership validation via injected roster", async () => {
  const resolver = createLineupResolver();
  const ok = await resolver.resolve({
    competitionId: "comp-1",
    source: legacyLineup({ selections: { ms: ["p-1"] } }),
    context: { roster: rosterWith("p-1", "p-2") },
  });
  assert.equal(ok.ok, true);

  const fail = await resolver.resolve({
    competitionId: "comp-1",
    source: legacyLineup({
      matchupId: "mu-2",
      selections: { ms: ["p-missing"] },
    }),
    context: { roster: rosterWith("p-1", "p-2") },
  });
  assert.equal(fail.ok, false);
  assert.equal(
    fail.error.code,
    LINEUP_RUNTIME_ERROR_CODE.LINEUP_PARTICIPANT_NOT_IN_ROSTER
  );
});

test("3E resolve: duplicate slot key fails", async () => {
  const resolver = createLineupResolver();
  const result = await resolver.resolve({
    competitionId: "comp-1",
    source: {
      matchupId: "mu-dup",
      teamId: "team-1",
      status: "draft",
      slots: [
        createCompetitionLineupSlot({
          id: "a",
          disciplineOrSideKey: "ms",
          index: 0,
          person: createParticipantReference({
            kind: PARTICIPANT_REFERENCE_KIND.PLAYER_PROFILE,
            id: "p-1",
          }),
        }),
        createCompetitionLineupSlot({
          id: "b",
          disciplineOrSideKey: "ms",
          index: 0,
          person: createParticipantReference({
            kind: PARTICIPANT_REFERENCE_KIND.PLAYER_PROFILE,
            id: "p-2",
          }),
        }),
      ],
    },
  });
  assert.equal(result.ok, false);
  assert.equal(result.error.code, LINEUP_RUNTIME_ERROR_CODE.LINEUP_SLOT_DUPLICATE);
});

test("3E transitions: allowed and locked protection", () => {
  const submit = assertLineupTransitionAllowed({
    action: LINEUP_ACTION.SUBMIT,
    fromStatus: COMPETITION_LINEUP_STATUS.DRAFT,
  });
  assert.equal(submit.toStatus, COMPETITION_LINEUP_STATUS.SUBMITTED);

  assert.throws(
    () =>
      assertLineupTransitionAllowed({
        action: LINEUP_ACTION.SUBMIT,
        fromStatus: COMPETITION_LINEUP_STATUS.LOCKED,
      }),
    (err) =>
      err instanceof LineupRuntimeError &&
      err.code === LINEUP_RUNTIME_ERROR_CODE.LINEUP_LOCKED
  );

  assert.throws(
    () =>
      assertLineupTransitionAllowed({
        action: LINEUP_ACTION.SAVE_DRAFT,
        fromStatus: COMPETITION_LINEUP_STATUS.PUBLISHED,
      }),
    (err) =>
      err instanceof LineupRuntimeError &&
      err.code === LINEUP_RUNTIME_ERROR_CODE.LINEUP_ALREADY_PUBLISHED
  );
});

test("3E DI: resolveRoster + resolveTeam callbacks", async () => {
  let rosterCalls = 0;
  let teamCalls = 0;
  const resolver = createLineupResolver({
    resolveTeam: async () => {
      teamCalls += 1;
      return {
        ok: true,
        team: { id: "team-1", competitionId: "comp-1", name: "Alpha" },
      };
    },
    resolveRoster: async () => {
      rosterCalls += 1;
      return { ok: true, roster: rosterWith("p-1", "p-2", "p-3") };
    },
  });
  const result = await resolver.resolve({
    competitionId: "comp-1",
    source: legacyLineup(),
  });
  assert.equal(result.ok, true);
  assert.equal(teamCalls, 1);
  assert.equal(rosterCalls, 1);
  assert.equal(result.lineup.rosterId, "roster:team-1");
});

test("3E DI: dependency failure mapping", async () => {
  const resolver = createLineupResolver({
    resolveRoster: async () => {
      throw new Error("roster boom");
    },
  });
  const result = await resolver.resolve({
    competitionId: "comp-1",
    source: legacyLineup({ matchupId: "mu-dep" }),
  });
  assert.equal(result.ok, false);
  assert.equal(
    result.error.code,
    LINEUP_RUNTIME_ERROR_CODE.LINEUP_DEPENDENCY_FAILED
  );
  assert.equal(result.error.details.dependency, "resolveRoster");
});

test("3E policy: injected lineupPolicy can reject slots", async () => {
  const resolver = createLineupResolver({
    lineupPolicy: {
      id: "TEST_POLICY",
      validateSlots() {
        return {
          ok: false,
          code: LINEUP_RUNTIME_ERROR_CODE.LINEUP_SLOT_INELIGIBLE,
          message: "Format rejected",
          details: { reason: "gender" },
        };
      },
    },
  });
  const result = await resolver.resolve({
    competitionId: "comp-1",
    source: legacyLineup({ matchupId: "mu-pol" }),
  });
  assert.equal(result.ok, false);
  assert.equal(result.error.code, LINEUP_RUNTIME_ERROR_CODE.LINEUP_SLOT_INELIGIBLE);
  assert.equal(result.error.details.policyId, "TEST_POLICY");
});

test("3E policy: default noop allows resolve", async () => {
  const policy = createNoopLineupPolicy();
  const resolver = createLineupResolver({ lineupPolicy: policy });
  const result = await resolver.resolve({
    competitionId: "comp-1",
    source: legacyLineup({ matchupId: "mu-noop" }),
  });
  assert.equal(result.ok, true);
  assert.equal(result.diagnostics.policyId, policy.id);
});

test("3E persistence stub opt-in only", async () => {
  const port = createInMemoryLineupPersistencePort();
  const resolver = createLineupResolver({
    persistence: port,
    enablePersistence: true,
  });
  const result = await resolver.resolve({
    competitionId: "comp-1",
    source: legacyLineup({ matchupId: "mu-p" }),
  });
  assert.equal(result.ok, true);
  const saved = await port.getById(result.lineup.id);
  assert.equal(saved?.teamId, "team-1");
});

test("3E persistence default OFF does not write", async () => {
  const port = createInMemoryLineupPersistencePort();
  const resolver = createLineupResolver({ persistence: port });
  const result = await resolver.resolve({
    competitionId: "comp-1",
    source: legacyLineup({ matchupId: "mu-no-write" }),
  });
  assert.equal(result.ok, true);
  assert.equal(await port.getById(result.lineup.id), null);
  assert.equal(result.diagnostics.persistenceEnabled, false);
});

test("3E resolve: batch preserves order", async () => {
  const resolver = createLineupResolver();
  const results = await resolver.resolveBatch([
    {
      competitionId: "c",
      source: legacyLineup({ matchupId: "mu-a", teamId: "t1", selections: { ms: ["a"] } }),
    },
    {
      competitionId: "c",
      source: legacyLineup({ matchupId: "mu-b", teamId: "t2", selections: { ms: ["b"] } }),
    },
  ]);
  assert.equal(results.length, 2);
  assert.equal(results[0].lineup?.contextId, "mu-a");
  assert.equal(results[1].lineup?.contextId, "mu-b");
});

test("3E mapper: direct map helper + slot ids", () => {
  const lineup = mapLegacyLineupToCompetitionLineup(
    {
      matchupId: "mu-x",
      teamId: "t",
      status: "not_submitted",
      selections: { md: ["p1", "p2"] },
    },
    { competitionId: "c" }
  );
  assert.equal(lineup.status, COMPETITION_LINEUP_STATUS.DRAFT);
  assert.equal(lineup.identityKey, "c::LINEUP::mu-x::t");
  assert.equal(lineup.slots[0].id, "c::LINEUP::mu-x::t::md::0");
  assert.equal(lineup.slots[1].person.id, "p2");
  assert.equal(
    lineup.extensions?.payload?.sourceType,
    LINEUP_SOURCE_TYPE.LEGACY_LINEUP
  );
});

test("3E identity mismatch fails when identityKey wrong", async () => {
  const badResolver = createLineupResolver({
    adapters: [
      {
        id: "BAD",
        sourceType: "BAD",
        supports: () => true,
        map: () => ({
          ...mapLegacyLineupToCompetitionLineup(
            legacyLineup({ matchupId: "mu-bad2" }),
            { competitionId: "comp-1" }
          ),
          identityKey: "wrong::key",
        }),
      },
    ],
  });
  const result = await badResolver.resolve({
    competitionId: "comp-1",
    source: legacyLineup({ matchupId: "mu-bad2" }),
  });
  assert.equal(result.ok, false);
  assert.equal(
    result.error.code,
    LINEUP_RUNTIME_ERROR_CODE.LINEUP_IDENTITY_MISMATCH
  );
});
