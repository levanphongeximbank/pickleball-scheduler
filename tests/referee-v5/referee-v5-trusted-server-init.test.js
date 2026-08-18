/**
 * Trusted-server wiring for match-execution initialization.
 * JWT + Identity + organizer PREPARE_OPERATIONS. Client actor/role/tenant ignored.
 */

import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { createScoringFormat } from "../../src/features/competition-core/scoring/index.js";
import { MATCH_STATUS } from "../../src/features/referee-v5/constants/eventTypes.js";
import { InMemoryMatchRepository } from "../../src/features/referee-v5/persistence/InMemoryMatchRepository.js";
import { REFEREE_V5_ERROR } from "../../src/features/referee-v5/persistence/errors.js";
import { buildMatchStateId } from "../../src/features/referee-v5/persistence/matchStateSerializer.js";
import {
  handleRefereeV5MatchAction,
  handleRefereeV5MatchHttpRequest,
} from "../../src/features/referee-v5/server/edgeHttpHandler.js";
import { TRUSTED_INIT_REJECTED_FIELDS } from "../../src/features/referee-v5/server/trustedMatchExecutionInit.js";
import { MATCH_EXECUTION_INIT_RPC } from "../../src/features/referee-v5/execution/matchExecutionInitPolicy.js";
import {
  REFEREE_V5_ACTIONS,
  refereeV5EdgeInitializeExecution,
} from "../../src/features/referee-v5/services/refereeV5EdgeClient.js";
import { findSecretCandidates } from "../../scripts/phase5d-br01-br10/secret-scanner.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const TENANT = "tenant-1";
const OTHER_TENANT = "tenant-2";
const TOURNAMENT = "internal-comp-1";
const OTHER_TOURNAMENT = "internal-comp-2";
const MATCH = "match-1";
const ORGANIZER_ID = "organizer-1";
const REFEREE_ID = "referee-1";
const PLAYER_ID = "player-1";
const FOREIGN_ID = "foreign-organizer-1";
const VENUE_ONLY_ID = "venue-only-1";
const ADMIN_ID = "platform-admin-1";

const SCORING = createScoringFormat({
  scoringSystem: "SIDE_OUT",
  pointsToWin: 11,
  winBy: 2,
  bestOfGames: 1,
});

function internalPayload(overrides = {}) {
  return {
    tenantId: TENANT,
    events: [
      {
        id: "event-1",
        eventType: "men_double",
        entries: [
          { id: "entry-a", playerIds: ["p-a1", "p-a2"] },
          { id: "entry-b", playerIds: ["p-b1", "p-b2"] },
        ],
        matches: [
          {
            id: MATCH,
            status: "waiting",
            entryAId: "entry-a",
            entryBId: "entry-b",
            scoringRules: SCORING,
            lineupsLocked: true,
          },
        ],
      },
    ],
    ...overrides,
  };
}

function tournamentRow(overrides = {}) {
  return {
    id: TOURNAMENT,
    tenant_id: TENANT,
    club_id: "club-1",
    mode: "internal_tournament",
    status: "active",
    payload: internalPayload(),
    engine_v4: {},
    name: "Internal",
    ...overrides,
  };
}

function profile({ id, role, tenantId = TENANT, venueId = "venue-1", status = "active" }) {
  return {
    id,
    role,
    status,
    tenant_id: tenantId,
    venue_id: venueId,
    club_id: "club-1",
  };
}

function createQuery(rowsById) {
  return {
    select() {
      return this;
    },
    eq(column, value) {
      this._id = String(value);
      this._column = column;
      return this;
    },
    async maybeSingle() {
      const row = rowsById.get(this._id) || null;
      return { data: row, error: null };
    },
  };
}

function createHarness(options = {}) {
  const profiles = new Map(
    options.profiles ||
      [
        profile({ id: ORGANIZER_ID, role: "TOURNAMENT_MANAGER" }),
        profile({ id: REFEREE_ID, role: "REFEREE" }),
        profile({ id: PLAYER_ID, role: "PLAYER" }),
        profile({ id: FOREIGN_ID, role: "TOURNAMENT_MANAGER", tenantId: OTHER_TENANT }),
        profile({ id: VENUE_ONLY_ID, role: "TOURNAMENT_MANAGER", tenantId: null, venueId: TENANT }),
        profile({ id: ADMIN_ID, role: "PLATFORM_ADMIN", tenantId: null, venueId: null }),
      ].map((row) => [row.id, row])
  );
  const tournaments = new Map(
    (options.tournaments || [tournamentRow()]).map((row) => [String(row.id), row])
  );
  const repository = options.repository || new InMemoryMatchRepository();
  const rpcCalls = [];
  const userRpcCalls = [];

  const userClient = {
    auth: {
      getUser: async () => {
        if (options.authError) {
          return { data: { user: null }, error: { message: "Invalid JWT" } };
        }
        if (!options.userId) {
          return { data: { user: null }, error: { message: "No session" } };
        }
        return { data: { user: { id: options.userId } }, error: null };
      },
    },
    rpc: async (name, payload) => {
      userRpcCalls.push({ name, payload });
      return { data: { ok: false, code: "BROWSER_RPC_FORBIDDEN" }, error: null };
    },
  };

  const serviceClient = {
    from(table) {
      if (table === "profiles") return createQuery(profiles);
      if (table === "canonical_tournaments") return createQuery(tournaments);
      return createQuery(new Map());
    },
    rpc: async (name, payload) => {
      rpcCalls.push({ name, payload });
      if (name === "team_tournament_provision_referee_match" || name === "daily_play_start_match") {
        return { data: { ok: false, code: "FORBIDDEN_WRITER" }, error: null };
      }
      if (name !== MATCH_EXECUTION_INIT_RPC) {
        return { data: { ok: false, code: "UNKNOWN_RPC" }, error: null };
      }
      const inner = await repository.initializeExecutionState({
        tenantId: payload.p_tenant_id,
        tournamentId: payload.p_tournament_id,
        matchId: payload.p_match_id,
        initialState: payload.p_initial_state,
        teamAId: payload.p_team_a_id,
        teamBId: payload.p_team_b_id,
        idempotencyKey: payload.p_idempotency_key,
        requestHash: payload.p_request_hash,
      });
      return { data: inner, error: null };
    },
  };

  return { userClient, serviceClient, rpcCalls, userRpcCalls, repository, profiles, tournaments };
}

async function initializeAction(harness, body) {
  return handleRefereeV5MatchAction({
    action: REFEREE_V5_ACTIONS.INITIALIZE_EXECUTION,
    body,
    userClient: harness.userClient,
    serviceClient: harness.serviceClient,
  });
}

function validBody(overrides = {}) {
  return {
    action: REFEREE_V5_ACTIONS.INITIALIZE_EXECUTION,
    tournamentId: TOURNAMENT,
    matchId: MATCH,
    competitionMode: "INTERNAL",
    idempotencyKey: "init-edge-1",
    ...overrides,
  };
}

test("unauthenticated initialize is denied", async () => {
  const response = await handleRefereeV5MatchHttpRequest(
    new Request("https://example.test/functions/v1/referee-v5-match", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(validBody()),
    }),
    { createSupabaseClients: () => ({}) }
  );
  assert.equal(response.status, 401);
  const payload = await response.json();
  assert.equal(payload.ok, false);
  assert.equal(payload.code, REFEREE_V5_ERROR.TENANT_ACCESS_DENIED);
});

test("invalid JWT is denied", async () => {
  const harness = createHarness({ userId: ORGANIZER_ID, authError: true });
  const result = await initializeAction(harness, validBody());
  assert.equal(result.httpStatus, 401);
  assert.equal(result.body.ok, false);
  assert.equal(result.body.code, REFEREE_V5_ERROR.TENANT_ACCESS_DENIED);
  assert.equal(harness.rpcCalls.length, 0);
});

test("REFEREE role alone is denied", async () => {
  const harness = createHarness({ userId: REFEREE_ID });
  const result = await initializeAction(harness, validBody({ idempotencyKey: "ref-deny" }));
  assert.equal(result.body.ok, false);
  assert.equal(result.body.code, REFEREE_V5_ERROR.VALIDATION_DENIED);
  assert.equal(harness.rpcCalls.length, 0);
});

test("PLAYER is denied", async () => {
  const harness = createHarness({ userId: PLAYER_ID });
  const result = await initializeAction(harness, validBody({ idempotencyKey: "player-deny" }));
  assert.equal(result.body.ok, false);
  assert.equal(result.body.code, REFEREE_V5_ERROR.VALIDATION_DENIED);
  assert.equal(harness.rpcCalls.length, 0);
});

test("foreign Tenant actor is denied", async () => {
  const harness = createHarness({ userId: FOREIGN_ID });
  const result = await initializeAction(harness, validBody({ idempotencyKey: "foreign-deny" }));
  assert.equal(result.body.ok, false);
  assert.equal(result.body.code, REFEREE_V5_ERROR.TENANT_ACCESS_DENIED);
  assert.equal(harness.rpcCalls.length, 0);
});

test("browser-spoofed actorId is ignored and JWT principal is used", async () => {
  const harness = createHarness({ userId: REFEREE_ID });
  const result = await initializeAction(
    harness,
    validBody({
      idempotencyKey: "spoof-actor",
      actorId: ORGANIZER_ID,
      userId: ORGANIZER_ID,
      actor: { actorId: ORGANIZER_ID, role: "ORGANIZER", tenantId: TENANT },
    })
  );
  assert.equal(result.body.ok, false);
  assert.equal(result.body.code, REFEREE_V5_ERROR.VALIDATION_DENIED);
  assert.equal(harness.rpcCalls.length, 0);
});

test("browser-spoofed actorRole is ignored", async () => {
  const harness = createHarness({ userId: PLAYER_ID });
  const result = await initializeAction(
    harness,
    validBody({
      idempotencyKey: "spoof-role",
      role: "TOURNAMENT_MANAGER",
      actorRole: "SUPER_ADMIN",
      tenantRole: "OWNER",
    })
  );
  assert.equal(result.body.ok, false);
  assert.equal(result.body.code, REFEREE_V5_ERROR.VALIDATION_DENIED);
});

test("browser-spoofed tenantId cannot grant access", async () => {
  const harness = createHarness({ userId: FOREIGN_ID });
  const result = await initializeAction(
    harness,
    validBody({
      idempotencyKey: "spoof-tenant",
      tenantId: TENANT,
      tenant_id: TENANT,
    })
  );
  assert.equal(result.body.ok, false);
  assert.equal(result.body.code, REFEREE_V5_ERROR.TENANT_ACCESS_DENIED);
});

test("Venue cannot substitute Tenant", async () => {
  const harness = createHarness({ userId: VENUE_ONLY_ID });
  const result = await initializeAction(harness, validBody({ idempotencyKey: "venue-deny" }));
  assert.equal(result.body.ok, false);
  assert.equal(result.body.code, REFEREE_V5_ERROR.TENANT_ACCESS_DENIED);
  assert.equal(harness.rpcCalls.length, 0);
});

test("authorized organizer valid INTERNAL match passes", async () => {
  const harness = createHarness({ userId: ORGANIZER_ID });
  const result = await initializeAction(harness, validBody());
  assert.equal(result.httpStatus, 200);
  assert.equal(result.body.ok, true);
  assert.equal(result.body.initialized, true);
  assert.equal(result.body.reset, false);
  assert.equal(result.body.matchId, MATCH);
  assert.equal(result.body.status, MATCH_STATUS.NOT_STARTED);
  assert.deepEqual(
    harness.rpcCalls.map((call) => call.name),
    [MATCH_EXECUTION_INIT_RPC]
  );
  assert.equal(harness.userRpcCalls.length, 0);
  assert.equal(result.body.actorId, undefined);
});

test("Supabase Edge globalThis.window does not deny trusted initialize-execution", async () => {
  const hadWindow = Object.prototype.hasOwnProperty.call(globalThis, "window");
  const previous = hadWindow ? globalThis.window : undefined;
  globalThis.window = { supabaseEdgeExposesWindow: true };
  try {
    const harness = createHarness({ userId: ORGANIZER_ID });
    const result = await initializeAction(
      harness,
      validBody({ idempotencyKey: "edge-window-false-positive" })
    );
    assert.equal(result.httpStatus, 200);
    assert.equal(result.body.ok, true);
    assert.equal(result.body.initialized, true);
    assert.notEqual(result.body.code, REFEREE_V5_ERROR.INTERNAL_RPC_FORBIDDEN);
    assert.deepEqual(
      harness.rpcCalls.map((call) => call.name),
      [MATCH_EXECUTION_INIT_RPC]
    );
  } finally {
    if (hadWindow) globalThis.window = previous;
    else delete globalThis.window;
  }
});

test("client authority fields stay denied when globalThis.window exists", async () => {
  const hadWindow = Object.prototype.hasOwnProperty.call(globalThis, "window");
  const previous = hadWindow ? globalThis.window : undefined;
  globalThis.window = { supabaseEdgeExposesWindow: true };
  try {
    const harness = createHarness({ userId: PLAYER_ID });
    const result = await initializeAction(
      harness,
      validBody({
        idempotencyKey: "window-spoof-role",
        actor: { actorId: ORGANIZER_ID, role: "ORGANIZER", tenantId: TENANT },
        actorId: ORGANIZER_ID,
        role: "TOURNAMENT_MANAGER",
        tenantId: TENANT,
        initialState: { status: MATCH_STATUS.COMPLETED, version: 99 },
        adapter: { contractId: "forged" },
        serviceRoleKey: "not-a-key",
      })
    );
    assert.equal(result.body.ok, false);
    assert.equal(result.body.code, REFEREE_V5_ERROR.VALIDATION_DENIED);
    assert.equal(harness.rpcCalls.length, 0);
  } finally {
    if (hadWindow) globalThis.window = previous;
    else delete globalThis.window;
  }
});

test("Super Admin with explicit tournament target can initialize", async () => {
  const harness = createHarness({ userId: ADMIN_ID });
  const result = await initializeAction(harness, validBody({ idempotencyKey: "admin-init" }));
  assert.equal(result.body.ok, true);
  assert.equal(result.body.initialized, true);
});

test("unknown match is denied", async () => {
  const harness = createHarness({ userId: ORGANIZER_ID });
  const result = await initializeAction(
    harness,
    validBody({ matchId: "missing-match", idempotencyKey: "unknown-match" })
  );
  assert.equal(result.body.ok, false);
  assert.equal(result.body.code, REFEREE_V5_ERROR.MATCH_NOT_FOUND);
});

test("wrong tournament is denied", async () => {
  const harness = createHarness({
    userId: ORGANIZER_ID,
    tournaments: [
      tournamentRow(),
      tournamentRow({
        id: OTHER_TOURNAMENT,
        payload: internalPayload({
          events: [
            {
              id: "event-x",
              entries: [],
              matches: [{ id: "other-match", entryAId: "a", entryBId: "b", scoringRules: SCORING }],
            },
          ],
        }),
      }),
    ],
  });
  const result = await initializeAction(
    harness,
    validBody({ tournamentId: OTHER_TOURNAMENT, idempotencyKey: "wrong-tournament" })
  );
  assert.equal(result.body.ok, false);
  assert.equal(result.body.code, REFEREE_V5_ERROR.MATCH_NOT_FOUND);
});

test("Adapter B missing fails closed", async () => {
  const harness = createHarness({
    userId: ORGANIZER_ID,
    tournaments: [tournamentRow({ mode: "unknown_format", payload: { events: [] } })],
  });
  const result = await initializeAction(harness, validBody({ competitionMode: undefined, idempotencyKey: "no-adapter" }));
  assert.equal(result.body.ok, false);
  assert.equal(result.body.code, REFEREE_V5_ERROR.NOT_CONFIGURED);
});

test("missing scoring rules fail closed", async () => {
  const harness = createHarness({
    userId: ORGANIZER_ID,
    tournaments: [
      tournamentRow({
        payload: internalPayload({
          events: [
            {
              id: "event-1",
              entries: [
                { id: "entry-a", playerIds: ["p-a1", "p-a2"] },
                { id: "entry-b", playerIds: ["p-b1", "p-b2"] },
              ],
              matches: [
                {
                  id: MATCH,
                  entryAId: "entry-a",
                  entryBId: "entry-b",
                },
              ],
            },
          ],
        }),
      }),
    ],
  });
  const result = await initializeAction(harness, validBody({ idempotencyKey: "no-scoring" }));
  assert.equal(result.body.ok, false);
  assert.ok(
    result.body.code === REFEREE_V5_ERROR.NOT_CONFIGURED ||
      result.body.code === REFEREE_V5_ERROR.VALIDATION_DENIED
  );
});

test("duplicate init is deterministic replay", async () => {
  const harness = createHarness({ userId: ORGANIZER_ID });
  const first = await initializeAction(harness, validBody({ idempotencyKey: "dup-1" }));
  const second = await initializeAction(harness, validBody({ idempotencyKey: "dup-1" }));
  assert.equal(first.body.ok, true);
  assert.equal(second.body.ok, true);
  assert.equal(second.body.duplicate, true);
  assert.equal(second.body.reset, false);
  assert.equal(second.body.stateVersion, first.body.stateVersion);
});

test("active state is never reset", async () => {
  const harness = createHarness({ userId: ORGANIZER_ID });
  const first = await initializeAction(harness, validBody({ idempotencyKey: "active-1" }));
  assert.equal(first.body.ok, true);
  const matchStateId = buildMatchStateId({
    tenantId: TENANT,
    tournamentId: TOURNAMENT,
    matchId: MATCH,
  });
  const live = harness.repository.getLiveState(matchStateId);
  live.status = MATCH_STATUS.IN_PROGRESS;
  live.stateVersion = 3;
  live.lastEventSequence = 2;
  const again = await initializeAction(harness, validBody({ idempotencyKey: "active-2" }));
  assert.equal(again.body.ok, false);
  assert.equal(again.body.code, REFEREE_V5_ERROR.MATCH_ALREADY_ACTIVE);
  assert.equal(harness.repository.getLiveState(matchStateId).status, MATCH_STATUS.IN_PROGRESS);
});

test("completed and locked states are never reset", async () => {
  const completedHarness = createHarness({ userId: ORGANIZER_ID });
  assert.equal((await initializeAction(completedHarness, validBody({ idempotencyKey: "done-1" }))).body.ok, true);
  const completedId = buildMatchStateId({ tenantId: TENANT, tournamentId: TOURNAMENT, matchId: MATCH });
  completedHarness.repository.getLiveState(completedId).status = MATCH_STATUS.COMPLETED;
  const completedAgain = await initializeAction(
    completedHarness,
    validBody({ idempotencyKey: "done-2" })
  );
  assert.equal(completedAgain.body.ok, false);
  assert.equal(completedAgain.body.code, REFEREE_V5_ERROR.TERMINAL_STATE);

  const lockedHarness = createHarness({ userId: ORGANIZER_ID });
  assert.equal((await initializeAction(lockedHarness, validBody({ idempotencyKey: "lock-1" }))).body.ok, true);
  const lockedId = buildMatchStateId({ tenantId: TENANT, tournamentId: TOURNAMENT, matchId: MATCH });
  lockedHarness.repository.lockLiveState(lockedId, ORGANIZER_ID);
  const lockedAgain = await initializeAction(lockedHarness, validBody({ idempotencyKey: "lock-2" }));
  assert.equal(lockedAgain.body.ok, false);
  assert.equal(lockedAgain.body.code, REFEREE_V5_ERROR.MATCH_LOCKED);
});

test("only server-created service client reaches initializer RPC", async () => {
  const harness = createHarness({ userId: ORGANIZER_ID });
  const result = await initializeAction(harness, validBody({ idempotencyKey: "svc-only" }));
  assert.equal(result.body.ok, true);
  assert.equal(harness.userRpcCalls.length, 0);
  assert.equal(harness.rpcCalls.length, 1);
  assert.equal(harness.rpcCalls[0].name, MATCH_EXECUTION_INIT_RPC);
});

test("client Adapter object and initialState are ignored", async () => {
  const harness = createHarness({ userId: ORGANIZER_ID });
  const spoof = {};
  for (const field of TRUSTED_INIT_REJECTED_FIELDS) {
    spoof[field] = field === "adapter"
      ? { contractId: "forged", getMatchContext: () => ({ matchId: "forged" }) }
      : field === "modeState"
        ? { tenantId: OTHER_TENANT, matches: {} }
        : field === "initialState"
          ? { status: MATCH_STATUS.COMPLETED, version: 99 }
          : "client-forged";
  }
  const result = await initializeAction(
    harness,
    validBody({
      idempotencyKey: "ignore-adapter",
      ...spoof,
    })
  );
  assert.equal(result.body.ok, true);
  assert.equal(result.body.status, MATCH_STATUS.NOT_STARTED);
});

test("Team RPC and Daily writer are not invoked", async () => {
  const harness = createHarness({ userId: ORGANIZER_ID });
  await initializeAction(harness, validBody({ idempotencyKey: "no-writers" }));
  assert.equal(
    harness.rpcCalls.some((call) => call.name === "team_tournament_provision_referee_match"),
    false
  );
  assert.equal(
    harness.rpcCalls.some((call) => call.name === "daily_play_start_match"),
    false
  );
});

test("browser Edge client sends only non-authoritative fields", () => {
  const source = readFileSync(
    path.join(ROOT, "src/features/referee-v5/services/refereeV5EdgeClient.js"),
    "utf8"
  );
  assert.match(source, /INITIALIZE_EXECUTION: "initialize-execution"/);
  const fn = source.slice(source.indexOf("refereeV5EdgeInitializeExecution"));
  assert.equal(fn.includes("actorId"), false);
  assert.equal(fn.includes("serviceRoleKey"), false);
  assert.equal(fn.includes("initialState"), false);
});

test("browser bundle path contains no service-role", () => {
  const files = [
    path.join(ROOT, "src/features/referee-v5/services/refereeV5EdgeClient.js"),
    path.join(ROOT, "src/features/referee-v5/services/refereeV5RpcService.js"),
    path.join(ROOT, "src/features/referee-v5/index.js"),
  ];
  for (const file of files) {
    const source = readFileSync(file, "utf8");
    assert.equal(source.includes("SERVICE_ROLE"), false, file);
    assert.equal(source.includes("service_role"), false, file);
    assert.equal(source.includes("SUPABASE_SERVICE_ROLE_KEY"), false, file);
  }
});

test("architecture — trusted init does not promote Team/Daily writers or change Contract 08", () => {
  const serverDir = path.join(ROOT, "src/features/referee-v5/server");
  const files = readdirSync(serverDir)
    .filter((name) => name.endsWith(".js"))
    .map((name) => path.join(serverDir, name));
  for (const file of files) {
    const source = readFileSync(file, "utf8");
    assert.equal(source.includes("team_tournament_provision_referee_match"), false, file);
    assert.equal(source.includes("daily_play_start_match"), false, file);
  }
});

test("secret scan on trusted-server init sources", () => {
  const files = [
    path.join(ROOT, "src/features/referee-v5/server/trustedMatchExecutionInit.js"),
    path.join(ROOT, "src/features/referee-v5/server/mapCanonicalIdentityToAdapterBModeState.js"),
    path.join(ROOT, "src/features/referee-v5/server/edgeHttpHandler.js"),
    path.join(ROOT, "src/features/referee-v5/services/refereeV5EdgeClient.js"),
  ];
  const hits = [];
  for (const file of files) {
    const found = findSecretCandidates(readFileSync(file, "utf8"));
    if (found.length) hits.push({ file, found });
  }
  assert.deepEqual(hits, []);
});

test("Edge client helper exists for initialize-execution", () => {
  assert.equal(typeof refereeV5EdgeInitializeExecution, "function");
  assert.equal(REFEREE_V5_ACTIONS.INITIALIZE_EXECUTION, "initialize-execution");
});
