import test from "node:test";
import assert from "node:assert/strict";

import {
  __resetTeamTournamentDataModeForTests,
  __setTeamTournamentDataModeForTests,
  createTeamTournamentRepository,
  TEAM_TOURNAMENT_DATA_MODES,
} from "../src/features/team-tournament/repositories/teamTournamentRepositoryFactory.js";
import {
  __resetTeamTournamentUiOrchestratorForTests,
  aggregateToTournamentView,
  createTeamTournamentUiOrchestrator,
  mapRepositoryResultToUi,
} from "../src/features/team-tournament/ui/teamTournamentUiOrchestrator.js";
import {
  beginUiCommandKey,
  buildUiCommandScope,
  endUiCommandKey,
} from "../src/features/team-tournament/ui/teamTournamentUiCommandKeys.js";
import { mirrorAggregateToBlob } from "../src/features/team-tournament/ui/teamTournamentBlobMirror.js";

test("cloud_primary factory works with allowFutureModes via getTeamTournamentRepository path", () => {
  __setTeamTournamentDataModeForTests(TEAM_TOURNAMENT_DATA_MODES.CLOUD_PRIMARY);
  const repo = createTeamTournamentRepository({ allowFutureModes: true, forceNew: true });
  assert.equal(repo.getProvider(), "cloud");
  __resetTeamTournamentDataModeForTests();
});

test("idempotency key stable for same action scope until end", () => {
  const scope = buildUiCommandScope("submit", "t1", "m1");
  const k1 = beginUiCommandKey(scope);
  const k2 = beginUiCommandKey(scope);
  assert.equal(k1, k2);
  endUiCommandKey(scope);
  const k3 = beginUiCommandKey(scope);
  assert.notEqual(k1, k3);
  endUiCommandKey(scope);
});

test("version_conflict maps to user-facing reload message", () => {
  const ui = mapRepositoryResultToUi({
    ok: false,
    code: "version_conflict",
    error: "version_conflict",
  });
  assert.equal(ui.isVersionConflict, true);
  assert.match(ui.error, /người khác cập nhật/i);
});

test("orchestrator rejects mutation without version", async () => {
  __resetTeamTournamentUiOrchestratorForTests();
  __setTeamTournamentDataModeForTests(TEAM_TOURNAMENT_DATA_MODES.LEGACY);
  const orchestrator = createTeamTournamentUiOrchestrator({
    forceNew: true,
    repository: {
      getProvider: () => "blob",
      getTournament: async () => ({ ok: true, data: { id: "t1", teamData: {} } }),
    },
  });

  const result = await orchestrator.runMutation({
    method: "submitLineup",
    clubId: "c1",
    tournamentId: "t1",
    payload: { matchupId: "m1", teamId: "a", selections: {} },
    expectedVersion: undefined,
    actionScope: "x",
  });

  assert.equal(result.ok, false);
  __resetTeamTournamentDataModeForTests();
});

test("blob mirror failure does not throw", () => {
  const result = mirrorAggregateToBlob("", null);
  assert.equal(result.ok, false);
});

test("aggregateToTournamentView preserves teamData", () => {
  const view = aggregateToTournamentView({
    id: "t1",
    clubId: "c1",
    teamData: { teams: [{ id: "a", name: "A" }], matchups: [], disciplines: [] },
  });
  assert.equal(view.id, "t1");
  assert.ok(view.teamData?.teams?.length);
});
