/**
 * Official/Open Adapter B1.1 — focused boundary / conformance tests.
 * Does not run the broad unit suite.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "path";
import { describe, it } from "node:test";
import { fileURLToPath } from "url";

import { createScoringFormat } from "../src/features/competition-core/scoring/index.js";
import { runCompetitionRefereeAdapterConformance } from "../src/features/competition-engine/integration/referee/conformance.js";
import {
  COMPETITION_REFEREE_ADAPTER_CONTRACT_ID,
  COMPETITION_REFEREE_ADAPTER_CONTRACT_VERSION,
  REFEREE_ADAPTER_FORBIDDEN_METHODS,
} from "../src/features/competition-engine/integration/referee/constants.js";
import { isRefereeAdapterContractError } from "../src/features/competition-engine/integration/referee/errors.js";
import { SHARED_FORBIDDEN_METHODS } from "../src/features/competition-engine/integration/contracts/kernel/constants.js";
import {
  IDENTITY_ACCESS_CONTRACT,
  TENANT_ORGANIZATION_CONTRACT,
  PARTICIPANT_CONTRACT,
  CLUB_TEAM_MEMBERSHIP_CONTRACT,
  RATING_CONTRACT,
  RANKING_CONTRACT,
  FINANCE_PAYMENT_CONTRACT,
  NOTIFICATION_COMMUNICATION_CONTRACT,
  FILE_MEDIA_CONTRACT,
  STREAMING_SCOREBOARD_CONTRACT,
  FEDERATION_EXTERNAL_AUTHORITY_CONTRACT,
  CRM_SPONSOR_CONTRACT,
  ANALYTICS_REPORTING_CONTRACT,
  AUDIT_CONTRACT,
} from "../src/features/competition-engine/integration/contracts/definitions.js";
import {
  checkPlayerEligibility,
  ELIGIBILITY_VIOLATION,
} from "../src/features/individual-tournament/engines/eligibilityEngine.js";
import { getCanonicalEntryPaymentEvidence } from "../src/features/individual-tournament/engines/entryFeeEngine.js";
import {
  ADAPTER_B_STATUS,
  BYPASS_CLASSIFICATION,
  COURT_SHARED_RUNTIME_GAP,
  EXTERNAL_DEPENDENCY,
  SHARED_CONTRACT_CAPABILITY_GAP,
  SHARED_REFEREE_CONTRACT_CAPABILITY_GAP,
  TEMPORARY_COMPATIBILITY_NONCANONICAL,
  createOfficialOpenAdapterB,
  createOfficialTournamentRefereeAdapter,
  ratingMayInfluenceOpenPairingOrDraw,
  resolveOfficialOpenTenantScope,
  shouldActivateOfficialOpenMembership,
  shouldActivateOfficialOpenRating,
  summarizeOfficialOpenBypassInventory,
} from "../src/features/tournament/official-open-adapter-b/index.js";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

function readSrc(rel) {
  return readFileSync(path.join(root, rel), "utf8");
}

function officialTournament(extra = {}) {
  return {
    id: "comp-ref-1",
    tenantId: "tenant-1",
    clubId: "club-1",
    mode: "official_tournament",
    officialMode: "open",
    matches: [
      {
        id: "match-1",
        status: "ready",
        entryA: { id: "entry-a", playerIds: ["p-a"] },
        entryB: { id: "entry-b", playerIds: ["p-b"] },
        scoringRules: createScoringFormat({
          scoringSystem: "RALLY",
          pointsToWin: 11,
          winBy: 2,
          bestOfGames: 1,
        }),
      },
    ],
    ...extra,
  };
}

describe("Official/Open Adapter B1.1 boundary", () => {
  it("consumes frozen Contract A ids and versions", () => {
    const adapter = createOfficialOpenAdapterB({
      tournament: officialTournament(),
      currentTenantId: "tenant-1",
      actor: { id: "actor-1", role: "CLUB_OWNER" },
    });
    assert.equal(adapter.ownsAuthority, false);
    assert.equal(adapter.contracts.identity.contractId, IDENTITY_ACCESS_CONTRACT.contractId);
    assert.equal(adapter.contracts.identity.contractVersion, IDENTITY_ACCESS_CONTRACT.contractVersion);
    assert.equal(adapter.contracts.tenant.contractId, TENANT_ORGANIZATION_CONTRACT.contractId);
    assert.equal(adapter.contracts.participant.contractId, PARTICIPANT_CONTRACT.contractId);
    assert.equal(adapter.contracts.membership.contractId, CLUB_TEAM_MEMBERSHIP_CONTRACT.contractId);
    assert.equal(adapter.contracts.rating.contractId, RATING_CONTRACT.contractId);
    assert.equal(adapter.contracts.ranking.contractId, RANKING_CONTRACT.contractId);
    assert.equal(adapter.contracts.finance.contractId, FINANCE_PAYMENT_CONTRACT.contractId);
    assert.equal(
      adapter.contracts.notification.contractId,
      NOTIFICATION_COMMUNICATION_CONTRACT.contractId
    );
    assert.equal(adapter.contracts.fileMedia.contractId, FILE_MEDIA_CONTRACT.contractId);
    assert.equal(adapter.contracts.streaming.contractId, STREAMING_SCOREBOARD_CONTRACT.contractId);
    assert.equal(
      adapter.contracts.federation.contractId,
      FEDERATION_EXTERNAL_AUTHORITY_CONTRACT.contractId
    );
    assert.equal(adapter.contracts.crm.contractId, CRM_SPONSOR_CONTRACT.contractId);
    assert.equal(adapter.contracts.analytics.contractId, ANALYTICS_REPORTING_CONTRACT.contractId);
    assert.equal(adapter.contracts.audit.contractId, AUDIT_CONTRACT.contractId);
    assert.equal(adapter.contracts.court.contractVersion, 1);
    assert.equal(adapter.contracts.referee.contractId, COMPETITION_REFEREE_ADAPTER_CONTRACT_ID);
    assert.equal(
      adapter.contracts.referee.contractVersion,
      COMPETITION_REFEREE_ADAPTER_CONTRACT_VERSION
    );
  });

  it("never infers tenantId from venueId and keeps organization NOT_CONFIGURED", () => {
    const missing = resolveOfficialOpenTenantScope({
      tournament: { id: "t1", clubId: "club-1" },
      activeClub: { id: "club-1", venueId: "venue-1" },
    });
    assert.equal(missing.ok, false);
    assert.equal(missing.tenantId, null);
    assert.equal(missing.organizationStatus, "NOT_CONFIGURED");
    assert.notEqual(missing.venueId, missing.tenantId);

    const ok = resolveOfficialOpenTenantScope({
      tournament: officialTournament({ venueId: "venue-1" }),
      activeClub: { id: "club-1", tenantId: "tenant-1", venueId: "venue-1" },
      currentTenantId: "tenant-1",
    });
    assert.equal(ok.ok, true);
    assert.equal(ok.tenantId, "tenant-1");
    assert.equal(ok.venueId, "venue-1");
    assert.notEqual(ok.tenantId, ok.venueId);
    assert.equal(ok.organizationId, null);
  });

  it("rejects missing canonical playerId as participant identity", async () => {
    const adapter = createOfficialOpenAdapterB({
      tournament: officialTournament(),
      currentTenantId: "tenant-1",
    });
    const missing = await adapter.resolveParticipant("");
    assert.equal(missing.ok, false);
    assert.match(String(missing.error || ""), /playerId|identity/i);
    const source = readSrc(
      "src/features/tournament/official-open-adapter-b/createOfficialOpenAdapterB.js"
    );
    assert.equal(source.includes("Display name is not identity"), true);
  });

  it("activates membership fail-closed and does not treat player.clubId as evidence", () => {
    const tournament = officialTournament({
      settings: { eligibilityRules: { clubMembership: { enabled: true } } },
    });
    assert.equal(shouldActivateOfficialOpenMembership(tournament), true);
    const result = checkPlayerEligibility(
      { id: "p1", name: "A", clubId: "home-club", homeClubId: "home-club" },
      { clubMembership: { enabled: true, requireActiveClub: true, allowedClubIds: [] } },
      { requireCanonicalMembershipEvidence: true }
    );
    assert.equal(result.ok, false);
    assert.equal(
      result.violations.some((row) => row.code === ELIGIBILITY_VIOLATION.CLUB_REQUIRED),
      true
    );
  });

  it("surfaces Rating NOT_CONFIGURED and keeps OPEN pairing/draw rating-neutral", async () => {
    const tournament = officialTournament({
      officialMode: "open",
      settings: { eligibilityRules: { rating: { enabled: true, minRating: 3, maxRating: 5 } } },
    });
    assert.equal(shouldActivateOfficialOpenRating(tournament), true);
    assert.equal(ratingMayInfluenceOpenPairingOrDraw(), false);
    const adapter = createOfficialOpenAdapterB({
      tournament,
      currentTenantId: "tenant-1",
    });
    const evidence = await adapter.getRatingEvidence("p1");
    assert.equal(evidence.ok, false);
    assert.equal(evidence.status, ADAPTER_B_STATUS.NOT_CONFIGURED);

    const eligibility = checkPlayerEligibility(
      { id: "p1", displayRating: 4.2, ratingV5: { display_rating: 4.2 }, elo: 1400 },
      { rating: { enabled: true, minRating: 3, maxRating: 5 } },
      { requireCanonicalRatingEvidence: true }
    );
    assert.equal(eligibility.ok, false);
    assert.equal(
      eligibility.violations.some((row) => row.code === ELIGIBILITY_VIOLATION.RATING_UNKNOWN),
      true
    );
  });

  it("routes Court Adapter B through Competition Court Contract V1", async () => {
    const adapter = createOfficialOpenAdapterB({
      tournament: officialTournament(),
      currentTenantId: "tenant-1",
      activeClub: { id: "club-1", tenantId: "tenant-1" },
    });
    const result = await adapter.listEligibleCourts({ clubId: "club-1", tenantId: "tenant-1" });
    assert.equal(result.source, "competition-court-adapter-contract-v1");
    assert.equal(result.physicalCourtIdAuthority, true);
    assert.equal(result.sharedRuntimeGap, COURT_SHARED_RUNTIME_GAP);
    assert.equal(result.sharedRuntimeGapKind, EXTERNAL_DEPENDENCY);
    assert.equal(result.contractVersion, 1);
    assert.equal(Array.isArray(result.courts), true);

    const setup = readSrc("src/pages/tournament/OfficialTournamentSetup.jsx");
    assert.equal(setup.includes("canonicalClubCourtInventory"), false);
    assert.equal(setup.includes("listCanonicalClubCourtsForFormatVenue"), false);
    assert.equal(setup.includes("listOfficialOpenEligibleCourts"), true);

    const courtB = readSrc("src/features/tournament/official-open-adapter-b/createOfficialOpenAdapterB.js");
    assert.equal(courtB.includes("courtResourceCompetitionAdapter"), true);
    assert.equal(courtB.includes("canonicalClubCourtInventory"), false);
    assert.equal(courtB.includes("club_data_v3"), false);
  });

  it("satisfies competition.referee.adapter.v1 conformance without owning authority", () => {
    const tournament = officialTournament();
    const adapter = createOfficialTournamentRefereeAdapter({
      tournament,
      tenantId: "tenant-1",
    });
    const report = runCompetitionRefereeAdapterConformance(adapter, {
      validRequest: {
        tenantId: "tenant-1",
        competitionId: "comp-ref-1",
        matchId: "match-1",
      },
    });
    assert.equal(report.ok, true, JSON.stringify(report.results.filter((row) => !row.ok)));
    assert.equal(adapter.ownsScoringAuthority, undefined);
    assert.equal(typeof adapter.assignReferee, "undefined");
    assert.equal(typeof adapter.recordPoint, "undefined");
  });

  it("does not invent Official win-by policy", () => {
    const tournament = officialTournament({
      matches: [
        {
          id: "match-1",
          status: "ready",
          entryA: { id: "entry-a", playerIds: ["p-a"] },
          entryB: { id: "entry-b", playerIds: ["p-b"] },
        },
      ],
    });
    const adapter = createOfficialTournamentRefereeAdapter({
      tournament,
      tenantId: "tenant-1",
    });
    assert.equal(
      adapter.sharedContractCapabilityGaps[0].code,
      SHARED_REFEREE_CONTRACT_CAPABILITY_GAP
    );
    try {
      adapter.getScoringRules({
        tenantId: "tenant-1",
        competitionId: "comp-ref-1",
        matchId: "match-1",
      });
      assert.fail("expected SHARED_REFEREE_CONTRACT_CAPABILITY_GAP");
    } catch (err) {
      assert.equal(isRefereeAdapterContractError(err), true);
      assert.equal(err.code, SHARED_REFEREE_CONTRACT_CAPABILITY_GAP);
      assert.equal(err.details.winBy, null);
      assert.equal(err.details.winByPolicyDeferred, true);
    }
    const source = readSrc(
      "src/features/tournament/official-open-adapter-b/officialTournamentRefereeAdapter.js"
    );
    assert.equal(/winBy:\s*2/.test(source), false);
  });

  it("propagates Finance capability gap and classifies legacy payments as noncanonical", async () => {
    const adapter = createOfficialOpenAdapterB({
      tournament: officialTournament({
        settings: { entryFee: { enabled: true, entryPayments: { e1: { status: "paid" } } } },
      }),
      currentTenantId: "tenant-1",
    });
    const evidence = await adapter.getPaymentEvidence("p1");
    assert.equal(evidence.ok, false);
    assert.equal(evidence.code, SHARED_CONTRACT_CAPABILITY_GAP);
    assert.equal(evidence.compatibility, TEMPORARY_COMPATIBILITY_NONCANONICAL);

    const legacy = getCanonicalEntryPaymentEvidence(
      { settings: { entryFee: { entryPayments: { e1: { status: "paid" } } } } },
      "e1",
      { code: SHARED_CONTRACT_CAPABILITY_GAP }
    );
    assert.equal(legacy.source, TEMPORARY_COMPATIBILITY_NONCANONICAL);
    assert.equal(legacy.canonical, false);
    assert.equal(legacy.gap, true);
  });

  it("exposes Notification and Audit Adapter B boundaries", async () => {
    const adapter = createOfficialOpenAdapterB({
      tournament: officialTournament(),
      currentTenantId: "tenant-1",
      actor: { id: "actor-1", role: "CLUB_OWNER" },
      appendAudit: async () => ({ ok: true }),
    });
    const published = await adapter.publishMatchScheduled("match-1");
    assert.equal(typeof published.ok, "boolean");
    const audited = await adapter.appendAudit("schedule_published", { actorId: "actor-1" });
    assert.equal(audited.ok === true || audited.sportingMutationBlocked === true, true);

    const scheduleSrc = readSrc("src/tournament/engines/publishScheduleEngine.js");
    assert.equal(scheduleSrc.includes("publishMatchScheduled"), true);
    assert.match(
      scheduleSrc,
      /isOfficialOpenTournament\(tournament\)[\s\S]*publishMatchScheduled/
    );
  });

  it("marks optional streaming NOT_REQUIRED / NOT_CONFIGURED and not scoring authority", async () => {
    const adapter = createOfficialOpenAdapterB({
      tournament: officialTournament(),
      currentTenantId: "tenant-1",
    });
    assert.equal(adapter.status.streaming, ADAPTER_B_STATUS.NOT_REQUIRED);
    const streaming = await adapter.getStreamingCapability();
    assert.equal(streaming.required, false);
    assert.equal(streaming.scoringAuthority, false);
    assert.equal(streaming.status, ADAPTER_B_STATUS.NOT_REQUIRED);
  });

  it("has zero forbidden bypasses and no Adapter-B authority methods", () => {
    const summary = summarizeOfficialOpenBypassInventory();
    assert.equal(summary.forbiddenBypassCount, 0);
    assert.equal(
      summary.inventory.some(
        (row) => row.classification === BYPASS_CLASSIFICATION.FORBIDDEN_BYPASS
      ),
      false
    );
    assert.equal(
      summary.inventory.some((row) => row.classification === "NEEDS_ADOPTION"),
      false
    );

    const adapter = createOfficialOpenAdapterB({
      tournament: officialTournament(),
      currentTenantId: "tenant-1",
    });
    for (const method of SHARED_FORBIDDEN_METHODS) {
      assert.equal(typeof adapter[method], "undefined", method);
    }
    for (const method of REFEREE_ADAPTER_FORBIDDEN_METHODS) {
      assert.equal(typeof adapter.contracts.referee[method], "undefined", method);
    }

    const adapterBDir = [
      "src/features/tournament/official-open-adapter-b/createOfficialOpenAdapterB.js",
      "src/features/tournament/official-open-adapter-b/court.js",
      "src/features/tournament/official-open-adapter-b/officialTournamentRefereeAdapter.js",
    ];
    for (const file of adapterBDir) {
      const source = readSrc(file);
      assert.equal(source.includes("club_data_v3"), false, file);
      assert.equal(source.includes("canonicalClubCourtInventory"), false, file);
      assert.equal(source.includes("domain/clubStorage"), false, file);
    }
  });
});
