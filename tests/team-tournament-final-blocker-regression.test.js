import assert from "node:assert/strict";
import { describe, it, beforeEach, afterEach } from "node:test";

import {
  evaluatePairingEligibility,
  isActiveMembershipStatus,
  loadClubPairingCandidatePool,
  loadTenantPairingCandidatePool,
  PAIRING_CANDIDATE_REASON_CODES as RC,
  PAIRING_CANDIDATE_STATUS,
  resolvePairingScopeTenantId,
  isPlaceholderTenantId,
} from "../src/features/pairing-candidates/index.js";
import {
  __resetTeamTournamentDataModeForTests,
  __setTeamTournamentDataModeForTests,
  createTeamTournamentRepository,
  TEAM_TOURNAMENT_DATA_MODES,
} from "../src/features/team-tournament/repositories/teamTournamentRepositoryFactory.js";
import { createTeamTournamentUiOrchestrator } from "../src/features/team-tournament/ui/teamTournamentUiOrchestrator.js";
import { DEFAULT_TENANT_ID } from "../src/models/tenant.js";

describe("Team Tournament final blockers — athlete scope", () => {
  it("tournament clubId / club tenant wins over stale activeClub default-tenant", () => {
    const tenantId = resolvePairingScopeTenantId({
      tournamentTenantId: "tenant-smoke-real",
      clubId: "club-smoke-42i1",
      clubs: [{ id: "club-other", tenantId: "tenant-other" }],
      currentTenantId: DEFAULT_TENANT_ID,
    });
    assert.equal(tenantId, "tenant-smoke-real");
    assert.equal(isPlaceholderTenantId(DEFAULT_TENANT_ID), true);
    assert.equal(isPlaceholderTenantId(tenantId), false);
  });

  it("canonical club record supplies tenant when tournament tenant missing", () => {
    const tenantId = resolvePairingScopeTenantId({
      clubId: "club-smoke-42i1",
      clubs: [{ id: "club-smoke-42i1", tenantId: "tenant-from-canonical" }],
      currentTenantId: DEFAULT_TENANT_ID,
    });
    assert.equal(tenantId, "tenant-from-canonical");
  });

  it("placeholder tenant is omitted (never returned)", () => {
    assert.equal(
      resolvePairingScopeTenantId({
        tournamentTenantId: DEFAULT_TENANT_ID,
        currentTenantId: "default-tenant",
      }),
      null
    );
  });

  it("active membership aliases are not marked inactive", () => {
    assert.equal(isActiveMembershipStatus("active"), true);
    assert.equal(isActiveMembershipStatus("ACTIVE"), true);
    assert.equal(isActiveMembershipStatus("member"), true);
    assert.equal(isActiveMembershipStatus("approved"), true);
    assert.equal(isActiveMembershipStatus(true), true);
    assert.equal(isActiveMembershipStatus("left"), false);

    const exclusion = evaluatePairingEligibility(
      {
        athleteId: "ath-1",
        pairingIdentityId: "ath-1",
        membershipStatus: "ACTIVE",
        athleteStatus: "active",
        clubId: "club-smoke-42i1",
        tenantId: "tenant-real",
      },
      { clubId: "club-smoke-42i1", tenantId: DEFAULT_TENANT_ID }
    );
    assert.equal(exclusion, null);
  });

  it("tenant mismatch does not eliminate valid club-scoped athletes", () => {
    const exclusion = evaluatePairingEligibility(
      {
        athleteId: "ath-2",
        pairingIdentityId: "ath-2",
        membershipStatus: "active",
        athleteStatus: "active",
        clubId: "club-smoke-42i1",
        tenantId: "tenant-real",
      },
      { clubId: "club-smoke-42i1", tenantId: "tenant-stale-or-default" }
    );
    assert.equal(exclusion, null);
  });

  it("all valid CLB Smoke athletes appear when gateway returns them", async () => {
    const smokeAthletes = Array.from({ length: 7 }, (_, i) => ({
      athleteId: `ath-smoke-${i + 1}`,
      pairingIdentityId: `ath-smoke-${i + 1}`,
      displayName: `Smoke ${i + 1}`,
      clubId: "club-smoke-42i1",
      athleteStatus: "active",
      membershipStatus: "active",
      gender: i % 2 === 0 ? "male" : "female",
      tenantId: "tenant-real",
      metadata: { identity: { coverageBucket: "mapped" } },
    }));

    const result = await loadClubPairingCandidatePool("club-smoke-42i1", {
      tenantId: DEFAULT_TENANT_ID,
      service: {
        async listCandidates(query) {
          assert.equal(query.clubId, "club-smoke-42i1");
          // Placeholder tenant must be stripped by adapter.
          assert.equal(query.tenantId, null);
          return {
            status: PAIRING_CANDIDATE_STATUS.READY,
            candidates: smokeAthletes,
            excluded: [],
            summary: {
              sourceCount: 7,
              eligibleCount: 7,
              excludedCount: 0,
              byReason: {},
            },
            diagnostics: {
              sourceBreakdown: {
                membershipRows: 7,
                activeMembershipRows: 7,
                athleteRows: 7,
              },
            },
          };
        },
      },
    });

    assert.equal(result.ok, true);
    assert.equal(result.players.length, 7);
    assert.equal(result.diagnostics.eligibleCount, 7);
    assert.equal(result.diagnostics.wrongScopeCount, 0);
  });

  it("Toàn bộ CLB rejects placeholder tenant instead of returning Owner-only fake pool", async () => {
    const result = await loadTenantPairingCandidatePool(DEFAULT_TENANT_ID, {});
    assert.equal(result.ok, false);
    assert.equal(result.code, RC.WRONG_SCOPE);
    assert.match(result.message, /default-tenant|tenant hợp lệ/i);
  });

  it("Toàn bộ CLB merges accessible clubs for a real tenant", async () => {
    const result = await loadTenantPairingCandidatePool("tenant-accessible", {
      listClubs: async () => ({
        ok: true,
        clubs: [
          { id: "club-a", name: "A" },
          { id: "club-b", name: "B" },
        ],
      }),
      service: {
        async listCandidates(query) {
          return {
            status: PAIRING_CANDIDATE_STATUS.READY,
            candidates: [
              {
                athleteId: `ath-${query.clubId}`,
                pairingIdentityId: `ath-${query.clubId}`,
                displayName: query.clubId,
                clubId: query.clubId,
                athleteStatus: "active",
                membershipStatus: "active",
                gender: "male",
                metadata: {},
              },
            ],
            excluded: [],
            summary: {
              sourceCount: 1,
              eligibleCount: 1,
              excludedCount: 0,
              byReason: {},
            },
          };
        },
      },
    });
    assert.equal(result.ok, true);
    assert.equal(result.players.length, 2);
  });
});

describe("Team Tournament final blockers — disciplines cloud_primary", () => {
  beforeEach(() => {
    __setTeamTournamentDataModeForTests(TEAM_TOURNAMENT_DATA_MODES.CLOUD_PRIMARY);
  });

  afterEach(() => {
    __resetTeamTournamentDataModeForTests();
  });

  it("discipline add does not fake local success in cloud_primary", async () => {
    const repo = createTeamTournamentRepository({
      allowFutureModes: true,
      forceNew: true,
    });
    const orch = createTeamTournamentUiOrchestrator({
      repository: repo,
      forceNew: true,
    });

    const result = orch.patchTeamData("club-x", "t-x", {
      teamData: {
        disciplines: [
          { id: "d1", name: "Đôi nam" },
          { id: "d2", name: "Đôi nữ" },
          { id: "d3", name: "Đôi nam nữ" },
        ],
      },
    });

    assert.equal(result.ok, false);
    assert.match(String(result.error || ""), /BLOCKED BY CLOUD SCHEMA|save_discipline/i);
  });

  it("cloud failure path never reports ok for discipline patch", () => {
    __setTeamTournamentDataModeForTests(TEAM_TOURNAMENT_DATA_MODES.CLOUD_ONLY);
    const repo = createTeamTournamentRepository({
      allowFutureModes: true,
      forceNew: true,
    });
    const orch = createTeamTournamentUiOrchestrator({
      repository: repo,
      forceNew: true,
    });
    const result = orch.patchTeamData("club-x", "t-x", {
      teamData: { disciplines: [{ id: "d1", name: "Đôi nam" }] },
    });
    assert.equal(result.ok, false);
    assert.notEqual(result.ok, true);
  });
});
