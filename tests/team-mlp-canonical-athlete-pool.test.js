import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { listAvailableAthletes } from "../src/features/team-tournament/services/teamTournamentAthletePoolService.js";
import {
  loadSelectPlayersCandidatePool,
  PAIRING_CANDIDATE_STATUS,
} from "../src/features/pairing-candidates/index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rosterSource = readFileSync(
  path.join(__dirname, "../src/components/tournament/TeamRosterPanel.jsx"),
  "utf8"
);

describe("Team MLP — canonical host-club athlete pool", () => {
  it("TeamRosterPanel loads MLP pool via unified Team Tournament athlete service", () => {
    assert.match(rosterSource, /listAvailableAthletes/);
    assert.match(rosterSource, /teamTournamentAthletePoolService/);
    assert.match(rosterSource, /mlpPairingPool/);
    assert.match(rosterSource, /players=\{mlpPairingPool\}/);
    assert.match(
      rosterSource,
      /TeamAiPairingDialog[\s\S]*players=\{mlpPairingPool\}/
    );
    assert.doesNotMatch(rosterSource, /loadSelectPlayersCandidatePool/);
    assert.doesNotMatch(rosterSource, /loadTeamBuilderClubCandidatePool/);
    assert.doesNotMatch(rosterSource, /selectHostClubAthletesForTeamMlp/);
  });

  it("club-scoped listAvailableAthletes is the host MLP filter (no orphan helper)", async () => {
    const result = await listAvailableAthletes({
      clubId: "club-a",
      tenantId: "tenant-shared",
      scopeMode: "club",
      callerName: "team-mlp-test",
      deps: {
        service: {
          async listCandidates(query) {
            const rows = [
              {
                athleteId: "ath-1",
                pairingIdentityId: "ath-1",
                displayName: "A",
                clubId: "club-a",
                athleteStatus: "active",
                membershipStatus: "active",
                gender: "male",
                tenantId: "tenant-shared",
              },
              {
                athleteId: "ath-2",
                pairingIdentityId: "ath-2",
                displayName: "B",
                clubId: "club-b",
                athleteStatus: "active",
                membershipStatus: "active",
                gender: "female",
                tenantId: "tenant-shared",
              },
            ].filter((r) => r.clubId === query.clubId);
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
              diagnostics: {},
            };
          },
        },
      },
    });

    assert.equal(result.ok, true);
    assert.deepEqual(
      result.athletes.map((a) => a.id || a.athleteId),
      ["ath-1"]
    );
  });

  it("canonical pool projects athleteId as pairing identity (no blob SSOT)", async () => {
    const result = await loadSelectPlayersCandidatePool("club-a", {
      listMembers: async () => ({
        ok: true,
        members: [
          {
            id: "mem-1",
            user_id: "user-1",
            athlete_id: "ath-host",
            display_name: "Host Athlete",
            status: "active",
            tenant_id: "tenant-a",
          },
        ],
      }),
      fetchProfiles: async () => ({
        ok: true,
        profiles: [
          {
            id: "user-1",
            player_id: "legacy-blob-id",
            gender: "female",
            display_name: "Host Athlete",
          },
        ],
      }),
      fetchAthletes: async () => ({
        ok: true,
        athletes: [
          {
            id: "ath-host",
            user_id: "user-1",
            display_name: "Host Athlete",
            status: "active",
            rating: 3.8,
          },
        ],
      }),
    });

    assert.equal(result.ok, true);
    assert.equal(result.players[0].id, "ath-host");
    assert.equal(result.players[0].athleteId, "ath-host");
    assert.equal(result.players[0].clubId, "club-a");
    assert.equal(result.players[0].source, "pairing-candidate-gateway");
    assert.notEqual(result.players[0].id, "legacy-blob-id");
  });
});
