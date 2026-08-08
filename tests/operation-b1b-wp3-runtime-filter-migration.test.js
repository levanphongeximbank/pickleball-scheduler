/**
 * OPERATION_B1B WP3 — runtime / filter migration (+ corrective remediation) unit proofs.
 * No database apply. No Staging/Production mutation.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

import {
  isQaQuarantineAuthorityFilterEnabled,
  QA_QUARANTINE_AUTHORITY_FILTER_FLAG,
} from "../src/features/player/config/qaQuarantineFilterFlags.js";
import {
  classifyQaQuarantineRpcError,
  collectProfileIdsForQuarantineLookup,
  extractProfileKeysFromRow,
  FORBIDDEN_QA_QUARANTINE_LIST_ACTIVE_BATCHED,
  listActiveQaQuarantineMembership,
  MAX_QUARANTINE_AUTHORITY_QUERIES_PER_PAGE,
  observeQaQuarantineAuthorityAvailability,
  projectActiveMembershipIds,
  projectCanonicalAuthorityOntoRows,
  QA_QUARANTINE_LIST_ACTIVE_MAX_IDS,
  QA_QUARANTINE_LIST_ACTIVE_RPC,
  QA_QUARANTINE_LIST_ACTIVE_SELECT,
  QA_QUARANTINE_READ_STATUS,
} from "../src/features/player/utils/qaQuarantineAuthorityRead.js";
import {
  classifyQaTestIdentity,
  excludeQaTestIdentities,
  excludeQaTestIdentitiesWithAuthority,
  isCertifiedQaEmail,
  isConfirmedQaTestIdentity,
  QA_IDENTITY_DUAL_READ_PRECEDENCE,
  QA_IDENTITY_SIGNAL,
} from "../src/features/player/utils/qaTestIdentityFilter.js";
import { filterPlayers } from "../src/utils/playerHelpers.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(path.join(ROOT, rel), "utf8");
const FORWARD_SQL =
  "docs/v5/operations/production-qa-identity-operation-b1b-remediation/sql/20_QA_IDENTITY_QUARANTINE_AUTHORITY_FORWARD.sql";

const REAL_USER = {
  id: "profile-11111111-1111-4111-8111-111111111111",
  authUserId: "11111111-1111-4111-8111-111111111111",
  email: "real.player@gmail.com",
  name: "Real Player",
  gender: "Nam",
  level: 3.5,
  status: "active",
};

const CANONICAL_QA = {
  id: "profile-22222222-2222-4222-8222-222222222222",
  authUserId: "22222222-2222-4222-8222-222222222222",
  email: "canonical.qa@example.com",
  name: "Canonical QA",
  gender: "Nữ",
  level: 4,
  status: "active",
};

const CERTIFIED_QA = {
  id: "profile-33333333-3333-4333-8333-333333333333",
  authUserId: "33333333-3333-4333-8333-333333333333",
  email: "phase1b-smoke-1@pickleball-scheduler.qa",
  name: "Certified QA",
  gender: "Nam",
  level: 3,
  status: "active",
};

const LOOKALIKE_REAL = {
  id: "profile-44444444-4444-4444-8444-444444444444",
  authUserId: "44444444-4444-4444-8444-444444444444",
  email: "phase1b-smith@gmail.com",
  name: "Lookalike Real",
  gender: "Nữ",
  level: 3.2,
  status: "active",
};

function mockRpcClient(handler) {
  const calls = [];
  return {
    calls,
    client: {
      rpc(name, args) {
        const call = { name, args, select: null };
        calls.push(call);
        const resultPromise = Promise.resolve().then(() =>
          handler(name, args, calls.length)
        );
        // Thenable builder supporting .select('profile_id') wire projection.
        const builder = {
          select(columns) {
            call.select = columns;
            return resultPromise;
          },
          then: resultPromise.then.bind(resultPromise),
          catch: resultPromise.catch.bind(resultPromise),
        };
        return builder;
      },
    },
  };
}

function makeUuid(n) {
  const hex = n.toString(16).padStart(12, "0");
  return `aaaaaaaa-bbbb-4ccc-8ddd-${hex}`;
}

test("1) SUPER_ADMIN canonical read still works", async () => {
  const { client, calls } = mockRpcClient(() => ({
    data: [{ profile_id: CANONICAL_QA.authUserId }],
    error: null,
  }));
  const result = await excludeQaTestIdentitiesWithAuthority(
    [REAL_USER, CANONICAL_QA],
    {
      authorityFilterEnabled: true,
      hasConfig: () => true,
      getClient: () => client,
    }
  );
  assert.equal(result.mode, "dual_read_canonical_plus_legacy");
  assert.equal(result.rows.length, 1);
  assert.equal(result.rows[0].email, REAL_USER.email);
  assert.equal(calls[0].name, QA_QUARANTINE_LIST_ACTIVE_RPC);
  assert.match(read(FORWARD_SQL), /is_super_admin\s*\(\s*\)/);
});

test("2) SYSTEM_TECHNICIAN supported platform-directory read works", () => {
  const sql = read(FORWARD_SQL);
  assert.match(sql, /qa_quarantine_is_directory_filter_reader/);
  assert.match(sql, /SYSTEM_TECHNICIAN/);
  assert.match(
    sql,
    /qa_quarantine_is_directory_filter_reader\s*\(\s*\)[\s\S]{0,200}QA_QUARANTINE_FORBIDDEN|IF NOT public\.qa_quarantine_is_directory_filter_reader/
  );
  const listBody = sql.match(
    /create\s+or\s+replace\s+function\s+public\.qa_quarantine_list_active[\s\S]*?\$\$;/i
  );
  assert.ok(listBody);
  assert.match(listBody[0], /qa_quarantine_is_directory_filter_reader/);
  assert.doesNotMatch(listBody[0], /qa_quarantine_is_authorized_caller\s*\(\s*\)/);
});

test("3) SYSTEM_TECHNICIAN cannot mutate quarantine lifecycle", () => {
  const sql = read(FORWARD_SQL);
  const writerAuthz = sql.match(
    /create\s+or\s+replace\s+function\s+public\.qa_quarantine_is_authorized_caller[\s\S]*?\$\$;/i
  );
  assert.ok(writerAuthz);
  assert.doesNotMatch(writerAuthz[0], /SYSTEM_TECHNICIAN/);
  for (const writer of [
    "qa_quarantine_prepare",
    "qa_quarantine_activate_after_auth_ban",
    "qa_quarantine_release",
  ]) {
    const block = sql.match(
      new RegExp(
        `create\\s+or\\s+replace\\s+function\\s+public\\.${writer}[\\s\\S]*?\\$\\$;`,
        "i"
      )
    );
    assert.ok(block, writer);
    assert.match(block[0], /qa_quarantine_is_authorized_caller\s*\(\s*\)/);
  }
});

test("4) service_role behavior remains correct", () => {
  const sql = read(FORWARD_SQL);
  assert.match(sql, /qa_quarantine_is_service_role/);
  const reader = sql.match(
    /create\s+or\s+replace\s+function\s+public\.qa_quarantine_is_directory_filter_reader[\s\S]*?\$\$;/i
  );
  assert.ok(reader);
  assert.match(reader[0], /qa_quarantine_is_service_role\s*\(\s*\)/);
  const writer = sql.match(
    /create\s+or\s+replace\s+function\s+public\.qa_quarantine_is_authorized_caller[\s\S]*?\$\$;/i
  );
  assert.ok(writer);
  assert.match(writer[0], /qa_quarantine_is_service_role\s*\(\s*\)/);
});

test("5) authority queries per Players page <= 1", async () => {
  assert.equal(MAX_QUARANTINE_AUTHORITY_QUERIES_PER_PAGE, 1);
  const { client, calls } = mockRpcClient(() => ({ data: [], error: null }));
  const ids = Array.from({ length: 120 }, (_, i) => makeUuid(i + 1));
  const rows = ids.map((id) => ({
    id: `profile-${id}`,
    authUserId: id,
    email: `${id.slice(-4)}@example.com`,
  }));
  const result = await listActiveQaQuarantineMembership(ids, {
    authorityFilterEnabled: true,
    hasConfig: () => true,
    getClient: () => client,
  });
  assert.equal(result.queryCount, 1);
  assert.ok(result.queryCount <= MAX_QUARANTINE_AUTHORITY_QUERIES_PER_PAGE);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].args.p_profile_ids.length, rows.length);
});

test("6) large directory (>500 identities) still performs one authority query", async () => {
  const { client, calls } = mockRpcClient((_name, args) => {
    assert.ok(args.p_profile_ids.length > 500);
    return { data: [{ profile_id: args.p_profile_ids[0] }], error: null };
  });
  const ids = Array.from({ length: 600 }, (_, i) => makeUuid(i + 1));
  const result = await listActiveQaQuarantineMembership(ids, {
    authorityFilterEnabled: true,
    hasConfig: () => true,
    getClient: () => client,
  });
  assert.equal(calls.length, 1);
  assert.equal(result.queryCount, 1);
  assert.equal(result.ok, true);
  assert.ok(result.activeProfileIds.has(ids[0]));
});

test("7) large directory quarantine membership is correct", async () => {
  const quarantined = [makeUuid(1), makeUuid(250), makeUuid(600)];
  const ids = Array.from({ length: 600 }, (_, i) => makeUuid(i + 1));
  const { client } = mockRpcClient((_name, args) => ({
    data: quarantined
      .filter((id) => args.p_profile_ids.includes(id))
      .map((profile_id) => ({ profile_id })),
    error: null,
  }));
  const rows = ids.map((id, index) => ({
    id: `profile-${id}`,
    authUserId: id,
    email: `user${index}@example.com`,
    name: `User ${index}`,
  }));
  const result = await excludeQaTestIdentitiesWithAuthority(rows, {
    authorityFilterEnabled: true,
    hasConfig: () => true,
    getClient: () => client,
  });
  assert.equal(result.authority.queryCount, 1);
  assert.equal(result.rows.length, 597);
  for (const id of quarantined) {
    assert.equal(
      result.rows.some((r) => r.authUserId === id),
      false
    );
  }
});

test("8) RPC error remains fail-open for legitimate real users", async () => {
  const { client } = mockRpcClient(() => ({
    data: null,
    error: { code: "57014", message: "statement timeout" },
  }));
  const result = await excludeQaTestIdentitiesWithAuthority(
    [REAL_USER, CANONICAL_QA],
    {
      authorityFilterEnabled: true,
      hasConfig: () => true,
      getClient: () => client,
    }
  );
  assert.equal(result.authority.status, QA_QUARANTINE_READ_STATUS.ERROR);
  assert.equal(result.authority.fallback, "legacy_qa_signals_only");
  assert.equal(result.rows.length, 2);
});

test("9) canonical active QA identity remains excluded", async () => {
  const { client } = mockRpcClient(() => ({
    data: [{ profile_id: CANONICAL_QA.authUserId }],
    error: null,
  }));
  const result = await excludeQaTestIdentitiesWithAuthority(
    [REAL_USER, CANONICAL_QA, LOOKALIKE_REAL],
    {
      authorityFilterEnabled: true,
      hasConfig: () => true,
      getClient: () => client,
    }
  );
  assert.deepEqual(
    result.rows.map((r) => r.email).sort(),
    [LOOKALIKE_REAL.email, REAL_USER.email].sort()
  );
  assert.equal(
    classifyQaTestIdentity(
      { ...CANONICAL_QA, qaAuthorityActive: true },
      { authorityFilterEnabled: true }
    ).source,
    QA_IDENTITY_SIGNAL.CANONICAL_AUTHORITY
  );
});

test("10) browser-facing authority payload contains only minimum membership fields", async () => {
  assert.equal(QA_QUARANTINE_LIST_ACTIVE_SELECT, "profile_id");
  const { client, calls } = mockRpcClient(() => ({
    data: [
      {
        profile_id: CANONICAL_QA.authUserId,
        // If wider payload leaked, projector still only keeps profile_id membership.
        batch_id: "should-not-reach-consumer",
        allowlist_label: "secret-label",
        expected_email: "leak@example.com",
      },
    ],
    error: null,
  }));
  const result = await listActiveQaQuarantineMembership([CANONICAL_QA.authUserId], {
    authorityFilterEnabled: true,
    hasConfig: () => true,
    getClient: () => client,
  });
  assert.equal(calls[0].select, "profile_id");
  assert.deepEqual(result.selectedFields, ["profile_id"]);
  assert.deepEqual([...result.activeProfileIds], [CANONICAL_QA.authUserId]);

  const projected = projectCanonicalAuthorityOntoRows(
    [CANONICAL_QA],
    result.activeProfileIds
  )[0];
  const serialized = JSON.stringify(projected);
  assert.equal(serialized.includes("should-not-reach-consumer"), false);
  assert.equal(serialized.includes("secret-label"), false);
  assert.equal(serialized.includes("leak@example.com"), false);
  assert.equal(projected.qaAuthorityActive, true);

  const forward = read(FORWARD_SQL);
  const returns = forward.match(
    /create\s+or\s+replace\s+function\s+public\.qa_quarantine_list_active\s*\([\s\S]*?\)\s*returns\s+table\s*\(([\s\S]*?)\)\s*language/i
  );
  assert.ok(returns);
  assert.equal(returns[1].trim().toLowerCase(), "profile_id uuid");
});

test("11) generic unrelated UUID id cannot false-match quarantine membership", () => {
  const playerRosterId = CANONICAL_QA.authUserId; // UUID-shaped but NOT a profile binding
  const row = {
    id: playerRosterId,
    email: "club.blob.player@example.com",
    name: "Blob Player",
  };
  assert.deepEqual(extractProfileKeysFromRow(row), []);
  assert.deepEqual(collectProfileIdsForQuarantineLookup([row]), []);

  const projected = projectCanonicalAuthorityOntoRows(
    [row],
    new Set([playerRosterId])
  )[0];
  assert.equal(projected.qaAuthorityActive, undefined);

  // Explicit bindings still work.
  assert.ok(
    extractProfileKeysFromRow({
      authUserId: CANONICAL_QA.authUserId,
      id: "player-local-1",
    }).includes(CANONICAL_QA.authUserId)
  );
  assert.ok(
    extractProfileKeysFromRow({
      id: `profile-${CANONICAL_QA.authUserId}`,
    }).includes(CANONICAL_QA.authUserId)
  );
});

test("12) legacy rollback flag still restores prior behavior", async () => {
  assert.equal(
    isQaQuarantineAuthorityFilterEnabled({
      [QA_QUARANTINE_AUTHORITY_FILTER_FLAG]: "false",
    }),
    false
  );
  const { client, calls } = mockRpcClient(() => ({
    data: [{ profile_id: CANONICAL_QA.authUserId }],
    error: null,
  }));
  const rolledBack = await excludeQaTestIdentitiesWithAuthority(
    [REAL_USER, CANONICAL_QA, CERTIFIED_QA],
    {
      authorityFilterEnabled: false,
      hasConfig: () => true,
      getClient: () => client,
    }
  );
  assert.equal(rolledBack.mode, "legacy_only");
  assert.equal(calls.length, 0);
  assert.deepEqual(
    rolledBack.rows.map((r) => r.email).sort(),
    [CANONICAL_QA.email, REAL_USER.email].sort()
  );
  assert.match(
    read("src/features/player/config/qaQuarantineFilterFlags.js"),
    /LEGACY FALLBACK REMOVAL POINT/
  );
});

test("13) no profiles.status mutation", () => {
  for (const rel of [
    "src/features/player/utils/qaTestIdentityFilter.js",
    "src/features/player/utils/qaQuarantineAuthorityRead.js",
    "src/pages/Players.jsx",
    FORWARD_SQL,
  ]) {
    const src = read(rel);
    assert.equal(/status\s*:\s*['"]quarantined['"]/.test(src), false, rel);
    assert.equal(
      /update\s+public\.profiles|from\(\s*['"]profiles['"]\s*\)[\s\S]{0,80}\.update\(/i.test(
        src
      ),
      false,
      rel
    );
  }
});

test("14) no auth.users mutation", () => {
  for (const rel of [
    "src/features/player/utils/qaTestIdentityFilter.js",
    "src/features/player/utils/qaQuarantineAuthorityRead.js",
    "src/pages/Players.jsx",
  ]) {
    const src = read(rel);
    assert.equal(/\.from\(\s*['"]auth\.users['"]\s*\)/.test(src), false, rel);
    assert.equal(
      /auth\.admin\.(banUser|updateUserById)|banned_until\s*:/.test(src),
      false,
      rel
    );
  }
});

test("15) no gender-hotfix changes", () => {
  for (const rel of [
    "src/features/player/utils/qaTestIdentityFilter.js",
    "src/features/player/utils/qaQuarantineAuthorityRead.js",
    "src/features/player/config/qaQuarantineFilterFlags.js",
  ]) {
    const src = read(rel);
    assert.equal(/genderKey|normalizeGender|gender-display|athleteGenderDisplayLabel/.test(src), false, rel);
  }
});

test("16) qa_quarantine_list_active_batched remains absent", async () => {
  assert.equal(
    FORBIDDEN_QA_QUARANTINE_LIST_ACTIVE_BATCHED,
    "qa_quarantine_list_active_batched"
  );
  const forward = read(FORWARD_SQL);
  assert.equal(
    /create\s+or\s+replace\s+function\s+public\.qa_quarantine_list_active_batched\b/i.test(
      forward
    ),
    false
  );
  const { client, calls } = mockRpcClient(() => ({ data: [], error: null }));
  await listActiveQaQuarantineMembership([REAL_USER.authUserId], {
    authorityFilterEnabled: true,
    hasConfig: () => true,
    getClient: () => client,
  });
  assert.ok(calls.every((c) => c.name === QA_QUARANTINE_LIST_ACTIVE_RPC));
});

test("17) Tournament behavior/contracts are not modified", () => {
  // Corrective scope must not touch tournament-owned paths or import tournament modules.
  for (const rel of [
    "src/features/player/utils/qaTestIdentityFilter.js",
    "src/features/player/utils/qaQuarantineAuthorityRead.js",
    "src/features/player/config/qaQuarantineFilterFlags.js",
    "src/pages/Players.jsx",
    FORWARD_SQL,
    "docs/v5/operations/production-qa-identity-operation-b1b-remediation/sql/80_QA_IDENTITY_QUARANTINE_AUTHORITY_ROLLBACK.sql",
  ]) {
    const src = read(rel);
    assert.equal(/src\/pages\/tournament\//i.test(src), false, rel);
    assert.equal(/src\/tournament\//i.test(src), false, rel);
    assert.equal(/features\/competition-core\//i.test(src), false, rel);
  }
});

test("canonical unavailable is observable for DEV/ops", () => {
  const logs = [];
  observeQaQuarantineAuthorityAvailability(
    {
      status: QA_QUARANTINE_READ_STATUS.UNAVAILABLE,
      reason: "supabase_unconfigured",
      fallback: "legacy_qa_signals_only",
      rpcName: QA_QUARANTINE_LIST_ACTIVE_RPC,
      queryCount: 0,
    },
    {
      forceLog: true,
      logger: { info: (...args) => logs.push(args) },
    }
  );
  assert.equal(logs.length, 1);
  assert.equal(logs[0][0], "[qa-quarantine-authority]");
  assert.equal(logs[0][1].status, "unavailable");
  assert.equal(logs[0][1].legacyFallbackTransitional, true);
  assert.equal("email" in logs[0][1], false);
});

test("legacy dual-read compatibility + precedence retained", async () => {
  assert.deepEqual(
    QA_IDENTITY_DUAL_READ_PRECEDENCE[0],
    QA_IDENTITY_SIGNAL.CANONICAL_AUTHORITY
  );
  const { client } = mockRpcClient(() => ({ data: [], error: null }));
  const result = await excludeQaTestIdentitiesWithAuthority(
    [
      REAL_USER,
      { ...REAL_USER, authUserId: makeUuid(9), email: "a@x.com", quarantined: true },
      CERTIFIED_QA,
    ],
    {
      authorityFilterEnabled: true,
      hasConfig: () => true,
      getClient: () => client,
    }
  );
  assert.equal(result.rows.length, 1);
  assert.equal(result.rows[0].email, REAL_USER.email);
});

test("Players search/filter still works for legitimate users", async () => {
  const { client } = mockRpcClient(() => ({
    data: [{ profile_id: CANONICAL_QA.authUserId }],
    error: null,
  }));
  const result = await excludeQaTestIdentitiesWithAuthority(
    [REAL_USER, CANONICAL_QA, LOOKALIKE_REAL],
    {
      authorityFilterEnabled: true,
      hasConfig: () => true,
      getClient: () => client,
    }
  );
  const searched = filterPlayers(result.rows, {
    search: "Real Player",
    genderFilter: "all",
    levelRange: [1, 8],
    statusFilter: "all",
  });
  assert.equal(searched.length, 1);
  assert.equal(isCertifiedQaEmail(LOOKALIKE_REAL.email), false);
  assert.equal(QA_QUARANTINE_LIST_ACTIVE_MAX_IDS, 10000);
});

test("sync excludeQaTestIdentities regression — real users retained", () => {
  const visible = excludeQaTestIdentities([
    REAL_USER,
    CERTIFIED_QA,
    LOOKALIKE_REAL,
    { email: "x@y.com", status: "quarantined" },
  ]);
  assert.deepEqual(
    visible.map((r) => r.email).sort(),
    [LOOKALIKE_REAL.email, REAL_USER.email].sort()
  );
  assert.equal(isConfirmedQaTestIdentity(REAL_USER), false);
});

test("Players.jsx wires authority exclusion helper", () => {
  const src = read("src/pages/Players.jsx");
  assert.match(src, /excludeQaTestIdentitiesWithAuthority/);
});

test("helpers — error classification", () => {
  assert.equal(
    classifyQaQuarantineRpcError({
      code: "PGRST202",
      message: "Could not find the function",
    }),
    QA_QUARANTINE_READ_STATUS.UNAVAILABLE
  );
  assert.equal(
    classifyQaQuarantineRpcError({
      code: "P0001",
      message: "QA_QUARANTINE_FORBIDDEN",
    }),
    QA_QUARANTINE_READ_STATUS.FORBIDDEN
  );
  assert.equal(
    projectActiveMembershipIds([{ profile_id: CANONICAL_QA.authUserId }]).has(
      CANONICAL_QA.authUserId
    ),
    true
  );
});
