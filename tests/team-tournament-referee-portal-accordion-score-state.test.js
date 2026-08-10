import test from "node:test";
import assert from "node:assert/strict";

import {
  availableMatchupIdsKey,
  bindScoreActionIds,
  buildMatchupQuerySearchParams,
  buildSubMatchScoreFingerprint,
  collectAvailableMatchupIds,
  normalizeScoreStateFromSubMatch,
  rebaseScorePanelAfterSuccessfulWrite,
  reconcileExpandedMatchupId,
  resolveInitialExpandedMatchupId,
  resolveScorePanelServerSync,
} from "../src/features/team-tournament/engines/teamRefereePortalUiState.js";

const ROUTE_MATCHUP = "matchup-sqlk8a3s";
const OWNER_TARGET = "matchup-mj90tdx5";

function simulatePortalExpansionMachine({
  queryMatchupId,
  availableIds,
}) {
  let expandedMatchupId = "";
  let applied = false;
  let trackedQueryId = null;

  function onDataOrQuery(nextQuery, nextAvailableIds) {
    const queryChanged = nextQuery !== trackedQueryId;
    if (queryChanged) {
      applied = false;
      trackedQueryId = nextQuery;
    }
    if (!applied) {
      expandedMatchupId = resolveInitialExpandedMatchupId({
        queryMatchupId: nextQuery,
        availableIds: nextAvailableIds,
      });
      applied = true;
      return expandedMatchupId;
    }
    expandedMatchupId = reconcileExpandedMatchupId({
      expandedMatchupId,
      availableIds: nextAvailableIds,
    });
    return expandedMatchupId;
  }

  function manualExpand(matchupId, { syncUrl = true } = {}) {
    expandedMatchupId = matchupId;
    applied = true;
    if (syncUrl) {
      trackedQueryId = matchupId || null;
    }
    return expandedMatchupId;
  }

  onDataOrQuery(queryMatchupId, availableIds);
  return {
    get expanded() {
      return expandedMatchupId;
    },
    onDataOrQuery,
    manualExpand,
  };
}

test("A/L: route query opens requested matchup initially / F5 mount", () => {
  const machine = simulatePortalExpansionMachine({
    queryMatchupId: ROUTE_MATCHUP,
    availableIds: [OWNER_TARGET, ROUTE_MATCHUP],
  });
  assert.equal(machine.expanded, ROUTE_MATCHUP);
});

test("B: manual open different matchup", () => {
  const machine = simulatePortalExpansionMachine({
    queryMatchupId: ROUTE_MATCHUP,
    availableIds: [OWNER_TARGET, ROUTE_MATCHUP],
  });
  machine.manualExpand(OWNER_TARGET);
  assert.equal(machine.expanded, OWNER_TARGET);
});

test("C: polling/teamData refresh does not collapse manual expansion", () => {
  const machine = simulatePortalExpansionMachine({
    queryMatchupId: ROUTE_MATCHUP,
    availableIds: [OWNER_TARGET, ROUTE_MATCHUP],
  });
  machine.manualExpand(OWNER_TARGET, { syncUrl: true });
  for (let i = 0; i < 5; i += 1) {
    // URL synced to OWNER_TARGET; array identity churn must not collapse
    machine.onDataOrQuery(OWNER_TARGET, [OWNER_TARGET, ROUTE_MATCHUP]);
  }
  assert.equal(machine.expanded, OWNER_TARGET);
});

test("C2: stale query alone does not re-force collapse after manual expand without waiting for URL", () => {
  const machine = simulatePortalExpansionMachine({
    queryMatchupId: ROUTE_MATCHUP,
    availableIds: [OWNER_TARGET, ROUTE_MATCHUP],
  });
  machine.manualExpand(OWNER_TARGET, { syncUrl: false });
  // poll keeps same stale query; applied stays true → reconcile only
  machine.onDataOrQuery(ROUTE_MATCHUP, [OWNER_TARGET, ROUTE_MATCHUP]);
  assert.equal(machine.expanded, OWNER_TARGET);
});

test("D: realtime-equivalent reload does not collapse manual expansion", () => {
  const machine = simulatePortalExpansionMachine({
    queryMatchupId: ROUTE_MATCHUP,
    availableIds: [OWNER_TARGET, ROUTE_MATCHUP],
  });
  machine.manualExpand(OWNER_TARGET, { syncUrl: true });
  machine.onDataOrQuery(OWNER_TARGET, [OWNER_TARGET, ROUTE_MATCHUP]);
  assert.equal(machine.expanded, OWNER_TARGET);
});

test("E: URL query sync points to manually selected matchup", () => {
  const params = buildMatchupQuerySearchParams(
    new URLSearchParams(`matchup=${ROUTE_MATCHUP}`),
    OWNER_TARGET
  );
  assert.equal(params.get("matchup"), OWNER_TARGET);
});

test("F/G: dirty unsaved score survives polling / equivalent object replacement", () => {
  const server = {
    subMatchId: "sub-1",
    version: 1,
    status: "waiting",
    resultConfirmedAt: null,
    score: { teamA: 0, teamB: 0, games: [] },
  };
  const fingerprint = buildSubMatchScoreFingerprint(server);
  const refreshedSame = {
    ...server,
    score: { teamA: 0, teamB: 0, games: [] },
  };
  const sync = resolveScorePanelServerSync({
    dirty: true,
    previousFingerprint: fingerprint,
    subMatch: refreshedSame,
  });
  assert.equal(sync.action, "keep");
  assert.equal(sync.dirty, true);
  assert.equal(sync.conflict, false);
});

test("H: external server score change while dirty does not silently overwrite", () => {
  const server = {
    subMatchId: "sub-1",
    version: 1,
    status: "waiting",
    resultConfirmedAt: null,
    score: { teamA: 0, teamB: 0, games: [] },
  };
  const previousFingerprint = buildSubMatchScoreFingerprint(server);
  const external = {
    ...server,
    version: 2,
    score: { teamA: 11, teamB: 5, games: [] },
  };
  const sync = resolveScorePanelServerSync({
    dirty: true,
    previousFingerprint,
    subMatch: external,
  });
  assert.equal(sync.action, "conflict");
  assert.equal(sync.dirty, true);
  assert.equal(sync.conflict, true);
  assert.equal(sync.nextState, undefined);
});

test("I: successful Save Draft rebaselines local state", () => {
  const afterSave = {
    subMatchId: "sub-1",
    version: 2,
    status: "in_progress",
    resultConfirmedAt: null,
    score: { teamA: 7, teamB: 4, games: [] },
  };
  const rebased = rebaseScorePanelAfterSuccessfulWrite(afterSave);
  assert.equal(rebased.dirty, false);
  assert.equal(rebased.conflict, false);
  assert.equal(rebased.scoreA, 7);
  assert.equal(rebased.scoreB, 4);
  assert.equal(rebased.fingerprint, buildSubMatchScoreFingerprint(afterSave));
});

test("J: successful Confirm Result rebaselines/locks expected state", () => {
  const confirmed = {
    subMatchId: "sub-1",
    version: 3,
    status: "completed",
    resultConfirmedAt: "2026-08-10T12:00:00.000Z",
    score: { teamA: 11, teamB: 8, games: [] },
  };
  const rebased = rebaseScorePanelAfterSuccessfulWrite(confirmed);
  assert.equal(rebased.dirty, false);
  assert.equal(rebased.scoreA, 11);
  assert.equal(
    resolveScorePanelServerSync({
      dirty: false,
      previousFingerprint: rebased.fingerprint,
      subMatch: confirmed,
    }).action,
    "rehydrate"
  );
});

test("K: score action is bound to correct matchup/subMatch after switching", () => {
  const safe = bindScoreActionIds({
    panelMatchupId: OWNER_TARGET,
    panelSubMatchId: "sub-a",
    requestedMatchupId: OWNER_TARGET,
    requestedSubMatchId: "sub-a",
  });
  assert.equal(safe.ok, true);

  const unsafe = bindScoreActionIds({
    panelMatchupId: OWNER_TARGET,
    panelSubMatchId: "sub-a",
    requestedMatchupId: ROUTE_MATCHUP,
    requestedSubMatchId: "sub-a",
  });
  assert.equal(unsafe.ok, false);
  assert.equal(unsafe.error, "SCORE_ACTION_MATCHUP_BINDING_MISMATCH");
});

test("pristine panel rehydrates from server refresh", () => {
  const server = {
    subMatchId: "sub-1",
    version: 1,
    status: "waiting",
    score: { teamA: 2, teamB: 1, games: [] },
  };
  const sync = resolveScorePanelServerSync({
    dirty: false,
    previousFingerprint: "old",
    subMatch: server,
  });
  assert.equal(sync.action, "rehydrate");
  assert.deepEqual(sync.nextState, normalizeScoreStateFromSubMatch(server));
});

test("available matchup id key is stable across array identity churn", () => {
  const a = collectAvailableMatchupIds(
    [{ id: OWNER_TARGET }, { id: ROUTE_MATCHUP }],
    []
  );
  const b = collectAvailableMatchupIds(
    [{ id: ROUTE_MATCHUP }, { id: OWNER_TARGET }],
    []
  );
  assert.equal(availableMatchupIdsKey(a), availableMatchupIdsKey(b));
});

test("disappeared expanded matchup is cleared on reconcile", () => {
  assert.equal(
    reconcileExpandedMatchupId({
      expandedMatchupId: OWNER_TARGET,
      availableIds: [ROUTE_MATCHUP],
    }),
    ""
  );
});
