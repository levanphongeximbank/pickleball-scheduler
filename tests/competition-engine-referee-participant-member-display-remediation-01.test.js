/**
 * Referee participant member display remediation.
 * Entry/unit labels stay visible; individual athlete names must also render.
 * Does not invent names. Does not use display names as writer identity.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { createScoringFormat } from "../src/features/competition-core/scoring/index.js";
import {
  COMPETITION_REFEREE_MODE,
  createDailyPlayRefereeAdapter,
  createInternalTournamentRefereeAdapter,
  createOfficialTournamentRefereeAdapter,
  createTeamTournamentRefereeAdapter,
  runCompetitionRefereeAdapterConformance,
} from "../src/features/competition-engine/index.js";
import { buildRefereeAssignmentCard } from "../src/features/referee-production-ui/projection/buildRefereeAssignmentCard.js";
import { buildRefereeMatchView } from "../src/features/referee-production-ui/projection/buildRefereeMatchView.js";
import { projectCanonicalCourtView } from "../src/features/referee-production-ui/projection/projectCanonicalCourtView.js";
import { resolveRefereeSideDisplay } from "../src/features/referee-production-ui/projection/resolveRefereeSideDisplay.js";
import {
  harvestParticipantNamesFromPayload,
  resolveCanonicalRefereeModeState,
} from "../src/features/referee-production-ui/application/resolveCanonicalRefereeModeState.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SCORING = createScoringFormat({
  scoringSystem: "SIDE_OUT",
  pointsToWin: 11,
  winBy: 2,
  bestOfGames: 1,
});

const COMPETITION_ID = "196a1420-f561-47bc-8de9-ac4b962f6472";
const MATCH_ID = "4d8f7fd3-e36a-4995-b628-7f1de34b0690";
const EVENT_ID = "fd0911ce-7f04-4abf-b7f7-f8e813a37abc";
const COURT_ID = "952a6c15-a3c1-4cd4-9dee-6720bcf5e073";
const ENTRY_A = "da59b2ee-27b7-46cc-8d75-fb121314dc1f";
const ENTRY_B = "60c30a61-94a3-4eb0-9968-421c68249956";
const PLAYER_A1 = "7be5f51a-50a0-4d61-88a4-e0a213acd298";
const PLAYER_A2 = "a11ce001-50a0-4d61-88a4-e0a213acd201";
const PLAYER_B1 = "f7349ada-91c6-4683-a645-2b86f412b017";
const PLAYER_B2 = "b22ce002-91c6-4683-a645-2b86f412b202";
const TENANT = "venue-staging-a";

function readSrc(rel) {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

function doublesPayload(overrides = {}) {
  return {
    tenantId: TENANT,
    players: [
      { id: PLAYER_A1, name: "Nguyễn Văn A" },
      { id: PLAYER_A2, name: "Trần Văn B" },
      { id: PLAYER_B1, name: "Lê Văn C" },
      { id: PLAYER_B2, name: "Phạm Văn D" },
    ],
    events: [
      {
        id: EVENT_ID,
        name: "Doubles",
        entries: [
          { id: ENTRY_A, name: "Đội 9", playerIds: [PLAYER_A1, PLAYER_A2] },
          { id: ENTRY_B, name: "Đội 10", playerIds: [PLAYER_B1, PLAYER_B2] },
        ],
        matches: [
          {
            id: MATCH_ID,
            matchId: MATCH_ID,
            status: "waiting",
            courtId: COURT_ID,
            physicalCourtId: COURT_ID,
            stage: "group",
            round: 1,
            eventId: EVENT_ID,
            entryAId: ENTRY_A,
            entryBId: ENTRY_B,
            participantIdsA: [PLAYER_A1, PLAYER_A2],
            participantIdsB: [PLAYER_B1, PLAYER_B2],
            scoringRules: SCORING,
            tournamentId: COMPETITION_ID,
            lineupsLocked: true,
          },
        ],
      },
    ],
    ...overrides,
  };
}

function mockCanonicalClient(row, { athletes = {}, profiles = {}, courts = {} } = {}) {
  return {
    from(table) {
      if (table === "team_tournaments") {
        const empty = {
          select() {
            return empty;
          },
          eq() {
            return empty;
          },
          maybeSingle: async () => ({ data: null, error: null }),
        };
        return empty;
      }
      if (table === "athletes") {
        const api = {
          _ids: null,
          select() {
            return api;
          },
          in(_col, ids) {
            api._ids = ids;
            return api;
          },
          then(resolve) {
            const data = (api._ids || [])
              .map((id) => (athletes[id] ? { id, display_name: athletes[id] } : null))
              .filter(Boolean);
            return Promise.resolve(resolve({ data, error: null }));
          },
        };
        return api;
      }
      if (table === "profiles") {
        const api = {
          _ids: null,
          select() {
            return api;
          },
          in(_col, ids) {
            api._ids = ids;
            return api;
          },
          then(resolve) {
            const data = (api._ids || [])
              .map((id) =>
                profiles[id] ? { id, display_name: profiles[id], player_id: null } : null
              )
              .filter(Boolean);
            return Promise.resolve(resolve({ data, error: null }));
          },
        };
        return api;
      }
      if (table === "court_resource_physical_courts") {
        const api = {
          _ids: null,
          _tenant: null,
          select() {
            return api;
          },
          in(_col, ids) {
            api._ids = ids;
            return api;
          },
          eq(col, val) {
            if (col === "tenant_id") api._tenant = val;
            return api;
          },
          then(resolve) {
            const data = (api._ids || [])
              .map((id) =>
                courts[id]
                  ? {
                      physical_court_id: id,
                      display_name: courts[id],
                      display_code: null,
                      display_number: null,
                    }
                  : null
              )
              .filter(Boolean);
            return Promise.resolve(resolve({ data, error: null }));
          },
        };
        return api;
      }
      if (table === "canonical_tournaments") {
        const api = {
          select() {
            return api;
          },
          or() {
            return api;
          },
          eq() {
            return api;
          },
          maybeSingle: async () => ({ data: row, error: null }),
        };
        return api;
      }
      const empty = {
        select() {
          return empty;
        },
        eq() {
          return empty;
        },
        in() {
          return empty;
        },
        or() {
          return empty;
        },
        maybeSingle: async () => ({ data: null, error: null }),
        then(resolve) {
          return Promise.resolve(resolve({ data: [], error: null }));
        },
      };
      return empty;
    },
  };
}

async function resolveDoublesModeState() {
  return resolveCanonicalRefereeModeState(
    mockCanonicalClient({
      id: COMPETITION_ID,
      tenant_id: TENANT,
      club_id: "club-1",
      name: "Internal staging fixture",
      mode: "internal_tournament",
      payload: doublesPayload(),
    }),
    {
      tenantId: TENANT,
      competitionId: COMPETITION_ID,
      matchId: MATCH_ID,
    }
  );
}

function internalView(modeState) {
  const adapter = createInternalTournamentRefereeAdapter({ modeState });
  const req = {
    tenantId: TENANT,
    competitionId: COMPETITION_ID,
    matchId: MATCH_ID,
  };
  return {
    adapter,
    req,
    participants: adapter.getParticipants(req),
    view: buildRefereeMatchView({
      matchId: MATCH_ID,
      competitionMode: COMPETITION_REFEREE_MODE.INTERNAL,
      adapterSelected: "internal-tournament-referee-adapter-b",
      competitionContext: adapter.getCompetitionContext(req),
      matchContext: adapter.getMatchContext(req),
      participants: adapter.getParticipants(req),
      scoringRules: adapter.getScoringRules(req),
      lifecyclePolicy: adapter.getLifecyclePolicy(req),
      capabilities: adapter.getCapabilities(req),
      modeState,
      participantNames: modeState.participantNames,
      assignedMatch: { lifecycleState: "READY_TO_START" },
    }),
  };
}

test("harvest does not copy entry/unit label onto member playerIds", () => {
  const names = harvestParticipantNamesFromPayload(doublesPayload());
  assert.equal(names[ENTRY_A], "Đội 9");
  assert.equal(names[ENTRY_B], "Đội 10");
  assert.equal(names[PLAYER_A1], "Nguyễn Văn A");
  assert.equal(names[PLAYER_A2], "Trần Văn B");
  assert.equal(names[PLAYER_B1], "Lê Văn C");
  assert.equal(names[PLAYER_B2], "Phạm Văn D");
  assert.notEqual(names[PLAYER_A1], "Đội 9");
  assert.notEqual(names[PLAYER_B1], "Đội 10");
});

test("harvest still reads object-map player directories", () => {
  const names = harvestParticipantNamesFromPayload({
    playerDirectory: { p1: "An", p2: { displayName: "Bình" } },
    events: [{ id: "e1", entries: [{ id: "entry-1", name: "Đội 1", playerIds: ["p1", "p2"] }] }],
  });
  assert.equal(names.p1, "An");
  assert.equal(names.p2, "Bình");
  assert.equal(names["entry-1"], "Đội 1");
  assert.notEqual(names.p1, "Đội 1");
});

test("1. Internal doubles entry renders both member names", async () => {
  const modeState = await resolveDoublesModeState();
  const { participants, view } = internalView(modeState);
  assert.deepEqual(participants.sides[0].participantIds, [PLAYER_A1, PLAYER_A2]);
  assert.deepEqual(participants.sides[1].participantIds, [PLAYER_B1, PLAYER_B2]);
  assert.equal(view.participantDisplay.sideA.entryLabel, "Đội 9");
  assert.deepEqual([...view.participantDisplay.sideA.playerNames], ["Nguyễn Văn A", "Trần Văn B"]);
  assert.equal(view.participantDisplay.sideB.entryLabel, "Đội 10");
  assert.deepEqual([...view.participantDisplay.sideB.playerNames], ["Lê Văn C", "Phạm Văn D"]);
  assert.equal(view.participantDisplay.sideA.members[0].participantId, PLAYER_A1);
  assert.equal(view.participantDisplay.sideA.members[1].participantId, PLAYER_A2);
});

test("2. Home card renders member names plus entry label", async () => {
  const modeState = await resolveDoublesModeState();
  const { participants } = internalView(modeState);
  const card = buildRefereeAssignmentCard({
    assignment: { matchId: MATCH_ID, competitionId: COMPETITION_ID, status: "ASSIGNED" },
    competitionMode: COMPETITION_REFEREE_MODE.INTERNAL,
    participants,
    participantNames: modeState.participantNames,
    assignedMatch: { lifecycleState: "READY_TO_START" },
  });
  assert.equal(card.participantAEntryLabel, "Đội 9");
  assert.equal(card.participantBEntryLabel, "Đội 10");
  assert.equal(card.participantAMemberLine, "Nguyễn Văn A / Trần Văn B");
  assert.equal(card.participantBMemberLine, "Lê Văn C / Phạm Văn D");
  assert.equal(card.participantA, "Nguyễn Văn A / Trần Văn B");
  assert.equal(card.participantB, "Lê Văn C / Phạm Văn D");
  const jsx = readSrc("src/features/referee-production-ui/components/RefereeAssignmentCard.jsx");
  assert.match(jsx, /participant-a-entry/);
  assert.match(jsx, /participant-a-members/);
  assert.match(jsx, /participantAMemberLine/);
});

test("3. Match header renders entry + member names", async () => {
  const modeState = await resolveDoublesModeState();
  const { view } = internalView(modeState);
  assert.equal(view.participantDisplay.sideA.label, "Đội 9");
  assert.equal(view.participantDisplay.sideB.label, "Đội 10");
  assert.ok(view.participantDisplay.sideA.playerNames.includes("Nguyễn Văn A"));
  assert.ok(view.participantDisplay.sideA.playerNames.includes("Trần Văn B"));
  const screen = readSrc("src/features/referee-production-ui/components/RefereeMatchScreen.jsx");
  assert.match(screen, /team-name-a/);
  assert.match(screen, /participant-names-a/);
});

test("4. Court player markers render athlete names, not team labels", async () => {
  const modeState = await resolveDoublesModeState();
  const { view } = internalView(modeState);
  const court = view.courtProjection.court;
  const labels = Object.values(court)
    .filter(Boolean)
    .map((slot) => slot.displayName);
  assert.deepEqual(labels.sort(), ["Lê Văn C", "Nguyễn Văn A", "Phạm Văn D", "Trần Văn B"].sort());
  for (const label of labels) {
    assert.notEqual(label, "Đội 9");
    assert.notEqual(label, "Đội 10");
    assert.notEqual(label, "VĐV");
  }
  const markerSrc = readSrc("src/features/referee-production-ui/components/CanonicalCourtView.jsx");
  assert.doesNotMatch(markerSrc, /return "VĐV"/);
});

test("5. Lineup selector uses participantId and athlete displayName", async () => {
  const modeState = await resolveDoublesModeState();
  const { view } = internalView(modeState);
  const left = view.courtProjection.sides.left.activePlayers;
  assert.equal(left[0].playerId, PLAYER_A1);
  assert.equal(left[0].displayName, "Nguyễn Văn A");
  assert.notEqual(left[0].playerId, left[0].displayName);
  const screen = readSrc("src/features/referee-production-ui/components/RefereeMatchScreen.jsx");
  assert.match(screen, /data-participant-id=\{id\}/);
  assert.match(screen, /data-testid=\{`lineup-player-\$\{id\}`\}/);
  assert.match(screen, /serverPlayerId/);
  assert.doesNotMatch(
    readSrc("src/features/referee-production-ui/components/RefereeMatchScreen.jsx"),
    /serverPlayerName|displayNameAsId/
  );
});

test("6. Server selector labels are athlete names keyed by participantId", async () => {
  const modeState = await resolveDoublesModeState();
  const { view } = internalView(modeState);
  const players = [
    ...(view.courtProjection.sides.left.activePlayers || []),
    ...(view.courtProjection.sides.right.activePlayers || []),
  ];
  for (const player of players) {
    assert.match(player.playerId, /^[0-9a-f-]{36}$/i);
    assert.equal(["Nguyễn Văn A", "Trần Văn B", "Lê Văn C", "Phạm Văn D"].includes(player.displayName), true);
  }
  const screen = readSrc("src/features/referee-production-ui/components/RefereeMatchScreen.jsx");
  assert.match(screen, /lineup-server-\$\{p\.id\}/);
  assert.match(screen, /value=\{p\.id\}/);
  assert.match(screen, /setServerPlayerId\(p\.id\)/);
});

test("7. Singles remains one athlete, entry label secondary when distinct", () => {
  const names = {
    [ENTRY_A]: "Đội 9",
    [PLAYER_A1]: "Nguyễn Văn A",
    [ENTRY_B]: "Đội 10",
    [PLAYER_B1]: "Lê Văn C",
  };
  const sideA = resolveRefereeSideDisplay(
    { sideKey: "A", entryId: ENTRY_A, participantIds: [PLAYER_A1] },
    names
  );
  assert.equal(sideA.entryLabel, "Đội 9");
  assert.deepEqual([...sideA.memberNames], ["Nguyễn Văn A"]);
  const court = projectCanonicalCourtView({
    participants: {
      sides: [
        { sideKey: "A", entryId: ENTRY_A, participantIds: [PLAYER_A1] },
        { sideKey: "B", entryId: ENTRY_B, participantIds: [PLAYER_B1] },
      ],
    },
    participantNames: names,
    scoringRules: SCORING,
  });
  assert.equal(court.isSingles, true);
  assert.equal(court.court.leftTop.displayName, "Nguyễn Văn A");
  assert.equal(court.court.leftBottom, null);
});

test("8. Daily individual names preserved; no unit-label collapse", () => {
  const adapter = createDailyPlayRefereeAdapter({
    modeState: {
      tenantId: TENANT,
      competitionId: "daily-1",
      competitionMode: COMPETITION_REFEREE_MODE.DAILY_PLAY,
      canonicalAssignmentAuthorityAvailable: true,
      matches: {
        "daily-m1": {
          matchId: "daily-m1",
          status: "ready",
          teamAPlayerIds: ["p1", "p2"],
          teamBPlayerIds: ["p3", "p4"],
          scoringRules: SCORING,
          lineupsLocked: true,
        },
      },
    },
  });
  const req = { tenantId: TENANT, competitionId: "daily-1", matchId: "daily-m1" };
  const participants = adapter.getParticipants(req);
  const view = buildRefereeMatchView({
    matchId: "daily-m1",
    competitionMode: COMPETITION_REFEREE_MODE.DAILY_PLAY,
    participants,
    participantNames: { p1: "An", p2: "Bình", p3: "Chi", p4: "Dũng" },
    scoringRules: SCORING,
    assignedMatch: { lifecycleState: "READY_TO_START" },
  });
  assert.deepEqual([...view.participantDisplay.sideA.playerNames], ["An", "Bình"]);
  assert.deepEqual([...view.participantDisplay.sideB.playerNames], ["Chi", "Dũng"]);
  assert.equal(view.participantDisplay.sideA.playerNames.includes("Đội 9"), false);
});

test("9. Official pair label + member names", () => {
  const adapter = createOfficialTournamentRefereeAdapter({
    modeState: {
      tenantId: TENANT,
      competitionId: "off-1",
      competitionMode: COMPETITION_REFEREE_MODE.OFFICIAL,
      canonicalAssignmentAuthorityAvailable: true,
      matches: {
        "off-m1": {
          matchId: "off-m1",
          status: "READY_TO_START",
          entryAId: "pair-a",
          entryBId: "pair-b",
          participantIdsA: ["oa1", "oa2"],
          participantIdsB: ["ob1", "ob2"],
          scoringRules: SCORING,
          lineupsLocked: true,
        },
      },
      participantNames: {
        "pair-a": "Cặp 1",
        "pair-b": "Cặp 2",
        oa1: "Hà",
        oa2: "Khoa",
        ob1: "Linh",
        ob2: "Nam",
      },
    },
  });
  const req = { tenantId: TENANT, competitionId: "off-1", matchId: "off-m1" };
  const view = buildRefereeMatchView({
    matchId: "off-m1",
    competitionMode: COMPETITION_REFEREE_MODE.OFFICIAL,
    participants: adapter.getParticipants(req),
    participantNames: adapter.getParticipants(req) && {
      "pair-a": "Cặp 1",
      "pair-b": "Cặp 2",
      oa1: "Hà",
      oa2: "Khoa",
      ob1: "Linh",
      ob2: "Nam",
    },
    scoringRules: SCORING,
    assignedMatch: { lifecycleState: "READY_TO_START" },
  });
  assert.equal(view.participantDisplay.sideA.entryLabel, "Cặp 1");
  assert.deepEqual([...view.participantDisplay.sideA.playerNames], ["Hà", "Khoa"]);
  assert.equal(view.participantDisplay.sideB.entryLabel, "Cặp 2");
  assert.deepEqual([...view.participantDisplay.sideB.playerNames], ["Linh", "Nam"]);
});

test("10. Team active submatch participants shown with parent team context", () => {
  const adapter = createTeamTournamentRefereeAdapter({
    modeState: {
      tenantId: TENANT,
      competitionId: "team-1",
      competitionMode: COMPETITION_REFEREE_MODE.TEAM,
      canonicalAssignmentAuthorityAvailable: true,
      participantNames: {
        "team-a": "Đội 4",
        "team-b": "Đội 2",
        a1: "Minh",
        a2: "Long",
        b1: "Hùng",
        b2: "Phúc",
      },
      assignments: [{ matchupId: "mu-1", scope: "parent", status: "active" }],
      matchups: {
        "mu-1": {
          matchupId: "mu-1",
          teamAId: "team-a",
          teamBId: "team-b",
          teamAName: "Đội 4",
          teamBName: "Đội 2",
          status: "READY_TO_START",
          lineupsLocked: true,
          scoringRules: SCORING,
          lineupA: ["a1", "a2"],
          lineupB: ["b1", "b2"],
          subMatches: [
            {
              id: "sub-1",
              status: "READY_TO_START",
              lineupA: ["a1", "a2"],
              lineupB: ["b1", "b2"],
              scoringRules: SCORING,
              lineupsLocked: true,
            },
          ],
        },
      },
    },
  });
  const req = { tenantId: TENANT, competitionId: "team-1", matchId: "sub-1" };
  const participants = adapter.getParticipants(req);
  const names = {
    "team-a": "Đội 4",
    "team-b": "Đội 2",
    a1: "Minh",
    a2: "Long",
    b1: "Hùng",
    b2: "Phúc",
  };
  const view = buildRefereeMatchView({
    matchId: "sub-1",
    competitionMode: COMPETITION_REFEREE_MODE.TEAM,
    participants,
    participantNames: names,
    scoringRules: SCORING,
    assignedMatch: { lifecycleState: "READY_TO_START" },
  });
  assert.equal(view.participantDisplay.sideA.entryLabel, "Đội 4");
  assert.deepEqual([...view.participantDisplay.sideA.playerNames], ["Minh", "Long"]);
  assert.equal(view.participantDisplay.sideB.entryLabel, "Đội 2");
  assert.deepEqual([...view.participantDisplay.sideB.playerNames], ["Hùng", "Phúc"]);
  const card = buildRefereeAssignmentCard({
    assignment: { matchId: "sub-1", competitionId: "team-1", status: "ASSIGNED" },
    competitionMode: COMPETITION_REFEREE_MODE.TEAM,
    participants,
    participantNames: names,
    assignedMatch: { lifecycleState: "READY_TO_START" },
  });
  assert.equal(card.participantAEntryLabel, "Đội 4");
  assert.equal(card.participantAMemberLine, "Minh / Long");
});

test("11. no display-name-as-identity in lineup writer payload", () => {
  const screen = readSrc("src/features/referee-production-ui/components/RefereeMatchScreen.jsx");
  assert.match(screen, /playerPositions: \{ sideA, sideB \}/);
  assert.match(screen, /serverPlayerId/);
  assert.doesNotMatch(screen, /serverPlayerId:\s*p\.name/);
  assert.doesNotMatch(screen, /playerPositions:[\s\S]{0,80}displayName/);
  const harvest = readSrc(
    "src/features/referee-production-ui/application/resolveCanonicalRefereeModeState.js"
  );
  assert.doesNotMatch(harvest, /names\[pid\] = entryName/);
});

test("12. failing Internal deep-link read-only PASS with member names", async () => {
  const modeState = await resolveDoublesModeState();
  const { view, participants } = internalView(modeState);
  assert.equal(view.matchId, MATCH_ID);
  assert.equal(view.competitionId, COMPETITION_ID);
  assert.equal(participants.sides[0].entryId, ENTRY_A);
  assert.equal(view.participantDisplay.sideA.entryLabel, "Đội 9");
  assert.equal(view.participantDisplay.sideA.playerNames.join(" / "), "Nguyễn Văn A / Trần Văn B");
  assert.equal(view.participantDisplay.sideB.entryLabel, "Đội 10");
  assert.equal(view.participantDisplay.sideB.playerNames.join(" / "), "Lê Văn C / Phạm Văn D");
  const courtLabels = Object.values(view.courtProjection.court)
    .filter(Boolean)
    .map((slot) => slot.displayName);
  assert.equal(courtLabels.includes("Đội 9"), false);
  assert.equal(courtLabels.includes("VĐV"), false);
});

test("generated Đội N unit label is never used as a player marker name", () => {
  const side = {
    sideKey: "A",
    entryId: ENTRY_A,
    participantIds: [PLAYER_A1, PLAYER_A2],
  };
  const names = {
    [ENTRY_A]: "Đội 9",
    [PLAYER_A1]: "Đội 9",
    [PLAYER_A2]: "Đội 9",
  };
  const resolved = resolveRefereeSideDisplay(side, names);
  assert.equal(resolved.entryLabel, "Đội 9");
  assert.equal(resolved.memberNames.length, 0);
  assert.equal(resolved.members[0].participantId, PLAYER_A1);
  const court = projectCanonicalCourtView({
    participants: { sides: [side, { sideKey: "B", entryId: ENTRY_B, participantIds: [PLAYER_B1] }] },
    participantNames: names,
    scoringRules: SCORING,
  });
  assert.notEqual(court.court.leftTop.displayName, "Đội 9");
  assert.notEqual(court.court.leftTop.displayName, "VĐV");
});

test("Adapter B ×4 conformance still PASS", () => {
  const daily = createDailyPlayRefereeAdapter({
    modeState: {
      tenantId: TENANT,
      competitionId: "daily-1",
      competitionMode: COMPETITION_REFEREE_MODE.DAILY_PLAY,
      canonicalAssignmentAuthorityAvailable: true,
      matches: {
        m1: {
          matchId: "m1",
          status: "ready",
          teamAPlayerIds: ["p1"],
          teamBPlayerIds: ["p2"],
          scoringRules: SCORING,
          lineupsLocked: true,
        },
      },
    },
  });
  const internal = createInternalTournamentRefereeAdapter({
    modeState: {
      tenantId: TENANT,
      competitionId: COMPETITION_ID,
      competitionMode: COMPETITION_REFEREE_MODE.INTERNAL,
      canonicalAssignmentAuthorityAvailable: true,
      matches: {
        [MATCH_ID]: {
          matchId: MATCH_ID,
          status: "waiting",
          entryAId: ENTRY_A,
          entryBId: ENTRY_B,
          participantIdsA: [PLAYER_A1, PLAYER_A2],
          participantIdsB: [PLAYER_B1, PLAYER_B2],
          scoringRules: SCORING,
          lineupsLocked: true,
        },
      },
    },
  });
  const official = createOfficialTournamentRefereeAdapter({
    modeState: {
      tenantId: TENANT,
      competitionId: "off-1",
      competitionMode: COMPETITION_REFEREE_MODE.OFFICIAL,
      canonicalAssignmentAuthorityAvailable: true,
      matches: {
        m1: {
          matchId: "m1",
          status: "READY_TO_START",
          entryAId: "a",
          entryBId: "b",
          participantIdsA: ["oa"],
          participantIdsB: ["ob"],
          scoringRules: SCORING,
          lineupsLocked: true,
        },
      },
    },
  });
  const team = createTeamTournamentRefereeAdapter({
    modeState: {
      tenantId: TENANT,
      competitionId: "team-1",
      competitionMode: COMPETITION_REFEREE_MODE.TEAM,
      canonicalAssignmentAuthorityAvailable: true,
      assignments: [{ matchupId: "mu-1", scope: "parent", status: "active" }],
      matchups: {
        "mu-1": {
          matchupId: "mu-1",
          teamAId: "ta",
          teamBId: "tb",
          status: "READY_TO_START",
          lineupsLocked: true,
          scoringRules: SCORING,
          lineupA: ["a1"],
          lineupB: ["b1"],
          subMatches: [
            {
              id: "sub-1",
              status: "READY_TO_START",
              lineupA: ["a1"],
              lineupB: ["b1"],
              scoringRules: SCORING,
              lineupsLocked: true,
            },
          ],
        },
      },
    },
  });

  const reports = [
    runCompetitionRefereeAdapterConformance(daily, {
      validRequest: { tenantId: TENANT, competitionId: "daily-1", matchId: "m1" },
      crossTenantRequest: { tenantId: "other", competitionId: "daily-1", matchId: "m1" },
    }),
    runCompetitionRefereeAdapterConformance(internal, {
      validRequest: { tenantId: TENANT, competitionId: COMPETITION_ID, matchId: MATCH_ID },
      crossTenantRequest: { tenantId: "other", competitionId: COMPETITION_ID, matchId: MATCH_ID },
    }),
    runCompetitionRefereeAdapterConformance(official, {
      validRequest: { tenantId: TENANT, competitionId: "off-1", matchId: "m1" },
      crossTenantRequest: { tenantId: "other", competitionId: "off-1", matchId: "m1" },
    }),
    runCompetitionRefereeAdapterConformance(team, {
      validRequest: { tenantId: TENANT, competitionId: "team-1", matchId: "sub-1" },
      crossTenantRequest: { tenantId: "other", competitionId: "team-1", matchId: "sub-1" },
    }),
  ];
  for (const report of reports) {
    assert.equal(report.ok, true, JSON.stringify((report.results || []).filter((r) => !r.ok), null, 2));
  }
});
