/**
 * TOURNAMENT-SHARED-PAIRING-TENANT-SCOPE-REMEDIATION-01
 *
 * Daily/Internal loaded canonical tournaments with tenant, but pairing callers
 * omitted tenant before prepareLivePrivatePairingOptions → SCOPE_ID_REQUIRED.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, it } from "node:test";

import {
  createFairDailyMatches,
  DAILY_GENDER_FILTER,
  DAILY_MATCH_TYPE,
  getDefaultDailyPlaySettings,
} from "../src/tournament/engines/dailyPlayEngine.js";
import {
  COMPETITION_CLASS,
  FEATURE_FLAG_KEYS,
  prepareLivePrivatePairingOptions,
  projectLivePrivatePairingPrepareInput,
  setPrivatePairingRpcClientForTests,
} from "../src/features/private-pairing-rules/index.js";
import { PRIVATE_PAIRING_RPC } from "../src/features/private-pairing-rules/constants/dbCodes.js";
import { setActiveClubId, DEFAULT_CLUB } from "../src/data/club.js";
import { loadClubData } from "../src/domain/clubStorage.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

const PROD_CLUB_ID = "club-219e4a7cbd73437eb6271f02a53314c3";
const PROD_TENANT_ID = "venue-prod-main";
const PROD_DAILY_ID = "daily-owner-fixture-01";
const PROD_INTERNAL_ID = "b90c272a-e7a0-483a-994d-fc4aa8f6c88b";

const FLAGS_ON = {
  [FEATURE_FLAG_KEYS.PRIVATE_PAIRING_RULES]: "true",
  [FEATURE_FLAG_KEYS.UNIFIED_CONSTRAINT_ENGINE]: "true",
};

const FLAGS_OFF = {
  [FEATURE_FLAG_KEYS.PRIVATE_PAIRING_RULES]: "false",
  [FEATURE_FLAG_KEYS.UNIFIED_CONSTRAINT_ENGINE]: "false",
};

const PROD_ACTIVE_CLUB = {
  id: PROD_CLUB_ID,
  clubId: PROD_CLUB_ID,
  tenantId: PROD_TENANT_ID,
  venueId: PROD_TENANT_ID,
  name: "CLB ACCC",
};

function readSrc(rel) {
  return readFileSync(path.join(root, rel), "utf8");
}

function localStorageMock(seed = {}) {
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

function mockClient(handler) {
  return { rpc: async (name, args) => handler(name, args) };
}

function emptyRulesOk(scopeType, scopeId) {
  return {
    data: {
      ok: true,
      rule_set: {
        id: `rs-${scopeId}`,
        version: 1,
        scope_type: scopeType,
        scope_id: scopeId,
        status: "active",
      },
      rules: [],
    },
    error: null,
  };
}

function players(n = 8) {
  return Array.from({ length: n }, (_, index) => ({
    id: `p${index + 1}`,
    name: `P${index + 1}`,
    gender: index % 2 === 0 ? "Nam" : "Nữ",
    level: 3.5 + (index % 4) * 0.1,
    rating: 3.5 + (index % 4) * 0.1,
  }));
}

beforeEach(() => {
  setPrivatePairingRpcClientForTests(null);
  globalThis.localStorage = localStorageMock();
  setActiveClubId(DEFAULT_CLUB.id);
  loadClubData(DEFAULT_CLUB.id);
});

describe("tournament-shared-pairing-tenant-scope-remediation-01", () => {
  it("A. Daily canonical tenant present → pairing prepare succeeds (no SCOPE_ID_REQUIRED)", async () => {
    const tournament = {
      id: PROD_DAILY_ID,
      clubId: PROD_CLUB_ID,
      tenantId: PROD_TENANT_ID,
      mode: "daily_play",
    };

    const projected = projectLivePrivatePairingPrepareInput({
      tournament,
      activeClub: PROD_ACTIVE_CLUB,
      tournamentId: PROD_DAILY_ID,
      clubId: PROD_CLUB_ID,
      hostClubId: PROD_CLUB_ID,
      competitionClass: COMPETITION_CLASS.DAILY_PLAY,
    });
    assert.equal(projected.ok, true);
    assert.equal(projected.tenantId, PROD_TENANT_ID);

    setPrivatePairingRpcClientForTests(
      mockClient(async (name, args) => {
        assert.equal(name, PRIVATE_PAIRING_RPC.GET_ACTIVE_FOR_SCOPE);
        assert.equal(args.p_tenant_id, PROD_TENANT_ID);
        return emptyRulesOk(args.p_scope_type, args.p_scope_id);
      })
    );

    const prepared = await prepareLivePrivatePairingOptions({
      ...projected.prepareInput,
      envSource: FLAGS_ON,
    });
    assert.equal(prepared.ok, true);
    assert.notEqual(prepared.error?.code, "SCOPE_ID_REQUIRED");

    const list = players(8);
    const created = await createFairDailyMatches({
      players: list,
      settings: {
        ...getDefaultDailyPlaySettings(),
        checkedInPlayerIds: list.map((p) => String(p.id)),
        matchType: DAILY_MATCH_TYPE.MIXED_DOUBLE,
        genderFilter: DAILY_GENDER_FILTER.ALL,
      },
      tournament,
      tournamentId: PROD_DAILY_ID,
      clubId: PROD_CLUB_ID,
      tenantId: PROD_TENANT_ID,
      matchCount: 1,
      envSource: FLAGS_OFF,
    });
    assert.equal(created.ok, true);
    assert.ok((created.matches || []).length >= 1);
  });

  it("B. Internal canonical tenant present → pairing prepare succeeds", async () => {
    const tournament = {
      id: PROD_INTERNAL_ID,
      clubId: PROD_CLUB_ID,
      tenantId: PROD_TENANT_ID,
      mode: "internal_tournament",
    };

    const projected = projectLivePrivatePairingPrepareInput({
      tournament,
      activeClub: PROD_ACTIVE_CLUB,
      tournamentId: PROD_INTERNAL_ID,
      clubId: PROD_CLUB_ID,
      hostClubId: PROD_CLUB_ID,
      competitionClass: COMPETITION_CLASS.INTERNAL,
      eventId: `event-${PROD_INTERNAL_ID}`,
      pairingConstraints: [],
    });
    assert.equal(projected.ok, true);
    assert.equal(projected.tenantId, PROD_TENANT_ID);

    setPrivatePairingRpcClientForTests(
      mockClient(async (_name, args) => {
        assert.equal(args.p_tenant_id, PROD_TENANT_ID);
        return emptyRulesOk(args.p_scope_type, args.p_scope_id);
      })
    );

    const prepared = await prepareLivePrivatePairingOptions({
      ...projected.prepareInput,
      envSource: FLAGS_ON,
    });
    assert.equal(prepared.ok, true);
    assert.notEqual(prepared.error?.code, "SCOPE_ID_REQUIRED");
  });

  it("C. Missing tenant → still fail closed with SCOPE_ID_REQUIRED", async () => {
    const projected = projectLivePrivatePairingPrepareInput({
      tournament: { id: "t-missing-tenant", clubId: PROD_CLUB_ID },
      activeClub: { id: PROD_CLUB_ID, clubId: PROD_CLUB_ID },
      tournamentId: "t-missing-tenant",
      clubId: PROD_CLUB_ID,
      hostClubId: PROD_CLUB_ID,
      competitionClass: COMPETITION_CLASS.DAILY_PLAY,
    });
    assert.equal(projected.ok, false);
    assert.equal(projected.code, "SCOPE_ID_REQUIRED");
    assert.ok(projected.error.missing.includes("tenantId"));

    const prepared = await prepareLivePrivatePairingOptions({
      tournamentId: "t-missing-tenant",
      clubId: PROD_CLUB_ID,
      competitionClass: COMPETITION_CLASS.INTERNAL,
      envSource: FLAGS_ON,
    });
    assert.equal(prepared.ok, false);
    assert.equal(prepared.error.code, "SCOPE_ID_REQUIRED");
  });

  it("D. Tenant mismatch → fail closed", () => {
    const projected = projectLivePrivatePairingPrepareInput({
      tournament: {
        id: PROD_INTERNAL_ID,
        clubId: PROD_CLUB_ID,
        tenantId: PROD_TENANT_ID,
      },
      activeClub: {
        id: PROD_CLUB_ID,
        clubId: PROD_CLUB_ID,
        tenantId: "venue-other",
        venueId: "venue-other",
      },
      tournamentId: PROD_INTERNAL_ID,
      clubId: PROD_CLUB_ID,
      hostClubId: PROD_CLUB_ID,
      competitionClass: COMPETITION_CLASS.INTERNAL,
    });
    assert.equal(projected.ok, false);
    assert.equal(projected.code, "TENANT_SCOPE_MISMATCH");
  });

  it("D2. Club mismatch → fail closed", () => {
    const projected = projectLivePrivatePairingPrepareInput({
      tournament: {
        id: PROD_INTERNAL_ID,
        clubId: PROD_CLUB_ID,
        tenantId: PROD_TENANT_ID,
      },
      activeClub: {
        id: "club-foreign",
        clubId: "club-foreign",
        tenantId: PROD_TENANT_ID,
        venueId: PROD_TENANT_ID,
      },
      tournamentId: PROD_INTERNAL_ID,
      clubId: PROD_CLUB_ID,
      hostClubId: "club-foreign",
      competitionClass: COMPETITION_CLASS.INTERNAL,
    });
    assert.equal(projected.ok, false);
    assert.equal(projected.code, "CLUB_SCOPE_MISMATCH");
  });

  it("E. Missing tournament/club scope → existing validation preserved", async () => {
    const projected = projectLivePrivatePairingPrepareInput({
      tournament: { tenantId: PROD_TENANT_ID },
      competitionClass: COMPETITION_CLASS.INTERNAL,
    });
    assert.equal(projected.ok, false);
    assert.equal(projected.code, "SCOPE_ID_REQUIRED");
    assert.ok(projected.error.missing.includes("tournamentId|clubId"));

    const prepared = await prepareLivePrivatePairingOptions({
      tenantId: PROD_TENANT_ID,
      competitionClass: COMPETITION_CLASS.INTERNAL,
      envSource: FLAGS_ON,
    });
    assert.equal(prepared.ok, false);
    assert.equal(prepared.error.code, "SCOPE_ID_REQUIRED");
    assert.ok(prepared.error.missing.includes("tournamentId|clubId"));
  });

  it("F. Private pairing permission / RBAC surfaces unchanged in this remediation", () => {
    const daily = readSrc("src/pages/tournament/DailyPlaySetup.jsx");
    const internal = readSrc("src/pages/tournament/InternalTournamentSetup.jsx");
    const resolveScope = readSrc(
      "src/features/private-pairing-rules/runtime/resolveLivePairingScope.js"
    );
    const prepare = readSrc(
      "src/features/private-pairing-rules/runtime/prepareLivePrivatePairingOptions.js"
    );

    assert.match(daily, /projectLivePrivatePairingPrepareInput/);
    assert.match(daily, /tenantId:\s*projected\.prepareInput\.tenantId/);
    assert.match(internal, /prepareInternalPrivatePairing/);
    assert.match(internal, /projectLivePrivatePairingPrepareInput/);
    assert.doesNotMatch(internal, /prepareLivePrivatePairingOptions\(\{\s*clubId:\s*tournamentClubId/);
    assert.match(resolveScope, /if \(!tenantId\) missing\.push\("tenantId"\)/);
    assert.match(prepare, /code:\s*"SCOPE_ID_REQUIRED"/);
    assert.doesNotMatch(daily, /default-tenant/);
    assert.doesNotMatch(internal, /localStorage\.getItem/);
    assert.doesNotMatch(daily, /user\.venueId/);
    assert.doesNotMatch(internal, /user\.venueId/);
  });

  it("Owner Daily flow: venue-prod-main + ACCC club → explicit tenant projection", () => {
    const projected = projectLivePrivatePairingPrepareInput({
      tournament: {
        id: PROD_DAILY_ID,
        clubId: PROD_CLUB_ID,
        tenantId: PROD_TENANT_ID,
      },
      activeClub: PROD_ACTIVE_CLUB,
      tournamentId: PROD_DAILY_ID,
      hostClubId: PROD_CLUB_ID,
      competitionClass: COMPETITION_CLASS.DAILY_PLAY,
    });
    assert.equal(projected.ok, true);
    assert.equal(projected.prepareInput.tenantId, PROD_TENANT_ID);
    assert.equal(projected.prepareInput.clubId, PROD_CLUB_ID);
    assert.equal(projected.prepareInput.tournamentId, PROD_DAILY_ID);
  });

  it("Owner Internal flow: all three paths share prepareInternalPrivatePairing", () => {
    const src = readSrc("src/pages/tournament/InternalTournamentSetup.jsx");
    assert.match(src, /const prepareInternalPrivatePairing = async/);
    assert.match(src, /handleStartGuidedFlow[\s\S]*prepareInternalPrivatePairing\(\)/);
    assert.match(src, /handleSuggestPairs[\s\S]*prepareInternalPrivatePairing\(\)/);
    assert.match(src, /handleBuildGroups[\s\S]*prepareInternalPrivatePairing\(\)/);
  });

  it("uses activeClub.tenantId when tournament.tenantId absent — venueId is not Tenant", () => {
    const projected = projectLivePrivatePairingPrepareInput({
      tournament: { id: "t1", clubId: PROD_CLUB_ID },
      activeClub: {
        id: PROD_CLUB_ID,
        clubId: PROD_CLUB_ID,
        tenantId: PROD_TENANT_ID,
        venueId: "venue-distinct",
      },
      tournamentId: "t1",
      hostClubId: PROD_CLUB_ID,
      competitionClass: COMPETITION_CLASS.DAILY_PLAY,
    });
    assert.equal(projected.ok, true);
    assert.equal(projected.tenantId, PROD_TENANT_ID);

    const venueOnly = projectLivePrivatePairingPrepareInput({
      tournament: { id: "t1", clubId: PROD_CLUB_ID },
      activeClub: {
        id: PROD_CLUB_ID,
        clubId: PROD_CLUB_ID,
        venueId: PROD_TENANT_ID,
      },
      tournamentId: "t1",
      hostClubId: PROD_CLUB_ID,
      competitionClass: COMPETITION_CLASS.DAILY_PLAY,
    });
    assert.equal(venueOnly.ok, false);
    assert.equal(venueOnly.code, "SCOPE_ID_REQUIRED");
  });

  it("static: no legacy/default/localStorage tenant authority in changed pairing paths", () => {
    const engine = readSrc("src/tournament/engines/dailyPlayEngine.js");
    const helper = readSrc(
      "src/features/private-pairing-rules/runtime/projectLivePrivatePairingPrepareInput.js"
    );
    const daily = readSrc("src/pages/tournament/DailyPlaySetup.jsx");
    const internal = readSrc("src/pages/tournament/InternalTournamentSetup.jsx");
    assert.match(engine, /tenantId:\s*tenantId\s*\|\|\s*tournament\?\.tenantId/);
    assert.match(engine, /tournament:\s*tournament\s*\|\|\s*null/);
    assert.doesNotMatch(helper, /localStorage/);
    assert.doesNotMatch(helper, /loadClubs/);
    assert.doesNotMatch(helper, /user\.venueId/);
    assert.doesNotMatch(daily, /["']default-tenant["']/);
    assert.doesNotMatch(internal, /["']default-tenant["']/);
    assert.doesNotMatch(engine, /["']default-tenant["']/);
  });

  it("Internal id-only canonical scope smells remain absent", () => {
    const src = readSrc("src/pages/tournament/InternalTournamentSetup.jsx");
    assert.doesNotMatch(src, /useCanonicalTournament\([^)]*\{\s*id:\s*tournamentClubId/);
    assert.doesNotMatch(src, /\{\s*\.\.\.activeClub,\s*id:\s*tournamentClubId/);
    assert.match(src, /resolveInternalSetupCanonicalClubScope/);
  });
});
