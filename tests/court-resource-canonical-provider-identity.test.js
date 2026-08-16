/**
 * Batch 2 — native physicalCourtId provider/Gateway chain.
 * Global cutover remains OFF. Canonical path is independently correct.
 */
import assert from "node:assert/strict";
import test, { afterEach } from "node:test";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { COURT_RESOURCE_CODE } from "../src/features/court-resource/constants/courtResourceContract.js";
import {
  __resetCourtResourceGatewayDepsForTests,
  __setCourtResourceGatewayDepsForTests,
  getCourtAvailability,
  listEligibleCourts,
  listOwnerReservations,
  reserveCourts,
} from "../src/features/court-resource/services/courtResourceGateway.js";
import { createCanonicalInventoryReader } from "../src/features/court-resource/services/canonicalCourtInventoryService.js";
import { createCourtResourceCompetitionAdapter } from "../src/features/competition-core/adapters/courtResourceCompetitionAdapter.js";
import {
  COMPETITION_COURT_ADAPTER_CONTRACT_VERSION,
  COMPETITION_COURT_ADAPTER_CAPABILITY,
  COMPETITION_COURT_ERROR_CODE,
} from "../src/features/competition-core/contracts/competitionCourtAdapterContract.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TENANT = "tenant-native";
const OTHER_TENANT = "tenant-other";
const CLUB = "club-native";
const CLUSTER = "NAM_LONG";
const COURT01 = "11111111-1111-4111-8111-111111111111";
const COURT02 = "22222222-2222-4222-8222-222222222222";
const UNKNOWN = "99999999-9999-4999-8999-999999999999";
const WINDOW = { date: "2026-08-16", startTime: "10:00", endTime: "11:00" };

afterEach(() => {
  __resetCourtResourceGatewayDepsForTests();
});

function inventoryReader() {
  return createCanonicalInventoryReader({
    clubs: [{ id: CLUB, tenantId: TENANT }],
    clusters: [{ id: CLUSTER, tenantId: TENANT, venueId: TENANT }],
    physicalCourts: [
      {
        physicalCourtId: COURT01,
        tenantId: TENANT,
        clusterId: CLUSTER,
        displayName: "Sân 1",
        displayCode: "NL_C01",
        displayNumber: "1",
        sortOrder: 1,
        lifecycleStatus: "active",
      },
      {
        physicalCourtId: COURT02,
        tenantId: TENANT,
        clusterId: CLUSTER,
        displayName: "Sân 2",
        displayCode: "NL_C02",
        displayNumber: "2",
        sortOrder: 2,
        lifecycleStatus: "active",
      },
    ],
    clubOperationalAccess: [
      { tenantId: TENANT, clubId: CLUB, physicalCourtId: COURT01, status: "enabled" },
      { tenantId: TENANT, clubId: CLUB, physicalCourtId: COURT02, status: "enabled" },
    ],
  });
}

function bindCanonical(extra = {}) {
  const rpc = {
    reserve: [],
    availability: [],
    release: [],
    ownerRead: [],
    resolver: 0,
  };
  const store = [];
  __setCourtResourceGatewayDepsForTests({
    listEligiblePhysicalCourts: inventoryReader(),
    isCanonicalReservationCutover: () => false,
    resolveLegacyPhysicalCourt: () => {
      rpc.resolver += 1;
      return { ok: false, code: COURT_RESOURCE_CODE.UNRESOLVED_MAPPING };
    },
    canonicalReserve: (payload) => {
      rpc.reserve.push(payload);
      if (payload.physicalCourtIds.includes(UNKNOWN)) {
        return { ok: false, code: COURT_RESOURCE_CODE.UNKNOWN_COURT };
      }
      if (payload.tenantId !== TENANT) {
        return { ok: false, code: COURT_RESOURCE_CODE.TENANT_MISMATCH };
      }
      store.push(payload);
      return {
        ok: true,
        reservationIds: payload.physicalCourtIds.map((id) => `res-${id}`),
        reservations: payload.physicalCourtIds.map((id) => ({
          reservationId: `res-${id}`,
          physicalCourtId: id,
        })),
        physicalCourtIds: [...payload.physicalCourtIds],
      };
    },
    canonicalGetAvailability: (payload) => {
      rpc.availability.push(payload);
      if (payload.tenantId !== TENANT) {
        return { ok: false, code: COURT_RESOURCE_CODE.TENANT_MISMATCH, courts: [] };
      }
      return {
        ok: true,
        courts: payload.physicalCourtIds.map((id) => {
          if (id === UNKNOWN) {
            return { physicalCourtId: id, status: "UNKNOWN_COURT" };
          }
          const hit = store.find((row) => row.physicalCourtIds.includes(id));
          if (!hit) {
            return { physicalCourtId: id, status: "AVAILABLE" };
          }
          const own = hit.ownerType === payload.ownerType && hit.ownerId === payload.ownerId;
          return {
            physicalCourtId: id,
            status: own ? "OWN_RESERVATION" : "FOREIGN_RESERVATION",
          };
        }),
      };
    },
    canonicalRelease: (payload) => {
      rpc.release.push(payload);
      return {
        ok: true,
        releasedReservationIds: ["rel-1"],
        physicalCourtIds: payload.physicalCourtIds || [],
      };
    },
    canonicalListOwnerReservations: (payload) => {
      rpc.ownerRead.push(payload);
      if (payload.tenantId !== TENANT) {
        return { ok: false, code: COURT_RESOURCE_CODE.TENANT_MISMATCH, reservations: [] };
      }
      return {
        ok: true,
        reservations: [
          {
            reservationId: "res-own",
            physicalCourtId: COURT01,
            ownerType: payload.ownerType,
            ownerId: payload.ownerId,
            status: "active",
          },
        ],
      };
    },
    ...extra,
  });
  return rpc;
}

function competitionInput(extra = {}) {
  return {
    tenantId: TENANT,
    clubId: CLUB,
    clusterId: CLUSTER,
    competitionId: "COMP-NATIVE",
    ...extra,
  };
}

test("A. listEligibleCourts Head A → provider → Gateway native physicalCourtId", async () => {
  const rpc = bindCanonical();
  const adapter = createCourtResourceCompetitionAdapter();
  const listed = await adapter.listEligibleCourts(
    competitionInput({ physicalCourtIds: [COURT01] })
  );
  assert.equal(listed.ok, true, listed.error);
  assert.equal(listed.courts[0].physicalCourtId, COURT01);
  assert.equal(listed.courts[0].identityAuthority || "physicalCourtId", "physicalCourtId");
  const gatewayListed = await listEligibleCourts({
    tenantId: TENANT,
    clubId: CLUB,
    physicalCourtIds: [COURT01],
  });
  assert.equal(gatewayListed.courts[0].physicalCourtId, COURT01);
  assert.equal(rpc.resolver, 0);
});

test("B/C/D/E. availability, reserve, release, assignment keep native UUIDs to RPC", async () => {
  const rpc = bindCanonical();
  const adapter = createCourtResourceCompetitionAdapter();
  const owner = { type: "tournament", id: "COMP-NATIVE" };

  const availability = await adapter.getCourtAvailability(
    competitionInput({ physicalCourtIds: [COURT01, COURT02], ...WINDOW })
  );
  assert.equal(availability.ok, true);
  assert.deepEqual(rpc.availability[0].physicalCourtIds.sort(), [COURT01, COURT02].sort());

  const reserved = await adapter.reserveCourts(
    competitionInput({ physicalCourtIds: [COURT01, COURT02], ...WINDOW })
  );
  assert.equal(reserved.ok, true, reserved.error);
  assert.deepEqual(rpc.reserve[0].physicalCourtIds.sort(), [COURT01, COURT02].sort());
  assert.equal(rpc.reserve[0].ownerType, "competition");

  const released = await adapter.releaseCourts(
    competitionInput({ physicalCourtIds: [COURT01] })
  );
  assert.equal(released.ok, true, released.error);
  assert.deepEqual(rpc.release[0].physicalCourtIds, [COURT01].sort());

  const assignment = await adapter.validateMatchAssignment(
    competitionInput({ physicalCourtId: COURT01, matchId: "M-1", ...WINDOW })
  );
  assert.equal(assignment.ok, true, assignment.error);
  assert.equal(assignment.physicalCourtId, COURT01);
  assert.deepEqual(rpc.availability.at(-1).physicalCourtIds, [COURT01]);

  const direct = await reserveCourts({
    tenantId: TENANT,
    clubId: CLUB,
    physicalCourtIds: [COURT01],
    owner,
    ...WINDOW,
    requestId: "req-direct",
    canonicalReservationCutover: false,
  });
  assert.equal(direct.ok, true);
  assert.deepEqual(rpc.reserve.at(-1).physicalCourtIds, [COURT01]);
  assert.equal(rpc.resolver, 0);
});

test("F/G/H. canonical provider does not invoke legacy resolver, clubStorage, or club_data_v3", async () => {
  const adapterSource = readFileSync(
    path.join(root, "src/features/competition-core/adapters/courtResourceCompetitionAdapter.js"),
    "utf8"
  );
  assert.doesNotMatch(adapterSource, /resolveLegacyCourtIdentity|clubStorage|club_data_v3|localStorage/);
  const rpc = bindCanonical();
  const adapter = createCourtResourceCompetitionAdapter();
  await adapter.listEligibleCourts(competitionInput({ physicalCourtIds: [COURT01] }));
  await adapter.getCourtAvailability(competitionInput({ physicalCourtIds: [COURT01], ...WINDOW }));
  await adapter.reserveCourts(competitionInput({ physicalCourtIds: [COURT01], ...WINDOW }));
  await adapter.releaseCourts(competitionInput({ physicalCourtIds: [COURT01] }));
  await adapter.validateMatchAssignment(
    competitionInput({ physicalCourtId: COURT01, matchId: "M-1", ...WINDOW })
  );
  assert.equal(rpc.resolver, 0);
});

test("I. canonical physical UUID resembling no legacy value works", async () => {
  const rpc = bindCanonical();
  const result = await reserveCourts({
    tenantId: TENANT,
    clubId: CLUB,
    physicalCourtIds: [COURT01],
    owner: { type: "competition", id: "COMP-NATIVE" },
    ...WINDOW,
    requestId: "req-uuid",
  });
  assert.equal(result.ok, true);
  assert.deepEqual(result.physicalCourtIds, [COURT01]);
  assert.equal(rpc.reserve[0].physicalCourtIds[0], COURT01);
  assert.equal(rpc.resolver, 0);
});

test("J. legacy ID cannot impersonate native physicalCourtId", async () => {
  const rpc = bindCanonical();
  const result = await reserveCourts({
    tenantId: TENANT,
    clubId: CLUB,
    physicalCourtIds: ["NL_C01"],
    owner: { type: "competition", id: "COMP-NATIVE" },
    ...WINDOW,
    requestId: "req-legacy",
  });
  assert.equal(result.ok, false);
  assert.equal(result.code, COURT_RESOURCE_CODE.UNRESOLVED_MAPPING);
  assert.equal(rpc.reserve.length, 0);
  assert.equal(rpc.resolver, 0);
});

test("K. cross-tenant canonical request fails closed", async () => {
  bindCanonical();
  const result = await reserveCourts({
    tenantId: OTHER_TENANT,
    clubId: CLUB,
    physicalCourtIds: [COURT01],
    owner: { type: "competition", id: "COMP-NATIVE" },
    ...WINDOW,
    requestId: "req-xtenant",
  });
  assert.equal(result.ok, false);
  assert.equal(result.code, COURT_RESOURCE_CODE.TENANT_MISMATCH);
});

test("L. unknown physical UUID fails closed", async () => {
  bindCanonical();
  const result = await getCourtAvailability({
    tenantId: TENANT,
    clubId: CLUB,
    physicalCourtIds: [UNKNOWN],
    owner: { type: "competition", id: "COMP-NATIVE" },
    ...WINDOW,
  });
  assert.equal(result.ok, true);
  assert.equal(result.courts[0].physicalCourtId, UNKNOWN);
  assert.equal(result.courts[0].available, false);
});

test("M. Head A V1 remains unchanged", () => {
  assert.equal(COMPETITION_COURT_ADAPTER_CONTRACT_VERSION, 1);
  assert.deepEqual(
    Object.values(COMPETITION_COURT_ADAPTER_CAPABILITY).sort(),
    [
      "getCourtAvailability",
      "listEligibleCourts",
      "releaseCourts",
      "reserveCourts",
      "validateMatchAssignment",
    ]
  );
});

test("N. canonical provider missing capability fails closed", async () => {
  const adapter = createCourtResourceCompetitionAdapter();
  const gap = await adapter.invoke("assignByCourtCount", {});
  assert.equal(gap.ok, false);
  assert.equal(gap.code, COMPETITION_COURT_ERROR_CODE.SHARED_CONTRACT_CAPABILITY_GAP);

  bindCanonical({ canonicalReserve: null });
  const missing = await reserveCourts({
    tenantId: TENANT,
    clubId: CLUB,
    physicalCourtIds: [COURT01],
    owner: { type: "competition", id: "COMP-NATIVE" },
    ...WINDOW,
    requestId: "req-missing",
  });
  assert.equal(missing.ok, false);
  assert.equal(missing.code, COURT_RESOURCE_CODE.CANONICAL_PATH_UNAVAILABLE);
});

test("O. canonical provider does not introduce Competition business logic", () => {
  const adapter = readFileSync(
    path.join(root, "src/features/competition-core/adapters/courtResourceCompetitionAdapter.js"),
    "utf8"
  );
  assert.doesNotMatch(adapter, /seedBracket|drawEngine|matchmaking|standings|lineup/);
  assert.doesNotMatch(adapter, /InternalTournament|OfficialTournament|TeamTournament|DailyPlayCourtAdapter/);
});

test("P. canonical listOwnerReservations returns native physicalCourtId and is tenant/owner scoped", async () => {
  const rpc = bindCanonical();
  const listed = await listOwnerReservations({
    tenantId: TENANT,
    clubId: CLUB,
    owner: { type: "tournament", id: "COMP-NATIVE" },
    physicalCourtIds: [COURT01],
  });
  assert.equal(listed.ok, true, listed.error);
  assert.equal(listed.capacityAuthority, "canonical_reservation");
  assert.equal(listed.reservations[0].physicalCourtId, COURT01);
  assert.equal(rpc.ownerRead[0].ownerType, "competition");
  assert.equal(rpc.ownerRead[0].ownerId, "COMP-NATIVE");
  assert.deepEqual(rpc.ownerRead[0].physicalCourtIds, [COURT01]);
  assert.equal(rpc.resolver, 0);

  const cross = await listOwnerReservations({
    tenantId: OTHER_TENANT,
    clubId: CLUB,
    owner: { type: "tournament", id: "COMP-NATIVE" },
  });
  assert.equal(cross.ok, false);
  assert.equal(cross.code, COURT_RESOURCE_CODE.TENANT_MISMATCH);
});

test("native canonical path does not use blob fallback while cutover is OFF", async () => {
  let blobReads = 0;
  bindCanonical({
    loadBookingsForClub: () => {
      blobReads += 1;
      return [];
    },
  });
  await reserveCourts({
    tenantId: TENANT,
    clubId: CLUB,
    physicalCourtIds: [COURT01],
    owner: { type: "booking", id: "bk-1" },
    ...WINDOW,
    requestId: "req-no-blob",
    canonicalReservationCutover: false,
  });
  assert.equal(blobReads, 0);
});
