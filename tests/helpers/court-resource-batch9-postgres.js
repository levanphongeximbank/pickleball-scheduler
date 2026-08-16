/**
 * Isolated PostgreSQL harness for Batch 9 cross-module capacity certification.
 * Never connects to Staging qyewbxjsiiyufanzcjcq or Production expuvcohlcjzvrrauvud.
 */
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
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
  identityGuard:
    "docs/v5/migrations/court-operations-pre-staging-identity-guard-01",
});

/**
 * Certified SQL hashes are LF-normalized (CRLF → LF) so Windows worktrees and
 * Linux CI agree. Always hash via sha256FileLf / sha256TextLf.
 */
export const CERTIFIED_PACKAGE_HASHES = Object.freeze({
  phase3a: {
    "01_PRECHECK.sql": "369DA901AEBA717A85883998CAEDB0EE6ED0E605B9AD9C31BA78D2DEB0A34E98",
    "02_APPLY.sql": "FAF9CFD0F00164316AE57A8FF48AC22117F30E332400B8C0C89B4125473FD9BA",
    "03_VERIFY.sql": "ABE90B9455C019A382D1EA2FFA637C0746B62BEA9A95A762E53D98F9BB319171",
    "04_ROLLBACK.sql": "332C54F17C5AFA5EA44B48E99001191E340F53FD2DC50451F18856A5B8DA4E18",
  },
  phase3b: {
    "01_PRECHECK.sql": "D3C64598EDA13A7823194FACBBC4B6A81F1095682E30E929486C033F0D08E6E8",
    "02_APPLY.sql": "4425311AD18A4F8496E4ED1B024007538FA3E63E9BD7F5F788489406362CB5AE",
    "03_VERIFY.sql": "79C32FF510634314B2E21885352B9F26FBD0B5B942E794C2D06681904E701A20",
    "04_ROLLBACK.sql": "43E39245D3698ED21565AE43C2322A64A474122E51730BAABA7B9A5AAC280898",
  },
  d4: {
    "01_PRECHECK.sql": "5C5DF3B7B6C63AF3DA3C25A85A5A2C9CDE09938CA0B29BF035D0EE677A978D09",
    "02_APPLY.sql": "C2C998F3D0BDAEB605AB004E231FFE3AFCE45E2EB6278509BE3F284E68BBE986",
    "03_VERIFY.sql": "93678A8EE2F8DF0F66D4ADAA0E8A5E2F0EBD17034C0473D69AE0DBF992AC2845",
    "04_ROLLBACK.sql": "166F7B8105CCBE695AF584BB59FBC6D448A0DC37A26EDB9AEBAC8E029AEEFB9B",
  },
  batch1: {
    "01_PRECHECK.sql": "BD908D2570E30D91501336F03CA2FFA985CF68009C16888317404E226BACEA3E",
    "02_APPLY.sql": "5DAE46DD4F0415509A73063F084F7AE14E47F6EF9AA6CBEDA3F48D07D529AEE6",
    "03_VERIFY.sql": "93E9FB7A4B2E13852358D2F0B6DEA725B55331330688750B835E2E703F119264",
    "04_ROLLBACK.sql": "564A4788DFF53E213802CF6E2AD1AEF7A3C0C106B1BB6FC16F880EE5E1F26D9E",
  },
  batch2: {
    "01_PRECHECK.sql": "B803F8185F7545B39566B146D0A85D5A21CAA4ADDEC48026F7E305D162F46392",
    "02_APPLY.sql": "21B37EE93ED8078707E6CD4B7BDF0EC19628C2ADBC1E0CC06D21DD9A541B116A",
    "03_VERIFY.sql": "8360CBA29100DA17CDD11DE439BE1AD57394265F5B048FCD070E80ACDD98E7C8",
    "04_ROLLBACK.sql": "6F3F19C551B7612BDDC2B438A2A08CCAE393A9E3EADCD5B5BCC97188011DE944",
  },
  batch3: {
    "01_PRECHECK.sql": "B028499D1869EDF2EBF00ADF5BF294D301D03DC66E03B6C41085E1A68B0825B2",
    "02_APPLY.sql": "ACDFC0A7EEC0D4DC07C810CDC4C5D7927120C07AB3B0394D649D83BBCB5C288B",
    "03_VERIFY.sql": "35286678926B73F6E1DC6C494391147D7FB34DB260B404414BEDADC661ABA0E0",
    "04_ROLLBACK.sql": "357F3BF6FFF4F17E53E9E88C173AD799CD41D542AF18243D7BB868EFE997A51F",
  },
  batch4: {
    "01_PRECHECK.sql": "0E44A37ED5F25C775155799BA990CCC0EBEBA83C308134CAB3DA9BF558B01915",
    "02_APPLY.sql": "6F18980CFA37EE9D6A9DBF418915FD99EFC34BD53ED9F664492961A82212DB2E",
    "03_VERIFY.sql": "70DFF23E9A6CD92B1D67514314E61FBF2AB0FD7611A91EF0DAC2711AE724AEE6",
    "04_ROLLBACK.sql": "6F83EFFB1BDA34E85B55159F4D585B522DF298074B1F33E5471AAFD1F1C1F6C4",
  },
  batch7: {
    "01_PRECHECK.sql": "9ADFEB37B51E033374A84282343FA8A230F460C072478A1312D6FF3E240EA1AB",
    "02_APPLY.sql": "C133933127F830F3A1643116F485E3708127D8D8DBFBB905A1445EBA4E1A79DC",
    "03_VERIFY.sql": "D3D42B846566168C5E783293611D0DFB05332057C2034E232C87C4F390C14DEC",
    "04_ROLLBACK.sql": "BFF8AB38DD7BDD4A5C7EB52F190DC79799A502C583A819210C5C44901203E29B",
  },
  batch8: {
    "01_PRECHECK.sql": "76676EDC1EDBD8C3D851CA534243C76E2EA8D1124BE099D12CED005DBA89FFA4",
    "02_APPLY.sql": "50CB757351349B391121373DAAD403BB277493557C2C222266BAC6A0BF0AE1A5",
    "03_VERIFY.sql": "EF2FCE3F0C3CA562DCF3177F1050C782326ECF55ED712BCAC889DE04847A9661",
    "04_ROLLBACK.sql": "090E329E23B9A350EAEB0D222F45B05645E942337C731DA4553215DC3696BE88",
  },
  identityGuard: {
    "01_PRECHECK.sql": "02D4D1DFBB6F97093C312EE91562C2C50D5AE1D413E854F5C50A78FDEC71E4F7",
    "02_APPLY.sql": "C37A20EDA981DBBEABAA8639B2332D30D9DB90BDDB067CF6D6A440C25314B537",
    "03_VERIFY.sql": "221171748CFBB71ED72D2C29CF1718B11486A9378232EEB71A294DC13142FB46",
    "04_ROLLBACK.sql": "1E88E9925FC7859D3C1DB06DC08A2BBDD783E57216C368A0DFD7B0057A94E855",
  },
});

export const HEAD_A_CONTRACT_SHA256 =
  "B9F7FE3F36786383A7A1C2027E5D1B93D4917BA9365CA98F88DE96529C4C6B1C";

export function sha256TextLf(text) {
  return createHash("sha256")
    .update(String(text).replace(/\r\n/g, "\n"), "utf8")
    .digest("hex")
    .toUpperCase();
}

export function sha256FileLf(absOrRelPath) {
  const abs = path.isAbsolute(absOrRelPath)
    ? absOrRelPath
    : path.join(root, absOrRelPath);
  return sha256TextLf(fs.readFileSync(abs, "utf8"));
}
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
  const port = 55434;
  // Windows: prior runs can leave the port held and a non-empty data dir.
  spawnSync(
    "powershell",
    [
      "-NoProfile",
      "-Command",
      `Get-NetTCPConnection -LocalPort ${port} -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }; Start-Sleep -Milliseconds 400`,
    ],
    { encoding: "utf8", timeout: 15000 }
  );
  fs.rmSync(dataDir, { recursive: true, force: true });
  fs.mkdirSync(dataDir, { recursive: true });
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
      const killer = setTimeout(() => {
        try {
          spawnSync("powershell", [
            "-NoProfile",
            "-Command",
            `Get-NetTCPConnection -LocalPort ${port} -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }`,
          ], { encoding: "utf8", timeout: 10000 });
        } catch {
          /* ignore */
        }
      }, 8000);
      try {
        await server.stop();
      } catch {
        /* ignore */
      } finally {
        clearTimeout(killer);
      }
      try {
        fs.rmSync(dataDir, { recursive: true, force: true });
      } catch {
        /* ignore locked files on Windows */
      }
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
  await applyPackage(client, PKG.identityGuard);
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
  // Critical: tenantId != venueId on canonical clusters (Batch8 + identity-guard).
  await client.query(
    `INSERT INTO public.court_clusters(id, venue_id, tenant_id, name) VALUES
       ($1, $5, $3, 'Cluster A'),
       ($2, $6, $4, 'Cluster B'),
       ('cluster-trap', $5, $4, 'Trap: venue-A label, tenant_id is B')
     ON CONFLICT (id) DO UPDATE SET tenant_id = EXCLUDED.tenant_id, venue_id = EXCLUDED.venue_id`,
    [F.CLUSTER_A, F.CLUSTER_B, F.TENANT_A, F.TENANT_B, F.VENUE_A, F.VENUE_B]
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
