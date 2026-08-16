/**
 * IT-E2E-BROWSER-008 — persisted Internal groups render after Chia bảng.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, it } from "node:test";

import {
  EVENT_TYPE,
  TOURNAMENT_MODE,
  TOURNAMENT_STATUS,
} from "../src/models/tournament/constants.js";
import {
  canonicalRowToTournament,
  tournamentToCanonicalRow,
} from "../src/features/tournament/mappers/canonicalTournamentMapper.js";
import { updateTournamentCommand } from "../src/features/tournament/services/tournamentCommands.js";
import {
  __resetTournamentRepositorySingleton,
} from "../src/features/tournament/repositories/tournamentRepositoryFactory.js";
import { createCloudTournamentRepository } from "../src/features/tournament/repositories/cloudTournamentRepository.js";
import {
  INTERNAL_PERSISTED_GROUP_FIELD,
  countInternalPersistedGroups,
  listInternalPersistedGroups,
  resolveInternalGroupMemberLabels,
  selectAuthoritativeCanonicalTournament,
} from "../src/features/tournament/internal/index.js";
import {
  buildInternalDrawEventWithoutMatches,
  buildInternalTournamentPlan,
} from "../src/tournament/engines/internalTournamentEngine.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SERVER_VERSION = 1;
const TOURNAMENT_ID = "a09e05ba-ae8d-489f-bcbb-2b93645c9a47";

function readSrc(relativePath) {
  return readFileSync(path.join(root, relativePath), "utf8");
}

function makePlayer(id, genderLabel) {
  return { id, name: `IT421 ${genderLabel} ${id}`, gender: genderLabel, level: 3 };
}

function makeMixedPlayers(count = 12) {
  const players = [];
  for (let i = 0; i < count; i += 1) {
    players.push(makePlayer(`p${i + 1}`, i % 2 === 0 ? "Nam" : "Nữ"));
  }
  return players;
}

function makeRow(overrides = {}) {
  return {
    id: TOURNAMENT_ID,
    tenant_id: "tenant-a",
    club_id: "club-a",
    external_key: TOURNAMENT_ID,
    name: "Giải nội bộ 14/8/2026",
    mode: TOURNAMENT_MODE.INTERNAL_TOURNAMENT,
    status: TOURNAMENT_STATUS.DRAFT,
    season_id: null,
    league_id: null,
    payload: { events: [], settings: {} },
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

async function persistDraw(players = makeMixedPlayers(12)) {
  const row = makeRow();
  const tournament = canonicalRowToTournament(row);
  const store = createBrowserCasStore(row);
  const repo = createCloudTournamentRepository({ rpc: store.rpc });
  const plan = buildInternalTournamentPlan({
    tournament,
    players,
    selectedPlayerIds: players.map((player) => player.id),
    eventType: EVENT_TYPE.MIXED_DOUBLE,
    groupCount: 2,
  });
  assert.equal(plan.ok, true, plan.errors?.join(" "));
  const draw = buildInternalDrawEventWithoutMatches(plan);
  assert.equal(draw.ok, true);
  const result = await updateTournamentCommand(
    { id: "club-a", tenantId: "tenant-a" },
    TOURNAMENT_ID,
    {
      events: [draw.event],
      status: TOURNAMENT_STATUS.READY,
      settings: {
        internal: {
          groupCount: draw.groupCount,
          eventType: draw.event.eventType,
        },
      },
    },
    {
      repository: repo,
      tenantId: "tenant-a",
      currentTournament: tournament,
      expectedVersion: SERVER_VERSION,
    }
  );
  return { store, result, draw, tournament };
}

describe("IT-E2E-BROWSER-008 — render persisted Internal groups after draw", () => {
  afterEach(() => {
    __resetTournamentRepositorySingleton();
  });

  it("A. 12 athletes → confirm draw writes once, version N+1, 2 groups", async () => {
    const { store, result, draw } = await persistDraw();
    assert.equal(result.ok, true);
    assert.equal(store.getWriteCount(), 1);
    assert.equal(result.tournament.version, SERVER_VERSION + 1);
    assert.equal(draw.groupCount, 2);
    assert.equal(countInternalPersistedGroups(result.tournament), 2);
    assert.equal(countInternalPersistedGroups(result.tournament.events[0]), 2);
  });

  it("B. returned row groups are the UI source without waiting for refetch", () => {
    const setup = readSrc("src/pages/tournament/InternalTournamentSetup.jsx");
    assert.match(setup, /listInternalPersistedGroups\(savedEvent\)/);
    assert.match(setup, /Bảng đấu \(\{persistedGroups\.length\}\)/);
    assert.match(
      setup,
      /handleBuildGroups[\s\S]*selectWorkspaceSection\(INTERNAL_WORKSPACE_SECTIONS\.DRAW\)/
    );
    const hook = readSrc("src/features/tournament/hooks/useCanonicalTournament.js");
    assert.match(hook, /applyAuthoritativeTournament\(result\.tournament\)/);
    assert.match(hook, /selectAuthoritativeCanonicalTournament/);
  });

  it("C. fresh GET returns the same 2 groups", async () => {
    const { store, result } = await persistDraw();
    const mappedWrite = result.tournament;
    const mappedGet = canonicalRowToTournament(store.getStore());
    assert.equal(countInternalPersistedGroups(mappedWrite), 2);
    assert.equal(countInternalPersistedGroups(mappedGet), 2);
    assert.deepEqual(
      listInternalPersistedGroups(mappedGet).map((group) => group.id).sort(),
      listInternalPersistedGroups(mappedWrite).map((group) => group.id).sort()
    );
  });

  it("D. F5/fresh mount mapper keeps the same 2 groups", async () => {
    const { store } = await persistDraw();
    const fresh = canonicalRowToTournament(store.getStore());
    assert.equal(countInternalPersistedGroups(fresh), 2);
    const members = listInternalPersistedGroups(fresh).flatMap((group) =>
      resolveInternalGroupMemberLabels(group, fresh)
    );
    assert.equal(members.length, 6);
  });

  it("E. schedule/matches absent still yields visible group cards", async () => {
    const { result } = await persistDraw();
    const event = result.tournament.events[0];
    assert.equal((event.matches || []).length, 0);
    assert.equal(countInternalPersistedGroups(event), 2);
    const setup = readSrc("src/pages/tournament/InternalTournamentSetup.jsx");
    assert.match(setup, /persistedGroups\.map/);
    assert.equal(/group\.matches\?\.length \|\| 0/.test(setup), false);
  });

  it("F. background refresh does not replace groups with empty state", () => {
    const withGroups = {
      id: TOURNAMENT_ID,
      version: 2,
      events: [{ id: "event-1", groups: [{ id: "g-a", name: "Bảng A", entryIds: ["e1"] }] }],
    };
    const emptySameVersion = {
      id: TOURNAMENT_ID,
      version: 2,
      events: [{ id: "event-1", groups: [] }],
    };
    const kept = selectAuthoritativeCanonicalTournament(withGroups, emptySameVersion);
    assert.equal(countInternalPersistedGroups(kept), 1);
    const newerEmpty = {
      id: TOURNAMENT_ID,
      version: 3,
      events: [{ id: "event-1", groups: [] }],
    };
    const reset = selectAuthoritativeCanonicalTournament(withGroups, newerEmpty);
    assert.equal(countInternalPersistedGroups(reset), 0);
  });

  it("G. mapper field parity is events[].groups", async () => {
    assert.equal(INTERNAL_PERSISTED_GROUP_FIELD, "events[].groups");
    const { result } = await persistDraw();
    const row = tournamentToCanonicalRow(result.tournament, {
      tenantId: "tenant-a",
      clubId: "club-a",
    });
    assert.equal(Array.isArray(row.payload.events[0].groups), true);
    assert.equal(row.payload.events[0].groups.length, 2);
    const remapped = canonicalRowToTournament({
      ...row,
      id: TOURNAMENT_ID,
      version: result.tournament.version,
    });
    assert.equal(countInternalPersistedGroups(remapped), 2);
  });

  it("H. no duplicate groups in canonical projection", async () => {
    const { result } = await persistDraw();
    const ids = listInternalPersistedGroups(result.tournament).map((group) => group.id);
    assert.equal(new Set(ids).size, ids.length);
  });
});
