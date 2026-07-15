import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { selectHostClubAthletesForTeamMlp } from "../src/features/team-tournament/ui/selectHostClubAthletesForTeamMlp.js";
import { loadSelectPlayersCandidatePool } from "../src/features/pairing-candidates/index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rosterSource = readFileSync(
  path.join(__dirname, "../src/components/tournament/TeamRosterPanel.jsx"),
  "utf8"
);

describe("Team MLP — canonical host-club athlete pool", () => {
  it("TeamRosterPanel loads MLP pool via pairing-candidates gateway", () => {
    assert.match(rosterSource, /loadSelectPlayersCandidatePool/);
    assert.match(rosterSource, /mlpPairingPool/);
    assert.match(rosterSource, /players=\{mlpPairingPool\}/);
    assert.match(
      rosterSource,
      /TeamAiPairingDialog[\s\S]*players=\{mlpPairingPool\}/
    );
  });

  it("selectHostClubAthletesForTeamMlp keeps host athletes only", () => {
    const players = [
      {
        id: "ath-1",
        athleteId: "ath-1",
        clubId: "club-a",
        name: "A",
        gender: "Nam",
        rating: 4,
        active: true,
      },
      {
        id: "ath-2",
        athleteId: "ath-2",
        clubId: "club-b",
        name: "B",
        gender: "Nữ",
        rating: 3.5,
        active: true,
      },
      {
        id: "blob-1",
        clubId: "club-a",
        name: "No athlete id",
        active: true,
      },
      {
        id: "ath-3",
        athleteId: "ath-3",
        clubId: "club-a",
        name: "Inactive",
        active: false,
      },
    ];
    const filtered = selectHostClubAthletesForTeamMlp(players, "club-a");
    assert.deepEqual(
      filtered.map((p) => p.id),
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

    const mlp = selectHostClubAthletesForTeamMlp(result.players, "club-a");
    assert.equal(mlp.length, 1);
    assert.equal(mlp[0].athleteId, "ath-host");
  });
});
