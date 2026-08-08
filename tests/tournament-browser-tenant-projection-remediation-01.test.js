import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it, beforeEach, afterEach } from "node:test";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { loadClubs, saveClubs, DEFAULT_CLUB } from "../src/data/club.js";
import {
  createTournamentCommand,
  updateTournamentCommand,
  deleteTournamentCommand,
  applyEngineV4StateCommand,
  listTournamentsQuery,
  listMyTournamentsQuery,
  getTournamentQuery,
  requireExplicitTournamentTenant,
  resolveExplicitTenantFromClub,
  __resetTournamentRepositorySingleton,
  __setTournamentRepositoryRpcForTests,
  createInMemoryCanonicalTournamentRpc,
  CANONICAL_TOURNAMENT_RPC,
} from "../src/features/tournament/index.js";
import { TOURNAMENT_MODE } from "../src/models/tournament/constants.js";
import {
  resolveTeamTournamentCloudTenantId,
} from "../src/features/team-tournament/services/teamTournamentCloudSync.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const PROD_CLUB_ID = "club-219e4a7cbd73437eb6271f02a53314c3";
const PROD_TENANT_ID = "venue-prod-main";

function readSrc(relativePath) {
  return readFileSync(path.join(root, relativePath), "utf8");
}

function createLocalStorageMock() {
  const store = new Map();
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

describe("tournament browser tenant projection remediation 01", () => {
  let memory;
  let rpcCalls;

  beforeEach(() => {
    globalThis.localStorage = createLocalStorageMock();
    __resetTournamentRepositorySingleton();
    rpcCalls = [];

    // Legacy localStorage registry: same club id, NO tenant metadata (Owner browser defect).
    saveClubs([
      DEFAULT_CLUB,
      {
        id: PROD_CLUB_ID,
        name: "CLB ACCC",
        // intentionally omit tenantId / venueId
      },
    ]);

    memory = createInMemoryCanonicalTournamentRpc({
      tenantId: PROD_TENANT_ID,
    });
    const baseRpc = memory.rpc;
    __setTournamentRepositoryRpcForTests(async (name, args) => {
      rpcCalls.push({ name, args });
      return baseRpc(name, args);
    });
  });

  afterEach(() => {
    __resetTournamentRepositorySingleton();
  });

  it("resolves tenant from canonical activeClub even when loadClubs lacks tenant", async () => {
    const activeClub = {
      id: PROD_CLUB_ID,
      name: "CLB ACCC",
      tenantId: PROD_TENANT_ID,
      venueId: PROD_TENANT_ID,
    };

    // Prove legacy registry still lacks tenant.
    const legacy = loadClubs().find((c) => c.id === PROD_CLUB_ID);
    assert.ok(legacy);
    assert.equal(legacy.tenantId || legacy.venueId || null, null);
    assert.equal(resolveExplicitTenantFromClub(legacy), null);
    assert.equal(resolveExplicitTenantFromClub(activeClub), PROD_TENANT_ID);

    const created = await createTournamentCommand(activeClub, {
      mode: TOURNAMENT_MODE.INTERNAL_TOURNAMENT,
      name: "Browser ACCC",
      createdBy: "smoke-player-1",
    });
    assert.equal(created.ok, true, created.error);
    assert.ok(created.tournament?.id);

    const listed = await listTournamentsQuery(activeClub);
    assert.equal(listed.ok, true, listed.error);
    assert.equal(listed.tournaments.length >= 1, true);

    const got = await getTournamentQuery(activeClub, created.tournament.id);
    assert.equal(got.ok, true);

    const updated = await updateTournamentCommand(activeClub, created.tournament.id, {
      name: "Browser ACCC Updated",
    });
    assert.equal(updated.ok, true);

    const mine = await listMyTournamentsQuery(activeClub, { playerId: "smoke-player-1" });
    assert.equal(mine.ok, true);

    const engine = await applyEngineV4StateCommand(activeClub, created.tournament.id, {
      smokeEngine: true,
    });
    assert.equal(engine.ok, true);

    const deleted = await deleteTournamentCommand(activeClub, created.tournament.id);
    assert.equal(deleted.ok, true);

    const byName = Object.fromEntries(rpcCalls.map((c) => [c.name, c.args]));
    for (const rpcName of [
      CANONICAL_TOURNAMENT_RPC.CREATE,
      CANONICAL_TOURNAMENT_RPC.LIST,
      CANONICAL_TOURNAMENT_RPC.GET,
      CANONICAL_TOURNAMENT_RPC.UPDATE,
      CANONICAL_TOURNAMENT_RPC.LIST_MINE,
      CANONICAL_TOURNAMENT_RPC.APPLY_ENGINE,
      CANONICAL_TOURNAMENT_RPC.DELETE,
    ]) {
      assert.ok(byName[rpcName], `missing rpc ${rpcName}`);
      assert.equal(byName[rpcName].p_tenant_id, PROD_TENANT_ID);
      assert.equal(byName[rpcName].p_club_id, PROD_CLUB_ID);
    }
  });

  it("fails closed when canonical activeClub tenant missing", async () => {
    const activeClub = { id: PROD_CLUB_ID, name: "CLB ACCC" };
    const gate = requireExplicitTournamentTenant({
      clubId: activeClub.id,
      tenantId: resolveExplicitTenantFromClub(activeClub),
    });
    assert.equal(gate.ok, false);
    assert.match(gate.error, /tenant hợp lệ/);

    const listed = await listTournamentsQuery(activeClub);
    assert.equal(listed.ok, false);
    assert.match(listed.error, /tenant hợp lệ/);
  });

  it("fails closed when canonical activeClub tenant is default-tenant", async () => {
    const activeClub = {
      id: PROD_CLUB_ID,
      tenantId: "default-tenant",
      venueId: "default-tenant",
    };
    const listed = await listTournamentsQuery(activeClub);
    assert.equal(listed.ok, false);
    assert.match(listed.error, /tenant hợp lệ/);
  });

  it("does not fall back to legacy localStorage for tenant", async () => {
    // Poison localStorage with a wrong tenant — canonical activeClub must win.
    saveClubs([
      DEFAULT_CLUB,
      {
        id: PROD_CLUB_ID,
        name: "CLB ACCC",
        tenantId: "wrong-legacy-tenant",
        venueId: "wrong-legacy-tenant",
      },
    ]);
    const activeClub = {
      id: PROD_CLUB_ID,
      name: "CLB ACCC",
      tenantId: PROD_TENANT_ID,
    };
    const created = await createTournamentCommand(activeClub, {
      mode: TOURNAMENT_MODE.DAILY_PLAY,
      name: "Daily ignore legacy",
    });
    assert.equal(created.ok, true, created.error);
    const createCall = rpcCalls.find((c) => c.name === CANONICAL_TOURNAMENT_RPC.CREATE);
    assert.equal(createCall.args.p_tenant_id, PROD_TENANT_ID);
    assert.notEqual(createCall.args.p_tenant_id, "wrong-legacy-tenant");
  });

  it("Team Tournament cloud tenant prefers runtimeTenantId without loadClubs lookup", async () => {
    const resolved = await resolveTeamTournamentCloudTenantId({
      clubId: PROD_CLUB_ID,
      runtimeTenantId: PROD_TENANT_ID,
      tournament: { id: "tt-1", clubId: PROD_CLUB_ID },
      client: null,
      user: null,
    });
    assert.equal(resolved.ok, true);
    assert.equal(resolved.tenantId, PROD_TENANT_ID);

    const src = readSrc("src/features/team-tournament/services/teamTournamentCloudSync.js");
    assert.equal(src.includes("getExplicitTenantIdForClub"), false);
    assert.equal(src.includes("loadClubs("), false);
  });

  it("active Tournament sources have zero legacy loadClubs tenant lookups", () => {
    const files = [
      "src/features/tournament/guards/tournamentTenant.js",
      "src/features/tournament/repositories/cloudTournamentRepository.js",
      "src/features/tournament/services/tournamentQueries.js",
      "src/features/tournament/services/tournamentCommands.js",
      "src/features/tournament/hooks/useCanonicalTournament.js",
    ];
    let hits = 0;
    for (const file of files) {
      const src = readSrc(file);
      if (src.includes("getExplicitTenantIdForClub")) hits += 1;
      if (src.includes("loadClubs(")) hits += 1;
      if (src.includes("pickleball-clubs-v1")) hits += 1;
    }
    assert.equal(hits, 0);
  });
});
