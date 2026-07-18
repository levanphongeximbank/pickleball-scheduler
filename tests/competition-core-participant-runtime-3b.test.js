import test from "node:test";
import assert from "node:assert/strict";

import {
  createParticipantResolver,
  createLegacyParticipantAdapter,
  createIdentityLookup,
  createInMemoryParticipantPersistencePort,
  mapLegacyPlayerToCompetitionParticipant,
  PARTICIPANT_RUNTIME_ERROR_CODE,
  PARTICIPANT_ADAPTER_ID,
  LEGACY_PLAYER_SOURCE_TYPE,
} from "../src/features/competition-core/participants/runtime/index.js";
import {
  buildParticipantIdentityKey,
  createParticipantIdentity,
} from "../src/features/competition-core/participants/contracts/identity.js";
import { PARTICIPANT_REFERENCE_KIND } from "../src/features/competition-core/participants/enums/identityKinds.js";
import { SHADOW_COMPARISON_STATUS } from "../src/features/competition-core/runtime-control/shadow/constants/shadowComparisonStatuses.js";

test("3B resolve: success maps legacy player to CompetitionParticipant", async () => {
  const resolver = createParticipantResolver();
  const source = { id: "p-100", name: "Alice", competitionId: "comp-1" };
  const result = await resolver.resolve({
    competitionId: "comp-1",
    source,
  });

  assert.equal(result.ok, true);
  assert.equal(result.adapterId, PARTICIPANT_ADAPTER_ID.LEGACY);
  assert.equal(result.sourceType, LEGACY_PLAYER_SOURCE_TYPE);
  assert.equal(result.participant.competitionId, "comp-1");
  assert.equal(result.participant.person.kind, PARTICIPANT_REFERENCE_KIND.PLAYER_PROFILE);
  assert.equal(result.participant.person.id, "p-100");
  assert.equal(result.participant.displayName, "Alice");
  assert.equal(
    result.identity.key,
    buildParticipantIdentityKey({
      competitionId: "comp-1",
      kind: PARTICIPANT_REFERENCE_KIND.PLAYER_PROFILE,
      id: "p-100",
    })
  );
  // Source must not be mutated
  assert.equal(source.name, "Alice");
  assert.equal(Object.keys(source).includes("person"), false);
});

test("3B resolve: participant missing source → PARTICIPANT_NOT_FOUND", async () => {
  const resolver = createParticipantResolver();
  const result = await resolver.resolve({
    competitionId: "comp-1",
    source: null,
  });
  assert.equal(result.ok, false);
  assert.equal(result.error.code, PARTICIPANT_RUNTIME_ERROR_CODE.PARTICIPANT_NOT_FOUND);
});

test("3B resolve: unsupported source → UNSUPPORTED_SOURCE", async () => {
  const resolver = createParticipantResolver();
  const result = await resolver.resolve({
    competitionId: "comp-1",
    source: { entryRole: "singles", participantIds: ["a", "b"] },
  });
  assert.equal(result.ok, false);
  assert.equal(result.error.code, PARTICIPANT_RUNTIME_ERROR_CODE.UNSUPPORTED_SOURCE);
});

test("3B resolve: invalid mapping missing id → INVALID_MAPPING", async () => {
  const resolver = createParticipantResolver();
  const result = await resolver.resolve({
    competitionId: "comp-1",
    source: { name: "NoId", __sourceType: LEGACY_PLAYER_SOURCE_TYPE },
  });
  assert.equal(result.ok, false);
  assert.equal(result.error.code, PARTICIPANT_RUNTIME_ERROR_CODE.INVALID_MAPPING);
});

test("3B resolve: guest preserved with identity", async () => {
  const resolver = createParticipantResolver();
  const result = await resolver.resolve({
    competitionId: "comp-1",
    source: { id: "guest-9", name: "Walk-in", isGuest: true },
  });
  assert.equal(result.ok, true);
  assert.equal(result.participant.person.kind, PARTICIPANT_REFERENCE_KIND.GUEST);
  assert.equal(result.participant.person.id, "guest-9");
  assert.ok(result.identity.key.includes("GUEST"));
});

test("3B resolve: guest missing id fails — no silent loss", async () => {
  const resolver = createParticipantResolver();
  const result = await resolver.resolve({
    competitionId: "comp-1",
    source: { name: "Ghost", isGuest: true, __sourceType: LEGACY_PLAYER_SOURCE_TYPE },
  });
  assert.equal(result.ok, false);
  assert.equal(result.error.code, PARTICIPANT_RUNTIME_ERROR_CODE.INVALID_MAPPING);
});

test("3B resolve: duplicate identity with different payload → IDENTITY_COLLISION", async () => {
  const lookup = createIdentityLookup();
  const resolver = createParticipantResolver({ identityLookup: lookup });

  const first = await resolver.resolve({
    competitionId: "comp-1",
    source: { id: "p-1", name: "A" },
  });
  assert.equal(first.ok, true);

  // Force a colliding register with different participant id but same identity key
  const colliding = mapLegacyPlayerToCompetitionParticipant(
    { id: "p-1", name: "B" },
    { competitionId: "comp-1" }
  );
  // Mutate id after map to simulate divergent payload same identity
  const forged = { ...colliding, id: "cp:forged-different" };

  assert.throws(
    () => lookup.register(forged),
    (err) => err.code === PARTICIPANT_RUNTIME_ERROR_CODE.IDENTITY_COLLISION
  );

  const second = await resolver.resolve({
    competitionId: "comp-1",
    source: { id: "p-1", name: "A" },
  });
  // Idempotent same payload is OK
  assert.equal(second.ok, true);
});

test("3B resolve: athletes and players keep distinct identity spaces", async () => {
  const resolver = createParticipantResolver();
  const player = await resolver.resolve({
    competitionId: "comp-1",
    source: { id: "100", name: "Player" },
  });
  const athlete = await resolver.resolve({
    competitionId: "comp-1",
    source: { id: "100", name: "Athlete", kind: PARTICIPANT_REFERENCE_KIND.ATHLETE },
  });
  assert.equal(player.ok, true);
  assert.equal(athlete.ok, true);
  assert.notEqual(player.identity.key, athlete.identity.key);
});

test("3B legacy adapter: map-only and supports legacy player", () => {
  const adapter = createLegacyParticipantAdapter();
  assert.equal(adapter.id, PARTICIPANT_ADAPTER_ID.LEGACY);
  assert.equal(adapter.supports({ id: "x" }), true);
  assert.equal(adapter.supports({ entryRole: "a", participantIds: [] }), false);
  const mapped = adapter.map(
    { id: "x", name: "X" },
    { competitionId: "c1" }
  );
  assert.equal(mapped.person.id, "x");
});

test("3B persistence: in-memory stub works when explicitly enabled", async () => {
  const persistence = createInMemoryParticipantPersistencePort();
  const resolver = createParticipantResolver({
    persistence,
    enablePersistence: true,
  });
  const result = await resolver.resolve({
    competitionId: "comp-1",
    source: { id: "p-2", name: "Bob" },
  });
  assert.equal(result.ok, true);
  const stored = await persistence.findByIdentityKey(result.identity);
  assert.ok(stored);
  assert.equal(stored.id, result.participant.id);
});

test("3B persistence: default resolver does not write", async () => {
  const persistence = createInMemoryParticipantPersistencePort();
  const resolver = createParticipantResolver({ persistence });
  const result = await resolver.resolve({
    competitionId: "comp-1",
    source: { id: "p-3", name: "C" },
  });
  assert.equal(result.ok, true);
  const stored = await persistence.findByIdentityKey(result.identity);
  assert.equal(stored, null);
});

test("3B shadow: resolveShadow equivalent when compareWith matches", async () => {
  const resolver = createParticipantResolver();
  const source = { id: "p-s", name: "Shadow", competitionId: "comp-1" };
  const { resolveResult, shadow } = await resolver.resolveShadow(
    { competitionId: "comp-1", source },
    {}
  );
  assert.equal(resolveResult.ok, true);
  assert.equal(shadow.status, SHADOW_COMPARISON_STATUS.SKIPPED);

  const again = await resolver.resolve({ competitionId: "comp-1", source });
  const withCompare = await resolver.resolveShadow(
    { competitionId: "comp-1", source: { id: "p-s2", name: "S2" } },
    { compareWith: again.participant }
  );
  // Different person → non-equivalent
  assert.equal(withCompare.resolveResult.ok, true);
  assert.equal(withCompare.shadow.status, SHADOW_COMPARISON_STATUS.NON_EQUIVALENT);
});

test("3B shadow: equivalent fingerprints for same identity", async () => {
  const resolver = createParticipantResolver();
  const source = { id: "p-eq", name: "Eq" };
  const primary = await resolver.resolve({ competitionId: "comp-1", source });
  const shadowed = await resolver.resolveShadow(
    { competitionId: "comp-1", source },
    { compareWith: primary.participant }
  );
  assert.equal(shadowed.shadow.status, SHADOW_COMPARISON_STATUS.EQUIVALENT);
});

test("3B identity: createParticipantIdentity is deterministic and frozen", () => {
  const a = createParticipantIdentity({
    competitionId: "c",
    kind: PARTICIPANT_REFERENCE_KIND.GUEST,
    id: "g1",
  });
  const b = createParticipantIdentity({
    competitionId: "c",
    kind: PARTICIPANT_REFERENCE_KIND.GUEST,
    id: "g1",
  });
  assert.equal(a.key, b.key);
  assert.throws(() => {
    a.id = "mutated";
  });
});
