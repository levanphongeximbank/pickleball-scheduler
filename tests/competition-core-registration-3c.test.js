import test from "node:test";
import assert from "node:assert/strict";

import {
  createRegistrationResolver,
  createLegacyRegistrationAdapter,
  createRegistrationIdentityLookup,
  createInMemoryRegistrationPersistencePort,
  mapLegacyIndividualEntryToRegistration,
  mapLegacyTeamRegistrationToRegistration,
  buildRegistrationIdentityKey,
  createRegistrationIdentity,
  REGISTRATION_RUNTIME_ERROR_CODE,
  REGISTRATION_ADAPTER_ID,
  REGISTRATION_KIND,
  REGISTRATION_SOURCE_TYPE,
} from "../src/features/competition-core/registrations/index.js";
import { PARTICIPANT_REFERENCE_KIND } from "../src/features/competition-core/participants/enums/identityKinds.js";
import { COMPETITION_REGISTRATION_STATUS } from "../src/features/competition-core/participants/enums/statuses.js";

test("3C resolve: valid individual registration mapping", async () => {
  const resolver = createRegistrationResolver();
  const source = {
    id: "entry-1",
    status: "pending",
    playerIds: ["p-1"],
    registeredAt: "2026-01-01T00:00:00.000Z",
  };
  const result = await resolver.resolve({
    competitionId: "comp-1",
    source,
  });

  assert.equal(result.ok, true);
  assert.equal(result.adapterId, REGISTRATION_ADAPTER_ID.LEGACY);
  assert.equal(result.registration.registrationKind, REGISTRATION_KIND.INDIVIDUAL);
  assert.equal(result.registration.sourceType, REGISTRATION_SOURCE_TYPE.LEGACY_INDIVIDUAL_ENTRY);
  assert.equal(result.registration.status, COMPETITION_REGISTRATION_STATUS.PENDING);
  assert.equal(result.registration.sourceId, "entry-1");
  assert.equal(result.registration.entryId, "entry-1");
  assert.equal(result.registration.metadata.entryRole, "singles");
  assert.equal(
    result.identity.key,
    buildRegistrationIdentityKey({
      competitionId: "comp-1",
      registrationKind: REGISTRATION_KIND.INDIVIDUAL,
      stableSourceIdentity: "entry-1",
    })
  );
  assert.equal(source.status, "pending");
  assert.equal(Object.keys(source).includes("identityKey"), false);
});

test("3C resolve: valid pair registration keeps pair as metadata (INDIVIDUAL kind)", async () => {
  const resolver = createRegistrationResolver();
  const result = await resolver.resolve({
    competitionId: "comp-1",
    source: {
      id: "entry-pair",
      status: "approved",
      playerIds: ["a", "b"],
      pairType: "same_club",
      partnerInviteToken: "invite-abc",
    },
  });
  assert.equal(result.ok, true);
  assert.equal(result.registration.registrationKind, REGISTRATION_KIND.INDIVIDUAL);
  assert.equal(result.registration.metadata.entryRole, "doubles");
  assert.equal(result.registration.metadata.pairType, "same_club");
  assert.equal(result.registration.memberRefs.length, 2);
});

test("3C resolve: valid team registration", async () => {
  const resolver = createRegistrationResolver();
  const result = await resolver.resolve({
    competitionId: "comp-1",
    source: {
      id: "reg-t1",
      teamId: "team-9",
      status: "approved",
      playerIds: ["p-1", "p-2"],
      captainPlayerId: "p-1",
      __sourceType: REGISTRATION_SOURCE_TYPE.LEGACY_TEAM_REGISTRATION,
    },
  });
  assert.equal(result.ok, true);
  assert.equal(result.registration.registrationKind, REGISTRATION_KIND.TEAM);
  assert.equal(result.registration.sourceType, REGISTRATION_SOURCE_TYPE.LEGACY_TEAM_REGISTRATION);
  assert.equal(result.registration.sourceId, "team-9");
  assert.equal(result.registration.metadata.captainPlayerId, "p-1");
  assert.equal(result.registration.metadata.captainRole, "captain");
  assert.equal(result.registration.entryId, "entry:tt:team-9");
});

test("3C resolve: Official BTC is source type, not kind", async () => {
  const resolver = createRegistrationResolver();
  const result = await resolver.resolve({
    competitionId: "comp-1",
    sourceType: REGISTRATION_SOURCE_TYPE.OFFICIAL_BTC,
    source: {
      id: "entry-p100",
      status: "active",
      playerIds: ["p-100"],
      btcDirect: true,
    },
  });
  assert.equal(result.ok, true);
  assert.equal(result.registration.registrationKind, REGISTRATION_KIND.INDIVIDUAL);
  assert.equal(result.registration.sourceType, REGISTRATION_SOURCE_TYPE.OFFICIAL_BTC);
  assert.equal(result.registration.status, COMPETITION_REGISTRATION_STATUS.APPROVED);
});

test("3C resolve: guest preservation", async () => {
  const resolver = createRegistrationResolver();
  const result = await resolver.resolve({
    competitionId: "comp-1",
    source: {
      id: "entry-g",
      status: "pending",
      playerIds: ["guest-9"],
    },
    context: {
      playerById: {
        "guest-9": { id: "guest-9", name: "Walk-in", isGuest: true },
      },
    },
  });
  assert.equal(result.ok, true);
  assert.equal(result.registration.memberRefs[0].kind, PARTICIPANT_REFERENCE_KIND.GUEST);
  assert.equal(result.registration.memberRefs[0].id, "guest-9");
  assert.equal(result.registration.metadata.guestPreserved, true);
});

test("3C resolve: deterministic identity stable across resolves", async () => {
  const resolver = createRegistrationResolver({
    identityLookup: createRegistrationIdentityLookup(),
  });
  const source = { id: "entry-stable", status: "pending", playerIds: ["p-1"] };
  const a = await resolver.resolve({ competitionId: "comp-1", source });
  const b = await resolver.resolve({ competitionId: "comp-1", source });
  assert.equal(a.ok, true);
  assert.equal(b.ok, true);
  assert.equal(a.identity.key, b.identity.key);
});

test("3C identity: immutability (frozen) and no display-name in key", () => {
  const identity = createRegistrationIdentity({
    competitionId: "c",
    registrationKind: REGISTRATION_KIND.INDIVIDUAL,
    stableSourceIdentity: "entry-1",
  });
  assert.throws(() => {
    identity.stableSourceIdentity = "mutated";
  });
  assert.equal(identity.key.includes("Alice"), false);
  assert.equal(
    identity.key,
    "c::INDIVIDUAL::entry-1"
  );
});

test("3C resolve: identity collision raises typed error", async () => {
  const lookup = createRegistrationIdentityLookup();
  const resolver = createRegistrationResolver({ identityLookup: lookup });

  const first = await resolver.resolve({
    competitionId: "comp-1",
    source: { id: "entry-1", status: "pending", playerIds: ["p-1"] },
  });
  assert.equal(first.ok, true);

  const colliding = mapLegacyIndividualEntryToRegistration(
    { id: "entry-1", status: "approved", playerIds: ["p-2"] },
    { competitionId: "comp-1" }
  );
  const forged = { ...colliding, id: "reg:ind:forged" };

  assert.throws(
    () => lookup.register(forged),
    (err) => err.code === REGISTRATION_RUNTIME_ERROR_CODE.REGISTRATION_IDENTITY_COLLISION
  );
});

test("3C resolveBatch: duplicate player detection", async () => {
  const resolver = createRegistrationResolver();
  const results = await resolver.resolveBatch([
    {
      competitionId: "comp-1",
      source: { id: "e1", status: "pending", playerIds: ["p-dup"] },
    },
    {
      competitionId: "comp-1",
      source: { id: "e2", status: "pending", playerIds: ["p-dup"] },
    },
  ]);
  assert.equal(results[0].ok, true);
  assert.equal(results[1].ok, false);
  assert.equal(
    results[1].error.code,
    REGISTRATION_RUNTIME_ERROR_CODE.DUPLICATE_REGISTRATION
  );
});

test("3C resolve: invalid participant reference (empty guest id)", async () => {
  const resolver = createRegistrationResolver();
  const result = await resolver.resolve({
    competitionId: "comp-1",
    source: {
      id: "entry-bad",
      status: "pending",
      playerIds: [""],
    },
  });
  assert.equal(result.ok, false);
  assert.equal(
    result.error.code,
    REGISTRATION_RUNTIME_ERROR_CODE.INVALID_PARTICIPANT_REFERENCE
  );
});

test("3C resolve: unsupported source", async () => {
  const resolver = createRegistrationResolver();
  const result = await resolver.resolve({
    competitionId: "comp-1",
    source: { foo: "bar" },
  });
  assert.equal(result.ok, false);
  assert.equal(
    result.error.code,
    REGISTRATION_RUNTIME_ERROR_CODE.UNSUPPORTED_REGISTRATION_SOURCE
  );
});

test("3C resolve: unsupported kind", async () => {
  const resolver = createRegistrationResolver();
  const result = await resolver.resolve({
    competitionId: "comp-1",
    registrationKind: "REPRESENTATIVE",
    source: {
      id: "entry-1",
      status: "pending",
      playerIds: ["p-1"],
    },
  });
  assert.equal(result.ok, false);
  assert.equal(
    result.error.code,
    REGISTRATION_RUNTIME_ERROR_CODE.UNSUPPORTED_REGISTRATION_KIND
  );
});

test("3C resolve: unsupported status", async () => {
  const resolver = createRegistrationResolver();
  const result = await resolver.resolve({
    competitionId: "comp-1",
    source: {
      id: "entry-1",
      status: "mystery_status",
      playerIds: ["p-1"],
    },
  });
  assert.equal(result.ok, false);
  assert.equal(
    result.error.code,
    REGISTRATION_RUNTIME_ERROR_CODE.UNSUPPORTED_REGISTRATION_STATUS
  );
});

test("3C resolveBatch: preserves input ordering", async () => {
  const resolver = createRegistrationResolver();
  const results = await resolver.resolveBatch([
    {
      competitionId: "comp-1",
      source: { id: "z-last", status: "pending", playerIds: ["z"] },
    },
    {
      competitionId: "comp-1",
      source: { id: "a-first", status: "pending", playerIds: ["a"] },
    },
    {
      competitionId: "comp-1",
      sourceType: REGISTRATION_SOURCE_TYPE.LEGACY_TEAM_REGISTRATION,
      source: {
        id: "t-mid",
        teamId: "team-mid",
        status: "approved",
        playerIds: [],
        __sourceType: REGISTRATION_SOURCE_TYPE.LEGACY_TEAM_REGISTRATION,
      },
    },
  ]);
  assert.equal(results.length, 3);
  assert.equal(results[0].registration.sourceId, "z-last");
  assert.equal(results[1].registration.sourceId, "a-first");
  assert.equal(results[2].registration.sourceId, "team-mid");
});

test("3C resolve: side-effect isolation — source not mutated; no persistence by default", async () => {
  const persistence = createInMemoryRegistrationPersistencePort();
  const resolver = createRegistrationResolver({ persistence });
  const source = {
    id: "entry-iso",
    status: "pending",
    playerIds: ["p-iso"],
    name: "Keep Me",
  };
  const before = JSON.stringify(source);
  const result = await resolver.resolve({ competitionId: "comp-1", source });
  assert.equal(result.ok, true);
  assert.equal(JSON.stringify(source), before);
  const stored = await persistence.findByIdentityKey(result.identity);
  assert.equal(stored, null);
});

test("3C persistence: stub works only when explicitly enabled", async () => {
  const persistence = createInMemoryRegistrationPersistencePort();
  const resolver = createRegistrationResolver({
    persistence,
    enablePersistence: true,
  });
  const result = await resolver.resolve({
    competitionId: "comp-1",
    source: { id: "entry-p", status: "pending", playerIds: ["p"] },
  });
  assert.equal(result.ok, true);
  const stored = await persistence.findByIdentityKey(result.identity);
  assert.ok(stored);
  assert.equal(stored.id, result.registration.id);
});

test("3C resolve: missing source → REGISTRATION_NOT_FOUND", async () => {
  const resolver = createRegistrationResolver();
  const result = await resolver.resolve({
    competitionId: "comp-1",
    source: null,
  });
  assert.equal(result.ok, false);
  assert.equal(
    result.error.code,
    REGISTRATION_RUNTIME_ERROR_CODE.REGISTRATION_NOT_FOUND
  );
});

test("3C resolve: waitlisted has no entryId (OD-10)", async () => {
  const resolver = createRegistrationResolver();
  const result = await resolver.resolve({
    competitionId: "comp-1",
    source: {
      id: "entry-w",
      status: "waitlisted",
      waitlistPosition: 2,
      playerIds: ["p-w"],
    },
  });
  assert.equal(result.ok, true);
  assert.equal(result.registration.status, COMPETITION_REGISTRATION_STATUS.WAITLISTED);
  assert.equal(result.registration.entryId, null);
  assert.equal(result.registration.waitlistPosition, 2);
});

test("3C participant DI: uses injected resolveParticipant without app registry", async () => {
  let calls = 0;
  const resolver = createRegistrationResolver({
    resolveParticipant: async (player) => {
      calls += 1;
      return {
        ok: true,
        participant: {
          person: {
            kind: PARTICIPANT_REFERENCE_KIND.PLAYER_PROFILE,
            id: String(player.id),
          },
        },
      };
    },
  });
  const result = await resolver.resolve({
    competitionId: "comp-1",
    source: { id: "entry-di", status: "pending", playerIds: ["di-1"] },
  });
  assert.equal(result.ok, true);
  assert.equal(calls, 1);
  assert.equal(result.registration.memberRefs[0].id, "di-1");
});

test("3C mapper: team map-only helper", () => {
  const mapped = mapLegacyTeamRegistrationToRegistration(
    {
      id: "r1",
      teamId: "t1",
      status: "submitted",
      playerIds: ["a"],
    },
    { competitionId: "c1" }
  );
  assert.equal(mapped.status, COMPETITION_REGISTRATION_STATUS.SUBMITTED);
  assert.equal(mapped.registrationKind, REGISTRATION_KIND.TEAM);
});

test("3C adapter: supports individual and team; rejects unknown", () => {
  const adapter = createLegacyRegistrationAdapter();
  assert.equal(
    adapter.supports({ id: "e1", playerIds: ["p"] }),
    true
  );
  assert.equal(
    adapter.supports({
      id: "r1",
      teamId: "t1",
      __sourceType: REGISTRATION_SOURCE_TYPE.LEGACY_TEAM_REGISTRATION,
    }),
    true
  );
  assert.equal(adapter.supports({ foo: 1 }), false);
});
