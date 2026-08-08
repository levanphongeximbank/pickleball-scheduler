import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it, beforeEach, afterEach } from "node:test";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { loadClubs, saveClubs, DEFAULT_CLUB } from "../src/data/club.js";
import { getClubSummary } from "../src/domain/clubService.js";
import {
  isCanonicalActiveClubReady,
  isCanonicalClubReadEnabled,
  normalizeCanonicalActiveClub,
  resolveActiveClubSelection,
  resolveExplicitTenantFromCanonicalClub,
} from "../src/features/club/context/clubCanonicalReadModel.js";
import { mapV2ClubToUiClub } from "../src/features/club/services/clubStorageV2RpcService.js";
import {
  createTournamentCommand,
  listTournamentsQuery,
  requireExplicitTournamentTenant,
  resolveExplicitTenantFromClub,
  buildTournamentClubScope,
  __resetTournamentRepositorySingleton,
  __setTournamentRepositoryRpcForTests,
  createInMemoryCanonicalTournamentRpc,
  CANONICAL_TOURNAMENT_RPC,
} from "../src/features/tournament/index.js";
import { TOURNAMENT_MODE } from "../src/models/tournament/constants.js";
import { resolveTeamTournamentCloudTenantId } from "../src/features/team-tournament/services/teamTournamentCloudSync.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const PROD_CLUB_ID = "club-219e4a7cbd73437eb6271f02a53314c3";
const PROD_TENANT_ID = "venue-prod-main";

function readSrc(relativePath) {
  return readFileSync(path.join(root, relativePath), "utf8");
}

function countMatches(source, pattern) {
  const re = typeof pattern === "string" ? new RegExp(pattern, "g") : new RegExp(pattern.source, "g");
  return (source.match(re) || []).length;
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

describe("club-context canonical tenant projection remediation 01", () => {
  let memory;
  let rpcCalls;

  beforeEach(() => {
    globalThis.localStorage = createLocalStorageMock();
    __resetTournamentRepositorySingleton();
    rpcCalls = [];

    // Owner browser defect: legacy registry has same club id without tenant.
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

  it("canonical DB projection preserves tenant; legacy localStorage cannot overwrite selection", () => {
    const mapped = mapV2ClubToUiClub({
      id: PROD_CLUB_ID,
      name: "CLB ACCC",
      tenant_id: PROD_TENANT_ID,
      status: "active",
      version: 1,
    });
    assert.equal(mapped.tenantId, PROD_TENANT_ID);
    assert.equal(mapped.venueId, PROD_TENANT_ID);

    const legacy = loadClubs().find((c) => c.id === PROD_CLUB_ID);
    assert.ok(legacy);
    assert.equal(legacy.tenantId || legacy.venueId || null, null);

    const selection = resolveActiveClubSelection({
      preferredClubId: PROD_CLUB_ID,
      visibleClubs: [mapped],
      requireTenant: true,
    });
    assert.equal(selection.activeClubId, PROD_CLUB_ID);
    assert.equal(selection.activeClub.tenantId, PROD_TENANT_ID);
    assert.equal(selection.activeClub.venueId, PROD_TENANT_ID);
    assert.equal(isCanonicalActiveClubReady(selection.activeClub), true);

    // getClubSummary.club from legacy registry is tenant-less — ClubContext must
    // prefer canonical activeClub (proven via normalize + ready contract).
    const summary = getClubSummary(PROD_CLUB_ID);
    assert.equal(summary.club?.tenantId || summary.club?.venueId || null, null);
    const canonicalReady = normalizeCanonicalActiveClub(mapped);
    assert.ok(canonicalReady);
    assert.notEqual(
      resolveExplicitTenantFromClub(canonicalReady),
      resolveExplicitTenantFromClub(summary.club)
    );
  });

  it("Owner browser failure: Tournament hub/list/create receive explicit tenant from canonical activeClub", async () => {
    const activeClub = normalizeCanonicalActiveClub({
      id: PROD_CLUB_ID,
      name: "CLB ACCC",
      tenantId: PROD_TENANT_ID,
      venueId: PROD_TENANT_ID,
    });
    assert.ok(activeClub);

    // ID-only scope must NOT be used — buildTournamentClubScope ignores bare ids.
    const idOnly = buildTournamentClubScope(null);
    assert.equal(idOnly.clubId, "");
    assert.equal(idOnly.tenantId, null);

    const scope = buildTournamentClubScope(activeClub);
    assert.equal(scope.clubId, PROD_CLUB_ID);
    assert.equal(scope.tenantId, PROD_TENANT_ID);

    const created = await createTournamentCommand(activeClub, {
      mode: TOURNAMENT_MODE.INTERNAL_TOURNAMENT,
      name: "Owner ACCC Hub",
      createdBy: "owner-1",
    });
    assert.equal(created.ok, true, created.error);

    const listed = await listTournamentsQuery(activeClub);
    assert.equal(listed.ok, true, listed.error);
    assert.equal(listed.error || null, null);
    assert.ok(!String(listed.error || "").includes("CLB chưa có tenant hợp lệ"));

    const createCall = rpcCalls.find((c) => c.name === CANONICAL_TOURNAMENT_RPC.CREATE);
    assert.equal(createCall.args.p_tenant_id, PROD_TENANT_ID);
    assert.equal(createCall.args.p_club_id, PROD_CLUB_ID);
  });

  it("fail-closed: canonical row missing tenant is not tenant-ready activeClub", () => {
    const tenantLess = {
      id: PROD_CLUB_ID,
      name: "CLB ACCC",
    };
    assert.equal(resolveExplicitTenantFromCanonicalClub(tenantLess), null);
    assert.equal(normalizeCanonicalActiveClub(tenantLess), null);
    assert.equal(isCanonicalActiveClubReady(tenantLess), false);

    const selection = resolveActiveClubSelection({
      preferredClubId: PROD_CLUB_ID,
      visibleClubs: [tenantLess],
      requireTenant: true,
    });
    assert.equal(selection.activeClub, null);
    assert.equal(selection.activeClubId, null);

    // No user.venueId masking at ClubContext canonical boundary.
    const withUserMaskAttempt = {
      id: PROD_CLUB_ID,
      // no tenant on club; user.venueId must not be consulted by these helpers
    };
    assert.equal(normalizeCanonicalActiveClub(withUserMaskAttempt), null);

    const gate = requireExplicitTournamentTenant({
      clubId: PROD_CLUB_ID,
      tenantId: resolveExplicitTenantFromClub(tenantLess),
    });
    assert.equal(gate.ok, false);
    assert.match(gate.error, /tenant hợp lệ/);
  });

  it("fail-closed: default-tenant is never ready", () => {
    assert.equal(
      normalizeCanonicalActiveClub({
        id: PROD_CLUB_ID,
        tenantId: "default-tenant",
        venueId: "default-tenant",
      }),
      null
    );
  });

  it("canonical vs legacy mode gate", () => {
    assert.equal(
      isCanonicalClubReadEnabled({ canonicalEnabled: true, hasSupabase: true }),
      true
    );
    assert.equal(
      isCanonicalClubReadEnabled({ canonicalEnabled: false, hasSupabase: true }),
      false
    );

    // Legacy selection path (requireTenant=false) may still return tenant-less clubs.
    const legacySel = resolveActiveClubSelection({
      preferredClubId: PROD_CLUB_ID,
      visibleClubs: [{ id: PROD_CLUB_ID, name: "CLB ACCC" }],
      requireTenant: false,
    });
    assert.equal(legacySel.activeClubId, PROD_CLUB_ID);
    assert.equal(legacySel.activeClub.tenantId || null, null);

    // Canonical path refuses the same club.
    const canonicalSel = resolveActiveClubSelection({
      preferredClubId: PROD_CLUB_ID,
      visibleClubs: [{ id: PROD_CLUB_ID, name: "CLB ACCC" }],
      requireTenant: true,
    });
    assert.equal(canonicalSel.activeClub, null);
  });

  it("Daily Play / Team Tournament accept tenant-bearing canonical activeClub", async () => {
    const activeClub = {
      id: PROD_CLUB_ID,
      name: "CLB ACCC",
      tenantId: PROD_TENANT_ID,
      venueId: PROD_TENANT_ID,
    };
    const daily = await createTournamentCommand(activeClub, {
      mode: TOURNAMENT_MODE.DAILY_PLAY,
      name: "Daily ACCC",
    });
    assert.equal(daily.ok, true, daily.error);

    const team = await createTournamentCommand(activeClub, {
      mode: TOURNAMENT_MODE.TEAM_TOURNAMENT,
      name: "Team ACCC",
    });
    assert.equal(team.ok, true, team.error);

    const ttTenant = await resolveTeamTournamentCloudTenantId({
      clubId: PROD_CLUB_ID,
      runtimeTenantId: PROD_TENANT_ID,
      tournament: { id: "tt-1", clubId: PROD_CLUB_ID },
      client: null,
      user: null,
    });
    assert.equal(ttTenant.ok, true);
    assert.equal(ttTenant.tenantId, PROD_TENANT_ID);
  });

  it("static: ClubContext exposes activeClubReady and prefers canonical club in summary", () => {
    const src = readSrc("src/context/ClubContext.jsx");
    assert.match(src, /activeClubReady/);
    assert.match(src, /requireTenant:\s*true/);
    assert.match(src, /normalizeCanonicalActiveClub/);
    assert.match(src, /club:\s*activeClub/);
  });

  it("static: TenantContext demotes legacy club authority when canonical read ON", () => {
    const src = readSrc("src/context/TenantContext.jsx");
    assert.match(src, /canonicalClubRead/);
    assert.match(src, /isCanonicalClubReadEnabled/);
    // Legacy primary-club switch must be gated.
    assert.match(src, /if \(canonicalClubRead\) \{/);
    assert.match(src, /if \(!canonicalClubRead\) \{/);
    assert.ok(src.includes("getPrimaryClubIdForTenant"));
  });

  it("static assertions: zero ID-only tournament fallback / localStorage tenant authority / default-tenant", () => {
    const tournamentFiles = [
      "src/features/tournament/pages/CanonicalTournamentHubPage.jsx",
      "src/features/tournament/pages/CanonicalTournamentListPage.jsx",
      "src/features/tournament/pages/CanonicalTournamentCreatePage.jsx",
      "src/features/tournament/pages/CanonicalTournamentTypesPage.jsx",
      "src/features/tournament/components/CanonicalTournamentPicker.jsx",
      "src/features/tournament/hooks/useCanonicalTournament.js",
      "src/features/tournament/guards/tournamentTenant.js",
      "src/pages/tournament/DailyPlaySetup.jsx",
      "src/pages/tournament/OfficialTournamentSetup.jsx",
      "src/pages/tournament/TournamentBracketHub.jsx",
      "src/pages/tournament/TournamentBracketPage.jsx",
      "src/pages/tournament/hubs/TournamentPickerHub.jsx",
      "src/pages/tournament/hubs/TournamentExistingTeamsHub.jsx",
      "src/pages/Dashboard.jsx",
      "src/features/individual-tournament/hooks/useIndividualTournamentConfig.js",
    ];

    let TOURNAMENT_ID_ONLY_CANONICAL_SCOPE_FALLBACK_COUNT = 0;
    for (const file of tournamentFiles) {
      const src = readSrc(file);
      TOURNAMENT_ID_ONLY_CANONICAL_SCOPE_FALLBACK_COUNT += countMatches(
        src,
        /activeClub\s*\|\|\s*\{\s*id:\s*activeClubId\s*\}/
      );
    }
    assert.equal(
      TOURNAMENT_ID_ONLY_CANONICAL_SCOPE_FALLBACK_COUNT,
      0,
      "TOURNAMENT_ID_ONLY_CANONICAL_SCOPE_FALLBACK_COUNT"
    );

    const clubContext = readSrc("src/context/ClubContext.jsx");
    const tenantContext = readSrc("src/context/TenantContext.jsx");
    const readModel = readSrc("src/features/club/context/clubCanonicalReadModel.js");

    // Canonical activeClub path must not authoritatively read the legacy club
    // registry key / helpers for tenant rediscovery.
    const CANONICAL_CLUB_CONTEXT_LOCALSTORAGE_TENANT_AUTHORITY_COUNT =
      countMatches(readModel, /pickleball-clubs-v1/) +
      countMatches(readModel, /loadClubs\s*\(/) +
      countMatches(readModel, /getExplicitTenantIdForClub/) +
      countMatches(clubContext, /getExplicitTenantIdForClub/) +
      countMatches(tenantContext, /getExplicitTenantIdForClub/);
    assert.equal(
      CANONICAL_CLUB_CONTEXT_LOCALSTORAGE_TENANT_AUTHORITY_COUNT,
      0,
      "CANONICAL_CLUB_CONTEXT_LOCALSTORAGE_TENANT_AUTHORITY_COUNT"
    );

    // No default-tenant inventing in the canonical ready contract / tournament tenant gate.
    const DEFAULT_TENANT_FALLBACK_COUNT =
      countMatches(readModel, /["']default-tenant["']\s*\|\|/) +
      countMatches(clubContext, /tenantId\s*=\s*["']default-tenant["']/) +
      countMatches(tenantContext, /tenantId\s*=\s*["']default-tenant["']/);
    assert.equal(DEFAULT_TENANT_FALLBACK_COUNT, 0, "DEFAULT_TENANT_FALLBACK_COUNT");

    // Dashboard / court-facing pages must not reintroduce ID-only tournament scope.
    assert.equal(
      countMatches(readSrc("src/pages/Dashboard.jsx"), /activeClub\s*\|\|\s*\{\s*id:\s*activeClubId\s*\}/),
      0
    );
  });
});
