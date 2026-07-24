/**
 * E2E-01 — Competition Integration Foundation targeted tests.
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  COMPETITION_ACTION,
  COMPETITION_PERMISSION,
  evaluateAuthorization,
  matchesIdentityEvidencePort,
} from "../src/features/competition-core/role-permission/index.js";
import { isRankingRatingSnapshotProviderPort } from "../src/features/competition-core/seeding/ports/RankingRatingSnapshotProviderPort.js";
import { isVenueEligibilityProvider } from "../src/features/competition-core/court-assignment/ports/venueEligibilityProvider.js";
import { isCanonicalCourtDescriptorProvider } from "../src/features/competition-core/court-assignment/ports/canonicalCourtDescriptorProvider.js";
import { RESOLUTION_OUTCOME } from "../src/features/player/constants/resolutionOutcomes.js";
import {
  ADAPTER_STATUS,
  INTEGRATION_ERROR_CODE,
  RATING_COMPLETENESS,
  assertTenantIsolation,
  authorizeCompetitionAction,
  buildAdapterInventory,
  createCanonicalDescriptorFromVenueAdapter,
  createCompetitionRuntimePorts,
  createIdentityEvidenceFromIdentityAdapter,
  createMembershipStatusFromClubAdapter,
  createPlayerParticipantLookupAdapter,
  createRankingRatingSnapshotFromRatingAdapter,
  createVenueEligibilityFromCaaAdapter,
  isIntegrationError,
  normalizeAdapterError,
  requireIntegrationContext,
} from "../src/features/competition-engine/integration/index.js";

const BASE_SCOPE = Object.freeze({
  tenantId: "tenant-1",
  venueId: "venue-1",
  competitionId: "comp-1",
});

test("canonical identity resolution — TEAM_CAPTAIN grants team.lineup.submit via Identity matrix", async () => {
  const port = createIdentityEvidenceFromIdentityAdapter();
  assert.equal(matchesIdentityEvidencePort(port), true);

  const evidence = await port.getEvidence({
    subject: { actorId: "user-1", role: "TEAM_CAPTAIN" },
    scope: BASE_SCOPE,
  });

  assert.ok(evidence);
  assert.equal(evidence.tenantId, "tenant-1");
  assert.equal(evidence.subjectId, "user-1");
  assert.ok(
    evidence.grantedPermissions.includes(COMPETITION_PERMISSION.TEAM_LINEUP_SUBMIT)
  );
  assert.equal(evidence.attributes.dormant, false);
  assert.equal(evidence.attributes.clientGrantsIgnored, true);

  const decision = await evaluateAuthorization(
    {
      subject: { actorId: "user-1", role: "TEAM_CAPTAIN" },
      scope: BASE_SCOPE,
      action: COMPETITION_ACTION.LINEUP_SUBMIT,
    },
    { evidencePort: port }
  );
  assert.equal(decision.allowed, true);
});

test("missing identity — evidence null and authorize deny fail-closed", async () => {
  const port = createIdentityEvidenceFromIdentityAdapter();
  const evidence = await port.getEvidence({
    subject: { role: "TEAM_CAPTAIN" },
    scope: BASE_SCOPE,
  });
  assert.equal(evidence, null);

  const decision = await authorizeCompetitionAction(
    {
      subject: { role: "TEAM_CAPTAIN" },
      scope: BASE_SCOPE,
      action: COMPETITION_ACTION.LINEUP_SUBMIT,
    },
    { evidencePort: port }
  );
  assert.equal(decision.allowed, false);
  assert.equal(decision.denyReason, INTEGRATION_ERROR_CODE.MISSING_IDENTITY);
});

test("missing tenant — fail-closed", async () => {
  const port = createIdentityEvidenceFromIdentityAdapter();
  const evidence = await port.getEvidence({
    subject: { actorId: "user-1", role: "TEAM_CAPTAIN" },
    scope: { competitionId: "comp-1" },
  });
  assert.equal(evidence, null);

  assert.throws(
    () =>
      requireIntegrationContext({
        subject: { actorId: "user-1", role: "TEAM_CAPTAIN" },
        scope: { competitionId: "comp-1" },
      }),
    (err) =>
      isIntegrationError(err) &&
      err.code === INTEGRATION_ERROR_CODE.MISSING_TENANT
  );
});

test("permission denied — role without required grant", async () => {
  const port = createIdentityEvidenceFromIdentityAdapter();
  const decision = await evaluateAuthorization(
    {
      subject: { actorId: "cashier-1", role: "CASHIER" },
      scope: BASE_SCOPE,
      action: COMPETITION_ACTION.LINEUP_SUBMIT,
    },
    { evidencePort: port }
  );
  assert.equal(decision.allowed, false);
  assert.match(String(decision.denyReason || decision.decisionCode), /PERMISSION|DENIED/i);
});

test("does not trust client-sent grantedPermissions", async () => {
  const port = createIdentityEvidenceFromIdentityAdapter({
    getPermissionsForRole: () => [],
  });
  const evidence = await port.getEvidence({
    subject: {
      actorId: "user-1",
      role: "TEAM_CAPTAIN",
      grantedPermissions: [COMPETITION_PERMISSION.TEAM_LINEUP_SUBMIT],
    },
    scope: BASE_SCOPE,
    context: {
      grantedPermissions: [COMPETITION_PERMISSION.TEAM_LINEUP_SUBMIT],
    },
  });
  assert.ok(evidence);
  assert.deepEqual(evidence.grantedPermissions, []);
});

test("missing player mapping — explicit fail", async () => {
  const adapter = createPlayerParticipantLookupAdapter({
    getPlayerProfile: () => ({
      outcome: RESOLUTION_OUTCOME.UNMAPPED,
      profile: null,
      playerId: null,
    }),
  });
  const snap = adapter.resolveParticipantSnapshot("missing-player");
  assert.equal(snap.ok, false);
  assert.equal(snap.code, INTEGRATION_ERROR_CODE.PLAYER_MAPPING_MISSING);

  const found = await adapter.getByIds(["missing-player"]);
  assert.deepEqual(found, []);
});

test("correct player canonical resolution", async () => {
  const adapter = createPlayerParticipantLookupAdapter({
    getPlayerProfile: (playerId) => ({
      outcome: RESOLUTION_OUTCOME.MAPPED,
      playerId,
      authUserId: "auth-1",
      profile: {
        playerId,
        displayName: "Alice",
      },
    }),
  });
  const snap = adapter.resolveParticipantSnapshot("player-1");
  assert.equal(snap.ok, true);
  assert.equal(snap.participant.id, "player-1");
  assert.equal(snap.participant.profileSnapshot.displayName, "Alice");

  const found = await adapter.getByIds(["player-1", "player-1"]);
  assert.equal(found.length, 1);
});

test("missing club mapping when rule requires club", async () => {
  const port = createMembershipStatusFromClubAdapter({
    getActiveMembershipForUser: async () => ({ ok: true, data: null }),
  });

  const noClub = await port.getMembershipStatus({
    participantId: "user-1",
  });
  assert.equal(noClub.isMember, false);
  assert.ok(noClub.reasonCodes.includes(INTEGRATION_ERROR_CODE.MISSING_CLUB));

  const missing = await port.getMembershipStatus({
    participantId: "user-1",
    clubId: "club-1",
  });
  assert.equal(missing.isMember, false);
  assert.ok(
    missing.reasonCodes.includes(INTEGRATION_ERROR_CODE.CLUB_MAPPING_MISSING)
  );
});

test("club membership resolves active member", async () => {
  const port = createMembershipStatusFromClubAdapter({
    getActiveMembershipForUser: async (clubId, participantId) => ({
      ok: true,
      data: {
        clubId,
        userId: participantId,
        status: "active",
      },
    }),
  });
  const result = await port.getMembershipStatus({
    clubId: "club-1",
    participantId: "user-1",
  });
  assert.equal(result.isMember, true);
  assert.equal(result.status, "active");
  assert.deepEqual(result.reasonCodes, []);
});

test("rating available — COMPLETE snapshot", () => {
  const port = createRankingRatingSnapshotFromRatingAdapter({
    resolveRatings: ({ entryIds }) =>
      Object.fromEntries(
        entryIds.map((id, idx) => [
          id,
          { ratingValue: 1000 + idx, rankingPosition: idx + 1 },
        ])
      ),
  });
  assert.equal(isRankingRatingSnapshotProviderPort(port), true);

  const snap = port.getSnapshot({
    entryIds: ["e1", "e2"],
    seedingScope: { competitionId: "comp-1", tenantId: "tenant-1" },
    effectiveAt: "2026-07-24T00:00:00.000Z",
  });
  assert.equal(snap.completenessState, RATING_COMPLETENESS.COMPLETE);
  assert.equal(snap.subjectValues.length, 2);
  assert.equal(snap.subjectValues[0].available, true);
  assert.equal(snap.missingDataMetadata, null);
});

test("rating unavailable — PARTIAL with metadata; requireComplete fail-closed", () => {
  const port = createRankingRatingSnapshotFromRatingAdapter({
    resolveRatings: () => ({
      e1: { ratingValue: 1200 },
      e2: { available: false },
    }),
  });
  const snap = port.getSnapshot({
    entryIds: ["e1", "e2"],
    seedingScope: { competitionId: "comp-1" },
    effectiveAt: "2026-07-24T00:00:00.000Z",
  });
  assert.equal(snap.completenessState, RATING_COMPLETENESS.PARTIAL);
  assert.ok(snap.missingDataMetadata);
  assert.equal(snap.missingDataMetadata[0].entryId, "e2");

  const strict = createRankingRatingSnapshotFromRatingAdapter({
    requireComplete: true,
    resolveRatings: () => ({ e1: { available: false } }),
  });
  assert.throws(
    () =>
      strict.getSnapshot({
        entryIds: ["e1"],
        seedingScope: {},
        effectiveAt: "2026-07-24T00:00:00.000Z",
      }),
    (err) =>
      isIntegrationError(err) &&
      err.code === INTEGRATION_ERROR_CODE.RATING_UNAVAILABLE
  );
});

test("venue/court resolution — eligibility + descriptors", () => {
  const eligibility = createVenueEligibilityFromCaaAdapter({
    getCompetitionCourtAvailability: () => ({
      clubId: "club-1",
      venueId: "venue-1",
      date: "2026-07-24",
      startTime: "09:00",
      endTime: "10:00",
      availableCourtIds: ["c1"],
      unavailableCourts: [],
    }),
  });
  assert.equal(isVenueEligibilityProvider(eligibility), true);

  const result = eligibility.resolveEligibility({
    tenantId: "tenant-1",
    clubId: "club-1",
    venueId: "venue-1",
    civilDate: "2026-07-24",
    civilStartTime: "09:00",
    civilEndTime: "10:00",
  });
  assert.deepEqual(result.availableCourtIds, ["c1"]);
  assert.equal(result.tenantId, "tenant-1");

  const descriptors = createCanonicalDescriptorFromVenueAdapter({
    listCanonicalCourtDescriptors: (req) => ({
      tenantId: req.tenantId,
      clubId: req.clubId,
      venueId: req.venueId,
      descriptorAuthority: "venue-court.inventory.club_data_v3",
      sourceContractVersion: "VENUE_COURT_CANONICAL_COURT_DESCRIPTOR_V1",
      sourceSnapshotId: null,
      sourceSnapshotVersion: null,
      courts: [
        {
          courtId: "c1",
          tenantId: req.tenantId,
          clubId: req.clubId,
          venueId: req.venueId,
          active: true,
          locked: false,
          capabilities: [],
          priority: 1,
        },
      ],
      diagnostics: { excludedCourts: [] },
    }),
  });
  assert.equal(isCanonicalCourtDescriptorProvider(descriptors), true);
  const envelope = descriptors.resolveDescriptors({
    tenantId: "tenant-1",
    clubId: "club-1",
    venueId: "venue-1",
  });
  assert.equal(envelope.courts[0].courtId, "c1");
});

test("venue missing tenant/venue/club — fail-closed", () => {
  const eligibility = createVenueEligibilityFromCaaAdapter({
    getCompetitionCourtAvailability: () => {
      throw new Error("should not call");
    },
  });
  assert.throws(
    () =>
      eligibility.resolveEligibility({
        clubId: "club-1",
        venueId: "venue-1",
        civilDate: "2026-07-24",
        civilStartTime: "09:00",
        civilEndTime: "10:00",
      }),
    (err) => err.code === INTEGRATION_ERROR_CODE.MISSING_TENANT
  );
  assert.throws(
    () =>
      eligibility.resolveEligibility({
        tenantId: "tenant-1",
        clubId: "club-1",
        civilDate: "2026-07-24",
        civilStartTime: "09:00",
        civilEndTime: "10:00",
      }),
    (err) => err.code === INTEGRATION_ERROR_CODE.MISSING_VENUE
  );
});

test("cross-tenant rejection", () => {
  assert.throws(
    () => assertTenantIsolation("tenant-a", "tenant-b"),
    (err) =>
      isIntegrationError(err) &&
      err.code === INTEGRATION_ERROR_CODE.CROSS_TENANT_REJECTED
  );

  assert.throws(
    () => assertTenantIsolation(null, "tenant-b"),
    (err) => err.code === INTEGRATION_ERROR_CODE.MISSING_TENANT
  );
});

test("adapter error normalization", () => {
  const normalized = normalizeAdapterError(new Error("boom"));
  assert.equal(normalized.code, INTEGRATION_ERROR_CODE.ADAPTER_FAILURE);
  assert.equal(normalized.failClosed, true);

  const coded = normalizeAdapterError({
    code: INTEGRATION_ERROR_CODE.VENUE_RESOLUTION_FAILED,
    message: "venue failed",
  });
  assert.equal(coded.code, INTEGRATION_ERROR_CODE.VENUE_RESOLUTION_FAILED);
});

test("deterministic rating snapshot output", () => {
  const port = createRankingRatingSnapshotFromRatingAdapter({
    resolveRatings: ({ entryIds }) =>
      Object.fromEntries(entryIds.map((id) => [id, { ratingValue: 1500 }])),
  });
  const input = {
    entryIds: ["e1", "e2"],
    seedingScope: { competitionId: "comp-1", tenantId: "tenant-1" },
    effectiveAt: "2026-07-24T00:00:00.000Z",
  };
  const a = port.getSnapshot(input);
  const b = port.getSnapshot(input);
  assert.equal(a.snapshotId, b.snapshotId);
  assert.equal(a.fingerprint, b.fingerprint);
  assert.deepEqual(a.subjectValues, b.subjectValues);
});

test("does not mutate canonical source rating map", () => {
  const source = {
    e1: { ratingValue: 1100 },
  };
  const port = createRankingRatingSnapshotFromRatingAdapter({
    resolveRatings: () => source,
  });
  const snap = port.getSnapshot({
    entryIds: ["e1"],
    seedingScope: {},
    effectiveAt: "2026-07-24T00:00:00.000Z",
  });
  assert.equal(Object.isFrozen(snap), true);
  assert.equal(Object.isFrozen(snap.subjectValues[0]), true);
  assert.throws(() => {
    snap.subjectValues[0].ratingValue = 9999;
  });
  assert.equal(source.e1.ratingValue, 1100);
});

test("composition root wires ports and inventory statuses", async () => {
  const runtime = createCompetitionRuntimePorts({
    club: {
      getActiveMembershipForUser: async () => ({
        ok: true,
        data: { status: "active", userId: "u1" },
      }),
    },
    rating: {
      resolveRatings: ({ entryIds }) =>
        Object.fromEntries(entryIds.map((id) => [id, { ratingValue: 1000 }])),
    },
    venue: {
      getCompetitionCourtAvailability: () => ({
        clubId: "club-1",
        venueId: "venue-1",
        date: "2026-07-24",
        startTime: "09:00",
        endTime: "10:00",
        availableCourtIds: ["c1"],
        unavailableCourts: [],
      }),
      listCanonicalCourtDescriptors: (req) => ({
        tenantId: req.tenantId,
        clubId: req.clubId,
        venueId: req.venueId,
        descriptorAuthority: "venue-court.inventory.club_data_v3",
        sourceContractVersion: "VENUE_COURT_CANONICAL_COURT_DESCRIPTOR_V1",
        sourceSnapshotId: null,
        sourceSnapshotVersion: null,
        courts: [],
        diagnostics: { excludedCourts: [] },
      }),
    },
  });

  assert.ok(matchesIdentityEvidencePort(runtime.identityEvidencePort));
  assert.ok(runtime.membershipStatusPort);
  assert.ok(runtime.participantLookupPort);
  assert.ok(isRankingRatingSnapshotProviderPort(runtime.rankingRatingSnapshotPort));
  assert.ok(runtime.venueAvailabilityBridge);
  assert.equal(typeof runtime.authorize, "function");

  const allowed = await runtime.authorize({
    subject: { actorId: "captain-1", role: "TEAM_CAPTAIN" },
    scope: BASE_SCOPE,
    action: COMPETITION_ACTION.LINEUP_SUBMIT,
  });
  assert.equal(allowed.allowed, true);

  const inventory = buildAdapterInventory();
  assert.ok(inventory.length >= 12);
  const identity = inventory.find((row) => row.code === "INT-01");
  assert.equal(identity.status, ADAPTER_STATUS.IMPLEMENTED_IN_E2E_01);
  const crm = inventory.find((row) => row.code === "INT-08");
  assert.equal(crm.status, ADAPTER_STATUS.DEFERRED_TO_LATER_E2E_WORKSTREAM);
});

test("backward compatibility — CORE-02 evaluateAuthorization still accepts static evidence ports", async () => {
  const { createStaticIdentityEvidencePort } = await import(
    "../src/features/competition-core/role-permission/index.js"
  );
  const port = createStaticIdentityEvidencePort([
    COMPETITION_PERMISSION.TEAM_LINEUP_SUBMIT,
  ]);
  const decision = await evaluateAuthorization(
    {
      subject: { actorId: "u1", role: "TEAM_CAPTAIN" },
      scope: BASE_SCOPE,
      action: COMPETITION_ACTION.LINEUP_SUBMIT,
    },
    { evidencePort: port }
  );
  assert.equal(decision.allowed, true);
});
