/**
 * Canonical Competition Adapter Contracts 14 — foundation, catalog, conformance.
 */

import assert from "node:assert/strict";
import test from "node:test";
import {
  COMPETITION_COURT_ADAPTER_CONTRACT_NAME,
  COMPETITION_COURT_ADAPTER_CONTRACT_VERSION,
} from "../src/features/competition-core/contracts/competitionCourtAdapterContract.js";
import {
  COMPETITION_REFEREE_ADAPTER_CONTRACT_ID,
  COMPETITION_REFEREE_ADAPTER_CONTRACT_LOCKED,
  COMPETITION_REFEREE_ADAPTER_CONTRACT_VERSION,
  createReferenceRefereeAdapter,
  runCompetitionRefereeAdapterConformance,
} from "../src/features/competition-engine/integration/referee/index.js";
import { RESOLUTION_OUTCOME } from "../src/features/player/constants/resolutionOutcomes.js";
import {
  ANALYTICS_REPORTING_CONTRACT,
  AUDIT_CONTRACT,
  CLUB_TEAM_MEMBERSHIP_CONTRACT,
  COMPETITION_ADAPTER_CONTRACT_LOCKED,
  COMPETITION_ADAPTER_CONTRACT_VERSION_V1,
  COMPETITION_CANONICAL_ADAPTER_CONTRACTS_V1,
  CRM_SPONSOR_CONTRACT,
  FEDERATION_EXTERNAL_AUTHORITY_CONTRACT,
  FILE_MEDIA_CONTRACT,
  FINANCE_PAYMENT_CONTRACT,
  FORBIDDEN_COMPETITION_CORE_AUTHORITY_KEYS,
  IDENTITY_ACCESS_CONTRACT,
  NOTIFICATION_COMMUNICATION_CONTRACT,
  OFFICIAL_CATALOG_META,
  OFFICIAL_CONTRACT_COUNT,
  PARTICIPANT_CONTRACT,
  PRODUCTION_BINDING_STATUS,
  RANKING_CONTRACT,
  RUNTIME_CLASSIFICATION,
  SHARED_ADAPTER_ERROR_CODE,
  STREAMING_SCOREBOARD_CONTRACT,
  THIS_WORKSTREAM_CONTRACT_COUNT,
  WORKSTREAM_CONTRACT_DEFINITIONS,
  WORKSTREAM_OWNED_CONTRACT_IDS,
  assertCanonicalAdapterDoesNotOwnAuthority,
  assertCompetitionAdapter,
  assertKnownCompetitionAdapterContract,
  createClubTeamMembershipBinding,
  createCompetitionAdapterContractCatalog,
  createCompetitionAdapterImplementationRegistry,
  createContractAdapter,
  createDefaultWorkstreamAdapters,
  createIdentityAccessBinding,
  createNotConfiguredContractAdapter,
  createParticipantBinding,
  createRatingBinding,
  createTenantOrganizationBinding,
  getCompetitionAdapterContract,
  isCompetitionAdapterContractError,
  listCompetitionAdapterContracts,
  runCompetitionAdapterConformance,
} from "../src/features/competition-engine/integration/contracts/index.js";

function expectCode(fn, code) {
  try {
    const value = fn();
    if (value && typeof value.then === "function") {
      return value.then(
        () => {
          assert.fail(`expected ${code}`);
        },
        (err) => {
          assert.equal(isCompetitionAdapterContractError(err), true);
          assert.equal(err.code, code);
          assert.equal(err.failClosed, true);
        }
      );
    }
    assert.fail(`expected ${code}`);
  } catch (err) {
    assert.equal(isCompetitionAdapterContractError(err), true);
    assert.equal(err.code, code);
    assert.equal(err.failClosed, true);
  }
}

const BOUND_TENANT = "tenant-1";

const BASE_CTX = Object.freeze({
  contractVersion: "1.0.0",
  tenantId: BOUND_TENANT,
  competitionId: "comp-1",
  actorId: "actor-1",
  correlationId: "corr-1",
  participantId: "player-1",
  clubId: "club-1",
  matchId: "match-1",
  effectiveAt: "2026-01-01T00:00:00Z",
  idempotencyKey: "idem-1",
  role: "TEAM_CAPTAIN",
});

function mappedPlayer(playerId) {
  return {
    outcome: RESOLUTION_OUTCOME.MAPPED,
    playerId,
    authUserId: "auth-1",
    profile: { playerId, displayName: "Alice" },
  };
}

function runtimeDeps() {
  return {
    boundTenantId: BOUND_TENANT,
    identity: { boundTenantId: BOUND_TENANT },
    participant: {
      boundTenantId: BOUND_TENANT,
      getPlayerProfile: (playerId) => mappedPlayer(playerId),
    },
    membership: {
      boundTenantId: BOUND_TENANT,
      getActiveMembershipForUser: async (clubId, participantId) => ({
        ok: true,
        data: { clubId, userId: participantId, status: "active" },
      }),
    },
    rating: {
      boundTenantId: BOUND_TENANT,
      resolveRatings: ({ entryIds }) =>
        Object.fromEntries(entryIds.map((id) => [id, { ratingValue: 1100 }])),
    },
    notification: {
      boundTenantId: BOUND_TENANT,
      emitMatchScheduled: async () => ({ ok: true }),
    },
  };
}

test("shared kernel version and 14 locked contract IDs", () => {
  assert.equal(COMPETITION_ADAPTER_CONTRACT_VERSION_V1, "1.0.0");
  assert.equal(COMPETITION_ADAPTER_CONTRACT_LOCKED, true);
  assert.equal(OFFICIAL_CONTRACT_COUNT, 16);
  assert.equal(THIS_WORKSTREAM_CONTRACT_COUNT, 14);
  assert.equal(WORKSTREAM_OWNED_CONTRACT_IDS.length, 14);
  assert.equal(WORKSTREAM_CONTRACT_DEFINITIONS.length, 14);
  for (const def of WORKSTREAM_CONTRACT_DEFINITIONS) {
    assert.equal(def.contractVersion, "1.0.0");
    assert.equal(def.locked, true);
    assert.equal(Object.isFrozen(def), true);
    assert.ok(Array.isArray(def.capabilities) && def.capabilities.length > 0);
    for (const cap of def.capabilities) {
      assert.ok(["QUERY", "COMMAND", "EVENT"].includes(cap.kind), cap.name);
    }
    for (const key of FORBIDDEN_COMPETITION_CORE_AUTHORITY_KEYS) {
      assert.ok(def.forbiddenAuthorityKeys.includes(key), key);
    }
  }
  assert.equal(
    COMPETITION_CANONICAL_ADAPTER_CONTRACTS_V1.ownsCourtContract,
    false
  );
  assert.equal(
    COMPETITION_CANONICAL_ADAPTER_CONTRACTS_V1.ownsRefereeContract,
    false
  );
});

test("official catalog lists all 16 and keeps Court/Referee identities", () => {
  const list = listCompetitionAdapterContracts();
  assert.equal(list.length, 16);
  assert.equal(list.map((row) => row.ordinal).join(","), "1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16");
  const court = getCompetitionAdapterContract(COMPETITION_COURT_ADAPTER_CONTRACT_NAME);
  assert.equal(court.contractVersion, String(COMPETITION_COURT_ADAPTER_CONTRACT_VERSION));
  assert.equal(court.ownedByThisWorkstream, false);
  assert.equal(court.mergedVia, "PR #432");
  const referee = getCompetitionAdapterContract(COMPETITION_REFEREE_ADAPTER_CONTRACT_ID);
  assert.equal(referee.contractVersion, COMPETITION_REFEREE_ADAPTER_CONTRACT_VERSION);
  assert.equal(referee.locked, COMPETITION_REFEREE_ADAPTER_CONTRACT_LOCKED);
  assert.equal(referee.ownedByThisWorkstream, false);
  assertKnownCompetitionAdapterContract(
    "competition.identity-access.adapter.v1",
    "1.0.0"
  );
  expectCode(
    () => assertKnownCompetitionAdapterContract("competition.identity-access.adapter.v1", "2.0.0"),
    SHARED_ADAPTER_ERROR_CODE.INCOMPATIBLE_CONTRACT_VERSION
  );
  expectCode(
    () => getCompetitionAdapterContract("competition.unknown.adapter.v1"),
    SHARED_ADAPTER_ERROR_CODE.UNKNOWN_CONTRACT
  );
  assert.equal(OFFICIAL_CATALOG_META.courtContractId, "Competition Court Adapter Contract");
  assert.equal(OFFICIAL_CATALOG_META.refereeContractId, "competition.referee.adapter.v1");
});

test("catalog rejects duplicate registration and stays frozen", () => {
  const catalog = createCompetitionAdapterContractCatalog();
  expectCode(() => catalog.register(), SHARED_ADAPTER_ERROR_CODE.REGISTRY_FROZEN);
  expectCode(
    () =>
      createCompetitionAdapterContractCatalog([
        { ordinal: 1, contractId: "dup.a" },
        { ordinal: 2, contractId: "dup.a" },
      ]),
    SHARED_ADAPTER_ERROR_CODE.DUPLICATE_REGISTRATION
  );
});

test("malformed adapter and forbidden authority fail closed", () => {
  expectCode(
    () => assertCompetitionAdapter({}, IDENTITY_ACCESS_CONTRACT),
    SHARED_ADAPTER_ERROR_CODE.MALFORMED_ADAPTER
  );
  const fileAdapter = createNotConfiguredContractAdapter(FILE_MEDIA_CONTRACT);
  expectCode(
    () =>
      assertCanonicalAdapterDoesNotOwnAuthority(
        { ...fileAdapter, scoringEngine: {} },
        FILE_MEDIA_CONTRACT
      ),
    SHARED_ADAPTER_ERROR_CODE.FORBIDDEN_AUTHORITY
  );
  assert.throws(() => {
    fileAdapter.locked = false;
  });
});

test("not-configured required methods exist and fail closed", () => {
  const adapter = createNotConfiguredContractAdapter(FILE_MEDIA_CONTRACT);
  assert.equal(adapter.locked, true);
  assert.equal(Object.isFrozen(adapter), true);
  expectCode(
    () => adapter.getDocumentReference(BASE_CTX),
    SHARED_ADAPTER_ERROR_CODE.NOT_CONFIGURED
  );
});

test("identity / participant / membership / rating compatibility bindings", async () => {
  const identity = createIdentityAccessBinding({ boundTenantId: BOUND_TENANT });
  const actor = identity.resolveActorIdentity(BASE_CTX);
  assert.equal(actor.data.actorId, "actor-1");
  const auth = await identity.getAuthorizationEvidence(BASE_CTX);
  assert.equal(auth.status, "OK");
  assert.equal(auth.data.subjectId, "actor-1");
  const caps = await identity.getCapabilityEvidence(BASE_CTX);
  assert.ok(Array.isArray(caps.data.grantedPermissions));

  const participant = createParticipantBinding({
    boundTenantId: BOUND_TENANT,
    getPlayerProfile: (playerId) => mappedPlayer(playerId),
  });
  const resolved = participant.resolveCanonicalParticipant(BASE_CTX);
  assert.equal(resolved.data.id, "player-1");
  const profile = participant.getCompetitionSafeProfile(BASE_CTX);
  assert.equal(profile.data.displayName, "Alice");
  const status = participant.verifySourceStatus(BASE_CTX);
  assert.equal(status.data.eligibleSourceStatus, true);

  const membership = createClubTeamMembershipBinding({
    boundTenantId: BOUND_TENANT,
    getActiveMembershipForUser: async (clubId, participantId) => ({
      ok: true,
      data: { clubId, userId: participantId, status: "active" },
    }),
  });
  const member = await membership.getMembershipStatus(BASE_CTX);
  assert.equal(member.data.isMember, true);
  expectCode(
    () => membership.getTeamRoster(BASE_CTX),
    SHARED_ADAPTER_ERROR_CODE.NOT_CONFIGURED
  );

  const rating = createRatingBinding({
    boundTenantId: BOUND_TENANT,
    resolveRatings: ({ entryIds }) =>
      Object.fromEntries(entryIds.map((id) => [id, { ratingValue: 1205 }])),
  });
  const snap = rating.getRatingSnapshot(BASE_CTX);
  assert.equal(snap.data.ratingValue, 1205);
  assert.ok(snap.snapshotId);
  expectCode(
    () => rating.getRatingSnapshot({ ...BASE_CTX, tenantId: "other-tenant" }),
    SHARED_ADAPTER_ERROR_CODE.CROSS_TENANT_CONTEXT
  );
});

test("tenant scope IDs stay distinct and fail closed on missing tenant", () => {
  const tenant = createTenantOrganizationBinding({ boundTenantId: BOUND_TENANT });
  const scoped = tenant.distinguishScopeIds({
    ...BASE_CTX,
    organizationId: "org-1",
    venueId: "venue-1",
  });
  assert.equal(scoped.data.tenantId, BOUND_TENANT);
  assert.equal(scoped.data.organizationId, "org-1");
  assert.equal(scoped.data.clubId, "club-1");
  assert.equal(scoped.data.venueId, "venue-1");
  expectCode(
    () => tenant.resolveOrganizationIdentity(BASE_CTX),
    SHARED_ADAPTER_ERROR_CODE.NOT_CONFIGURED
  );
  expectCode(
    () => tenant.validateScope({ correlationId: "c1", tenantName: "Acme" }),
    SHARED_ADAPTER_ERROR_CODE.DISPLAY_NAME_IS_NOT_IDENTITY
  );
});

test("not-configured contracts do not empty-succeed", () => {
  for (const def of [
    RANKING_CONTRACT,
    FINANCE_PAYMENT_CONTRACT,
    FILE_MEDIA_CONTRACT,
    STREAMING_SCOREBOARD_CONTRACT,
    FEDERATION_EXTERNAL_AUTHORITY_CONTRACT,
    CRM_SPONSOR_CONTRACT,
    ANALYTICS_REPORTING_CONTRACT,
    AUDIT_CONTRACT,
  ]) {
    const adapter = createNotConfiguredContractAdapter(def);
    expectCode(
      () => adapter[def.requiredMethods[0]](BASE_CTX),
      SHARED_ADAPTER_ERROR_CODE.NOT_CONFIGURED
    );
    assert.equal(adapter.productionBinding, PRODUCTION_BINDING_STATUS.NOT_CONFIGURED);
  }
});

test("implementation registry duplicate and freeze", () => {
  const adapters = createDefaultWorkstreamAdapters(runtimeDeps());
  const registry = createCompetitionAdapterImplementationRegistry({ adapters });
  assert.equal(registry.size(), 14);
  expectCode(() => registry.register(), SHARED_ADAPTER_ERROR_CODE.REGISTRY_FROZEN);
  expectCode(
    () =>
      createCompetitionAdapterImplementationRegistry({
        adapters: [adapters[0], adapters[0]],
      }),
    SHARED_ADAPTER_ERROR_CODE.DUPLICATE_REGISTRATION
  );
});

test("conformance harness passes for all 14 default adapters", async () => {
  const adapters = createDefaultWorkstreamAdapters(runtimeDeps());
  for (const adapter of adapters) {
    const report = await runCompetitionAdapterConformance(adapter, null, {
      validContext: BASE_CTX,
    });
    assert.equal(
      report.ok,
      true,
      `${adapter.contractId}: ${JSON.stringify(report.results.filter((row) => !row.ok))}`
    );
  }
});

test("fuzzy identity and version mismatch fail closed", () => {
  const identity = createIdentityAccessBinding({ boundTenantId: BOUND_TENANT });
  expectCode(
    () => identity.resolveActorIdentity({ ...BASE_CTX, actorId: "ada@example.com" }),
    SHARED_ADAPTER_ERROR_CODE.FUZZY_IDENTITY_FORBIDDEN
  );
  expectCode(
    () =>
      createContractAdapter(
        { ...IDENTITY_ACCESS_CONTRACT, contractVersion: "2.0.0" },
        { handlers: {} }
      ),
    SHARED_ADAPTER_ERROR_CODE.INCOMPATIBLE_CONTRACT_VERSION
  );
});

test("notification delivery failure does not claim competition mutation", async () => {
  const adapters = createDefaultWorkstreamAdapters({
    ...runtimeDeps(),
    notification: {
      boundTenantId: BOUND_TENANT,
      emitMatchScheduled: async () => ({ ok: false }),
    },
  });
  const notification = adapters.find(
    (row) => row.contractId === NOTIFICATION_COMMUNICATION_CONTRACT.contractId
  );
  const result = await notification.publishCompetitionCommunicationEvent({
    ...BASE_CTX,
    eventType: "MATCH_SCHEDULED",
  });
  assert.equal(result.data.businessEventOccurred, true);
  assert.equal(result.data.deliverySucceeded, false);
  assert.equal(result.status, "DELIVERY_FAILED");
});

test("existing Identity / Participant / Membership / Rating adapters remain callable", async () => {
  const { createIdentityEvidenceFromIdentityAdapter } = await import(
    "../src/features/competition-engine/integration/adapters/identityEvidenceFromIdentityAdapter.js"
  );
  const { createPlayerParticipantLookupAdapter } = await import(
    "../src/features/competition-engine/integration/adapters/playerParticipantLookupAdapter.js"
  );
  const { createMembershipStatusFromClubAdapter } = await import(
    "../src/features/competition-engine/integration/adapters/membershipStatusFromClubAdapter.js"
  );
  const { createRankingRatingSnapshotFromRatingAdapter } = await import(
    "../src/features/competition-engine/integration/adapters/rankingRatingSnapshotFromRatingAdapter.js"
  );
  const identity = createIdentityEvidenceFromIdentityAdapter();
  const evidence = await identity.getEvidence({
    subject: { actorId: "user-1", role: "TEAM_CAPTAIN" },
    scope: { tenantId: BOUND_TENANT, venueId: "venue-1", competitionId: "comp-1" },
  });
  assert.equal(evidence.subjectId, "user-1");
  const participant = createPlayerParticipantLookupAdapter({
    getPlayerProfile: (playerId) => mappedPlayer(playerId),
  });
  assert.equal(participant.resolveParticipantSnapshot("player-1").ok, true);
  const membership = createMembershipStatusFromClubAdapter({
    getActiveMembershipForUser: async () => ({
      ok: true,
      data: { status: "active" },
    }),
  });
  const member = await membership.getMembershipStatus({
    clubId: "club-1",
    participantId: "player-1",
  });
  assert.equal(member.isMember, true);
  const rating = createRankingRatingSnapshotFromRatingAdapter({
    resolveRatings: ({ entryIds }) =>
      Object.fromEntries(entryIds.map((id) => [id, { ratingValue: 999 }])),
  });
  const snap = rating.getSnapshot({
    entryIds: ["player-1"],
    effectiveAt: "2026-01-01T00:00:00Z",
    seedingScope: { tenantId: BOUND_TENANT },
  });
  assert.equal(snap.subjectValues[0].ratingValue, 999);
});

test("referee contract is unchanged and still conforms", () => {
  assert.equal(COMPETITION_REFEREE_ADAPTER_CONTRACT_ID, "competition.referee.adapter.v1");
  assert.equal(COMPETITION_REFEREE_ADAPTER_CONTRACT_VERSION, "1.0.0");
  const adapter = createReferenceRefereeAdapter();
  const report = runCompetitionRefereeAdapterConformance(adapter);
  assert.equal(report.ok, true);
});

test("court contract on main remains version 1 and is not redefined here", () => {
  assert.equal(COMPETITION_COURT_ADAPTER_CONTRACT_NAME, "Competition Court Adapter Contract");
  assert.equal(COMPETITION_COURT_ADAPTER_CONTRACT_VERSION, 1);
  assert.equal(
    WORKSTREAM_OWNED_CONTRACT_IDS.includes("competition.court.adapter.v1"),
    false
  );
  const court = getCompetitionAdapterContract("Competition Court Adapter Contract");
  assert.equal(court.workstreamStatus, "MERGED_ON_MAIN_EXTERNAL_TO_THIS_WORKSTREAM");
});

test("runtime classifications stay honest", () => {
  assert.equal(
    IDENTITY_ACCESS_CONTRACT.runtimeClassification,
    RUNTIME_CLASSIFICATION.EXISTING_CANONICAL_CAPABILITY
  );
  assert.equal(
    PARTICIPANT_CONTRACT.runtimeClassification,
    RUNTIME_CLASSIFICATION.EXISTING_CANONICAL_CAPABILITY
  );
  assert.equal(
    CLUB_TEAM_MEMBERSHIP_CONTRACT.runtimeClassification,
    RUNTIME_CLASSIFICATION.EXISTING_CANONICAL_CAPABILITY
  );
  assert.equal(
    FINANCE_PAYMENT_CONTRACT.runtimeClassification,
    RUNTIME_CLASSIFICATION.CONTRACT_ONLY_NO_RUNTIME
  );
  assert.equal(
    FEDERATION_EXTERNAL_AUTHORITY_CONTRACT.productionBinding,
    PRODUCTION_BINDING_STATUS.NOT_CONFIGURED
  );
});
