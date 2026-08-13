/**
 * Phase 2F — Group Draw visibility / human-readable group review.
 * Projection is read-only. Does not pair, redraw, or persist.
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
  normalizeTournament,
} from "../src/models/tournament/index.js";
import {
  OFFICIAL_REGISTRATION_MODE,
  patchOfficialCompetitionSettings,
  projectOfficialFinalizationBuckets,
  GROUP_MATCH_COUNT_SOURCE,
  GROUP_REVIEW_ISSUE,
  projectOfficialGroupDrawReview,
  isRawTechnicalId,
} from "../src/features/individual-tournament/index.js";
import {
  formOfficialIndividualPairs,
  projectOfficialDrawSubsteps,
  applyOfficialGroupDrawPreservingRegistration,
  listOfficialRegistrationEntries,
  listOfficialDrawEntries,
} from "../src/features/individual-tournament/engines/officialDrawOrchestrationEngine.js";

function src(path) {
  return readFileSync(path, "utf8");
}

function sixteenPlayers() {
  const names = [
    ["p1", "Nguyễn A"],
    ["p2", "Trần B"],
    ["p3", "Lê C"],
    ["p4", "Phạm D"],
    ["p5", "Hoàng E"],
    ["p6", "Vũ F"],
    ["p7", "Đặng G"],
    ["p8", "Bùi H"],
    ["p9", "Đỗ I"],
    ["p10", "Ngô J"],
    ["p11", "Dương K"],
    ["p12", "Lý L"],
    ["p13", "Mai M"],
    ["p14", "Tô N"],
    ["p15", "Hồ O"],
    ["p16", "Cao P"],
  ];
  return names.map(([id, name], index) => ({
    id,
    name,
    gender: "male",
    rating: 3.5 + (index % 5) * 0.1,
    status: ENTRY_STATUS.ACTIVE,
    source: "system",
  }));
}

function stubOpenPairing(players) {
  const out = [];
  for (let i = 0; i + 1 < players.length; i += 2) {
    const a = players[i];
    const b = players[i + 1];
    out.push({
      id: `aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeee${String(i / 2 + 1).padStart(2, "0")}`,
      name: `${a.name} / ${b.name}`,
      playerIds: [String(a.id), String(b.id)],
      status: ENTRY_STATUS.ACTIVE,
      rating: 4,
      origin: "official_draw_materialization",
    });
  }
  return out;
}

function baseTournament(players = sixteenPlayers()) {
  return patchOfficialCompetitionSettings(
    {
      id: "t-p2f-group-review",
      name: "Official P2F Group Review",
      mode: TOURNAMENT_MODE.OFFICIAL_TOURNAMENT,
      officialMode: OFFICIAL_MODE.OPEN,
      status: TOURNAMENT_STATUS.DRAFT,
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
}

function pairedTournament() {
  const players = sixteenPlayers();
  const formed = formOfficialIndividualPairs({
    tournament: baseTournament(players),
    eventId: "ev1",
    players,
    eventType: EVENT_TYPE.MEN_DOUBLE,
    pairingFn: stubOpenPairing,
  });
  assert.equal(formed.ok, true);
  return { ...formed, players };
}

function groupPlanFromPairs(event, pairs) {
  const groups = [
    { id: "gA", label: "A", name: "Bang A", entries: pairs.slice(0, 2), entryIds: pairs.slice(0, 2).map((p) => p.id) },
    { id: "gB", label: "B", name: "Bang B", entries: pairs.slice(2, 4), entryIds: pairs.slice(2, 4).map((p) => p.id) },
    { id: "gC", label: "C", name: "Bảng C", entries: pairs.slice(4, 6), entryIds: pairs.slice(4, 6).map((p) => p.id) },
    { id: "gD", label: "D", entries: pairs.slice(6, 8), entryIds: pairs.slice(6, 8).map((p) => p.id) },
  ];
  const matches = groups.map((group, index) => ({
    id: `m${index + 1}`,
    entryAId: group.entryIds[0],
    entryBId: group.entryIds[1],
    status: "waiting",
  }));
  return {
    ...event,
    groups,
    matches,
  };
}

function drawnTournament() {
  const formed = pairedTournament();
  const pairs = listOfficialDrawEntries(formed.tournament.events[0]);
  const applied = applyOfficialGroupDrawPreservingRegistration(
    formed.tournament,
    groupPlanFromPairs(formed.tournament.events[0], pairs)
  );
  assert.equal(applied.ok, true);
  return { tournament: applied.tournament, event: applied.event, players: formed.players, pairs };
}

function allDisplayTexts(review) {
  const texts = [];
  (review.groups || []).forEach((group) => {
    texts.push(group.label);
    (group.entries || []).forEach((entry) => {
      texts.push(entry.displayTitle, entry.playersLine, entry.playerA, entry.playerB);
    });
  });
  return texts.filter(Boolean);
}

describe("official-open-tournament-phase2f-group-draw-review-01", () => {
  it("A. 8 drawEntries / 4 groups project to 4 groups and 8 pair rows", () => {
    const { tournament, players } = drawnTournament();
    const review = projectOfficialGroupDrawReview(tournament, "ev1", players);
    assert.equal(review.present, true);
    assert.equal(review.ok, true);
    assert.equal(review.groupCount, 4);
    assert.equal(review.groups.length, 4);
    assert.equal(review.pairTotal, 8);
    assert.equal(review.uniquePairTotal, 8);
    assert.equal(review.expectedAllocatedTotal, 8);
  });

  it("B. every pair appears exactly once", () => {
    const { tournament, players, pairs } = drawnTournament();
    const review = projectOfficialGroupDrawReview(tournament, "ev1", players);
    const seen = review.groups.flatMap((group) => group.entries.map((entry) => entry.entryId));
    assert.equal(seen.length, 8);
    assert.equal(new Set(seen).size, 8);
    pairs.forEach((pair) => {
      assert.equal(seen.includes(String(pair.id)), true);
    });
  });

  it("C. pair member names resolve to human-readable identities", () => {
    const { tournament, players } = drawnTournament();
    const review = projectOfficialGroupDrawReview(tournament, "ev1", players);
    const first = review.groups[0].entries[0];
    assert.equal(first.displayTitle, "Cặp 1");
    assert.equal(first.playerA, "Nguyễn A");
    assert.equal(first.playerB, "Trần B");
    assert.equal(first.playersLine, "Nguyễn A + Trần B");
    assert.equal(first.resolved, true);
  });

  it("D. no raw UUID as primary display text", () => {
    const { tournament, players } = drawnTournament();
    const review = projectOfficialGroupDrawReview(tournament, "ev1", players);
    allDisplayTexts(review).forEach((text) => {
      assert.equal(isRawTechnicalId(text), false, text);
    });
    assert.match(review.groups[0].entries[0].entryId, /^[0-9a-f-]{36}$/i);
  });

  it("E. group names are Bảng A/B/C/D even when canonical name is Bang A", () => {
    const { tournament, players } = drawnTournament();
    const review = projectOfficialGroupDrawReview(tournament, "ev1", players);
    assert.deepEqual(
      review.groups.map((group) => group.label),
      ["Bảng A", "Bảng B", "Bảng C", "Bảng D"]
    );
  });

  it("F. groups absent → review absent and Chia bảng remains the action", () => {
    const formed = pairedTournament();
    const review = projectOfficialGroupDrawReview(formed.tournament, "ev1", formed.players);
    const sub = projectOfficialDrawSubsteps(formed.tournament, "ev1");
    assert.equal(review.present, false);
    assert.equal(review.groups.length, 0);
    assert.equal(sub.groupsCreated, false);
    assert.equal(sub.groupDrawReady, true);

    const drawSrc = src("src/components/tournament/official/OfficialTournamentDrawScreen.jsx");
    assert.match(drawSrc, /sub\.groupDrawReady/);
    assert.match(drawSrc, /Chia bảng/);
    assert.match(drawSrc, /groupReview\.present|review\?\.present|!review\?\.present/);
  });

  it("G. groups present → review visible and group-draw CTA is not pending", () => {
    const { tournament, players } = drawnTournament();
    const review = projectOfficialGroupDrawReview(tournament, "ev1", players);
    const sub = projectOfficialDrawSubsteps(tournament, "ev1");
    assert.equal(review.present, true);
    assert.equal(sub.groupsCreated, true);
    assert.equal(sub.groupDrawReady, false);

    const drawSrc = src("src/components/tournament/official/OfficialTournamentDrawScreen.jsx");
    assert.match(drawSrc, /KẾT QUẢ CHIA BẢNG/);
    assert.match(drawSrc, /projectOfficialGroupDrawReview/);
    assert.match(drawSrc, /Tiếp tục: Lịch thi đấu vòng bảng/);
    assert.match(drawSrc, /sub\.groupsCreated \? \(/);
  });

  it("opening review does not mutate tournament or invoke pairing/group-draw/persist", () => {
    const { tournament, players } = drawnTournament();
    const before = JSON.stringify(tournament);
    const review = projectOfficialGroupDrawReview(tournament, "ev1", players);
    assert.equal(JSON.stringify(tournament), before);
    assert.equal(review.ok, true);

    const projectionSrc = src(
      "src/features/individual-tournament/engines/officialGroupDrawReviewProjection.js"
    );
    const drawSrc = src("src/components/tournament/official/OfficialTournamentDrawScreen.jsx");
    assert.doesNotMatch(projectionSrc, /buildOfficialOpenPlan|buildOfficialAiBalancePlan|formOfficialIndividualPairs/);
    assert.doesNotMatch(projectionSrc, /updateTournament|persistDraw|persistAccepted/);
    assert.doesNotMatch(drawSrc, /buildOfficialOpenPlan|buildOfficialAiBalancePlan|formOfficialIndividualPairs/);
    assert.doesNotMatch(drawSrc, /updateTournamentCommand|persistDrawMaterialization/);
  });

  it("F5-equivalent hydration keeps the same groups, members, and labels", () => {
    const { tournament, players } = drawnTournament();
    const first = projectOfficialGroupDrawReview(tournament, "ev1", players);
    const hydrated = normalizeTournament(JSON.parse(JSON.stringify(tournament)));
    const second = projectOfficialGroupDrawReview(hydrated, "ev1", players);
    assert.deepEqual(
      (hydrated.events[0].groups || []).map((group) => ({
        id: group.id,
        entryIds: group.entryIds,
      })),
      (tournament.events[0].groups || []).map((group) => ({
        id: group.id,
        entryIds: group.entryIds,
      }))
    );
    assert.equal(second.ok, true);
    assert.deepEqual(
      second.groups.map((group) => group.label),
      first.groups.map((group) => group.label)
    );
    assert.deepEqual(
      second.groups.map((group) => group.entries.map((entry) => entry.playersLine)),
      first.groups.map((group) => group.entries.map((entry) => entry.playersLine))
    );
    assert.equal(second.matchCount, first.matchCount);
    assert.equal(second.matchCountSource, GROUP_MATCH_COUNT_SOURCE);
    assert.equal(GROUP_MATCH_COUNT_SOURCE, "event.matches");
  });

  it("history: registrations, finalization, drawEntries, groups, matches survive roundtrip", () => {
    const { tournament, event, players } = drawnTournament();
    const hydrated = normalizeTournament(JSON.parse(JSON.stringify(tournament)));
    assert.equal(listOfficialRegistrationEntries(hydrated.events[0]).length, 16);
    assert.equal(
      listOfficialRegistrationEntries(hydrated.events[0]).every((entry) => (entry.playerIds || []).length === 1),
      true
    );
    const buckets = projectOfficialFinalizationBuckets(hydrated, "ev1");
    assert.equal(buckets.counts.eligible, 16);
    assert.equal(listOfficialDrawEntries(hydrated.events[0]).length, 8);
    assert.equal((hydrated.events[0].groups || []).length, 4);
    assert.equal((hydrated.events[0].matches || []).length, event.matches.length);
    const review = projectOfficialGroupDrawReview(hydrated, "ev1", players);
    assert.equal(review.present, true);
    assert.equal(review.ok, true);
    assert.equal(review.pairTotal, 8);
  });

  it("integrity: duplicate pair in two groups fails closed", () => {
    const { tournament, players, pairs } = drawnTournament();
    tournament.events[0].groups[1].entryIds.push(pairs[0].id);
    tournament.events[0].groups[1].entries.push(pairs[0]);
    const review = projectOfficialGroupDrawReview(tournament, "ev1", players);
    assert.equal(review.ok, false);
    assert.equal(review.issues.some((issue) => issue.code === GROUP_REVIEW_ISSUE.DUPLICATE_PAIR), true);
    assert.equal(review.duplicateIds.includes(String(pairs[0].id)), true);
  });

  it("integrity: unresolved pair reference fails closed and is not omitted", () => {
    const { tournament, players } = drawnTournament();
    tournament.events[0].groups[0].entryIds[0] = "missing-pair-id";
    const review = projectOfficialGroupDrawReview(tournament, "ev1", players);
    assert.equal(review.ok, false);
    assert.equal(review.issues.some((issue) => issue.code === GROUP_REVIEW_ISSUE.UNRESOLVED_MEMBER), true);
    assert.equal(review.groups[0].entries[0].entryId, "missing-pair-id");
    assert.equal(review.groups[0].entries[0].resolved, false);
    assert.equal(review.unresolvedIds.includes("missing-pair-id"), true);
  });

  it("integrity: missing allocated pair fails closed", () => {
    const { tournament, players, pairs } = drawnTournament();
    tournament.events[0].groups[3].entryIds = [pairs[6].id];
    tournament.events[0].groups[3].entries = [pairs[6]];
    const review = projectOfficialGroupDrawReview(tournament, "ev1", players);
    assert.equal(review.ok, false);
    assert.equal(
      review.issues.some((issue) => issue.code === GROUP_REVIEW_ISSUE.UNALLOCATED_DRAW_UNIT),
      true
    );
    assert.equal(review.unallocatedIds.includes(String(pairs[7].id)), true);
  });

  it("Draw stays on Bốc thăm after chia bảng; continue CTA is stage-only", () => {
    const setup = src("src/pages/tournament/OfficialTournamentSetup.jsx");
    const drawSrc = src("src/components/tournament/official/OfficialTournamentDrawScreen.jsx");
    const handler = setup.slice(
      setup.indexOf("const handleRunGroupDraw"),
      setup.indexOf("const handleDrawGroups")
    );
    assert.doesNotMatch(handler, /selectStage/);
    assert.match(setup, /onContinueToGroupStage=\{\(\) => selectStage\(OFFICIAL_STAGE_ID\.GROUP_STAGE\)\}/);
    assert.doesNotMatch(drawSrc, /buildGroupStageSchedule|assignCourt|assignReferee/);
    assert.match(drawSrc, /onContinueToGroupStage\?\.\(\)/);
  });
});
