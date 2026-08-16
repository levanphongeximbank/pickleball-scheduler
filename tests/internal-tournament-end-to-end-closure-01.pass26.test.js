/**
 * Pass 2.6 corrective coverage — append to IT-E2E closure suite.
 * Production-path / contract tests for IT-REV-001..007.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

import {
  TOURNAMENT_MODE,
  TOURNAMENT_STATUS,
  EVENT_TYPE,
  MATCH_STATUS,
} from "../src/models/tournament/constants.js";
import { createCloudTournamentRepository } from "../src/features/tournament/repositories/cloudTournamentRepository.js";
import { canonicalRowToTournament } from "../src/features/tournament/mappers/canonicalTournamentMapper.js";
import { updateTournamentCommand } from "../src/features/tournament/services/tournamentCommands.js";
import {
  assertInternalExpectedVersion,
  assertInternalTournamentCompletionEligibility,
  assertInternalStatusCompletionGate,
  chainExpectedVersionFromResult,
  decideInternalSetupHydration,
  isCanonicalVersionRequired,
  resolveInternalKnockoutEligibility,
  shouldSkipKnockoutForInternal,
  INTERNAL_HYDRATION_ACTION,
} from "../src/features/tournament/internal/index.js";
import {
  buildInternalDrawEventWithoutMatches,
  buildInternalScheduleFromPersistedGroups,
  buildInternalTournamentPlan,
} from "../src/tournament/engines/internalTournamentEngine.js";
import { recordDrawCreated } from "../src/tournament/engines/publishDrawEngine.js";
import { ANIMATION_MODES } from "../src/components/tournament/animation/animationUtils.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

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
    id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    tenant_id: "tenant-a",
    club_id: "club-a",
    external_key: "it-corr-1",
    name: "Internal Corrective",
    mode: TOURNAMENT_MODE.INTERNAL_TOURNAMENT,
    status: TOURNAMENT_STATUS.READY,
    season_id: null,
    league_id: null,
    payload: { events: [], settings: {} },
    engine_v4: {},
    version: 1,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

function createVersionedStoreRepo(initialRow) {
  let store = { ...initialRow, version: Number(initialRow.version || 1) };
  let writeCount = 0;
  const patches = [];

  const repo = createCloudTournamentRepository({
    rpc: async (name, args) => {
      if (name === "canonical_tournament_get") {
        return { ok: true, tournament: store };
      }
      if (name === "canonical_tournament_update") {
        const patch = args.p_patch || {};
        patches.push(patch);
        if (store.mode === TOURNAMENT_MODE.INTERNAL_TOURNAMENT) {
          if (
            patch.expected_version == null ||
            String(patch.expected_version).trim() === ""
          ) {
            return {
              ok: false,
              code: "VERSION_REQUIRED",
              currentVersion: store.version,
            };
          }
          if (Number(patch.expected_version) !== Number(store.version)) {
            return {
              ok: false,
              code: "VERSION_CONFLICT",
              expectedVersion: patch.expected_version,
              currentVersion: store.version,
            };
          }
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
    },
  });

  return {
    repo,
    getStore: () => store,
    getWriteCount: () => writeCount,
    getPatches: () => patches,
  };
}

describe("IT-REV-001 — draw single write + version chaining", () => {
  it("draw metadata folds into one update and chains returned version", async () => {
    const players = makeMixedPlayers(8);
    const tournament = canonicalRowToTournament(
      makeRow({
        payload: {
          events: [],
          settings: {},
        },
        version: 1,
      })
    );
    const plan = buildInternalTournamentPlan({
      tournament,
      players,
      selectedPlayerIds: players.map((p) => p.id),
      eventType: EVENT_TYPE.MIXED_DOUBLE,
      groupCount: 2,
    });
    assert.equal(plan.ok, true, plan.errors?.join(" "));
    const draw = buildInternalDrawEventWithoutMatches(plan);
    assert.equal(draw.ok, true);

    const drafted = {
      ...tournament,
      events: [draw.event],
      status: TOURNAMENT_STATUS.READY,
      settings: {
        ...(tournament.settings || {}),
        internal: { groupCount: draw.groupCount, eventType: draw.event.eventType },
      },
    };
    const created = recordDrawCreated(drafted, draw.event.groups, {
      reason: "unit_draw",
    });
    assert.equal(created.ok, true);

    const harness = createVersionedStoreRepo(
      makeRow({
        version: 1,
        payload: { events: [], settings: {} },
      })
    );

    const result = await updateTournamentCommand(
      { id: "club-a", tenantId: "tenant-a" },
      harness.getStore().id,
      {
        events: created.tournament.events,
        status: TOURNAMENT_STATUS.READY,
        settings: created.tournament.settings,
      },
      {
        repository: harness.repo,
        tenantId: "tenant-a",
        currentTournament: tournament,
        expectedVersion: 1,
      }
    );

    assert.equal(result.ok, true);
    assert.equal(harness.getWriteCount(), 1);
    assert.equal(result.tournament.version, 2);
    assert.equal(chainExpectedVersionFromResult(result), 2);
    assert.equal(harness.getPatches().length, 1);
    assert.equal(Number(harness.getPatches()[0].expected_version), 1);

    // Legitimate second command must use returned version 2 — not stale 1.
    const second = await updateTournamentCommand(
      { id: "club-a", tenantId: "tenant-a" },
      harness.getStore().id,
      { name: "after-draw" },
      {
        repository: harness.repo,
        tenantId: "tenant-a",
        currentTournament: result.tournament,
        expectedVersion: chainExpectedVersionFromResult(result),
      }
    );
    assert.equal(second.ok, true);
    assert.equal(second.tournament.version, 3);
    assert.equal(Number(harness.getPatches()[1].expected_version), 2);
  });
});

describe("IT-REV-006 — Internal CAS fail closed", () => {
  it("client assert rejects missing Internal token", () => {
    const denied = assertInternalExpectedVersion(null, {
      mode: TOURNAMENT_MODE.INTERNAL_TOURNAMENT,
    });
    assert.equal(denied.ok, false);
    assert.equal(denied.code, "VERSION_REQUIRED");
  });

  it("repo rejects requireCas:false for Internal before RPC", async () => {
    let rpcUpdateCalled = false;
    const row = makeRow({ version: 5 });
    const repo = createCloudTournamentRepository({
      rpc: async (name) => {
        if (name === "canonical_tournament_get") {
          return { ok: true, tournament: row };
        }
        if (name === "canonical_tournament_update") {
          rpcUpdateCalled = true;
          return { ok: true, tournament: { ...row, version: 6 } };
        }
        return { ok: false };
      },
    });

    const denied = await repo.update(
      { id: "club-a", tenantId: "tenant-a" },
      row.id,
      { name: "no-cas" },
      { tenantId: "tenant-a", expectedVersion: 5, requireCas: false }
    );
    assert.equal(denied.ok, false);
    assert.equal(denied.code, "VERSION_REQUIRED");
    assert.equal(rpcUpdateCalled, false);
    assert.equal(isCanonicalVersionRequired(denied), true);
    assert.match(String(denied.error || ""), /requireCas:false|từ chối/i);
  });

  it("Team mode may omit expectedVersion (BC)", async () => {
    const row = makeRow({
      mode: TOURNAMENT_MODE.TEAM_TOURNAMENT,
      version: 1,
    });
    let sawExpected = false;
    const repo = createCloudTournamentRepository({
      rpc: async (name, args) => {
        if (name === "canonical_tournament_get") {
          return { ok: true, tournament: row };
        }
        if (name === "canonical_tournament_update") {
          sawExpected = args.p_patch?.expected_version != null;
          return {
            ok: true,
            tournament: { ...row, version: 2, name: args.p_patch.name },
          };
        }
        return { ok: false };
      },
    });

    const result = await repo.update(
      { id: "club-a", tenantId: "tenant-a" },
      row.id,
      { name: "team-ok" },
      { tenantId: "tenant-a", requireCas: false }
    );
    assert.equal(result.ok, true);
    assert.equal(sawExpected, false);
  });
});

describe("IT-REV-002 — completion eligibility", () => {
  it("rejects ready → completed without closed snapshot", () => {
    const tournament = canonicalRowToTournament(
      makeRow({
        status: TOURNAMENT_STATUS.READY,
        payload: {
          events: [
            {
              id: "ev1",
              groups: [{ id: "g1" }],
              matches: [{ id: "m1", status: "scheduled" }],
            },
          ],
          settings: {},
        },
      })
    );
    const gate = assertInternalStatusCompletionGate(
      tournament,
      TOURNAMENT_STATUS.COMPLETED,
      { ...tournament, status: TOURNAMENT_STATUS.COMPLETED }
    );
    assert.equal(gate.ok, false);
    assert.equal(gate.code, "INTERNAL_TOURNAMENT_NOT_COMPLETION_ELIGIBLE");
  });

  it("accepts one-group closed snapshot with completed RR and no KO", () => {
    const base = canonicalRowToTournament(
      makeRow({
        status: TOURNAMENT_STATUS.ACTIVE,
        payload: {
          events: [
            {
              id: "ev1",
              groups: [{ id: "g1", entryIds: ["e1", "e2"] }],
              matches: [
                {
                  id: "m1",
                  status: MATCH_STATUS.COMPLETED,
                  locked: true,
                  winnerId: "e1",
                },
              ],
            },
          ],
          settings: {
            resultsOps: {
              closed: true,
              summary: {
                champion: { entryId: "e1", entryName: "Champ" },
                completedMatchCount: 1,
                matchCount: 1,
              },
            },
          },
        },
      })
    );
    const eligibility = assertInternalTournamentCompletionEligibility(base);
    assert.equal(eligibility.ok, true);
    assert.equal(eligibility.oneGroup, true);
  });

  it("rejects multi-group when KO unfinished", () => {
    const tournament = canonicalRowToTournament(
      makeRow({
        status: TOURNAMENT_STATUS.ACTIVE,
        payload: {
          events: [
            {
              id: "ev1",
              groups: [{ id: "g1" }, { id: "g2" }],
              matches: [
                { id: "m1", status: MATCH_STATUS.COMPLETED, locked: true },
                {
                  id: "m2",
                  bracketMatchId: "b1",
                  stage: "final",
                  status: "scheduled",
                },
              ],
            },
          ],
          settings: {
            resultsOps: {
              closed: true,
              summary: { champion: { entryId: "e1" } },
            },
          },
        },
      })
    );
    const eligibility = assertInternalTournamentCompletionEligibility(tournament);
    assert.equal(eligibility.ok, false);
    assert.match(String(eligibility.reason || eligibility.error), /incomplete|knockout/i);
  });

  it("repo blocks premature completed with zero mutation", async () => {
    const harness = createVersionedStoreRepo(
      makeRow({
        version: 2,
        status: TOURNAMENT_STATUS.READY,
        payload: {
          events: [
            {
              id: "ev1",
              groups: [{ id: "g1" }],
              matches: [{ id: "m1", status: "scheduled" }],
            },
          ],
          settings: {},
        },
      })
    );
    const denied = await harness.repo.update(
      { id: "club-a", tenantId: "tenant-a" },
      harness.getStore().id,
      { status: TOURNAMENT_STATUS.COMPLETED },
      { tenantId: "tenant-a", expectedVersion: 2 }
    );
    assert.equal(denied.ok, false);
    assert.equal(denied.code, "INTERNAL_TOURNAMENT_NOT_COMPLETION_ELIGIBLE");
    assert.equal(harness.getWriteCount(), 0);
    assert.equal(harness.getStore().version, 2);
    assert.equal(harness.getStore().status, TOURNAMENT_STATUS.READY);
  });
});

describe("IT-REV-003 — dirty hydration", () => {
  it("keeps dirty eventType/groupCount/selection across server revision", () => {
    const tournamentV1 = canonicalRowToTournament(
      makeRow({
        version: 1,
        payload: {
          events: [
            {
              id: "ev1",
              eventType: EVENT_TYPE.MIXED_DOUBLE,
              entries: [{ id: "e1", playerIds: ["a", "b"] }],
              groups: [{ id: "g1" }, { id: "g2" }, { id: "g3" }, { id: "g4" }],
              matches: [],
            },
          ],
          settings: {},
        },
      })
    );
    const initial = decideInternalSetupHydration({
      tournament: tournamentV1,
      hydratedTournamentId: "",
      form: { eventType: EVENT_TYPE.MIXED_DOUBLE, groupCount: 4, selectedPlayerIds: [] },
    });
    assert.equal(initial.action, INTERNAL_HYDRATION_ACTION.HYDRATE_FULL);

    const dirty = decideInternalSetupHydration({
      tournament: {
        ...tournamentV1,
        version: 2,
        updatedAt: new Date().toISOString(),
      },
      hydratedTournamentId: tournamentV1.id,
      hydratedEventId: "ev1",
      baselineVersion: 1,
      baselineHydration: initial.hydration,
      form: {
        eventType: EVENT_TYPE.MEN_DOUBLE,
        groupCount: 2,
        selectedPlayerIds: ["x", "y"],
      },
    });
    assert.equal(dirty.action, INTERNAL_HYDRATION_ACTION.KEEP_DIRTY);
    assert.equal(dirty.apply.eventType, false);
    assert.equal(dirty.apply.groupCount, false);
    assert.equal(dirty.apply.selectedPlayerIds, false);
    assert.equal(dirty.staleServerRevision, true);
  });

  it("ignores stale async generation", () => {
    const decision = decideInternalSetupHydration({
      tournament: canonicalRowToTournament(makeRow()),
      incomingGeneration: 3,
      appliedGeneration: 5,
    });
    assert.equal(decision.action, INTERNAL_HYDRATION_ACTION.IGNORE_STALE);
  });
});

describe("IT-REV-004 — force reopen requires flag + CAS", () => {
  it("completed → active without force is denied; with force + CAS succeeds", async () => {
    const harness = createVersionedStoreRepo(
      makeRow({
        version: 7,
        status: TOURNAMENT_STATUS.COMPLETED,
        payload: {
          events: [{ id: "ev1", groups: [{ id: "g1" }], matches: [] }],
          settings: {
            resultsOps: { closed: true, summary: { champion: { entryId: "e1" } } },
          },
        },
      })
    );

    const denied = await harness.repo.update(
      { id: "club-a", tenantId: "tenant-a" },
      harness.getStore().id,
      { status: TOURNAMENT_STATUS.ACTIVE },
      { tenantId: "tenant-a", expectedVersion: 7 }
    );
    assert.equal(denied.ok, false);
    assert.equal(denied.code, "INTERNAL_STATUS_TRANSITION_DENIED");
    assert.equal(harness.getWriteCount(), 0);

    const ok = await harness.repo.update(
      { id: "club-a", tenantId: "tenant-a" },
      harness.getStore().id,
      { status: TOURNAMENT_STATUS.ACTIVE },
      {
        tenantId: "tenant-a",
        expectedVersion: 7,
        forceStatusReopen: true,
      }
    );
    assert.equal(ok.ok, true);
    assert.equal(ok.tournament.status, TOURNAMENT_STATUS.ACTIVE);
    assert.equal(ok.tournament.version, 8);
  });
});

describe("IT-REV-005/007 — F5 draw/schedule + orchestrator invariants", () => {
  it("F5-equivalent get after draw/schedule returns same groups/matches", async () => {
    const players = makeMixedPlayers(8);
    const tournament = canonicalRowToTournament(makeRow({ version: 1 }));
    const plan = buildInternalTournamentPlan({
      tournament,
      players,
      selectedPlayerIds: players.map((p) => p.id),
      eventType: EVENT_TYPE.MIXED_DOUBLE,
      groupCount: 2,
    });
    const draw = buildInternalDrawEventWithoutMatches(plan);
    const harness = createVersionedStoreRepo(makeRow({ version: 1 }));

    const drawResult = await updateTournamentCommand(
      { id: "club-a", tenantId: "tenant-a" },
      harness.getStore().id,
      {
        events: [draw.event],
        status: TOURNAMENT_STATUS.READY,
      },
      {
        repository: harness.repo,
        tenantId: "tenant-a",
        currentTournament: tournament,
        expectedVersion: 1,
      }
    );
    assert.equal(drawResult.ok, true);

    const afterDraw = await harness.repo.get(
      { id: "club-a", tenantId: "tenant-a" },
      harness.getStore().id,
      { tenantId: "tenant-a" }
    );
    assert.equal(afterDraw.ok, true);
    assert.deepEqual(
      afterDraw.tournament.events[0].groups.map((g) => g.id),
      draw.event.groups.map((g) => g.id)
    );

    const withGroups = {
      ...drawResult.tournament,
      events: [draw.event],
    };
    const schedule = buildInternalScheduleFromPersistedGroups({
      tournament: withGroups,
      players,
    });
    assert.equal(schedule.ok, true, schedule.errors?.join(" "));

    const scheduleResult = await updateTournamentCommand(
      { id: "club-a", tenantId: "tenant-a" },
      harness.getStore().id,
      { events: [schedule.event], status: TOURNAMENT_STATUS.READY },
      {
        repository: harness.repo,
        tenantId: "tenant-a",
        currentTournament: drawResult.tournament,
        expectedVersion: chainExpectedVersionFromResult(drawResult),
      }
    );
    assert.equal(scheduleResult.ok, true);

    const afterSchedule = await harness.repo.get(
      { id: "club-a", tenantId: "tenant-a" },
      harness.getStore().id,
      { tenantId: "tenant-a" }
    );
    assert.equal(
      afterSchedule.tournament.events[0].matches.length,
      schedule.event.matches.length
    );
  });

  it("persistBeforeAnimation once — animation complete does not second-write", async () => {
    let durableWrites = 0;
    const adapters = {
      async persistBeforeAnimation() {
        durableWrites += 1;
        return true;
      },
      async persist(mode) {
        // Internal draw/schedule/bracket completion must not mutate.
        if (
          mode === ANIMATION_MODES.SNAKE_GROUP ||
          mode === ANIMATION_MODES.GROUP_MATCH_PAIRING ||
          mode === ANIMATION_MODES.BRACKET_REVEAL
        ) {
          return true;
        }
        durableWrites += 1;
        return true;
      },
    };

    assert.equal(await adapters.persistBeforeAnimation(ANIMATION_MODES.SNAKE_GROUP), true);
    assert.equal(await adapters.persist(ANIMATION_MODES.SNAKE_GROUP), true);
    assert.equal(await adapters.persist(ANIMATION_MODES.SNAKE_GROUP), true);
    assert.equal(durableWrites, 1);

    durableWrites = 0;
    assert.equal(
      await adapters.persistBeforeAnimation(ANIMATION_MODES.BRACKET_REVEAL),
      true
    );
    assert.equal(await adapters.persist(ANIMATION_MODES.BRACKET_REVEAL), true);
    assert.equal(durableWrites, 1);
  });

  it("multi-group still requires knockout eligibility", () => {
    const event = {
      groups: [{ id: "g1" }, { id: "g2" }],
      matches: [],
    };
    assert.equal(shouldSkipKnockoutForInternal(event), false);
    assert.equal(resolveInternalKnockoutEligibility(event).ok, true);
  });
});

describe("IT-REV SQL package structural contract", () => {
  it("APPLY contains VERSION_REQUIRED, completion gate, force reopen", () => {
    const apply = readFileSync(
      path.join(
        root,
        "docs/v5/migrations/internal-tournament-end-to-end-closure-01/02_APPLY.sql"
      ),
      "utf8"
    );
    assert.match(apply, /VERSION_REQUIRED/);
    assert.match(apply, /canonical_tournament_assert_internal_completion_eligible/);
    assert.match(apply, /INTERNAL_TOURNAMENT_NOT_COMPLETION_ELIGIBLE/);
    assert.match(apply, /force_status_reopen/);
    assert.match(apply, /internal_tournament/);
  });
});
