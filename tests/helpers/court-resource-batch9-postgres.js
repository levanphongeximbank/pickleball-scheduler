/**
 * Isolated PostgreSQL harness for Batch 9 cross-module capacity certification.
 * Never connects to Staging qyewbxjsiiyufanzcjcq or Production expuvcohlcjzvrrauvud.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

import {
  assertSafePhase3bDatabaseUrl,
  execSql,
} from "./court-resource-phase3b-postgres.js";

export {
  FORBIDDEN_HOST_MARKERS,
  assertSafePhase3bDatabaseUrl,
  execSql,
  isPhase3bRealPostgresEnabled,
  withSafeClient,
  withSafeClients,
} from "./court-resource-phase3b-postgres.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

export const BATCH9_ROOT = root;

export const PKG = Object.freeze({
  phase3a: "docs/v5/migrations/court-resource-post427-canonical-reconciliation-01",
  phase3b: "docs/v5/migrations/court-resource-phase3b-canonical-reservation-01",
  d4: "docs/v5/migrations/court-resource-phase3b-daily-play-interval-authority-01",
  batch1: "docs/v5/migrations/court-resource-canonical-inventory-read-01",
  batch2: "docs/v5/migrations/court-resource-canonical-owner-reservation-read-01",
  batch3: "docs/v5/migrations/court-resource-canonical-booking-lifecycle-01",
  batch4: "docs/v5/migrations/court-resource-canonical-resource-blocks-01",
  batch7: "docs/v5/migrations/court-operations-live-resource-runtime-01",
  batch8: "docs/v5/migrations/court-operations-legacy-isolation-01",
});

export const CERTIFIED_PACKAGE_HASHES = Object.freeze({
  phase3a: {
    "01_PRECHECK.sql": "872E0CEC98FEEB442572C70E9C2602FADF0C835C030BCEBBE3E6CEBB020F1637",
    "02_APPLY.sql": "53C6A9EF7EE88FA9A90B3684D15CDF2B91BEB183FCA6D73306BFC0D4DCB265FA",
    "03_VERIFY.sql": "BDE5342AD6CAE44B7482F9B80C9392B3794F762B2665CDB7D885E9CC12B85996",
    "04_ROLLBACK.sql": "93ABA92D6883874DDFEF0F7600238ECD8D5BCD8B83716CF887235B0801A47FA6",
  },
  phase3b: {
    "01_PRECHECK.sql": "528A482CC77EDEA38DC35B9A5323E00B82C4C25894D06B15A27B1E422FE8B13C",
    "02_APPLY.sql": "61418ABABBB6B12CF1E956822573154D7588D59C14B9D9603A867C464A87B032",
    "03_VERIFY.sql": "7766F80784EE0724626C7D7BF6C4EFF5185D7F1CC59C42F0113DC25400C18934",
    "04_ROLLBACK.sql": "43E39245D3698ED21565AE43C2322A64A474122E51730BAABA7B9A5AAC280898",
  },
  d4: {
    "01_PRECHECK.sql": "29011AE97747835174CD47B3E5DAC2F4C25E89A1ECF620C3781475B0DAA64478",
    "02_APPLY.sql": "15BA263207B2EE871C3860CFD61F0E810A591D31AFB4A5B3D95FA3C13A166F0B",
    "03_VERIFY.sql": "73E30440FB61E63DF87A1D036B28B69FC3F68C75BA491C798B9722DD6BC6B580",
    "04_ROLLBACK.sql": "7E537191E6B3F4EFA8D13BEA1F22B5B2F12BFEEFF2A00F375BAD6F9AAF7DF8CB",
  },
  batch1: {
    "01_PRECHECK.sql": "C4BE47CA6E2C43A15780334900BC656C7F2214886190DBA7B8FE8E19A01A0A42",
    "02_APPLY.sql": "8CBA799C88FE9F7FD8B33CDD7DE9B623A054A4644E0E83353D28CB357318CDE1",
    "03_VERIFY.sql": "DA8EBA268697EE75FA4B6BB0088635CA9486EB908C55E05D9903961251609177",
    "04_ROLLBACK.sql": "5B97DE5664CEEE974D870D326524BE3AB69F0BB600C2347FC0384F02B60A6A8D",
  },
  batch2: {
    "01_PRECHECK.sql": "4A3858932D8E4990459505101C7BB8BEFE63D4C68AADF2D8475C6146778DEC21",
    "02_APPLY.sql": "9B13B0A976E5264B9AFCD5F02BCD53AB8F060E211ACF90CCB44D34A961321C92",
    "03_VERIFY.sql": "1306CBCDB5EE3FA5290E4FF39DFD1BD0673738979A689DB3CC947F11B5B60F0D",
    "04_ROLLBACK.sql": "C9B5F56FBBA96C41526E75637E96A79C8F16E3BFA8A0F4B46A0A8886951EF52E",
  },
  batch3: {
    "01_PRECHECK.sql": "B028499D1869EDF2EBF00ADF5BF294D301D03DC66E03B6C41085E1A68B0825B2",
    "02_APPLY.sql": "ACDFC0A7EEC0D4DC07C810CDC4C5D7927120C07AB3B0394D649D83BBCB5C288B",
    "03_VERIFY.sql": "35286678926B73F6E1DC6C494391147D7FB34DB260B404414BEDADC661ABA0E0",
    "04_ROLLBACK.sql": "357F3BF6FFF4F17E53E9E88C173AD799CD41D542AF18243D7BB868EFE997A51F",
  },
  batch4: {
    "01_PRECHECK.sql": "46BF059A42656F1C7A5C9ED6F612C42DB7A31DD6AB16A82BEAD7E5DD21D742BC",
    "02_APPLY.sql": "E887EADD6462CFEAA8977F0376B86DFF21ACEDE741EE4E3EFC83B793E50F267A",
    "03_VERIFY.sql": "0FAEC984F70884DEC002F438D07DD569265C439F9AD78E974765606DD6488C0E",
    "04_ROLLBACK.sql": "F7C05B207BA385DD2D2832C71DA47743DDB8C75D93836771317009FC9DBFFAD1",
  },
  batch7: {
    "01_PRECHECK.sql": "752CB6DD4C972D01C7DF38A9917A6270D7FAADA1C0C0A55299A41C073E52DBD3",
    "02_APPLY.sql": "3805FA2B2FFFAC7AAD85EA813AEE9BE5A82F42DC5D5EF3185C4BF313568507BD",
    "03_VERIFY.sql": "F931213B17851E12BB7348C7E371732E9C72C3B7DD4FFC1A594CBA6838C0FC52",
    "04_ROLLBACK.sql": "E6377FADC482D55AB135635D2C505FE97638534B2F6C431A8DDA5E250D6EDF08",
  },
  batch8: {
    "01_PRECHECK.sql": "EBEA1D1CDE4D00AEAD530F7ECCFC090558A36430DD2BC82FE4EC91129487BAB0",
    "02_APPLY.sql": "8C05737355B09925D71CC4177192FBB521630927917D88999F2E5E2FADFAD9ED",
    "03_VERIFY.sql": "7F559C7FC0C54F6288C16FC89CE99C06157A6709D6D762DA52C22BC969563D5F",
    "04_ROLLBACK.sql": "923FBA4483A7A4DCD7DF44EC6F8AEC343AE6D7EB176FD7BC501188D28ADDE2C2",
  },
});

export const HEAD_A_CONTRACT_SHA256 =
  "B3DC18602C5AEE63CD565622FFADD6388F3DFBA38A21056570F3BD7526BB5CE6";

export const FIXTURE = Object.freeze({
  TENANT_A: "tenant-a",
  TENANT_B: "tenant-b",
  VENUE_A: "venue-a",
  VENUE_B: "venue-b",
  CLUB_A: "club-a",
  CLUB_B: "club-b",
  CLUB_NO_ACCESS: "club-a-no-access",
  CLUB_DISABLED: "club-a-disabled",
  CLUSTER_A: "cluster-a",
  CLUSTER_B: "cluster-b",
  COURT_A1: "11111111-1111-4111-8111-111111111111",
  COURT_A2: "22222222-2222-4222-8222-222222222222",
  COURT_B1: "33333333-3333-4333-8333-333333333333",
  SUPER: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  OP_A: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  OP_B: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
});

export const T0 = "2026-09-01T18:00:00.000Z";
export const T1 = "2026-09-01T19:00:00.000Z";
export const T2 = "2026-09-01T20:00:00.000Z";
export const T3 = "2026-09-01T21:00:00.000Z";

export function windowOnDay(day, startHour, endHour) {
  const d = String(day).padStart(2, "0");
  const s = String(startHour).padStart(2, "0");
  const e = String(endHour).padStart(2, "0");
  return {
    startsAt: `2026-09-${d}T${s}:00:00.000Z`,
    endsAt: `2026-09-${d}T${e}:00:00.000Z`,
  };
}

export function stripLineComments(sql) {
  return sql
    .split(/\r?\n/)
    .map((line) => (/^\s*--/.test(line) ? "" : line))
    .join("\n");
}

export function readSql(relDir, name) {
  return fs.readFileSync(path.join(root, relDir, name), "utf8");
}

export async function execSqlFile(client, sql) {
  await execSql(client, stripLineComments(sql));
}

export function isBatch9RealPostgresEnabled() {
  const flag = String(
    process.env.COURT_RESOURCE_BATCH9_ENABLE_REAL_POSTGRES
      || process.env.COURT_RESOURCE_PHASE3B_ENABLE_REAL_POSTGRES
      || ""
  )
    .trim()
    .toLowerCase();
  return flag === "1" || flag === "true" || Boolean(process.env.COURT_RESOURCE_PHASE3B_DATABASE_URL);
}

async function waitForPostgres(databaseUrl, attempts = 60) {
  let lastError = null;
  for (let i = 0; i < attempts; i += 1) {
    const client = new pg.Client({ connectionString: databaseUrl });
    try {
      await client.connect();
      await client.query("SELECT 1");
      await client.end();
      return;
    } catch (error) {
      lastError = error;
      await client.end().catch(() => {});
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
  throw lastError || new Error("postgres_wait_timeout");
}

async function tryDockerPostgres() {
  const docker = spawnSync("docker", ["--version"], { encoding: "utf8" });
  if (docker.status !== 0) return null;
  spawnSync("docker", ["rm", "-f", "cr-p3b-batch9"], { encoding: "utf8" });
  const run = spawnSync(
    "docker",
    [
      "run",
      "--rm",
      "-d",
      "--name",
      "cr-p3b-batch9",
      "-e",
      "POSTGRES_PASSWORD=postgres",
      "-e",
      "POSTGRES_DB=cr_p3b_batch9",
      "-p",
      "55433:5432",
      "postgres:16-alpine",
    ],
    { encoding: "utf8" }
  );
  if (run.status !== 0) {
    const fallback = spawnSync(
      "docker",
      [
        "run",
        "--rm",
        "-d",
        "--name",
        "cr-p3b-batch9",
        "-e",
        "POSTGRES_PASSWORD=postgres",
        "-e",
        "POSTGRES_DB=cr_p3b_batch9",
        "-p",
        "55433:5432",
        "postgres:16",
      ],
      { encoding: "utf8" }
    );
    if (fallback.status !== 0) return null;
  }
  const databaseUrl = "postgresql://postgres:postgres@127.0.0.1:55433/cr_p3b_batch9";
  const gate = assertSafePhase3bDatabaseUrl(databaseUrl);
  if (!gate.ok) {
    spawnSync("docker", ["rm", "-f", "cr-p3b-batch9"], { encoding: "utf8" });
    throw new Error(`PHASE3B_DB_SAFETY_GATE:${gate.reason}`);
  }
  await waitForPostgres(databaseUrl);
  return {
    databaseUrl,
    environment: "docker-local-postgres:16/cr_p3b_batch9",
    stop: async () => {
      spawnSync("docker", ["rm", "-f", "cr-p3b-batch9"], { encoding: "utf8" });
    },
  };
}

async function tryEmbeddedPostgres() {
  let EmbeddedPostgres;
  try {
    ({ default: EmbeddedPostgres } = await import("embedded-postgres"));
  } catch {
    return null;
  }
  const dataDir = path.join(root, ".tmp-cr-p3b-pg-batch9");
  fs.rmSync(dataDir, { recursive: true, force: true });
  fs.mkdirSync(dataDir, { recursive: true });
  const port = 55434;
  const server = new EmbeddedPostgres({
    databaseDir: dataDir,
    user: "postgres",
    password: "postgres",
    port,
    persistent: false,
    initdbFlags: ["--encoding=UTF8", "--locale=C"],
  });
  await server.initialise();
  await server.start();
  await server.createDatabase("cr_p3b_batch9");
  const databaseUrl = `postgresql://postgres:postgres@127.0.0.1:${port}/cr_p3b_batch9`;
  return {
    databaseUrl,
    environment: "embedded-postgres-local/cr_p3b_batch9",
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

export async function bootIsolatedPostgres() {
  if (process.env.COURT_RESOURCE_PHASE3B_DATABASE_URL) {
    const databaseUrl = process.env.COURT_RESOURCE_PHASE3B_DATABASE_URL;
    const gate = assertSafePhase3bDatabaseUrl(databaseUrl);
    if (!gate.ok) {
      throw new Error(`PHASE3B_DB_SAFETY_GATE:${gate.reason}`);
    }
    return {
      databaseUrl,
      environment: "env-COURT_RESOURCE_PHASE3B_DATABASE_URL",
      stop: async () => {},
    };
  }
  const docker = await tryDockerPostgres().catch(() => null);
  if (docker) return docker;
  const embedded = await tryEmbeddedPostgres().catch(() => null);
  if (embedded) return embedded;
  return null;
}

export async function applyPackage(client, relDir, { precheck = true, verify = true } = {}) {
  if (precheck) {
    await execSqlFile(client, readSql(relDir, "01_PRECHECK.sql"));
  }
  await execSqlFile(client, readSql(relDir, "02_APPLY.sql"));
  if (verify) {
    await execSqlFile(client, readSql(relDir, "03_VERIFY.sql"));
  }
}

export async function installCanonicalStack(client) {
  await client.query("SET client_encoding TO 'UTF8'");
  await client.query("DROP SCHEMA IF EXISTS public CASCADE");
  await client.query("CREATE SCHEMA public");
  await client.query("GRANT ALL ON SCHEMA public TO public");
  await client.query("DROP SCHEMA IF EXISTS auth CASCADE");
  await execSqlFile(
    client,
    fs.readFileSync(path.join(root, "tests/fixtures/court-resource-phase3b-bootstrap.sql"), "utf8")
  );
  await execSqlFile(client, readSql(PKG.phase3a, "02_APPLY.sql"));
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
      fs.readFileSync(path.join(root, PKG.phase3b, "preapply-baseline", name), "utf8")
    );
  }
  await applyPackage(client, PKG.phase3b);
  await applyPackage(client, PKG.batch1);
  await applyPackage(client, PKG.batch2);
  await applyPackage(client, PKG.batch3);
  await applyPackage(client, PKG.batch4);
  await applyPackage(client, PKG.batch7);
  await applyPackage(client, PKG.batch8);
}

export async function setActor(client, actorId, { role = "SUPER_ADMIN", venueId, clubId } = {}) {
  await client.query("SELECT set_config('request.jwt.claim.sub', $1, false)", [actorId]);
  await client.query(`INSERT INTO auth.users(id) VALUES ($1) ON CONFLICT DO NOTHING`, [actorId]);
  await client.query(
    `INSERT INTO public.profiles(id, role, venue_id, club_id, status)
     VALUES ($1, $2, $3, $4, 'active')
     ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, venue_id = EXCLUDED.venue_id,
       club_id = EXCLUDED.club_id, status = 'active'`,
    [actorId, role, venueId ?? FIXTURE.TENANT_A, clubId ?? FIXTURE.CLUB_A]
  );
}

export async function seedBatch9Fixtures(client) {
  const F = FIXTURE;
  await client.query(
    `INSERT INTO public.venues(id, name, timezone) VALUES
       ($1, 'Tenant A org', 'UTC'),
       ($2, 'Tenant B org', 'UTC'),
       ($3, 'Venue A', 'UTC'),
       ($4, 'Venue B', 'UTC')
     ON CONFLICT (id) DO UPDATE SET timezone = EXCLUDED.timezone`,
    [F.TENANT_A, F.TENANT_B, F.VENUE_A, F.VENUE_B]
  );
  await client.query(
    `INSERT INTO public.clubs(id, tenant_id, name) VALUES
       ($1, $5, 'Club A'),
       ($2, $6, 'Club B'),
       ($3, $5, 'Club A no access'),
       ($4, $5, 'Club A disabled')
     ON CONFLICT (id) DO NOTHING`,
    [F.CLUB_A, F.CLUB_B, F.CLUB_NO_ACCESS, F.CLUB_DISABLED, F.TENANT_A, F.TENANT_B]
  );
  await client.query(
    `INSERT INTO public.court_clusters(id, venue_id, tenant_id, name) VALUES
       ($1, $3, $3, 'Cluster A'),
       ($2, $4, $4, 'Cluster B'),
       ('cluster-trap', $3, $4, 'Trap cluster: venue looks like tenant A, tenant_id is B')
     ON CONFLICT (id) DO UPDATE SET tenant_id = EXCLUDED.tenant_id, venue_id = EXCLUDED.venue_id`,
    [F.CLUSTER_A, F.CLUSTER_B, F.TENANT_A, F.TENANT_B]
  );
  await client.query(
    `INSERT INTO public.court_resource_physical_courts(
       physical_court_id, tenant_id, cluster_id, display_name
     ) VALUES ($1, $2, $3, 'Court A1')
     ON CONFLICT DO NOTHING`,
    [F.COURT_A1, F.TENANT_A, F.CLUSTER_A]
  );
  await client.query(
    `INSERT INTO public.court_resource_physical_courts(
       physical_court_id, tenant_id, cluster_id, display_name
     ) VALUES ($1, $2, $3, 'Court A2')
     ON CONFLICT DO NOTHING`,
    [F.COURT_A2, F.TENANT_A, F.CLUSTER_A]
  );
  await client.query(
    `INSERT INTO public.court_resource_physical_courts(
       physical_court_id, tenant_id, cluster_id, display_name
     ) VALUES ($1, $2, $3, 'Court B1')
     ON CONFLICT DO NOTHING`,
    [F.COURT_B1, F.TENANT_B, F.CLUSTER_B]
  );
  await client.query(
    `INSERT INTO public.court_resource_club_operational_access(
       tenant_id, club_id, physical_court_id, status
     ) VALUES
       ($1, $3, $5, 'enabled'),
       ($1, $3, $6, 'enabled'),
       ($2, $4, $7, 'enabled')
     ON CONFLICT DO NOTHING`,
    [F.TENANT_A, F.TENANT_B, F.CLUB_A, F.CLUB_B, F.COURT_A1, F.COURT_A2, F.COURT_B1]
  );
  await client.query(
    `INSERT INTO public.court_resource_club_operational_access(
       tenant_id, club_id, physical_court_id, status, revoked_at, reason
     ) VALUES ($1, $2, $3, 'disabled', now(), 'disabled operational access')
     ON CONFLICT DO NOTHING`,
    [F.TENANT_A, F.CLUB_DISABLED, F.COURT_A1]
  );
  await client.query(
    `INSERT INTO public.court_resource_legacy_court_identity_mappings(
       tenant_id, club_id, source_system, source_version, legacy_cluster_id,
       legacy_court_id, physical_court_id, classification, resolved_at
     ) VALUES
       ($1, $3, 'club-data-v3', '3', $5, 'c01', $7, 'deterministic', now()),
       ($1, $3, 'club-data-v3', '3', $5, 'c02', $8, 'deterministic', now()),
       ($1, $4, 'club-data-v3', '3', $5, 'blob-claimed-a1', $7, 'deterministic', now()),
       ($2, $6, 'club-data-v3', '3', $9, 'c-b1', $10, 'deterministic', now())
     ON CONFLICT DO NOTHING`,
    [
      F.TENANT_A,
      F.TENANT_B,
      F.CLUB_A,
      F.CLUB_NO_ACCESS,
      F.CLUSTER_A,
      F.CLUB_B,
      F.COURT_A1,
      F.COURT_A2,
      F.CLUSTER_B,
      F.COURT_B1,
    ]
  );
  await setActor(client, F.SUPER, {
    role: "SUPER_ADMIN",
    venueId: F.TENANT_A,
    clubId: F.CLUB_A,
  });
  await setActor(client, F.OP_A, {
    role: "CLUB_ADMIN",
    venueId: F.TENANT_A,
    clubId: F.CLUB_A,
  });
  await setActor(client, F.OP_B, {
    role: "CLUB_ADMIN",
    venueId: F.TENANT_B,
    clubId: F.CLUB_B,
  });
}

export async function rpc(client, sql, params) {
  const { rows } = await client.query(sql, params);
  return rows[0]?.result ?? rows[0];
}

export async function reserveCapacity(client, args) {
  return rpc(
    client,
    `SELECT public.court_resource_reserve($1,$2,$3::uuid[],$4,$5,$6,$7::timestamptz,$8::timestamptz,$9) AS result`,
    [
      args.tenantId ?? FIXTURE.TENANT_A,
      args.clubId ?? FIXTURE.CLUB_A,
      args.physicalCourtIds,
      args.ownerType,
      args.ownerId,
      args.ownerSubType ?? null,
      args.startsAt,
      args.endsAt,
      args.requestId,
    ]
  );
}

export async function releaseCapacity(client, args) {
  return rpc(
    client,
    `SELECT public.court_resource_release($1,$2::uuid[],$3,$4,$5::uuid[],$6,$7) AS result`,
    [
      args.tenantId ?? FIXTURE.TENANT_A,
      args.reservationIds ?? null,
      args.ownerType,
      args.ownerId,
      args.physicalCourtIds ?? null,
      args.requestId,
      args.releaseReason ?? "released",
    ]
  );
}

export async function getAvailability(client, args) {
  return rpc(
    client,
    `SELECT public.court_resource_get_availability($1,$2,$3::uuid[],$4::timestamptz,$5::timestamptz,$6,$7) AS result`,
    [
      args.tenantId ?? FIXTURE.TENANT_A,
      args.clubId ?? FIXTURE.CLUB_A,
      args.physicalCourtIds,
      args.startsAt,
      args.endsAt,
      args.ownerType ?? null,
      args.ownerId ?? null,
    ]
  );
}

export async function listEligibleCourts(client, args) {
  return rpc(
    client,
    `SELECT public.court_resource_list_eligible_courts($1,$2,$3) AS result`,
    [args.tenantId ?? FIXTURE.TENANT_A, args.clubId ?? FIXTURE.CLUB_A, args.clusterId ?? null]
  );
}

export async function createBooking(client, args) {
  return rpc(
    client,
    `SELECT public.court_operations_booking_create($1,$2,$3::uuid,$4::timestamptz,$5::timestamptz,$6,$7::jsonb) AS result`,
    [
      args.tenantId ?? FIXTURE.TENANT_A,
      args.clubId ?? FIXTURE.CLUB_A,
      args.physicalCourtId,
      args.startsAt,
      args.endsAt,
      args.requestId,
      JSON.stringify(args.payload ?? { customerName: "Alice", bookingType: "single" }),
    ]
  );
}

export async function rescheduleBooking(client, args) {
  return rpc(
    client,
    `SELECT public.court_operations_booking_reschedule($1,$2::uuid,$3::uuid,$4::timestamptz,$5::timestamptz,$6,$7,$8::jsonb) AS result`,
    [
      args.tenantId ?? FIXTURE.TENANT_A,
      args.bookingId,
      args.physicalCourtId,
      args.startsAt,
      args.endsAt,
      args.expectedVersion,
      args.requestId,
      JSON.stringify(args.payload ?? {}),
    ]
  );
}

export async function transferBooking(client, args) {
  return rpc(
    client,
    `SELECT public.court_operations_booking_transfer_court($1,$2::uuid,$3::uuid,$4,$5) AS result`,
    [
      args.tenantId ?? FIXTURE.TENANT_A,
      args.bookingId,
      args.newPhysicalCourtId,
      args.expectedVersion,
      args.requestId,
    ]
  );
}

export async function cancelBooking(client, args) {
  return rpc(
    client,
    `SELECT public.court_operations_booking_cancel($1,$2::uuid,$3,$4) AS result`,
    [
      args.tenantId ?? FIXTURE.TENANT_A,
      args.bookingId,
      args.requestId,
      args.releaseReason ?? "booking_cancelled",
    ]
  );
}

export async function createResourceBlock(client, args) {
  return rpc(
    client,
    `SELECT public.court_operations_resource_block_create($1,$2,$3::uuid,$4::timestamptz,$5::timestamptz,$6,$7::jsonb) AS result`,
    [
      args.tenantId ?? FIXTURE.TENANT_A,
      args.clubId ?? FIXTURE.CLUB_A,
      args.physicalCourtId,
      args.startsAt,
      args.endsAt,
      args.requestId,
      JSON.stringify({
        blockType: args.blockType ?? "MAINTENANCE",
        reason: args.reason ?? "certification",
      }),
    ]
  );
}

export async function rescheduleResourceBlock(client, args) {
  return rpc(
    client,
    `SELECT public.court_operations_resource_block_reschedule($1,$2::uuid,$3::uuid,$4::timestamptz,$5::timestamptz,$6,$7,$8::jsonb) AS result`,
    [
      args.tenantId ?? FIXTURE.TENANT_A,
      args.resourceBlockId,
      args.physicalCourtId,
      args.startsAt,
      args.endsAt,
      args.expectedVersion,
      args.requestId,
      JSON.stringify(args.payload ?? {}),
    ]
  );
}

export async function transferResourceBlock(client, args) {
  return rpc(
    client,
    `SELECT public.court_operations_resource_block_transfer_court($1,$2::uuid,$3::uuid,$4,$5) AS result`,
    [
      args.tenantId ?? FIXTURE.TENANT_A,
      args.resourceBlockId,
      args.newPhysicalCourtId,
      args.expectedVersion,
      args.requestId,
    ]
  );
}

export async function cancelResourceBlock(client, args) {
  return rpc(
    client,
    `SELECT public.court_operations_resource_block_cancel($1,$2::uuid,$3,$4) AS result`,
    [
      args.tenantId ?? FIXTURE.TENANT_A,
      args.resourceBlockId,
      args.requestId,
      args.releaseReason ?? "resource_block_cancelled",
    ]
  );
}

export async function beginLiveSession(client, args) {
  return rpc(
    client,
    `SELECT public.court_operations_live_begin_resource_session($1,$2::uuid,$3,$4,$5,$6,$7::uuid,$8,$9) AS result`,
    [
      args.tenantId ?? FIXTURE.TENANT_A,
      args.physicalCourtId,
      args.sourceType,
      args.sourceId,
      args.reservationRef ?? null,
      args.requestId,
      args.actorId ?? FIXTURE.SUPER,
      args.operationsAuthorized ?? false,
      args.capacityClaimValid ?? true,
    ]
  );
}

export async function endLiveSession(client, args) {
  return rpc(
    client,
    `SELECT public.court_operations_live_end_resource_session($1,$2::uuid,$3::uuid,$4,$5,$6,$7::uuid) AS result`,
    [
      args.tenantId ?? FIXTURE.TENANT_A,
      args.physicalCourtId,
      args.resourceSessionId,
      args.sourceType,
      args.sourceId,
      args.requestId,
      args.actorId ?? FIXTURE.SUPER,
    ]
  );
}

export async function setOperationalState(client, args) {
  return rpc(
    client,
    `SELECT public.court_operations_live_set_operational_state($1,$2::uuid,$3,$4,$5,$6::uuid) AS result`,
    [
      args.tenantId ?? FIXTURE.TENANT_A,
      args.physicalCourtId,
      args.operationalState,
      args.reason ?? "certification",
      args.requestId,
      args.actorId ?? FIXTURE.SUPER,
    ]
  );
}

export async function countActiveReservations(client, args = {}) {
  const { rows } = await client.query(
    `SELECT count(*)::int AS n
     FROM public.court_resource_reservations
     WHERE status = 'active'
       AND ($1::text IS NULL OR tenant_id = $1)
       AND ($2::uuid IS NULL OR physical_court_id = $2)
       AND ($3::timestamptz IS NULL OR tstzrange(starts_at, ends_at, '[)') && tstzrange($3::timestamptz, $4::timestamptz, '[)'))`,
    [args.tenantId ?? null, args.physicalCourtId ?? null, args.startsAt ?? null, args.endsAt ?? null]
  );
  return rows[0].n;
}

export async function countAllReservations(client, args = {}) {
  const { rows } = await client.query(
    `SELECT count(*)::int AS n
     FROM public.court_resource_reservations
     WHERE ($1::text IS NULL OR tenant_id = $1)
       AND ($2::uuid IS NULL OR physical_court_id = $2)`,
    [args.tenantId ?? null, args.physicalCourtId ?? null]
  );
  return rows[0].n;
}

export async function cutoverEnabled(client) {
  const { rows } = await client.query(
    `SELECT enabled FROM public.court_resource_reservation_cutover
     WHERE cutover_id = 'canonical-reservation-phase3b'`
  );
  return rows[0]?.enabled === true;
}

const OWNER = {
  booking: { kind: "booking" },
  daily: { kind: "reserve", ownerType: "daily_play", ownerSubType: "daily_play" },
  internal: { kind: "reserve", ownerType: "competition", ownerSubType: "internal" },
  official: { kind: "reserve", ownerType: "competition", ownerSubType: "official_open" },
  team: { kind: "reserve", ownerType: "competition", ownerSubType: "team" },
  maintenance: { kind: "block", blockType: "MAINTENANCE" },
  operations: { kind: "block", blockType: "OPERATIONAL_BLOCK" },
};

export function ownerSpec(type) {
  const spec = OWNER[type];
  if (!spec) throw new Error(`unknown_owner_type:${type}`);
  return spec;
}

export async function acquireOwner(client, type, args) {
  const spec = ownerSpec(type);
  const courtId = args.physicalCourtId || (args.physicalCourtIds || [])[0];
  const ownerId = args.ownerId || `${type}-${args.requestId}`;
  if (spec.kind === "booking") {
    return createBooking(client, { ...args, physicalCourtId: courtId });
  }
  if (spec.kind === "block") {
    return createResourceBlock(client, {
      ...args,
      physicalCourtId: courtId,
      blockType: spec.blockType,
    });
  }
  return reserveCapacity(client, {
    ...args,
    physicalCourtIds: args.physicalCourtIds || [courtId],
    ownerType: spec.ownerType,
    ownerSubType: spec.ownerSubType,
    ownerId,
  });
}

export function isClosedFailure(result) {
  return result?.ok === false && typeof result?.code === "string" && result.code.length > 0;
}

export function conflictCode(result) {
  return result?.code === "FOREIGN_RESERVATION_CONFLICT";
}
