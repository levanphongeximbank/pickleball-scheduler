/**
 * IT-BROWSER-002/003/004 — Internal operator workspace UX, winner draft,
 * background refresh, and canonical match referee assignment.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "path";
import { fileURLToPath } from "url";
import { afterEach, describe, it } from "node:test";

import {
  EVENT_TYPE,
  MATCH_STATUS,
  TOURNAMENT_MODE,
  TOURNAMENT_STATUS,
} from "../src/models/tournament/constants.js";
import { canonicalRowToTournament } from "../src/features/tournament/mappers/canonicalTournamentMapper.js";
import { updateTournamentCommand } from "../src/features/tournament/services/tournamentCommands.js";
import { __resetTournamentRepositorySingleton } from "../src/features/tournament/repositories/tournamentRepositoryFactory.js";
import { createCloudTournamentRepository } from "../src/features/tournament/repositories/cloudTournamentRepository.js";
import {
  INTERNAL_NO_REFEREE_ROSTER_MESSAGE,
  INTERNAL_WORKSPACE_SECTIONS,
  assignInternalMatchReferee,
  listEligibleInternalReferees,
  resolveCanonicalLoadPresentation,
  resolveInternalSchedulePrerequisite,
  resolveInternalWorkspaceKey,
} from "../src/features/tournament/internal/index.js";
import { setBracketWinner } from "../src/tournament/engines/index.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SERVER_VERSION = 7;
const TOURNAMENT_ID = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const REFEREE_ID = "ref-roster-internal-1";

function readSrc(relativePath) {
  return readFileSync(path.join(root, relativePath), "utf8");
}

function makeRow(overrides = {}) {
  return {
    id: TOURNAMENT_ID,
    tenant_id: "tenant-a",
    club_id: "club-a",
    external_key: TOURNAMENT_ID,
    name: "Internal Browser UX",
    mode: TOURNAMENT_MODE.INTERNAL_TOURNAMENT,
    status: TOURNAMENT_STATUS.READY,
    season_id: null,
    league_id: null,
    payload: {
      settings: {
        refereeRoster: [{ id: REFEREE_ID, name: "Trọng tài A", active: true }],
      },
      events: [
        {
          id: "event-1",
          eventType: EVENT_TYPE.MIXED_DOUBLE,
          groups: [{ id: "G1", label: "A", name: "Bảng A" }],
          entries: [
            { id: "e1", name: "Đội 1" },
            { id: "e2", name: "Đội 2" },
          ],
          matches: [
            {
              id: "m-group-1",
              groupId: "G1",
              entryAId: "e1",
              entryBId: "e2",
              status: MATCH_STATUS.PENDING,
            },
            {
              id: "m-ko-1",
              bracketMatchId: "R1-M1",
              entryAId: "e1",
              entryBId: "e2",
              status: MATCH_STATUS.PENDING,
            },
          ],
          bracket: {
            rounds: [
              {
                name: "Chung kết",
                matches: [{ id: "R1-M1", home: "e1", away: "e2", winnerSide: "" }],
              },
            ],
          },
        },
      ],
    },
    engine_v4: {},
    version: SERVER_VERSION,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

function createBrowserCasStore(initialRow) {
  let store = { ...initialRow, version: Number(initialRow.version || 1) };
  const patches = [];
  let writeCount = 0;

  const rpc = async (name, args) => {
    if (name === "canonical_tournament_get") {
      return { ok: true, tournament: store };
    }
    if (name === "canonical_tournament_update") {
      const patch = args.p_patch || {};
      patches.push(patch);
      if (patch.expected_version == null || String(patch.expected_version).trim() === "") {
        throw new Error("expected_version is required for internal_tournament updates.");
      }
      if (Number(patch.expected_version) !== Number(store.version)) {
        return {
          ok: false,
          code: "VERSION_CONFLICT",
          expectedVersion: patch.expected_version,
          currentVersion: store.version,
          error: "VERSION_CONFLICT",
        };
      }
      writeCount += 1;
      store = {
        ...store,
        name: patch.name ?? store.name,
        status: patch.status ?? store.status,
        payload: patch.payload ?? store.payload,
        engine_v4: patch.engine_v4 ?? store.engine_v4,
        version: Number(store.version) + 1,
        updated_at: new Date().toISOString(),
      };
      return { ok: true, tournament: store };
    }
    return { ok: false, code: "UNEXPECTED", error: name };
  };

  return {
    rpc,
    getStore: () => store,
    getPatches: () => patches,
    getWriteCount: () => writeCount,
  };
}

async function persistAssignedReferee({ tournament, event, matchId, rosterId, repo, expectedVersion }) {
  const assigned = assignInternalMatchReferee({
    tournament,
    event,
    matchId,
    rosterId,
  });
  assert.equal(assigned.ok, true, assigned.error);
  const result = await updateTournamentCommand(
    { id: "club-a", tenantId: "tenant-a" },
    TOURNAMENT_ID,
    { events: [assigned.event] },
    {
      repository: repo,
      tenantId: "tenant-a",
      currentTournament: tournament,
      expectedVersion,
    }
  );
  return { assigned, result };
}

describe("IT-BROWSER-002 — Internal section/select does not remount or blank", () => {
  it("workspace key is tournament identity, not canonical version", () => {
    const tournament = canonicalRowToTournament(makeRow({ version: 3 }));
    const nextVersion = canonicalRowToTournament(makeRow({ version: 99 }));
    assert.equal(resolveInternalWorkspaceKey(tournament), TOURNAMENT_ID);
    assert.equal(
      resolveInternalWorkspaceKey(tournament),
      resolveInternalWorkspaceKey(nextVersion)
    );
    assert.equal(resolveInternalWorkspaceKey({}), "internal-workspace");
  });

  it("background refresh keeps existing UI; only first load is initial loading", () => {
    assert.deepEqual(resolveCanonicalLoadPresentation({ hasTournament: false }), {
      initialLoading: true,
      backgroundRefresh: false,
    });
    assert.deepEqual(resolveCanonicalLoadPresentation({ hasTournament: true }), {
      initialLoading: false,
      backgroundRefresh: true,
    });
  });

  it("Internal workspace sections are local state, not durable mutations", () => {
    const setup = readSrc("src/pages/tournament/InternalTournamentSetup.jsx");
    assert.match(setup, /INTERNAL_WORKSPACE_SECTIONS/);
    assert.match(setup, /selectWorkspaceSection/);
    assert.match(setup, /workspaceTouchedRef/);
    assert.equal(/location\.reload/.test(setup), false);
    assert.equal(/window\.location\s*=/.test(setup), false);
    assert.match(setup, /resolveInternalWorkspaceKey\(tournament\)/);
    assert.equal(/key=\{[^}]*version/.test(setup), false);
    assert.match(setup, /resolveInternalPageLoadingGate/);
    assert.equal(/if \(tournamentLoading\) \{/.test(setup), false);
    assert.match(setup, /tournamentRefreshing/);
    assert.equal(
      Object.values(INTERNAL_WORKSPACE_SECTIONS).join(","),
      "setup,draw,schedule,referee,results,bracket,awards"
    );
  });

  it("canonical hook separates initial loading from background refresh", () => {
    const hook = readSrc("src/features/tournament/hooks/useCanonicalTournament.js");
    assert.match(hook, /resolveCanonicalLoadPresentation/);
    assert.match(hook, /hasLoadedRef/);
    assert.match(hook, /setRefreshing\(true\)/);
    assert.match(hook, /refreshing,/);
  });
});

describe("IT-BROWSER-003 — winner/select is draft until explicit save", () => {
  it("winner draft helper does not persist; confirm helper persists", () => {
    const setup = readSrc("src/pages/tournament/InternalTournamentSetup.jsx");
    const draftBlock = setup.slice(
      setup.indexOf("const handleDraftBracketWinner"),
      setup.indexOf("const handleConfirmBracketWinner")
    );
    assert.match(draftBlock, /setWinnerDrafts/);
    assert.equal(/persistEvent|writeCanonical|update\(/.test(draftBlock), false);

    const confirmBlock = setup.slice(
      setup.indexOf("const handleConfirmBracketWinner"),
      setup.indexOf("const handleAssignMatchReferee")
    );
    assert.match(confirmBlock, /persistEvent/);
    assert.match(confirmBlock, /setPendingMatchId/);
  });

  it("BracketView keeps winner selection local until Lưu", () => {
    const view = readSrc("src/components/tournament/BracketView.jsx");
    assert.match(view, /onConfirmWinner/);
    assert.match(view, /winnerDrafts/);
    assert.match(view, /Lưu/);
  });

  it("setBracketWinner remains an explicit engine mutation, not a select side-effect", () => {
    const event = canonicalRowToTournament(makeRow()).events[0];
    assert.equal(event.bracket?.winnersByMatch?.["R1-M1"] || "", "");
    const saved = setBracketWinner(event, "R1-M1", "home");
    assert.equal(saved.ok, true, saved.error);
    assert.equal(saved.event.bracket.winnersByMatch["R1-M1"], "home");
    assert.equal(event.bracket?.winnersByMatch?.["R1-M1"] || "", "");
  });

  it("schedule create no longer launches GROUP_MATCH_PAIRING presentation", () => {
    const setup = readSrc("src/pages/tournament/InternalTournamentSetup.jsx");
    const scheduleBlock = setup.slice(
      setup.indexOf("const handleGenerateSchedule"),
      setup.indexOf("if (!clubScope.ok)")
    );
    assert.equal(/GROUP_MATCH_PAIRING/.test(scheduleBlock), false);
    assert.equal(/showAnimation/.test(scheduleBlock), false);
    assert.match(scheduleBlock, /writeCanonical/);
  });
});

describe("IT-BROWSER-004 — canonical referee assignment per match", () => {
  afterEach(() => {
    __resetTournamentRepositorySingleton();
  });

  it("group and knockout match cards expose referee selector extras", () => {
    const setup = readSrc("src/pages/tournament/InternalTournamentSetup.jsx");
    assert.match(setup, /InternalMatchRefereeSelect/);
    assert.match(setup, /handleAssignMatchReferee/);
    assert.match(setup, /listEligibleInternalReferees/);
    const groupBlock = setup.slice(
      setup.indexOf("INTERNAL_WORKSPACE_SECTIONS.RESULTS"),
      setup.indexOf("INTERNAL_WORKSPACE_SECTIONS.BRACKET")
    );
    assert.match(groupBlock, /InternalMatchRefereeSelect/);
    const koBlock = setup.slice(setup.indexOf("INTERNAL_WORKSPACE_SECTIONS.BRACKET"));
    assert.match(koBlock, /InternalMatchRefereeSelect/);
    const select = readSrc(
      "src/components/tournament/internal/InternalMatchRefereeSelect.jsx"
    );
    assert.match(select, /Chưa phân công/);
    assert.match(select, /Lưu trọng tài/);
    assert.match(select, /setDraftId/);
  });

  it("uses existing roster identity and rejects empty/foreign referees", () => {
    const tournament = canonicalRowToTournament(makeRow());
    const event = tournament.events[0];
    assert.equal(listEligibleInternalReferees(tournament)[0].id, REFEREE_ID);

    const empty = assignInternalMatchReferee({
      tournament: { ...tournament, settings: { refereeRoster: [] } },
      event,
      matchId: "m-group-1",
      rosterId: REFEREE_ID,
    });
    assert.equal(empty.ok, false);
    assert.equal(empty.error, INTERNAL_NO_REFEREE_ROSTER_MESSAGE);

    const foreign = assignInternalMatchReferee({
      tournament,
      event,
      matchId: "m-group-1",
      rosterId: "tenant-b-ref",
    });
    assert.equal(foreign.ok, false);
    assert.match(foreign.error, /không thuộc danh sách/);
  });

  it("assigns group referee with CAS and retains it on fresh get", async () => {
    const row = makeRow();
    const tournament = canonicalRowToTournament(row);
    const store = createBrowserCasStore(row);
    const repo = createCloudTournamentRepository({ rpc: store.rpc });

    const { result } = await persistAssignedReferee({
      tournament,
      event: tournament.events[0],
      matchId: "m-group-1",
      rosterId: REFEREE_ID,
      repo,
      expectedVersion: tournament.version,
    });

    assert.equal(result.ok, true, result.error);
    assert.equal(store.getWriteCount(), 1);
    assert.equal(Number(store.getPatches()[0].expected_version), SERVER_VERSION);
    const assignedMatch = (result.tournament.events?.[0]?.matches || []).find(
      (match) => match.id === "m-group-1"
    );
    assert.equal(assignedMatch?.referee?.rosterId, REFEREE_ID);
    assert.equal(assignedMatch?.referee?.name, "Trọng tài A");

    const fresh = canonicalRowToTournament(store.getStore());
    const retained = (fresh.events?.[0]?.matches || []).find(
      (match) => match.id === "m-group-1"
    );
    assert.equal(retained?.referee?.rosterId, REFEREE_ID);
    assert.equal(retained?.referee?.name, "Trọng tài A");
  });

  it("assigns knockout referee with CAS and retains it on fresh get", async () => {
    const row = makeRow();
    const tournament = canonicalRowToTournament(row);
    const store = createBrowserCasStore(row);
    const repo = createCloudTournamentRepository({ rpc: store.rpc });

    const { result } = await persistAssignedReferee({
      tournament,
      event: tournament.events[0],
      matchId: "m-ko-1",
      rosterId: REFEREE_ID,
      repo,
      expectedVersion: tournament.version,
    });

    assert.equal(result.ok, true, result.error);
    assert.equal(Number(store.getPatches()[0].expected_version), SERVER_VERSION);
    const assignedMatch = (result.tournament.events?.[0]?.matches || []).find(
      (match) => match.id === "m-ko-1"
    );
    assert.equal(assignedMatch?.referee?.rosterId, REFEREE_ID);

    const fresh = canonicalRowToTournament(store.getStore());
    const retained = (fresh.events?.[0]?.matches || []).find(
      (match) => match.id === "m-ko-1"
    );
    assert.equal(retained?.referee?.rosterId, REFEREE_ID);
    assert.equal(result.tournament.version, SERVER_VERSION + 1);
  });
});

describe("Internal schedule stage copy and validation", () => {
  it("hides reschedule until matches exist and never exposes courtSchedule.date", () => {
    const none = resolveInternalSchedulePrerequisite({
      hasGroups: true,
      hasDate: false,
      hasMatches: false,
    });
    assert.equal(none.ok, false);
    assert.equal(none.message, "Chọn ngày thi đấu trước khi tạo lịch.");
    assert.equal(none.showReschedule, false);

    const ready = resolveInternalSchedulePrerequisite({
      hasGroups: true,
      hasDate: true,
      hasMatches: false,
    });
    assert.equal(ready.ok, true);
    assert.equal(ready.message, "Chọn ngày thi đấu và tạo lịch.");
    assert.equal(ready.showReschedule, false);

    const created = resolveInternalSchedulePrerequisite({
      hasGroups: true,
      hasDate: true,
      hasMatches: true,
    });
    assert.equal(created.showReschedule, true);
    assert.equal(created.message, null);

    const stage = readSrc("src/components/tournament/internal/InternalScheduleStage.jsx");
    assert.equal(/courtSchedule\.date/.test(stage), false);
    assert.match(stage, /Tạo lịch/);
    assert.match(stage, /Khóa lịch/);
    assert.match(stage, /Công bố lịch/);

    const publish = readSrc("src/pages/tournament/TournamentPublishSchedulePage.jsx");
    assert.equal(/Cần chọn ngày khóa sân/.test(publish), false);
    assert.match(publish, /Chọn ngày thi đấu trước khi tạo lịch/);

    const builder = readSrc("src/components/tournament/ScheduleBuilderPanel.jsx");
    assert.match(builder, /matches\.length > 0/);

    const selector = readSrc("src/components/tournament/IndividualTournamentSelector.jsx");
    assert.equal(/không dùng dữ liệu demo đồng đội/.test(selector), false);
  });
});
