import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  CANONICAL_AVAILABILITY_RPC,
  CANONICAL_AVAILABILITY_STATUS,
  CANONICAL_OWNER_TYPE,
  CANONICAL_RELEASE_RPC,
  CANONICAL_RESERVATION_COMMAND_LEDGER,
  CANONICAL_RESERVATION_CUTOVER_DEFAULT,
  CANONICAL_RESERVE_RPC,
  CANONICAL_RESERVATION_TABLE,
  isCanonicalReservationCutover,
  mapGatewayOwnerTypeToCanonical,
  __resetCanonicalReservationCutoverForTests,
  __setCanonicalReservationCutoverForTests,
} from "../src/features/court-resource/constants/canonicalReservation.js";
import { CANONICAL_RESERVATION_CUTOVER } from "../src/features/court-resource/constants/canonicalIdentity.js";
import { COURT_RESOURCE_CODE } from "../src/features/court-resource/constants/courtResourceContract.js";
import {
  __resetCourtResourceGatewayDepsForTests,
  __setCourtResourceGatewayDepsForTests,
  getCourtAvailability,
  releaseCourts,
  reserveCourts,
  validateCourtAssignment,
} from "../src/features/court-resource/services/courtResourceGateway.js";
import { COMPETITION_COURT_ADAPTER_CONTRACT_VERSION } from "../src/features/competition-core/contracts/competitionCourtAdapterContract.js";
import { COURT_RUNTIME_STATUS } from "../src/features/court-engine/constants/statuses.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pkg = path.join(
  root,
  "docs/v5/migrations/court-resource-phase3b-canonical-reservation-01"
);
const COURT01 = "11111111-1111-4111-8111-111111111111";
const COURT02 = "22222222-2222-4222-8222-222222222222";

function readPkg(name) {
  return readFileSync(path.join(pkg, name), "utf8");
}

function diskSha256(name) {
  return createHash("sha256").update(readFileSync(path.join(pkg, name))).digest("hex");
}

function diskBytes(name) {
  return readFileSync(path.join(pkg, name)).length;
}

function extractFunction(sql, name) {
  const needles = [
    `CREATE OR REPLACE FUNCTION public.${name}(`,
    `CREATE FUNCTION public.${name}(`,
  ];
  let start = -1;
  for (const needle of needles) {
    start = sql.indexOf(needle);
    if (start >= 0) break;
  }
  if (start < 0) return "";
  const rest = sql.slice(start);
  const tagMatch = rest.match(/AS\s+(\$[A-Za-z0-9_]*\$)/);
  if (!tagMatch) return "";
  const tag = tagMatch[1];
  const first = rest.indexOf(tag);
  const second = rest.indexOf(tag, first + tag.length);
  let end = second + tag.length;
  if (rest[end] === ";") end += 1;
  return rest.slice(0, end).replace(/\r\n/g, "\n").trim();
}

function parseReadmeHashTable(readme) {
  const rows = {};
  for (const line of readme.split(/\r?\n/)) {
    const match = line.match(/^\|\s*`([^`]+)`\s*\|\s*`([0-9a-f]{64})`\s*\|\s*(\d+)\s*\|$/i);
    if (match) rows[match[1]] = { sha256: match[2], bytes: Number(match[3]) };
  }
  return rows;
}

function sha256(text) {
  return createHash("sha256").update(text.replace(/\r\n/g, "\n"), "utf8").digest("hex");
}

function listJs(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) return listJs(absolute);
    return entry.isFile() && entry.name.endsWith(".js") ? [absolute] : [];
  });
}

test("Phase 3B cutover defaults OFF and does not silently switch Production", () => {
  assert.equal(CANONICAL_RESERVATION_CUTOVER, false);
  assert.equal(CANONICAL_RESERVATION_CUTOVER_DEFAULT, false);
  assert.equal(isCanonicalReservationCutover(), false);
});

test("canonical owner mapping freezes booking/competition/daily_play/maintenance/operations", () => {
  assert.equal(mapGatewayOwnerTypeToCanonical("tournament"), CANONICAL_OWNER_TYPE.COMPETITION);
  assert.equal(mapGatewayOwnerTypeToCanonical("customer"), CANONICAL_OWNER_TYPE.BOOKING);
  assert.equal(mapGatewayOwnerTypeToCanonical("daily_play"), CANONICAL_OWNER_TYPE.DAILY_PLAY);
  assert.equal(mapGatewayOwnerTypeToCanonical("maintenance"), CANONICAL_OWNER_TYPE.MAINTENANCE);
  assert.equal(mapGatewayOwnerTypeToCanonical("operations"), CANONICAL_OWNER_TYPE.OPERATIONS);
  assert.equal(mapGatewayOwnerTypeToCanonical("label"), null);
});

test("SQL package authors canonical table, ledger, RPCs, GiST exclusion, and Daily Play acquire", () => {
  const apply = readPkg("02_APPLY.sql");
  const precheck = readPkg("01_PRECHECK.sql");
  const verify = readPkg("03_VERIFY.sql");
  const rollback = readPkg("04_ROLLBACK.sql");
  const readme = readPkg("README.md");

  assert.match(apply, /CREATE TABLE public\.court_resource_reservations/);
  assert.match(apply, /CREATE TABLE public\.court_resource_reservation_commands/);
  assert.match(apply, /UNIQUE \(tenant_id, request_id\)/);
  assert.match(apply, /CREATE FUNCTION public\.court_resource_reserve\(/);
  assert.match(apply, /CREATE FUNCTION public\.court_resource_release\(/);
  assert.match(apply, /CREATE FUNCTION public\.court_resource_get_availability\(/);
  assert.match(apply, /EXCLUDE USING gist/);
  assert.match(apply, /tstzrange\(starts_at, ends_at, '\[\)'\)/);
  assert.match(apply, /WHERE \(status = 'active'\)/);
  assert.match(apply, /btree_gist/);
  assert.match(apply, /enabled boolean NOT NULL DEFAULT false/);
  assert.match(apply, /court_resource_daily_play_acquire/);
  assert.match(apply, /INSERT INTO public\.daily_play_court_leases/);
  assert.match(apply, /FORCE ROW LEVEL SECURITY/);
  assert.match(apply, /SECURITY DEFINER/);
  assert.match(apply, /search_path = pg_catalog, public/);
  assert.doesNotMatch(apply, /CREATE TABLE public\.court_reservations/i);
  assert.doesNotMatch(apply, /ALTER TABLE public\.court_reservations/i);
  assert.doesNotMatch(apply, /ON DELETE CASCADE/);
  assert.doesNotMatch(apply, /qyewbxjsiiyufanzcjcq|expuvcohlcjzvrrauvud/);

  assert.match(precheck, /btree_gist/);
  assert.match(precheck, /court_resource_physical_courts/);
  assert.match(precheck, /PILOT_COURT_RESERVATIONS_DETECTED/);
  assert.match(precheck, /object collision/);
  assert.match(precheck, /READ ONLY/);
  assert.match(precheck, /PREEXISTING_ROUTINE_DRIFT/);
  assert.match(precheck, /PGCRYPTO_EXTENSION_MISSING/);
  assert.match(precheck, /PGCRYPTO_DIGEST_MISSING/);
  assert.match(precheck, /4c751a97d8e8ee8fc658d3b7647fc2d84b870b042f1f0211b23ba1632aa369e5/);
  assert.match(precheck, /d1b043a29dbee4d6e1d553ac5227052a645c115ded8f07d7cd1034ddb4a8cf59/);
  assert.match(precheck, /pg_get_functiondef/);
  assert.match(precheck, /court_assert_available/);
  assert.match(precheck, /pg_catalog\.pg_extension/);
  assert.match(precheck, /e\.extnamespace/);
  assert.match(precheck, /format\('%I\.digest\(bytea,text\)'/);
  assert.match(precheck, /%I\.digest\(\$1,\$2\)/);
  assert.doesNotMatch(precheck, /to_regprocedure\('public\.digest\(bytea,text\)'\)/);
  assert.doesNotMatch(precheck, /public\.digest/);
  assert.doesNotMatch(precheck, /SET search_path/);

  assert.match(verify, /READ ONLY/);
  assert.doesNotMatch(verify, /\bINSERT INTO\b|\bUPDATE\s+public\.|\bDELETE FROM\b/i);
  assert.match(verify, /cutover default is not OFF/);
  assert.match(verify, /Daily Play assign\/change cutover branches are not installed as expected/);
  assert.match(verify, /court_assert_available missing after Phase 3B apply/);

  assert.match(apply, /CREATE FUNCTION public\.court_resource_digest_sha256\(p_payload bytea\)/);
  assert.match(apply, /court_resource_digest_sha256/);
  assert.match(verify, /court_resource_digest_sha256/);
  assert.match(verify, /unqualified digest remains in installed package functions/);
  assert.match(verify, /digest helper is not catalog-schema-qualified/);
  assert.match(rollback, /DROP FUNCTION IF EXISTS public\.court_resource_digest_sha256\(bytea\)/);
  assert.doesNotMatch(rollback, /DROP EXTENSION/);
  assert.doesNotMatch(rollback, /ALTER EXTENSION/);
  assert.match(rollback, /DROP TABLE IF EXISTS public\.court_resource_reservations/);
  assert.match(rollback, /DROP TABLE IF EXISTS public\.court_resource_reservation_commands/);
  assert.doesNotMatch(rollback, /DROP TABLE IF EXISTS public\.court_resource_physical_courts/);
  assert.doesNotMatch(rollback, /DROP TABLE IF EXISTS public\.daily_play_court_leases/);
  assert.doesNotMatch(rollback, /DROP TABLE IF EXISTS public\.court_reservations/);
  const rollbackAssign = extractFunction(rollback, "daily_play_assign_court");
  assert.match(rollback, /CREATE OR REPLACE FUNCTION public\.daily_play_assign_court/);
  assert.doesNotMatch(rollbackAssign, /court_resource_daily_play_acquire/);
  assert.match(rollbackAssign, /court_assert_available/);

  assert.match(readme, /CANONICAL_RESERVATION_CUTOVER/);
  assert.match(readme, /SHA256/);
  assert.match(readme, /HASH_SOURCE=DIRECT_DISK_COMPUTATION/);
  assert.match(readme, /SQL_EXECUTION_HASH_MODE=EXACT_EXECUTED_BYTES/);
  assert.match(readme, /README_HASH_MODE=RAW_BYTES/);
  assert.match(readme, /not an execution-manifest mismatch/);
  const hashes = parseReadmeHashTable(readme);
  assert.equal(Object.keys(hashes).sort().join(","), "01_PRECHECK.sql,02_APPLY.sql,03_VERIFY.sql,04_ROLLBACK.sql");
  for (const name of ["01_PRECHECK.sql", "02_APPLY.sql", "03_VERIFY.sql", "04_ROLLBACK.sql"]) {
    assert.equal(hashes[name].sha256, diskSha256(name), name);
    assert.equal(hashes[name].bytes, diskBytes(name), name);
  }
  const readmeRaw = diskSha256("README.md");
  const readmeLf = sha256(readme);
  assert.equal(readmeRaw.length, 64);
  assert.notEqual(
    hashes["01_PRECHECK.sql"].sha256,
    readmeRaw,
    "README raw hash must not be treated as an SQL execution-manifest hash"
  );
  if (readmeRaw !== readmeLf) {
    assert.notEqual(
      readmeRaw,
      hashes["01_PRECHECK.sql"].sha256,
      "CRLF raw README hash must not be compared as an execution-manifest mismatch"
    );
  }
  assert.equal(CANONICAL_RESERVATION_TABLE, "court_resource_reservations");
  assert.equal(CANONICAL_RESERVATION_COMMAND_LEDGER, "court_resource_reservation_commands");
  assert.equal(CANONICAL_RESERVE_RPC, "court_resource_reserve");
  assert.equal(CANONICAL_RELEASE_RPC, "court_resource_release");
  assert.equal(CANONICAL_AVAILABILITY_RPC, "court_resource_get_availability");
  assert.ok(sha256(apply).length === 64);
});

test("Competition Court Adapter V1 is unchanged", () => {
  assert.equal(COMPETITION_COURT_ADAPTER_CONTRACT_VERSION, 1);
  const adapter = readFileSync(
    path.join(root, "src/features/competition-core/adapters/courtResourceCompetitionAdapter.js"),
    "utf8"
  );
  const contract = readFileSync(
    path.join(root, "src/features/competition-core/contracts/competitionCourtAdapterContract.js"),
    "utf8"
  );
  assert.match(contract, /TOURNAMENT_MODULES_MAY_MODIFY: false/);
  assert.match(adapter, /CourtResourceGateway/);
  assert.doesNotMatch(adapter, /court_resource_reserve/);
  assert.doesNotMatch(adapter, /court_resource_reservations/);
});

test("Court Engine assigned/playing does not create canonical reservations", () => {
  assert.deepEqual(
    [
      COURT_RUNTIME_STATUS.EMPTY,
      COURT_RUNTIME_STATUS.ASSIGNED,
      COURT_RUNTIME_STATUS.PLAYING,
      COURT_RUNTIME_STATUS.PAUSED,
      COURT_RUNTIME_STATUS.OVERRUN,
      COURT_RUNTIME_STATUS.COMPLETED,
      COURT_RUNTIME_STATUS.MAINTENANCE,
      COURT_RUNTIME_STATUS.LOCKED,
    ],
    ["empty", "assigned", "playing", "paused", "overrun", "completed", "maintenance", "locked"]
  );
  const engineRoot = path.join(root, "src/features/court-engine");
  for (const file of listJs(engineRoot)) {
    const source = readFileSync(file, "utf8");
    assert.doesNotMatch(source, /court_resource_reserve|court_resource_reservations/);
    assert.doesNotMatch(source, /from ["'][^"']*court-resource[^"']*["']/);
  }
});

test("gateway cutover OFF keeps legacy blob authority and does not call canonical RPC", async () => {
  __resetCanonicalReservationCutoverForTests();
  let called = false;
  __setCourtResourceGatewayDepsForTests({
    canonicalReserve: () => {
      called = true;
      return { ok: true, reservations: [] };
    },
    isCanonicalReservationCutover: () => false,
  });
  const result = await reserveCourts({
    clubId: "club-a",
    tenantId: "tenant-a",
    courtIds: ["c1"],
    owner: { type: "booking", id: "b1" },
    date: "2026-08-15",
    startTime: "10:00",
    endTime: "11:00",
    requestId: "req-1",
    canonicalReservationCutover: false,
  });
  assert.equal(called, false);
  assert.notEqual(result.code, COURT_RESOURCE_CODE.CANONICAL_PATH_UNAVAILABLE);
  __resetCourtResourceGatewayDepsForTests();
});

test("gateway cutover ON fail-closes when canonical adapter is missing", async () => {
  __setCanonicalReservationCutoverForTests(true);
  __setCourtResourceGatewayDepsForTests({
    isCanonicalReservationCutover: () => true,
    canonicalReserve: null,
  });
  const result = await reserveCourts({
    clubId: "club-a",
    tenantId: "tenant-a",
    physicalCourtIds: [COURT01],
    owner: { type: "booking", id: "b1" },
    date: "2026-08-15",
    startTime: "10:00",
    endTime: "11:00",
    requestId: "req-1",
    canonicalReservationCutover: true,
  });
  assert.equal(result.ok, false);
  assert.equal(result.code, COURT_RESOURCE_CODE.CANONICAL_PATH_UNAVAILABLE);
  __resetCourtResourceGatewayDepsForTests();
  __resetCanonicalReservationCutoverForTests();
});

test("acceptance H/I/J-shaped gateway rejects cluster-only, courtCount-only, and non-UUID identity", async () => {
  __setCourtResourceGatewayDepsForTests({
    isCanonicalReservationCutover: () => true,
    canonicalReserve: () => ({ ok: true, reservationIds: ["r1"], reservations: [] }),
  });
  const clusterOnly = await reserveCourts({
    clubId: "club-a",
    tenantId: "tenant-a",
    clusterId: "NAM_LONG",
    courtIds: ["NAM_LONG"],
    owner: { type: "competition", id: "t1" },
    date: "2026-08-15",
    startTime: "10:00",
    endTime: "11:00",
    requestId: "req-h",
    canonicalReservationCutover: true,
  });
  assert.equal(clusterOnly.ok, false);
  assert.equal(clusterOnly.code, COURT_RESOURCE_CODE.WHOLE_CLUSTER_DENIED);

  const countOnly = await reserveCourts({
    clubId: "club-a",
    tenantId: "tenant-a",
    courtCount: 4,
    owner: { type: "competition", id: "t1" },
    date: "2026-08-15",
    startTime: "10:00",
    endTime: "11:00",
    requestId: "req-h2",
    canonicalReservationCutover: true,
  });
  assert.equal(countOnly.ok, false);
  assert.equal(countOnly.code, COURT_RESOURCE_CODE.COURT_COUNT_DENIED);

  const label = await reserveCourts({
    clubId: "club-a",
    tenantId: "tenant-a",
    physicalCourtIds: ["Sân 01"],
    owner: { type: "booking", id: "b1" },
    date: "2026-08-15",
    startTime: "10:00",
    endTime: "11:00",
    requestId: "req-label",
    canonicalReservationCutover: true,
  });
  assert.equal(label.ok, false);
  assert.equal(label.code, COURT_RESOURCE_CODE.UNRESOLVED_MAPPING);
  __resetCourtResourceGatewayDepsForTests();
});

test("acceptance A/D/E/G-shaped gateway uses canonical availability/reserve adapters", async () => {
  const store = [];
  __setCourtResourceGatewayDepsForTests({
    isCanonicalReservationCutover: () => true,
    canonicalReserve: (payload) => {
      const conflict = store.some(
        (row) =>
          row.physicalCourtIds.some((id) => payload.physicalCourtIds.includes(id))
          && row.startsAt < payload.endsAt
          && payload.startsAt < row.endsAt
      );
      if (conflict) {
        return { ok: false, code: COURT_RESOURCE_CODE.FOREIGN_RESERVATION_CONFLICT };
      }
      store.push(payload);
      return {
        ok: true,
        reservationIds: payload.physicalCourtIds.map((id) => `res-${id}`),
        reservations: payload.physicalCourtIds.map((id) => ({
          reservationId: `res-${id}`,
          physicalCourtId: id,
          status: "active",
        })),
      };
    },
    canonicalGetAvailability: (payload) => ({
      ok: true,
      courts: payload.physicalCourtIds.map((id) => {
        const hit = store.find((row) => row.physicalCourtIds.includes(id));
        if (!hit) {
          return { physicalCourtId: id, status: CANONICAL_AVAILABILITY_STATUS.AVAILABLE };
        }
        const own =
          hit.ownerType === payload.ownerType && hit.ownerId === payload.ownerId;
        return {
          physicalCourtId: id,
          status: own
            ? CANONICAL_AVAILABILITY_STATUS.OWN_RESERVATION
            : CANONICAL_AVAILABILITY_STATUS.FOREIGN_RESERVATION,
        };
      }),
    }),
    canonicalRelease: () => ({ ok: true, releasedReservationIds: [] }),
  });

  const booking = await reserveCourts({
    clubId: "club-a",
    tenantId: "tenant-a",
    physicalCourtIds: [COURT01],
    owner: { type: "booking", id: "bk-1" },
    date: "2026-08-15",
    startTime: "10:00",
    endTime: "11:00",
    requestId: "req-a",
    canonicalReservationCutover: true,
  });
  assert.equal(booking.ok, true);
  assert.equal(booking.capacityAuthority, "canonical_reservation");

  const competition = await reserveCourts({
    clubId: "club-a",
    tenantId: "tenant-a",
    physicalCourtIds: [COURT01],
    owner: { type: "tournament", id: "t-foreign" },
    date: "2026-08-15",
    startTime: "10:30",
    endTime: "11:30",
    requestId: "req-a-foreign",
    canonicalReservationCutover: true,
  });
  assert.equal(competition.ok, false);
  assert.equal(competition.code, COURT_RESOURCE_CODE.FOREIGN_RESERVATION_CONFLICT);

  const otherCourt = await reserveCourts({
    clubId: "club-a",
    tenantId: "tenant-a",
    physicalCourtIds: [COURT02],
    owner: { type: "booking", id: "bk-2" },
    date: "2026-08-15",
    startTime: "10:00",
    endTime: "11:00",
    requestId: "req-g",
    canonicalReservationCutover: true,
  });
  assert.equal(otherCourt.ok, true);

  const own = await getCourtAvailability({
    clubId: "club-a",
    tenantId: "tenant-a",
    physicalCourtIds: [COURT01],
    owner: { type: "booking", id: "bk-1" },
    date: "2026-08-15",
    startTime: "10:00",
    endTime: "11:00",
    canonicalReservationCutover: true,
  });
  assert.equal(own.courts[0].status, CANONICAL_AVAILABILITY_STATUS.OWN_RESERVATION);

  const foreign = await getCourtAvailability({
    clubId: "club-a",
    tenantId: "tenant-a",
    physicalCourtIds: [COURT01],
    owner: { type: "tournament", id: "t-other" },
    date: "2026-08-15",
    startTime: "10:00",
    endTime: "11:00",
    canonicalReservationCutover: true,
  });
  assert.equal(foreign.courts[0].status, CANONICAL_AVAILABILITY_STATUS.FOREIGN_RESERVATION);

  const assignment = await validateCourtAssignment({
    clubId: "club-a",
    tenantId: "tenant-a",
    physicalCourtIds: [COURT01],
    owner: { type: "booking", id: "bk-1" },
    date: "2026-08-15",
    startTime: "10:00",
    endTime: "11:00",
    canonicalReservationCutover: true,
  });
  assert.equal(assignment.ok, true);
  assert.equal(assignment.valid, true);

  const released = await releaseCourts({
    clubId: "club-a",
    tenantId: "tenant-a",
    owner: { type: "booking", id: "bk-1" },
    requestId: "rel-1",
    canonicalReservationCutover: true,
  });
  assert.equal(released.ok, true);
  __resetCourtResourceGatewayDepsForTests();
});

test("Daily Play SQL cutover-ON acquire happens before lease insert in the same ON block", () => {
  const apply = readPkg("02_APPLY.sql");
  const assign = extractFunction(apply, "daily_play_assign_court");
  const onBlock = assign.slice(
    assign.indexOf("IF v_cutover THEN"),
    assign.indexOf("CUTOVER OFF")
  );
  const acquireAt = onBlock.indexOf("court_resource_daily_play_acquire");
  const leaseAt = onBlock.indexOf("INSERT INTO public.daily_play_court_leases");
  assert.ok(acquireAt > 0 && leaseAt > acquireAt);
  assert.match(onBlock, /EXCEPTION WHEN unique_violation/);
  assert.doesNotMatch(onBlock, /public\.court_assert_available/);
});

const PREEXISTING_ROUTINES = [
  "daily_play_assign_court",
  "daily_play_submit_score",
  "daily_play_cancel_match",
  "daily_play_change_court",
  "daily_play_close_session",
];

test("APPLY/ROLLBACK roundtrip restores reviewed pre-APPLY Daily Play baseline", () => {
  const rollback = readPkg("04_ROLLBACK.sql");
  const apply = readPkg("02_APPLY.sql");
  const baselineDir = path.join(pkg, "preapply-baseline");
  for (const name of PREEXISTING_ROUTINES) {
    const baseline = readFileSync(path.join(baselineDir, `${name}.sql`), "utf8")
      .replace(/\r\n/g, "\n")
      .trim();
    const restored = extractFunction(rollback, name);
    assert.equal(restored, baseline, name);
    assert.match(restored, /LANGUAGE plpgsql SECURITY DEFINER SET search_path = public/);
    assert.match(restored, /RETURNS jsonb/);
  }
  const assignBaseline = extractFunction(rollback, "daily_play_assign_court");
  const changeBaseline = extractFunction(rollback, "daily_play_change_court");
  assert.match(assignBaseline, /court_assert_available/);
  assert.match(changeBaseline, /court_assert_available/);
  assert.doesNotMatch(assignBaseline, /court_resource_daily_play_acquire/);
  assert.doesNotMatch(changeBaseline, /court_resource_daily_play_acquire/);
  assert.doesNotMatch(assignBaseline, /SECURITY INVOKER/);
  const applyAssign = extractFunction(apply, "daily_play_assign_court");
  assert.notEqual(applyAssign, assignBaseline);
});

test("cutover-OFF Daily Play assign/change preserve court_assert_available and do not bypass via CUTOVER_OFF", () => {
  const apply = readPkg("02_APPLY.sql");
  const assign = extractFunction(apply, "daily_play_assign_court");
  const change = extractFunction(apply, "daily_play_change_court");
  const assignOff = assign.slice(assign.indexOf("CUTOVER OFF"));
  const changeOff = change.slice(change.indexOf("CUTOVER OFF"));
  const assignOn = assign.slice(assign.indexOf("IF v_cutover THEN"), assign.indexOf("CUTOVER OFF"));
  const changeOn = change.slice(change.indexOf("IF v_cutover THEN"), change.indexOf("CUTOVER OFF"));

  assert.match(assignOff, /public\.court_assert_available/);
  assert.match(changeOff, /public\.court_assert_available/);
  assert.doesNotMatch(assignOff, /court_resource_daily_play_acquire/);
  assert.doesNotMatch(changeOff, /court_resource_daily_play_acquire/);
  assert.match(assignOff, /COURT_ALREADY_LEASED/);
  assert.match(changeOff, /COURT_ALREADY_LEASED/);
  assert.match(assign, /canonical_reservation_cutover_enabled/);

  assert.match(assignOn, /court_resource_daily_play_acquire/);
  assert.match(changeOn, /court_resource_daily_play_acquire/);
  assert.doesNotMatch(assignOn, /public\.court_assert_available/);
  assert.doesNotMatch(changeOn, /public\.court_assert_available/);
  assert.match(assignOn, /CANONICAL_PATH_UNAVAILABLE/);
  assert.match(changeOn, /CANONICAL_PATH_UNAVAILABLE/);
  assert.match(assignOn, /CUTOVER_OFF/);
  assert.doesNotMatch(assignOn, /RETURN jsonb_build_object\('ok', true, 'code', 'CUTOVER_OFF'\)/);
  assert.match(changeOn, /court_resource_daily_play_release_court/);
  const acquireAt = changeOn.indexOf("court_resource_daily_play_acquire");
  const releaseAt = changeOn.indexOf("court_resource_daily_play_release_court");
  assert.ok(acquireAt > 0 && releaseAt > acquireAt);
});

test("cutover-ON Daily Play is canonical authority only with atomic acquire-then-lease", () => {
  const apply = readPkg("02_APPLY.sql");
  const assign = extractFunction(apply, "daily_play_assign_court");
  const change = extractFunction(apply, "daily_play_change_court");
  const acquire = apply.slice(
    apply.indexOf("CREATE FUNCTION public.court_resource_daily_play_acquire"),
    apply.indexOf("CREATE FUNCTION public.court_resource_daily_play_release_match")
  );
  assert.match(acquire, /court_resource_reserve_core/);
  assert.match(acquire, /daily_play/);
  assert.match(acquire, /court_resource_resolve_physical_court_for_legacy/);
  assert.match(apply, /FOREIGN_RESERVATION_CONFLICT/);
  assert.match(assign, /EXCEPTION WHEN unique_violation/);
  assert.match(change, /acquire target first/);
  assert.ok(assign.includes("court_assert_available"));
  assert.ok(assign.includes("court_resource_daily_play_acquire"));
});

test("acceptance L1/L2/L3 SQL structure: foreign canonical blocks Daily Play and exactly one owner", () => {
  const apply = readPkg("02_APPLY.sql");
  assert.match(apply, /EXCLUDE USING gist/);
  assert.match(apply, /owner_type = 'daily_play'/);
  assert.match(apply, /FOREIGN_RESERVATION_CONFLICT/);
  const acquire = apply.slice(
    apply.indexOf("CREATE FUNCTION public.court_resource_daily_play_acquire"),
    apply.indexOf("CREATE FUNCTION public.court_resource_daily_play_release_match")
  );
  assert.match(acquire, /court_resource_reserve_core/);
  assert.match(acquire, /ARRAY\[v_physical\]/);
  const reserveCore = apply.slice(
    apply.indexOf("CREATE FUNCTION public.court_resource_reserve_core"),
    apply.indexOf("CREATE FUNCTION public.court_resource_reserve(")
  );
  assert.match(reserveCore, /exclusion_violation/);
  assert.match(reserveCore, /FOREIGN_RESERVATION_CONFLICT/);
  assert.match(reserveCore, /pg_advisory_xact_lock/);
});

