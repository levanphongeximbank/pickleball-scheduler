import test from "node:test";
import assert from "node:assert/strict";

import { generateSeed, computeSeedScore } from "../src/features/tournament-engine/engines/seedEngine.js";
import { generateDraw, computeDrawScore } from "../src/features/tournament-engine/engines/drawEngine.js";
import { generateSchedule } from "../src/features/tournament-engine/engines/scheduleEngine.js";
import { assignCourts } from "../src/features/tournament-engine/engines/courtAssignmentEngine.js";
import { predictMatchDuration, predictTournamentTime } from "../src/features/tournament-engine/engines/timePredictionEngine.js";
import { computeRankings, headToHeadResult } from "../src/features/tournament-engine/engines/rankingEngine.js";
import { MATCH_STATUS } from "../src/models/tournament/constants.js";

const players = [
  { id: "p1", name: "Alpha", elo: 1200, skillLevel: 4.5, stats: { matchesPlayed: 20, wins: 14 } },
  { id: "p2", name: "Beta", skillLevel: 4.0, stats: { matchesPlayed: 15, wins: 8 } },
  { id: "p3", name: "Gamma", elo: 900, skillLevel: 3.0, stats: { matchesPlayed: 5, wins: 2 } },
  { id: "p4", name: "Delta", skillLevel: 3.5, stats: { matchesPlayed: 1, wins: 0 } },
  { id: "p5", name: "Echo", elo: 1100, skillLevel: 4.2, stats: { matchesPlayed: 10, wins: 6 } },
  { id: "p6", name: "Foxtrot", skillLevel: 3.8, stats: { matchesPlayed: 8, wins: 4 } },
  { id: "p7", name: "Golf", elo: 1000, skillLevel: 3.9, stats: { matchesPlayed: 12, wins: 5 } },
  { id: "p8", name: "Hotel", skillLevel: 3.2, stats: { matchesPlayed: 2, wins: 1 } },
];

function toParticipants(list) {
  return list.map((p) => ({
    id: p.id,
    name: p.name,
    playerIds: [p.id],
    elo: p.elo ?? null,
    skillLevel: p.skillLevel,
    matchesPlayed: p.stats?.matchesPlayed ?? 0,
    winRate: p.stats ? p.stats.wins / p.stats.matchesPlayed : null,
    clubName: p.clubName || "CLB A",
    status: p.status || "active",
  }));
}

test("seed engine sorts by ELO when available", () => {
  const result = generateSeed({
    participants: toParticipants(players),
  });
  assert.equal(result.ok, true);
  const seeded = result.data.seeded;
  assert.ok(seeded.length >= 2);
  assert.equal(seeded[0].id, "p1");
  assert.ok(seeded[0].seed === 1);
});

test("seed engine falls back to skill level without ELO", () => {
  const { score: high } = computeSeedScore(
    { skillLevel: 5, matchesPlayed: 10 },
    { elo: 0, skillLevel: 1, winRate: 0, recentPerformance: 0, manualPriority: 0 }
  );
  const { score: low } = computeSeedScore(
    { skillLevel: 2, matchesPlayed: 10 },
    { elo: 0, skillLevel: 1, winRate: 0, recentPerformance: 0, manualPriority: 0 }
  );
  assert.ok(high > low);
});

test("seed engine puts new players in unseeded pool", () => {
  const result = generateSeed({
    participants: toParticipants([players[3], players[7]]),
  });
  assert.equal(result.ok, true);
  assert.ok(result.data.unseeded.length >= 1);
});

test("seed engine preserves manual override", () => {
  const participants = toParticipants(players.slice(0, 4)).map((p, i) =>
    i === 2 ? { ...p, manualSeedOverride: true, seed: 1, seedScore: 9999 } : p
  );
  const result = generateSeed({ participants });
  assert.equal(result.ok, true);
  const manual = result.data.participants.find((p) => p.id === participants[2].id);
  assert.equal(manual.seed, 1);
});

test("draw engine distributes seeds across groups", () => {
  const seedResult = generateSeed({ participants: toParticipants(players) });
  const drawResult = generateDraw({
    tournamentId: "t1",
    eventId: "e1",
    participants: seedResult.data.participants,
    groupCount: 4,
    randomSeed: 7,
  });
  assert.equal(drawResult.ok, true);
  assert.equal(drawResult.data.groups.length, 4);
  const topSeedsPerGroup = drawResult.data.groups.map(
    (g) => g.entries.filter((e) => e.seed != null && e.seed <= 4).length
  );
  assert.ok(topSeedsPerGroup.every((count) => count <= 2));
});

test("draw engine retry picks best drawScore", () => {
  const participants = toParticipants(players);
  participants.forEach((p, i) => {
    p.seed = i + 1;
    p.unseeded = false;
  });
  const groups = [
    { label: "A", members: participants.slice(0, 2) },
    { label: "B", members: participants.slice(2, 4) },
  ];
  const score = computeDrawScore(groups, 2);
  assert.ok(Number.isFinite(score));
});

test("schedule engine avoids same-team double booking in slot", () => {
  const matches = [
    {
      id: "m1",
      entryAId: "p1",
      entryBId: "p2",
      round: 1,
      status: MATCH_STATUS.WAITING,
    },
    {
      id: "m2",
      entryAId: "p1",
      entryBId: "p3",
      round: 1,
      status: MATCH_STATUS.WAITING,
    },
  ];
  const result = generateSchedule({
    tournamentId: "t1",
    matches,
    courts: [
      { id: "c1", name: "Sân 1" },
      { id: "c2", name: "Sân 2" },
    ],
    scheduleConfig: {
      startTime: "08:00",
      endTime: "22:00",
      averageMatchMinutes: 20,
      bufferMinutes: 5,
      date: "2026-06-30",
    },
  });
  assert.equal(result.ok, true);
  const m1 = result.data.matches.find((m) => m.id === "m1");
  const m2 = result.data.matches.find((m) => m.id === "m2");
  assert.notEqual(m1.slot, m2.slot);
});

test("schedule engine keeps completed matches on regenerate", () => {
  const completed = {
    id: "done",
    entryAId: "p1",
    entryBId: "p2",
    status: MATCH_STATUS.COMPLETED,
    scheduledStart: "2026-06-30T08:00:00.000Z",
    courtId: "c1",
    slot: 0,
  };
  const pending = {
    id: "wait",
    entryAId: "p3",
    entryBId: "p4",
    status: MATCH_STATUS.WAITING,
    round: 1,
  };
  const result = generateSchedule(
    {
      matches: [completed, pending],
      courts: [{ id: "c1", name: "Sân 1" }],
      scheduleConfig: { startTime: "08:00", endTime: "22:00", averageMatchMinutes: 20 },
    },
    { regenerate: true }
  );
  assert.equal(result.ok, true);
  const kept = result.data.matches.find((m) => m.id === "done");
  assert.equal(kept.status, MATCH_STATUS.COMPLETED);
  assert.equal(kept.courtId, "c1");
});

test("court assignment skips locked courts", () => {
  const result = assignCourts({
    matches: [{ id: "m1", entryAId: "a", entryBId: "b", status: MATCH_STATUS.WAITING }],
    courts: [
      { id: "c1", name: "Sân 1", locked: true, priority: 10 },
      { id: "c2", name: "Sân 2", locked: false, priority: 5 },
    ],
  });
  assert.equal(result.ok, true);
  assert.equal(result.data.assignments[0].courtId, "c2");
});

test("court assignment does not override manual lock", () => {
  const result = assignCourts(
    {
      matches: [
        {
          id: "m1",
          status: MATCH_STATUS.WAITING,
          manualCourtLock: true,
          courtId: "c1",
        },
      ],
      courts: [{ id: "c2", name: "Sân 2" }],
    },
    { overrideManual: false }
  );
  assert.equal(result.data.assignments.length, 0);
});

test("time prediction: balanced match longer than mismatch", () => {
  const balanced = predictMatchDuration(
    { stage: "group" },
    { entryA: { elo: 1000 }, entryB: { elo: 1020 } }
  );
  const skewed = predictMatchDuration(
    { stage: "group" },
    { entryA: { elo: 1000 }, entryB: { elo: 1400 } }
  );
  assert.ok(balanced.predictedDurationMinutes > skewed.predictedDurationMinutes);
});

test("time prediction: final longer than group stage", () => {
  const group = predictMatchDuration({ stage: "group" }, {});
  const final = predictMatchDuration({ stage: "final" }, {});
  assert.ok(final.predictedDurationMinutes > group.predictedDurationMinutes);
});

test("time prediction includes confidence and reason", () => {
  const result = predictMatchDuration({ stage: "group" }, {});
  assert.ok(result.confidence >= 0 && result.confidence <= 1);
  assert.ok(result.reason.length > 0);
});

test("ranking sorts by wins and point diff", () => {
  const group = {
    id: "g1",
    label: "A",
    entryIds: ["a", "b"],
    entries: [
      { id: "a", name: "Team A" },
      { id: "b", name: "Team B" },
    ],
  };
  const matches = [
    {
      id: "m1",
      groupId: "g1",
      entryAId: "a",
      entryBId: "b",
      status: MATCH_STATUS.COMPLETED,
      scoreA: 11,
      scoreB: 5,
      winnerId: "a",
    },
  ];
  const result = computeRankings({
    groups: [group],
    matches,
    participants: group.entries,
  });
  assert.equal(result.ok, true);
  assert.equal(result.data.groupRankings[0].rankings[0].participantId, "a");
  assert.equal(result.data.groupRankings[0].rankings[0].wins, 1);
});

test("ranking head-to-head breaks tie", () => {
  const matches = [
    {
      id: "m1",
      groupId: "g1",
      entryAId: "a",
      entryBId: "b",
      status: MATCH_STATUS.COMPLETED,
      scoreA: 11,
      scoreB: 9,
      winnerId: "a",
    },
  ];
  assert.equal(headToHeadResult("a", "b", matches), -1);
});

test("tournament time prediction warns when exceeding window", () => {
  const matches = Array.from({ length: 20 }, (_, i) => ({
    id: `m${i}`,
    entryAId: "a",
    entryBId: "b",
    stage: "group",
  }));
  const result = predictTournamentTime({
    matches,
    courts: [{ id: "c1" }],
    scheduleConfig: { startTime: "08:00", endTime: "09:00" },
  });
  assert.ok(result.warnings.length > 0);
});
