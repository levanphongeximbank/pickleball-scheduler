/**
 * Batch 6 — Competition Mode Court Adapter B (all four modes).
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  COMPETITION_COURT_ADAPTER_CAPABILITY,
  COMPETITION_COURT_ADAPTER_CONTRACT_VERSION,
  COMPETITION_TYPE,
} from "../src/features/competition-core/contracts/competitionCourtAdapterContract.js";
import {
  CANONICAL_COMPETITION_COURT_ADAPTERS_DEFAULT,
  MODE_COURT_ADAPTER_B_OWNER,
  MODE_COURT_ADAPTER_B_CODE,
  createDailyPlayCourtAdapter,
  createInternalTournamentCourtAdapter,
  createOfficialTournamentCourtAdapter,
  createTeamTournamentCourtAdapter,
  createIsolatedDailyPlayCourtOrchestrator,
  DAILY_PLAY_CAPACITY_AUTHORITY,
  DAILY_PLAY_LEASE_IS_CAPACITY_SSOT,
  DAILY_PLAY_LEASE_IS_PROJECTION,
  isCanonicalCompetitionCourtAdaptersEnabled,
  __resetCanonicalCompetitionCourtAdaptersForTests,
  syncCompetitionCourtScheduleViaAdapterB,
  listCompetitionEligibleCourtsViaAdapterB,
} from "../src/features/competition-engine/integration/court-adapters/index.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ADAPTER_ROOT = path.join(
  ROOT,
  "src/features/competition-engine/integration/court-adapters"
);

const TENANT = "tenant-batch6-01";
const CLUB = "club-batch6-01";
const COURT01 = "11111111-1111-4111-8111-111111111111";
const COURT02 = "22222222-2222-4222-8222-222222222222";
const WINDOW = { date: "2026-08-20", startTime: "09:00", endTime: "11:00" };

function createTrackingHeadA() {
  const calls = [];
  const headA = {
    contractVersion: COMPETITION_COURT_ADAPTER_CONTRACT_VERSION,
    capabilities: COMPETITION_COURT_ADAPTER_CAPABILITY,
    async listEligibleCourts(input) {
      calls.push({ name: "listEligibleCourts", input });
      return {
        ok: true,
        contractVersion: 1,
        code: "OK",
        courts: [
          { physicalCourtId: COURT01, displayName: "Sân 1" },
          { physicalCourtId: COURT02, displayName: "Sân 2" },
        ],
      };
    },
    async getCourtAvailability(input) {
      calls.push({ name: "getCourtAvailability", input });
      return {
        ok: true,
        contractVersion: 1,
        code: "OK",
        courts: (input.physicalCourtIds || []).map((id) => ({
          physicalCourtId: id,
          available: true,
          resultCode: "AVAILABLE",
        })),
      };
    },
    async reserveCourts(input) {
      calls.push({ name: "reserveCourts", input });
      return {
        ok: true,
        contractVersion: 1,
        code: "OK",
        reserved: (input.physicalCourtIds || []).map((id) => ({ physicalCourtId: id })),
        owner: {
          ownerType: "competition",
          ownerId: input.competitionId,
          competitionType: input.competitionType,
        },
      };
    },
    async releaseCourts(input) {
      calls.push({ name: "releaseCourts", input });
      return {
        ok: true,
        contractVersion: 1,
        code: "OK",
        released: (input.physicalCourtIds || []).map((id) => ({
          physicalCourtId: id,
          reservationId: `res-${id}`,
        })),
      };
    },
    async validateMatchAssignment(input) {
      calls.push({ name: "validateMatchAssignment", input });
      return {
        ok: true,
        valid: true,
        contractVersion: 1,
        code: "ASSIGNMENT_VALID",
        matchId: input.matchId,
        physicalCourtId: input.physicalCourtId || input.physicalCourtIds?.[0],
      };
    },
  };
  return { headA, calls };
}

const MODE_FACTORIES = [
  {
    key: "daily_play",
    create: createDailyPlayCourtAdapter,
    competitionType: "daily_play",
  },
  {
    key: "internal",
    create: createInternalTournamentCourtAdapter,
    competitionType: COMPETITION_TYPE.INTERNAL,
  },
  {
    key: "official",
    create: createOfficialTournamentCourtAdapter,
    competitionType: COMPETITION_TYPE.OFFICIAL_OPEN,
  },
  {
    key: "team",
    create: createTeamTournamentCourtAdapter,
    competitionType: COMPETITION_TYPE.TEAM,
  },
];

test("adoption control defaults OFF", () => {
  __resetCanonicalCompetitionCourtAdaptersForTests();
  assert.equal(CANONICAL_COMPETITION_COURT_ADAPTERS_DEFAULT, false);
  assert.equal(isCanonicalCompetitionCourtAdaptersEnabled(), false);
  assert.equal(MODE_COURT_ADAPTER_B_OWNER, "2.13_COMPETITION_ENGINE");
});

for (const mode of MODE_FACTORIES) {
  test(`${mode.key}: Adapter B routes all 5 Head A capabilities with native physical ids`, async () => {
    const { headA, calls } = createTrackingHeadA();
    const adapter = mode.create({ headA });
    assert.equal(adapter.competitionType, mode.competitionType);
    assert.equal(adapter.adapterOwner, MODE_COURT_ADAPTER_B_OWNER);

    const base = {
      tenantId: TENANT,
      clubId: CLUB,
      competitionId: `comp-${mode.key}`,
      physicalCourtIds: [COURT01],
      ...WINDOW,
      matchId: `match-${mode.key}`,
      actorId: "actor-1",
    };

    const listed = await adapter.listEligibleCourts(base);
    assert.equal(listed.ok, true);
    assert.equal(listed.courts[0].physicalCourtId, COURT01);

    const availability = await adapter.getCourtAvailability(base);
    assert.equal(availability.ok, true);
    assert.equal(availability.courts[0].physicalCourtId, COURT01);

    const reserved = await adapter.reserveCourts(base);
    assert.equal(reserved.ok, true);
    assert.equal(reserved.reserved[0].physicalCourtId, COURT01);

    const validated = await adapter.validateMatchAssignment(base);
    assert.equal(validated.ok, true);
    assert.equal(validated.valid, true);

    const released = await adapter.releaseCourts(base);
    assert.equal(released.ok, true);
    assert.equal(released.released[0].physicalCourtId, COURT01);

    assert.equal(calls.length, 5);
    for (const call of calls) {
      assert.equal(call.input.tenantId, TENANT);
      assert.equal(call.input.clubId, CLUB);
      assert.equal(call.input.competitionType, mode.competitionType);
      assert.equal(call.input.competitionId, `comp-${mode.key}`);
      if (call.name !== "listEligibleCourts") {
        assert.deepEqual(call.input.physicalCourtIds, [COURT01]);
      }
      assert.equal(call.input.legacyCourtId, undefined);
      assert.equal("selectedCourtIds" in call.input && call.input.selectedCourtIds, false);
    }
  });

  test(`${mode.key}: missing tenantId fails closed; venueId cannot substitute`, async () => {
    const { headA, calls } = createTrackingHeadA();
    const adapter = mode.create({ headA });
    const missing = await adapter.listEligibleCourts({
      clubId: CLUB,
      competitionId: "c1",
    });
    assert.equal(missing.ok, false);
    assert.equal(missing.code, MODE_COURT_ADAPTER_B_CODE.MISSING_TENANT_ID);
    assert.equal(calls.length, 0);

    const venueOnly = await adapter.reserveCourts({
      venueId: TENANT,
      clubId: CLUB,
      competitionId: "c1",
      physicalCourtIds: [COURT01],
      ...WINDOW,
    });
    assert.equal(venueOnly.ok, false);
    assert.equal(venueOnly.code, MODE_COURT_ADAPTER_B_CODE.TENANT_VENUE_COLLAPSE_DENIED);
    assert.equal(calls.length, 0);
  });

  test(`${mode.key}: legacy non-UUID court identity is rejected (no mapping)`, async () => {
    const { headA, calls } = createTrackingHeadA();
    const adapter = mode.create({ headA });
    const denied = await adapter.reserveCourts({
      tenantId: TENANT,
      clubId: CLUB,
      competitionId: "c1",
      selectedCourtIds: ["legacy-court-1"],
      ...WINDOW,
    });
    assert.equal(denied.ok, false);
    assert.equal(denied.code, MODE_COURT_ADAPTER_B_CODE.LEGACY_COURT_IDENTITY_DENIED);
    assert.equal(calls.length, 0);
  });
}

test("Daily Play orchestrator: Head A reserve + projection lease, zero D4 acquire / double reserve", async () => {
  const { headA, calls } = createTrackingHeadA();
  const orchestrator = createIsolatedDailyPlayCourtOrchestrator({ headA });
  assert.equal(orchestrator.capacityAuthority, DAILY_PLAY_CAPACITY_AUTHORITY);
  assert.equal(orchestrator.leaseIsCapacitySsot, DAILY_PLAY_LEASE_IS_CAPACITY_SSOT);
  assert.equal(orchestrator.leaseIsProjection, DAILY_PLAY_LEASE_IS_PROJECTION);
  assert.equal(DAILY_PLAY_LEASE_IS_CAPACITY_SSOT, false);
  assert.equal(DAILY_PLAY_LEASE_IS_PROJECTION, true);

  const result = await orchestrator.reserveWithProjection({
    tenantId: TENANT,
    clubId: CLUB,
    competitionId: "dp-1",
    matchId: "m-1",
    physicalCourtIds: [COURT01],
    ...WINDOW,
  });
  assert.equal(result.ok, true);
  assert.equal(result.doubleReservationPaths, 0);
  assert.equal(result.d4AcquireCalls, 0);
  assert.equal(result.leases[0].physicalCourtId, COURT01);
  assert.equal(result.leases[0].leaseRole, "LIVE_EXECUTION_PROJECTION");
  assert.equal(calls.filter((c) => c.name === "reserveCourts").length, 1);

  const released = await orchestrator.releaseWithProjection({
    tenantId: TENANT,
    clubId: CLUB,
    competitionId: "dp-1",
    matchId: "m-1",
    physicalCourtIds: [COURT01],
  });
  assert.equal(released.ok, true);
  assert.equal(released.doubleReservationPaths, 0);
});

test("Team Adapter B source has no Dreambreaker / tie-break business logic", () => {
  const source = readFileSync(path.join(ADAPTER_ROOT, "TeamTournamentCourtAdapter.js"), "utf8");
  // Strip block comments — docs may mention forbidden concerns by name.
  const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  assert.doesNotMatch(code, /dreambreaker|stageTieBreak|tieBreak|knockout|seedBracket/i);
  const shared = readFileSync(path.join(ADAPTER_ROOT, "createModeCourtAdapterB.js"), "utf8");
  const sharedCode = shared.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  assert.doesNotMatch(sharedCode, /dreambreaker|stageTieBreak|groupStage|winnerLogic/i);
});

test("schedule bridge uses Adapter B when forced; adoption default remains OFF", async () => {
  __resetCanonicalCompetitionCourtAdaptersForTests();
  assert.equal(isCanonicalCompetitionCourtAdaptersEnabled(), false);

  const { headA, calls } = createTrackingHeadA();
  const synced = await syncCompetitionCourtScheduleViaAdapterB(
    {
      id: "t-internal-1",
      mode: "internal_tournament",
      tenantId: TENANT,
      clubId: CLUB,
      courtSchedule: { ...WINDOW, courtIds: [COURT01, COURT02] },
    },
    { forceCanonical: true, headA }
  );
  assert.equal(synced.ok, true);
  assert.equal(synced.canonical, true);
  assert.equal(synced.modeKey, "internal_tournament");
  assert.equal(calls[0].name, "reserveCourts");
  assert.deepEqual(calls[0].input.physicalCourtIds, [COURT01, COURT02]);
  assert.equal(calls[0].input.competitionType, COMPETITION_TYPE.INTERNAL);

  const listed = await listCompetitionEligibleCourtsViaAdapterB({
    forceCanonical: true,
    mode: "official_tournament",
    tenantId: TENANT,
    clubId: CLUB,
    headA,
  });
  assert.equal(listed.ok, true);
  assert.equal(listed.modeKey, "official_tournament");
});

test("Mode Adapter B tree forbids storage / gateway / club_data_v3 bypass", () => {
  const files = readdirSync(ADAPTER_ROOT).filter((name) => name.endsWith(".js"));
  const forbiddenImport =
    /(?:import|export)\s+[^;]*\b(?:clubStorage|loadCourtsForClub|legacyCourtIdentityMapping|courtResourceGateway)\b|club_data_v3|from\s+["'][^"']*supabase|court_resource_daily_play_acquire/;
  for (const name of files) {
    const source = readFileSync(path.join(ADAPTER_ROOT, name), "utf8");
    assert.doesNotMatch(source, forbiddenImport, name);
  }
});

test("court-side provider still has no mode business imports", () => {
  const provider = readFileSync(
    path.join(ROOT, "src/features/competition-core/adapters/courtResourceCompetitionAdapter.js"),
    "utf8"
  );
  assert.doesNotMatch(
    provider,
    /DailyPlayCourtAdapter|InternalTournamentCourtAdapter|OfficialTournamentCourtAdapter|TeamTournamentCourtAdapter|createModeCourtAdapterB/
  );
  assert.doesNotMatch(provider, /dreambreaker|seedBracket|drawEngine/);
});

test("HEAD_A capability count remains 5 and version 1", () => {
  assert.equal(COMPETITION_COURT_ADAPTER_CONTRACT_VERSION, 1);
  assert.equal(Object.keys(COMPETITION_COURT_ADAPTER_CAPABILITY).length, 5);
});
