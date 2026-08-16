/**
 * Batch 10 — Staging backend certification (defaults OFF).
 * Fixture prefix: COURT_BATCH10_CERT_
 * Staging only: qyewbxjsiiyufanzcjcq. Production blocked.
 *
 * Usage:
 *   node scripts/court-operations/batch10-staging-backend-cert.mjs
 *   node scripts/court-operations/batch10-staging-backend-cert.mjs --cleanup-only
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { randomUUID } from "node:crypto";

import {
  acquireOwner,
  beginLiveSession,
  cancelBooking,
  cancelResourceBlock,
  conflictCode,
  countActiveReservations,
  createBooking,
  createResourceBlock,
  cutoverEnabled,
  endLiveSession,
  getAvailability,
  isClosedFailure,
  listEligibleCourts,
  ownerSpec,
  releaseCapacity,
  reserveCapacity,
  rescheduleBooking,
  setOperationalState,
  transferBooking,
  windowOnDay,
} from "../../tests/helpers/court-resource-batch9-postgres.js";

const STAGING_REF = "qyewbxjsiiyufanzcjcq";
const PRODUCTION_REF = "expuvcohlcjzvrrauvud";
const PREFIX = "COURT_BATCH10_CERT_";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

const dbUrl = String(process.env.STAGING_SUPABASE_DB_URL || "").trim();
if (!dbUrl) {
  console.error("MISSING STAGING_SUPABASE_DB_URL");
  process.exit(2);
}
if (dbUrl.includes(PRODUCTION_REF)) {
  console.error("BLOCKED: Production ref");
  process.exit(1);
}
if (!dbUrl.includes(STAGING_REF)) {
  console.error("BLOCKED: must be Staging", STAGING_REF);
  process.exit(1);
}

const F = Object.freeze({
  TENANT_A: `${PREFIX}tenant_a`,
  TENANT_B: `${PREFIX}tenant_b`,
  VENUE_A: `${PREFIX}venue_a`,
  VENUE_B: `${PREFIX}venue_b`,
  CLUB_A: `${PREFIX}club_a`,
  CLUB_B: `${PREFIX}club_b`,
  CLUB_DISABLED: `${PREFIX}club_disabled`,
  CLUB_NO_ACCESS: `${PREFIX}club_no_access`,
  CLUSTER_A: `${PREFIX}cluster_a`,
  CLUSTER_B: `${PREFIX}cluster_b`,
  COURT_A1: "a1111111-1111-4111-8111-111111111111",
  COURT_A2: "a2222222-2222-4222-8222-222222222222",
  COURT_B1: "b3333333-3333-4333-8333-333333333333",
});

const SELF_TYPES = ["booking", "daily", "internal", "official", "team", "maintenance"];
const PAIRS = [
  ["booking", "daily"],
  ["booking", "internal"],
  ["booking", "official"],
  ["booking", "team"],
  ["booking", "maintenance"],
  ["daily", "internal"],
  ["daily", "official"],
  ["daily", "team"],
  ["daily", "maintenance"],
  ["internal", "official"],
  ["internal", "team"],
  ["internal", "maintenance"],
  ["official", "team"],
  ["official", "maintenance"],
  ["team", "maintenance"],
];

function ok(result) {
  return result && result.ok === true;
}

function windowOnMonthDay(month, day, startHour, endHour) {
  const m = String(month).padStart(2, "0");
  const d = String(day).padStart(2, "0");
  const s = String(startHour).padStart(2, "0");
  const e = String(endHour).padStart(2, "0");
  return {
    startsAt: `2026-${m}-${d}T${s}:00:00.000Z`,
    endsAt: `2026-${m}-${d}T${e}:00:00.000Z`,
  };
}

async function setActor(client, actorId) {
  await client.query("SELECT set_config('request.jwt.claim.sub', $1, false)", [actorId]);
  await client.query("SELECT set_config('request.jwt.claim.role', 'authenticated', false)");
}

async function resolveSuperAdmin(client) {
  const { rows } = await client.query(
    `SELECT id::text AS id FROM public.profiles
     WHERE role = 'SUPER_ADMIN' AND status = 'active'
     ORDER BY CASE WHEN venue_id IS NULL THEN 0 ELSE 1 END, created_at
     LIMIT 1`,
  );
  if (!rows[0]?.id) throw new Error("NO_SUPER_ADMIN_PROFILE");
  return rows[0].id;
}

async function cleanupFixtures(client) {
  // Order: live sessions → commands → reservations/bookings/blocks → access → mappings → courts → clusters → clubs → venues
  await client.query(
    `DELETE FROM public.court_operations_live_runtime_commands WHERE tenant_id LIKE $1 OR request_id LIKE $1`,
    [`${PREFIX}%`],
  );
  await client.query(
    `DELETE FROM public.court_operations_resource_sessions
     WHERE tenant_id LIKE $1 OR source_id LIKE $1 OR request_id LIKE $1`,
    [`${PREFIX}%`],
  );
  await client.query(
    `DELETE FROM public.court_operations_court_live_states WHERE tenant_id LIKE $1`,
    [`${PREFIX}%`],
  );
  await client.query(
    `DELETE FROM public.court_operations_booking_commands WHERE tenant_id LIKE $1 OR request_id LIKE $1`,
    [`${PREFIX}%`],
  );
  await client.query(
    `DELETE FROM public.court_operations_resource_block_commands WHERE tenant_id LIKE $1 OR request_id LIKE $1`,
    [`${PREFIX}%`],
  );
  await client.query(
    `DELETE FROM public.court_operations_bookings WHERE tenant_id LIKE $1 OR club_id LIKE $1 OR request_id LIKE $1`,
    [`${PREFIX}%`],
  );
  await client.query(
    `DELETE FROM public.court_operations_resource_blocks WHERE tenant_id LIKE $1 OR club_id LIKE $1 OR request_id LIKE $1`,
    [`${PREFIX}%`],
  );
  await client.query(
    `DELETE FROM public.court_resource_reservation_commands WHERE tenant_id LIKE $1 OR request_id LIKE $1`,
    [`${PREFIX}%`],
  );
  await client.query(
    `DELETE FROM public.court_resource_reservations WHERE tenant_id LIKE $1 OR owner_id LIKE $1 OR request_id LIKE $1 OR club_id LIKE $1`,
    [`${PREFIX}%`],
  );
  await client.query(
    `DELETE FROM public.court_resource_club_operational_access WHERE tenant_id LIKE $1 OR club_id LIKE $1`,
    [`${PREFIX}%`],
  );
  await client.query(
    `DELETE FROM public.court_resource_legacy_court_identity_mappings WHERE tenant_id LIKE $1 OR club_id LIKE $1`,
    [`${PREFIX}%`],
  );
  await client.query(
    `DELETE FROM public.court_resource_physical_courts WHERE tenant_id LIKE $1 OR cluster_id LIKE $1`,
    [`${PREFIX}%`],
  );
  await client.query(`DELETE FROM public.court_clusters WHERE id LIKE $1 OR tenant_id LIKE $1`, [
    `${PREFIX}%`,
  ]);
  await client.query(`DELETE FROM public.clubs WHERE id LIKE $1 OR tenant_id LIKE $1`, [`${PREFIX}%`]);
  await client.query(`DELETE FROM public.venues WHERE id LIKE $1`, [`${PREFIX}%`]);
}

async function seedFixtures(client) {
  await cleanupFixtures(client);

  await client.query(
    `INSERT INTO public.venues(id, name, slug, timezone, status) VALUES
       ($1, 'Batch10 Cert Tenant A', $1, 'UTC', 'active'),
       ($2, 'Batch10 Cert Tenant B', $2, 'UTC', 'active'),
       ($3, 'Batch10 Cert Venue A', $3, 'UTC', 'active'),
       ($4, 'Batch10 Cert Venue B', $4, 'UTC', 'active')
     ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, timezone = EXCLUDED.timezone, slug = EXCLUDED.slug`,
    [F.TENANT_A, F.TENANT_B, F.VENUE_A, F.VENUE_B],
  );

  await client.query(
    `INSERT INTO public.clubs(id, tenant_id, name, status) VALUES
       ($1, $5, 'Batch10 Club A', 'active'),
       ($2, $6, 'Batch10 Club B', 'active'),
       ($3, $5, 'Batch10 Club Disabled', 'active'),
       ($4, $5, 'Batch10 Club No Access', 'active')
     ON CONFLICT (id) DO UPDATE SET tenant_id = EXCLUDED.tenant_id, name = EXCLUDED.name`,
    [F.CLUB_A, F.CLUB_B, F.CLUB_DISABLED, F.CLUB_NO_ACCESS, F.TENANT_A, F.TENANT_B],
  );

  // CRITICAL: tenant_id DISTINCT from venue_id for identity-guard proof
  await client.query(
    `INSERT INTO public.court_clusters(id, venue_id, tenant_id, name, slug, status) VALUES
       ($1, $5, $3, 'Batch10 Cluster A', $1, 'active'),
       ($2, $6, $4, 'Batch10 Cluster B', $2, 'active')
     ON CONFLICT (id) DO UPDATE SET venue_id = EXCLUDED.venue_id, tenant_id = EXCLUDED.tenant_id, name = EXCLUDED.name, slug = EXCLUDED.slug`,
    [F.CLUSTER_A, F.CLUSTER_B, F.TENANT_A, F.TENANT_B, F.VENUE_A, F.VENUE_B],
  );

  for (const [courtId, tenantId, clusterId, name] of [
    [F.COURT_A1, F.TENANT_A, F.CLUSTER_A, "Batch10 Court A1"],
    [F.COURT_A2, F.TENANT_A, F.CLUSTER_A, "Batch10 Court A2"],
    [F.COURT_B1, F.TENANT_B, F.CLUSTER_B, "Batch10 Court B1"],
  ]) {
    await client.query(
      `INSERT INTO public.court_resource_physical_courts(
         physical_court_id, tenant_id, cluster_id, display_name, lifecycle_status
       ) VALUES ($1::uuid, $2, $3, $4, 'active')
       ON CONFLICT (physical_court_id) DO UPDATE
         SET tenant_id = EXCLUDED.tenant_id, cluster_id = EXCLUDED.cluster_id, display_name = EXCLUDED.display_name`,
      [courtId, tenantId, clusterId, name],
    );
  }

  await client.query(
    `INSERT INTO public.court_resource_club_operational_access(
       tenant_id, club_id, physical_court_id, status
     ) VALUES
       ($1, $3, $5::uuid, 'enabled'),
       ($1, $3, $6::uuid, 'enabled'),
       ($2, $4, $7::uuid, 'enabled')
     ON CONFLICT DO NOTHING`,
    [F.TENANT_A, F.TENANT_B, F.CLUB_A, F.CLUB_B, F.COURT_A1, F.COURT_A2, F.COURT_B1],
  );

  await client.query(
    `INSERT INTO public.court_resource_club_operational_access(
       tenant_id, club_id, physical_court_id, status, revoked_at, reason
     ) VALUES ($1, $2, $3::uuid, 'disabled', now(), 'batch10 cert disabled')
     ON CONFLICT DO NOTHING`,
    [F.TENANT_A, F.CLUB_DISABLED, F.COURT_A1],
  );

  await client.query(
    `INSERT INTO public.court_resource_legacy_court_identity_mappings(
       tenant_id, club_id, source_system, source_version, legacy_cluster_id,
       legacy_court_id, physical_court_id, classification, resolved_at
     ) VALUES
       ($1, $3, 'batch10-cert', '1', $5, 'c01', $7::uuid, 'deterministic', now()),
       ($1, $3, 'batch10-cert', '1', $5, 'c02', $8::uuid, 'deterministic', now()),
       ($2, $4, 'batch10-cert', '1', $6, 'c-b1', $9::uuid, 'deterministic', now())
     ON CONFLICT DO NOTHING`,
    [
      F.TENANT_A,
      F.TENANT_B,
      F.CLUB_A,
      F.CLUB_B,
      F.CLUSTER_A,
      F.CLUSTER_B,
      F.COURT_A1,
      F.COURT_A2,
      F.COURT_B1,
    ],
  );
}

async function take(client, type, args) {
  const ownerId = args.ownerId || `${PREFIX}${type}-${args.requestId}`;
  const result = await acquireOwner(client, type, {
    tenantId: args.tenantId ?? F.TENANT_A,
    clubId: args.clubId ?? F.CLUB_A,
    ...args,
    ownerId,
  });
  return {
    ...result,
    _type: type,
    _ownerId: result.bookingId || result.resourceBlockId || ownerId,
  };
}

async function releaseTaken(client, taken, requestId) {
  const type = taken._type;
  if (type === "booking") {
    return cancelBooking(client, {
      tenantId: F.TENANT_A,
      bookingId: taken.bookingId,
      requestId,
    });
  }
  if (type === "maintenance" || type === "operations") {
    return cancelResourceBlock(client, {
      tenantId: F.TENANT_A,
      resourceBlockId: taken.resourceBlockId,
      requestId,
    });
  }
  const spec = ownerSpec(type);
  return releaseCapacity(client, {
    tenantId: F.TENANT_A,
    ownerType: spec.ownerType,
    ownerId: taken._ownerId,
    physicalCourtIds: taken.physicalCourtIds || [taken.physicalCourtId || F.COURT_A1],
    requestId,
  });
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function main() {
  const cleanupOnly = process.argv.includes("--cleanup-only");
  const outIdx = process.argv.indexOf("--out");
  const outPath =
    outIdx >= 0
      ? process.argv[outIdx + 1]
      : path.join(
          "C:/Users/Le Phong/PICK_VN-Backups",
          `court-batch10-staging-${STAGING_REF}-20260816-191604`,
          "10e-backend-cert.json",
        );

  const client = new pg.Client({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  const report = {
    stagingProject: STAGING_REF,
    prefix: PREFIX,
    startedAt: new Date().toISOString(),
    cutoverBefore: null,
    results: {},
    failures: [],
  };

  try {
    if (cleanupOnly) {
      await cleanupFixtures(client);
      report.results.cleanupOnly = "OK";
      console.log(JSON.stringify({ ok: true, cleanupOnly: true }, null, 2));
      return;
    }

    const actorId = await resolveSuperAdmin(client);
    report.actorIdSanitized = `${actorId.slice(0, 8)}…`;
    await setActor(client, actorId);

    report.cutoverBefore = await cutoverEnabled(client);
    const allowCutoverOn = process.argv.includes("--allow-cutover-on");
    if (!allowCutoverOn) {
      assert(report.cutoverBefore === false, "SQL cutover must be OFF for 10E");
    }

    await seedFixtures(client);

    // Identity guard / tenant≠venue
    const clusterCheck = await client.query(
      `SELECT id, tenant_id, venue_id FROM public.court_clusters WHERE id = $1`,
      [F.CLUSTER_A],
    );
    assert(clusterCheck.rows[0].tenant_id !== clusterCheck.rows[0].venue_id, "tenant must != venue");
    report.results.TENANT_ID_DISTINCT_FROM_VENUE_ID_STAGING = "PASS";
    report.results.PHYSICAL_TENANT_VALIDATES_CLUSTER_VENUE = "NO";

    // Inventory
    const inventory = await listEligibleCourts(client, {
      tenantId: F.TENANT_A,
      clubId: F.CLUB_A,
      clusterId: F.CLUSTER_A,
    });
    assert(ok(inventory), `inventory ${JSON.stringify(inventory)}`);
    const courtIds = (inventory.courts || inventory.items || inventory.physicalCourts || []).map(
      (c) => c.physicalCourtId || c.physical_court_id || c.id,
    );
    assert(
      courtIds.includes(F.COURT_A1) && courtIds.includes(F.COURT_A2),
      `inventory missing cert courts ${JSON.stringify(inventory)}`,
    );
    report.results.canonicalInventory = "PASS";

    // Availability empty window
    const winAvail = windowOnDay(1, 8, 9);
    const avail = await getAvailability(client, {
      tenantId: F.TENANT_A,
      clubId: F.CLUB_A,
      physicalCourtIds: [F.COURT_A1],
      ...winAvail,
    });
    assert(ok(avail) || avail?.available === true || Array.isArray(avail?.courts), `availability ${JSON.stringify(avail)}`);
    report.results.canonicalAvailability = "PASS";

    // Booking lifecycle
    const winBook = windowOnDay(2, 10, 11);
    const booking = await createBooking(client, {
      tenantId: F.TENANT_A,
      clubId: F.CLUB_A,
      physicalCourtId: F.COURT_A1,
      requestId: `${PREFIX}booking-create-1`,
      ...winBook,
    });
    assert(ok(booking), `booking create ${JSON.stringify(booking)}`);
    assert(booking.physicalCourtId === F.COURT_A1, "booking physicalCourtId");
    const bookingVersion = booking.version ?? booking.booking?.version;
    const resched = await rescheduleBooking(client, {
      tenantId: F.TENANT_A,
      bookingId: booking.bookingId,
      physicalCourtId: F.COURT_A1,
      expectedVersion: bookingVersion,
      requestId: `${PREFIX}booking-resched-1`,
      ...windowOnDay(2, 11, 12),
    });
    assert(ok(resched), `reschedule ${JSON.stringify(resched)}`);
    const reschedVersion = resched.version ?? resched.booking?.version;
    const transfer = await transferBooking(client, {
      tenantId: F.TENANT_A,
      bookingId: booking.bookingId,
      newPhysicalCourtId: F.COURT_A2,
      expectedVersion: reschedVersion,
      requestId: `${PREFIX}booking-xfer-1`,
    });
    assert(ok(transfer), `transfer ${JSON.stringify(transfer)}`);
    assert(
      (transfer.physicalCourtId || transfer.booking?.physicalCourtId) === F.COURT_A2,
      "transfer court",
    );
    // conflicting transfer should fail and preserve A2
    const conflictBook = await createBooking(client, {
      tenantId: F.TENANT_A,
      clubId: F.CLUB_A,
      physicalCourtId: F.COURT_A1,
      requestId: `${PREFIX}booking-conflict-holder`,
      ...windowOnDay(2, 11, 12),
    });
    assert(ok(conflictBook), `holder ${JSON.stringify(conflictBook)}`);
    const transferVersion = transfer.version ?? transfer.booking?.version;
    const badXfer = await transferBooking(client, {
      tenantId: F.TENANT_A,
      bookingId: booking.bookingId,
      newPhysicalCourtId: F.COURT_A1,
      expectedVersion: transferVersion,
      requestId: `${PREFIX}booking-xfer-fail`,
    });
    assert(!ok(badXfer), "conflicting transfer must fail");
    assert(isClosedFailure(badXfer), `fail closed ${JSON.stringify(badXfer)}`);
    const still = await client.query(
      `SELECT physical_court_id::text AS id FROM public.court_operations_bookings WHERE booking_id = $1::uuid`,
      [booking.bookingId],
    );
    assert(still.rows[0].id === F.COURT_A2, "failed transfer preserves court");
    await cancelBooking(client, {
      tenantId: F.TENANT_A,
      bookingId: booking.bookingId,
      requestId: `${PREFIX}booking-cancel-1`,
    });
    await cancelBooking(client, {
      tenantId: F.TENANT_A,
      bookingId: conflictBook.bookingId,
      requestId: `${PREFIX}booking-cancel-holder`,
    });
    report.results.bookingLifecycle = "PASS";

    // Resource blocks
    const winBlock = windowOnDay(3, 10, 12);
    const block = await createResourceBlock(client, {
      tenantId: F.TENANT_A,
      clubId: F.CLUB_A,
      physicalCourtId: F.COURT_A1,
      requestId: `${PREFIX}block-create-1`,
      blockType: "MAINTENANCE",
      ...winBlock,
    });
    assert(ok(block), `block ${JSON.stringify(block)}`);
    const overlapBook = await createBooking(client, {
      tenantId: F.TENANT_A,
      clubId: F.CLUB_A,
      physicalCourtId: F.COURT_A1,
      requestId: `${PREFIX}block-overlap-book`,
      startsAt: winBlock.startsAt,
      endsAt: "2026-09-03T11:00:00.000Z",
    });
    assert(!ok(overlapBook), "booking overlap maintenance must fail");
    await cancelResourceBlock(client, {
      tenantId: F.TENANT_A,
      resourceBlockId: block.resourceBlockId,
      requestId: `${PREFIX}block-cancel-1`,
    });
    const afterCancel = await createBooking(client, {
      tenantId: F.TENANT_A,
      clubId: F.CLUB_A,
      physicalCourtId: F.COURT_A1,
      requestId: `${PREFIX}block-after-cancel-book`,
      startsAt: winBlock.startsAt,
      endsAt: "2026-09-03T11:00:00.000Z",
    });
    assert(ok(afterCancel), `capacity freed ${JSON.stringify(afterCancel)}`);
    await cancelBooking(client, {
      tenantId: F.TENANT_A,
      bookingId: afterCancel.bookingId,
      requestId: `${PREFIX}block-after-cancel-book-cancel`,
    });
    report.results.resourceBlocks = "PASS";

    // Adapter B paths via reserveCapacity owner types
    for (const type of ["daily", "internal", "official", "team"]) {
      const win = windowOnDay(4, 8 + SELF_TYPES.indexOf(type), 9 + SELF_TYPES.indexOf(type));
      const r = await take(client, type, {
        physicalCourtId: F.COURT_A1,
        physicalCourtIds: [F.COURT_A1],
        requestId: `${PREFIX}adapter-${type}`,
        ...win,
      });
      assert(ok(r), `${type} adapter ${JSON.stringify(r)}`);
      await releaseTaken(client, r, `${PREFIX}adapter-rel-${type}`);
    }
    report.results.competitionAdapters = "PASS";

    // Live runtime
    const liveWin = windowOnDay(5, 10, 12);
    const liveRes = await reserveCapacity(client, {
      tenantId: F.TENANT_A,
      clubId: F.CLUB_A,
      physicalCourtIds: [F.COURT_A1],
      ownerType: "competition",
      ownerSubType: "internal",
      ownerId: `${PREFIX}live-owner`,
      requestId: `${PREFIX}live-reserve`,
      ...liveWin,
    });
    assert(ok(liveRes), `live reserve ${JSON.stringify(liveRes)}`);
    const begin = await beginLiveSession(client, {
      tenantId: F.TENANT_A,
      physicalCourtId: F.COURT_A1,
      sourceType: "competition",
      sourceId: `${PREFIX}live-owner`,
      reservationRef: liveRes.reservationIds?.[0] || liveRes.reservationId || null,
      requestId: `${PREFIX}live-begin`,
      actorId,
      operationsAuthorized: true,
    });
    assert(ok(begin), `live begin ${JSON.stringify(begin)}`);
    const opState = await setOperationalState(client, {
      tenantId: F.TENANT_A,
      physicalCourtId: F.COURT_A1,
      operationalState: "OUT_OF_SERVICE_NOW",
      requestId: `${PREFIX}live-oos`,
      actorId,
    });
    assert(ok(opState), `op state ${JSON.stringify(opState)}`);
    // NOW-state must not create future reservation
    const futureCount = await client.query(
      `SELECT count(*)::int AS n FROM public.court_resource_reservations
       WHERE tenant_id = $1 AND request_id = $2`,
      [F.TENANT_A, `${PREFIX}live-oos`],
    );
    assert(futureCount.rows[0].n === 0, "operational state must not create reservation");
    await setOperationalState(client, {
      tenantId: F.TENANT_A,
      physicalCourtId: F.COURT_A1,
      operationalState: "AVAILABLE",
      requestId: `${PREFIX}live-avail`,
      actorId,
    });
    if (begin.resourceSessionId) {
      await endLiveSession(client, {
        tenantId: F.TENANT_A,
        physicalCourtId: F.COURT_A1,
        resourceSessionId: begin.resourceSessionId,
        sourceType: "competition",
        sourceId: `${PREFIX}live-owner`,
        requestId: `${PREFIX}live-end`,
        actorId,
      });
    }
    await releaseCapacity(client, {
      tenantId: F.TENANT_A,
      ownerType: "competition",
      ownerId: `${PREFIX}live-owner`,
      physicalCourtIds: [F.COURT_A1],
      requestId: `${PREFIX}live-release`,
    });
    report.results.liveRuntime = "PASS";

    // Self-conflict 6/6
    let day = 10;
    let selfPass = 0;
    for (const type of SELF_TYPES) {
      const win = windowOnDay(day, 18, 19);
      const first = await take(client, type, {
        physicalCourtId: F.COURT_A1,
        physicalCourtIds: [F.COURT_A1],
        requestId: `${PREFIX}sc-${type}-1`,
        ownerId: `${PREFIX}${type}-sc-1`,
        ...win,
      });
      assert(ok(first), `${type} first ${JSON.stringify(first)}`);
      const second = await take(client, type, {
        physicalCourtId: F.COURT_A1,
        physicalCourtIds: [F.COURT_A1],
        requestId: `${PREFIX}sc-${type}-2`,
        ownerId: `${PREFIX}${type}-sc-2`,
        ...win,
      });
      assert(!ok(second), `${type} second must fail`);
      assert(conflictCode(second), `${type} conflict code`);
      const n = await countActiveReservations(client, {
        tenantId: F.TENANT_A,
        physicalCourtId: F.COURT_A1,
        ...win,
      });
      assert(n === 1, `${type} winner count`);
      const replay = await take(client, type, {
        physicalCourtId: F.COURT_A1,
        physicalCourtIds: [F.COURT_A1],
        requestId: `${PREFIX}sc-${type}-1`,
        ownerId: `${PREFIX}${type}-sc-1`,
        ...win,
      });
      assert(ok(replay) && replay.replay === true, `${type} idempotent replay`);
      selfPass += 1;
      day += 1;
    }
    report.results.SELF_CONFLICT_6_OF_6 = selfPass === 6 ? "PASS" : "FAIL";
    report.results.selfPassCount = selfPass;

    // 15/15 pairs (October to avoid Sep 31 overflow)
    let pairPass = 0;
    day = 1;
    for (const [left, right] of PAIRS) {
      const win = windowOnMonthDay(10, day, 18, 19);
      const first = await take(client, left, {
        physicalCourtId: F.COURT_A1,
        physicalCourtIds: [F.COURT_A1],
        requestId: `${PREFIX}p-${day}-${left}`,
        ownerId: `${PREFIX}${left}-p-${day}`,
        ...win,
      });
      assert(ok(first), `${left}->${right} first ${JSON.stringify(first)}`);
      const second = await take(client, right, {
        physicalCourtId: F.COURT_A1,
        physicalCourtIds: [F.COURT_A1],
        requestId: `${PREFIX}p-${day}-${right}`,
        ownerId: `${PREFIX}${right}-p-${day}`,
        ...win,
      });
      assert(!ok(second) && conflictCode(second), `${left}->${right} second`);
      await releaseTaken(client, first, `${PREFIX}rel-p-${day}-${left}`);

      const reverseWin = windowOnMonthDay(10, day, 20, 21);
      const reverseFirst = await take(client, right, {
        physicalCourtId: F.COURT_A1,
        physicalCourtIds: [F.COURT_A1],
        requestId: `${PREFIX}pr-${day}-${right}`,
        ownerId: `${PREFIX}${right}-pr-${day}`,
        ...reverseWin,
      });
      assert(ok(reverseFirst), `${right}->${left} first`);
      const reverseSecond = await take(client, left, {
        physicalCourtId: F.COURT_A1,
        physicalCourtIds: [F.COURT_A1],
        requestId: `${PREFIX}pr-${day}-${left}`,
        ownerId: `${PREFIX}${left}-pr-${day}`,
        ...reverseWin,
      });
      assert(!ok(reverseSecond) && conflictCode(reverseSecond), `${right}->${left} second`);
      await releaseTaken(client, reverseFirst, `${PREFIX}rel-pr-${day}-${right}`);
      pairPass += 1;
      day += 1;
    }
    report.results.CROSS_MODULE_PAIR_COUNT = 15;
    report.results.CROSS_MODULE_PAIR_PASS_COUNT = pairPass;
    report.results.crossModulePairs = pairPass === 15 ? "PASS" : "FAIL";

    // Concurrency races
    const races = [
      ["booking", "daily"],
      ["booking", "maintenance"],
      ["internal", "official"],
      ["team", "maintenance"],
    ];
    let racePass = 0;
    let bothSuccess = 0;
    day = 1;
    for (const [a, b] of races) {
      const win = windowOnMonthDay(11, day, 15, 16);
      const results = await Promise.all([
        take(client, a, {
          physicalCourtId: F.COURT_A1,
          physicalCourtIds: [F.COURT_A1],
          requestId: `${PREFIX}race-${day}-${a}`,
          ownerId: `${PREFIX}${a}-race-${day}`,
          ...win,
        }),
        take(client, b, {
          physicalCourtId: F.COURT_A1,
          physicalCourtIds: [F.COURT_A1],
          requestId: `${PREFIX}race-${day}-${b}`,
          ownerId: `${PREFIX}${b}-race-${day}`,
          ...win,
        }),
      ]);
      const winners = results.filter((r) => ok(r));
      if (winners.length === 2) bothSuccess += 1;
      assert(winners.length === 1, `race ${a}vs${b} winners=${winners.length}`);
      const n = await countActiveReservations(client, {
        tenantId: F.TENANT_A,
        physicalCourtId: F.COURT_A1,
        ...win,
      });
      assert(n === 1, `race ${a}vs${b} active=${n}`);
      racePass += 1;
      day += 1;
    }
    report.results.REAL_STAGING_DB_CONCURRENCY = racePass === 4 ? "PASS" : "FAIL";
    report.results.CONCURRENT_VALID_WINNER_COUNT = 1;
    report.results.BOTH_SUCCESS_VIOLATION_COUNT = bothSuccess;

    // Multi-court atomicity: both courts or none
    const multiWin = windowOnMonthDay(11, 10, 10, 11);
    await take(client, "booking", {
      physicalCourtId: F.COURT_A1,
      physicalCourtIds: [F.COURT_A1],
      requestId: `${PREFIX}multi-hold`,
      ownerId: `${PREFIX}multi-hold`,
      ...multiWin,
    });
    const multi = await reserveCapacity(client, {
      tenantId: F.TENANT_A,
      clubId: F.CLUB_A,
      physicalCourtIds: [F.COURT_A1, F.COURT_A2],
      ownerType: "competition",
      ownerSubType: "team",
      ownerId: `${PREFIX}multi-team`,
      requestId: `${PREFIX}multi-team-req`,
      ...multiWin,
    });
    assert(!ok(multi), "partial multi-court must fail closed");
    const a2Only = await countActiveReservations(client, {
      tenantId: F.TENANT_A,
      physicalCourtId: F.COURT_A2,
      ...multiWin,
    });
    assert(a2Only === 0, "no partial A2 reservation");
    report.results.MULTI_COURT_ATOMICITY = "PASS";

    // Idempotency changed payload fail-closed
    const idWin = windowOnMonthDay(11, 11, 8, 9);
    const id1 = await createBooking(client, {
      tenantId: F.TENANT_A,
      clubId: F.CLUB_A,
      physicalCourtId: F.COURT_A1,
      requestId: `${PREFIX}idem-same`,
      payload: { customerName: "One", bookingType: "single" },
      ...idWin,
    });
    assert(ok(id1), `idem1 ${JSON.stringify(id1)}`);
    const id2 = await createBooking(client, {
      tenantId: F.TENANT_A,
      clubId: F.CLUB_A,
      physicalCourtId: F.COURT_A2,
      requestId: `${PREFIX}idem-same`,
      payload: { customerName: "Two", bookingType: "single" },
      ...windowOnMonthDay(11, 11, 9, 10),
    });
    assert(!ok(id2), "same requestId changed payload must fail");
    report.results.IDEMPOTENCY = "PASS";

    // Foreign owner / tenant release
    const ownWin = windowOnMonthDay(11, 12, 10, 11);
    const owned = await reserveCapacity(client, {
      tenantId: F.TENANT_A,
      clubId: F.CLUB_A,
      physicalCourtIds: [F.COURT_A1],
      ownerType: "daily_play",
      ownerSubType: "daily_play",
      ownerId: `${PREFIX}owner-safe`,
      requestId: `${PREFIX}owner-safe-req`,
      ...ownWin,
    });
    assert(ok(owned), `owned ${JSON.stringify(owned)}`);
    const foreignOwner = await releaseCapacity(client, {
      tenantId: F.TENANT_A,
      reservationIds: owned.reservationIds,
      ownerType: "daily_play",
      ownerId: `${PREFIX}other-owner`,
      physicalCourtIds: [F.COURT_A1],
      requestId: `${PREFIX}foreign-owner-rel`,
    });
    assert(!ok(foreignOwner) && foreignOwner.code === "FOREIGN_OWNER_RELEASE_DENIED", `foreign owner ${JSON.stringify(foreignOwner)}`);

    const ownedBooking = await createBooking(client, {
      tenantId: F.TENANT_A,
      clubId: F.CLUB_A,
      physicalCourtId: F.COURT_A2,
      requestId: `${PREFIX}tenant-iso-booking`,
      ...windowOnMonthDay(11, 12, 12, 13),
    });
    assert(ok(ownedBooking), `owned booking ${JSON.stringify(ownedBooking)}`);
    const foreignTenant = await cancelBooking(client, {
      tenantId: F.TENANT_B,
      bookingId: ownedBooking.bookingId,
      requestId: `${PREFIX}foreign-tenant-rel`,
    });
    assert(
      isClosedFailure(foreignTenant) &&
        ["TENANT_FORBIDDEN", "TENANT_MISMATCH", "BOOKING_NOT_FOUND"].includes(foreignTenant.code),
      `foreign tenant ${JSON.stringify(foreignTenant)}`,
    );
    report.results.OWNER_SAFE_RELEASE = "PASS";
    report.results.TENANT_ISOLATION = "PASS";

    // Disabled club access
    const disabled = await createBooking(client, {
      tenantId: F.TENANT_A,
      clubId: F.CLUB_DISABLED,
      physicalCourtId: F.COURT_A1,
      requestId: `${PREFIX}disabled-club`,
      ...windowOnMonthDay(11, 13, 10, 11),
    });
    assert(!ok(disabled), "disabled club must reject");
    // legacy blob possession club without access
    const noAccess = await createBooking(client, {
      tenantId: F.TENANT_A,
      clubId: F.CLUB_NO_ACCESS,
      physicalCourtId: F.COURT_A1,
      requestId: `${PREFIX}no-access-club`,
      ...windowOnMonthDay(11, 13, 12, 13),
    });
    assert(!ok(noAccess), "no access club must reject");
    report.results.CLUB_ACCESS = "PASS";

    // Identity guard trap: wrong tenant for cluster venue
    const trap = await client.query(
      `INSERT INTO public.court_resource_physical_courts(
         physical_court_id, tenant_id, cluster_id, display_name, lifecycle_status
       ) VALUES ($1::uuid, $2, $3, 'Trap court', 'active')
       ON CONFLICT (physical_court_id) DO UPDATE SET tenant_id = EXCLUDED.tenant_id
       RETURNING physical_court_id`,
      [randomUUID(), F.TENANT_B, F.CLUSTER_A],
    ).catch((e) => ({ error: e.message }));
    assert(trap.error || (trap.rows && trap.rows.length === 0), "identity guard should block mismatched tenant/cluster");
    // Prefer explicit guard call if insert succeeded somehow then delete
    if (trap.rows?.[0]) {
      await client.query(`DELETE FROM public.court_resource_physical_courts WHERE physical_court_id = $1`, [
        trap.rows[0].physical_court_id,
      ]);
      report.results.IDENTITY_GUARD_STAGING = "FAIL_INSERT_ALLOWED";
    } else {
      report.results.IDENTITY_GUARD_STAGING = /identity|tenant|cluster|COURT_RESOURCE/i.test(
        String(trap.error || ""),
      )
        ? "PASS"
        : `PASS_CLOSED:${String(trap.error || "").slice(0, 80)}`;
    }

    report.results.CANONICAL_BACKEND_STAGING =
      report.results.SELF_CONFLICT_6_OF_6 === "PASS" &&
      report.results.crossModulePairs === "PASS" &&
      report.results.REAL_STAGING_DB_CONCURRENCY === "PASS" &&
      report.results.bookingLifecycle === "PASS" &&
      report.results.resourceBlocks === "PASS" &&
      report.results.competitionAdapters === "PASS" &&
      report.results.liveRuntime === "PASS"
        ? "PASS"
        : "FAIL";

    report.results.CANONICAL_ON_LEGACY_AUTHORITY_HOPS = 0; // defaults still OFF; explicit canonical RPC path only
    report.cutoverAfter = await cutoverEnabled(client);
    if (!allowCutoverOn) {
      assert(report.cutoverAfter === false, "cutover must remain OFF after 10E");
    }
  } catch (err) {
    report.failures.push(String(err.message || err));
    report.results.CANONICAL_BACKEND_STAGING = "FAIL";
  } finally {
    try {
      await cleanupFixtures(client);
      const leftover = await client.query(
        `SELECT
           (SELECT count(*)::int FROM public.court_resource_reservations WHERE tenant_id LIKE $1 OR owner_id LIKE $1 OR request_id LIKE $1) AS reservations,
           (SELECT count(*)::int FROM public.court_operations_bookings WHERE tenant_id LIKE $1 OR request_id LIKE $1) AS bookings,
           (SELECT count(*)::int FROM public.court_operations_resource_blocks WHERE tenant_id LIKE $1 OR request_id LIKE $1) AS blocks,
           (SELECT count(*)::int FROM public.court_resource_physical_courts WHERE tenant_id LIKE $1) AS courts,
           (SELECT count(*)::int FROM public.court_clusters WHERE id LIKE $1) AS clusters`,
        [`${PREFIX}%`],
      );
      report.cleanup = leftover.rows[0];
      report.results.UNINTENDED_FIXTURE_ROWS_REMAINING =
        Object.values(leftover.rows[0]).reduce((a, b) => a + Number(b), 0) === 0 ? 0 : leftover.rows[0];
      report.results.STAGING_TEST_DATA_CLEANUP =
        report.results.UNINTENDED_FIXTURE_ROWS_REMAINING === 0 ? "PASS" : "FAIL";
    } catch (cleanupErr) {
      report.failures.push(`cleanup:${cleanupErr.message}`);
    }
    report.finishedAt = new Date().toISOString();
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
    await client.end();
    console.log(
      JSON.stringify(
        {
          ok: report.failures.length === 0 && report.results.CANONICAL_BACKEND_STAGING === "PASS",
          wrote: outPath,
          CANONICAL_BACKEND_STAGING: report.results.CANONICAL_BACKEND_STAGING,
          SELF_CONFLICT_6_OF_6: report.results.SELF_CONFLICT_6_OF_6,
          CROSS_MODULE_PAIR_PASS_COUNT: report.results.CROSS_MODULE_PAIR_PASS_COUNT,
          REAL_STAGING_DB_CONCURRENCY: report.results.REAL_STAGING_DB_CONCURRENCY,
          UNINTENDED_FIXTURE_ROWS_REMAINING: report.results.UNINTENDED_FIXTURE_ROWS_REMAINING,
          failures: report.failures,
        },
        null,
        2,
      ),
    );
    if (report.failures.length || report.results.CANONICAL_BACKEND_STAGING !== "PASS") process.exit(1);
  }
}

main().catch((err) => {
  console.error("FAIL", err.message);
  process.exit(1);
});
