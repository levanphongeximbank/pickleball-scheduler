/**
 * TEAM-TOURNAMENT-PR412-LIVE-CERT-BLOCKER-REMEDIATION-01
 *
 * - Format/Venue groupCount=1 must seed AI pairing UI (no hardcoded 2)
 * - Captain confirm CTA must be always visible on captain step
 * - Captain confirm still advances without F5 via UI transaction
 * - Court selection helpers work against canonical fixtures
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

import {
  GROUP_MODE,
  FORMAT_PRESET,
} from "../src/features/team-tournament/constants.js";
import {
  resolveFormatVenueDefaults,
  resolvePairingGroupCount,
  resolveSelectedCourts,
} from "../src/features/team-tournament/engines/teamFormatVenueConfig.js";
import { buildAiGroupRevealSession } from "../src/features/team-tournament/showcase/buildAiGroupRevealSession.js";
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

describe("team-tournament-pr412-live-cert-blocker-remediation-01", () => {
  it("ONE_GROUP_PAIRING: saved groupCount=1 reloads into pairing resolver (no fallback to 2)", () => {
    const teamData = {
      settings: {
        formatPreset: FORMAT_PRESET.MLP_4,
        groupMode: GROUP_MODE.SINGLE_POOL,
        groupCount: 1,
      },
      teams: [],
      groups: [],
    };
    const tournament = {
      settings: {
        formatPreset: FORMAT_PRESET.MLP_4,
        groupMode: GROUP_MODE.SINGLE_POOL,
        groupCount: 1,
      },
    };

    const defaults = resolveFormatVenueDefaults(teamData, tournament);
    assert.equal(defaults.groupCount, 1);
    assert.equal(resolvePairingGroupCount(teamData, tournament), 1);

    const dialogSrc = readSrc("src/components/tournament/team/TeamAiPairingDialog.jsx");
    assert.match(dialogSrc, /resolvePairingGroupCount/);
    assert.doesNotMatch(dialogSrc, /setGroupCount\(2\)/);
    assert.doesNotMatch(dialogSrc, /useState\(2\)/);

    const boardSrc = readSrc("src/components/tournament/team/TeamAiPairingConfigBoard.jsx");
    assert.match(boardSrc, /label="Số bảng"[\s\S]*?min:\s*1,\s*max:\s*8/);
    assert.match(boardSrc, /onGroupCountChange\?\.\(Math\.max\(1,/);
    assert.doesNotMatch(
      boardSrc,
      /onGroupCountChange\?\.\(Math\.max\(2,/
    );
  });

  it("ONE_GROUP_PAIRING: buildAiGroupRevealSession accepts groupCount=1 (single pool)", () => {
    const teams = buildTeams(4);
    const players = teams.flatMap((team) =>
      team.playerIds.map((id) => ({
        id,
        name: id,
        gender: String(id).startsWith("m") ? "male" : "female",
        rating: 4,
      }))
    );

    const built = buildAiGroupRevealSession({
      teams,
      players,
      groupCount: 1,
    });
    assert.equal(built.ok, true, built.error);
    assert.equal(built.groupCount, 1);
    assert.equal(built.teamData?.groups?.length, 1);
    assert.equal(built.teamData.groups[0].teamIds.length, 4);
  });

  it("CAPTAIN_CONFIRM_CTA: captain step renders sticky/footer confirm CTA (not buried below fold)", () => {
    const dialogSrc = readSrc("src/components/tournament/team/TeamAiPairingDialog.jsx");
    assert.match(dialogSrc, /data-testid="team-ai-pairing-captain-confirm-footer"/);
    assert.match(dialogSrc, /data-testid="team-ai-pairing-captain-confirm-cta"/);
    assert.match(dialogSrc, /activeStep === 1/);
    assert.match(dialogSrc, /\{applying \? "Đang lưu…" : "Xác nhận"\}/);
    // CTA lives as Dialog sibling footer (flexShrink:0), not only inside scrolling column.
    assert.match(dialogSrc, /flexShrink:\s*0/);
    assert.match(dialogSrc, /display:\s*"flex"/);
    assert.match(dialogSrc, /flexDirection:\s*"column"/);
  });

  it("CAPTAIN_GROUP_NO_F5: confirm CTA path persists groups + final get_setup + advances workflow", async () => {
    const controller = createCanonicalSetupRefreshController();
    const applied = [];
    let refreshCalls = 0;
    const teams = buildTeams(4);
    const groups = [
      {
        id: "g1",
        name: "A",
        teamIds: teams.map((t) => t.id),
      },
    ];
    const nextTeamData = { teams, groups, matchups: [] };

    let barrierDepth = 0;
    const result = await confirmAiPairingUiTransaction({
      beginMutationBarrier: () => {
        barrierDepth += 1;
        return controller.beginMutationBarrier();
      },
      endMutationBarrier: () => {
        barrierDepth = Math.max(0, barrierDepth - 1);
        controller.endMutationBarrier();
      },
      refreshAfterMutation: async () => {
        refreshCalls += 1;
        return refreshCanonicalSetupAfterMutation({
          controller,
          loadSetup: async () => ({
            ok: true,
            version: 7,
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
        groupResult: {
          ok: true,
          tournament: { id: "tt-1" },
          teamData: { teams, groups },
          aggregate: { teamData: { teams, groups } },
        },
        teamData: { teams, groups, matchups: [] },
        tournament: { id: "tt-1" },
      }),
    });

    assert.equal(result.ok, true, result.error);
    assert.equal(result.reactCanonicalCommitted, true);
    assert.equal(refreshCalls, 1);
    assert.equal(applied.length, 1);
    assert.equal(applied[0].teamData.groups.length, 1);
    assert.equal(barrierDepth, 0);
    assert.notEqual(
      deriveWorkflowStage(applied[0].teamData),
      WORKFLOW_STAGE.TEAMS_EMPTY
    );
  });

  it("COURT_SELECTION: resolveSelectedCourts maps canonical court fixtures (no fake invent in UI)", () => {
    const venueCourts = [
      {
        id: "tt412-court-01",
        name: "TT412 Sân 1",
        number: 1,
        active: true,
        status: "active",
      },
      {
        id: "tt412-court-02",
        name: "TT412 Sân 2",
        number: 2,
        active: true,
        status: "active",
      },
    ];
    const selected = resolveSelectedCourts(
      ["tt412-court-01", "tt412-court-02"],
      venueCourts
    );
    assert.equal(selected.length, 2);
    assert.equal(selected[0].id, "tt412-court-01");
    assert.equal(selected[1].id, "tt412-court-02");

    const panelSrc = readSrc("src/components/tournament/team/TeamFormatVenueSetupPanel.jsx");
    assert.match(panelSrc, /listCanonicalClubCourtsForFormatVenue|listCourtsFn/);
    assert.doesNotMatch(panelSrc, /fakeCourt|dummyCourt|Hardcoded Court/i);
  });
});
