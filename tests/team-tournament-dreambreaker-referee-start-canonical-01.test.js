/**
 * TEAM-TOURNAMENT-PR412-DREAMBREAKER-REFEREE-START-CANONICAL-REMEDIATION-01
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

import {
  DREAMBREAKER_STATUS,
  FORMAT_PRESET,
  SUB_MATCH_STATUS,
} from "../src/features/team-tournament/constants.js";
import {
  buildCaptainDreambreakerSubmitCommand,
  listExposedDreambreakerAthleteIds,
  projectCaptainPortalMatchupDreambreaker,
  resolveDreambreakerExpectedVersion,
} from "../src/features/team-tournament/engines/captainDreambreakerPortalContract.js";
import {
  buildRefereeDreambreakerStartCommand,
  startDreambreaker,
  submitDreambreakerOrder,
} from "../src/features/team-tournament/engines/dreambreakerEngine.js";
import { computeMatchupResult } from "../src/features/team-tournament/engines/teamResultEngine.js";
import {
  CANONICAL_DREAMBREAKER_DISCIPLINE_ID,
  createMlpDisciplines,
  createMlpPreset,
  ensureCanonicalMlpDisciplines,
  ensureCanonicalMlpTeamData,
  getDreambreakerDiscipline,
  planCanonicalMlpDreambreakerPersist,
} from "../src/features/team-tournament/engines/mlpPresetEngine.js";
import { initializeTeamTournamentData } from "../src/features/team-tournament/engines/teamTournamentEngine.js";
import { createTeamRecord, normalizeTeamData } from "../src/features/team-tournament/models/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const pkgDir = "docs/v5/migrations/team-tournament-dreambreaker-referee-start-canonical-01";

function readSrc(rel) {
  return readFileSync(join(root, rel), "utf8");
}

function buildReadyMatchup({ includeDreambreakerDiscipline = true, onlyOneOrder = false, noOrders = false } = {}) {
  const preset = createMlpPreset();
  const teamA = createTeamRecord({ id: "team-a", playerIds: ["m1", "m2", "f1", "f2"] });
  const teamB = createTeamRecord({ id: "team-b", playerIds: ["m3", "m4", "f3", "f4"] });
  const disciplines = includeDreambreakerDiscipline
    ? preset.disciplines
    : preset.disciplines.filter((item) => item.activationRule === "always");
  const mainDisciplines = disciplines.filter((item) => item.activationRule === "always");
  const subMatches = mainDisciplines.map((discipline, index) => ({
    id: `sub-${index}`,
    disciplineId: discipline.id,
    sortOrder: discipline.sortOrder,
    status: SUB_MATCH_STATUS.COMPLETED,
    score: { teamA: index < 2 ? 21 : 6, teamB: index < 2 ? 6 : 21, games: [] },
    winnerTeamId: index < 2 ? "team-a" : "team-b",
  }));

  let teamData = normalizeTeamData({
    ...preset,
    disciplines,
    teams: [teamA, teamB],
    matchups: [
      {
        id: "matchup-1",
        teamAId: "team-a",
        teamBId: "team-b",
        status: "in_progress",
        subMatches,
      },
    ],
  });
  teamData = computeMatchupResult(teamData, "matchup-1").teamData;

  if (!noOrders) {
    teamData = submitDreambreakerOrder(teamData, {
      matchupId: "matchup-1",
      teamId: "team-a",
      order: ["m1", "m2", "f1", "f2"],
    }).teamData;
    if (!onlyOneOrder) {
      teamData = submitDreambreakerOrder(teamData, {
        matchupId: "matchup-1",
        teamId: "team-b",
        order: ["m3", "m4", "f3", "f4"],
      }).teamData;
    }
  }

  teamData = {
    ...teamData,
    matchups: teamData.matchups.map((matchup) => ({
      ...matchup,
      dreambreaker: matchup.dreambreaker
        ? { ...matchup.dreambreaker, version: 3 }
        : matchup.dreambreaker,
    })),
  };
  return normalizeTeamData(teamData);
}

test("A READY + both orders + no Dreambreaker catalog row → start succeeds", () => {
  const teamData = buildReadyMatchup({ includeDreambreakerDiscipline: false });
  assert.equal(getDreambreakerDiscipline(teamData.disciplines), null);
  assert.equal(teamData.matchups[0].dreambreaker.status, DREAMBREAKER_STATUS.READY);

  const started = startDreambreaker(teamData, "matchup-1", { expectedVersion: 3 });
  assert.equal(started.ok, true);
  assert.equal(started.teamData.matchups[0].dreambreaker.status, DREAMBREAKER_STATUS.IN_PROGRESS);
  const dbSub = started.teamData.matchups[0].subMatches.find(
    (item) => item.disciplineId === CANONICAL_DREAMBREAKER_DISCIPLINE_ID
  );
  assert.ok(dbSub, "synthetic dreambreaker submatch");
});

test("B READY + fifth discipline tie_at_2_2 → start uses persisted discipline", () => {
  const teamData = buildReadyMatchup({ includeDreambreakerDiscipline: true });
  const catalog = getDreambreakerDiscipline(teamData.disciplines);
  assert.ok(catalog);
  assert.equal(catalog.activationRule, "tie_at_2_2");

  const started = startDreambreaker(teamData, "matchup-1", { expectedVersion: 3 });
  assert.equal(started.ok, true);
  const dbSub = started.teamData.matchups[0].subMatches.find(
    (item) => item.disciplineId === catalog.id
  );
  assert.ok(dbSub);
});

test("C READY + legacy Dreambreaker naming remains valid", () => {
  let teamData = buildReadyMatchup({ includeDreambreakerDiscipline: false });
  teamData = {
    ...teamData,
    disciplines: [
      ...teamData.disciplines,
      {
        id: "legacy-db",
        name: "DreamBreaker Final",
        disciplineKind: "doubles",
        activationRule: "always",
        sortOrder: 9,
      },
    ],
  };
  const catalog = getDreambreakerDiscipline(teamData.disciplines);
  assert.equal(catalog.id, "legacy-db");
  const started = startDreambreaker(teamData, "matchup-1", { expectedVersion: 3 });
  assert.equal(started.ok, true);
  assert.ok(
    started.teamData.matchups[0].subMatches.some((item) => item.disciplineId === "legacy-db")
  );
});

test("D only one captain order → start rejected", () => {
  const teamData = buildReadyMatchup({ onlyOneOrder: true });
  const started = startDreambreaker(teamData, "matchup-1", { expectedVersion: 3 });
  assert.equal(started.ok, false);
  assert.match(started.error, /thứ tự 4 VĐV/);
});

test("E no orders → start rejected", () => {
  const teamData = buildReadyMatchup({ noOrders: true });
  const started = startDreambreaker(teamData, "matchup-1", { expectedVersion: 3 });
  assert.equal(started.ok, false);
});

test("F stale dreambreaker.version → conflict + zero write", () => {
  const teamData = buildReadyMatchup();
  const before = JSON.stringify(teamData.matchups[0].dreambreaker);
  const started = startDreambreaker(teamData, "matchup-1", { expectedVersion: 2 });
  assert.equal(started.ok, false);
  assert.equal(started.code, "VERSION_CONFLICT");
  assert.equal(JSON.stringify(teamData.matchups[0].dreambreaker), before);
});

test("G successful start bumps version exactly once", () => {
  const teamData = buildReadyMatchup();
  const started = startDreambreaker(teamData, "matchup-1", { expectedVersion: 3 });
  assert.equal(started.ok, true);
  assert.equal(started.teamData.matchups[0].dreambreaker.version, 4);
});

test("H second start does not duplicate Dreambreaker submatch", () => {
  const first = startDreambreaker(buildReadyMatchup(), "matchup-1", { expectedVersion: 3 });
  assert.equal(first.ok, true);
  const countAfterFirst = first.teamData.matchups[0].subMatches.filter(
    (item) => item.disciplineId === CANONICAL_DREAMBREAKER_DISCIPLINE_ID
      || getDreambreakerDiscipline(first.teamData.disciplines)?.id === item.disciplineId
  ).length;
  const second = startDreambreaker(first.teamData, "matchup-1", {
    expectedVersion: first.teamData.matchups[0].dreambreaker.version,
  });
  assert.equal(second.ok, true);
  const countAfterSecond = second.teamData.matchups[0].subMatches.filter(
    (item) => item.id === first.teamData.matchups[0].dreambreaker.subMatchId
  ).length;
  assert.equal(countAfterFirst, 1);
  assert.equal(countAfterSecond, 1);
  assert.equal(
    second.teamData.matchups[0].subMatches.filter((item) =>
      String(item.disciplineId || "").includes("dreambreaker")
      || item.id === first.teamData.matchups[0].dreambreaker.subMatchId
    ).length,
    1
  );
});

test("I future MLP setup persists exactly five disciplines including Dreambreaker", () => {
  const created = initializeTeamTournamentData({ formatPreset: FORMAT_PRESET.MLP_4 });
  assert.equal(created.disciplines.length, 5);
  const dream = getDreambreakerDiscipline(created.disciplines);
  assert.ok(dream);
  assert.equal(dream.id, CANONICAL_DREAMBREAKER_DISCIPLINE_ID);
  assert.equal(dream.disciplineKind, "dreambreaker");
  assert.equal(dream.activationRule, "tie_at_2_2");
  assert.equal(createMlpDisciplines().length, 5);
});

test("J Dreambreaker discipline is not duplicated on save/reload/re-save", () => {
  const first = ensureCanonicalMlpTeamData(
    initializeTeamTournamentData({ formatPreset: FORMAT_PRESET.MLP_4 })
  );
  const second = ensureCanonicalMlpTeamData(first);
  const third = ensureCanonicalMlpDisciplines(second.disciplines, second);
  assert.equal(first.disciplines.filter((item) => item.id === CANONICAL_DREAMBREAKER_DISCIPLINE_ID).length, 1);
  assert.equal(second.disciplines.length, first.disciplines.length);
  assert.equal(third.length, second.disciplines.length);
  const plan = planCanonicalMlpDreambreakerPersist({ previous: first, next: second });
  assert.equal(plan.persistDreambreakerFirst, false);
});

test("K captain reader still hides opponent athlete order", () => {
  const apply = readSrc(
    "docs/v5/migrations/team-tournament-captain-dreambreaker-reader-01/02_APPLY.sql"
  );
  assert.match(apply, /'ownOrder'/);
  assert.match(apply, /'opponentOrderSubmitted'/);
  assert.doesNotMatch(apply, /'teamAOrder'/);
  assert.doesNotMatch(apply, /'teamBOrder'/);

  const projected = projectCaptainPortalMatchupDreambreaker(
    {
      id: "matchup-1",
      teamAId: "team-a",
      teamBId: "team-b",
      dreambreaker: {
        status: DREAMBREAKER_STATUS.READY,
        ownOrder: ["m1", "m2", "f1", "f2"],
        opponentOrderSubmitted: true,
        teamAOrder: ["m1", "m2", "f1", "f2"],
        teamBOrder: ["m3", "m4", "f3", "f4"],
      },
    },
    "team-a"
  );
  const exposed = listExposedDreambreakerAthleteIds(
    projected.dreambreaker,
    "team-a",
    projected
  );
  assert.deepEqual(exposed, []);
  assert.deepEqual(projected.dreambreaker.ownOrder, ["m1", "m2", "f1", "f2"]);
  assert.equal(projected.dreambreaker.opponentOrderSubmitted, true);
});

test("L existing captain submit command remains PASS", () => {
  const command = buildCaptainDreambreakerSubmitCommand({
    matchup: {
      id: "matchup-1",
      teamAId: "team-a",
      teamBId: "team-b",
      dreambreaker: { status: DREAMBREAKER_STATUS.LINEUP_OPEN, version: 7 },
    },
    teamId: "team-a",
    viewerTeamId: "team-a",
    order: ["m1", "m2", "f1", "f2"],
    rosterIds: ["m1", "m2", "f1", "f2"],
  });
  assert.equal(command.ok, true);
  assert.equal(command.payload.expectedVersion, 7);
  assert.deepEqual(command.payload.order, ["m1", "m2", "f1", "f2"]);
});

test("M referee normal submatch scoring remains unchanged", () => {
  const refereeEngine = readSrc("src/features/team-tournament/engines/teamRefereeEngine.js");
  assert.match(refereeEngine, /export function saveSubMatchDraft/);
  assert.match(refereeEngine, /export function confirmSubMatchResult/);
  assert.match(refereeEngine, /export function validateSubMatchScoreInput/);
  const apply = readSrc(`${pkgDir}/02_APPLY.sql`);
  assert.doesNotMatch(apply, /team_tournament_save_sub_match/);
  assert.doesNotMatch(apply, /team_tournament_confirm_sub_match/);
});

test("client start expectedVersion source is matchup.dreambreaker.version", () => {
  const matchup = {
    id: "matchup-ilj0220c",
    dreambreaker: { status: DREAMBREAKER_STATUS.READY, version: 3 },
  };
  assert.equal(resolveDreambreakerExpectedVersion(matchup), 3);
  const command = buildRefereeDreambreakerStartCommand(matchup);
  assert.equal(command.ok, true);
  assert.equal(command.payload.expectedVersion, 3);
  assert.equal(command.payload.matchupId, "matchup-ilj0220c");

  const portal = readSrc("src/pages/tournament/TeamRefereePortal.jsx");
  assert.match(portal, /buildRefereeDreambreakerStartCommand/);
  assert.match(portal, /expectedVersion: command\.payload\.expectedVersion/);

  const service = readSrc("src/features/team-tournament/services/teamTournamentService.js");
  assert.match(service, /cloudStartDreambreaker\(tournamentId, \{ matchupId, expectedVersion \}\)/);

  const cloud = readSrc("src/features/team-tournament/services/dreambreakerCloudCommands.js");
  assert.match(cloud, /db-start:\$\{tournamentId\}:\$\{payload\.matchupId\}/);
});

test("SQL package contracts are locked in APPLY", () => {
  const files = ["01_PRECHECK.sql", "02_APPLY.sql", "03_VERIFY.sql", "04_ROLLBACK.sql", "README.md"];
  for (const name of files) {
    assert.ok(readSrc(`${pkgDir}/${name}`).length > 0, name);
  }
  const apply = readSrc(`${pkgDir}/02_APPLY.sql`);
  assert.match(apply, /TIE_AT_2_2_MATCHER_SUPPORTED/);
  assert.match(apply, /READY_STATE_CAN_START_WITHOUT_CATALOG_ROW/);
  assert.match(apply, /SYNTHETIC_DREAMBREAKER_DISCIPLINE/);
  assert.match(apply, /START_USES_PERSISTED_ORDERS/);
  assert.match(apply, /DREAMBREAKER_CAS_BEFORE_WRITE/);
  assert.match(apply, /DREAMBREAKER_SUBMATCH_CREATED_ONCE/);
  assert.match(apply, /v_disc_ext := 'dreambreaker'/);
  assert.match(apply, /tie_at_2_2/);
  assert.doesNotMatch(apply, /Thiếu nội dung Dreambreaker\./);
  assert.doesNotMatch(apply, /p_team_a_order/);
  assert.doesNotMatch(apply, /get_captain_portal/);

  const precheck = readSrc(`${pkgDir}/01_PRECHECK.sql`);
  assert.match(precheck, /team-tournament-4zllu71z/);
  assert.match(precheck, /matchup-ilj0220c/);
  assert.match(precheck, /no_data_mutation/);

  const verify = readSrc(`${pkgDir}/03_VERIFY.sql`);
  assert.match(verify, /START_RPC_OVERLOAD_COUNT_AFTER/);
  assert.match(verify, /AUTHENTICATED_GRANTS_PRESERVED/);
  assert.match(verify, /ANON_GRANTS_UNCHANGED/);
  assert.match(verify, /no_data_mutation/);

  const rollback = readSrc(`${pkgDir}/04_ROLLBACK.sql`);
  assert.match(rollback, /Thiếu nội dung Dreambreaker\./);
});

test("plan persist dreambreaker when MLP catalog row is missing", () => {
  const previous = {
    settings: { formatPreset: FORMAT_PRESET.MLP_4 },
    disciplines: createMlpDisciplines().filter((item) => item.activationRule === "always"),
  };
  const next = {
    settings: { formatPreset: FORMAT_PRESET.MLP_4 },
    disciplines: previous.disciplines,
  };
  const plan = planCanonicalMlpDreambreakerPersist({ previous, next });
  assert.equal(plan.persistDreambreakerFirst, true);
  assert.equal(plan.dreambreaker.id, CANONICAL_DREAMBREAKER_DISCIPLINE_ID);
  assert.equal(plan.nextTeamData.disciplines.length, 5);
});
