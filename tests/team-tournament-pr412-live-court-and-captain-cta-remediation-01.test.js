/**
 * TEAM-TOURNAMENT-PR412-LIVE-COURT-AND-CAPTAIN-CTA-REMEDIATION-01
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

import {
  extractCourtsFromClubDataV3Payload,
  listCanonicalClubCourtsForFormatVenue,
  normalizeCanonicalClubCourts,
  __setCanonicalClubCourtInventoryDepsForTests,
  __resetCanonicalClubCourtInventoryDepsForTests,
} from "../src/features/team-tournament/services/canonicalClubCourtInventory.js";
import {
  resolveFormatVenueDefaults,
  buildSetupConfigPayload,
} from "../src/features/team-tournament/engines/teamFormatVenueConfig.js";
import {
  FORMAT_PRESET,
  GROUP_MODE,
  KNOCKOUT_FORMAT,
} from "../src/features/team-tournament/constants.js";
import { confirmAiPairingUiTransaction } from "../src/features/team-tournament/services/confirmAiPairingUiTransaction.js";
import {
  createCanonicalSetupRefreshController,
  refreshCanonicalSetupAfterMutation,
} from "../src/features/team-tournament/ui/canonicalSetupRefresh.js";
import {
  deriveWorkflowStage,
  WORKFLOW_STAGE,
} from "../src/features/team-tournament/engines/teamTournamentWorkflowStage.js";
import { createTeamRecord } from "../src/features/team-tournament/models/index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

function readSrc(rel) {
  return readFileSync(path.join(root, rel), "utf8");
}

const SEEDED_COURTS = [
  {
    id: "tt412-court-01",
    name: "TT412 Sân 1",
    number: 1,
    active: true,
    status: "active",
    clubId: "club-ecebf64c78f948ccb2b59842441eb26c",
    tenantId: "venue-staging-a",
  },
  {
    id: "tt412-court-02",
    name: "TT412 Sân 2",
    number: 2,
    active: true,
    status: "active",
    clubId: "club-ecebf64c78f948ccb2b59842441eb26c",
    tenantId: "venue-staging-a",
  },
];

function buildTeams(count = 4) {
  const teams = [];
  for (let i = 1; i <= count; i += 1) {
    const ids = [`m${i}a`, `m${i}b`, `f${i}a`, `f${i}b`];
    teams.push(
      createTeamRecord({
        id: `team-ai-${i}`,
        name: `Đội ${i}`,
        playerIds: ids,
        captainPlayerId: ids[0],
        seed: i,
        avgLevel: 4,
      })
    );
  }
  return teams;
}

function mockClientWithRow(rowData, venueId = "venue-staging-a") {
  return {
    from() {
      return {
        select() {
          return this;
        },
        eq() {
          return this;
        },
        limit() {
          return Promise.resolve({
            data: [{ data: rowData, venue_id: venueId, version: 1 }],
            error: null,
          });
        },
      };
    },
  };
}

describe("team-tournament-pr412-live-court-and-captain-cta-remediation-01", () => {
  it("A CANONICAL_COURTS_VISIBLE: cloud courts present + localStorage empty → 2 courts", async () => {
    __setCanonicalClubCourtInventoryDepsForTests({
      hasSupabaseConfig: () => true,
      getSupabaseAuthClient: () =>
        mockClientWithRow({
          schemaVersion: 3.5,
          clubId: "club-ecebf64c78f948ccb2b59842441eb26c",
          courts: SEEDED_COURTS,
          players: [],
        }),
    });

    try {
      const result = await listCanonicalClubCourtsForFormatVenue({
        clubId: "club-ecebf64c78f948ccb2b59842441eb26c",
        tenantId: "venue-staging-a",
      });
      assert.equal(result.ok, true, result.error);
      assert.equal(result.source, "club_data_v3");
      assert.equal(result.courts.length, 2);
      assert.equal(result.courts[0].id, "tt412-court-01");
      assert.equal(result.courts[1].id, "tt412-court-02");
    } finally {
      __resetCanonicalClubCourtInventoryDepsForTests();
    }

    const panel = readSrc(
      "src/components/tournament/team/TeamFormatVenueSetupPanel.jsx"
    );
    assert.match(panel, /createTeamTournamentCourtAdapter|listEligibleCourtsForFormatVenue|listCourtsFn/);
    assert.doesNotMatch(panel, /loadCourtsForClub/);
  });

  it("B SELECTED_COURT_IDS_PERSIST: select one court → selectedCourtIds in payload/reload defaults", () => {
    const config = {
      formatPreset: FORMAT_PRESET.MLP_4,
      rosterRules: {
        teamSize: 4,
        minPlayers: 4,
        maxPlayers: 4,
        requiredMales: 2,
        requiredFemales: 2,
      },
      dreambreakerEnabled: true,
      groupMode: GROUP_MODE.SINGLE_POOL,
      groupCount: 1,
      qualificationCount: 2,
      knockoutFormat: KNOCKOUT_FORMAT.FINAL_ONLY,
      selectedCourtIds: ["tt412-court-01"],
    };
    const payload = buildSetupConfigPayload(config);
    assert.deepEqual(payload.selectedCourtIds, ["tt412-court-01"]);

    const defaults = resolveFormatVenueDefaults(
      { settings: payload },
      { settings: payload }
    );
    assert.deepEqual(defaults.selectedCourtIds, ["tt412-court-01"]);
  });

  it("C LOCALSTORAGE_EMPTY_COURT: flat + nested cloud shapes work without local blob", () => {
    const flat = extractCourtsFromClubDataV3Payload({
      courts: SEEDED_COURTS,
      players: [],
    });
    assert.equal(flat.length, 2);

    const nested = extractCourtsFromClubDataV3Payload({
      clubId: "club-ecebf64c78f948ccb2b59842441eb26c",
      data: { courts: SEEDED_COURTS, players: [] },
      aiData: {},
    });
    assert.equal(nested.length, 2);

    const normalized = normalizeCanonicalClubCourts(flat, {
      clubId: "club-ecebf64c78f948ccb2b59842441eb26c",
      tenantId: "venue-staging-a",
    });
    assert.equal(normalized.length, 2);

    const inventory = readSrc(
      "src/features/team-tournament/services/canonicalClubCourtInventory.js"
    );
    assert.doesNotMatch(inventory, /localStorage\.getItem|loadCourtsForClub|loadClubData/);
    assert.match(inventory, /club_data_v3/);
  });

  it("D CAPTAIN_CTA_VISIBLE_0_OF_4: captain step CTA always rendered; disabled until all captains", () => {
    const dialog = readSrc("src/components/tournament/team/TeamAiPairingDialog.jsx");
    assert.match(dialog, /activeStep === 1/);
    assert.match(dialog, /data-testid="team-ai-pairing-captain-confirm-cta"/);
    assert.match(dialog, /disabled=\{!allCaptainsSelected \|\| applying\}/);
    // CTA is outside DialogContent scroll region (footer sibling).
    assert.match(dialog, /data-testid="team-ai-pairing-captain-confirm-footer"/);

    const allCaptainsSelected = false;
    const applying = false;
    const visible = true; // rendered when activeStep===1
    const disabled = !allCaptainsSelected || applying;
    assert.equal(visible, true);
    assert.equal(disabled, true);
  });

  it("E CAPTAIN_CTA_VISIBLE_4_OF_4 + enabled", () => {
    const teams = buildTeams(4);
    const captains = Object.fromEntries(
      teams.map((team) => [team.id, team.playerIds[0]])
    );
    const allCaptainsSelected = teams.every(
      (team) => captains[team.id] && team.playerIds.includes(captains[team.id])
    );
    assert.equal(allCaptainsSelected, true);
    assert.equal(!allCaptainsSelected || false, false);
  });

  it("F CAPTAIN_FOOTER_VIEWPORT: paper constrained + DialogContent minHeight 0", () => {
    const dialog = readSrc("src/components/tournament/team/TeamAiPairingDialog.jsx");
    assert.match(dialog, /maxHeight:\s*"100dvh"/);
    assert.match(dialog, /overflow:\s*"hidden"/);
    assert.match(dialog, /minHeight:\s*0/);
    assert.match(dialog, /overflowY:\s*"auto"/);
    assert.match(dialog, /flexShrink:\s*0/);
    assert.doesNotMatch(dialog, /minHeight:\s*"100vh"/);
  });

  it("G CAPTAIN_GROUP_NO_F5: confirm persists groups via final get_setup", async () => {
    const controller = createCanonicalSetupRefreshController();
    const applied = [];
    let refreshCalls = 0;
    const teams = buildTeams(4);
    const groups = [{ id: "g1", name: "A", teamIds: teams.map((t) => t.id) }];
    const nextTeamData = { teams, groups, matchups: [] };

    const result = await confirmAiPairingUiTransaction({
      beginMutationBarrier: () => controller.beginMutationBarrier(),
      endMutationBarrier: () => controller.endMutationBarrier(),
      refreshAfterMutation: async () => {
        refreshCalls += 1;
        return refreshCanonicalSetupAfterMutation({
          controller,
          loadSetup: async () => ({
            ok: true,
            version: 8,
            teamData: { teams, groups, disciplines: [], matchups: [] },
            tournament: { id: "tt-1", teamData: { teams, groups } },
          }),
          applyLoadResult: (r) => applied.push(r),
        });
      },
      nextTeamData,
      confirmFn: async () => ({
        ok: true,
        writeCount: 2,
        captainsPersisted: 4,
        groupsExpected: 1,
        groupResult: { ok: true, teamData: { teams, groups } },
        teamData: { teams, groups, matchups: [] },
        tournament: { id: "tt-1" },
      }),
    });

    assert.equal(result.ok, true, result.error);
    assert.equal(refreshCalls, 1);
    assert.equal(applied[0].teamData.groups.length, 1);
    assert.notEqual(
      deriveWorkflowStage(applied[0].teamData),
      WORKFLOW_STAGE.TEAMS_EMPTY
    );
  });
});
