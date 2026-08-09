/**
 * OPERATION B1B — WP5 real PostgreSQL constraint / RLS / RPC / Boundary-3 tests.
 *
 * Ordinary unit CI must NOT require a database.
 * Real suite runs only when a local disposable DB is provisioned:
 *   OPERATION_B1B_WP5_ENABLE_REAL_POSTGRES=1
 *   or OPERATION_B1B_WP5_DATABASE_URL=postgresql://...@127.0.0.1/.../b1b_wp5_...
 *   or OPERATION_B1B_WP5_AUTO_PROVISION=1
 *
 * Skipped real-DB execution is NOT WP5 PASS evidence.
 */
import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  CERTIFIED_B1_TARGET_LABELS,
  EXPECTED_PRODUCTION_PROJECT_REF,
  FAILURE_CLASSIFICATION_MATRIX,
  FORBIDDEN_REAL_USER_EMAIL,
  REQUIRED_EXPLICIT_EXECUTE_CONFIRMATION,
  createFreshAuthorizationBinding,
  presentLiveAuthority,
  quarantineOneIdentityB1B,
  resetAuthorityConsumptionForTests,
  runBatchQuarantineB1B,
} from "../scripts/operations/production-qa-identity-operation-b1b/lib/index.js";
import { MAX_QUARANTINE_AUTHORITY_QUERIES_PER_PAGE } from "../src/features/player/utils/qaQuarantineAuthorityRead.js";
import {
  IMMUTABLE_FIELDS,
  WP1_FORWARD,
  WP2_FORWARD,
  applyWp1Forward,
  applyWp2Forward,
  asRole,
  assertSafeWp5DatabaseUrl,
  bootstrapWp5Database,
  callRpcJson,
  classifyWp5ConnectionTarget,
  countActiveAuthority,
  createSafeWp5Client,
  detectLocalPostgresCapability,
  expectQueryRejects,
  getProfileStatus,
  isWp5RealPostgresEnabled,
  readServerEvidence,
  repoRoot,
  resetSessionGuc,
  resolveWp5Database,
  sanitizeObservedServerAddr,
  seedProfile,
  sha256Hex,
  uuidFromInt,
} from "./helpers/operation-b1b-wp5-postgres.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const counters = {
  realConstraint: 0,
  realRls: 0,
  realRpc: 0,
  realImmutability: 0,
  serviceRoleImmutability: 0,
  boundary3: 0,
  antiN1: 0,
  regression: 0,
  activatePreexistingRealRpc: 0,
  boundary3CompensationIncomplete: 0,
  consumedAuthorityReuseExact: 0,
};

function bump(key, n = 1) {
  counters[key] += n;
}

const HASH_A = sha256Hex("wp5-allowlist-fixture");
const HASH_S = sha256Hex("wp5-snapshot-fixture");
const BATCH = "bbbbbbbb-cccc-4ddd-8eee-ffffffffffff";
const BATCH2 = "bbbbbbbb-cccc-4ddd-8eee-fffffffffffe";

function prepareArgs(overrides = {}) {
  const id = overrides.profile_id || uuidFromInt(1);
  return {
    p_profile_id: id,
    p_auth_user_id: overrides.auth_user_id || id,
    p_batch_id: overrides.batch_id || BATCH,
    p_allowlist_sha256: overrides.allowlist_sha256 || HASH_A,
    p_snapshot_sha256: overrides.snapshot_sha256 || HASH_S,
    p_reason: overrides.reason || "OPERATION_B1B_WP5_REAL_DB",
    p_original_profile_status: overrides.original_profile_status || "active",
    p_original_auth_banned:
      overrides.original_auth_banned === undefined
        ? false
        : overrides.original_auth_banned,
    p_expected_email: overrides.expected_email || "qa04.wp5@example.local",
    p_allowlist_label: overrides.allowlist_label || "QA-04",
    p_metadata: overrides.metadata || {},
  };
}

async function prepareAsService(client, overrides = {}) {
  await asRole(client, { role: "service_role" });
  const result = await callRpcJson(
    client,
    "qa_quarantine_prepare",
    prepareArgs(overrides)
  );
  await resetSessionGuc(client);
  return result;
}

async function activateAfterBan(client, quarantineId, version) {
  await asRole(client, { role: "service_role" });
  const result = await callRpcJson(
    client,
    "qa_quarantine_activate_after_auth_ban",
    {
      p_quarantine_id: quarantineId,
      p_expected_lifecycle_version: version,
      p_auth_ban_readback_confirmed: true,
    }
  );
  await resetSessionGuc(client);
  return result;
}

async function activatePreexistingBan(client, quarantineId, version) {
  await asRole(client, { role: "service_role" });
  const result = await callRpcJson(
    client,
    "qa_quarantine_activate_preexisting_ban",
    {
      p_quarantine_id: quarantineId,
      p_expected_lifecycle_version: version,
    }
  );
  await resetSessionGuc(client);
  return result;
}

async function getStateAsService(client, quarantineId) {
  await asRole(client, { role: "service_role" });
  const result = await callRpcJson(client, "qa_quarantine_get_state", {
    p_quarantine_id: quarantineId,
  });
  await resetSessionGuc(client);
  return result;
}

async function readAuthorityRow(client, quarantineId) {
  const { rows } = await client.query(
    `SELECT *
     FROM public.qa_identity_quarantines
     WHERE id = $1::uuid`,
    [quarantineId]
  );
  return rows[0] || null;
}

async function recordFailure(client, args) {
  await asRole(client, { role: "service_role" });
  const result = await callRpcJson(
    client,
    "qa_quarantine_record_compensated_failure",
    {
      p_quarantine_id: args.quarantineId,
      p_expected_lifecycle_version: args.version,
      p_target_auth_ban_state: args.targetAuthBanState,
      p_failure_classification: args.classification,
    }
  );
  await resetSessionGuc(client);
  return result;
}

// ---------------------------------------------------------------------------
// Always-on static / safety gates (no DB)
// ---------------------------------------------------------------------------

test("WP5 harness files and merged SQL paths exist", () => {
  assert.ok(
    fs.existsSync(
      path.join(ROOT, "tests/helpers/operation-b1b-wp5-postgres.js")
    )
  );
  assert.ok(
    fs.existsSync(
      path.join(ROOT, "tests/fixtures/operation-b1b-wp5-bootstrap.sql")
    )
  );
  assert.ok(fs.existsSync(path.join(repoRoot(), "docs/v5/operations/production-qa-identity-operation-b1b-remediation/sql", WP1_FORWARD)));
  assert.ok(fs.existsSync(path.join(repoRoot(), "docs/v5/operations/production-qa-identity-operation-b1b-remediation/sql", WP2_FORWARD)));
  const bootstrap = fs.readFileSync(
    path.join(ROOT, "tests/fixtures/operation-b1b-wp5-bootstrap.sql"),
    "utf8"
  );
  assert.match(bootstrap, /profiles_status_check/);
  assert.match(bootstrap, /active.*suspended.*invited/s);
  assert.doesNotMatch(bootstrap, /status\s+IN\s*\([^)]*quarantined/i);
  bump("regression", 4);
});

test("WP5 safety gate rejects Supabase / remote / unscoping URLs", () => {
  const cases = [
    "postgresql://postgres:x@db.expuvcohlcjzvrrauvud.supabase.co:5432/postgres",
    "postgresql://postgres:x@db.qyewbxjsiiyufanzcjcq.supabase.co:5432/postgres",
    "postgresql://postgres:x@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres",
    "postgresql://postgres:x@127.0.0.1:5432/postgres",
    "postgresql://postgres:x@10.0.0.5:5432/b1b_wp5_test",
    "mysql://postgres:x@127.0.0.1:5432/b1b_wp5_test",
  ];
  for (const url of cases) {
    const gate = assertSafeWp5DatabaseUrl(url);
    assert.equal(gate.ok, false, url);
  }
  const ok = assertSafeWp5DatabaseUrl(
    "postgresql://postgres:secret@127.0.0.1:5432/b1b_wp5_disposable"
  );
  assert.equal(ok.ok, true);
  assert.equal(ok.hostClass, "LOCAL_LOOPBACK_OR_DISPOSABLE_DOCKER");
  assert.doesNotMatch(ok.redacted, /secret/);
  bump("regression", cases.length + 2);
});

test("exact-eight / exclusion / anti-N+1 constants retained", () => {
  assert.deepEqual([...CERTIFIED_B1_TARGET_LABELS], [
    "QA-04",
    "QA-05",
    "QA-06",
    "QA-07",
    "QA-08",
    "QA-09",
    "QA-10",
    "QA-11",
  ]);
  assert.equal(FORBIDDEN_REAL_USER_EMAIL, "phase1b-smith@gmail.com");
  assert.equal(MAX_QUARANTINE_AUTHORITY_QUERIES_PER_PAGE, 1);
  bump("antiN1", 1);
  bump("regression", 2);
});

test("createSafeWp5Client refuses unsafe URL before opening socket", () => {
  assert.throws(
    () =>
      createSafeWp5Client(
        "postgresql://x:y@db.expuvcohlcjzvrrauvud.supabase.co:5432/postgres"
      ),
    /WP5_DB_SAFETY_GATE/
  );
  bump("regression");
});

test("connection target classification ignores Docker bridge inet_server_addr", () => {
  const loopbackDockerPublish =
    "postgresql://postgres:secret@127.0.0.1:55432/b1b_wp5_ci_disposable";
  const target = classifyWp5ConnectionTarget(loopbackDockerPublish);
  assert.equal(target.ok, true);
  assert.equal(target.POSTGRES_REMOTE_CONNECTIONS, 0);
  assert.equal(target.POSTGRES_HOST_CLASS, "LOCAL_LOOPBACK_OR_DISPOSABLE_DOCKER");

  // Observed container/bridge address is diagnostic only and must not flip remote.
  const observedBridge = sanitizeObservedServerAddr("172.17.0.2");
  assert.equal(observedBridge, "172.17.0.2");
  assert.equal(target.POSTGRES_REMOTE_CONNECTIONS, 0);

  // Private/RFC1918 hosts remain fail-closed as CONNECTION TARGETS (not whitelisted).
  for (const host of ["172.17.0.2", "10.0.0.5", "192.168.1.10"]) {
    const gate = assertSafeWp5DatabaseUrl(
      `postgresql://postgres:x@${host}:5432/b1b_wp5_test`
    );
    assert.equal(gate.ok, false, host);
    assert.match(gate.reason, /non_local_host/);
    const classified = classifyWp5ConnectionTarget(
      `postgresql://postgres:x@${host}:5432/b1b_wp5_test`
    );
    assert.equal(classified.ok, false, host);
    assert.equal(classified.POSTGRES_REMOTE_CONNECTIONS, 1, host);
  }
  bump("regression", 8);
});

test("readServerEvidence classifies from validated URL, not inet_server_addr", async () => {
  let queried = false;
  const client = {
    async query() {
      queried = true;
      return {
        rows: [
          {
            version: "PostgreSQL 16.4 on x86_64-pc-linux-musl",
            addr: "172.17.0.2",
            db: "b1b_wp5_ci",
            current_user: "postgres",
            session_user: "postgres",
          },
        ],
      };
    },
  };

  const evidence = await readServerEvidence(client, {
    databaseUrl: "postgresql://postgres:x@127.0.0.1:55432/b1b_wp5_ci",
  });
  assert.equal(queried, true);
  assert.equal(evidence.POSTGRES_REAL_SERVER, "YES");
  assert.equal(evidence.POSTGRES_REMOTE_CONNECTIONS, 0);
  assert.equal(evidence.POSTGRES_HOST_CLASS, "LOCAL_LOOPBACK_OR_DISPOSABLE_DOCKER");
  assert.equal(evidence.SUPABASE_CONNECTIONS, 0);
  assert.equal(evidence.POSTGRES_OBSERVED_SERVER_ADDR, "172.17.0.2");
  assert.match(evidence.POSTGRES_VERSION, /PostgreSQL 16/);

  // Missing / unsafe target fail-closed BEFORE querying.
  let queriedUnsafe = false;
  const unsafeClient = {
    async query() {
      queriedUnsafe = true;
      return { rows: [{}] };
    },
  };
  await assert.rejects(
    () => readServerEvidence(unsafeClient, {}),
    /WP5_DB_SAFETY_GATE:missing_database_url/
  );
  assert.equal(queriedUnsafe, false);

  await assert.rejects(
    () =>
      readServerEvidence(unsafeClient, {
        databaseUrl:
          "postgresql://postgres:x@db.expuvcohlcjzvrrauvud.supabase.co:5432/postgres",
      }),
    /WP5_DB_SAFETY_GATE:forbidden_marker/
  );
  assert.equal(queriedUnsafe, false);

  await assert.rejects(
    () =>
      readServerEvidence(unsafeClient, {
        databaseUrl: "postgresql://postgres:x@10.0.0.5:5432/b1b_wp5_test",
      }),
    /WP5_DB_SAFETY_GATE:non_local_host/
  );
  assert.equal(queriedUnsafe, false);

  await assert.rejects(
    () =>
      readServerEvidence(unsafeClient, {
        databaseUrl:
          "postgresql://postgres:x@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres",
      }),
    /WP5_DB_SAFETY_GATE:forbidden_marker/
  );
  assert.equal(queriedUnsafe, false);

  bump("regression", 6);
});

// ---------------------------------------------------------------------------
// Real PostgreSQL suite
// ---------------------------------------------------------------------------

test("WP5 real PostgreSQL constraint/RLS/RPC/Boundary-3 suite", async (t) => {
  // Ordinary unit CI must not provision a database. Explicit opt-in only:
  // OPERATION_B1B_WP5_ENABLE_REAL_POSTGRES=1
  // OPERATION_B1B_WP5_AUTO_PROVISION=1
  // OPERATION_B1B_WP5_DATABASE_URL=postgresql://...@127.0.0.1/.../b1b_wp5_...
  const capability = detectLocalPostgresCapability();
  const optedIn =
    isWp5RealPostgresEnabled() ||
    process.env.OPERATION_B1B_WP5_AUTO_PROVISION === "1" ||
    Boolean(process.env.OPERATION_B1B_WP5_DATABASE_URL);

  if (!optedIn) {
    t.skip(
      "REAL_POSTGRES_NOT_OPTED_IN (set OPERATION_B1B_WP5_ENABLE_REAL_POSTGRES=1 or AUTO_PROVISION=1)"
    );
    return;
  }

  const resolved = await resolveWp5Database();
  if (!resolved.ok) {
    assert.fail(
      `OPERATION_B1B_WP5_BLOCKED_REAL_POSTGRES_RUNTIME_UNAVAILABLE reason=${resolved.reason} docker=${capability.docker} psql=${capability.psql} detail=${resolved.embeddedDetail || resolved.dockerReason || ""}`
    );
  }

  const { databaseUrl, cleanup, provisioner, hostClass } = resolved;
  let client;
  let evidence = null;
  let bootstrapped = false;
  const forwardExecuted = { wp1: false, wp2: false };

  t.after(async () => {
    if (client) {
      try {
        await resetSessionGuc(client);
        await client.end();
      } catch {
        /* ignore */
      }
    }
    if (cleanup) await cleanup();
  });

  await t.test("bootstrap + load merged WP1/WP2 SQL from repository files", async () => {
    const created = createSafeWp5Client(databaseUrl);
    client = created.client;
    await client.connect();
    await client.query("SET client_encoding TO 'UTF8'");
    evidence = await readServerEvidence(client, { databaseUrl });
    assert.equal(evidence.POSTGRES_REAL_SERVER, "YES");
    assert.equal(evidence.POSTGRES_HOST_CLASS, hostClass);
    assert.equal(evidence.SUPABASE_CONNECTIONS, 0);
    assert.equal(evidence.POSTGRES_REMOTE_CONNECTIONS, 0);
    assert.ok(
      evidence.POSTGRES_OBSERVED_SERVER_ADDR == null ||
        typeof evidence.POSTGRES_OBSERVED_SERVER_ADDR === "string"
    );
    assert.match(String(provisioner), /env|docker|embedded/);

    await bootstrapWp5Database(client);
    await applyWp1Forward(client);
    forwardExecuted.wp1 = true;
    await applyWp2Forward(client);
    forwardExecuted.wp2 = true;

    const { rows } = await client.query(`
      SELECT to_regclass('public.qa_identity_quarantines') IS NOT NULL AS tbl,
             to_regprocedure('public.qa_quarantine_prepare(uuid,uuid,uuid,text,text,text,text,boolean,text,text,jsonb)') IS NOT NULL AS prepare_fn
    `);
    assert.equal(rows[0].tbl, true);
    assert.equal(rows[0].prepare_fn, true);
    bootstrapped = true;
    bump("realConstraint", 2);
  });

  function requireBootstrapped() {
    assert.ok(bootstrapped, "bootstrap/WP1/WP2 must succeed before real-DB cases");
  }

  await t.test("A) profiles.status contract + quarantined rejected", async () => {
    requireBootstrapped();
    const id = uuidFromInt(10);
    await seedProfile(client, {
      id,
      email: "status.wp5@example.local",
      status: "active",
    });
    for (const status of ["active", "suspended", "invited"]) {
      await client.query(`UPDATE public.profiles SET status = $1 WHERE id = $2`, [
        status,
        id,
      ]);
      assert.equal(await getProfileStatus(client, id), status);
      bump("realConstraint");
    }
    await expectQueryRejects(
      client,
      `UPDATE public.profiles SET status = 'quarantined' WHERE id = $1`,
      [id],
      /profiles_status_check|check constraint/i
    );
    bump("realConstraint");
  });

  await t.test("B) authority table constraints (real CHECK/unique)", async () => {
    requireBootstrapped();
    const id = uuidFromInt(20);
    await seedProfile(client, {
      id,
      email: "qa04.constraint@example.local",
      status: "active",
    });

    // B1 prepare creates valid pending
    const prepared = await prepareAsService(client, {
      profile_id: id,
      expected_email: "qa04.constraint@example.local",
      allowlist_label: "QA-04",
    });
    assert.equal(prepared.ok, true);
    assert.equal(prepared.code, "prepared");
    assert.equal(await getProfileStatus(client, id), "active");
    bump("realConstraint", 2);
    bump("realRpc");

    // B2 active requires applied/not_required_preexisting
    await expectQueryRejects(
      client,
      `UPDATE public.qa_identity_quarantines
       SET lifecycle_state = 'active', activated_at = now()
       WHERE id = $1`,
      [prepared.quarantine_id],
      /qa_identity_quarantines_active_success_check|check constraint/i
    );
    bump("realConstraint");

    // Activate properly then second active fails unique partial index
    const act = await activateAfterBan(
      client,
      prepared.quarantine_id,
      prepared.lifecycle_version
    );
    assert.equal(act.ok, true);
    bump("realRpc");

    await expectQueryRejects(
      client,
      `INSERT INTO public.qa_identity_quarantines (
         profile_id, auth_user_id, venue_id, batch_id, source_operation,
         allowlist_sha256, snapshot_sha256, lifecycle_state, auth_ban_state,
         reason, created_by, activated_at, lifecycle_version,
         original_profile_status, original_auth_banned, expected_email, allowlist_label
       ) VALUES (
         $1, $1, 'venue-wp5-local', $2, 'OPERATION_B1B',
         $3, $4, 'active', 'applied',
         'dup', 'test', now(), 1,
         'active', false, 'qa04.constraint@example.local', 'QA-05'
       )`,
      [id, BATCH2, HASH_A, HASH_S],
      /qa_identity_quarantines_active_profile_uidx|unique/i
    );
    bump("realConstraint");

    // B4 profile_id != auth_user_id
    const other = uuidFromInt(21);
    await seedProfile(client, {
      id: other,
      email: "other.bind@example.local",
    });
    await expectQueryRejects(
      client,
      `INSERT INTO public.qa_identity_quarantines (
         profile_id, auth_user_id, batch_id, source_operation,
         allowlist_sha256, snapshot_sha256, lifecycle_state, auth_ban_state,
         reason, created_by, lifecycle_version,
         original_profile_status, original_auth_banned, expected_email, allowlist_label
       ) VALUES (
         $1, $2, $3, 'OPERATION_B1B',
         $4, $5, 'pending', 'pending',
         'bind', 'test', 1,
         'active', false, 'qa04.constraint@example.local', 'QA-06'
       )`,
      [id, other, BATCH2, HASH_A, HASH_S],
      /qa_identity_quarantines_identity_bind_check|check constraint/i
    );
    bump("realConstraint");

    // B6 original_profile_status='quarantined'
    await expectQueryRejects(
      client,
      `INSERT INTO public.qa_identity_quarantines (
         profile_id, auth_user_id, batch_id, source_operation,
         allowlist_sha256, snapshot_sha256, lifecycle_state, auth_ban_state,
         reason, created_by, lifecycle_version,
         original_profile_status, original_auth_banned, expected_email, allowlist_label
       ) VALUES (
         $1, $1, $2, 'OPERATION_B1B',
         $3, $4, 'pending', 'pending',
         'bad-status', 'test', 1,
         'quarantined', false, 'other.bind@example.local', 'QA-07'
       )`,
      [other, BATCH2, HASH_A, HASH_S],
      /qa_identity_quarantines_original_status_check|check constraint/i
    );
    bump("realConstraint");

    // B7 invalid lifecycle/auth domains
    await expectQueryRejects(
      client,
      `INSERT INTO public.qa_identity_quarantines (
         profile_id, auth_user_id, batch_id, source_operation,
         allowlist_sha256, snapshot_sha256, lifecycle_state, auth_ban_state,
         reason, created_by, lifecycle_version,
         original_profile_status, original_auth_banned, expected_email, allowlist_label
       ) VALUES (
         $1, $1, $2, 'OPERATION_B1B',
         $3, $4, 'reverted', 'pending',
         'bad-life', 'test', 1,
         'active', false, 'other.bind@example.local', 'QA-08'
       )`,
      [other, BATCH2, HASH_A, HASH_S],
      /qa_identity_quarantines_lifecycle_state_check|check constraint/i
    );
    bump("realConstraint");

    // B5 release consistency: released without release fields fails
    await expectQueryRejects(
      client,
      `UPDATE public.qa_identity_quarantines
       SET lifecycle_state = 'released'
       WHERE id = $1`,
      [prepared.quarantine_id],
      /qa_identity_quarantines_release_consistency_check|check constraint/i
    );
    bump("realConstraint");
  });

  await t.test("C) immutability trigger — ordinary + service_role mandatory", async () => {
    requireBootstrapped();
    const id = uuidFromInt(30);
    await seedProfile(client, {
      id,
      email: "qa05.immut@example.local",
    });
    const prepared = await prepareAsService(client, {
      profile_id: id,
      expected_email: "qa05.immut@example.local",
      allowlist_label: "QA-05",
    });
    assert.equal(prepared.ok, true);
    const qid = prepared.quarantine_id;

    const attempts = [
      ["profile_id", uuidFromInt(31)],
      ["auth_user_id", uuidFromInt(31)],
      ["venue_id", "other-venue"],
      ["batch_id", BATCH2],
      ["source_operation", "TAMPERED"],
      ["original_auth_banned", true],
      ["original_profile_status", "suspended"],
      ["created_by", "tampered"],
      ["reason", "tampered-reason"],
      ["allowlist_sha256", sha256Hex("tamper-a")],
      ["snapshot_sha256", sha256Hex("tamper-s")],
      ["expected_email", "tampered@example.local"],
      ["allowlist_label", "QA-06"],
    ];

    for (const [col, val] of attempts) {
      assert.ok(IMMUTABLE_FIELDS.includes(col) || col === "created_at");
      await expectQueryRejects(
        client,
        `UPDATE public.qa_identity_quarantines SET ${col} = $1 WHERE id = $2`,
        [val, qid],
        /QA_IDENTITY_QUARANTINE_IMMUTABLE_FIELD/
      );
      bump("realImmutability");
    }

    // created_at separate
    await expectQueryRejects(
      client,
      `UPDATE public.qa_identity_quarantines SET created_at = now() - interval '1 day' WHERE id = $1`,
      [qid],
      /QA_IDENTITY_QUARANTINE_IMMUTABLE_FIELD/
    );
    bump("realImmutability");

    // service_role: merged contract revokes direct DML
    await resetSessionGuc(client);
    await asRole(client, { role: "service_role" });
    await expectQueryRejects(
      client,
      `UPDATE public.qa_identity_quarantines SET reason = 'x' WHERE id = $1::uuid`,
      [qid],
      /permission denied/i
    );
    bump("serviceRoleImmutability");
    bump("realRls");
    await resetSessionGuc(client);

    // Prove trigger rejects under service_role session when UPDATE is temporarily granted
    // (disposable DB only — does not change merged production SQL posture).
    await client.query(
      `GRANT SELECT, UPDATE ON TABLE public.qa_identity_quarantines TO service_role`
    );
    await asRole(client, { role: "service_role" });
    await expectQueryRejects(
      client,
      `UPDATE public.qa_identity_quarantines SET reason = 'service_role_tamper' WHERE id = $1::uuid`,
      [qid],
      /QA_IDENTITY_QUARANTINE_IMMUTABLE_FIELD/
    );
    bump("serviceRoleImmutability");
    bump("realImmutability");
    await resetSessionGuc(client);
    await client.query(
      `REVOKE ALL ON TABLE public.qa_identity_quarantines FROM service_role`
    );

    // Mutable lifecycle update via RPC still works
    const act = await activateAfterBan(client, qid, prepared.lifecycle_version);
    assert.equal(act.ok, true);
    assert.equal(await getProfileStatus(client, id), "active");
    bump("realRpc");
  });

  await t.test("D) hard delete / direct DML denied", async () => {
    requireBootstrapped();
    const id = uuidFromInt(40);
    await seedProfile(client, {
      id,
      email: "qa06.dml@example.local",
    });
    const prepared = await prepareAsService(client, {
      profile_id: id,
      expected_email: "qa06.dml@example.local",
      allowlist_label: "QA-06",
    });
    const qid = prepared.quarantine_id;

    for (const role of ["anon", "authenticated", "service_role"]) {
      await resetSessionGuc(client);
      await asRole(client, { role });
      // Separate autocommit statements — a failed statement must not poison peers.
      await expectQueryRejects(
        client,
        `INSERT INTO public.qa_identity_quarantines (
           profile_id, auth_user_id, batch_id, source_operation,
           allowlist_sha256, snapshot_sha256, reason, created_by,
           original_profile_status, original_auth_banned, expected_email, allowlist_label
         ) VALUES ($1::uuid,$1::uuid,$2::uuid,'OPERATION_B1B',$3,$4,'x','y','active',false,'qa06.dml@example.local','QA-07')`,
        [id, BATCH2, HASH_A, HASH_S],
        /permission denied/i
      );
      await expectQueryRejects(
        client,
        `UPDATE public.qa_identity_quarantines SET updated_at = now() WHERE id = $1::uuid`,
        [qid],
        /permission denied/i
      );
      await expectQueryRejects(
        client,
        `DELETE FROM public.qa_identity_quarantines WHERE id = $1::uuid`,
        [qid],
        /permission denied|QA_IDENTITY_QUARANTINE_HARD_DELETE_DENIED/i
      );
      bump("realRls", 3);
      await resetSessionGuc(client);
    }

    // Owner path hard DELETE still denied by trigger
    await expectQueryRejects(
      client,
      `DELETE FROM public.qa_identity_quarantines WHERE id = $1`,
      [qid],
      /QA_IDENTITY_QUARANTINE_HARD_DELETE_DENIED/
    );
    bump("realConstraint");
  });

  await t.test("E) controlled RPC contract positive/negative", async () => {
    requireBootstrapped();
    const sa = uuidFromInt(50);
    const player = uuidFromInt(51);
    const tech = uuidFromInt(52);
    await seedProfile(client, {
      id: sa,
      email: "super.wp5@example.local",
      role: "SUPER_ADMIN",
    });
    await seedProfile(client, {
      id: player,
      email: "qa07.rpc@example.local",
      role: "PLAYER",
    });
    await seedProfile(client, {
      id: tech,
      email: "tech.wp5@example.local",
      role: "SYSTEM_TECHNICIAN",
    });

    // unauthorized authenticated player
    await client.query("BEGIN");
    try {
      await asRole(client, { role: "authenticated", sub: player });
      const denied = await callRpcJson(
        client,
        "qa_quarantine_prepare",
        prepareArgs({
          profile_id: player,
          expected_email: "qa07.rpc@example.local",
          allowlist_label: "QA-07",
        })
      );
      assert.equal(denied.ok, false);
      assert.equal(denied.code, "forbidden");
      bump("realRpc");
      bump("realRls");
    } finally {
      await client.query("ROLLBACK");
      await resetSessionGuc(client);
    }

    // SUPER_ADMIN positive prepare
    await client.query("BEGIN");
    let prepared;
    try {
      await asRole(client, {
        role: "authenticated",
        sub: sa,
        email: "super.wp5@example.local",
      });
      prepared = await callRpcJson(
        client,
        "qa_quarantine_prepare",
        prepareArgs({
          profile_id: player,
          expected_email: "qa07.rpc@example.local",
          allowlist_label: "QA-07",
        })
      );
      assert.equal(prepared.ok, true);
      assert.equal(prepared.code, "prepared");
      bump("realRpc");
      bump("realRls");
    } finally {
      await client.query("COMMIT");
      await resetSessionGuc(client);
    }

    // version mismatch fail-closed
    const badVersion = await activateAfterBan(
      client,
      prepared.quarantine_id,
      prepared.lifecycle_version + 99
    );
    assert.equal(badVersion.ok, false);
    assert.equal(badVersion.code, "version_mismatch");
    bump("realRpc");

    const act = await activateAfterBan(
      client,
      prepared.quarantine_id,
      prepared.lifecycle_version
    );
    assert.equal(act.ok, true);
    assert.equal(await getProfileStatus(client, player), "active");
    bump("realRpc");

    // get_state
    await asRole(client, { role: "service_role" });
    const state = await callRpcJson(client, "qa_quarantine_get_state", {
      p_quarantine_id: prepared.quarantine_id,
    });
    await resetSessionGuc(client);
    assert.equal(state.ok, true);
    assert.equal(state.lifecycle_state, "active");
    assert.equal(state.profile_id, player);
    bump("realRpc");

    // directory reader: SYSTEM_TECHNICIAN can list_active but not prepare
    await client.query("BEGIN");
    try {
      await asRole(client, { role: "authenticated", sub: tech });
      const listed = await client.query(
        `SELECT * FROM public.qa_quarantine_list_active($1::uuid[])`,
        [[player]]
      );
      assert.ok(listed.rows.some((r) => r.profile_id === player));
      const writeDenied = await callRpcJson(
        client,
        "qa_quarantine_prepare",
        prepareArgs({
          profile_id: player,
          expected_email: "qa07.rpc@example.local",
          allowlist_label: "QA-07",
          batch_id: BATCH2,
        })
      );
      assert.equal(writeDenied.ok, false);
      assert.equal(writeDenied.code, "forbidden");
      bump("realRls", 2);
      bump("realRpc");
    } finally {
      await client.query("ROLLBACK");
      await resetSessionGuc(client);
    }

    // release
    await asRole(client, { role: "service_role" });
    const released = await callRpcJson(client, "qa_quarantine_release", {
      p_quarantine_id: prepared.quarantine_id,
      p_expected_lifecycle_version: act.lifecycle_version,
      p_release_reason: "wp5-release",
    });
    await resetSessionGuc(client);
    assert.equal(released.ok, true);
    assert.equal(released.should_unban, true);
    assert.equal(await getProfileStatus(client, player), "active");
    bump("realRpc");
  });

  await t.test("F) failure classification matrix", async () => {
    requireBootstrapped();
    for (const [classification, target] of Object.entries(
      FAILURE_CLASSIFICATION_MATRIX
    )) {
      const n = 60 + Object.keys(FAILURE_CLASSIFICATION_MATRIX).indexOf(classification);
      const id = uuidFromInt(n);
      const preexisting = classification === "activation_failed_preexisting";
      await seedProfile(client, {
        id,
        email: `qa08.fail${n}@example.local`,
      });
      const prepared = await prepareAsService(client, {
        profile_id: id,
        expected_email: `qa08.fail${n}@example.local`,
        allowlist_label: "QA-08",
        original_auth_banned: preexisting,
        batch_id: uuidFromInt(n, "cccccccc-dddd-4eee-8fff"),
      });
      assert.equal(prepared.ok, true, classification);

      const rec = await recordFailure(client, {
        quarantineId: prepared.quarantine_id,
        version: prepared.lifecycle_version,
        targetAuthBanState: target,
        classification,
      });
      assert.equal(rec.ok, true, classification);
      assert.equal(rec.lifecycle_state, "failed");
      assert.equal(rec.auth_ban_state, target);
      assert.equal(rec.failure_classification, classification);
      assert.equal(await getProfileStatus(client, id), "active");
      bump("realRpc", 2);
    }

    // activation_failed_preexisting invalid when original_auth_banned=false
    const id = uuidFromInt(70);
    await seedProfile(client, {
      id,
      email: "qa08.preexist-bad@example.local",
    });
    const prepared = await prepareAsService(client, {
      profile_id: id,
      expected_email: "qa08.preexist-bad@example.local",
      allowlist_label: "QA-08",
      original_auth_banned: false,
      batch_id: uuidFromInt(70, "cccccccc-dddd-4eee-8fff"),
    });
    const bad = await recordFailure(client, {
      quarantineId: prepared.quarantine_id,
      version: prepared.lifecycle_version,
      targetAuthBanState: "failed",
      classification: "activation_failed_preexisting",
    });
    assert.equal(bad.ok, false);
    assert.equal(bad.code, "preexisting_classification_requires_original_banned");
    bump("realRpc");

    // reverted requires original_unbanned
    const id2 = uuidFromInt(71);
    await seedProfile(client, {
      id: id2,
      email: "qa08.reverted-bad@example.local",
    });
    const p2 = await prepareAsService(client, {
      profile_id: id2,
      expected_email: "qa08.reverted-bad@example.local",
      allowlist_label: "QA-09",
      original_auth_banned: true,
      batch_id: uuidFromInt(71, "cccccccc-dddd-4eee-8fff"),
    });
    const badReverted = await recordFailure(client, {
      quarantineId: p2.quarantine_id,
      version: p2.lifecycle_version,
      targetAuthBanState: "reverted",
      classification: "activation_failed_compensated",
    });
    assert.equal(badReverted.ok, false);
    assert.equal(badReverted.code, "reverted_requires_original_unbanned");
    bump("realRpc");
  });

  await t.test("G) prepare idempotency", async () => {
    requireBootstrapped();
    const id = uuidFromInt(80);
    await seedProfile(client, {
      id,
      email: "qa09.idem@example.local",
    });
    const args = {
      profile_id: id,
      expected_email: "qa09.idem@example.local",
      allowlist_label: "QA-09",
    };
    const a = await prepareAsService(client, args);
    assert.equal(a.code, "prepared");
    const b = await prepareAsService(client, args);
    assert.equal(b.ok, true);
    assert.equal(b.code, "prepare_idempotent");
    assert.equal(b.quarantine_id, a.quarantine_id);
    bump("realRpc", 2);

    const conflict = await prepareAsService(client, {
      ...args,
      batch_id: BATCH2,
    });
    assert.equal(conflict.ok, false);
    assert.equal(conflict.code, "pending_conflict");
    bump("realRpc");

    const act = await activateAfterBan(client, a.quarantine_id, a.lifecycle_version);
    assert.equal(act.ok, true);
    const again = await prepareAsService(client, args);
    assert.equal(again.ok, true);
    assert.equal(again.code, "already_quarantined");
    bump("realRpc", 2);
  });

  await t.test("H) RLS / authorization matrix extras", async () => {
    requireBootstrapped();
    // anon execute denied (no GRANT)
    await client.query("BEGIN");
    try {
      await asRole(client, { role: "anon" });
      await expectQueryRejects(
        client,
        `SELECT public.qa_quarantine_get_state($1)`,
        [uuidFromInt(1)],
        /permission denied/i
      );
      bump("realRls");
    } finally {
      await client.query("ROLLBACK");
      await resetSessionGuc(client);
    }

    // unauthorized tenant role cannot list_active
    const tenantUser = uuidFromInt(90);
    await seedProfile(client, {
      id: tenantUser,
      email: "tenant.wp5@example.local",
      role: "VENUE_OWNER",
    });
    await client.query("BEGIN");
    try {
      await asRole(client, { role: "authenticated", sub: tenantUser });
      await expectQueryRejects(
        client,
        `SELECT * FROM public.qa_quarantine_list_active($1::uuid[])`,
        [[tenantUser]],
        /QA_QUARANTINE_FORBIDDEN/i
      );
      bump("realRls");
    } finally {
      await client.query("ROLLBACK");
      await resetSessionGuc(client);
    }
  });

  await t.test("I0) REAL qa_quarantine_activate_preexisting_ban RPC coverage", async () => {
    requireBootstrapped();
    const id = uuidFromInt(95);
    const email = "phase1c.prod.safe5@prod-qa.local";
    const batchId = uuidFromInt(95, "dddddddd-eeee-4fff-8aaa");
    await seedProfile(client, { id, email, status: "active" });
    await resetSessionGuc(client);
    await client.query(
      `UPDATE auth.users SET banned_until = now() + interval '30 days' WHERE id = $1::uuid`,
      [id]
    );

    const prepared = await prepareAsService(client, {
      profile_id: id,
      expected_email: email,
      allowlist_label: "QA-05",
      original_auth_banned: true,
      batch_id: batchId,
      reason: "OPERATION_B1B_WP5_PREEXISTING",
    });
    assert.equal(prepared.ok, true);
    assert.equal(prepared.code, "prepared");
    assert.equal(prepared.lifecycle_state, "pending");
    assert.equal(prepared.auth_ban_state, "pending");
    bump("activatePreexistingRealRpc", 2);
    bump("realRpc");

    const pendingState = await getStateAsService(client, prepared.quarantine_id);
    assert.equal(pendingState.ok, true);
    assert.equal(pendingState.lifecycle_state, "pending");
    assert.equal(pendingState.auth_ban_state, "pending");
    assert.equal(pendingState.original_auth_banned, true);
    bump("activatePreexistingRealRpc");

    const before = await readAuthorityRow(client, prepared.quarantine_id);
    const activated = await activatePreexistingBan(
      client,
      prepared.quarantine_id,
      prepared.lifecycle_version
    );
    assert.equal(activated.ok, true);
    assert.equal(activated.code, "activated_preexisting_ban");
    assert.equal(activated.lifecycle_state, "active");
    assert.equal(activated.auth_ban_state, "not_required_preexisting");
    bump("activatePreexistingRealRpc", 3);
    bump("realRpc");

    const after = await readAuthorityRow(client, prepared.quarantine_id);
    assert.equal(after.lifecycle_state, "active");
    assert.equal(after.auth_ban_state, "not_required_preexisting");
    assert.equal(after.original_auth_banned, true);
    assert.equal(await getProfileStatus(client, id), "active");
    for (const col of [
      "profile_id",
      "auth_user_id",
      "batch_id",
      "source_operation",
      "original_auth_banned",
      "original_profile_status",
      "created_by",
      "reason",
      "allowlist_sha256",
      "snapshot_sha256",
      "expected_email",
      "allowlist_label",
      "venue_id",
    ]) {
      assert.equal(after[col], before[col], `immutable ${col}`);
    }
    bump("activatePreexistingRealRpc", 3);
    bump("realImmutability");

    const state = await getStateAsService(client, prepared.quarantine_id);
    assert.equal(state.ok, true);
    assert.equal(state.code, "state");
    assert.equal(state.lifecycle_state, "active");
    assert.equal(state.auth_ban_state, "not_required_preexisting");
    assert.equal(state.original_auth_banned, true);
    assert.equal(state.lifecycle_version, activated.lifecycle_version);
    bump("activatePreexistingRealRpc", 2);

    // Invalid preexisting activation: original_auth_banned must be true
    const idBad = uuidFromInt(96);
    const emailBad = "phase1c.prod.safe6@prod-qa.local";
    await seedProfile(client, { id: idBad, email: emailBad, status: "active" });
    const prepBad = await prepareAsService(client, {
      profile_id: idBad,
      expected_email: emailBad,
      allowlist_label: "QA-06",
      original_auth_banned: false,
      batch_id: uuidFromInt(96, "dddddddd-eeee-4fff-8aaa"),
    });
    assert.equal(prepBad.ok, true);
    const rejected = await activatePreexistingBan(
      client,
      prepBad.quarantine_id,
      prepBad.lifecycle_version
    );
    assert.equal(rejected.ok, false);
    assert.equal(rejected.code, "original_auth_banned_must_be_true");
    assert.equal(await getProfileStatus(client, idBad), "active");
    bump("activatePreexistingRealRpc", 2);
    bump("realRpc");
  });

  await t.test("I) Boundary 3 real-DB fault injection + Boundaries 1/2/4/5", async () => {
    requireBootstrapped();
    const zeroRefs = () => ({
      athlete_count: 0,
      membership_active: 0,
      membership_removed: 0,
      membership_total: 0,
      tenant_members: 0,
      tenants_owned: 0,
      club_governance_owner: 0,
      tournament_refs: 0,
      rating_refs: 0,
      finance_refs: 0,
      other_business_refs: 0,
    });
    const authResultLive = {
      ok: true,
      authorized: true,
      dryRun: false,
    };

    function buildRealDbAdapters({
      forceActivateFail = false,
      forceUnbanFail = false,
    } = {}) {
      const authState = new Map();
      let activateCalls = 0;
      let unbanCalls = 0;
      let prepareCalls = 0;
      const adapters = {
        emailOverrides: {},
        async fetchAuthUser(userId) {
          const { rows } = await client.query(
            `SELECT id, email, banned_until FROM auth.users WHERE id = $1`,
            [userId]
          );
          const u = rows[0];
          if (!u) return null;
          return {
            id: u.id,
            email: u.email,
            banned_until: u.banned_until,
          };
        },
        async fetchProfile(profileId) {
          const { rows } = await client.query(
            `SELECT id, email, status FROM public.profiles WHERE id = $1`,
            [profileId]
          );
          return rows[0] || null;
        },
        async fetchReferenceCounts() {
          return zeroRefs();
        },
        async fetchAuthBanState(authUserId) {
          if (authState.has(authUserId)) return authState.get(authUserId) === true;
          const { rows } = await client.query(
            `SELECT banned_until FROM auth.users WHERE id = $1`,
            [authUserId]
          );
          const until = rows[0]?.banned_until;
          return Boolean(until && new Date(until).getTime() > Date.now());
        },
        async banAuthUser({ userId }) {
          authState.set(userId, true);
          await client.query(
            `UPDATE auth.users SET banned_until = now() + interval '100 days' WHERE id = $1`,
            [userId]
          );
          return { ok: true };
        },
        async unbanAuthUser({ userId }) {
          unbanCalls += 1;
          if (forceUnbanFail) {
            return { ok: false, reason: "forced_unban_failure" };
          }
          authState.set(userId, false);
          await client.query(
            `UPDATE auth.users SET banned_until = NULL WHERE id = $1`,
            [userId]
          );
          return { ok: true };
        },
        async qaQuarantinePrepare(args) {
          prepareCalls += 1;
          await asRole(client, { role: "service_role" });
          try {
            const data = await callRpcJson(client, "qa_quarantine_prepare", {
              p_profile_id: args.profileId,
              p_auth_user_id: args.authUserId,
              p_batch_id: args.batchId,
              p_allowlist_sha256: args.allowlistSha256,
              p_snapshot_sha256: args.snapshotSha256,
              p_reason: args.reason,
              p_original_profile_status: args.originalProfileStatus,
              p_original_auth_banned: args.originalAuthBanned,
              p_expected_email: args.expectedEmail,
              p_allowlist_label: args.allowlistLabel,
              p_metadata: args.metadata || {},
            });
            if (data?.ok === false) {
              return { ok: false, reason: data.code, code: data.code, data };
            }
            return { ok: true, data };
          } finally {
            await resetSessionGuc(client);
          }
        },
        async qaQuarantineActivateAfterAuthBan(args) {
          activateCalls += 1;
          if (forceActivateFail) {
            return { ok: false, reason: "forced_activation_writer_failure" };
          }
          await asRole(client, { role: "service_role" });
          try {
            const data = await callRpcJson(
              client,
              "qa_quarantine_activate_after_auth_ban",
              {
                p_quarantine_id: args.quarantineId,
                p_expected_lifecycle_version: args.expectedLifecycleVersion,
                p_auth_ban_readback_confirmed: args.authBanReadbackConfirmed,
              }
            );
            if (data?.ok === false) {
              return { ok: false, reason: data.code, code: data.code, data };
            }
            return { ok: true, data };
          } finally {
            await resetSessionGuc(client);
          }
        },
        async qaQuarantineRecordCompensatedFailure(args) {
          await asRole(client, { role: "service_role" });
          try {
            const data = await callRpcJson(
              client,
              "qa_quarantine_record_compensated_failure",
              {
                p_quarantine_id: args.quarantineId,
                p_expected_lifecycle_version: args.expectedLifecycleVersion,
                p_target_auth_ban_state: args.targetAuthBanState,
                p_failure_classification: args.failureClassification,
              }
            );
            if (data?.ok === false) {
              return { ok: false, reason: data.code, code: data.code, data };
            }
            return { ok: true, data };
          } finally {
            await resetSessionGuc(client);
          }
        },
        async qaQuarantineGetState({ quarantineId }) {
          await asRole(client, { role: "service_role" });
          try {
            const data = await callRpcJson(client, "qa_quarantine_get_state", {
              p_quarantine_id: quarantineId,
            });
            if (data?.ok === false) {
              return { ok: false, reason: data.code, code: data.code, data };
            }
            return { ok: true, data };
          } finally {
            await resetSessionGuc(client);
          }
        },
        _authState: authState,
        _activateCalls: () => activateCalls,
        _unbanCalls: () => unbanCalls,
        _prepareCalls: () => prepareCalls,
      };
      return adapters;
    }

    // Boundary 3 success-compensation: activate fail → unban ok → reverted
    const id = uuidFromInt(100);
    const emailB3 = "phase1c.prod.safe1@prod-qa.local";
    const batchB3 = uuidFromInt(100, "dddddddd-eeee-4fff-8aaa");
    await seedProfile(client, { id, email: emailB3, status: "active" });
    const adapters = buildRealDbAdapters({ forceActivateFail: true });
    adapters.emailOverrides[id] = emailB3;

    const entry = await quarantineOneIdentityB1B({
      allowlistRow: {
        label: "QA-10",
        auth_user_id: id,
        profile_id: id,
        expected_email: emailB3,
        profile_status: "active",
        auth_banned: false,
        reference_counts: zeroRefs(),
      },
      adapters,
      authResult: authResultLive,
      dryRun: false,
      batchId: batchB3,
      allowlistSha256: HASH_A,
      snapshotSha256: HASH_S,
      reason: "OPERATION_B1B_WP5_BOUNDARY3",
    });

    assert.equal(adapters._activateCalls(), 1);
    assert.equal(entry.ok, false);
    assert.equal(entry.critical, false, "compensation must be verifiable");
    assert.equal(
      adapters._authState.get(id),
      false,
      "independent auth readback unbanned"
    );
    assert.equal(await countActiveAuthority(client, id), 0);
    assert.equal(await getProfileStatus(client, id), "active");

    const { rows: failedRows } = await client.query(
      `SELECT id, lifecycle_state, auth_ban_state, failure_classification,
              lifecycle_version, batch_id
       FROM public.qa_identity_quarantines
       WHERE profile_id = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [id]
    );
    assert.equal(failedRows[0].lifecycle_state, "failed");
    assert.equal(failedRows[0].auth_ban_state, "reverted");
    assert.equal(
      failedRows[0].failure_classification,
      "activation_failed_compensated"
    );
    const consumedQuarantineId = failedRows[0].id;
    const consumedVersion = failedRows[0].lifecycle_version;
    const rowCountBeforeReuse = (
      await client.query(
        `SELECT count(*)::int AS n FROM public.qa_identity_quarantines WHERE profile_id = $1`,
        [id]
      )
    ).rows[0].n;

    // LOW: exact fail-closed reuse of consumed authority + consumed GO/batch
    const retryActivate = await activateAfterBan(
      client,
      consumedQuarantineId,
      consumedVersion
    );
    assert.equal(retryActivate.ok, false);
    assert.equal(retryActivate.code, "state_mismatch");
    const afterRetry = await readAuthorityRow(client, consumedQuarantineId);
    assert.equal(afterRetry.lifecycle_state, "failed");
    assert.equal(afterRetry.auth_ban_state, "reverted");
    assert.equal(afterRetry.failure_classification, "activation_failed_compensated");
    assert.equal(afterRetry.lifecycle_version, consumedVersion);
    assert.equal(await countActiveAuthority(client, id), 0);
    assert.equal(
      (
        await client.query(
          `SELECT count(*)::int AS n FROM public.qa_identity_quarantines WHERE profile_id = $1`,
          [id]
        )
      ).rows[0].n,
      rowCountBeforeReuse,
      "rejected authority retry must not insert rows"
    );
    assert.equal(
      adapters._authState.get(id),
      false,
      "rejected reuse must not Auth-mutate"
    );
    bump("consumedAuthorityReuseExact", 6);

    resetAuthorityConsumptionForTests();
    const testGo = "APPROVE_OPERATION_B1B_WP5_UNIT_TEST_BINDING_NOT_PRODUCTION";
    const binding = createFreshAuthorizationBinding({
      ownerProductionGo: testGo,
      explicitExecuteConfirmation: REQUIRED_EXPLICIT_EXECUTE_CONFIRMATION,
      expectedBatchId: batchB3,
      allowlistSha256: HASH_A,
      snapshotSha256: HASH_S,
      productionProjectRef: EXPECTED_PRODUCTION_PROJECT_REF,
    });
    assert.equal(binding.ok, true);
    const authLive = {
      ok: true,
      authorized: true,
      dryRun: false,
      ownerProductionGo: testGo,
      batchId: batchB3,
      allowlistSha: HASH_A,
      snapshotSha: HASH_S,
      projectRef: EXPECTED_PRODUCTION_PROJECT_REF,
    };
    const claimed = new Set();
    const claimer = async (bind) => {
      const key = `${bind.ownerProductionGo}::${bind.batchId}::${bind.allowlistSha256}::${bind.snapshotSha256}`;
      if (claimed.has(key)) {
        return { ok: false, consumed: true, reason: "authority_already_consumed" };
      }
      claimed.add(key);
      return { ok: true };
    };
    const firstClaim = await presentLiveAuthority(authLive, claimer);
    assert.equal(firstClaim.ok, true);
    const secondClaim = await presentLiveAuthority(authLive, claimer);
    assert.equal(secondClaim.ok, false);
    assert.equal(secondClaim.reason, "authority_already_consumed");
    assert.equal(secondClaim.consumed, true);
    bump("consumedAuthorityReuseExact", 3);
    bump("boundary3", 8);

    // Boundary 3 CRITICAL: activate fail → unban fail → compensation_incomplete → failed
    const idCrit = uuidFromInt(102);
    const idCritPeer = uuidFromInt(103);
    const emailCrit = "phase1c.prod.safe3@prod-qa.local";
    const emailPeer = "phase1c.prod.safe4@prod-qa.local";
    const batchCrit = uuidFromInt(102, "dddddddd-eeee-4fff-8aaa");
    await seedProfile(client, { id: idCrit, email: emailCrit, status: "active" });
    await seedProfile(client, { id: idCritPeer, email: emailPeer, status: "active" });
    const adaptersCrit = buildRealDbAdapters({
      forceActivateFail: true,
      forceUnbanFail: true,
    });
    adaptersCrit.emailOverrides[idCrit] = emailCrit;
    adaptersCrit.emailOverrides[idCritPeer] = emailPeer;

    const rowsBeforeCrit = (
      await client.query(
        `SELECT count(*)::int AS n FROM public.qa_identity_quarantines WHERE profile_id = $1`,
        [idCrit]
      )
    ).rows[0].n;

    const batch = await runBatchQuarantineB1B({
      identities: [
        {
          label: "QA-08",
          auth_user_id: idCrit,
          profile_id: idCrit,
          expected_email: emailCrit,
          profile_status: "active",
          auth_banned: false,
          reference_counts: zeroRefs(),
        },
        {
          label: "QA-09",
          auth_user_id: idCritPeer,
          profile_id: idCritPeer,
          expected_email: emailPeer,
          profile_status: "active",
          auth_banned: false,
          reference_counts: zeroRefs(),
        },
      ],
      adapters: adaptersCrit,
      authResult: authResultLive,
      batchId: batchCrit,
      allowlistSha256: HASH_A,
      snapshotSha256: HASH_S,
    });

    assert.equal(batch.ok, false);
    assert.equal(batch.integrityIncident, true);
    assert.equal(batch.results[0].ok, false);
    assert.equal(batch.results[0].critical, true);
    assert.match(
      batch.results[0].abortReason || "",
      /CRITICAL_COMPENSATION_INCOMPLETE/
    );
    assert.equal(batch.results[1].ok, false);
    assert.equal(
      batch.results[1].abortReason,
      "batch_stopped_after_integrity_incident"
    );
    assert.equal(
      adaptersCrit._prepareCalls(),
      1,
      "peer identity must not prepare after critical stop"
    );
    assert.equal(adaptersCrit._unbanCalls(), 1);
    assert.equal(await countActiveAuthority(client, idCrit), 0);
    assert.equal(await getProfileStatus(client, idCrit), "active");

    const { rows: critRows } = await client.query(
      `SELECT id, lifecycle_state, auth_ban_state, failure_classification, lifecycle_version
       FROM public.qa_identity_quarantines
       WHERE profile_id = $1
       ORDER BY created_at DESC`,
      [idCrit]
    );
    assert.equal(critRows.length, rowsBeforeCrit + 1, "exactly one authority row retained");
    assert.equal(critRows[0].lifecycle_state, "failed");
    assert.equal(critRows[0].auth_ban_state, "failed");
    assert.equal(critRows[0].failure_classification, "compensation_incomplete");
    assert.notEqual(
      critRows[0].auth_ban_state,
      "reverted",
      "unverified compensation must never become reverted"
    );

    // Same-authority retry of critical-failed row is fail-closed
    const critRetry = await activateAfterBan(
      client,
      critRows[0].id,
      critRows[0].lifecycle_version
    );
    assert.equal(critRetry.ok, false);
    assert.equal(critRetry.code, "state_mismatch");
    bump("boundary3CompensationIncomplete", 10);
    bump("boundary3", 5);

    // Boundary 2: auth ban fails → auth_ban_failed / failed
    const id2 = uuidFromInt(101);
    const emailB2 = "phase1c.prod.safe2@prod-qa.local";
    await seedProfile(client, { id: id2, email: emailB2 });
    const adaptersB2 = buildRealDbAdapters({});
    adaptersB2.emailOverrides[id2] = emailB2;
    adaptersB2.banAuthUser = async () => ({
      ok: false,
      reason: "forced_ban_failure",
    });
    const e2 = await quarantineOneIdentityB1B({
      allowlistRow: {
        label: "QA-11",
        auth_user_id: id2,
        profile_id: id2,
        expected_email: emailB2,
        profile_status: "active",
        auth_banned: false,
        reference_counts: zeroRefs(),
      },
      adapters: adaptersB2,
      authResult: authResultLive,
      dryRun: false,
      batchId: uuidFromInt(101, "dddddddd-eeee-4fff-8aaa"),
      allowlistSha256: HASH_A,
      snapshotSha256: HASH_S,
    });
    assert.equal(e2.ok, false);
    const { rows: b2rows } = await client.query(
      `SELECT lifecycle_state, auth_ban_state, failure_classification
       FROM public.qa_identity_quarantines WHERE profile_id = $1
       ORDER BY created_at DESC LIMIT 1`,
      [id2]
    );
    assert.equal(b2rows[0].failure_classification, "auth_ban_failed");
    assert.equal(b2rows[0].auth_ban_state, "failed");
    bump("boundary3", 3);
  });

  await t.test("J) anti-N+1 list_active remains O(1)", async () => {
    requireBootstrapped();
    assert.equal(MAX_QUARANTINE_AUTHORITY_QUERIES_PER_PAGE, 1);
    const quarantined = [];
    const real = [];
    for (let i = 0; i < 5; i += 1) {
      const qid = uuidFromInt(200 + i);
      quarantined.push(qid);
      await seedProfile(client, {
        id: qid,
        email: `qa.n1.q${i}@example.local`,
      });
      const p = await prepareAsService(client, {
        profile_id: qid,
        expected_email: `qa.n1.q${i}@example.local`,
        allowlist_label: "QA-04",
        batch_id: uuidFromInt(200 + i, "eeeeeeee-ffff-4aaa-8bbb"),
      });
      await activateAfterBan(client, p.quarantine_id, p.lifecycle_version);
    }
    for (let i = 0; i < 8; i += 1) {
      const rid = uuidFromInt(300 + i);
      real.push(rid);
      await seedProfile(client, {
        id: rid,
        email: `real.n1.${i}@example.local`,
        role: "PLAYER",
      });
    }
    const pageIds = [...quarantined, ...real];
    let queryCount = 0;
    const wrappedQuery = client.query.bind(client);
    client.query = async (...args) => {
      const text = typeof args[0] === "string" ? args[0] : args[0]?.text || "";
      if (/qa_quarantine_list_active/i.test(text)) queryCount += 1;
      return wrappedQuery(...args);
    };
    try {
      await asRole(client, { role: "service_role" });
      const { rows } = await client.query(
        `SELECT * FROM public.qa_quarantine_list_active($1::uuid[])`,
        [pageIds]
      );
      await resetSessionGuc(client);
      assert.equal(queryCount, 1);
      assert.equal(rows.length, quarantined.length);
      bump("antiN1", 3);
    } finally {
      client.query = wrappedQuery;
    }
  });

  await t.test("K) real-user status semantics + exclusion fixture", async () => {
    requireBootstrapped();
    const realId = uuidFromInt(400);
    await seedProfile(client, {
      id: realId,
      email: FORBIDDEN_REAL_USER_EMAIL,
      status: "active",
      role: "PLAYER",
    });
    assert.equal(await getProfileStatus(client, realId), "active");
    await expectQueryRejects(
      client,
      `UPDATE public.profiles SET status = 'quarantined' WHERE id = $1`,
      [realId],
      /profiles_status_check/i
    );
    // prepare rejects non-certified labels
    const badLabel = await prepareAsService(client, {
      profile_id: realId,
      expected_email: FORBIDDEN_REAL_USER_EMAIL,
      allowlist_label: "QA-01",
    });
    assert.equal(badLabel.ok, false);
    assert.equal(badLabel.code, "invalid_allowlist_label");
    bump("regression", 3);
  });

  await t.test("evidence summary printed (sanitized)", async () => {
    assert.ok(forwardExecuted.wp1);
    assert.ok(forwardExecuted.wp2);
    assert.ok(evidence?.POSTGRES_REAL_SERVER === "YES");
    console.log(
      JSON.stringify(
        {
          WP5_REAL_POSTGRES_EVIDENCE: {
            ...evidence,
            provisioner,
            WP1_FORWARD_SQL_EXECUTED_LOCAL: forwardExecuted.wp1,
            WP2_FORWARD_SQL_EXECUTED_LOCAL: forwardExecuted.wp2,
            COUNTERS: counters,
            ACTIVATE_PREEXISTING_REAL_RPC_TESTS:
              counters.activatePreexistingRealRpc,
            BOUNDARY3_COMPENSATION_INCOMPLETE_REAL_DB_TESTS:
              counters.boundary3CompensationIncomplete,
            CONSUMED_AUTHORITY_REUSE_EXACT_ASSERTIONS:
              counters.consumedAuthorityReuseExact,
          },
        },
        null,
        2
      )
    );
  });
});
