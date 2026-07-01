import test from "node:test";
import assert from "node:assert/strict";

import { EVENT_TYPE } from "../src/models/tournament/index.js";
import { createTournamentRecord } from "../src/models/tournament/tournament.js";
import { buildEngineContext } from "../src/features/tournament-engine/services/tournamentEngineAdapter.js";
import { buildSeedSuggestion } from "../src/features/ai-assistant/engines/seedSuggestion.js";
import { buildGroupSuggestion } from "../src/features/ai-assistant/engines/groupSuggestion.js";
import { buildPairingSuggestion } from "../src/features/ai-assistant/engines/pairingSuggestion.js";
import { buildTimePrediction } from "../src/features/ai-assistant/engines/timePrediction.js";
import { validateSchedule } from "../src/features/ai-assistant/engines/scheduleValidator.js";
import { buildRuleSuggestions } from "../src/features/ai-assistant/engines/ruleSuggestion.js";
import {
  GROUP_SUGGESTION_MODE,
  PAIRING_STRATEGY,
  isAiEngineEnabled,
} from "../src/features/ai-assistant/constants/aiConfig.js";
import { guardAiAccess } from "../src/features/ai-assistant/guards/aiAccessGuard.js";
import {
  saveSuggestion,
  getSuggestionById,
  clearTournamentSuggestions,
  getChecklistProgress,
  setChecklistState,
} from "../src/features/ai-assistant/services/aiSuggestionStorage.js";
import {
  generateSeedSuggestion,
  dismissAiSuggestion,
  getAiTournamentSummary,
} from "../src/features/ai-assistant/services/aiEngineService.js";
import { setAiProvider } from "../src/features/ai-assistant/providers/aiProvider.js";
import { loadClubData, saveClubData } from "../src/domain/clubStorage.js";
import { setActiveClubId, DEFAULT_CLUB } from "../src/data/club.js";

function createLocalStorageMock(seed = {}) {
  const store = new Map(Object.entries(seed));
  return {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(key, String(value));
    },
    removeItem(key) {
      store.delete(key);
    },
    clear() {
      store.clear();
    },
  };
}

function malePlayers(count, withElo = true) {
  return Array.from({ length: count }, (_, i) => ({
    id: `p-m-${i + 1}`,
    name: `Nam ${i + 1}`,
    gender: "Nam",
    rating: 4.5 - i * 0.1,
    level: 4.5 - i * 0.1,
    elo: withElo ? 1200 - i * 30 : null,
    stats: { matchesPlayed: withElo ? 10 : 0, wins: 5 },
    status: "active",
  }));
}

function femalePlayers(count) {
  return Array.from({ length: count }, (_, i) => ({
    id: `p-f-${i + 1}`,
    name: `Nữ ${i + 1}`,
    gender: "Nữ",
    rating: 4 - i * 0.1,
    elo: 1100 - i * 25,
    stats: { matchesPlayed: 8, wins: 4 },
    status: "active",
  }));
}

function buildTournament(clubId, tenantId, players) {
  const tournament = createTournamentRecord(clubId, {
    name: "AI Test",
    mode: "internal_tournament",
    tenantId,
    events: [
      {
        id: "ev-1",
        eventType: EVENT_TYPE.MEN_DOUBLE,
        entries: players.slice(0, 8).map((p, i) => ({
          id: `entry-${p.id}`,
          name: p.name,
          playerIds: [p.id],
          rating: p.rating,
          status: "active",
          seed: i + 1,
        })),
        groups: [],
        matches: [],
      },
    ],
    settings: { engineV4: { groupCount: 2 } },
    courtSchedule: { startTime: "08:00", endTime: "12:00" },
  });
  return tournament;
}

function mockContext(tournament, players, courts = [{ id: "c1" }, { id: "c2" }]) {
  return buildEngineContext({ tournament, players, courts });
}

test("isAiEngineEnabled defaults to false", () => {
  assert.equal(isAiEngineEnabled(), false);
});

test("seed suggestion with full ELO produces unique seeds", () => {
  const players = malePlayers(8);
  const ctx = mockContext(buildTournament("club-1", "tenant-a", players), players);
  const result = buildSeedSuggestion(ctx);
  assert.equal(result.ok, true);
  const ranks = result.data.seeds.map((s) => s.seedRank);
  assert.equal(new Set(ranks).size, ranks.length);
  assert.ok(result.data.seeds[0].aiScore >= result.data.seeds[1].aiScore);
});

test("seed suggestion without ELO marks unknown players", () => {
  const players = malePlayers(6, false).map((p) => ({
    ...p,
    rating: undefined,
    level: undefined,
  }));
  const ctx = mockContext(buildTournament("club-1", "tenant-a", players), players);
  const result = buildSeedSuggestion(ctx);
  assert.equal(result.ok, true);
  assert.ok(result.data.unknownCount > 0 || result.warnings.length > 0);
  assert.ok(result.warnings.some((w) => w.includes("chưa có lịch sử") || w.includes("thiếu")));
});

test("group suggestion competitive balanced avoids dumping seeds", () => {
  const players = malePlayers(8);
  const tournament = buildTournament("club-1", "tenant-a", players);
  const ctx = { ...mockContext(tournament, players), groupCount: 2 };
  const result = buildGroupSuggestion(ctx, GROUP_SUGGESTION_MODE.COMPETITIVE_BALANCED);
  assert.equal(result.ok, true);
  assert.equal(result.data.groups.length, 2);
  const sizes = result.data.groups.map((g) => g.teamIds.length);
  assert.ok(Math.max(...sizes) - Math.min(...sizes) <= 1);
});

test("light random group mode still produces valid groups", () => {
  const players = malePlayers(8);
  const ctx = { ...mockContext(buildTournament("club-1", "tenant-a", players), players), groupCount: 2 };
  const a = buildGroupSuggestion(ctx, GROUP_SUGGESTION_MODE.LIGHT_RANDOM);
  const b = buildGroupSuggestion(
    { ...ctx, scheduleConfig: { ...ctx.scheduleConfig, randomSeed: 99 } },
    GROUP_SUGGESTION_MODE.LIGHT_RANDOM
  );
  assert.equal(a.ok, true);
  assert.equal(b.ok, true);
  assert.equal(a.data.groups.length, 2);
});

test("pairing mixed gender pairs correctly", () => {
  const players = [...malePlayers(4), ...femalePlayers(4)];
  const result = buildPairingSuggestion(
    { players, eventType: EVENT_TYPE.MIXED_DOUBLE },
    PAIRING_STRATEGY.MIXED_GENDER
  );
  assert.equal(result.ok, true);
  assert.equal(result.data.teams.length, 4);
  result.data.teams.forEach((team) => {
    assert.equal(team.playerIds.length, 2);
    assert.equal(new Set(team.playerIds).size, 2);
  });
});

test("pairing warns on gender imbalance", () => {
  const players = [...malePlayers(5), ...femalePlayers(2)];
  const result = buildPairingSuggestion(
    { players, eventType: EVENT_TYPE.MIXED_DOUBLE },
    PAIRING_STRATEGY.MIXED_GENDER
  );
  assert.ok(result.warnings.some((w) => w.includes("không cân bằng")));
});

test("pairing balanced teams have reasonable fairness", () => {
  const players = malePlayers(8);
  const result = buildPairingSuggestion(
    { players, eventType: EVENT_TYPE.MEN_DOUBLE },
    PAIRING_STRATEGY.BALANCED
  );
  assert.equal(result.ok, true);
  assert.equal(result.data.teams.length, 4);
  assert.ok(result.data.fairnessScore >= 40);
});

test("time prediction counts matches and respects courts", () => {
  const players = malePlayers(8);
  const ctx = {
    ...mockContext(buildTournament("club-1", "tenant-a", players), players),
    groupCount: 2,
    scheduleConfig: { startTime: "08:00", endTime: "10:00", pointsToWin: 11 },
  };
  const twoCourts = buildTimePrediction(ctx);
  const fourCourts = buildTimePrediction({
    ...ctx,
    courts: [{ id: "c1" }, { id: "c2" }, { id: "c3" }, { id: "c4" }],
  });
  assert.equal(twoCourts.ok, true);
  assert.equal(fourCourts.ok, true);
  assert.ok(twoCourts.data.totalMatches > 0);
  assert.ok(
    fourCourts.data.reasonableTotalMinutes <= twoCourts.data.reasonableTotalMinutes
  );
});

test("time prediction warns when exceeding court rental window", () => {
  const players = malePlayers(16);
  const ctx = {
    ...mockContext(buildTournament("club-1", "tenant-a", players), players, [{ id: "c1" }]),
    groupCount: 4,
    scheduleConfig: { startTime: "08:00", endTime: "09:00" },
  };
  const result = buildTimePrediction(ctx);
  assert.equal(result.ok, true);
  assert.ok(result.warnings.length > 0 || result.data.reasonableTotalMinutes > 60);
});

test("schedule validator detects team and court conflicts", () => {
  const matches = [
    { id: "m1", entryAId: "t1", entryBId: "t2", courtId: "1", scheduledStart: "08:00", durationMinutes: 25 },
    { id: "m2", entryAId: "t1", entryBId: "t3", courtId: "1", scheduledStart: "08:10", durationMinutes: 25 },
    { id: "m3", entryAId: "t4", entryBId: "t5", courtId: "2", scheduledStart: "08:00", durationMinutes: 25 },
  ];
  const result = validateSchedule({
    matches,
    scheduleConfig: { startTime: "08:00", endTime: "22:00", bufferMinutes: 10 },
    courts: [{ id: "1" }, { id: "2" }],
  });
  assert.equal(result.ok, true);
  assert.ok(result.data.issues.some((i) => i.type === "team_conflict"));
  assert.ok(result.data.issues.some((i) => i.type === "court_conflict"));
});

test("schedule validator detects short rest and late finish", () => {
  const matches = [
    { id: "m1", entryAId: "t1", entryBId: "t2", courtId: "1", scheduledStart: "08:00", durationMinutes: 25 },
    { id: "m2", entryAId: "t1", entryBId: "t3", courtId: "2", scheduledStart: "08:20", durationMinutes: 25 },
    { id: "m3", entryAId: "t4", entryBId: "t5", courtId: "1", scheduledStart: "09:30", durationMinutes: 40 },
  ];
  const result = validateSchedule({
    matches,
    scheduleConfig: { startTime: "08:00", endTime: "09:00", bufferMinutes: 15 },
    courts: [{ id: "1" }, { id: "2" }],
  });
  assert.ok(result.data.issues.some((i) => i.type === "short_rest" || i.type === "late_finish"));
});

test("rule suggestions recommend shorter format when tournament too long", () => {
  const players = malePlayers(32);
  const ctx = {
    ...mockContext(buildTournament("club-1", "tenant-a", players), players, [{ id: "c1" }]),
    groupCount: 4,
    scheduleConfig: { startTime: "08:00", endTime: "10:00", bestOf: 3, pointsToWin: 15 },
    participants: players.map((p) => ({
      id: p.id,
      name: p.name,
      elo: p.elo,
      skillLevel: p.rating,
      matchesPlayed: 10,
    })),
  };
  const result = buildRuleSuggestions(ctx);
  assert.equal(result.ok, true);
  assert.ok(result.data.suggestions.length > 0);
  assert.ok(
    result.data.suggestions.some(
      (s) => s.title.includes("điểm") || s.title.includes("sân") || s.title.includes("bảng")
    )
  );
});

test("suggestion storage isolates tenant", () => {
  globalThis.localStorage = createLocalStorageMock();
  clearTournamentSuggestions("t-1", "tenant-a");
  const record = saveSuggestion({
    tenantId: "tenant-a",
    tournamentId: "t-1",
    type: "seed",
    outputPayload: { seeds: [] },
    confidence: "high",
    createdBy: "u1",
  });
  assert.ok(getSuggestionById(record.id, "tenant-a"));
  assert.equal(getSuggestionById(record.id, "tenant-b"), null);
  clearTournamentSuggestions("t-1", "tenant-a");
});

test("guardAiAccess blocks cross-tenant tournament", () => {
  globalThis.localStorage = createLocalStorageMock();
  setActiveClubId(DEFAULT_CLUB.id);
  const players = malePlayers(4);
  const tournament = buildTournament(DEFAULT_CLUB.id, "tenant-a", players);
  const data = loadClubData(DEFAULT_CLUB.id);
  data.tournaments = [tournament];
  saveClubData(DEFAULT_CLUB.id, data);

  const guard = guardAiAccess({
    clubId: DEFAULT_CLUB.id,
    tournamentId: tournament.id,
    tenantId: "tenant-b",
  });
  assert.equal(guard.ok, false);
  assert.ok(guard.error);
});

test("generateSeedSuggestion returns suggestion id", () => {
  globalThis.localStorage = createLocalStorageMock();
  setActiveClubId(DEFAULT_CLUB.id);
  const players = malePlayers(8);
  const tournament = buildTournament(DEFAULT_CLUB.id, "tenant-a", players);
  const data = loadClubData(DEFAULT_CLUB.id);
  data.tournaments = [tournament];
  saveClubData(DEFAULT_CLUB.id, data);

  const result = generateSeedSuggestion(tournament.id, "tenant-a", {
    clubId: DEFAULT_CLUB.id,
    players,
    courts: [{ id: "c1" }],
  });
  assert.equal(result.ok, true);
  assert.ok(result.suggestionId);
  assert.ok(result.data.seeds.length > 0);
  clearTournamentSuggestions(tournament.id, "tenant-a");
});

test("dismiss suggestion updates status", async () => {
  globalThis.localStorage = createLocalStorageMock();
  setActiveClubId(DEFAULT_CLUB.id);
  const players = malePlayers(4);
  const tournament = buildTournament(DEFAULT_CLUB.id, "tenant-a", players);
  const data = loadClubData(DEFAULT_CLUB.id);
  data.tournaments = [tournament];
  saveClubData(DEFAULT_CLUB.id, data);

  const record = saveSuggestion({
    tenantId: "tenant-a",
    tournamentId: tournament.id,
    type: "seed",
    outputPayload: {},
    confidence: "medium",
    createdBy: "u1",
  });
  const result = await dismissAiSuggestion(record.id, "tenant-a", "u1", {
    clubId: DEFAULT_CLUB.id,
    tournamentId: tournament.id,
  });
  assert.equal(result.ok, true);
  const updated = getSuggestionById(record.id, "tenant-a");
  assert.equal(updated.status, "dismissed");
  clearTournamentSuggestions(tournament.id, "tenant-a");
});

test("getAiTournamentSummary returns human-readable explainability", async () => {
  globalThis.localStorage = createLocalStorageMock();
  setActiveClubId(DEFAULT_CLUB.id);
  const players = malePlayers(8);
  const tournament = buildTournament(DEFAULT_CLUB.id, "tenant-a", players);
  const data = loadClubData(DEFAULT_CLUB.id);
  data.tournaments = [tournament];
  saveClubData(DEFAULT_CLUB.id, data);

  const result = await getAiTournamentSummary(tournament.id, "tenant-a", {
    clubId: DEFAULT_CLUB.id,
    players,
    courts: [{ id: "c1" }],
  });

  assert.equal(result.ok, true);
  assert.ok(result.summary.explanation);
  assert.match(result.summary.explanation, /cân bằng|thời gian|lịch/i);
});

test("getAiTournamentSummary uses provider explanation when available", async () => {
  globalThis.localStorage = createLocalStorageMock();
  setActiveClubId(DEFAULT_CLUB.id);
  const players = malePlayers(8);
  const tournament = buildTournament(DEFAULT_CLUB.id, "tenant-a", players);
  const data = loadClubData(DEFAULT_CLUB.id);
  data.tournaments = [tournament];
  saveClubData(DEFAULT_CLUB.id, data);

  setAiProvider({
    explain: async ({ module, data: payload }) => ({
      text: `${module}:${payload.scope}:${payload.score}`,
      confidence: 0.95,
    }),
  });

  const result = await getAiTournamentSummary(tournament.id, "tenant-a", {
    clubId: DEFAULT_CLUB.id,
    players,
    courts: [{ id: "c1" }],
  });

  assert.equal(result.ok, true);
  assert.match(result.summary.explanation, /summary:tenant-a:/i);
  setAiProvider(null);
});

test("getAiTournamentSummary returns actionable next steps", async () => {
  globalThis.localStorage = createLocalStorageMock();
  setActiveClubId(DEFAULT_CLUB.id);
  const players = malePlayers(8);
  const tournament = buildTournament(DEFAULT_CLUB.id, "tenant-a", players);
  const data = loadClubData(DEFAULT_CLUB.id);
  data.tournaments = [tournament];
  saveClubData(DEFAULT_CLUB.id, data);

  const result = await getAiTournamentSummary(tournament.id, "tenant-a", {
    clubId: DEFAULT_CLUB.id,
    players,
    courts: [{ id: "c1" }],
  });

  assert.equal(result.ok, true);
  assert.ok(Array.isArray(result.summary.nextActions));
  assert.ok(result.summary.nextActions.length > 0);
  assert.ok(result.summary.nextActions.some((action) => /cân bằng|thời gian|lịch|dữ liệu/i.test(action)));
});

test("getAiTournamentSummary returns workflow checklist", async () => {
  globalThis.localStorage = createLocalStorageMock();
  setActiveClubId(DEFAULT_CLUB.id);
  const players = malePlayers(8);
  const tournament = buildTournament(DEFAULT_CLUB.id, "tenant-a", players);
  const data = loadClubData(DEFAULT_CLUB.id);
  data.tournaments = [tournament];
  saveClubData(DEFAULT_CLUB.id, data);

  const result = await getAiTournamentSummary(tournament.id, "tenant-a", {
    clubId: DEFAULT_CLUB.id,
    players,
    courts: [{ id: "c1" }],
  });

  assert.equal(result.ok, true);
  assert.ok(Array.isArray(result.summary.workflowChecklist));
  assert.ok(result.summary.workflowChecklist.length > 0);
  assert.ok(result.summary.workflowChecklist.some((item) => item.title.includes("Dữ liệu") || item.title.includes("Lịch") || item.title.includes("Bắt đầu")));
});

test("workflow checklist highlights the next recommended item", async () => {
  globalThis.localStorage = createLocalStorageMock();
  setActiveClubId(DEFAULT_CLUB.id);
  const players = malePlayers(6).map((player) => ({ ...player, elo: null, skillLevel: null }));
  const tournament = buildTournament(DEFAULT_CLUB.id, "tenant-a", players);
  const data = loadClubData(DEFAULT_CLUB.id);
  data.tournaments = [tournament];
  saveClubData(DEFAULT_CLUB.id, data);

  const result = await getAiTournamentSummary(tournament.id, "tenant-a", {
    clubId: DEFAULT_CLUB.id,
    players,
    courts: [{ id: "c1" }],
  });

  assert.equal(result.ok, true);
  const recommended = result.summary.workflowChecklist.find((item) => item.recommended);
  assert.ok(recommended);
  assert.match(recommended.title, /Dữ liệu|Lịch|Bắt đầu|Sau mỗi vòng/i);
});

test("workflow checklist auto-completes from real tournament state", async () => {
  globalThis.localStorage = createLocalStorageMock();
  setActiveClubId(DEFAULT_CLUB.id);
  const players = malePlayers(8);
  const tournament = buildTournament(DEFAULT_CLUB.id, "tenant-a", players);
  tournament.events[0].matches = [{ id: "m1", status: "completed" }];
  tournament.courtSchedule = { startTime: "08:00", endTime: "12:00" };
  const data = loadClubData(DEFAULT_CLUB.id);
  data.tournaments = [tournament];
  saveClubData(DEFAULT_CLUB.id, data);

  const result = await getAiTournamentSummary(tournament.id, "tenant-a", {
    clubId: DEFAULT_CLUB.id,
    players,
    courts: [{ id: "c1" }],
  });

  assert.equal(result.ok, true);
  const playerDataItem = result.summary.workflowChecklist.find((item) => item.title === "Dữ liệu người chơi");
  const startItem = result.summary.workflowChecklist.find((item) => item.title === "Bắt đầu giải");
  assert.equal(playerDataItem.completed, true);
  assert.equal(startItem.completed, true);
});

test("workflow checklist exposes priority for urgent items", async () => {
  globalThis.localStorage = createLocalStorageMock();
  setActiveClubId(DEFAULT_CLUB.id);
  const players = malePlayers(8, false);
  const tournament = buildTournament(DEFAULT_CLUB.id, "tenant-a", players);
  const data = loadClubData(DEFAULT_CLUB.id);
  data.tournaments = [tournament];
  saveClubData(DEFAULT_CLUB.id, data);

  const result = await getAiTournamentSummary(tournament.id, "tenant-a", {
    clubId: DEFAULT_CLUB.id,
    players,
    courts: [{ id: "c1" }],
  });

  assert.equal(result.ok, true);
  const dataItem = result.summary.workflowChecklist.find((item) => item.title === "Dữ liệu người chơi");
  assert.ok(dataItem);
  assert.equal(dataItem.priority, "high");
});

test("getAiTournamentSummary uses tournament lifecycle status for review phase", async () => {
  globalThis.localStorage = createLocalStorageMock();
  setActiveClubId(DEFAULT_CLUB.id);
  const players = malePlayers(8);
  const tournament = buildTournament(DEFAULT_CLUB.id, "tenant-a", players);
  tournament.status = "completed";
  tournament.events[0].status = "completed";
  const data = loadClubData(DEFAULT_CLUB.id);
  data.tournaments = [tournament];
  saveClubData(DEFAULT_CLUB.id, data);

  const result = await getAiTournamentSummary(tournament.id, "tenant-a", {
    clubId: DEFAULT_CLUB.id,
    players,
    courts: [{ id: "c1" }],
  });

  assert.equal(result.ok, true);
  assert.equal(result.summary.phase, "review");
  assert.match(result.summary.phaseLabel, /xem lại|kết thúc/i);
});

test("getAiTournamentSummary exposes live phase guidance", async () => {
  globalThis.localStorage = createLocalStorageMock();
  setActiveClubId(DEFAULT_CLUB.id);
  const players = malePlayers(8);
  const tournament = buildTournament(DEFAULT_CLUB.id, "tenant-a", players);
  tournament.events[0].status = "in_progress";
  tournament.events[0].matches = [{ id: "m1", status: "in_progress" }];
  const data = loadClubData(DEFAULT_CLUB.id);
  data.tournaments = [tournament];
  saveClubData(DEFAULT_CLUB.id, data);

  const result = await getAiTournamentSummary(tournament.id, "tenant-a", {
    clubId: DEFAULT_CLUB.id,
    players,
    courts: [{ id: "c1" }],
  });

  assert.equal(result.ok, true);
  assert.equal(result.summary.phase, "live");
  assert.match(result.summary.phaseLabel, /Đang diễn ra|Đang chạy/i);
  assert.match(result.summary.phaseHint, /trận|tiến độ/i);
});

test("getAiTournamentSummary exposes real match progress", async () => {
  globalThis.localStorage = createLocalStorageMock();
  setActiveClubId(DEFAULT_CLUB.id);
  const players = malePlayers(8);
  const tournament = buildTournament(DEFAULT_CLUB.id, "tenant-a", players);
  tournament.events[0].matches = [
    { id: "m1", status: "completed" },
    { id: "m2", status: "in_progress" },
  ];
  const data = loadClubData(DEFAULT_CLUB.id);
  data.tournaments = [tournament];
  saveClubData(DEFAULT_CLUB.id, data);

  const result = await getAiTournamentSummary(tournament.id, "tenant-a", {
    clubId: DEFAULT_CLUB.id,
    players,
    courts: [{ id: "c1" }],
  });

  assert.equal(result.ok, true);
  assert.equal(result.summary.matchProgress.totalMatches, 2);
  assert.equal(result.summary.matchProgress.completedMatches, 1);
  assert.equal(result.summary.matchProgress.activeMatches, 1);
  assert.equal(result.summary.matchProgress.percent, 50);
  assert.match(result.summary.matchProgress.label, /1\/2/i);
});

test("checklist progress reports completion percentage", () => {
  globalThis.localStorage = createLocalStorageMock();
  setChecklistState("Xác nhận sân", true);

  const progress = getChecklistProgress([
    { title: "Xác nhận sân" },
    { title: "Gửi thư mời" },
    { title: "Đăng lịch thi đấu" },
  ]);

  assert.equal(progress.total, 3);
  assert.equal(progress.completed, 1);
  assert.equal(progress.percent, 33);
  assert.equal(progress.isComplete, false);
});
