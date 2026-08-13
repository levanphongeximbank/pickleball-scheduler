/**
 * Phase 2G — F5 workflow stage preservation.
 * URL ?stage= is navigation authority. Canonical tournament is lifecycle authority.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import {
  TOURNAMENT_MODE,
  TOURNAMENT_STATUS,
  OFFICIAL_MODE,
  ENTRY_STATUS,
  EVENT_TYPE,
} from "../src/models/tournament/index.js";
import {
  OFFICIAL_REGISTRATION_MODE,
  patchOfficialCompetitionSettings,
  deriveOfficialOrganizerStages,
  deriveOfficialNextAction,
  OFFICIAL_STAGE_ID,
  OFFICIAL_STAGE_QUERY_KEY,
  readOfficialStageQuery,
  applyOfficialStageSearchParams,
  resolveOfficialOrganizerStageSelection,
  formOfficialIndividualPairs,
  applyOfficialGroupDrawPreservingRegistration,
  listOfficialDrawEntries,
  projectOfficialGroupDrawReview,
} from "../src/features/individual-tournament/index.js";

function src(path) {
  return readFileSync(path, "utf8");
}

function sixteenPlayers() {
  return Array.from({ length: 16 }, (_, index) => ({
    id: `p${index + 1}`,
    name: `VĐV ${index + 1}`,
    gender: "male",
    rating: 3.5,
    status: ENTRY_STATUS.ACTIVE,
    source: "system",
  }));
}

function stubPairs(players) {
  const out = [];
  for (let i = 0; i + 1 < players.length; i += 2) {
    const a = players[i];
    const b = players[i + 1];
    out.push({
      id: `aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeee${String(i / 2 + 1).padStart(2, "0")}`,
      name: `${a.name} / ${b.name}`,
      playerIds: [String(a.id), String(b.id)],
      status: ENTRY_STATUS.ACTIVE,
    });
  }
  return out;
}

function groupedTournament() {
  const players = sixteenPlayers();
  const base = patchOfficialCompetitionSettings(
    {
      id: "t-p2g-f5",
      name: "Official P2G F5",
      mode: TOURNAMENT_MODE.OFFICIAL_TOURNAMENT,
      officialMode: OFFICIAL_MODE.OPEN,
      status: TOURNAMENT_STATUS.READY,
      settings: {
        officialCompetition: {
          registrationMode: OFFICIAL_REGISTRATION_MODE.INDIVIDUAL,
        },
        registration: { locked: true },
      },
      events: [
        {
          id: "ev1",
          name: "Đôi nam",
          eventType: EVENT_TYPE.MEN_DOUBLE,
          entries: players.map((player) => ({
            id: `e-${player.id}`,
            name: player.name,
            playerIds: [player.id],
            status: player.status,
            source: player.source,
          })),
          drawEntries: [],
          groups: [],
          matches: [],
        },
      ],
    },
    { registrationMode: OFFICIAL_REGISTRATION_MODE.INDIVIDUAL }
  );
  const formed = formOfficialIndividualPairs({
    tournament: base,
    eventId: "ev1",
    players,
    eventType: EVENT_TYPE.MEN_DOUBLE,
    pairingFn: stubPairs,
  });
  assert.equal(formed.ok, true);
  const pairs = listOfficialDrawEntries(formed.tournament.events[0]);
  const groups = [
    { id: "gA", label: "A", entryIds: pairs.slice(0, 2).map((p) => p.id), entries: pairs.slice(0, 2) },
    { id: "gB", label: "B", entryIds: pairs.slice(2, 4).map((p) => p.id), entries: pairs.slice(2, 4) },
    { id: "gC", label: "C", entryIds: pairs.slice(4, 6).map((p) => p.id), entries: pairs.slice(4, 6) },
    { id: "gD", label: "D", entryIds: pairs.slice(6, 8).map((p) => p.id), entries: pairs.slice(6, 8) },
  ];
  const applied = applyOfficialGroupDrawPreservingRegistration(formed.tournament, {
    ...formed.tournament.events[0],
    groups,
    matches: groups.map((group, index) => ({
      id: `m${index + 1}`,
      entryAId: group.entryIds[0],
      entryBId: group.entryIds[1],
      status: "waiting",
    })),
  });
  assert.equal(applied.ok, true);
  return { tournament: applied.tournament, players, pairs };
}

describe("official-open-tournament-phase2g-f5-stage-preservation-01", () => {
  it("A. Draw selected + groups complete + F5-equivalent remount stays Draw", () => {
    const { tournament } = groupedTournament();
    const workflow = deriveOfficialOrganizerStages(tournament, { eventId: "ev1" });
    assert.equal(workflow.currentStageId, OFFICIAL_STAGE_ID.GROUP_STAGE);

    const resolved = resolveOfficialOrganizerStageSelection({
      requestedStageId: OFFICIAL_STAGE_ID.DRAW,
      stages: workflow.stages,
      lifecycleCurrentStageId: workflow.currentStageId,
    });
    assert.equal(resolved.stageId, OFFICIAL_STAGE_ID.DRAW);
    assert.equal(resolved.source, "url");
    assert.equal(resolved.valid, true);
  });

  it("B. next recommended stage is Schedule while selected stage remains Draw", () => {
    const { tournament } = groupedTournament();
    const next = deriveOfficialNextAction(tournament, { eventId: "ev1" });
    assert.equal(next.stageId, OFFICIAL_STAGE_ID.GROUP_STAGE);
    const workflow = deriveOfficialOrganizerStages(tournament, { eventId: "ev1" });
    const selected = resolveOfficialOrganizerStageSelection({
      requestedStageId: OFFICIAL_STAGE_ID.DRAW,
      stages: workflow.stages,
      lifecycleCurrentStageId: workflow.currentStageId,
    });
    assert.equal(selected.stageId, OFFICIAL_STAGE_ID.DRAW);
    assert.notEqual(selected.stageId, next.stageId);
  });

  it("C. click continue to group stage updates URL stage only", () => {
    const current = new URLSearchParams("event=men_double&stage=draw");
    const next = applyOfficialStageSearchParams(current, OFFICIAL_STAGE_ID.GROUP_STAGE);
    assert.equal(next.get(OFFICIAL_STAGE_QUERY_KEY), OFFICIAL_STAGE_ID.GROUP_STAGE);
    assert.equal(next.get("event"), "men_double");
    const setup = src("src/pages/tournament/OfficialTournamentSetup.jsx");
    assert.match(
      setup,
      /onContinueToGroupStage=\{\(\) => selectStage\(OFFICIAL_STAGE_ID\.GROUP_STAGE\)\}/
    );
  });

  it("D. F5 on Schedule stays Schedule", () => {
    const { tournament } = groupedTournament();
    const workflow = deriveOfficialOrganizerStages(tournament, { eventId: "ev1" });
    const resolved = resolveOfficialOrganizerStageSelection({
      requestedStageId: OFFICIAL_STAGE_ID.GROUP_STAGE,
      stages: workflow.stages,
      lifecycleCurrentStageId: workflow.currentStageId,
    });
    assert.equal(resolved.stageId, OFFICIAL_STAGE_ID.GROUP_STAGE);
    assert.equal(resolved.source, "url");
  });

  it("E/F. browser Back/Forward is URL stage history, not tournament mutation", () => {
    const draw = applyOfficialStageSearchParams("event=men_double", OFFICIAL_STAGE_ID.DRAW);
    const schedule = applyOfficialStageSearchParams(draw, OFFICIAL_STAGE_ID.GROUP_STAGE);
    assert.equal(readOfficialStageQuery(draw), OFFICIAL_STAGE_ID.DRAW);
    assert.equal(readOfficialStageQuery(schedule), OFFICIAL_STAGE_ID.GROUP_STAGE);

    const setup = src("src/pages/tournament/OfficialTournamentSetup.jsx");
    const selectIdx = setup.indexOf("const selectStage = (stageId) =>");
    const selectBlock = setup.slice(selectIdx, selectIdx + 700);
    assert.match(selectBlock, /setSearchParams/);
    assert.match(selectBlock, /replace: false/);
    assert.doesNotMatch(selectBlock, /persistTournament/);
    assert.doesNotMatch(selectBlock, /setLocalRevision/);
    assert.doesNotMatch(setup, /stageTouched/);
    assert.doesNotMatch(setup, /localStorage/);
  });

  it("G. stage query update is not a canonical persist/reload", () => {
    const setup = src("src/pages/tournament/OfficialTournamentSetup.jsx");
    assert.match(setup, /readOfficialStageQuery\(searchParams\)/);
    assert.match(setup, /resolveOfficialOrganizerStageSelection/);
    assert.doesNotMatch(
      setup,
      /if \(!stageTouched && workflow\?\.currentStageId\)/
    );
    const selectIdx = setup.indexOf("const selectStage = (stageId) =>");
    const selectBlock = setup.slice(selectIdx, selectIdx + 700);
    assert.doesNotMatch(selectBlock, /reload\(/);
    assert.doesNotMatch(selectBlock, /update\(/);
  });

  it("invalid/stale stage query falls back without crash", () => {
    const { tournament } = groupedTournament();
    const workflow = deriveOfficialOrganizerStages(tournament, { eventId: "ev1" });
    const resolved = resolveOfficialOrganizerStageSelection({
      requestedStageId: "round_of_16",
      stages: workflow.stages,
      lifecycleCurrentStageId: workflow.currentStageId,
    });
    assert.equal(resolved.valid, false);
    assert.equal(resolved.normalized, true);
    assert.equal(workflow.stages.some((stage) => stage.id === resolved.stageId), true);
  });

  it("locked future stage remains navigable (not a permission grant)", () => {
    const players = sixteenPlayers();
    const draft = patchOfficialCompetitionSettings(
      {
        id: "t-p2g-locked",
        name: "Draft",
        mode: TOURNAMENT_MODE.OFFICIAL_TOURNAMENT,
        officialMode: OFFICIAL_MODE.OPEN,
        status: TOURNAMENT_STATUS.DRAFT,
        settings: {
          officialCompetition: {
            registrationMode: OFFICIAL_REGISTRATION_MODE.INDIVIDUAL,
          },
        },
        events: [
          {
            id: "ev1",
            eventType: EVENT_TYPE.MEN_DOUBLE,
            entries: players.slice(0, 2).map((player) => ({
              id: `e-${player.id}`,
              playerIds: [player.id],
              status: ENTRY_STATUS.ACTIVE,
            })),
            groups: [],
            matches: [],
          },
        ],
      },
      { registrationMode: OFFICIAL_REGISTRATION_MODE.INDIVIDUAL }
    );
    const workflow = deriveOfficialOrganizerStages(draft, { eventId: "ev1" });
    const groupStage = workflow.stages.find((stage) => stage.id === OFFICIAL_STAGE_ID.GROUP_STAGE);
    assert.ok(groupStage);
    const resolved = resolveOfficialOrganizerStageSelection({
      requestedStageId: OFFICIAL_STAGE_ID.GROUP_STAGE,
      stages: workflow.stages,
      lifecycleCurrentStageId: workflow.currentStageId,
    });
    assert.equal(resolved.stageId, OFFICIAL_STAGE_ID.GROUP_STAGE);
    assert.equal(resolved.source, "url");
    assert.equal(resolved.valid, true);
  });

  it("GROUP_REVIEW F5 — Draw workspace still projects Bảng A–D", () => {
    const { tournament, players } = groupedTournament();
    const workflow = deriveOfficialOrganizerStages(tournament, { eventId: "ev1" });
    const afterReload = resolveOfficialOrganizerStageSelection({
      requestedStageId: OFFICIAL_STAGE_ID.DRAW,
      stages: workflow.stages,
      lifecycleCurrentStageId: workflow.currentStageId,
    });
    assert.equal(afterReload.stageId, OFFICIAL_STAGE_ID.DRAW);
    const review = projectOfficialGroupDrawReview(tournament, "ev1", players);
    assert.equal(review.ok, true);
    assert.deepEqual(
      review.groups.map((group) => group.label),
      ["Bảng A", "Bảng B", "Bảng C", "Bảng D"]
    );
    assert.equal(review.pairTotal, 8);
  });

  it("router.jsx is not edited for query params; no canonical stage persist", () => {
    const router = src("src/router.jsx");
    assert.doesNotMatch(router, /OFFICIAL_STAGE_QUERY_KEY|stage=/);
    const nav = src(
      "src/features/individual-tournament/engines/officialOrganizerStageNavigation.js"
    );
    assert.match(nav, /Does not persist selected stage into the tournament payload/);
    const setup = src("src/pages/tournament/OfficialTournamentSetup.jsx");
    assert.match(setup, /useSearchParams/);
    assert.doesNotMatch(setup, /settings\.organizerStage|canonicalStage/);
  });

  it("window focus / same-principal refresh still skip reload; tenant change fail-closed", () => {
    const auth = src("src/context/AuthContext.jsx");
    assert.match(auth, /shouldSkipAuthUiRefreshOnTokenEvent/);
    const club = src("src/context/ClubContext.jsx");
    assert.match(club, /userSecurityScopeKey/);
    const canonical = src("src/features/tournament/hooks/useCanonicalTournament.js");
    assert.match(canonical, /resolveCanonicalTournamentLoadPolicy|authzFingerprint|scopeKey/);
  });
});
