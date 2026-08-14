/**
 * Phase 2J — Group schedule + canonical court + human-readable match projection.
 * Presentation / schedule assignment only. Does not redraw, re-pair, or invent matches.
 */
import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { readFileSync } from "node:fs";

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
  formOfficialIndividualPairs,
  applyOfficialGroupDrawPreservingRegistration,
  listOfficialDrawEntries,
  listOfficialRegistrationEntries,
  projectOfficialMatchPresentation,
  projectOfficialGroupStageMatches,
  isRawTechnicalId,
  UNRESOLVED_COMPETITION_SIDE_LABEL,
  GROUP_MATCH_COUNT_SOURCE,
  scheduleOfficialGroupMatches,
  isOfficialGroupScheduleReady,
  countOfficialRoundRobinMatches,
  OFFICIAL_GROUP_MATCH_DURATION_MINUTES,
} from "../src/features/individual-tournament/index.js";
import { DEFAULT_TIME_PREDICTION } from "../src/features/tournament-engine/constants/defaults.js";
import { buildGroupStageSchedule } from "../src/tournament/engines/scheduleEngine.js";
import { generateSchedule } from "../src/features/tournament-engine/engines/scheduleEngine.js";
import { checkBookingConflict } from "../src/domain/courtBookingEngine.js";
import {
  listCanonicalClubCourtsForFormatVenue,
  normalizeCanonicalClubCourts,
  __setCanonicalClubCourtInventoryDepsForTests,
  __resetCanonicalClubCourtInventoryDepsForTests,
} from "../src/features/team-tournament/services/canonicalClubCourtInventory.js";

function src(path) {
  return readFileSync(path, "utf8");
}

function twelvePlayers() {
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

function baseTournament(players) {
  return patchOfficialCompetitionSettings(
    {
      id: "t-p2j-group-schedule",
      name: "Official P2J Group Schedule",
      mode: TOURNAMENT_MODE.OFFICIAL_TOURNAMENT,
      officialMode: OFFICIAL_MODE.OPEN,
      status: TOURNAMENT_STATUS.DRAFT,
      clubId: "club-1",
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

function groupedFixture() {
  const players = twelvePlayers();
  const formed = formOfficialIndividualPairs({
    tournament: baseTournament(players),
    eventId: "ev1",
    players,
    eventType: EVENT_TYPE.MEN_DOUBLE,
    pairingFn: stubOpenPairing,
  });
  assert.equal(formed.ok, true);
  const pairs = listOfficialDrawEntries(formed.tournament.events[0]);
  assert.equal(pairs.length, 6);
  const groups = [
    {
      id: "group-A-1786600000000-0",
      label: "A",
      name: "Bang A",
      entries: pairs.slice(0, 3),
      entryIds: pairs.slice(0, 3).map((pair) => pair.id),
    },
    {
      id: "group-B-1786600000000-1",
      label: "B",
      name: "Bang B",
      entries: pairs.slice(3, 6),
      entryIds: pairs.slice(3, 6).map((pair) => pair.id),
    },
  ];
  const schedule = buildGroupStageSchedule(groups, {
    tournamentId: formed.tournament.id,
    eventId: "ev1",
    players,
  });
  const applied = applyOfficialGroupDrawPreservingRegistration(formed.tournament, {
    ...formed.tournament.events[0],
    groups: schedule.groups,
    matches: schedule.matches,
  });
  assert.equal(applied.ok, true);
  return {
    tournament: applied.tournament,
    event: applied.event,
    players,
    pairs,
    groups: schedule.groups,
  };
}

function courtsTwo() {
  return [
    { id: "court-1", name: "Sân 1", number: 1, active: true },
    { id: "court-2", name: "Sân 2", number: 2, active: true },
  ];
}

function scheduleInput(overrides = {}) {
  return {
    eventId: "ev1",
    courts: courtsTwo(),
    courtIds: ["court-1", "court-2"],
    date: "2026-08-20",
    startTime: "08:00",
    endTime: "18:00",
    timezone: "Asia/Ho_Chi_Minh",
    ...overrides,
  };
}

function unorderedKey(a, b) {
  return [String(a), String(b)].sort().join("|");
}

function displayTexts(rows) {
  return (rows || []).flatMap((row) => [
    row.heading,
    row.groupLabel,
    row.vsLine,
    row.sideA?.label,
    row.sideB?.label,
    row.courtLabel,
  ]).filter(Boolean);
}

afterEach(() => {
  __resetCanonicalClubCourtInventoryDepsForTests();
});

describe("official-open-tournament-phase2j-group-schedule-01", () => {
  it("match count: 3 pairs/group × 2 groups = 6 round-robin matches, no duplicates, no cross-group", () => {
    const { event, pairs } = groupedFixture();
    assert.equal(listOfficialRegistrationEntries(event).length, 12);
    assert.equal(pairs.length, 6);
    assert.equal(event.groups.length, 2);
    assert.equal(event.groups[0].entryIds.length, 3);
    assert.equal(event.groups[1].entryIds.length, 3);
    assert.equal(countOfficialRoundRobinMatches(3), 3);
    assert.equal(countOfficialRoundRobinMatches(3) * 2, 6);
    assert.equal(event.matches.length, 6);
    assert.equal(GROUP_MATCH_COUNT_SOURCE, "event.matches");

    const seen = new Set();
    for (const match of event.matches) {
      const group = event.groups.find((item) => String(item.id) === String(match.groupId));
      assert.ok(group, `missing group for ${match.id}`);
      const members = new Set((group.entryIds || []).map(String));
      assert.equal(members.has(String(match.entryAId)), true);
      assert.equal(members.has(String(match.entryBId)), true);
      const key = `${match.groupId}:${unorderedKey(match.entryAId, match.entryBId)}`;
      assert.equal(seen.has(key), false, `duplicate matchup ${key}`);
      seen.add(key);
    }
    assert.equal(seen.size, 6);
  });

  it("identity: resolvable drawEntry pair IDs project to human names, not TBD/UUID", () => {
    const { tournament, event, players } = groupedFixture();
    const before = JSON.stringify(tournament);
    const projected = projectOfficialGroupStageMatches(tournament, event.id, { players });
    assert.equal(JSON.stringify(tournament), before);
    assert.equal(projected.matchCount, 6);
    projected.rows.forEach((row) => {
      assert.match(row.heading, /^Bảng [AB] · Trận [1-3]$/);
      assert.equal(row.groupLabel === "Bảng A" || row.groupLabel === "Bảng B", true);
      assert.equal(row.vsLine.includes("TBD"), false);
      assert.equal(row.integrityError, false);
      assert.equal(isRawTechnicalId(row.sideA.label), false, row.sideA.label);
      assert.equal(isRawTechnicalId(row.sideB.label), false, row.sideB.label);
      assert.match(row.sideA.label, / \+ /);
    });
    displayTexts(projected.rows).forEach((text) => {
      assert.equal(isRawTechnicalId(text), false, text);
      assert.equal(/^[0-9a-f-]{36}$/i.test(text), false, text);
    });
    const first = projectOfficialMatchPresentation(tournament, event.matches[0], { players });
    assert.match(first.vsLine, /Nguyễn A \+ Trần B|Lê C \+ Phạm D|Hoàng E \+ Vũ F|Đặng G \+ Bùi H|Đỗ I \+ Ngô J|Dương K \+ Lý L/);
  });

  it("unknown participant reference fails closed with integrity label, not TBD", () => {
    const { tournament, event, players } = groupedFixture();
    const broken = {
      ...event.matches[0],
      entryAId: "00000000-0000-4000-8000-000000000099",
    };
    const presentation = projectOfficialMatchPresentation(tournament, broken, { players });
    assert.equal(presentation.integrityError, true);
    assert.equal(presentation.sideA.label, UNRESOLVED_COMPETITION_SIDE_LABEL);
    assert.equal(presentation.vsLine.includes("TBD"), false);
    assert.equal(presentation.integrityMessage, UNRESOLVED_COMPETITION_SIDE_LABEL);
  });

  it("schedule table / referee overlay / score labels share the same projection", () => {
    const { tournament, event, players } = groupedFixture();
    const projected = projectOfficialGroupStageMatches(tournament, event.id, { players });
    const groupSrc = src("src/components/tournament/official/OfficialTournamentGroupStageScreen.jsx");
    const scoreSrc = src("src/components/tournament/GroupStagePanel.jsx");
    const refereeSrc = src("src/components/tournament/RefereeAssignPanel.jsx");
    const opsSrc = src("src/components/tournament/official/OfficialTournamentRefereeOps.jsx");
    assert.match(groupSrc, /projectOfficialGroupStageMatches/);
    assert.match(groupSrc, /presentations\.byMatchId/);
    assert.match(scoreSrc, /matchPresentationById/);
    assert.match(scoreSrc, /presentation\?\.sideA\?\.label/);
    assert.match(refereeSrc, /matchPresentationById/);
    assert.match(refereeSrc, /presentation\.sideA\?\.label/);
    assert.match(opsSrc, /matchPresentationById/);
    assert.equal(Object.keys(projected.byMatchId).length, 6);
  });

  it("zero courts fail closed; lock button disabled; empty copy is explicit", () => {
    const { tournament } = groupedFixture();
    const result = scheduleOfficialGroupMatches(tournament, scheduleInput({ courts: [], courtIds: [] }));
    assert.equal(result.ok, false);
    assert.equal(result.mutationCount, 0);
    assert.equal(result.code, "ZERO_COURTS_SELECTED");

    const noneSelected = scheduleOfficialGroupMatches(
      tournament,
      scheduleInput({ courtIds: [] })
    );
    assert.equal(noneSelected.ok, false);
    assert.equal(noneSelected.mutationCount, 0);

    const panelSrc = src("src/components/tournament/TournamentCourtSchedulePanel.jsx");
    assert.match(panelSrc, /Chưa có sân khả dụng cho đơn vị hiện tại\./);
    assert.match(panelSrc, /disabled=\{busy \|\| !courts\.length \|\| !courtIds\.length\}/);
  });

  it("canonical courts are tenant-scoped; other-tenant courts are dropped", async () => {
    const mixed = normalizeCanonicalClubCourts(
      [
        { id: "c1", name: "Sân 1", tenantId: "tenant-a", active: true },
        { id: "c2", name: "Sân other", tenantId: "tenant-b", active: true },
      ],
      { tenantId: "tenant-a", clubId: "club-1" }
    );
    assert.deepEqual(
      mixed.map((court) => court.id),
      ["c1"]
    );

    __setCanonicalClubCourtInventoryDepsForTests({
      hasSupabaseConfig: () => true,
      getSupabaseAuthClient: () => ({
        from() {
          const q = {
            select() {
              return q;
            },
            eq() {
              return q;
            },
            limit() {
              return Promise.resolve({
                data: [
                  {
                    venue_id: "tenant-a",
                    version: 1,
                    data: {
                      courts: [
                        { id: "c1", name: "Sân 1", tenantId: "tenant-a", active: true },
                        { id: "c-stale", name: "Sân stale", tenantId: "tenant-b", active: true },
                      ],
                    },
                  },
                ],
                error: null,
              });
            },
          };
          return q;
        },
      }),
    });
    const listed = await listCanonicalClubCourtsForFormatVenue({
      clubId: "club-1",
      tenantId: "tenant-a",
    });
    assert.equal(listed.ok, true);
    assert.equal(listed.source, "club_data_v3");
    assert.deepEqual(
      listed.courts.map((court) => court.id),
      ["c1"]
    );

    const setupSrc = src("src/pages/tournament/OfficialTournamentSetup.jsx");
    assert.match(setupSrc, /listCanonicalClubCourtsForFormatVenue/);
    assert.match(setupSrc, /setCourts\(\[\]\)/);
    assert.doesNotMatch(setupSrc, /loadCourtsForClub/);
  });

  it("booking overlap fail-closed; zero selected courts do not mutate", () => {
    const conflict = checkBookingConflict(
      [
        {
          id: "b1",
          courtId: "court-1",
          courtName: "Sân 1",
          date: "2026-08-20",
          startTime: "08:00",
          endTime: "10:00",
          bookingStatus: "confirmed",
        },
      ],
      {
        courtId: "court-1",
        date: "2026-08-20",
        startTime: "09:00",
        endTime: "11:00",
      }
    );
    assert.ok(conflict);
    assert.equal(conflict.code, "CONFLICT");

    const commandSrc = src("src/features/tournament/services/tournamentCommands.js");
    assert.match(commandSrc, /syncTournamentCourtBookings/);
    assert.match(commandSrc, /ZERO_COURTS_SELECTED/);
    const bookingSrc = src("src/domain/tournamentBookingService.js");
    assert.match(bookingSrc, /checkBookingConflict/);
    assert.match(bookingSrc, /BOOKING_CONFLICT/);
  });

  it("six matches + valid courts/window receive time and court; no duplicate ids; no collisions", () => {
    const { tournament, event, players } = groupedFixture();
    const beforeEntries = JSON.stringify(event.entries);
    const beforeDraw = JSON.stringify(event.drawEntries);
    const beforeGroups = JSON.stringify(event.groups);
    const beforeMatchups = event.matches.map((match) => ({
      id: match.id,
      groupId: match.groupId,
      entryAId: match.entryAId,
      entryBId: match.entryBId,
    }));

    const result = scheduleOfficialGroupMatches(tournament, scheduleInput({ players }), {
      generateSchedule,
    });
    assert.equal(result.ok, true, result.error);
    assert.equal(result.mutationCount, 1);
    assert.equal(result.readbackCount, 1);
    assert.equal(result.durationMinutes, DEFAULT_TIME_PREDICTION.groupStageMinutes);
    assert.equal(OFFICIAL_GROUP_MATCH_DURATION_MINUTES, 22);

    const scheduled = result.matches.filter((match) => !match.bracketMatchId);
    assert.equal(scheduled.length, 6);
    assert.equal(new Set(scheduled.map((match) => match.id)).size, 6);
    scheduled.forEach((match) => {
      assert.ok(match.scheduledStart, match.id);
      assert.ok(match.courtId, match.id);
    });
    assert.equal(isOfficialGroupScheduleReady({ matches: scheduled }), true);

    const courtSlots = [];
    const pairSlots = [];
    scheduled.forEach((match) => {
      const start = Date.parse(match.scheduledStart);
      const end = Date.parse(match.scheduledEnd);
      courtSlots.push({ courtId: match.courtId, start, end, id: match.id });
      pairSlots.push({ pairId: match.entryAId, start, end, id: match.id });
      pairSlots.push({ pairId: match.entryBId, start, end, id: match.id });
    });
    for (let i = 0; i < courtSlots.length; i += 1) {
      for (let j = i + 1; j < courtSlots.length; j += 1) {
        if (courtSlots[i].courtId !== courtSlots[j].courtId) continue;
        assert.equal(
          courtSlots[i].end > courtSlots[j].start && courtSlots[j].end > courtSlots[i].start,
          false,
          `court overlap ${courtSlots[i].id}/${courtSlots[j].id}`
        );
      }
    }
    for (let i = 0; i < pairSlots.length; i += 1) {
      for (let j = i + 1; j < pairSlots.length; j += 1) {
        if (pairSlots[i].pairId !== pairSlots[j].pairId) continue;
        assert.equal(
          pairSlots[i].end > pairSlots[j].start && pairSlots[j].end > pairSlots[i].start,
          false,
          `pair overlap ${pairSlots[i].id}/${pairSlots[j].id}`
        );
      }
    }

    const nextEvent = result.events[0];
    assert.equal(JSON.stringify(nextEvent.entries), beforeEntries);
    assert.equal(JSON.stringify(nextEvent.drawEntries), beforeDraw);
    assert.equal(JSON.stringify(nextEvent.groups), beforeGroups);
    assert.deepEqual(
      nextEvent.matches.map((match) => ({
        id: match.id,
        groupId: match.groupId,
        entryAId: match.entryAId,
        entryBId: match.entryBId,
      })),
      beforeMatchups
    );
  });

  it("F5 roundtrip keeps the same six match IDs, pairings, times, courts, and group labels", () => {
    const { tournament, players } = groupedFixture();
    const scheduled = scheduleOfficialGroupMatches(tournament, scheduleInput({ players }), {
      generateSchedule,
    });
    assert.equal(scheduled.ok, true, scheduled.error);
    const hydrated = normalizeTournament(JSON.parse(JSON.stringify(scheduled.tournament)));
    const first = projectOfficialGroupStageMatches(scheduled.tournament, "ev1", {
      players,
      courts: courtsTwo(),
    });
    const second = projectOfficialGroupStageMatches(hydrated, "ev1", {
      players,
      courts: courtsTwo(),
    });
    assert.deepEqual(
      first.rows.map((row) => ({
        matchId: row.matchId,
        vsLine: row.vsLine,
        scheduledAt: row.scheduledAt,
        courtId: row.courtId,
        groupLabel: row.groupLabel,
      })),
      second.rows.map((row) => ({
        matchId: row.matchId,
        vsLine: row.vsLine,
        scheduledAt: row.scheduledAt,
        courtId: row.courtId,
        groupLabel: row.groupLabel,
      }))
    );
  });

  it("court/time and pair/time collisions fail closed with mutationCount 0", () => {
    const { tournament, event } = groupedFixture();
    const colliding = scheduleOfficialGroupMatches(tournament, scheduleInput(), {
      generateSchedule: (context) => ({
        ok: true,
        data: {
          matches: context.matches.map((match) => ({
            ...match,
            scheduledStart: "2026-08-20T01:00:00.000Z",
            scheduledEnd: "2026-08-20T01:22:00.000Z",
            courtId: "court-1",
          })),
        },
      }),
    });
    assert.equal(colliding.ok, false);
    assert.equal(colliding.mutationCount, 0);
    assert.equal(colliding.code, "SCHEDULE_CONFLICT");
    assert.equal(JSON.stringify(event.matches), JSON.stringify(tournament.events[0].matches));
  });

  it("Group Stage copy, orchestration, and persist path", () => {
    const groupSrc = src("src/components/tournament/official/OfficialTournamentGroupStageScreen.jsx");
    const setupSrc = src("src/pages/tournament/OfficialTournamentSetup.jsx");
    assert.match(groupSrc, /Xếp lịch vòng bảng/);
    assert.doesNotMatch(groupSrc, /giữ tournamentId/);
    assert.doesNotMatch(setupSrc, /giữ tournamentId/);
    assert.match(groupSrc, /Hoàn tất lịch thi đấu trước khi phân công trọng tài\./);
    assert.match(groupSrc, /Hoàn tất lịch thi đấu trước khi nhập điểm\./);
    assert.match(groupSrc, /isOfficialGroupScheduleReady/);
    assert.match(setupSrc, /scheduleOfficialGroupMatches/);
    assert.match(setupSrc, /commitOfficialGroupScheduleCommand/);
    assert.match(setupSrc, /persistTournament\(\{ events: result\.events \}\)/);
    assert.match(setupSrc, /selectStage = \(stageId\) => \{/);
    assert.doesNotMatch(setupSrc, /visibilitychange|window\.addEventListener\(['"]focus/);
  });

  it("wrapper does not regenerate matches from groups", () => {
    const { tournament, event } = groupedFixture();
    let seenGroups = null;
    scheduleOfficialGroupMatches(tournament, scheduleInput(), {
      generateSchedule: (context) => {
        seenGroups = context.groups;
        return {
          ok: true,
          data: {
            matches: context.matches.map((match, index) => ({
              ...match,
              scheduledStart: `2026-08-20T0${index + 1}:00:00.000Z`,
              scheduledEnd: `2026-08-20T0${index + 1}:22:00.000Z`,
              courtId: index % 2 === 0 ? "court-1" : "court-2",
            })),
          },
        };
      },
    });
    assert.deepEqual(seenGroups, []);
    assert.equal(event.matches.length, 6);
  });
});
