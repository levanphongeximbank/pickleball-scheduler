import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { COMPETITION_COURT_ADAPTER_CONTRACT_VERSION } from "../src/features/competition-core/contracts/competitionCourtAdapterContract.js";
import { COURT_RESOURCE_CODE } from "../src/features/court-resource/constants/courtResourceContract.js";
import {
  COURT_ACCESS_AUTHORITY_TABLE,
  COURT_MASTER_TABLE,
  COURT_RESOURCE_OWNER,
  CANONICAL_LIST_ELIGIBLE_RPC,
} from "../src/features/court-resource/constants/courtOperationsOwnership.js";
import { listEligiblePhysicalCourts } from "../src/features/court-resource/services/canonicalCourtInventoryService.js";
import { DAILY_PLAY_CODE } from "../src/features/daily-play/canonical/dailyPlayCodes.js";
import {
  normalizeCanonicalCourt,
  resolveCreateMatchCount,
  selectEnabledCourts,
} from "../src/features/daily-play/canonical/dailyPlayCanonicalDomain.js";
import { normalizeDailyPlayServerSnapshot } from "../src/features/daily-play/canonical/normalizeDailyPlayServerSnapshot.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PKG = "docs/v5/migrations/daily-play-court-capability-canonical-read-path-01";
const PHYSICAL_A = "11111111-1111-4111-8111-111111111111";
const PHYSICAL_B = "22222222-2222-4222-8222-222222222222";
const PHYSICAL_INACTIVE = "33333333-3333-4333-8333-333333333333";
const TENANT = "tenant-a";
const TENANT_B = "tenant-b";
const VENUE = "venue-a";
const CLUB = "club-a";
const CLUB_B = "club-b";
const CLUSTER = "cluster-a";
const CLUSTER_B = "cluster-b";

function read(rel) {
  return readFileSync(path.join(root, rel), "utf8");
}

function pkgFile(name) {
  return read(`${PKG}/${name}`);
}

function court(overrides = {}) {
  return {
    physicalCourtId: PHYSICAL_A,
    tenantId: TENANT,
    clusterId: CLUSTER,
    displayName: "Sân 1",
    displayCode: "C1",
    displayNumber: "1",
    sortOrder: 1,
    lifecycleStatus: "active",
    ...overrides,
  };
}

function access(overrides = {}) {
  return {
    tenantId: TENANT,
    clubId: CLUB,
    physicalCourtId: PHYSICAL_A,
    status: "enabled",
    ...overrides,
  };
}

function sources(overrides = {}) {
  return {
    clubs: [
      { id: CLUB, tenantId: TENANT },
      { id: CLUB_B, tenantId: TENANT },
    ],
    clusters: [
      { id: CLUSTER, tenantId: TENANT, venueId: VENUE },
      { id: CLUSTER_B, tenantId: TENANT, venueId: VENUE },
    ],
    physicalCourts: [
      court(),
      court({
        physicalCourtId: PHYSICAL_B,
        clusterId: CLUSTER_B,
        displayName: "Sân 2",
        displayCode: "C2",
        displayNumber: "2",
        sortOrder: 2,
      }),
      court({
        physicalCourtId: PHYSICAL_INACTIVE,
        displayName: "Sân 3",
        displayCode: "C3",
        displayNumber: "3",
        sortOrder: 3,
        lifecycleStatus: "inactive",
      }),
    ],
    clubOperationalAccess: [
      access(),
      access({ physicalCourtId: PHYSICAL_B }),
      access({ physicalCourtId: PHYSICAL_INACTIVE }),
    ],
    ...overrides,
  };
}

test("ownership freeze: Court Operations owns the reader; Daily does not", () => {
  assert.equal(COURT_RESOURCE_OWNER, "2.2_COURT_OPERATIONS");
  assert.equal(CANONICAL_LIST_ELIGIBLE_RPC, "court_resource_list_eligible_courts");
  assert.equal(COURT_MASTER_TABLE, "court_resource_physical_courts");
  assert.equal(COURT_ACCESS_AUTHORITY_TABLE, "court_resource_club_operational_access");
  assert.equal(COMPETITION_COURT_ADAPTER_CONTRACT_VERSION, 1);
});

test("1. canonical physical court + enabled club access => visible", () => {
  const result = listEligiblePhysicalCourts({ tenantId: TENANT, clubId: CLUB }, sources());
  assert.equal(result.ok, true);
  assert.deepEqual(
    result.courts.map((row) => row.physicalCourtId),
    [PHYSICAL_A, PHYSICAL_B]
  );
});

test("2. canonical physical court for wrong Tenant => invisible/deny", () => {
  const result = listEligiblePhysicalCourts({ tenantId: TENANT_B, clubId: CLUB }, sources());
  assert.equal(result.ok, false);
  assert.equal(result.code, COURT_RESOURCE_CODE.TENANT_MISMATCH);
  assert.deepEqual(result.courts, []);
});

test("3. correct Tenant but club access missing => invisible", () => {
  const result = listEligiblePhysicalCourts(
    { tenantId: TENANT, clubId: CLUB_B },
    sources({ clubOperationalAccess: [access()] })
  );
  assert.equal(result.ok, true);
  assert.deepEqual(result.courts, []);
});

test("4. disabled club operational access => invisible", () => {
  const result = listEligiblePhysicalCourts(
    { tenantId: TENANT, clubId: CLUB },
    sources({
      clubOperationalAccess: [
        access({ status: "disabled" }),
        access({ physicalCourtId: PHYSICAL_B, status: "enabled" }),
      ],
    })
  );
  assert.deepEqual(
    result.courts.map((row) => row.physicalCourtId),
    [PHYSICAL_B]
  );
});

test("5. inactive physical court => invisible", () => {
  const result = listEligiblePhysicalCourts({ tenantId: TENANT, clubId: CLUB }, sources());
  assert.equal(
    result.courts.some((row) => row.physicalCourtId === PHYSICAL_INACTIVE),
    false
  );
});

test("6. cluster filter only returns physical courts in that cluster", () => {
  const result = listEligiblePhysicalCourts(
    { tenantId: TENANT, clubId: CLUB, clusterId: CLUSTER },
    sources()
  );
  assert.deepEqual(
    result.courts.map((row) => row.physicalCourtId),
    [PHYSICAL_A]
  );
  assert.equal(result.courts.every((row) => row.clusterId === CLUSTER), true);
});

test("7. tenantId != venueId works correctly", () => {
  const result = listEligiblePhysicalCourts(
    { tenantId: TENANT, venueId: VENUE, clubId: CLUB },
    sources()
  );
  assert.equal(result.ok, true);
  assert.ok(result.courts.length >= 1);
});

test("8. no Venue-as-Tenant fallback", () => {
  const collapse = listEligiblePhysicalCourts({ venueId: VENUE, clubId: CLUB }, sources());
  assert.equal(collapse.ok, false);
  assert.equal(collapse.code, COURT_RESOURCE_CODE.TENANT_VENUE_COLLAPSE_DENIED);
});

test("9–10. Daily SQL delegates to Court-owned reader and does not query court tables", () => {
  const apply = pkgFile("02_APPLY.sql");
  const dailyStart = apply.indexOf("CREATE OR REPLACE FUNCTION public.daily_play_read_courts");
  const dailyEnd = apply.indexOf("COMMENT ON FUNCTION public.daily_play_read_courts");
  assert.ok(dailyStart >= 0 && dailyEnd > dailyStart);
  const dailyFn = apply.slice(dailyStart, dailyEnd);
  assert.match(dailyFn, /court_resource_list_eligible_courts/);
  assert.doesNotMatch(dailyFn, /club_data_v3/);
  assert.doesNotMatch(dailyFn, /court_resource_physical_courts/);
  assert.doesNotMatch(dailyFn, /court_resource_club_operational_access/);
  assert.doesNotMatch(dailyFn, /localStorage/);
  assert.doesNotMatch(dailyFn, /user_venue_id/);
});

test("11. Daily accepts canonical physicalCourtId projection via SQL alias", () => {
  const apply = pkgFile("02_APPLY.sql");
  assert.match(apply, /'id', c\.court->>'physicalCourtId'/);
  assert.match(apply, /'courtId', c\.court->>'physicalCourtId'/);
  assert.match(apply, /compatibilityAlias/);
  const courts = [
    {
      physicalCourtId: PHYSICAL_A,
      id: PHYSICAL_A,
      displayName: "TT412 Sân 1",
      status: "active",
      clusterId: CLUSTER,
    },
  ];
  const normalized = courts.map((row, index) => normalizeCanonicalCourt(row, index));
  assert.equal(normalized[0].id, PHYSICAL_A);
  const enabled = selectEnabledCourts(courts, []);
  assert.equal(enabled.length, 1);
  const allowlisted = selectEnabledCourts(courts, [PHYSICAL_A]);
  assert.equal(allowlisted.length, 1);
});

test("12–15. Strategy A does not implement blob compatibility as SSOT", () => {
  const apply = pkgFile("02_APPLY.sql");
  const readme = pkgFile("00_README.md");
  assert.match(readme, /SELECTED_STRATEGY=CANONICAL/);
  assert.match(readme, /COMPATIBILITY_FALLBACK_USED=NO/);
  assert.match(readme, /CLUB_DATA_V3_AS_SSOT=NO/);
  const applyFn = apply.replace(/--[^\n]*/g, "");
  assert.doesNotMatch(applyFn, /data\.data\.courts/);
  assert.doesNotMatch(applyFn, /club_data_v3/);
});

test("16–17. no localStorage and no fake court creation", () => {
  const apply = pkgFile("02_APPLY.sql");
  assert.doesNotMatch(apply, /localStorage/);
  assert.doesNotMatch(apply, /INSERT INTO public\.court_resource_physical_courts/);
  assert.doesNotMatch(apply, /INSERT INTO public\.court_resource_club_operational_access/);
  assert.doesNotMatch(apply, /UPDATE public\.club_data_v3/);
});

test("18. Daily create-match preflight sees >=1 court when Court reader returns one", () => {
  const projected = [
    {
      id: PHYSICAL_A,
      name: "TT412 Sân 1",
      active: true,
      status: "active",
    },
  ];
  const plan = resolveCreateMatchCount({
    enabledCourts: projected,
    availableCourts: projected,
    eligiblePlayerCount: 8,
  });
  assert.equal(plan.ok, true);
  assert.notEqual(plan.code, DAILY_PLAY_CODE.NO_COURT_CAPABILITY);

  const snapshot = normalizeDailyPlayServerSnapshot({
    ok: true,
    tournamentId: "t1",
    state: { revision: 0, matches: [], checkedInPlayerIds: [], enabledCourtIds: [] },
    courts: [
      {
        physicalCourtId: PHYSICAL_A,
        id: PHYSICAL_A,
        displayName: "TT412 Sân 1",
        status: "active",
        identityAuthority: "physicalCourtId",
      },
    ],
    activeLeases: [],
  });
  assert.equal(snapshot.ok, true);
  assert.equal(snapshot.hasCourtCapability, true);
  assert.equal(snapshot.courts[0].id, PHYSICAL_A);
});

test("19. existing Daily CAS/idempotency functions are not rewritten", () => {
  const apply = pkgFile("02_APPLY.sql");
  assert.doesNotMatch(apply, /CREATE OR REPLACE FUNCTION public\.daily_play_begin_command/);
  assert.doesNotMatch(apply, /CREATE OR REPLACE FUNCTION public\.daily_play_finish_command/);
  assert.doesNotMatch(apply, /CREATE OR REPLACE FUNCTION public\.daily_play_write_state/);
  assert.doesNotMatch(apply, /CREATE OR REPLACE FUNCTION public\.daily_play_create_matches/);
  assert.doesNotMatch(apply, /CREATE OR REPLACE FUNCTION public\.daily_play_assign_court/);
});

test("20. CORE13 semantic preflight consumes Daily court capability without private imports", () => {
  const snapshot = normalizeDailyPlayServerSnapshot({
    ok: true,
    courts: [
      {
        physicalCourtId: PHYSICAL_A,
        id: PHYSICAL_A,
        displayName: "TT412 Sân 1",
        status: "active",
      },
    ],
    state: { revision: 0 },
  });
  const core13Preflight = {
    dailyCourtCapabilityReady: snapshot.hasCourtCapability === true && snapshot.courts.length >= 1,
    canonicalIdentityPresent: snapshot.courts.every((row) => String(row.id || "") === PHYSICAL_A),
  };
  assert.equal(core13Preflight.dailyCourtCapabilityReady, true);
  assert.equal(core13Preflight.canonicalIdentityPresent, true);
  const thisTestSource = readFileSync(fileURLToPath(import.meta.url), "utf8");
  assert.doesNotMatch(
    thisTestSource,
    /from ["'][^"']*daily-play-court-capability-canonical-read-path-01[^"']*["']/
  );
});

test("SQL package is complete and fail-closed on Tenant/Venue", () => {
  const precheck = pkgFile("01_PRECHECK.sql");
  const apply = pkgFile("02_APPLY.sql");
  const verify = pkgFile("03_VERIFY.sql");
  const rollback = pkgFile("04_ROLLBACK.sql");
  const readme = pkgFile("00_README.md");

  assert.match(precheck, /court_resource_physical_courts/);
  assert.match(precheck, /court_resource_club_operational_access/);
  assert.match(precheck, /court_clusters/);
  assert.match(precheck, /SELECTED_STRATEGY/);
  assert.match(precheck, /PRODUCTION_FORBIDDEN/);
  assert.match(precheck, /overload/);

  const applyFn = apply.replace(/--[^\n]*/g, "");
  assert.match(applyFn, /CREATE OR REPLACE FUNCTION public\.court_resource_list_eligible_courts/);
  assert.match(applyFn, /CREATE OR REPLACE FUNCTION public\.daily_play_read_courts/);
  assert.match(applyFn, /SET search_path = pg_catalog, public/);
  assert.match(applyFn, /p\.tenant_id/);
  assert.match(applyFn, /cc\.tenant_id/);
  assert.doesNotMatch(applyFn, /user_venue_id/);
  assert.doesNotMatch(applyFn, /user_tenant_id/);
  assert.match(apply, /REVOKE ALL ON FUNCTION public\.court_resource_list_eligible_courts/);
  assert.match(apply, /REVOKE ALL ON FUNCTION public\.daily_play_read_courts/);
  assert.match(apply, /GRANT EXECUTE ON FUNCTION public\.court_resource_list_eligible_courts/);

  assert.match(verify, /court_resource_list_eligible_courts/);
  assert.match(verify, /daily_play_read_courts must delegate/);
  assert.match(verify, /user_venue_id/);
  assert.match(verify, /physicalCourtId/);
  assert.match(verify, /club-ecebf64c78f948ccb2b59842441eb26c/);

  assert.match(rollback, /ROLLBACK_FAIL/);
  assert.doesNotMatch(rollback, /DELETE FROM public\.court_resource_physical_courts/);
  assert.doesNotMatch(rollback, /DELETE FROM public\.club_data_v3/);
  assert.doesNotMatch(rollback, /DROP TABLE/);

  assert.match(readme, /PR444_TOUCH=NO/);
  assert.match(readme, /PRODUCTION_APPLY=NO/);
});

test("this workstream would have caught the nested-blob Staging blocker", () => {
  const historicalDaily = `
    SELECT jsonb_agg(c.court)
    FROM public.club_data_v3 d
    CROSS JOIN LATERAL jsonb_array_elements(
      CASE WHEN jsonb_typeof(d.data->'courts') = 'array'
        THEN d.data->'courts' ELSE '[]'::jsonb END
    ) AS c(court)
  `;
  const apply = pkgFile("02_APPLY.sql");
  assert.match(historicalDaily, /club_data_v3/);
  assert.match(historicalDaily, /d\.data->'courts'/);
  assert.doesNotMatch(historicalDaily, /data\.data\.courts|data#>'\{data,courts\}'/);
  const applyFn = apply.replace(/--[^\n]*/g, "");
  assert.doesNotMatch(applyFn, /club_data_v3/);
  assert.match(applyFn, /court_resource_list_eligible_courts/);
});
