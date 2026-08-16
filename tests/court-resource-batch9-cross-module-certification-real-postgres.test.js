/**
 * Batch 9 — isolated PostgreSQL cross-module capacity certification.
 * Never connects to Staging qyewbxjsiiyufanzcjcq or Production expuvcohlcjzvrrauvud.
 *
 * Opt-in:
 *   COURT_RESOURCE_BATCH9_ENABLE_REAL_POSTGRES=1
 *   or COURT_RESOURCE_PHASE3B_ENABLE_REAL_POSTGRES=1
 *   or COURT_RESOURCE_PHASE3B_DATABASE_URL=postgresql://.../cr_p3b_*
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  FIXTURE as F,
  acquireOwner,
  beginLiveSession,
  bootIsolatedPostgres,
  cancelBooking,
  cancelResourceBlock,
  conflictCode,
  countActiveReservations,
  countAllReservations,
  createBooking,
  createResourceBlock,
  cutoverEnabled,
  endLiveSession,
  getAvailability,
  installCanonicalStack,
  isBatch9RealPostgresEnabled,
  isClosedFailure,
  listEligibleCourts,
  ownerSpec,
  releaseCapacity,
  rescheduleBooking,
  rescheduleResourceBlock,
  reserveCapacity,
  seedBatch9Fixtures,
  setActor,
  setOperationalState,
  transferBooking,
  transferResourceBlock,
  windowOnDay,
  withSafeClient,
  withSafeClients,
} from "./helpers/court-resource-batch9-postgres.js";

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
const CONSUMERS = ["booking", "daily", "internal", "official", "team"];

async function take(client, type, args) {
  const ownerId = args.ownerId || `${type}-${args.requestId}`;
  const result = await acquireOwner(client, type, { ...args, ownerId });
  return {
    ...result,
    _type: type,
    _ownerId: result.bookingId || result.resourceBlockId || ownerId,
  };
}

async function releaseTaken(client, taken, requestId) {
  const type = taken._type;
  if (type === "booking") {
    return cancelBooking(client, { bookingId: taken.bookingId, requestId });
  }
  if (type === "maintenance" || type === "operations") {
    return cancelResourceBlock(client, { resourceBlockId: taken.resourceBlockId, requestId });
  }
  const spec = ownerSpec(type);
  return releaseCapacity(client, {
    ownerType: spec.ownerType,
    ownerId: taken._ownerId,
    physicalCourtIds: taken.physicalCourtIds || [argsCourt(taken)],
    requestId,
  });
}

function argsCourt(taken) {
  return taken.physicalCourtId || F.COURT_A1;
}

test("Batch 9 real-postgres safety gate forbids Staging/Production hosts", async () => {
  const { assertSafePhase3bDatabaseUrl, FORBIDDEN_HOST_MARKERS } = await import(
    "./helpers/court-resource-phase3b-postgres.js"
  );
  for (const marker of ["expuvcohlcjzvrrauvud", "qyewbxjsiiyufanzcjcq", "supabase.co"]) {
    assert.equal(FORBIDDEN_HOST_MARKERS.includes(marker), true, marker);
    const gate = assertSafePhase3bDatabaseUrl(
      `postgresql://postgres:x@db.${marker}.supabase.co:5432/postgres`
    );
    assert.equal(gate.ok, false, marker);
  }
});

test("Batch 9 isolated PostgreSQL cross-module certification", { timeout: 600000 }, async (t) => {
  if (!isBatch9RealPostgresEnabled()) {
    t.skip("REAL_POSTGRES_NOT_OPTED_IN (set COURT_RESOURCE_BATCH9_ENABLE_REAL_POSTGRES=1)");
    return;
  }

  const boot = await bootIsolatedPostgres();
  if (!boot) {
    assert.fail("BATCH9_BLOCKED_NO_ISOLATED_DB_CONCURRENCY_ENV");
  }

  t.diagnostic(`CERTIFICATION_ENVIRONMENT=${boot.environment}`);
  let databaseUrl = boot.databaseUrl;

  try {
    await withSafeClient(databaseUrl, async (client) => {
      await installCanonicalStack(client);
      await seedBatch9Fixtures(client);
      await setActor(client, F.SUPER);
      assert.equal(await cutoverEnabled(client), false);

      await t.test("B9-ID-01 same physicalCourtId UUID used across all consumers", async () => {
        const windows = [
          ["booking", windowOnDay(1, 8, 9)],
          ["daily", windowOnDay(1, 9, 10)],
          ["internal", windowOnDay(1, 10, 11)],
          ["official", windowOnDay(1, 11, 12)],
          ["team", windowOnDay(1, 12, 13)],
          ["maintenance", windowOnDay(1, 13, 14)],
        ];
        const ids = [];
        for (const [type, win] of windows) {
          const result = await take(client, type, {
            physicalCourtId: F.COURT_A1,
            physicalCourtIds: [F.COURT_A1],
            requestId: `id-${type}`,
            ...win,
          });
          assert.equal(result.ok, true, `${type} ${JSON.stringify(result)}`);
          ids.push(F.COURT_A1);
        }
        const { rows } = await client.query(
          `SELECT DISTINCT physical_court_id::text AS id
           FROM public.court_resource_reservations
           WHERE physical_court_id = $1 AND status = 'active'`,
          [F.COURT_A1]
        );
        assert.equal(rows.length, 1);
        assert.equal(rows[0].id, F.COURT_A1);
        assert.equal(new Set(ids).size, 1);
      });

      await t.test("B9-SC self-conflict: exactly one valid capacity winner per owner type", async () => {
        let day = 2;
        for (const type of SELF_TYPES) {
          const win = windowOnDay(day, 18, 19);
          const first = await take(client, type, {
            physicalCourtId: F.COURT_A1,
            physicalCourtIds: [F.COURT_A1],
            requestId: `sc-${type}-1`,
            ownerId: `${type}-sc-1`,
            ...win,
          });
          assert.equal(first.ok, true, `${type} first ${JSON.stringify(first)}`);
          const second = await take(client, type, {
            physicalCourtId: F.COURT_A1,
            physicalCourtIds: [F.COURT_A1],
            requestId: `sc-${type}-2`,
            ownerId: `${type}-sc-2`,
            ...win,
          });
          assert.equal(second.ok, false, `${type} second must fail`);
          assert.equal(conflictCode(second), true, `${type} ${second.code}`);
          const n = await countActiveReservations(client, {
            tenantId: F.TENANT_A,
            physicalCourtId: F.COURT_A1,
            ...win,
          });
          assert.equal(n, 1, `${type} winner count`);
          const replay = await take(client, type, {
            physicalCourtId: F.COURT_A1,
            physicalCourtIds: [F.COURT_A1],
            requestId: `sc-${type}-1`,
            ownerId: `${type}-sc-1`,
            ...win,
          });
          assert.equal(replay.ok, true, `${type} idempotent retry`);
          assert.equal(replay.replay, true, `${type} replay`);
          const afterRetry = await countActiveReservations(client, {
            tenantId: F.TENANT_A,
            physicalCourtId: F.COURT_A1,
            ...win,
          });
          assert.equal(afterRetry, 1, `${type} no duplicate from retry`);
          day += 1;
        }
      });

      await t.test("B9-PAIR 15 bidirectional cross-module pairs", async () => {
        assert.equal(PAIRS.length, 15);
        let day = 8;
        for (const [left, right] of PAIRS) {
          const win = windowOnDay(day, 18, 19);
          const first = await take(client, left, {
            physicalCourtId: F.COURT_A1,
            physicalCourtIds: [F.COURT_A1],
            requestId: `p-${day}-${left}`,
            ownerId: `${left}-p-${day}`,
            ...win,
          });
          assert.equal(first.ok, true, `${left}→${right} first ${JSON.stringify(first)}`);
          const second = await take(client, right, {
            physicalCourtId: F.COURT_A1,
            physicalCourtIds: [F.COURT_A1],
            requestId: `p-${day}-${right}`,
            ownerId: `${right}-p-${day}`,
            ...win,
          });
          assert.equal(second.ok, false, `${left}→${right} second`);
          assert.equal(conflictCode(second), true, `${left}→${right} ${second.code}`);
          await releaseTaken(client, first, `rel-p-${day}-${left}`);

          const reverseWin = windowOnDay(day, 20, 21);
          const reverseFirst = await take(client, right, {
            physicalCourtId: F.COURT_A1,
            physicalCourtIds: [F.COURT_A1],
            requestId: `pr-${day}-${right}`,
            ownerId: `${right}-pr-${day}`,
            ...reverseWin,
          });
          assert.equal(reverseFirst.ok, true, `${right}→${left} first ${JSON.stringify(reverseFirst)}`);
          const reverseSecond = await take(client, left, {
            physicalCourtId: F.COURT_A1,
            physicalCourtIds: [F.COURT_A1],
            requestId: `pr-${day}-${left}`,
            ownerId: `${left}-pr-${day}`,
            ...reverseWin,
          });
          assert.equal(reverseSecond.ok, false, `${right}→${left} second`);
          assert.equal(conflictCode(reverseSecond), true, `${right}→${left} ${reverseSecond.code}`);
          await releaseTaken(client, reverseFirst, `rel-pr-${day}-${right}`);
          day += 1;
        }
      });

      await t.test("B9-CTRL non-overlap, different court, adjacent half-open", async () => {
        let day = 23;
        for (const type of SELF_TYPES) {
          const nonOverlapA = windowOnDay(day, 10, 11);
          const nonOverlapB = windowOnDay(day, 12, 13);
          const a = await take(client, type, {
            physicalCourtId: F.COURT_A1,
            physicalCourtIds: [F.COURT_A1],
            requestId: `ctrl-no-${type}-a`,
            ownerId: `${type}-ctrl-a`,
            ...nonOverlapA,
          });
          const b = await take(client, type, {
            physicalCourtId: F.COURT_A1,
            physicalCourtIds: [F.COURT_A1],
            requestId: `ctrl-no-${type}-b`,
            ownerId: `${type}-ctrl-b`,
            ...nonOverlapB,
          });
          assert.equal(a.ok, true, `${type} non-overlap A ${JSON.stringify(a)}`);
          assert.equal(b.ok, true, `${type} non-overlap B ${JSON.stringify(b)}`);

          const sameWin = windowOnDay(day, 14, 15);
          const c1 = await take(client, type, {
            physicalCourtId: F.COURT_A1,
            physicalCourtIds: [F.COURT_A1],
            requestId: `ctrl-dc-${type}-a1`,
            ownerId: `${type}-ctrl-a1`,
            ...sameWin,
          });
          const c2 = await take(client, type, {
            physicalCourtId: F.COURT_A2,
            physicalCourtIds: [F.COURT_A2],
            requestId: `ctrl-dc-${type}-a2`,
            ownerId: `${type}-ctrl-a2`,
            ...sameWin,
          });
          assert.equal(c1.ok, true, `${type} different court A1 ${JSON.stringify(c1)}`);
          assert.equal(c2.ok, true, `${type} different court A2 ${JSON.stringify(c2)}`);
          day += 1;
        }

        const adjA = await take(client, "booking", {
          physicalCourtId: F.COURT_A1,
          requestId: "adj-a",
          ...windowOnDay(23, 18, 19),
        });
        const adjB = await take(client, "daily", {
          physicalCourtId: F.COURT_A1,
          physicalCourtIds: [F.COURT_A1],
          requestId: "adj-b",
          ...windowOnDay(23, 19, 20),
        });
        assert.equal(adjA.ok, true, JSON.stringify(adjA));
        assert.equal(adjB.ok, true, "adjacent 19:00 boundary must be allowed");
      });

      await t.test("B9-OV overlap shapes: exact/partial/contains/contained conflict", async () => {
        const base = await take(client, "booking", {
          physicalCourtId: F.COURT_A1,
          requestId: "ov-base",
          ...windowOnDay(25, 18, 20),
        });
        assert.equal(base.ok, true);
        const cases = [
          ["exact", windowOnDay(25, 18, 20)],
          ["partial", windowOnDay(25, 19, 21)],
          ["contains-challenger", windowOnDay(25, 17, 21)],
          ["contained-challenger", windowOnDay(25, 18, 19)],
        ];
        for (const [name, win] of cases) {
          const challenger = await take(client, "internal", {
            physicalCourtId: F.COURT_A1,
            physicalCourtIds: [F.COURT_A1],
            requestId: `ov-${name}`,
            ...win,
          });
          assert.equal(challenger.ok, false, name);
          assert.equal(conflictCode(challenger), true, `${name} ${challenger.code}`);
        }
      });

      await t.test("B9-MC multi-court atomicity: A1 free + A2 conflict → no partial", async () => {
        const win = windowOnDay(26, 18, 19);
        const blocker = await take(client, "booking", {
          physicalCourtId: F.COURT_A2,
          requestId: "mc-block",
          ...win,
        });
        assert.equal(blocker.ok, true);
        const before = await countActiveReservations(client, {
          tenantId: F.TENANT_A,
          physicalCourtId: F.COURT_A1,
          ...win,
        });
        const multi = await reserveCapacity(client, {
          physicalCourtIds: [F.COURT_A1, F.COURT_A2],
          ownerType: "competition",
          ownerSubType: "internal",
          ownerId: "internal-mc",
          requestId: "mc-comp",
          ...win,
        });
        assert.equal(multi.ok, false);
        assert.equal(conflictCode(multi), true);
        const after = await countActiveReservations(client, {
          tenantId: F.TENANT_A,
          physicalCourtId: F.COURT_A1,
          ...win,
        });
        assert.equal(after, before);
        const a1Rows = await client.query(
          `SELECT count(*)::int AS n FROM public.court_resource_reservations
           WHERE physical_court_id = $1 AND owner_id = 'internal-mc'`,
          [F.COURT_A1]
        );
        assert.equal(a1Rows.rows[0].n, 0);
      });

      await t.test("B9-IDEM requestId payload mismatch fails closed", async () => {
        const win = windowOnDay(26, 8, 9);
        const created = await createBooking(client, {
          physicalCourtId: F.COURT_A1,
          requestId: "idem-mismatch",
          ...win,
        });
        assert.equal(created.ok, true);
        const mismatch = await createBooking(client, {
          physicalCourtId: F.COURT_A2,
          requestId: "idem-mismatch",
          ...win,
        });
        assert.equal(mismatch.ok, false);
        assert.equal(mismatch.code, "IDEMPOTENCY_CONFLICT");
        const reserveFirst = await reserveCapacity(client, {
          physicalCourtIds: [F.COURT_A1],
          ownerType: "daily_play",
          ownerId: "daily-idem",
          requestId: "idem-daily",
          ...windowOnDay(26, 9, 10),
        });
        assert.equal(reserveFirst.ok, true);
        const reserveMismatch = await reserveCapacity(client, {
          physicalCourtIds: [F.COURT_A2],
          ownerType: "daily_play",
          ownerId: "daily-idem",
          requestId: "idem-daily",
          ...windowOnDay(26, 9, 10),
        });
        assert.equal(reserveMismatch.ok, false);
        assert.equal(reserveMismatch.code, "IDEMPOTENCY_CONFLICT");
      });

      await t.test("B9-REL owner-safe release, foreign owner/tenant rejected, history retained", async () => {
        const win = windowOnDay(27, 16, 17);
        const booking = await createBooking(client, {
          physicalCourtId: F.COURT_A1,
          requestId: "rel-bk",
          ...win,
        });
        assert.equal(booking.ok, true);
        const foreignOwner = await releaseCapacity(client, {
          reservationIds: [booking.reservationId],
          ownerType: "competition",
          ownerId: "not-the-booking",
          requestId: "rel-foreign-owner",
        });
        assert.equal(foreignOwner.ok, false);
        assert.equal(foreignOwner.code, "FOREIGN_OWNER_RELEASE_DENIED");

        await setActor(client, F.OP_B, { role: "CLUB_ADMIN", venueId: F.TENANT_B, clubId: F.CLUB_B });
        const foreignTenant = await cancelBooking(client, {
          tenantId: F.TENANT_A,
          bookingId: booking.bookingId,
          requestId: "rel-foreign-tenant",
        });
        assert.equal(isClosedFailure(foreignTenant), true);
        assert.ok(["TENANT_FORBIDDEN", "TENANT_MISMATCH"].includes(foreignTenant.code));

        await setActor(client, F.SUPER);
        const own = await cancelBooking(client, {
          bookingId: booking.bookingId,
          requestId: "rel-own",
        });
        assert.equal(own.ok, true);
        const repeat = await cancelBooking(client, {
          bookingId: booking.bookingId,
          requestId: "rel-own-repeat",
        });
        assert.equal(repeat.ok, true);
        const { rows } = await client.query(
          `SELECT status FROM public.court_resource_reservations WHERE reservation_id = $1`,
          [booking.reservationId]
        );
        assert.ok(rows.length === 1);
        assert.notEqual(rows[0].status, "active");

        const daily = await reserveCapacity(client, {
          physicalCourtIds: [F.COURT_A1],
          ownerType: "daily_play",
          ownerId: "daily-rel",
          requestId: "rel-daily",
          ...windowOnDay(27, 18, 19),
        });
        assert.equal(daily.ok, true);
        const dailyRel = await releaseCapacity(client, {
          ownerType: "daily_play",
          ownerId: "daily-rel",
          physicalCourtIds: [F.COURT_A1],
          requestId: "rel-daily-own",
        });
        assert.equal(dailyRel.ok, true);

        const block = await createResourceBlock(client, {
          physicalCourtId: F.COURT_A1,
          blockType: "MAINTENANCE",
          requestId: "rel-rb",
          ...windowOnDay(27, 20, 21),
        });
        assert.equal(block.ok, true);
        const rbCancel = await cancelResourceBlock(client, {
          resourceBlockId: block.resourceBlockId,
          requestId: "rel-rb-own",
        });
        assert.equal(rbCancel.ok, true);
        const { rows: hist } = await client.query(
          `SELECT lifecycle_status FROM public.court_operations_resource_blocks WHERE resource_block_id = $1`,
          [block.resourceBlockId]
        );
        assert.equal(hist[0].lifecycle_status, "cancelled");
      });

      await t.test("B9-TENANT isolation fail-closed", async () => {
        await setActor(client, F.OP_A, { role: "CLUB_ADMIN", venueId: F.TENANT_A, clubId: F.CLUB_A });
        const listB = await listEligibleCourts(client, { tenantId: F.TENANT_B, clubId: F.CLUB_B });
        assert.equal(listB.ok, false);
        assert.equal(listB.code, "TENANT_FORBIDDEN");

        const reserveB = await reserveCapacity(client, {
          tenantId: F.TENANT_B,
          clubId: F.CLUB_B,
          physicalCourtIds: [F.COURT_B1],
          ownerType: "booking",
          ownerId: "cross-reserve",
          requestId: "tenant-reserve-b",
          ...windowOnDay(28, 10, 11),
        });
        assert.equal(reserveB.ok, false);
        assert.ok(["TENANT_FORBIDDEN", "CROSS_TENANT_COURT"].includes(reserveB.code));

        const reserveBCourtAsA = await reserveCapacity(client, {
          tenantId: F.TENANT_A,
          clubId: F.CLUB_A,
          physicalCourtIds: [F.COURT_B1],
          ownerType: "daily_play",
          ownerId: "cross-court",
          requestId: "tenant-court-b",
          ...windowOnDay(28, 10, 11),
        });
        assert.equal(reserveBCourtAsA.ok, false);
        assert.equal(reserveBCourtAsA.code, "CROSS_TENANT_COURT");

        await setActor(client, F.SUPER);
        const bookingB = await createBooking(client, {
          tenantId: F.TENANT_B,
          clubId: F.CLUB_B,
          physicalCourtId: F.COURT_B1,
          requestId: "bk-tenant-b",
          ...windowOnDay(28, 18, 19),
        });
        assert.equal(bookingB.ok, true, JSON.stringify(bookingB));
        await setActor(client, F.OP_A, { role: "CLUB_ADMIN", venueId: F.TENANT_A, clubId: F.CLUB_A });
        const updateB = await cancelBooking(client, {
          tenantId: F.TENANT_B,
          bookingId: bookingB.bookingId,
          requestId: "cancel-b-as-a",
        });
        assert.equal(updateB.ok, false);
        assert.ok(["TENANT_FORBIDDEN", "TENANT_MISMATCH"].includes(updateB.code));

        const liveB = await beginLiveSession(client, {
          tenantId: F.TENANT_B,
          physicalCourtId: F.COURT_B1,
          sourceType: "booking",
          sourceId: bookingB.bookingId,
          requestId: "live-b-as-a",
        });
        assert.equal(liveB.ok, false);
        assert.ok(["TENANT_FORBIDDEN", "CROSS_TENANT_COURT"].includes(liveB.code));
        await setActor(client, F.SUPER);
      });

      await t.test("B9-ACCESS club access + disabled + legacy blob do not grant capacity", async () => {
        const win = windowOnDay(28, 20, 21);
        const noAccess = await take(client, "booking", {
          clubId: F.CLUB_NO_ACCESS,
          physicalCourtId: F.COURT_A1,
          requestId: "access-none",
          ...win,
        });
        assert.equal(noAccess.ok, false);
        assert.ok(["OUT_OF_SCOPE", "CLUB_NOT_FOUND"].includes(noAccess.code), noAccess.code);

        const disabled = await take(client, "daily", {
          clubId: F.CLUB_DISABLED,
          physicalCourtId: F.COURT_A1,
          physicalCourtIds: [F.COURT_A1],
          requestId: "access-disabled",
          ...win,
        });
        assert.equal(disabled.ok, false);
        assert.equal(disabled.code, "OUT_OF_SCOPE");

        const blobClaim = await reserveCapacity(client, {
          clubId: F.CLUB_NO_ACCESS,
          physicalCourtIds: [F.COURT_A1],
          ownerType: "competition",
          ownerId: "blob-claim",
          requestId: "access-blob",
          ...win,
        });
        assert.equal(blobClaim.ok, false);
        assert.equal(blobClaim.code, "OUT_OF_SCOPE");
      });

      await t.test("B9-RB resource block universal conflict (maintenance + operational)", async () => {
        let hour = 8;
        for (const blockType of ["maintenance", "operations"]) {
          for (const consumer of CONSUMERS) {
            const win = windowOnDay(29, hour, hour + 1);
            const block = await take(client, blockType, {
              physicalCourtId: F.COURT_A1,
              requestId: `rb-${blockType}-${consumer}`,
              ...win,
            });
            assert.equal(block.ok, true, `${blockType} ${consumer} block`);
            const second = await take(client, consumer, {
              physicalCourtId: F.COURT_A1,
              physicalCourtIds: [F.COURT_A1],
              requestId: `rb-${blockType}-${consumer}-2`,
              ...win,
            });
            assert.equal(second.ok, false, `${blockType} vs ${consumer}`);
            assert.equal(conflictCode(second), true, `${blockType} vs ${consumer} ${second.code}`);
            hour += 1;
          }
        }
      });

      await t.test("B9-LIVE live runtime is not capacity authority", async () => {
        const win = windowOnDay(30, 10, 11);
        const booking = await createBooking(client, {
          physicalCourtId: F.COURT_A2,
          requestId: "live-bk",
          ...win,
        });
        assert.equal(booking.ok, true);
        const before = await countAllReservations(client, { physicalCourtId: F.COURT_A2 });
        const begun = await beginLiveSession(client, {
          physicalCourtId: F.COURT_A2,
          sourceType: "booking",
          sourceId: booking.bookingId,
          reservationRef: booking.reservationId,
          requestId: "live-begin",
        });
        assert.equal(begun.ok, true, JSON.stringify(begun));
        assert.equal(begun.reservationWriteCount, 0);
        const mid = await countAllReservations(client, { physicalCourtId: F.COURT_A2 });
        assert.equal(mid, before);
        const ended = await endLiveSession(client, {
          physicalCourtId: F.COURT_A2,
          resourceSessionId: begun.resourceSession.resourceSessionId,
          sourceType: "booking",
          sourceId: booking.bookingId,
          requestId: "live-end",
        });
        assert.equal(ended.ok, true);
        assert.equal(ended.reservationWriteCount, 0);
        const afterEnd = await countAllReservations(client, { physicalCourtId: F.COURT_A2 });
        assert.equal(afterEnd, before);
        const future = await getAvailability(client, {
          physicalCourtIds: [F.COURT_A2],
          ownerType: "competition",
          ownerId: "other",
          ...windowOnDay(30, 18, 19),
        });
        assert.equal(future.ok, true);
        assert.equal(future.courts[0].status, "AVAILABLE");

        const stateBefore = await countAllReservations(client, { physicalCourtId: F.COURT_A1 });
        const state = await setOperationalState(client, {
          physicalCourtId: F.COURT_A1,
          operationalState: "UNAVAILABLE_NOW",
          requestId: "live-state",
        });
        assert.equal(state.ok, true, JSON.stringify(state));
        const stateAfter = await countAllReservations(client, { physicalCourtId: F.COURT_A1 });
        assert.equal(stateAfter, stateBefore);
      });

      await t.test("B9-BK booking business/capacity consistency", async () => {
        const failCreate = await createBooking(client, {
          clubId: F.CLUB_NO_ACCESS,
          physicalCourtId: F.COURT_A1,
          requestId: "bk-fail-create",
          ...windowOnDay(30, 6, 7),
        });
        assert.equal(failCreate.ok, false);
        const { rows: orphanBk } = await client.query(
          `SELECT count(*)::int AS n FROM public.court_operations_bookings WHERE request_id = 'bk-fail-create'`
        );
        assert.equal(orphanBk[0].n, 0);
        const { rows: orphanRes } = await client.query(
          `SELECT count(*)::int AS n FROM public.court_resource_reservations WHERE request_id = 'bk-fail-create'`
        );
        assert.equal(orphanRes[0].n, 0);

        const created = await createBooking(client, {
          physicalCourtId: F.COURT_A1,
          requestId: "bk-ok",
          payload: { customerName: "Bob", bookingType: "single" },
          ...windowOnDay(30, 7, 8),
        });
        assert.equal(created.ok, true);
        assert.equal(created.booking.physicalCourtId, F.COURT_A1);
        assert.equal(created.booking.identityAuthority, "physicalCourtId");
        const { rows: cap } = await client.query(
          `SELECT owner_type, status FROM public.court_resource_reservations WHERE reservation_id = $1`,
          [created.reservationId]
        );
        assert.equal(cap[0].owner_type, "booking");
        assert.equal(cap[0].status, "active");

        const blocker = await reserveCapacity(client, {
          physicalCourtIds: [F.COURT_A1],
          ownerType: "competition",
          ownerId: "bk-block",
          requestId: "bk-block",
          ...windowOnDay(30, 8, 9),
        });
        assert.equal(blocker.ok, true);
        const failedReschedule = await rescheduleBooking(client, {
          bookingId: created.bookingId,
          physicalCourtId: F.COURT_A1,
          expectedVersion: created.booking.version,
          requestId: "bk-resched-fail",
          ...windowOnDay(30, 8, 9),
        });
        assert.equal(failedReschedule.ok, false);
        assert.equal(failedReschedule.capacityPreserved, true);
        const { rows: still } = await client.query(
          `SELECT status, starts_at FROM public.court_resource_reservations WHERE reservation_id = $1`,
          [created.reservationId]
        );
        assert.equal(still[0].status, "active");

        const occupyA2 = await reserveCapacity(client, {
          physicalCourtIds: [F.COURT_A2],
          ownerType: "daily_play",
          ownerId: "bk-a2",
          requestId: "bk-a2",
          ...windowOnDay(30, 7, 8),
        });
        assert.equal(occupyA2.ok, true);
        const failedTransfer = await transferBooking(client, {
          bookingId: created.bookingId,
          newPhysicalCourtId: F.COURT_A2,
          expectedVersion: created.booking.version,
          requestId: "bk-xfer-fail",
        });
        assert.equal(failedTransfer.ok, false);
        assert.equal(failedTransfer.capacityPreserved, true);

        const cancelled = await cancelBooking(client, {
          bookingId: created.bookingId,
          requestId: "bk-cancel",
        });
        assert.equal(cancelled.ok, true);
        const { rows: afterCancel } = await client.query(
          `SELECT lifecycle_status FROM public.court_operations_bookings WHERE booking_id = $1`,
          [created.bookingId]
        );
        assert.equal(afterCancel[0].lifecycle_status, "cancelled");
        const { rows: capAfter } = await client.query(
          `SELECT status FROM public.court_resource_reservations WHERE reservation_id = $1`,
          [created.reservationId]
        );
        assert.notEqual(capAfter[0].status, "active");
      });

      await t.test("B9-RBB resource block business/capacity consistency", async () => {
        const failCreate = await createResourceBlock(client, {
          clubId: F.CLUB_NO_ACCESS,
          physicalCourtId: F.COURT_A1,
          blockType: "MAINTENANCE",
          requestId: "rbb-fail",
          ...windowOnDay(30, 4, 5),
        });
        assert.equal(failCreate.ok, false);
        const { rows: orphan } = await client.query(
          `SELECT count(*)::int AS n FROM public.court_operations_resource_blocks WHERE request_id = 'rbb-fail'`
        );
        assert.equal(orphan[0].n, 0);

        const created = await createResourceBlock(client, {
          physicalCourtId: F.COURT_A1,
          blockType: "OPERATIONAL_BLOCK",
          requestId: "rbb-ok",
          ...windowOnDay(30, 5, 6),
        });
        assert.equal(created.ok, true);
        const { rows: cap } = await client.query(
          `SELECT owner_type, owner_sub_type, status FROM public.court_resource_reservations WHERE reservation_id = $1`,
          [created.reservationId]
        );
        assert.equal(cap[0].owner_type, "operations");
        assert.equal(cap[0].owner_sub_type, "resource_block");
        assert.equal(cap[0].status, "active");

        const blocker = await reserveCapacity(client, {
          physicalCourtIds: [F.COURT_A1],
          ownerType: "booking",
          ownerId: "rbb-block",
          requestId: "rbb-block",
          ...windowOnDay(30, 6, 7),
        });
        assert.equal(blocker.ok, true);
        const failedUpdate = await rescheduleResourceBlock(client, {
          resourceBlockId: created.resourceBlockId,
          physicalCourtId: F.COURT_A1,
          expectedVersion: created.resourceBlock.version,
          requestId: "rbb-resched-fail",
          ...windowOnDay(30, 6, 7),
        });
        assert.equal(failedUpdate.ok, false);
        assert.equal(failedUpdate.capacityPreserved, true);

        const occupyA2 = await reserveCapacity(client, {
          physicalCourtIds: [F.COURT_A2],
          ownerType: "competition",
          ownerId: "rbb-a2",
          requestId: "rbb-a2",
          ...windowOnDay(30, 5, 6),
        });
        assert.equal(occupyA2.ok, true);
        const failedTransfer = await transferResourceBlock(client, {
          resourceBlockId: created.resourceBlockId,
          newPhysicalCourtId: F.COURT_A2,
          expectedVersion: created.resourceBlock.version,
          requestId: "rbb-xfer-fail",
        });
        assert.equal(failedTransfer.ok, false);
        assert.equal(failedTransfer.capacityPreserved, true);

        const cancelled = await cancelResourceBlock(client, {
          resourceBlockId: created.resourceBlockId,
          requestId: "rbb-cancel",
        });
        assert.equal(cancelled.ok, true);
        const { rows: hist } = await client.query(
          `SELECT lifecycle_status FROM public.court_operations_resource_blocks WHERE resource_block_id = $1`,
          [created.resourceBlockId]
        );
        assert.equal(hist[0].lifecycle_status, "cancelled");
      });

      await t.test("B9-CLUSTER tenant/venue semantics: venueId is not tenantId", async () => {
        const ok = await listEligibleCourts(client, {
          tenantId: F.TENANT_A,
          clubId: F.CLUB_A,
          clusterId: F.CLUSTER_A,
        });
        assert.equal(ok.ok, true, JSON.stringify(ok));
        const ids = (ok.courts || []).map((row) => row.physicalCourtId);
        assert.ok(ids.includes(F.COURT_A1));
        assert.ok(ids.includes(F.COURT_A2));
        assert.equal(ids.includes(F.COURT_B1), false);

        const venueAsTenant = await listEligibleCourts(client, {
          tenantId: F.VENUE_A,
          clubId: F.CLUB_A,
          clusterId: F.CLUSTER_A,
        });
        assert.equal(venueAsTenant.ok, false);
        assert.ok(
          ["TENANT_MISMATCH", "CLUB_TENANT_MISMATCH", "TENANT_FORBIDDEN"].includes(venueAsTenant.code),
          venueAsTenant.code
        );

        const foreign = await listEligibleCourts(client, {
          tenantId: F.TENANT_B,
          clubId: F.CLUB_A,
          clusterId: F.CLUSTER_A,
        });
        assert.equal(foreign.ok, false);

        const trap = await listEligibleCourts(client, {
          tenantId: F.TENANT_A,
          clubId: F.CLUB_A,
          clusterId: "cluster-trap",
        });
        assert.equal(trap.ok, false, JSON.stringify(trap));
        assert.equal(trap.code, "TENANT_MISMATCH");

        const { rows } = await client.query(
          `SELECT tenant_id, venue_id FROM public.court_clusters WHERE id = $1`,
          [F.CLUSTER_A]
        );
        assert.equal(rows[0].tenant_id, F.TENANT_A);
        assert.ok(rows[0].venue_id);
        const { rows: trapRow } = await client.query(
          `SELECT tenant_id, venue_id FROM public.court_clusters WHERE id = 'cluster-trap'`
        );
        assert.equal(trapRow[0].venue_id, F.TENANT_A);
        assert.equal(trapRow[0].tenant_id, F.TENANT_B);
        assert.notEqual(trapRow[0].tenant_id, trapRow[0].venue_id);

        const unresolved = await client.query(
          `SELECT count(*)::int AS n FROM public.court_clusters WHERE nullif(btrim(tenant_id), '') IS NULL`
        );
        assert.equal(unresolved.rows[0].n, 0);
      });

      await t.test("B9-CUTOVER remains false after certification", async () => {
        assert.equal(await cutoverEnabled(client), false);
      });
    });

    await t.test("B9-CONC real DB concurrency: exactly one winner", async () => {
      const races = [
        ["booking", "daily", 1],
        ["booking", "maintenance", 2],
        ["internal", "official", 3],
        ["team", "maintenance", 4],
      ];
      await withSafeClients(databaseUrl, 2, async ([left, right]) => {
        await setActor(left, F.SUPER);
        await setActor(right, F.SUPER);
        for (const [a, b, offset] of races) {
          const win = windowOnDay(22, 10 + offset, 11 + offset);
          const [first, second] = await Promise.all([
            take(left, a, {
              physicalCourtId: F.COURT_A1,
              physicalCourtIds: [F.COURT_A1],
              requestId: `conc-${offset}-${a}`,
              ownerId: `${a}-conc-${offset}`,
              ...win,
            }),
            take(right, b, {
              physicalCourtId: F.COURT_A1,
              physicalCourtIds: [F.COURT_A1],
              requestId: `conc-${offset}-${b}`,
              ownerId: `${b}-conc-${offset}`,
              ...win,
            }),
          ]);
          const wins = [first, second].filter((row) => row?.ok === true);
          const losses = [first, second].filter((row) => row?.ok === false);
          assert.equal(wins.length, 1, JSON.stringify({ a, b, first, second }));
          assert.equal(losses.length, 1);
          assert.equal(conflictCode(losses[0]), true, losses[0]?.code);
        }
      });
    });
  } finally {
    await boot.stop();
  }
});
