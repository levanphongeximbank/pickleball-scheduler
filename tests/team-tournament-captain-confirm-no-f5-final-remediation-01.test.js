/**
 * TEAM-TOURNAMENT-CAPTAIN-CONFIRM-NO-F5-FINAL-REMEDIATION-01
 *
 * Proves captain confirm advances without F5:
 * full mutation barrier → writes → final get_setup always → React commit
 * → dialog closes → workflow advances; poll/realtime cannot clobber.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

import {
  commitCanonicalSetupLoad,
  createCanonicalSetupRefreshController,
  refreshCanonicalSetupAfterMutation,
  resolveCanonicalReloadApply,
} from "../src/features/team-tournament/ui/canonicalSetupRefresh.js";
import { confirmAiPairingUiTransaction } from "../src/features/team-tournament/services/confirmAiPairingUiTransaction.js";
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

function buildTeams(count = 8) {
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

function buildGroups(teams) {
  return [
    {
      id: "g1",
      name: "A",
      teamIds: teams.slice(0, 4).map((t) => t.id),
    },
    {
      id: "g2",
      name: "B",
      teamIds: teams.slice(4).map((t) => t.id),
    },
  ];
}

function buildCanonicalPayload(teams, groups, version = 5) {
  return {
    ok: true,
    version,
    teamData: {
      teams,
      groups,
      disciplines: [],
      matchups: [],
    },
    tournament: { id: "tt-1", teamData: { teams, groups } },
  };
}

describe("team-tournament-captain-confirm-no-f5-final-remediation-01", () => {
  it("captain confirm: groups success still runs final get_setup and commits React (no F5)", async () => {
    const controller = createCanonicalSetupRefreshController();
    const applied = [];
    let refreshCalls = 0;
    const teams = buildTeams(8);
    const groups = buildGroups(teams);
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
          loadSetup: async () => buildCanonicalPayload(teams, groups, 9),
          applyLoadResult: (r) => applied.push(r),
        });
      },
      nextTeamData,
      confirmFn: async () => ({
        ok: true,
        writeCount: 2,
        captainsPersisted: 8,
        groupsExpected: 2,
        // Intermediate group snapshot present — must NOT skip final refresh.
        groupResult: {
          ok: true,
          tournament: { id: "tt-1" },
          teamData: { teams, groups: [] },
          aggregate: { teamData: { teams, groups: [] } },
        },
        teamData: { teams, groups: [], matchups: [] },
        tournament: { id: "tt-1" },
      }),
    });

    assert.equal(result.ok, true);
    assert.equal(result.reactCanonicalCommitted, true);
    assert.equal(refreshCalls, 1, "final canonical refresh must always run");
    assert.equal(applied.length, 1);
    assert.equal(applied[0].teamData.groups.length, 2);
    assert.equal(result.workflowStage, WORKFLOW_STAGE.DISCIPLINES);
    assert.equal(barrierDepth, 0, "barrier must end after transaction");
    assert.equal(controller.isMutationBarrierActive(), false);
  });

  it("captain confirm: groups failure does not close as success", async () => {
    const controller = createCanonicalSetupRefreshController();
    let refreshCalls = 0;

    const result = await confirmAiPairingUiTransaction({
      beginMutationBarrier: () => controller.beginMutationBarrier(),
      endMutationBarrier: () => controller.endMutationBarrier(),
      refreshAfterMutation: async () => {
        refreshCalls += 1;
        return { ok: true, applied: true };
      },
      nextTeamData: {
        teams: buildTeams(8),
        groups: buildGroups(buildTeams(8)),
      },
      confirmFn: async () => ({
        ok: false,
        code: "GROUP_SAVE_FAILED",
        error: "groups failed",
        partial: true,
      }),
    });

    assert.equal(result.ok, false);
    assert.equal(result.code, "GROUP_SAVE_FAILED");
    assert.equal(refreshCalls, 0, "no final refresh when writes failed");
    assert.equal(controller.isMutationBarrierActive(), false);
  });

  it("silent polling during captain confirm cannot clobber final state", async () => {
    const controller = createCanonicalSetupRefreshController();
    const applied = [];
    const teams = buildTeams(8);
    const groups = buildGroups(teams);

    controller.beginMutationBarrier();
    const pollGen = controller.beginReload();
    // Poll completes while barrier active — must not apply.
    const pollDecision = resolveCanonicalReloadApply(controller, pollGen);
    assert.equal(pollDecision.apply, false);
    assert.equal(pollDecision.reason, "mutation_barrier");

    const finalPayload = buildCanonicalPayload(teams, groups, 12);
    const refreshed = await refreshCanonicalSetupAfterMutation({
      controller,
      loadSetup: async () => finalPayload,
      applyLoadResult: (r) => applied.push(r),
    });
    assert.equal(refreshed.applied, true);
    assert.equal(applied.length, 1);
    assert.equal(deriveWorkflowStage(applied[0].teamData), WORKFLOW_STAGE.DISCIPLINES);

    // Late poll with older generation still blocked / stale after commit.
    const late = resolveCanonicalReloadApply(controller, pollGen);
    assert.equal(late.apply, false);
    controller.endMutationBarrier();
  });

  it("realtime reload during captain confirm is blocked by mutation barrier", async () => {
    const controller = createCanonicalSetupRefreshController();
    controller.beginMutationBarrier();
    const gen = controller.beginReload();
    const decision = resolveCanonicalReloadApply(controller, gen, {
      applyUi: true,
    });
    assert.equal(decision.apply, false);
    assert.equal(decision.reason, "mutation_barrier");
    controller.endMutationBarrier();
  });

  it("stale intermediate get_setup cannot replace final committed canonical state", async () => {
    const controller = createCanonicalSetupRefreshController();
    const applied = [];
    const teams = buildTeams(8);
    const groups = buildGroups(teams);

    const staleGen = controller.beginReload();
    commitCanonicalSetupLoad(
      controller,
      (r) => applied.push(r),
      buildCanonicalPayload(teams, groups, 20)
    );
    const staleDecision = resolveCanonicalReloadApply(controller, staleGen);
    assert.equal(staleDecision.apply, false);
    assert.equal(staleDecision.stale, true);
    assert.equal(applied.length, 1);
    assert.equal(applied[0].version, 20);
  });

  it("wiring: alreadyCommitted refresh gap removed; full barrier + UI success contract", () => {
    const roster = readSrc("src/components/tournament/TeamRosterPanel.jsx");
    const dialog = readSrc(
      "src/components/tournament/team/TeamAiPairingDialog.jsx"
    );
    const setup = readSrc("src/pages/tournament/TeamTournamentSetup.jsx");
    const page = readSrc(
      "src/features/team-tournament/ui/useTeamTournamentPage.js"
    );
    const tx = readSrc(
      "src/features/team-tournament/services/confirmAiPairingUiTransaction.js"
    );
    const persist = readSrc(
      "src/features/team-tournament/services/aiPairingCloudPersistence.js"
    );

    assert.match(tx, /confirmAiPairingUiTransaction/);
    assert.match(tx, /refreshAfterMutation/);
    assert.match(tx, /beginMutationBarrier/);
    assert.match(tx, /reactCanonicalCommitted:\s*true/);
    assert.doesNotMatch(tx, /alreadyCommitted/);
    assert.doesNotMatch(tx, /window\.location\.reload/);
    assert.doesNotMatch(tx, /localStorage/);

    assert.match(roster, /confirmAiPairingUiTransaction/);
    assert.doesNotMatch(roster, /alreadyCommitted/);
    assert.match(roster, /reactCanonicalCommitted:\s*true/);
    assert.match(roster, /onCaptainConfirmSuccess/);
    assert.doesNotMatch(roster, /window\.location\.reload/);

    assert.match(dialog, /applyResult\?\.ok === true/);
    assert.doesNotMatch(dialog, /applyResult == null \|\| applyResult\.ok !== false/);

    assert.match(setup, /beginMutationBarrier=\{beginMutationBarrier\}/);
    assert.match(setup, /endMutationBarrier=\{endMutationBarrier\}/);
    assert.match(setup, /onCaptainConfirmSuccess/);
    assert.match(setup, /TEAM_TAB_QUERY\.disciplines/);

    assert.match(page, /mutation_barrier/);
    assert.match(page, /isMutationBarrierActive\(\)/);
    assert.match(page, /beginMutationBarrier/);
    assert.match(page, /runWithMutationBarrier/);
    assert.doesNotMatch(page, /window\.location\.reload\s*\(/);

    // save_draft path unchanged (still present, not rewritten by this workstream)
    assert.match(page, /saveDraft/);
    assert.match(page, /save_draft_readback|draft_version_conflict/);
    assert.doesNotMatch(persist, /location\.reload/);
  });

  it("save_draft regression: page still owns independent saveDraft barrier path", () => {
    const page = readSrc(
      "src/features/team-tournament/ui/useTeamTournamentPage.js"
    );
    const orchestrator = readSrc(
      "src/features/team-tournament/ui/teamTournamentUiOrchestrator.js"
    );
    assert.match(page, /const saveDraft = useCallback/);
    assert.match(page, /orchestrator\.saveDraft/);
    assert.match(page, /reason:\s*"save_draft_readback"/);
    assert.match(orchestrator, /save_draft|saveDraft/);
    // Captain-confirm transaction must not rewrite save_draft service
    const saveDraftServiceHit = readSrc(
      "src/features/team-tournament/services/confirmAiPairingUiTransaction.js"
    );
    assert.doesNotMatch(saveDraftServiceHit, /save_draft/);
    assert.doesNotMatch(saveDraftServiceHit, /saveDraft/);
  });
});
