/**
 * Canonical Venue/Court cluster membership binding.
 */
import test, { beforeEach, afterEach, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { setActiveClubId, DEFAULT_CLUB, saveClubs } from "../../src/data/club.js";
import {
  saveClubData,
  getDefaultClubData,
  loadCourtsForClub,
} from "../../src/domain/clubStorage.js";
import { normalizeCourt } from "../../src/models/court.js";
import { ROLES } from "../../src/auth/roles.js";
import { enableRbac } from "../../src/auth/authService.js";
import { saveAuthSession } from "../../src/auth/authStorage.js";
import {
  applyCanonicalClusterBinding,
  listUnstampedCourts,
  isUnstampedCourt,
  resolveClubDataV3CourtsPath,
  writeClubDataV3Courts,
} from "../../src/features/venue-court/services/clusterBindingCore.js";
import {
  bindClubCourtsToCluster,
  __setBindClubCourtsToClusterDepsForTests,
  __resetBindClubCourtsToClusterDepsForTests,
} from "../../src/features/venue-court/services/bindClubCourtsToClusterService.js";
import {
  CLUSTER_BINDING_CODE,
  CLUSTER_BINDING_RPC,
} from "../../src/features/venue-court/constants/clusterBindingContract.js";
import {
  listCanonicalCloudCourts,
  filterCourtsByClusterMembership,
  assertCourtClusterMembership,
} from "../../src/features/venue-court/index.js";
import {
  __resetCanonicalCloudCourtInventoryDepsForTests,
  __setCanonicalCloudCourtInventoryDepsForTests,
} from "../../src/features/venue-court/services/canonicalCloudCourtInventory.js";
import { ensureCourtsHaveClusterId } from "../../src/features/court-cluster/services/courtClusterService.js";
import { loadCourtClusters, saveCourtClusters } from "../../src/data/courtCluster.js";
import { loadCourts, saveCourts } from "../../src/pages/courts.logic.js";
import { updateClubGovernance } from "../../src/features/club/services/clubGovernanceService.js";
import { PERMISSIONS } from "../../src/auth/permissions.js";
import { buildDefaultClusterId } from "../../src/models/courtCluster.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const PACKAGE_DIR = path.join(
  root,
  "docs/v5/migrations/venue-court-canonical-cluster-binding-01"
);

const CLUB_ID = "club-ecebf64c78f948ccb2b59842441eb26c";
const OTHER_CLUB = "club-other";
const VENUE = "venue-staging-a";
const OTHER_VENUE = "venue-other";
const CLUSTER = "venue-staging-a-hc-operator-cluster";
const OTHER_CLUSTER = "other-cluster";
const COURT_1 = "tt412-court-01";
const COURT_2 = "tt412-court-02";
const COURT_3 = "tt412-court-03";

function createLocalStorageMock(seed = {}) {
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

function court(id, extra = {}) {
  return normalizeCourt({
    id,
    name: id,
    number: 1,
    active: true,
    status: "active",
    clubId: CLUB_ID,
    tenantId: VENUE,
    venueId: VENUE,
    note: "keep-me",
    ...extra,
  });
}

function makeClub(extra = {}) {
  return {
    id: CLUB_ID,
    name: "Staging Club",
    venueId: VENUE,
    tenantId: VENUE,
    status: "active",
    version: 3,
    governance: {
      ownerUserId: "owner-1",
      presidentUserId: "owner-1",
      registeredClusterId: null,
      ...(extra.governance || {}),
    },
    ...extra,
  };
}

function seedLocal(courts, club = makeClub()) {
  saveClubs([club, { id: OTHER_CLUB, name: "Other", venueId: OTHER_VENUE }]);
  saveClubData(CLUB_ID, {
    ...getDefaultClubData(CLUB_ID),
    courts,
    bookings: [{ id: "b1", courtId: COURT_1, keep: true }],
    players: [{ id: "p1", name: "Keep" }],
  });
}

beforeEach(() => {
  process.env.VITE_COURT_CLUSTERS_ENABLED = "true";
  globalThis.localStorage = createLocalStorageMock();
  setActiveClubId(DEFAULT_CLUB.id);
  enableRbac(true);
  saveAuthSession({
    id: "owner-1",
    role: ROLES.TENANT_OWNER,
    venueId: VENUE,
    status: "active",
  });
  saveCourtClusters([
    {
      id: CLUSTER,
      venueId: VENUE,
      name: "HC Operator",
      slug: "hc-operator-cluster",
      status: "active",
    },
    {
      id: OTHER_CLUSTER,
      venueId: OTHER_VENUE,
      name: "Other venue cluster",
      slug: "other",
      status: "active",
    },
    {
      id: "inactive-cluster",
      venueId: VENUE,
      name: "Inactive",
      slug: "inactive",
      status: "inactive",
    },
  ]);
  __resetBindClubCourtsToClusterDepsForTests();
  __resetCanonicalCloudCourtInventoryDepsForTests();
});

afterEach(() => {
  __resetBindClubCourtsToClusterDepsForTests();
  __resetCanonicalCloudCourtInventoryDepsForTests();
  delete globalThis.localStorage;
});

describe("canonical cluster binding core", () => {
  test("1. explicit NULL → target club registration", () => {
    const result = applyCanonicalClusterBinding({
      clubId: CLUB_ID,
      clusterId: CLUSTER,
      courtIds: [],
      clubRegisteredClusterId: null,
      courts: [court(COURT_1)],
    });
    assert.equal(result.ok, true);
    assert.equal(result.clubRegisteredClusterId, CLUSTER);
    assert.equal(result.clubChanged, true);
    assert.equal(result.courts[0].clusterId, undefined);
  });

  test("2. explicit NULL → target physical court assignment", () => {
    const result = applyCanonicalClusterBinding({
      clubId: CLUB_ID,
      clusterId: CLUSTER,
      courtIds: [COURT_1],
      clubRegisteredClusterId: null,
      courts: [court(COURT_1), court(COURT_2)],
    });
    assert.equal(result.ok, true);
    assert.equal(result.courts.find((item) => item.id === COURT_1).clusterId, CLUSTER);
    assert.equal(result.changedCourtIds[0], COURT_1);
  });

  test("3. idempotent replay", () => {
    const courts = [court(COURT_1, { clusterId: CLUSTER })];
    const first = applyCanonicalClusterBinding({
      clubId: CLUB_ID,
      clusterId: CLUSTER,
      courtIds: [COURT_1],
      clubRegisteredClusterId: CLUSTER,
      courts,
    });
    const second = applyCanonicalClusterBinding({
      clubId: CLUB_ID,
      clusterId: CLUSTER,
      courtIds: [COURT_1],
      clubRegisteredClusterId: CLUSTER,
      courts: first.courts,
    });
    assert.equal(first.ok, true);
    assert.equal(second.ok, true);
    assert.equal(second.alreadyBound, true);
    assert.deepEqual(second.changedCourtIds, []);
  });

  test("4-6. selected court IDs only; unrelated court and JSON preserved", () => {
    const result = applyCanonicalClusterBinding({
      clubId: CLUB_ID,
      clusterId: CLUSTER,
      courtIds: [COURT_1],
      clubRegisteredClusterId: null,
      courts: [
        court(COURT_1, { note: "keep-me", defaultHourlyRate: 9 }),
        court(COURT_2, { note: "untouched" }),
      ],
    });
    assert.equal(result.ok, true);
    assert.equal(result.courts[0].clusterId, CLUSTER);
    assert.equal(result.courts[0].note, "keep-me");
    assert.equal(result.courts[0].defaultHourlyRate, 9);
    assert.equal(result.courts[1].clusterId, undefined);
    assert.equal(result.courts[1].note, "untouched");
    assert.deepEqual(result.changedCourtIds, [COURT_1]);
  });

  test("7. cross-club court rejected", () => {
    const result = applyCanonicalClusterBinding({
      clubId: CLUB_ID,
      clusterId: CLUSTER,
      courtIds: [COURT_1],
      clubRegisteredClusterId: null,
      courts: [court(COURT_1, { clubId: OTHER_CLUB })],
    });
    assert.equal(result.ok, false);
    assert.equal(result.code, CLUSTER_BINDING_CODE.CROSS_CLUB_COURT);
  });

  test("12. missing court rejected", () => {
    const result = applyCanonicalClusterBinding({
      clubId: CLUB_ID,
      clusterId: CLUSTER,
      courtIds: ["ghost-court"],
      clubRegisteredClusterId: null,
      courts: [court(COURT_1)],
    });
    assert.equal(result.ok, false);
    assert.equal(result.code, CLUSTER_BINDING_CODE.COURT_NOT_FOUND);
  });

  test("13. existing foreign non-null cluster fails closed", () => {
    const courtResult = applyCanonicalClusterBinding({
      clubId: CLUB_ID,
      clusterId: CLUSTER,
      courtIds: [COURT_1],
      clubRegisteredClusterId: null,
      courts: [court(COURT_1, { clusterId: OTHER_CLUSTER })],
    });
    assert.equal(courtResult.ok, false);
    assert.equal(courtResult.code, CLUSTER_BINDING_CODE.FOREIGN_CLUSTER);

    const clubResult = applyCanonicalClusterBinding({
      clubId: CLUB_ID,
      clusterId: CLUSTER,
      courtIds: [COURT_1],
      clubRegisteredClusterId: OTHER_CLUSTER,
      courts: [court(COURT_1)],
    });
    assert.equal(clubResult.ok, false);
    assert.equal(clubResult.code, CLUSTER_BINDING_CODE.FOREIGN_CLUSTER);
  });

  test("nested club_data_v3 courts path is preserved", () => {
    const nested = {
      clubId: CLUB_ID,
      data: { courts: [court(COURT_1)], bookings: [{ id: "b1" }] },
      aiData: { keep: true },
    };
    const resolved = resolveClubDataV3CourtsPath(nested);
    assert.equal(resolved.nested, true);
    const applied = applyCanonicalClusterBinding({
      clubId: CLUB_ID,
      clusterId: CLUSTER,
      courtIds: [COURT_1],
      courts: resolved.courts,
    });
    const written = writeClubDataV3Courts(nested, applied.courts);
    assert.equal(written.aiData.keep, true);
    assert.equal(written.data.bookings[0].id, "b1");
    assert.equal(written.data.courts[0].clusterId, CLUSTER);
  });
});

describe("canonical cluster binding service", () => {
  test("8. cross-tenant rejected", async () => {
    seedLocal([court(COURT_1)]);
    const result = await bindClubCourtsToCluster({
      clubId: CLUB_ID,
      venueId: OTHER_VENUE,
      clusterId: CLUSTER,
      courtIds: [COURT_1],
    });
    assert.equal(result.ok, false);
    assert.equal(result.code, CLUSTER_BINDING_CODE.CLUB_TENANT_MISMATCH);
  });

  test("9. cluster from another venue rejected", async () => {
    seedLocal([court(COURT_1)]);
    const result = await bindClubCourtsToCluster({
      clubId: CLUB_ID,
      venueId: VENUE,
      clusterId: OTHER_CLUSTER,
      courtIds: [COURT_1],
    });
    assert.equal(result.ok, false);
    assert.equal(result.code, CLUSTER_BINDING_CODE.CLUSTER_VENUE_MISMATCH);
  });

  test("10. inactive cluster rejected", async () => {
    seedLocal([court(COURT_1)]);
    const result = await bindClubCourtsToCluster({
      clubId: CLUB_ID,
      venueId: VENUE,
      clusterId: "inactive-cluster",
      courtIds: [COURT_1],
    });
    assert.equal(result.ok, false);
    assert.equal(result.code, CLUSTER_BINDING_CODE.CLUSTER_INACTIVE);
  });

  test("11. missing cluster rejected", async () => {
    seedLocal([court(COURT_1)]);
    const result = await bindClubCourtsToCluster({
      clubId: CLUB_ID,
      venueId: VENUE,
      clusterId: "missing-cluster",
      courtIds: [COURT_1],
    });
    assert.equal(result.ok, false);
    assert.equal(result.code, CLUSTER_BINDING_CODE.CLUSTER_NOT_FOUND);
  });

  test("14. anonymous / unauthorized denied", async () => {
    seedLocal([court(COURT_1)]);
    saveAuthSession(null);
    const result = await bindClubCourtsToCluster({
      clubId: CLUB_ID,
      venueId: VENUE,
      clusterId: CLUSTER,
      courtIds: [COURT_1],
    });
    assert.equal(result.ok, false);
    assert.ok(
      result.code === CLUSTER_BINDING_CODE.FORBIDDEN ||
        result.code === CLUSTER_BINDING_CODE.NOT_AUTHENTICATED
    );
  });

  test("15. authorized Owner/operator success", async () => {
    seedLocal([court(COURT_1), court(COURT_2), court(COURT_3, { note: "leave" })]);
    const result = await bindClubCourtsToCluster({
      clubId: CLUB_ID,
      venueId: VENUE,
      clusterId: CLUSTER,
      courtIds: [COURT_1, COURT_2],
    });
    assert.equal(result.ok, true);
    const stored = loadCourtsForClub(CLUB_ID);
    assert.equal(stored.find((item) => item.id === COURT_1).clusterId, CLUSTER);
    assert.equal(stored.find((item) => item.id === COURT_2).clusterId, CLUSTER);
    assert.equal(stored.find((item) => item.id === COURT_3).clusterId, undefined);
    assert.equal(stored.find((item) => item.id === COURT_3).note, "leave");
    const blob = JSON.parse(globalThis.localStorage.getItem(`pickleball-club-data-v3::${CLUB_ID}`));
    assert.equal(blob.bookings[0].id, "b1");
    assert.equal(blob.players[0].id, "p1");
    assert.equal(blob.courts.length, 3);
  });

  test("cloud RPC is used when Supabase is configured", async () => {
    const rpcCalls = [];
    __setBindClubCourtsToClusterDepsForTests({
      hasSupabaseConfig: () => true,
      getSupabaseAuthClient: () => ({
        rpc: async (name, args) => {
          rpcCalls.push([name, args]);
          return {
            data: {
              ok: true,
              code: "OK",
              clubRegisteredClusterId: CLUSTER,
              changedCourtIds: [COURT_1],
            },
            error: null,
          };
        },
      }),
    });
    const result = await bindClubCourtsToCluster({
      clubId: CLUB_ID,
      venueId: VENUE,
      clusterId: CLUSTER,
      courtIds: [COURT_1],
      expectedClubVersion: 3,
      expectedBlobVersion: 4,
    });
    assert.equal(result.ok, true);
    assert.equal(rpcCalls[0][0], CLUSTER_BINDING_RPC);
    assert.equal(rpcCalls[0][1].p_club_id, CLUB_ID);
    assert.deepEqual(rpcCalls[0][1].p_court_ids, [COURT_1]);
    assert.equal(rpcCalls[0][1].p_expected_club_version, 3);
    assert.equal(rpcCalls[0][1].p_expected_blob_version, 4);
  });
});

describe("read-time fabrication isolation", () => {
  test("16. read-time inventory causes zero writes", () => {
    seedLocal([court(COURT_1), court(COURT_2)]);
    const writes = [];
    const originalSet = globalThis.localStorage.setItem.bind(globalThis.localStorage);
    globalThis.localStorage.setItem = (key, value) => {
      writes.push(key);
      originalSet(key, value);
    };
    const beforeClusters = JSON.stringify(loadCourtClusters());
    loadCourts([], CLUB_ID, { clusterId: CLUSTER, venueId: VENUE });
    loadCourts([], CLUB_ID, { venueId: VENUE });
    assert.deepEqual(writes, []);
    assert.equal(JSON.stringify(loadCourtClusters()), beforeClusters);
  });

  test("17. canonical cloud read does not fabricate clusterId", async () => {
    const unstamped = court(COURT_1);
    delete unstamped.clusterId;
    const client = {
      from() {
        return {
          select() {
            return this;
          },
          eq() {
            return this;
          },
          limit() {
            return Promise.resolve({
              data: [
                {
                  club_id: CLUB_ID,
                  venue_id: VENUE,
                  version: 1,
                  data: { courts: [unstamped, court(COURT_2, { clusterId: CLUSTER })] },
                },
              ],
              error: null,
            });
          },
        };
      },
    };
    __setCanonicalCloudCourtInventoryDepsForTests({
      hasSupabaseConfig: () => true,
      getSupabaseAuthClient: () => client,
    });
    const result = await listCanonicalCloudCourts({ clubId: CLUB_ID, tenantId: VENUE });
    assert.equal(result.ok, true);
    const raw = result.courts.find((item) => item.id === COURT_1);
    assert.equal(isUnstampedCourt(raw), true);
    assert.equal(raw.clusterId, undefined);
  });

  test("18. filtered inventory excludes unstamped court", () => {
    seedLocal([court(COURT_1), court(COURT_2, { clusterId: CLUSTER })]);
    const filtered = loadCourts([], CLUB_ID, { clusterId: CLUSTER, venueId: VENUE });
    assert.deepEqual(
      filtered.map((item) => item.id),
      [COURT_2]
    );
    const membership = filterCourtsByClusterMembership(
      [court(COURT_1), court(COURT_2, { clusterId: CLUSTER })],
      CLUSTER
    );
    assert.deepEqual(
      membership.map((item) => item.id),
      [COURT_2]
    );
  });

  test("19. unfiltered inventory can expose unstamped court", () => {
    seedLocal([court(COURT_1), court(COURT_2, { clusterId: CLUSTER })]);
    const all = loadCourts([], CLUB_ID, { venueId: VENUE });
    assert.equal(all.length, 2);
    assert.equal(isUnstampedCourt(all.find((item) => item.id === COURT_1)), true);
    assert.equal(listUnstampedCourts(all).length, 1);
  });

  test("20. legacy compatibility path is isolated", () => {
    const stamped = ensureCourtsHaveClusterId([court(COURT_1)], VENUE);
    assert.equal(stamped[0].clusterId, buildDefaultClusterId(VENUE));
    const logicSrc = readFileSync(path.join(root, "src/pages/courts.logic.js"), "utf8");
    assert.equal(logicSrc.includes("ensureCourtsHaveClusterId("), false);
    const inventorySrc = readFileSync(
      path.join(root, "src/features/venue-court/services/canonicalCloudCourtInventory.js"),
      "utf8"
    );
    assert.equal(inventorySrc.includes("ensureCourtsHaveClusterId"), false);
    assert.equal(inventorySrc.includes("buildDefaultClusterId"), false);
    const clusterCtx = readFileSync(path.join(root, "src/context/ClusterContext.jsx"), "utf8");
    assert.match(clusterCtx, /LEGACY local-only compatibility/);
  });
});

describe("regressions", () => {
  test("21. Shared Court Resource Foundation #427 cluster membership still fail-closed", () => {
    seedLocal([court(COURT_1, { clusterId: CLUSTER })]);
    const pass = assertCourtClusterMembership({
      clubId: CLUB_ID,
      tenantId: VENUE,
      clusterId: CLUSTER,
      courtId: COURT_1,
    });
    assert.equal(pass.ok, true);
    const deny = assertCourtClusterMembership({
      clubId: CLUB_ID,
      tenantId: VENUE,
      clusterId: CLUSTER,
      courtId: COURT_2,
    });
    assert.equal(deny.ok, false);
  });

  test("22. Club governance regression still stores registeredClusterId locally", () => {
    seedLocal([court(COURT_1)]);
    const result = updateClubGovernance(CLUB_ID, { registeredClusterId: CLUSTER }, VENUE);
    assert.equal(result.ok, true);
    assert.equal(result.club.governance.registeredClusterId, CLUSTER);
  });

  test("23. Venue/Court court CRUD regression — saveCourts does not stamp default cluster", () => {
    seedLocal([court(COURT_1)]);
    const result = saveCourts([court(COURT_1)], CLUB_ID, {
      permission: PERMISSIONS.COURT_UPDATE,
    });
    assert.equal(result.ok, true);
    const stored = loadCourtsForClub(CLUB_ID);
    assert.equal(stored[0].clusterId, undefined);
  });

  test("24. Team Tournament shared inventory compatibility still excludes unstamped courts", async () => {
    const adapterSrc = readFileSync(
      path.join(root, "src/features/team-tournament/services/canonicalClubCourtInventory.js"),
      "utf8"
    );
    // Team Format & Venue reads club_data_v3 as compatibility only — not Team-local court authority.
    assert.match(adapterSrc, /club_data_v3/);
    assert.match(adapterSrc, /listCanonicalClubCourtsForFormatVenue|readCanonicalClubCourtBookingSnapshot/);
    assert.doesNotMatch(adapterSrc, /localStorage\.getItem|loadCourtsForClub|loadClubData/);

    // Upstream shared Court Resource inventory excludes unstamped courts when cluster-scoped.
    __setCanonicalCloudCourtInventoryDepsForTests({
      hasSupabaseConfig: () => true,
      getSupabaseAuthClient: () => ({
        from() {
          return {
            select() {
              return this;
            },
            eq() {
              return this;
            },
            limit() {
              return Promise.resolve({
                data: [
                  {
                    club_id: CLUB_ID,
                    venue_id: VENUE,
                    version: 1,
                    data: {
                      courts: [court(COURT_1), court(COURT_2, { clusterId: CLUSTER })],
                    },
                  },
                ],
                error: null,
              });
            },
          };
        },
      }),
    });
    const shared = await listCanonicalCloudCourts({
      clubId: CLUB_ID,
      tenantId: VENUE,
      clusterId: CLUSTER,
    });
    assert.equal(shared.ok, true);
    assert.deepEqual(
      shared.courts.map((item) => item.id),
      [COURT_2]
    );
    assert.equal(
      filterCourtsByClusterMembership(
        [court(COURT_1), court(COURT_2, { clusterId: CLUSTER })],
        CLUSTER
      ).map((item) => item.id).join(","),
      COURT_2
    );
  });
});

describe("SQL package contract", () => {
  const files = ["01_PRECHECK.sql", "02_APPLY.sql", "03_VERIFY.sql", "04_ROLLBACK.sql", "README.md"];
  const applySql = readFileSync(path.join(PACKAGE_DIR, "02_APPLY.sql"), "utf8");
  const precheckSql = readFileSync(path.join(PACKAGE_DIR, "01_PRECHECK.sql"), "utf8");
  const verifySql = readFileSync(path.join(PACKAGE_DIR, "03_VERIFY.sql"), "utf8");
  const rollbackSql = readFileSync(path.join(PACKAGE_DIR, "04_ROLLBACK.sql"), "utf8");

  test("package files exist and APPLY is additive RPC-only", () => {
    for (const name of files) {
      assert.equal(existsSync(path.join(PACKAGE_DIR, name)), true);
    }
    assert.match(precheckSql, /READ-ONLY|read-only/i);
    assert.match(applySql, /CREATE OR REPLACE FUNCTION public\.bind_club_courts_to_cluster/i);
    assert.match(applySql, /phase42_can_update_club/);
    assert.match(applySql, /FOREIGN_CLUSTER/);
    assert.match(applySql, /CROSS_CLUB_COURT/);
    assert.match(applySql, /CLUSTER_VENUE_MISMATCH/);
    assert.match(applySql, /CLUSTER_INACTIVE/);
    assert.match(applySql, /NOT_AUTHENTICATED/);
    assert.match(applySql, /registered_cluster_id = v_cluster_id/);
    assert.equal(/tournament/i.test(applySql), false);
    assert.equal(/DELETE FROM public\.club_data_v3/i.test(applySql), false);
    assert.equal(/INSERT INTO public\.club_data_v3/i.test(applySql), false);
    assert.match(verifySql, /anon can execute bind_club_courts_to_cluster/);
    assert.match(rollbackSql, /DROP FUNCTION IF EXISTS public\.bind_club_courts_to_cluster/);
    assert.match(rollbackSql, /Does not delete club or court business data/i);
  });
});
