/**
 * Phase 4D Daily Play interval authority — local disposable PostgreSQL.
 * Never connects to Staging qyewbxjsiiyufanzcjcq or Production expuvcohlcjzvrrauvud.
 *
 * Opt-in:
 *   COURT_RESOURCE_PHASE3B_ENABLE_REAL_POSTGRES=1
 *   COURT_RESOURCE_PHASE3B_DATABASE_URL=postgresql://.../cr_p3b_*
 * OR auto-boot embedded-postgres when ENABLE=1 and no URL (local only).
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import {
  FORBIDDEN_HOST_MARKERS,
  assertSafePhase3bDatabaseUrl,
  execSql,
  isPhase3bRealPostgresEnabled,
  withSafeClient,
} from "./helpers/court-resource-phase3b-postgres.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pkg3b = path.join(
  root,
  "docs/v5/migrations/court-resource-phase3b-canonical-reservation-01"
);
const pkg4d = path.join(
  root,
  "docs/v5/migrations/court-resource-phase3b-daily-play-interval-authority-01"
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
const TOURNAMENT = "44444444-4444-4444-8444-444444444444";

function readSql(dir, name) {
  return fs.readFileSync(path.join(dir, name), "utf8");
}

/** Strip full-line -- comments so splitSqlStatements does not break on ';' inside them. */
function stripLineComments(sql) {
  return sql
    .split(/\r?\n/)
    .map((line) => (/^\s*--/.test(line) ? "" : line))
    .join("\n");
}

async function execSqlFile(client, sql) {
  await execSql(client, stripLineComments(sql));
}

async function maybeBootEmbeddedPostgres() {
  if (process.env.COURT_RESOURCE_PHASE3B_DATABASE_URL) {
    return { databaseUrl: process.env.COURT_RESOURCE_PHASE3B_DATABASE_URL, stop: async () => {} };
  }
  let EmbeddedPostgres;
  try {
    ({ default: EmbeddedPostgres } = await import("embedded-postgres"));
  } catch {
    return null;
  }
  const dataDir = path.join(root, ".tmp-cr-p3b-pg-4d");
  fs.rmSync(dataDir, { recursive: true, force: true });
  fs.mkdirSync(dataDir, { recursive: true });
  const port = 55432;
  const server = new EmbeddedPostgres({
    databaseDir: dataDir,
    user: "postgres",
    password: "postgres",
    port,
    persistent: false,
  });
  await server.initialise();
  await server.start();
  await server.createDatabase("cr_p3b_phase4d");
  const databaseUrl = `postgresql://postgres:postgres@127.0.0.1:${port}/cr_p3b_phase4d`;
  return {
    databaseUrl,
    stop: async () => {
      try {
        await server.stop();
      } catch {
        /* ignore */
      }
      fs.rmSync(dataDir, { recursive: true, force: true });
    },
  };
}

async function setActor(client) {
  await client.query("SELECT set_config('request.jwt.claim.sub', $1, false)", [ACTOR]);
  await client.query(`INSERT INTO auth.users(id) VALUES ($1) ON CONFLICT DO NOTHING`, [ACTOR]);
  await client.query(
    `INSERT INTO public.profiles(id, role, venue_id, club_id, status)
     VALUES ($1, 'SUPER_ADMIN', $2, $3, 'active')
     ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, venue_id = EXCLUDED.venue_id,
       club_id = EXCLUDED.club_id, status = 'active'`,
    [ACTOR, TENANT, CLUB]
  );
}

async function seedIdentity(client) {
  await client.query(
    `INSERT INTO public.venues(id, name, timezone) VALUES ($1, 'Venue A', 'UTC')
     ON CONFLICT (id) DO UPDATE SET timezone = EXCLUDED.timezone`,
    [TENANT]
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

async function installPhase3bBase(client) {
  await client.query("DROP SCHEMA IF EXISTS public CASCADE");
  await client.query("CREATE SCHEMA public");
  await client.query("GRANT ALL ON SCHEMA public TO public");
  await client.query("DROP SCHEMA IF EXISTS auth CASCADE");
  await execSqlFile(client, fs.readFileSync(bootstrapPath, "utf8"));
  await execSqlFile(client, readSql(phase3aDir, "02_APPLY.sql"));
  for (const name of [
    "court_assert_available.sql",
    "daily_play_assign_court.sql",
    "daily_play_change_court.sql",
    "daily_play_submit_score.sql",
    "daily_play_cancel_match.sql",
    "daily_play_close_session.sql",
  ]) {
    await execSqlFile(
      client,
      fs.readFileSync(path.join(pkg3b, "preapply-baseline", name), "utf8")
    );
  }
  await execSqlFile(client, readSql(pkg3b, "01_PRECHECK.sql"));
  await execSqlFile(client, readSql(pkg3b, "02_APPLY.sql"));
  await execSqlFile(client, readSql(pkg3b, "03_VERIFY.sql"));
}

async function enableCutover(client) {
  await client.query(
    `UPDATE public.court_resource_reservation_cutover SET enabled = true
     WHERE cutover_id = 'canonical-reservation-phase3b'`
  );
}

async function disableCutover(client) {
  await client.query(
    `UPDATE public.court_resource_reservation_cutover SET enabled = false
     WHERE cutover_id = 'canonical-reservation-phase3b'`
  );
}

async function acquire(client, args) {
  const { rows } = await client.query(
    `SELECT public.court_resource_daily_play_acquire($1,$2,$3::uuid,$4,$5,$6) AS result`,
    [
      args.tenantId ?? TENANT,
      args.clubId ?? CLUB,
      args.tournamentId ?? TOURNAMENT,
      args.matchId,
      args.courtId,
      args.requestId,
    ]
  );
  return rows[0].result;
}

async function reserveBooking(client, args) {
  const { rows } = await client.query(
    `SELECT public.court_resource_reserve($1,$2,$3::uuid[],$4,$5,$6,$7::timestamptz,$8::timestamptz,$9) AS result`,
    [
      TENANT,
      CLUB,
      args.physicalCourtIds,
      "booking",
      args.ownerId,
      null,
      args.startsAt,
      args.endsAt,
      args.requestId,
    ]
  );
  return rows[0].result;
}

test("Phase 4D forbids Staging/Production database URLs", () => {
  for (const marker of ["qyewbxjsiiyufanzcjcq", "expuvcohlcjzvrrauvud"]) {
    const url = `postgresql://postgres:x@db.${marker}.supabase.co:5432/cr_p3b_x`;
    assert.equal(assertSafePhase3bDatabaseUrl(url).ok, false, marker);
  }
  for (const marker of FORBIDDEN_HOST_MARKERS) {
    assert.ok(typeof marker === "string");
  }
});

test("Phase 4D local PostgreSQL interval authority matrix", { timeout: 300000 }, async (t) => {
  if (!isPhase3bRealPostgresEnabled() && !process.env.COURT_RESOURCE_PHASE4D_ENABLE_EMBEDDED_POSTGRES) {
    // Auto-enable embedded path for local authoring recert when package present.
    process.env.COURT_RESOURCE_PHASE4D_ENABLE_EMBEDDED_POSTGRES = "1";
  }

  const boot = await maybeBootEmbeddedPostgres();
  if (!boot) {
    t.skip("REAL_POSTGRES_NOT_AVAILABLE");
    return;
  }

  const gate = assertSafePhase3bDatabaseUrl(boot.databaseUrl);
  if (!gate.ok) {
    await boot.stop();
    assert.fail(`REAL_POSTGRES_UNSAFE reason=${gate.reason}`);
  }

  try {
    await withSafeClient(boot.databaseUrl, async (client) => {
      await installPhase3bBase(client);
      await seedIdentity(client);
      await setActor(client);

      // 4D package round-trip with cutover false for apply/verify gates.
      await disableCutover(client);
      await execSqlFile(client, readSql(pkg4d, "01_PRECHECK.sql"));
      await execSqlFile(client, readSql(pkg4d, "02_APPLY.sql"));
      await execSqlFile(client, readSql(pkg4d, "03_VERIFY.sql"));

      // A/B/C — first acquire persists window; later wall-clock retry reuses exact interval.
      await enableCutover(client);
      const first = await acquire(client, {
        matchId: "m-interval-1",
        courtId: "c01",
        requestId: "dp-req-1",
      });
      assert.equal(first.ok, true, JSON.stringify(first));
      assert.ok(first.capacityStartsAt, "capacityStartsAt");
      assert.ok(first.capacityEndsAt, "capacityEndsAt");
      const start1 = String(first.capacityStartsAt);
      const end1 = String(first.capacityEndsAt);

      await client.query(`SELECT pg_sleep(1.05)`);
      const retry = await acquire(client, {
        matchId: "m-interval-1",
        courtId: "c01",
        requestId: "dp-req-1",
      });
      assert.equal(retry.ok, true, JSON.stringify(retry));
      assert.equal(String(retry.capacityStartsAt), start1);
      assert.equal(String(retry.capacityEndsAt), end1);
      assert.equal(retry.replay, true);
      assert.notEqual(retry.code, "IDEMPOTENCY_CONFLICT");

      const { rows: winRows } = await client.query(
        `SELECT count(*)::int AS n,
                min(capacity_starts_at) AS s,
                min(capacity_ends_at) AS e
         FROM public.daily_play_court_capacity_windows
         WHERE match_id = 'm-interval-1' AND court_id = 'c01'`
      );
      assert.equal(winRows[0].n, 1);
      assert.equal(String(winRows[0].s.toISOString()), new Date(start1).toISOString());
      assert.equal(String(winRows[0].e.toISOString()), new Date(end1).toISOString());

      // G — Booking overlapping active Daily Play hold rejected.
      const overlapBook = await reserveBooking(client, {
        physicalCourtIds: [COURT01],
        ownerId: "bk-overlap",
        requestId: "book-overlap-1",
        startsAt: start1,
        endsAt: new Date(new Date(start1).getTime() + 60 * 60 * 1000).toISOString(),
      });
      assert.equal(overlapBook.ok, false, JSON.stringify(overlapBook));
      assert.equal(overlapBook.code, "FOREIGN_RESERVATION_CONFLICT");

      // H — Booking after Daily Play release allowed.
      await client.query(
        `SELECT public.court_resource_daily_play_release_match($1,$2::uuid,$3,$4)`,
        [TENANT, TOURNAMENT, "m-interval-1", "test_release"]
      );
      const afterReleaseBook = await reserveBooking(client, {
        physicalCourtIds: [COURT01],
        ownerId: "bk-after",
        requestId: "book-after-1",
        startsAt: start1,
        endsAt: new Date(new Date(start1).getTime() + 60 * 60 * 1000).toISOString(),
      });
      assert.equal(afterReleaseBook.ok, true, JSON.stringify(afterReleaseBook));
      await client.query(
        `SELECT public.court_resource_release($1,$2::uuid[],'booking','bk-after',NULL,'rel-after-1','cleanup')`,
        [TENANT, afterReleaseBook.reservationIds]
      );

      // I — future booking beyond capacity end allowed while hold active on other match.
      const second = await acquire(client, {
        matchId: "m-interval-2",
        courtId: "c02",
        requestId: "dp-req-2",
      });
      assert.equal(second.ok, true, JSON.stringify(second));
      const futureStart = new Date(new Date(second.capacityEndsAt).getTime() + 60 * 60 * 1000);
      const futureEnd = new Date(futureStart.getTime() + 60 * 60 * 1000);
      const futureBook = await reserveBooking(client, {
        physicalCourtIds: [COURT02],
        ownerId: "bk-future",
        requestId: "book-future-1",
        startsAt: futureStart.toISOString(),
        endsAt: futureEnd.toISOString(),
      });
      assert.equal(futureBook.ok, true, JSON.stringify(futureBook));
      await client.query(
        `SELECT public.court_resource_daily_play_release_match($1,$2::uuid,$3,$4)`,
        [TENANT, TOURNAMENT, "m-interval-2", "test_release_2"]
      );
      await client.query(
        `SELECT public.court_resource_release($1,$2::uuid[],'booking','bk-future',NULL,'rel-future-1','cleanup')`,
        [TENANT, futureBook.reservationIds]
      );

      // D — change-court path: new court gets its own persisted window (hold starts at change).
      const changeAcquire = await acquire(client, {
        matchId: "m-change",
        courtId: "c01",
        requestId: "dp-change-1",
      });
      assert.equal(changeAcquire.ok, true, JSON.stringify(changeAcquire));
      await client.query(`SELECT pg_sleep(0.2)`);
      const changeTarget = await acquire(client, {
        matchId: "m-change",
        courtId: "c02",
        requestId: "dp-change-2",
      });
      assert.equal(changeTarget.ok, true, JSON.stringify(changeTarget));
      assert.ok(changeTarget.capacityStartsAt);
      assert.notEqual(
        String(changeTarget.capacityStartsAt),
        String(changeAcquire.capacityStartsAt)
      );

      // E/F — release match clears active canonical hold (close/cancel paths share release RPC).
      await client.query(
        `SELECT public.court_resource_daily_play_release_match($1,$2::uuid,$3,$4)`,
        [TENANT, TOURNAMENT, "m-change", "daily_play_cancel_match"]
      );
      const { rows: stale } = await client.query(
        `SELECT count(*)::int AS n FROM public.court_resource_reservations
         WHERE owner_type = 'daily_play' AND owner_sub_type = 'm-change' AND status = 'active'`
      );
      assert.equal(stale[0].n, 0);

      // No arbitrary 12h in live acquire def.
      const { rows: defRows } = await client.query(
        `SELECT pg_get_functiondef(
           'public.court_resource_daily_play_acquire(text,text,uuid,text,text,text)'::regprocedure
         ) AS def`
      );
      assert.equal(defRows[0].def.includes("12 hours"), false);

      // Rollback round-trip then re-apply.
      await disableCutover(client);
      await execSqlFile(client, readSql(pkg4d, "04_ROLLBACK.sql"));
      const { rows: afterRb } = await client.query(
        `SELECT
           (to_regclass('public.daily_play_court_capacity_windows') IS NULL) AS windows_gone,
           (pg_get_functiondef(
              'public.court_resource_daily_play_acquire(text,text,uuid,text,text,text)'::regprocedure
            ) ILIKE '%now() + interval ''12 hours''%') AS pre4d_restored,
           (to_regclass('public.court_resource_reservations') IS NOT NULL) AS phase3b_intact`
      );
      assert.equal(afterRb[0].windows_gone, true);
      assert.equal(afterRb[0].pre4d_restored, true);
      assert.equal(afterRb[0].phase3b_intact, true);

      await execSqlFile(client, readSql(pkg4d, "01_PRECHECK.sql"));
      await execSqlFile(client, readSql(pkg4d, "02_APPLY.sql"));
      await execSqlFile(client, readSql(pkg4d, "03_VERIFY.sql"));

      const { rows: cut } = await client.query(
        `SELECT enabled FROM public.court_resource_reservation_cutover
         WHERE cutover_id = 'canonical-reservation-phase3b'`
      );
      assert.equal(cut[0].enabled, false);
    });
  } finally {
    await boot.stop();
  }
});
