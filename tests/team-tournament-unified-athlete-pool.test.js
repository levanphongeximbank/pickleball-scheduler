import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

import {
  applyTeamTournamentAthletePostFilters,
  listAvailableAthletes,
  resolveTeamTournamentAthleteClubId,
  resolveTeamTournamentAthleteTenantId,
  TEAM_TOURNAMENT_ATHLETE_POOL_VERSION,
  TEAM_TOURNAMENT_ATHLETE_SCOPE,
} from "../src/features/team-tournament/services/teamTournamentAthletePoolService.js";
import { DEFAULT_TENANT_ID } from "../src/models/tenant.js";
import { PAIRING_CANDIDATE_STATUS } from "../src/features/pairing-candidates/index.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const FORBIDDEN_IMPORT_PATTERNS = [
  /loadSelectPlayersCandidatePool/,
  /loadTeamBuilderClubCandidatePool/,
  /loadTeamBuilderTenantCandidatePool/,
  /loadTournamentPickerClubCandidatePool/,
  /loadTournamentPickerTenantCandidatePool/,
  /useClubPairingCandidatePool/,
  /useTenantPairingCandidatePool/,
  /loadClubPairingCandidatePool/,
  /loadTenantPairingCandidatePool/,
  /useClubPlayerPool/,
  /useTenantPlayerPool/,
  /listPlayersForClubAware/,
  /loadPlayersForClub/,
  /loadPlayersFromStorage/,
  /canonicalPlayerRepository/,
  /pairingCandidateService/,
  /canonicalAthleteRepository/,
];

const UNIFIED_UI_FILES = [
  "src/pages/tournament/TeamTournamentSetup.jsx",
  "src/pages/tournament/InternalTournamentSetup.jsx",
  "src/pages/tournament/TeamPortal.jsx",
  "src/pages/tournament/TeamRefereePortal.jsx",
  "src/components/tournament/TeamRosterPanel.jsx",
  "src/components/tournament/team/TeamAiPairingDialog.jsx",
  "src/components/tournament/TeamSubstitutionPanel.jsx",
  "src/components/tournament/TournamentPlayerQuickAddDialog.jsx",
  "src/features/team-tournament/services/teamTournamentService.js",
];

const SHARED_POOL_SERVICE =
  "src/features/team-tournament/services/teamTournamentAthletePoolService.js";

const PASSIVE_POOL_CONSUMERS = new Set([
  "src/components/tournament/team/TeamAiPairingDialog.jsx",
  "src/components/tournament/TeamSubstitutionPanel.jsx",
  "src/components/tournament/TournamentPlayerQuickAddDialog.jsx",
]);

function makeGatewayPlayers(clubId, count, offset = 0) {
  return Array.from({ length: count }, (_, i) => {
    const n = offset + i + 1;
    return {
      athleteId: `ath-${clubId}-${n}`,
      pairingIdentityId: `ath-${clubId}-${n}`,
      displayName: `${clubId} Athlete ${n}`,
      clubId,
      athleteStatus: "active",
      membershipStatus: "active",
      gender: n % 2 === 0 ? "female" : "male",
      tenantId: "tenant-shared",
      metadata: { identity: { coverageBucket: "mapped" } },
    };
  });
}

function makeClubService(byClub) {
  return {
    async listCandidates(query) {
      const rows = byClub[query.clubId] || [];
      return {
        status: PAIRING_CANDIDATE_STATUS.READY,
        candidates: rows,
        excluded: [],
        summary: {
          sourceCount: rows.length,
          eligibleCount: rows.length,
          excludedCount: 0,
          byReason: {},
        },
        diagnostics: {
          sourceBreakdown: {
            membershipRows: rows.length,
            activeMembershipRows: rows.length,
            athleteRows: rows.length,
          },
        },
      };
    },
  };
}

describe("Team Tournament unified athlete pool", () => {
  it("1. ownership — TT runtime does not import legacy/blob discovery adapters", () => {
    for (const rel of UNIFIED_UI_FILES) {
      const text = readFileSync(path.join(ROOT, rel), "utf8");
      for (const pattern of FORBIDDEN_IMPORT_PATTERNS) {
        assert.equal(
          pattern.test(text),
          false,
          `${rel} must not import ${pattern}`
        );
      }
      if (!PASSIVE_POOL_CONSUMERS.has(rel)) {
        assert.match(
          text,
          /listAvailableAthletes|useTeamTournamentAthletePool|loadAthletesForTeamTournamentMutation|teamTournamentAthletePoolService/
        );
      }
    }

    const quickAdd = readFileSync(
      path.join(ROOT, "src/components/tournament/TournamentPlayerQuickAddDialog.jsx"),
      "utf8"
    );
    assert.match(quickAdd, /appendGuestPlayerToClubBlobLegacy/);
    assert.doesNotMatch(quickAdd, /loadPlayersForClub/);
    assert.doesNotMatch(quickAdd, /savePlayersForClub/);

    const poolService = readFileSync(path.join(ROOT, SHARED_POOL_SERVICE), "utf8");
    assert.match(poolService, /loadClubPairingCandidatePool/);
    assert.match(poolService, /loadTenantPairingCandidatePool/);
    assert.doesNotMatch(poolService, /loadPlayersForClub/);
    assert.doesNotMatch(poolService, /from ["'].*pairingCandidateService/);
    assert.doesNotMatch(poolService, /from ["'].*canonicalAthleteRepository/);
  });

  it("1b. dead TT loader selectHostClubAthletesForTeamMlp is retired", () => {
    const indexText = readFileSync(
      path.join(ROOT, "src/features/team-tournament/index.js"),
      "utf8"
    );
    assert.doesNotMatch(indexText, /selectHostClubAthletesForTeamMlp/);
  });

  it("2. same Club produces same base athlete IDs across callers", async () => {
    const clubA = makeGatewayPlayers("club-a", 7);
    const service = makeClubService({ "club-a": clubA });
    const deps = { service };

    const internal = await listAvailableAthletes({
      clubId: "club-a",
      tenantId: "tenant-shared",
      scopeMode: TEAM_TOURNAMENT_ATHLETE_SCOPE.CLUB,
      callerName: "InternalTournamentSetup.club",
      deps,
    });
    const roster = await listAvailableAthletes({
      clubId: "club-a",
      tenantId: "tenant-shared",
      scopeMode: TEAM_TOURNAMENT_ATHLETE_SCOPE.CLUB,
      callerName: "TeamRosterPanel.manual",
      deps,
    });
    const ai = await listAvailableAthletes({
      clubId: "club-a",
      tenantId: "tenant-shared",
      scopeMode: TEAM_TOURNAMENT_ATHLETE_SCOPE.CLUB,
      callerName: "TeamRosterPanel.aiPairing",
      deps,
    });

    const ids = (result) =>
      result.athletes.map((a) => a.id || a.athleteId).sort().join(",");
    assert.equal(internal.ok, true);
    assert.equal(ids(internal), ids(roster));
    assert.equal(ids(roster), ids(ai));
    assert.equal(internal.athletes.length, 7);
  });

  it("3. Toàn bộ CLB returns all accessible athletes (7+5=12)", async () => {
    const clubA = makeGatewayPlayers("club-a", 7);
    const clubB = makeGatewayPlayers("club-b", 5, 100);
    const service = makeClubService({ "club-a": clubA, "club-b": clubB });

    const all = await listAvailableAthletes({
      tenantId: "tenant-shared",
      scopeMode: TEAM_TOURNAMENT_ATHLETE_SCOPE.TENANT,
      callerName: "TeamRosterPanel.tenant",
      deps: {
        service,
        listClubs: async () => ({
          ok: true,
          clubs: [
            { id: "club-a", name: "A" },
            { id: "club-b", name: "B" },
          ],
        }),
      },
    });
    assert.equal(all.ok, true);
    assert.equal(all.athletes.length, 12);

    const onlyA = await listAvailableAthletes({
      clubId: "club-a",
      tenantId: "tenant-shared",
      scopeMode: TEAM_TOURNAMENT_ATHLETE_SCOPE.CLUB,
      callerName: "filter.clubA",
      deps: { service },
    });
    const onlyB = await listAvailableAthletes({
      clubId: "club-b",
      tenantId: "tenant-shared",
      scopeMode: TEAM_TOURNAMENT_ATHLETE_SCOPE.CLUB,
      callerName: "filter.clubB",
      deps: { service },
    });
    assert.equal(onlyA.athletes.length, 7);
    assert.equal(onlyB.athletes.length, 5);
  });

  it("4. tournament.clubId overrides stale activeClubId", () => {
    const clubId = resolveTeamTournamentAthleteClubId({
      tournamentClubId: "club-smoke-42i1",
      clubFromQuery: "",
      selectedClubId: "",
      activeClubId: "club-stale-other",
    });
    assert.equal(clubId, "club-smoke-42i1");
  });

  it("5. no default-tenant fallback", () => {
    assert.equal(
      resolveTeamTournamentAthleteTenantId({
        tournamentTenantId: DEFAULT_TENANT_ID,
        currentTenantId: "default-tenant",
      }),
      null
    );
  });

  it("6. active membership aliases normalize via shared pool diagnostics", async () => {
    const service = {
      async listCandidates() {
        return {
          status: PAIRING_CANDIDATE_STATUS.READY,
          candidates: [
            {
              athleteId: "ath-1",
              pairingIdentityId: "ath-1",
              displayName: "Active Alias",
              clubId: "club-a",
              athleteStatus: "active",
              membershipStatus: "ACTIVE",
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
          diagnostics: {
            sourceBreakdown: {
              membershipRows: 1,
              activeMembershipRows: 1,
              athleteRows: 1,
            },
          },
        };
      },
    };
    // Gateway already accepted ACTIVE via eligibility; pool passes through.
    const result = await listAvailableAthletes({
      clubId: "club-a",
      scopeMode: TEAM_TOURNAMENT_ATHLETE_SCOPE.CLUB,
      callerName: "alias",
      deps: { service },
    });
    assert.equal(result.ok, true);
    assert.equal(result.athletes.length, 1);
  });

  it("7. athletes.id always wins as selection identity", async () => {
    const service = {
      async listCandidates() {
        return {
          status: PAIRING_CANDIDATE_STATUS.READY,
          candidates: [
            {
              athleteId: "ath-canonical",
              pairingIdentityId: "ath-canonical",
              displayName: "X",
              clubId: "club-a",
              athleteStatus: "active",
              membershipStatus: "active",
              gender: "female",
              metadata: { profilePlayerId: "blob-1", legacyPlayerId: "legacy-1" },
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
    };
    const result = await listAvailableAthletes({
      clubId: "club-a",
      scopeMode: TEAM_TOURNAMENT_ATHLETE_SCOPE.CLUB,
      callerName: "identity",
      deps: { service },
    });
    assert.equal(result.athletes[0].id, "ath-canonical");
    assert.equal(result.athletes[0].athleteId, "ath-canonical");
  });

  it("8–9. manual add supports multiple athletes; assigned exclusion reversible", () => {
    const base = [
      { id: "a1", athleteId: "a1", gender: "male" },
      { id: "a2", athleteId: "a2", gender: "female" },
      { id: "a3", athleteId: "a3", gender: "male" },
      { id: "a4", athleteId: "a4", gender: "female" },
    ];
    const withAssigned = applyTeamTournamentAthletePostFilters(base, {
      assignedAthleteIds: ["a1", "a2"],
    });
    assert.equal(withAssigned.athletes.length, 2);
    assert.equal(withAssigned.alreadyAssignedCount, 2);

    const afterRemove = applyTeamTournamentAthletePostFilters(base, {
      assignedAthleteIds: ["a1"],
    });
    assert.equal(afterRemove.athletes.length, 3);
    assert.ok(afterRemove.athletes.some((a) => a.id === "a2"));
  });

  it("10. AI pool is not reduced before gender filtering", async () => {
    const rows = makeGatewayPlayers("club-a", 8);
    const service = makeClubService({ "club-a": rows });
    const base = await listAvailableAthletes({
      clubId: "club-a",
      scopeMode: TEAM_TOURNAMENT_ATHLETE_SCOPE.CLUB,
      callerName: "ai.base",
      deps: { service },
    });
    const maleOnly = await listAvailableAthletes({
      clubId: "club-a",
      scopeMode: TEAM_TOURNAMENT_ATHLETE_SCOPE.CLUB,
      gender: "male",
      callerName: "ai.male",
      deps: { service },
    });
    assert.equal(base.athletes.length, 8);
    assert.ok(maleOnly.athletes.length < base.athletes.length);
    assert.ok(maleOnly.diagnostics.GENDER_FILTERED > 0);
  });

  it("11. repository error is not displayed as zero athletes success", async () => {
    const result = await listAvailableAthletes({
      clubId: "club-a",
      scopeMode: TEAM_TOURNAMENT_ATHLETE_SCOPE.CLUB,
      callerName: "error",
      deps: {
        service: {
          async listCandidates() {
            return {
              status: "error",
              candidates: [],
              excluded: [],
              summary: { sourceCount: 0, eligibleCount: 0, excludedCount: 0, byReason: {} },
              diagnostics: {
                error: { code: "REPOSITORY_ERROR", message: "RPC failed" },
              },
            };
          },
        },
      },
    });
    assert.equal(result.ok, false);
    assert.notEqual(result.empty, true);
    assert.equal(result.athletes.length, 0);
  });

  it("12. missing identity is explicit in diagnostics message", async () => {
    const result = await listAvailableAthletes({
      clubId: "club-a",
      scopeMode: TEAM_TOURNAMENT_ATHLETE_SCOPE.CLUB,
      callerName: "missing-id",
      deps: {
        service: {
          async listCandidates() {
            return {
              status: PAIRING_CANDIDATE_STATUS.READY,
              candidates: [],
              excluded: [
                {
                  reasonCode: "MISSING_IDENTITY_LINK",
                  displayName: "X",
                },
              ],
              summary: {
                sourceCount: 1,
                eligibleCount: 0,
                excludedCount: 1,
                byReason: { MISSING_IDENTITY_LINK: 1 },
              },
              diagnostics: {
                sourceBreakdown: {
                  membershipRows: 1,
                  activeMembershipRows: 1,
                  athleteRows: 0,
                },
              },
            };
          },
        },
      },
    });
    assert.equal(result.ok, true);
    assert.equal(result.empty, true);
    assert.match(result.emptyMessage, /MISSING_IDENTITY_LINK/);
    assert.doesNotMatch(result.emptyMessage || "", /CLB này chưa có thành viên/);
  });

  it("13–14. pool version + shared service path are stable", () => {
    assert.equal(TEAM_TOURNAMENT_ATHLETE_POOL_VERSION, "tt-v6-unified-1");
    assert.equal(TEAM_TOURNAMENT_ATHLETE_SCOPE.TENANT, "tenant");
  });
});
