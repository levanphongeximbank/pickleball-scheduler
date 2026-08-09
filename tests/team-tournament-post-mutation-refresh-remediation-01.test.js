/**
 * TEAM-TOURNAMENT-POST-MUTATION-REFRESH-REMEDIATION-01
 *
 * Proves: successful Team mutations refresh canonical get_setup into UI
 * without window.location.reload / F5, and stale in-flight silent reloads
 * cannot clobber newer canonical state.
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
import { deriveWorkflowStage, WORKFLOW_STAGE } from "../src/features/team-tournament/engines/teamTournamentWorkflowStage.js";
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

describe("team-tournament-post-mutation-refresh-remediation-01", () => {
  it("stale concurrent reload generation is ignored (poll/realtime cannot clobber)", async () => {
    const controller = createCanonicalSetupRefreshController();
    const applied = [];

    const genStale = controller.beginReload();
    const genFresh = controller.beginReload();

    assert.equal(
      resolveCanonicalReloadApply(controller, genStale).apply,
      false
    );
    assert.equal(
      resolveCanonicalReloadApply(controller, genFresh).apply,
      true
    );

    const freshPayload = {
      ok: true,
      version: 3,
      teamData: {
        teams: buildTeams(8),
        groups: [
          { id: "g1", name: "A", teamIds: ["team-ai-1", "team-ai-2", "team-ai-3", "team-ai-4"] },
          { id: "g2", name: "B", teamIds: ["team-ai-5", "team-ai-6", "team-ai-7", "team-ai-8"] },
        ],
        disciplines: [],
        matchups: [],
      },
      tournament: { id: "tt-1" },
    };

    // Fresh commit first (mutation finished).
    commitCanonicalSetupLoad(controller, (r) => applied.push(r), freshPayload);
    // Late stale poll response must not apply.
    const staleDecision = resolveCanonicalReloadApply(controller, genStale);
    assert.equal(staleDecision.apply, false);
    assert.equal(staleDecision.stale, true);
    assert.equal(applied.length, 1);
    assert.equal(applied[0].version, 3);
    assert.equal(
      deriveWorkflowStage(applied[0].teamData),
      WORKFLOW_STAGE.DISCIPLINES
    );
  });

  it("refreshCanonicalSetupAfterMutation applies get_setup and ignores superseded load", async () => {
    const controller = createCanonicalSetupRefreshController();
    const applied = [];
    let loadCount = 0;
    const resolvers = [];

    const loadSetup = () =>
      new Promise((resolve) => {
        loadCount += 1;
        resolvers.push(resolve);
      });

    const first = refreshCanonicalSetupAfterMutation({
      controller,
      loadSetup,
      applyLoadResult: (r) => applied.push(["first", r]),
    });
    const second = refreshCanonicalSetupAfterMutation({
      controller,
      loadSetup,
      applyLoadResult: (r) => applied.push(["second", r]),
    });

    assert.equal(loadCount, 2);

    resolvers[0]({
      ok: true,
      version: 1,
      teamData: { teams: [], groups: [], matchups: [], disciplines: [] },
      tournament: { id: "tt-1" },
    });
    resolvers[1]({
      ok: true,
      version: 2,
      teamData: {
        teams: buildTeams(4),
        groups: [],
        matchups: [],
        disciplines: [{ id: "d1", name: "MD" }],
      },
      tournament: { id: "tt-1" },
    });

    const a = await first;
    const b = await second;

    assert.equal(a.applied, false);
    assert.equal(a.stale, true);
    assert.equal(b.applied, true);
    assert.equal(applied.length, 1);
    assert.equal(applied[0][0], "second");
    assert.equal(applied[0][1].version, 2);
  });

  it("captain confirm mid-reload uses applyUi:false (no intermediate UI clobber)", () => {
    const persistSrc = readSrc(
      "src/features/team-tournament/services/aiPairingCloudPersistence.js"
    );
    assert.match(persistSrc, /applyUi:\s*false/);
    assert.match(persistSrc, /ai_pairing_version_peek/);
    assert.match(persistSrc, /deriveWorkflowStage/);
    assert.doesNotMatch(persistSrc, /location\.reload/);
  });

  it("wiring: page hook exports refreshAfterMutation + generation fence", () => {
    const page = readSrc(
      "src/features/team-tournament/ui/useTeamTournamentPage.js"
    );
    const roster = readSrc("src/components/tournament/TeamRosterPanel.jsx");
    const setup = readSrc("src/pages/tournament/TeamTournamentSetup.jsx");
    const showcase = readSrc(
      "src/features/team-tournament/showcase/showcasePersistenceAdapter.js"
    );
    const primitive = readSrc(
      "src/features/team-tournament/ui/canonicalSetupRefresh.js"
    );

    assert.match(primitive, /refreshCanonicalSetupAfterMutation/);
    assert.match(primitive, /commitCanonicalSetupLoad/);
    assert.match(primitive, /beginMutationBarrier/);
    assert.doesNotMatch(primitive, /window\.location\.reload\s*\(/);
    assert.doesNotMatch(primitive, /localStorage\./);

    assert.match(page, /refreshAfterMutation/);
    assert.match(page, /commitCanonicalSetupLoad/);
    assert.match(page, /beginMutationBarrier/);
    assert.match(page, /applyUi === false/);

    assert.match(roster, /refreshAfterMutation/);
    assert.match(roster, /captain_confirm/);
    assert.match(roster, /alreadyCommitted/);

    assert.match(setup, /refreshAfterMutation=\{refreshAfterMutation\}/);
    assert.match(showcase, /applyUi:\s*false/);
    assert.doesNotMatch(page, /window\.location\.reload\s*\(/);
    assert.doesNotMatch(roster, /window\.location\.reload\s*\(/);
  });

  it("shared refresh contract covers discipline/matchup/schedule/lineup/result mutation paths", () => {
    const page = readSrc(
      "src/features/team-tournament/ui/useTeamTournamentPage.js"
    );
    // Setup mutations (discipline/groups/matchups/schedule) → persistSetupTeamData commit
    assert.match(page, /persistSetupTeamData[\s\S]*commitCanonicalSetupLoad/);
    // Lineup/publish/result-style commands → runMutation commit / refreshAfterMutation
    assert.match(page, /runMutation[\s\S]*commitCanonicalSetupLoad/);
    assert.match(page, /runMutation[\s\S]*refreshAfterMutation/);
    // Draft / conflict paths use shared primitive
    assert.match(page, /refreshAfterMutation\(\{\s*reason:\s*"draft_version_conflict"/);
  });

  it("captain confirm success path derives advanced workflow without F5 hack", () => {
    const teams = buildTeams(8);
    const teamData = {
      teams,
      groups: [
        { id: "g1", name: "A", teamIds: teams.slice(0, 4).map((t) => t.id) },
        { id: "g2", name: "B", teamIds: teams.slice(4).map((t) => t.id) },
      ],
      disciplines: [],
      matchups: [],
    };
    assert.equal(deriveWorkflowStage(teamData), WORKFLOW_STAGE.DISCIPLINES);

    const roster = readSrc("src/components/tournament/TeamRosterPanel.jsx");
    assert.match(roster, /confirmAiPairingCloudPersistence/);
    assert.match(roster, /workflowStage:\s*result\.workflowStage/);
    assert.doesNotMatch(roster, /location\.reload/);
  });
});
