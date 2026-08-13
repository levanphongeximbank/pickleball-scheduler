/**
 * Internal Tournament end-to-end closure Pass 2 — focused unit suite (IT-E2E-011).
 */
import assert from "node:assert/strict";
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
  validateInternalTournamentStatusTransition,
  INTERNAL_STATUS_TRANSITION_ERROR,
  resolveStatusAfterMatchActivity,
} from "../src/features/tournament/internal/internalTournamentStatusTransitions.js";
import {
  hydrateInternalSetupFromTournament,
} from "../src/features/tournament/internal/internalTournamentSetupHydration.js";
import {
  buildInternalDrawEventWithoutMatches,
  buildInternalScheduleFromPersistedGroups,
  buildInternalTournamentPlan,
} from "../src/tournament/engines/internalTournamentEngine.js";
import {
  assertNoKnockoutMatchesForOneGroup,
  canFinishOneGroupInternal,
  resolveInternalKnockoutEligibility,
  resolveOneGroupChampionProjection,
  shouldSkipKnockoutForInternal,
} from "../src/features/tournament/internal/internalTournamentOneGroupCompletion.js";
import { resolveInternalTournamentLifecycle } from "../src/features/tournament/internal/internalTournamentLifecycleResolver.js";
import {
  CANONICAL_VERSION_CONFLICT_USER_MESSAGE,
  formatCanonicalVersionConflictError,
  isCanonicalVersionConflict,
} from "../src/features/tournament/internal/canonicalTournamentCas.js";
import { closeTournament } from "../src/features/individual-tournament/engines/tournamentClosingEngine.js";

function makePlayer(id, genderLabel) {
  return {
    id,
    name: `P-${id}`,
    gender: genderLabel,
    level: 3,
  };
}

function makeMixedPlayers(count = 8) {
  const players = [];
  for (let i = 0; i < count; i += 1) {
    players.push(makePlayer(`p${i + 1}`, i % 2 === 0 ? "Nam" : "Nữ"));
  }
  return players;
}

function makeTournamentShell(overrides = {}) {
  return {
    id: "it-e2e-1",
    clubId: "club-a",
    tenantId: "tenant-a",
    name: "Internal E2E",
    mode: TOURNAMENT_MODE.INTERNAL_TOURNAMENT,
    status: TOURNAMENT_STATUS.DRAFT,
    version: 1,
    events: [],
    settings: {},
    ...overrides,
  };
}

describe("IT-E2E Pass2 — status transitions", () => {
  it("allows draft → ready and rejects completed → ready", () => {
    assert.equal(
      validateInternalTournamentStatusTransition("draft", "ready").ok,
      true
    );
    const denied = validateInternalTournamentStatusTransition(
      "completed",
      "ready"
    );
    assert.equal(denied.ok, false);
    assert.equal(denied.code, INTERNAL_STATUS_TRANSITION_ERROR);
  });

  it("allows force reopen completed → active only", () => {
    assert.equal(
      validateInternalTournamentStatusTransition("completed", "active", {
        forceReopen: true,
      }).ok,
      true
    );
    assert.equal(
      validateInternalTournamentStatusTransition("completed", "active").ok,
      false
    );
  });

  it("bumps ready → active after match activity", () => {
    assert.equal(
      resolveStatusAfterMatchActivity(TOURNAMENT_STATUS.READY),
      TOURNAMENT_STATUS.ACTIVE
    );
  });
});

describe("IT-E2E Pass2 — hydration", () => {
  it("hydrates eventType, groupCount, selectedPlayerIds from payload", () => {
    const tournament = makeTournamentShell({
      events: [
        {
          id: "ev1",
          eventType: EVENT_TYPE.MEN_DOUBLE,
          entries: [
            { id: "e1", playerIds: ["a", "b"] },
            { id: "e2", playerIds: ["c", "d"] },
          ],
          groups: [{ id: "g1", name: "A", entryIds: ["e1", "e2"] }],
          matches: [{ id: "m1" }],
        },
      ],
      version: 4,
    });
    const hydrated = hydrateInternalSetupFromTournament(tournament);
    assert.equal(hydrated.eventType, EVENT_TYPE.MEN_DOUBLE);
    assert.equal(hydrated.groupCount, 1);
    assert.deepEqual(hydrated.selectedPlayerIds, ["a", "b", "c", "d"]);
    assert.equal(hydrated.hasGroups, true);
    assert.equal(hydrated.hasSchedule, true);
  });
});

describe("IT-E2E Pass2 — draw/schedule durability", () => {
  it("draw event strips matches; schedule from groups is idempotent-guarded", () => {
    const players = makeMixedPlayers(8);
    const tournament = makeTournamentShell();
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
    assert.equal((draw.event.matches || []).length, 0);
    assert.ok((draw.event.groups || []).length >= 2);

    const withGroups = {
      ...tournament,
      events: [draw.event],
      status: TOURNAMENT_STATUS.READY,
    };

    const schedule = buildInternalScheduleFromPersistedGroups({
      tournament: withGroups,
      players,
    });
    assert.equal(schedule.ok, true, schedule.errors?.join(" "));
    assert.ok((schedule.event.matches || []).length > 0);

    const again = buildInternalScheduleFromPersistedGroups({
      tournament: { ...withGroups, events: [schedule.event] },
      players,
    });
    assert.equal(again.ok, false);
    assert.equal(again.code, "SCHEDULE_ALREADY_EXISTS");
  });
});

describe("IT-E2E Pass2 — one-group completion", () => {
  it("skips knockout and derives champion from standings after RR complete", () => {
    const players = makeMixedPlayers(4);
    const tournament = makeTournamentShell();
    const plan = buildInternalTournamentPlan({
      tournament,
      players,
      selectedPlayerIds: players.map((p) => p.id),
      eventType: EVENT_TYPE.MIXED_DOUBLE,
      groupCount: 1,
    });
    assert.equal(plan.ok, true, plan.errors?.join(" "));

    const event = {
      ...plan.event,
      matches: (plan.event.matches || []).map((match, index) => ({
        ...match,
        status: MATCH_STATUS.COMPLETED,
        winnerId: match.entryAId,
        loserId: match.entryBId,
        scoreA: 11,
        scoreB: 5,
        id: match.id || `m-${index}`,
      })),
    };

    assert.equal(shouldSkipKnockoutForInternal(event), true);
    assert.equal(resolveInternalKnockoutEligibility(event).skipKnockout, true);
    assert.equal(assertNoKnockoutMatchesForOneGroup(event).ok, true);

    const live = makeTournamentShell({
      status: TOURNAMENT_STATUS.ACTIVE,
      events: [event],
    });
    const finish = canFinishOneGroupInternal(live);
    assert.equal(finish.ok, true, finish.error);

    const champ = resolveOneGroupChampionProjection(live);
    assert.equal(champ.ok, true);
    assert.ok(champ.champion);
    assert.equal(champ.knockoutGenerated, false);

    const closed = closeTournament(live, { autoAwards: true });
    assert.equal(closed.ok, true);
    assert.equal(closed.tournament.status, TOURNAMENT_STATUS.COMPLETED);

    const lifecycle = resolveInternalTournamentLifecycle(closed.tournament);
    assert.equal(lifecycle.oneGroup, true);
    assert.equal(lifecycle.skipKnockout, true);
    assert.ok(
      lifecycle.COMPLETED_STEPS.includes("COMPLETED") ||
        lifecycle.CURRENT_STEP === "COMPLETED" ||
        lifecycle.CURRENT_STEP === "AWARDS"
    );
  });

  it("incomplete RR cannot finish one-group", () => {
    const players = makeMixedPlayers(4);
    const tournament = makeTournamentShell();
    const plan = buildInternalTournamentPlan({
      tournament,
      players,
      selectedPlayerIds: players.map((p) => p.id),
      eventType: EVENT_TYPE.MIXED_DOUBLE,
      groupCount: 1,
    });
    const live = makeTournamentShell({
      events: [plan.event],
    });
    const finish = canFinishOneGroupInternal(live);
    assert.equal(finish.ok, false);
    assert.equal(finish.code, "GROUP_INCOMPLETE");
  });
});

describe("IT-E2E Pass2 — multi-group KO regression", () => {
  it("keeps knockout eligible for 2 groups", () => {
    const players = makeMixedPlayers(8);
    const tournament = makeTournamentShell();
    const plan = buildInternalTournamentPlan({
      tournament,
      players,
      selectedPlayerIds: players.map((p) => p.id),
      eventType: EVENT_TYPE.MIXED_DOUBLE,
      groupCount: 2,
    });
    assert.equal(plan.ok, true);
    assert.equal(shouldSkipKnockoutForInternal(plan.event), false);
    assert.equal(resolveInternalKnockoutEligibility(plan.event).ok, true);
    assert.equal((plan.event.groups || []).length >= 2, true);
  });
});

describe("IT-E2E Pass2 — CAS concurrency", () => {
  it("stale expectedVersion returns VERSION_CONFLICT with zero mutation", async () => {
    let store = {
      id: "11111111-1111-1111-1111-111111111111",
      tenant_id: "tenant-a",
      club_id: "club-a",
      external_key: "it-e2e-1",
      name: "Internal E2E",
      mode: TOURNAMENT_MODE.INTERNAL_TOURNAMENT,
      status: TOURNAMENT_STATUS.READY,
      season_id: null,
      league_id: null,
      payload: {
        events: [{ id: "ev1", entries: [], groups: [{ id: "g1" }], matches: [] }],
        settings: {},
      },
      engine_v4: {},
      version: 3,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    let writeCount = 0;

    const repo = createCloudTournamentRepository({
      rpc: async (name, args) => {
        if (name === "canonical_tournament_get") {
          return { ok: true, tournament: store };
        }
        if (name === "canonical_tournament_update") {
          const expected = args.p_patch?.expected_version;
          if (expected != null && Number(expected) !== Number(store.version)) {
            return {
              ok: false,
              code: "VERSION_CONFLICT",
              expectedVersion: expected,
              currentVersion: store.version,
            };
          }
          writeCount += 1;
          store = {
            ...store,
            payload: args.p_patch.payload || store.payload,
            status: args.p_patch.status || store.status,
            version: Number(store.version) + 1,
            updated_at: new Date().toISOString(),
          };
          return { ok: true, tournament: store };
        }
        return { ok: false, code: "UNEXPECTED", error: name };
      },
    });

    const first = await updateTournamentCommand(
      { id: "club-a", tenantId: "tenant-a" },
      store.id,
      { name: "tab-1" },
      {
        repository: repo,
        tenantId: "tenant-a",
        currentTournament: canonicalRowToTournament(store),
        expectedVersion: 3,
      }
    );
    assert.equal(first.ok, true);
    assert.equal(writeCount, 1);
    assert.equal(first.tournament.version, 4);

    const stale = await updateTournamentCommand(
      { id: "club-a", tenantId: "tenant-a" },
      store.id,
      { name: "tab-2-stale" },
      {
        repository: repo,
        tenantId: "tenant-a",
        currentTournament: {
          ...canonicalRowToTournament(store),
          version: 3,
          name: "stale-view",
        },
        expectedVersion: 3,
      }
    );
    assert.equal(stale.ok, false);
    assert.equal(isCanonicalVersionConflict(stale), true);
    assert.equal(stale.error, CANONICAL_VERSION_CONFLICT_USER_MESSAGE);
    assert.equal(writeCount, 1);
    assert.equal(store.version, 4);
    assert.notEqual(store.payload?.name, "tab-2-stale");
  });

  it("formats conflict message for UI", () => {
    assert.equal(
      formatCanonicalVersionConflictError({
        ok: false,
        code: "VERSION_CONFLICT",
      }),
      CANONICAL_VERSION_CONFLICT_USER_MESSAGE
    );
  });
});

describe("IT-E2E Pass2 — mapper version + illegal Internal status via repo", () => {
  it("maps version from row and blocks illegal status client-side", async () => {
    const row = {
      id: "22222222-2222-2222-2222-222222222222",
      tenant_id: "tenant-a",
      club_id: "club-a",
      name: "T",
      mode: TOURNAMENT_MODE.INTERNAL_TOURNAMENT,
      status: TOURNAMENT_STATUS.COMPLETED,
      payload: {},
      engine_v4: {},
      version: 9,
    };
    const mapped = canonicalRowToTournament(row);
    assert.equal(mapped.version, 9);

    const repo = createCloudTournamentRepository({
      rpc: async (name) => {
        if (name === "canonical_tournament_get") {
          return { ok: true, tournament: row };
        }
        throw new Error("update must not be called");
      },
    });

    const denied = await repo.update(
      { id: "club-a", tenantId: "tenant-a" },
      row.id,
      { status: TOURNAMENT_STATUS.READY },
      { tenantId: "tenant-a", expectedVersion: 9 }
    );
    assert.equal(denied.ok, false);
    assert.equal(denied.code, "INTERNAL_STATUS_TRANSITION_DENIED");
  });

  it("does not enforce Internal transition graph for team_tournament mode", async () => {
    const row = {
      id: "33333333-3333-3333-3333-333333333333",
      tenant_id: "tenant-a",
      club_id: "club-a",
      name: "Team",
      mode: TOURNAMENT_MODE.TEAM_TOURNAMENT,
      status: TOURNAMENT_STATUS.DRAFT,
      payload: {},
      engine_v4: {},
      version: 1,
    };
    let updated = false;
    const repo = createCloudTournamentRepository({
      rpc: async (name, args) => {
        if (name === "canonical_tournament_get") {
          return { ok: true, tournament: row };
        }
        if (name === "canonical_tournament_update") {
          updated = true;
          return {
            ok: true,
            tournament: {
              ...row,
              status: args.p_patch.status,
              version: 2,
            },
          };
        }
        return { ok: false };
      },
    });

    const result = await repo.update(
      { id: "club-a", tenantId: "tenant-a" },
      row.id,
      { status: TOURNAMENT_STATUS.COMPLETED },
      { tenantId: "tenant-a", expectedVersion: 1 }
    );
    assert.equal(result.ok, true);
    assert.equal(updated, true);
  });
});

describe("IT-E2E Pass2 — lifecycle resolver", () => {
  it("points to SCHEDULE when groups exist without matches", () => {
    const lifecycle = resolveInternalTournamentLifecycle(
      makeTournamentShell({
        status: TOURNAMENT_STATUS.READY,
        events: [
          {
            id: "ev",
            entries: [{ id: "e1", playerIds: ["p1", "p2"] }],
            groups: [{ id: "g1", entryIds: ["e1"] }],
            matches: [],
          },
        ],
      })
    );
    assert.equal(lifecycle.CURRENT_STEP, "SCHEDULE");
    assert.match(lifecycle.PRIMARY_ACTION_LABEL, /lịch/i);
  });
});
