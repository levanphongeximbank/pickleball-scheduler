/**
 * Real PostgreSQL acceptance for Court Resource Phase 3B.
 * Ordinary unit CI skips unless COURT_RESOURCE_PHASE3B_ENABLE_REAL_POSTGRES=1
 * or COURT_RESOURCE_PHASE3B_DATABASE_URL is a local cr_p3b_* database.
 * Never connects to Staging qyewbxjsiiyufanzcjcq or Production expuvcohlcjzvrrauvud.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import {
  FORBIDDEN_HOST_MARKERS,
  assertSafePhase3bDatabaseUrl,
  dropPgcryptoDigestByteaText,
  execSql,
  installPgcryptoInSchema,
  isPhase3bRealPostgresEnabled,
  withSafeClient,
  withSafeClients,
} from "./helpers/court-resource-phase3b-postgres.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pkgDir = path.join(
  root,
  "docs/v5/migrations/court-resource-phase3b-canonical-reservation-01"
);
const phase3aDir = path.join(
  root,
  "docs/v5/migrations/court-resource-post427-canonical-reconciliation-01"
);
const bootstrapPath = path.join(
  root,
  "tests/fixtures/court-resource-phase3b-bootstrap.sql"
);

const TENANT = "tenant-a";
const CLUB = "club-a";
const CLUSTER = "cluster-a";
const COURT01 = "11111111-1111-4111-8111-111111111111";
const COURT02 = "22222222-2222-4222-8222-222222222222";
const ACTOR = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

function readSql(dir, name) {
  return fs.readFileSync(path.join(dir, name), "utf8");
}

async function setActor(client, { superAdmin = true, venueId = TENANT, clubId = CLUB } = {}) {
  await client.query("SELECT set_config('request.jwt.claim.sub', $1, false)", [ACTOR]);
  await client.query(
    `INSERT INTO auth.users(id) VALUES ($1) ON CONFLICT DO NOTHING`,
    [ACTOR]
  );
  await client.query(
    `INSERT INTO public.profiles(id, role, venue_id, club_id, status)
     VALUES ($1, $2, $3, $4, 'active')
     ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, venue_id = EXCLUDED.venue_id,
       club_id = EXCLUDED.club_id, status = 'active'`,
    [ACTOR, superAdmin ? "SUPER_ADMIN" : "PLAYER", venueId, clubId]
  );
}

async function seedIdentity(client) {
  await client.query(
    `INSERT INTO public.venues(id, name) VALUES ($1, 'Venue A') ON CONFLICT DO NOTHING`,
    [TENANT]
  );
  await client.query(
    `INSERT INTO public.venues(id, name) VALUES ('tenant-b', 'Venue B') ON CONFLICT DO NOTHING`
  );
  await client.query(
    `INSERT INTO public.clubs(id, tenant_id, name) VALUES ($1, $2, 'Club A') ON CONFLICT DO NOTHING`,
    [CLUB, TENANT]
  );
  await client.query(
    `INSERT INTO public.court_clusters(id, venue_id, name)
     VALUES ($1, $2, 'Cluster A') ON CONFLICT DO NOTHING`,
    [CLUSTER, TENANT]
  );
  await client.query(
    `INSERT INTO public.court_resource_physical_courts(
       physical_court_id, tenant_id, cluster_id, display_name
     ) VALUES ($1, $2, $3, 'Court 01'), ($4, $2, $3, 'Court 02')
     ON CONFLICT DO NOTHING`,
    [COURT01, TENANT, CLUSTER, COURT02]
  );
  await client.query(
    `INSERT INTO public.court_resource_club_operational_access(
       tenant_id, club_id, physical_court_id, status
     ) VALUES ($1, $2, $3, 'enabled'), ($1, $2, $4, 'enabled')
     ON CONFLICT DO NOTHING`,
    [TENANT, CLUB, COURT01, COURT02]
  );
  await client.query(
    `INSERT INTO public.court_resource_legacy_court_identity_mappings(
       tenant_id, club_id, source_system, source_version, legacy_cluster_id,
       legacy_court_id, physical_court_id, classification, resolved_at
     ) VALUES
       ($1, $2, 'club-data-v3', '3', $3, 'c01', $4, 'deterministic', now()),
       ($1, $2, 'club-data-v3', '3', $3, 'c02', $5, 'deterministic', now())
     ON CONFLICT DO NOTHING`,
    [TENANT, CLUB, CLUSTER, COURT01, COURT02]
  );
}

async function reserve(client, args) {
  const { rows } = await client.query(
    `SELECT public.court_resource_reserve($1,$2,$3::uuid[],$4,$5,$6,$7::timestamptz,$8::timestamptz,$9) AS result`,
    [
      args.tenantId ?? TENANT,
      args.clubId ?? CLUB,
      args.physicalCourtIds,
      args.ownerType,
      args.ownerId,
      args.ownerSubType ?? null,
      args.startsAt,
      args.endsAt,
      args.requestId,
    ]
  );
  return rows[0].result;
}

async function availability(client, args) {
  const { rows } = await client.query(
    `SELECT public.court_resource_get_availability($1,$2,$3::uuid[],$4::timestamptz,$5::timestamptz,$6,$7) AS result`,
    [
      args.tenantId ?? TENANT,
      args.clubId ?? CLUB,
      args.physicalCourtIds,
      args.startsAt,
      args.endsAt,
      args.ownerType ?? null,
      args.ownerId ?? null,
    ]
  );
  return rows[0].result;
}

async function release(client, args) {
  const { rows } = await client.query(
    `SELECT public.court_resource_release($1,$2::uuid[],$3,$4,$5::uuid[],$6,$7) AS result`,
    [
      args.tenantId ?? TENANT,
      args.reservationIds ?? null,
      args.ownerType,
      args.ownerId,
      args.physicalCourtIds ?? null,
      args.requestId,
      args.releaseReason ?? "released",
    ]
  );
  return rows[0].result;
}

test("Phase 3B real-postgres safety gate forbids Staging/Production refs", () => {
  for (const marker of FORBIDDEN_HOST_MARKERS) {
    if (!["expuvcohlcjzvrrauvud", "qyewbxjsiiyufanzcjcq", "supabase.co"].includes(marker)) {
      continue;
    }
    const url = `postgresql://postgres:x@db.${marker}.supabase.co:5432/postgres`;
    const gate = assertSafePhase3bDatabaseUrl(url);
    assert.equal(gate.ok, false, marker);
  }
});

test("Phase 3B real PostgreSQL acceptance A-P", { timeout: 180000 }, async (t) => {
  if (!isPhase3bRealPostgresEnabled()) {
    t.skip("REAL_POSTGRES_NOT_OPTED_IN (set COURT_RESOURCE_PHASE3B_ENABLE_REAL_POSTGRES=1)");
    return;
  }
  const databaseUrl = process.env.COURT_RESOURCE_PHASE3B_DATABASE_URL;
  const gate = assertSafePhase3bDatabaseUrl(databaseUrl || "");
  if (!gate.ok) {
    assert.fail(`REAL_POSTGRES_UNAVAILABLE reason=${gate.reason}`);
  }

  await withSafeClient(databaseUrl, async (client) => {
    await client.query("DROP SCHEMA IF EXISTS public CASCADE");
    await client.query("CREATE SCHEMA public");
    await client.query("GRANT ALL ON SCHEMA public TO public");
    await client.query("DROP SCHEMA IF EXISTS auth CASCADE");
    await execSql(client, fs.readFileSync(bootstrapPath, "utf8"));
    await execSql(client, readSql(phase3aDir, "02_APPLY.sql"));
    for (const name of [
      "court_assert_available.sql",
      "daily_play_assign_court.sql",
      "daily_play_change_court.sql",
      "daily_play_submit_score.sql",
      "daily_play_cancel_match.sql",
      "daily_play_close_session.sql",
    ]) {
      await execSql(
        client,
        fs.readFileSync(path.join(pkgDir, "preapply-baseline", name), "utf8")
      );
    }
    await execSql(client, readSql(pkgDir, "01_PRECHECK.sql"));
    await execSql(client, readSql(pkgDir, "02_APPLY.sql"));
    await execSql(client, readSql(pkgDir, "03_VERIFY.sql"));

    await seedIdentity(client);
    await setActor(client);

    const windowA = {
      startsAt: "2026-08-15T10:00:00Z",
      endsAt: "2026-08-15T11:00:00Z",
    };
    const windowOverlap = {
      startsAt: "2026-08-15T10:30:00Z",
      endsAt: "2026-08-15T11:30:00Z",
    };

    const booking = await reserve(client, {
      physicalCourtIds: [COURT01],
      ownerType: "booking",
      ownerId: "bk-1",
      requestId: "req-a",
      ...windowA,
    });
    assert.equal(booking.ok, true, JSON.stringify(booking));

    const foreignCompetition = await reserve(client, {
      physicalCourtIds: [COURT01],
      ownerType: "competition",
      ownerId: "t-foreign",
      requestId: "req-a-foreign",
      ...windowOverlap,
    });
    assert.equal(foreignCompetition.ok, false);
    assert.equal(foreignCompetition.code, "FOREIGN_RESERVATION_CONFLICT");

    const replay = await reserve(client, {
      physicalCourtIds: [COURT01],
      ownerType: "booking",
      ownerId: "bk-1",
      requestId: "req-a",
      ...windowA,
    });
    assert.equal(replay.ok, true);
    assert.equal(replay.replay, true);

    const idempotencyConflict = await reserve(client, {
      physicalCourtIds: [COURT02],
      ownerType: "booking",
      ownerId: "bk-1",
      requestId: "req-a",
      ...windowA,
    });
    assert.equal(idempotencyConflict.ok, false);
    assert.equal(idempotencyConflict.code, "IDEMPOTENCY_CONFLICT");

    const own = await availability(client, {
      physicalCourtIds: [COURT01],
      ownerType: "booking",
      ownerId: "bk-1",
      ...windowA,
    });
    assert.equal(own.ok, true);
    assert.equal(own.courts[0].status, "OWN_RESERVATION");

    const other = await availability(client, {
      physicalCourtIds: [COURT01],
      ownerType: "competition",
      ownerId: "t-other",
      ...windowA,
    });
    assert.equal(other.courts[0].status, "FOREIGN_RESERVATION");

    const court2 = await reserve(client, {
      physicalCourtIds: [COURT02],
      ownerType: "booking",
      ownerId: "bk-2",
      requestId: "req-g",
      ...windowA,
    });
    assert.equal(court2.ok, true);

    const clusterOnly = await reserve(client, {
      physicalCourtIds: [],
      ownerType: "booking",
      ownerId: "bk-h",
      requestId: "req-h",
      ...windowA,
    });
    assert.equal(clusterOnly.ok, false);

    const windowF = {
      startsAt: "2026-08-18T10:00:00Z",
      endsAt: "2026-08-18T11:00:00Z",
    };
    await withSafeClients(databaseUrl, 2, async ([left, right]) => {
      await setActor(left);
      await setActor(right);
      const [first, second] = await Promise.all([
        reserve(left, {
          physicalCourtIds: [COURT01],
          ownerType: "booking",
          ownerId: "bk-f-left",
          requestId: "req-f-left",
          ...windowF,
        }),
        reserve(right, {
          physicalCourtIds: [COURT01],
          ownerType: "competition",
          ownerId: "t-f-right",
          requestId: "req-f-right",
          ...windowF,
        }),
      ]);
      const wins = [first, second].filter((row) => row?.ok === true);
      const losses = [first, second].filter((row) => row?.ok === false);
      assert.equal(wins.length, 1, JSON.stringify({ first, second }));
      assert.equal(losses.length, 1);
    });

    const noAccess = await reserve(client, {
      clubId: "missing-club",
      physicalCourtIds: [COURT01],
      ownerType: "booking",
      ownerId: "bk-no-access",
      requestId: "req-i",
      startsAt: "2026-08-15T12:00:00Z",
      endsAt: "2026-08-15T13:00:00Z",
    });
    assert.equal(noAccess.ok, false);
    assert.ok(["OUT_OF_SCOPE", "INVALID_INPUT", "MISSING_CLUB_ID"].includes(noAccess.code));

    await client.query(
      `INSERT INTO public.court_resource_physical_courts(
         physical_court_id, tenant_id, cluster_id, display_name
       ) VALUES ('33333333-3333-4333-8333-333333333333', 'tenant-b', $1, 'Other')
       ON CONFLICT DO NOTHING`,
      [CLUSTER]
    ).catch(() => {});

    const cross = await reserve(client, {
      physicalCourtIds: ["33333333-3333-4333-8333-333333333333"],
      ownerType: "booking",
      ownerId: "bk-cross",
      requestId: "req-j",
      startsAt: "2026-08-15T12:00:00Z",
      endsAt: "2026-08-15T13:00:00Z",
    });
    assert.equal(cross.ok, false);
    assert.ok(["CROSS_TENANT_COURT", "UNKNOWN_COURT", "OUT_OF_SCOPE"].includes(cross.code));

    const released = await release(client, {
      ownerType: "booking",
      ownerId: "bk-1",
      requestId: "rel-k",
      physicalCourtIds: [COURT01],
    });
    assert.equal(released.ok, true);

    const { rows: history } = await client.query(
      `SELECT status FROM public.court_resource_reservations
       WHERE owner_id = 'bk-1' AND physical_court_id = $1`,
      [COURT01]
    );
    assert.ok(history.length >= 1);
    assert.ok(history.every((row) => row.status !== "active") || history.some((row) => row.status === "released"));

    const afterRelease = await reserve(client, {
      physicalCourtIds: [COURT01],
      ownerType: "competition",
      ownerId: "t-after",
      requestId: "req-k2",
      ...windowA,
    });
    assert.equal(afterRelease.ok, true);

    const afterReleaseAvail = await availability(client, {
      physicalCourtIds: [COURT01],
      ownerType: "competition",
      ownerId: "t-after",
      ...windowA,
    });
    assert.equal(afterReleaseAvail.courts[0].status, "OWN_RESERVATION");

    await release(client, {
      ownerType: "competition",
      ownerId: "t-after",
      requestId: "rel-before-dp",
      physicalCourtIds: [COURT01],
    });
    await release(client, {
      ownerType: "booking",
      ownerId: "bk-2",
      requestId: "rel-before-dp-2",
      physicalCourtIds: [COURT02],
    });

    await client.query(
      `UPDATE public.court_resource_reservation_cutover SET enabled = true
       WHERE cutover_id = 'canonical-reservation-phase3b'`
    );

    const l1Hold = await reserve(client, {
      physicalCourtIds: [COURT02],
      ownerType: "booking",
      ownerId: "bk-l1",
      requestId: "req-l1",
      startsAt: new Date().toISOString(),
      endsAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    });
    assert.equal(l1Hold.ok, true, JSON.stringify(l1Hold));
    const dpBlocked = await client.query(
      `SELECT public.court_resource_daily_play_acquire($1,$2,$3::uuid,$4,$5,$6) AS result`,
      [TENANT, CLUB, "55555555-5555-4555-8555-555555555555", "m-l1", "c02", "dp-l1"]
    );
    assert.equal(dpBlocked.rows[0].result.ok, false, JSON.stringify(dpBlocked.rows[0].result));
    const l1Release = await release(client, {
      ownerType: "booking",
      ownerId: "bk-l1",
      requestId: "rel-l1",
      physicalCourtIds: [COURT02],
    });
    assert.equal(l1Release.ok, true, JSON.stringify(l1Release));

    const dp = await client.query(
      `SELECT public.court_resource_daily_play_acquire($1,$2,$3::uuid,$4,$5,$6) AS result`,
      [TENANT, CLUB, "44444444-4444-4444-8444-444444444444", "m1", "c01", "dp-1"]
    );
    const dpResult = dp.rows[0].result;
    assert.equal(dpResult.ok, true, JSON.stringify(dpResult));

    const bookingVsDaily = await reserve(client, {
      physicalCourtIds: [COURT01],
      ownerType: "booking",
      ownerId: "bk-vs-dp",
      requestId: "req-l2",
      startsAt: new Date().toISOString(),
      endsAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    });
    assert.equal(bookingVsDaily.ok, false);
    assert.equal(bookingVsDaily.code, "FOREIGN_RESERVATION_CONFLICT");

    await withSafeClients(databaseUrl, 2, async ([left, right]) => {
      await setActor(left);
      await setActor(right);
      const now = new Date();
      const later = new Date(Date.now() + 2 * 60 * 60 * 1000);
      const [dpRace, bookingRace] = await Promise.all([
        left.query(
          `SELECT public.court_resource_daily_play_acquire($1,$2,$3::uuid,$4,$5,$6) AS result`,
          [TENANT, CLUB, "66666666-6666-4666-8666-666666666666", "m-l3", "c02", "dp-l3"]
        ),
        reserve(right, {
          physicalCourtIds: [COURT02],
          ownerType: "booking",
          ownerId: "bk-l3",
          requestId: "req-l3",
          startsAt: now.toISOString(),
          endsAt: later.toISOString(),
        }),
      ]);
      const dpOk = dpRace.rows[0].result?.ok === true;
      const bookingOk = bookingRace?.ok === true;
      assert.equal(
        Number(dpOk) + Number(bookingOk),
        1,
        JSON.stringify({ dp: dpRace.rows[0].result, booking: bookingRace })
      );
    });

    const multi = await reserve(client, {
      physicalCourtIds: [COURT01, COURT02],
      ownerType: "competition",
      ownerId: "t-multi",
      requestId: "req-n",
      startsAt: "2026-08-16T10:00:00Z",
      endsAt: "2026-08-16T11:00:00Z",
    });
    assert.equal(multi.ok, false);

    const foreignRelease = await release(client, {
      ownerType: "booking",
      ownerId: "not-owner",
      reservationIds: afterRelease.reservationIds,
      requestId: "rel-o",
    });
    assert.equal(foreignRelease.ok, false);
    assert.equal(foreignRelease.code, "FOREIGN_OWNER_RELEASE_DENIED");

    const { rows: engineRows } = await client.query(
      `SELECT count(*)::int AS n FROM public.court_resource_reservations
       WHERE owner_type NOT IN ('booking','competition','daily_play','maintenance','operations')`
    );
    assert.equal(engineRows[0].n, 0);

    await client.query(
      `UPDATE public.court_resource_reservations
       SET status = 'cancelled', cancelled_at = now(), updated_at = now()
       WHERE owner_id = 'bk-2' AND status = 'released'`
    );
    await client.query(
      `UPDATE public.court_resource_reservations
       SET status = 'expired', expired_at = now(), updated_at = now()
       WHERE owner_id = 'bk-f-left' AND status = 'active'`
    );
    const { rows: historyLifecycle } = await client.query(
      `SELECT status, count(*)::int AS n
       FROM public.court_resource_reservations
       GROUP BY status`
    );
    const byStatus = Object.fromEntries(historyLifecycle.map((row) => [row.status, row.n]));
    assert.ok((byStatus.released || 0) + (byStatus.cancelled || 0) + (byStatus.expired || 0) >= 1);
    const { rows: stillThere } = await client.query(
      `SELECT count(*)::int AS n FROM public.court_resource_reservations`
    );
    assert.ok(stillThere[0].n >= 1);

    await execSql(client, readSql(pkgDir, "04_ROLLBACK.sql"));
    const { rows: gone } = await client.query(
      `SELECT to_regclass('public.court_resource_reservations') IS NULL AS ok`
    );
    assert.equal(gone[0].ok, true);
    const { rows: phase3a } = await client.query(
      `SELECT to_regclass('public.court_resource_physical_courts') IS NOT NULL AS ok`
    );
    assert.equal(phase3a[0].ok, true);
  });
});

async function resetPublicSchema(client) {
  await client.query("DROP EXTENSION IF EXISTS pgcrypto CASCADE");
  await client.query("DROP SCHEMA IF EXISTS public CASCADE");
  await client.query("CREATE SCHEMA public");
  await client.query("GRANT ALL ON SCHEMA public TO public");
  await client.query("DROP SCHEMA IF EXISTS auth CASCADE");
  await client.query("DROP SCHEMA IF EXISTS extensions CASCADE");
}

async function installPrecheckDependencies(client, { baselineAssignChange = true } = {}) {
  await execSql(client, fs.readFileSync(bootstrapPath, "utf8"));
  await execSql(client, readSql(phase3aDir, "02_APPLY.sql"));
  const names = baselineAssignChange
    ? [
        "court_assert_available.sql",
        "daily_play_assign_court.sql",
        "daily_play_change_court.sql",
        "daily_play_submit_score.sql",
        "daily_play_cancel_match.sql",
        "daily_play_close_session.sql",
      ]
    : ["court_assert_available.sql"];
  for (const name of names) {
    await execSql(
      client,
      fs.readFileSync(path.join(pkgDir, "preapply-baseline", name), "utf8")
    );
  }
}

async function runPrecheck(client) {
  try {
    await execSql(client, readSql(pkgDir, "01_PRECHECK.sql"));
    return { ok: true, message: "" };
  } catch (error) {
    return { ok: false, message: String(error.message || error) };
  }
}

test("Phase 3B PRECHECK pgcrypto portability A-E", { timeout: 180000 }, async (t) => {
  if (!isPhase3bRealPostgresEnabled()) {
    t.skip("REAL_POSTGRES_NOT_OPTED_IN (set COURT_RESOURCE_PHASE3B_ENABLE_REAL_POSTGRES=1)");
    return;
  }
  const databaseUrl = process.env.COURT_RESOURCE_PHASE3B_DATABASE_URL;
  const gate = assertSafePhase3bDatabaseUrl(databaseUrl || "");
  if (!gate.ok) {
    assert.fail(`REAL_POSTGRES_UNAVAILABLE reason=${gate.reason}`);
  }

  await withSafeClient(databaseUrl, async (client) => {
    await resetPublicSchema(client);
    await installPrecheckDependencies(client, { baselineAssignChange: true });
    await installPgcryptoInSchema(client, "extensions");
    const caseA = await runPrecheck(client);
    assert.equal(caseA.ok, true, `CASE A extensions schema: ${caseA.message}`);
    assert.doesNotMatch(caseA.message, /PGCRYPTO_EXTENSION_MISSING|PGCRYPTO_DIGEST_MISSING/);

    await resetPublicSchema(client);
    await installPrecheckDependencies(client, { baselineAssignChange: true });
    await installPgcryptoInSchema(client, "public");
    const caseB = await runPrecheck(client);
    assert.equal(caseB.ok, true, `CASE B public schema: ${caseB.message}`);

    await resetPublicSchema(client);
    await installPrecheckDependencies(client, { baselineAssignChange: true });
    await installPgcryptoInSchema(client, null);
    const caseC = await runPrecheck(client);
    assert.equal(caseC.ok, false);
    assert.match(caseC.message, /PGCRYPTO_EXTENSION_MISSING/);

    await resetPublicSchema(client);
    await installPrecheckDependencies(client, { baselineAssignChange: true });
    await installPgcryptoInSchema(client, "extensions");
    await dropPgcryptoDigestByteaText(client, "extensions");
    const caseD = await runPrecheck(client);
    assert.equal(caseD.ok, false);
    assert.match(caseD.message, /PGCRYPTO_DIGEST_MISSING/);

    await resetPublicSchema(client);
    await installPrecheckDependencies(client, { baselineAssignChange: false });
    await installPgcryptoInSchema(client, "extensions");
    const caseE = await runPrecheck(client);
    assert.equal(caseE.ok, false);
    assert.match(caseE.message, /PREEXISTING_ROUTINE_DRIFT/);
  });
});

async function applyPhase3bPackage(client) {
  await execSql(client, readSql(pkgDir, "01_PRECHECK.sql"));
  await execSql(client, readSql(pkgDir, "02_APPLY.sql"));
  await execSql(client, readSql(pkgDir, "03_VERIFY.sql"));
}

async function callDigestHelper(client, payload = "phase3b-fingerprint") {
  const { rows } = await client.query(
    `SELECT encode(public.court_resource_digest_sha256(convert_to($1, 'UTF8')), 'hex') AS hex`,
    [payload]
  );
  return rows[0].hex;
}

async function countUnqualifiedInstalledDigest(client) {
  const { rows } = await client.query(
    `SELECT count(*)::int AS n
     FROM pg_proc p
     JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
       AND (
         p.proname LIKE 'court_resource%'
         OR p.proname IN (
           'daily_play_assign_court',
           'daily_play_change_court',
           'daily_play_submit_score',
           'daily_play_cancel_match',
           'daily_play_close_session'
         )
       )
       AND pg_get_functiondef(p.oid) ~ '(^|[^A-Za-z0-9_.])digest[[:space:]]*\\('`
  );
  return rows[0].n;
}

test("Phase 3B APPLY/runtime pgcrypto portability A-F", { timeout: 180000 }, async (t) => {
  if (!isPhase3bRealPostgresEnabled()) {
    t.skip("REAL_POSTGRES_NOT_OPTED_IN (set COURT_RESOURCE_PHASE3B_ENABLE_REAL_POSTGRES=1)");
    return;
  }
  const databaseUrl = process.env.COURT_RESOURCE_PHASE3B_DATABASE_URL;
  const gate = assertSafePhase3bDatabaseUrl(databaseUrl || "");
  if (!gate.ok) {
    assert.fail(`REAL_POSTGRES_UNAVAILABLE reason=${gate.reason}`);
  }

  await withSafeClient(databaseUrl, async (client) => {
    await resetPublicSchema(client);
    await installPrecheckDependencies(client, { baselineAssignChange: true });
    await installPgcryptoInSchema(client, "extensions");
    await applyPhase3bPackage(client);
    const { rows: helperCfg } = await client.query(
      `SELECT prosecdef, array_to_string(proconfig, ',') AS proconfig
       FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = 'public' AND p.proname = 'court_resource_digest_sha256'`
    );
    assert.equal(helperCfg[0].prosecdef, true);
    assert.match(helperCfg[0].proconfig, /search_path=pg_catalog, public/i);
    assert.doesNotMatch(helperCfg[0].proconfig, /extensions/i);
    const hexA = await callDigestHelper(client);
    assert.equal(hexA.length, 64);
    await seedIdentity(client);
    await setActor(client);
    const reservedA = await reserve(client, {
      physicalCourtIds: [COURT01],
      ownerType: "booking",
      ownerId: "bk-ext",
      requestId: "req-ext-a",
      startsAt: "2026-08-15T10:00:00Z",
      endsAt: "2026-08-15T11:00:00Z",
    });
    assert.equal(reservedA.ok, true, JSON.stringify(reservedA));
    const replayA = await reserve(client, {
      physicalCourtIds: [COURT01],
      ownerType: "booking",
      ownerId: "bk-ext",
      requestId: "req-ext-a",
      startsAt: "2026-08-15T10:00:00Z",
      endsAt: "2026-08-15T11:00:00Z",
    });
    assert.equal(replayA.ok, true);
    assert.equal(replayA.replay, true);
    const conflictA = await reserve(client, {
      physicalCourtIds: [COURT02],
      ownerType: "booking",
      ownerId: "bk-ext",
      requestId: "req-ext-a",
      startsAt: "2026-08-15T10:00:00Z",
      endsAt: "2026-08-15T11:00:00Z",
    });
    assert.equal(conflictA.ok, false);
    assert.equal(conflictA.code, "IDEMPOTENCY_CONFLICT");
    const releasedA = await release(client, {
      ownerType: "booking",
      ownerId: "bk-ext",
      reservationIds: reservedA.reservationIds,
      requestId: "rel-ext-a",
    });
    assert.equal(releasedA.ok, true, JSON.stringify(releasedA));
    const replayRel = await release(client, {
      ownerType: "booking",
      ownerId: "bk-ext",
      reservationIds: reservedA.reservationIds,
      requestId: "rel-ext-a",
    });
    assert.equal(replayRel.ok, true);
    assert.equal(replayRel.replay, true);
    assert.equal(await countUnqualifiedInstalledDigest(client), 0);

    await resetPublicSchema(client);
    await installPrecheckDependencies(client, { baselineAssignChange: true });
    await installPgcryptoInSchema(client, "public");
    await applyPhase3bPackage(client);
    const hexB = await callDigestHelper(client);
    assert.equal(hexB.length, 64);
    assert.equal(hexB, hexA);
    await seedIdentity(client);
    await setActor(client);
    const reservedB = await reserve(client, {
      physicalCourtIds: [COURT01],
      ownerType: "booking",
      ownerId: "bk-pub",
      requestId: "req-pub-b",
      startsAt: "2026-08-15T10:00:00Z",
      endsAt: "2026-08-15T11:00:00Z",
    });
    assert.equal(reservedB.ok, true, JSON.stringify(reservedB));
    assert.equal(await countUnqualifiedInstalledDigest(client), 0);

    await dropPgcryptoDigestByteaText(client, "public");
    let missingDigest = "";
    try {
      await callDigestHelper(client);
    } catch (error) {
      missingDigest = String(error.message || error);
    }
    assert.match(missingDigest, /PGCRYPTO_DIGEST_MISSING/);

    await resetPublicSchema(client);
    await installPrecheckDependencies(client, { baselineAssignChange: true });
    await installPgcryptoInSchema(client, "extensions");
    await applyPhase3bPackage(client);
    await client.query(
      `ALTER TABLE public.court_resource_reservations ALTER COLUMN reservation_id DROP DEFAULT`
    );
    await client.query(
      `ALTER TABLE public.court_resource_reservation_commands ALTER COLUMN command_id DROP DEFAULT`
    );
    await client.query("DROP EXTENSION IF EXISTS pgcrypto");
    let missingExt = "";
    try {
      await callDigestHelper(client);
    } catch (error) {
      missingExt = String(error.message || error);
    }
    assert.match(missingExt, /PGCRYPTO_EXTENSION_MISSING/);
  });
});

