/**
 * IT-BROWSER-001 — Internal Chia bảng / Ghép trận browser CAS path.
 * Reproduces the Preview runtime: GET → mapper → Internal action → RPC p_patch.
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
import { canonicalRowToTournament } from "../src/features/tournament/mappers/canonicalTournamentMapper.js";
import { updateTournamentCommand } from "../src/features/tournament/services/tournamentCommands.js";
import {
  __resetTournamentRepositorySingleton,
  __setTournamentRepositoryRpcForTests,
} from "../src/features/tournament/repositories/tournamentRepositoryFactory.js";
import { createCloudTournamentRepository } from "../src/features/tournament/repositories/cloudTournamentRepository.js";
import {
  CANONICAL_VERSION_CONFLICT_USER_MESSAGE,
  CANONICAL_VERSION_REQUIRED_USER_MESSAGE,
  INTERNAL_VERSION_SYNCING_USER_MESSAGE,
  assertInternalTournamentReadyForMutation,
  chainExpectedVersionFromResult,
  formatCanonicalVersionConflictError,
  isCanonicalVersionRequired,
} from "../src/features/tournament/internal/index.js";
import {
  buildInternalDrawEventWithoutMatches,
  buildInternalScheduleFromPersistedGroups,
  buildInternalTournamentPlan,
} from "../src/tournament/engines/internalTournamentEngine.js";
import { ANIMATION_MODES } from "../src/components/tournament/animation/animationUtils.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SERVER_VERSION = 4;
const TOURNAMENT_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";

function makePlayer(id, genderLabel) {
  return { id, name: `P-${id}`, gender: genderLabel, level: 3 };
}

function makeMixedPlayers(count = 8) {
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
    name: "Internal Browser CAS",
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

describe("IT-BROWSER-001 — version propagation GET → mapper → action → RPC", () => {
  afterEach(() => {
    __resetTournamentRepositorySingleton();
  });

  it("mapper and hydration gate preserve a positive server version", () => {
    const row = makeRow({ version: SERVER_VERSION });
    const tournament = canonicalRowToTournament(row);
    assert.equal(tournament.version, SERVER_VERSION);
    const ready = assertInternalTournamentReadyForMutation(tournament);
    assert.equal(ready.ok, true);
    assert.equal(ready.expectedVersion, SERVER_VERSION);
  });

  it("maps PostgREST expected_version English to Vietnamese operator copy", () => {
    const required = {
      ok: false,
      code: "VERSION_REQUIRED",
      error: "expected_version is required for internal_tournament updates.",
    };
    assert.equal(isCanonicalVersionRequired(required), true);
    const message = formatCanonicalVersionConflictError(required);
    assert.equal(message, CANONICAL_VERSION_REQUIRED_USER_MESSAGE);
    assert.equal(/expected_version/i.test(message), false);

    const conflict = {
      ok: false,
      code: "VERSION_CONFLICT",
      error: "VERSION_CONFLICT",
    };
    assert.equal(
      formatCanonicalVersionConflictError(conflict),
      CANONICAL_VERSION_CONFLICT_USER_MESSAGE
    );
    assert.equal(
      formatCanonicalVersionConflictError({
        ok: false,
        code: "VERSION_REQUIRED",
        reason: "missing_version",
      }),
      INTERNAL_VERSION_SYNCING_USER_MESSAGE
    );
  });

  it("Chia bảng page command sends expected_version=N and returns N+1", async () => {
    const players = makeMixedPlayers(8);
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
        expectedVersion: tournament.version,
      }
    );

    assert.equal(result.ok, true, result.error);
    assert.equal(store.getWriteCount(), 1);
    assert.equal(Number(store.getPatches()[0].expected_version), SERVER_VERSION);
    assert.equal(result.tournament.version, SERVER_VERSION + 1);
    assert.equal(chainExpectedVersionFromResult(result), SERVER_VERSION + 1);
    assert.ok((result.tournament.events?.[0]?.groups || []).length > 0);

    const schedule = buildInternalScheduleFromPersistedGroups({
      tournament: result.tournament,
      players,
    });
    assert.equal(schedule.ok, true, schedule.errors?.join(" "));

    const scheduled = await updateTournamentCommand(
      { id: "club-a", tenantId: "tenant-a" },
      TOURNAMENT_ID,
      {
        events: [schedule.event],
        status: TOURNAMENT_STATUS.READY,
      },
      {
        repository: repo,
        tenantId: "tenant-a",
        currentTournament: result.tournament,
        expectedVersion: chainExpectedVersionFromResult(result),
      }
    );

    assert.equal(scheduled.ok, true, scheduled.error);
    assert.equal(store.getWriteCount(), 2);
    assert.equal(Number(store.getPatches()[1].expected_version), SERVER_VERSION + 1);
    assert.equal(scheduled.tournament.version, SERVER_VERSION + 2);
    assert.ok(
      (scheduled.tournament.events?.[0]?.matches || []).some(
        (match) => !match?.bracketMatchId
      )
    );
  });

  it("guided persist-before-animation chains N → N+1 without waiting for React", async (t) => {
    let createInternalFlowAdapters;
    try {
      ({ createInternalFlowAdapters } = await import(
        "../src/components/tournament/animation/tournamentFlowAdapters.js"
      ));
    } catch (error) {
      if (!String(error?.message || error).includes("Cannot find package")) {
        throw error;
      }
      t.skip("adapter runtime requires installed UI packages");
      return;
    }

    const players = makeMixedPlayers(8);
    const row = makeRow();
    const tournament = canonicalRowToTournament(row);
    const store = createBrowserCasStore(row);
    __setTournamentRepositoryRpcForTests(store.rpc);

    const adapters = createInternalFlowAdapters({
      tournament,
      tournamentClubId: "club-a",
      tournamentId: TOURNAMENT_ID,
      players,
      courts: [{ id: "court-1", name: "Sân 1" }],
      selectedPlayerIds: players.map((player) => player.id),
      eventType: EVENT_TYPE.MIXED_DOUBLE,
      groupCount: 2,
      isSingleEvent: false,
      setPreviewEntries() {},
      setWarnings() {},
      setMessage() {},
      setError(message) {
        assert.fail(`unexpected adapter error: ${message}`);
      },
      setLocalRevision() {},
      refreshClubs() {},
      persistEvent() {
        return true;
      },
      getPrivatePairingOptions: () => ({ ok: true, pairingOptions: {} }),
      tournamentTenantId: "tenant-a",
    });

    const ctx = {};
    const started = adapters.validateStart(ctx);
    assert.equal(started.ok, true, started.error);

    const drawOk = await adapters.persistBeforeAnimation(
      ANIMATION_MODES.SNAKE_GROUP,
      ctx
    );
    assert.equal(drawOk, true);
    assert.equal(store.getWriteCount(), 1);
    assert.equal(Number(store.getPatches()[0].expected_version), SERVER_VERSION);
    assert.equal(ctx.expectedVersion, SERVER_VERSION + 1);
    assert.equal(tournament.version, SERVER_VERSION, "React tournament stays at N");

    const scheduleOk = await adapters.persistBeforeAnimation(
      ANIMATION_MODES.GROUP_MATCH_PAIRING,
      ctx
    );
    assert.equal(scheduleOk, true);
    assert.equal(store.getWriteCount(), 2);
    assert.equal(Number(store.getPatches()[1].expected_version), SERVER_VERSION + 1);
    assert.equal(ctx.expectedVersion, SERVER_VERSION + 2);

    const fresh = canonicalRowToTournament(store.getStore());
    assert.ok((fresh.events?.[0]?.groups || []).length > 0);
    assert.ok(
      (fresh.events?.[0]?.matches || []).some((match) => !match?.bracketMatchId)
    );
    assert.equal(fresh.version, SERVER_VERSION + 2);
  });
});

describe("IT-BROWSER-001 — shared Internal write boundary", () => {
  it("Internal setup durable actions share writeCanonical + version gate", () => {
    const src = readFileSync(
      path.join(root, "src/pages/tournament/InternalTournamentSetup.jsx"),
      "utf8"
    );
    assert.match(src, /const writeCanonical = async/);
    assert.match(src, /assertInternalTournamentReadyForMutation/);
    assert.match(src, /INTERNAL_VERSION_SYNCING_USER_MESSAGE/);
    assert.match(src, /handleBuildGroups[\s\S]*writeCanonical/);
    assert.match(src, /handleGenerateSchedule[\s\S]*writeCanonical/);
    assert.match(src, /disabled=\{!durableMutationReady\.ok/);
    assert.doesNotMatch(
      src,
      /await update\(\s*\{\s*events: created\.tournament\.events/
    );
  });

  it("adapters chain returned version and pass tenant into fresh GET", () => {
    const src = readFileSync(
      path.join(root, "src/components/tournament/animation/tournamentFlowAdapters.js"),
      "utf8"
    );
    assert.match(src, /chainExpectedVersionFromResult/);
    assert.match(src, /tournamentTenantId/);
    assert.match(src, /ctx\.expectedVersion/);
    assert.match(src, /expectedVersion: ready\.expectedVersion/);
    assert.match(src, /expectedVersion: chainedVersion/);
  });
});
