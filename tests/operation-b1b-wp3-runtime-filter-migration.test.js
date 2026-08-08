/**
 * OPERATION_B1B WP3 — runtime / filter migration unit proofs.
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
  FORBIDDEN_QA_QUARANTINE_LIST_ACTIVE_BATCHED,
  listActiveQaQuarantineMembership,
  projectActiveMembershipIds,
  projectCanonicalAuthorityOntoRows,
  QA_QUARANTINE_LIST_ACTIVE_RPC,
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

const REAL_USER = {
  id: "11111111-1111-4111-8111-111111111111",
  authUserId: "11111111-1111-4111-8111-111111111111",
  email: "real.player@gmail.com",
  name: "Real Player",
  gender: "Nam",
  level: 3.5,
  status: "active",
};

const CANONICAL_QA = {
  id: "22222222-2222-4222-8222-222222222222",
  authUserId: "22222222-2222-4222-8222-222222222222",
  email: "canonical.qa@example.com",
  name: "Canonical QA",
  gender: "Nữ",
  level: 4,
  status: "active",
};

const CERTIFIED_QA = {
  id: "33333333-3333-4333-8333-333333333333",
  authUserId: "33333333-3333-4333-8333-333333333333",
  email: "phase1b-smoke-1@pickleball-scheduler.qa",
  name: "Certified QA",
  gender: "Nam",
  level: 3,
  status: "active",
};

const LOOKALIKE_REAL = {
  id: "44444444-4444-4444-8444-444444444444",
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
      async rpc(name, args) {
        calls.push({ name, args });
        return handler(name, args, calls.length);
      },
    },
  };
}

test("1) canonical active quarantine identity is excluded", async () => {
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
  assert.equal(calls.length, 1);
  assert.equal(calls[0].name, QA_QUARANTINE_LIST_ACTIVE_RPC);
  assert.equal(
    classifyQaTestIdentity({ ...CANONICAL_QA, qaAuthorityActive: true }, {
      authorityFilterEnabled: true,
    }).source,
    QA_IDENTITY_SIGNAL.CANONICAL_AUTHORITY
  );
});

test("2) non-quarantined real user remains visible", async () => {
  const { client } = mockRpcClient(() => ({ data: [], error: null }));
  const result = await excludeQaTestIdentitiesWithAuthority([REAL_USER], {
    authorityFilterEnabled: true,
    hasConfig: () => true,
    getClient: () => client,
  });
  assert.equal(result.rows.length, 1);
  assert.equal(result.rows[0].email, REAL_USER.email);
  assert.equal(isConfirmedQaTestIdentity(REAL_USER), false);
});

test("3) empty canonical result preserves real users", async () => {
  const { client } = mockRpcClient(() => ({ data: [], error: null }));
  const result = await excludeQaTestIdentitiesWithAuthority(
    [REAL_USER, LOOKALIKE_REAL],
    {
      authorityFilterEnabled: true,
      hasConfig: () => true,
      getClient: () => client,
    }
  );
  assert.equal(result.rows.length, 2);
  assert.deepEqual(
    result.rows.map((r) => r.email).sort(),
    [LOOKALIKE_REAL.email, REAL_USER.email].sort()
  );
});

test("4) canonical RPC unavailable uses bounded migration fallback", async () => {
  const { client, calls } = mockRpcClient(() => ({
    data: null,
    error: {
      code: "PGRST202",
      message: "Could not find the function public.qa_quarantine_list_active",
    },
  }));

  const result = await excludeQaTestIdentitiesWithAuthority(
    [REAL_USER, CERTIFIED_QA, LOOKALIKE_REAL],
    {
      authorityFilterEnabled: true,
      hasConfig: () => true,
      getClient: () => client,
    }
  );

  assert.equal(result.mode, "dual_read_legacy_fallback");
  assert.equal(result.authority.status, QA_QUARANTINE_READ_STATUS.UNAVAILABLE);
  assert.equal(result.authority.fallback, "legacy_qa_signals_only");
  assert.equal(result.authority.activeProfileIds.size, 0);
  assert.equal(calls[0].name, QA_QUARANTINE_LIST_ACTIVE_RPC);
  // Certified email still excluded via legacy; real + lookalike retained.
  assert.deepEqual(
    result.rows.map((r) => r.email).sort(),
    [LOOKALIKE_REAL.email, REAL_USER.email].sort()
  );
});

test("5) canonical RPC error does not silently classify real users as quarantined", async () => {
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
  // CANONICAL_QA has no legacy/email signal → must remain visible on error.
  assert.equal(result.rows.length, 2);
  assert.ok(result.rows.some((r) => r.email === CANONICAL_QA.email));
  assert.ok(result.rows.some((r) => r.email === REAL_USER.email));
});

test("6) legacy QA behavior remains compatible during dual-read", async () => {
  const { client } = mockRpcClient(() => ({ data: [], error: null }));
  const legacyRows = [
    REAL_USER,
    { ...REAL_USER, id: "a", authUserId: "55555555-5555-4555-8555-555555555555", email: "a@x.com", quarantined: true },
    { ...REAL_USER, id: "b", authUserId: "66666666-6666-4666-8666-666666666666", email: "b@x.com", meta: { qaQuarantined: true } },
    { ...REAL_USER, id: "c", authUserId: "77777777-7777-4777-8777-777777777777", email: "c@x.com", status: "quarantined" },
    CERTIFIED_QA,
  ];

  const result = await excludeQaTestIdentitiesWithAuthority(legacyRows, {
    authorityFilterEnabled: true,
    hasConfig: () => true,
    getClient: () => client,
  });

  assert.equal(result.rows.length, 1);
  assert.equal(result.rows[0].email, REAL_USER.email);
  assert.equal(
    classifyQaTestIdentity(legacyRows[1]).source,
    QA_IDENTITY_SIGNAL.LEGACY_QUARANTINED_FLAG
  );
  assert.equal(
    classifyQaTestIdentity(legacyRows[2]).source,
    QA_IDENTITY_SIGNAL.LEGACY_META_QA_QUARANTINED
  );
  assert.equal(
    classifyQaTestIdentity(legacyRows[3]).source,
    QA_IDENTITY_SIGNAL.LEGACY_STATUS_QUARANTINED
  );
});

test("7) contradictory canonical/legacy states follow documented precedence", () => {
  assert.deepEqual(QA_IDENTITY_DUAL_READ_PRECEDENCE[0], QA_IDENTITY_SIGNAL.CANONICAL_AUTHORITY);

  // Both positive → source label is canonical (precedence), still excluded.
  const both = classifyQaTestIdentity(
    {
      email: "x@y.com",
      qaAuthorityActive: true,
      status: "quarantined",
      quarantined: true,
    },
    { authorityFilterEnabled: true }
  );
  assert.equal(both.excluded, true);
  assert.equal(both.source, QA_IDENTITY_SIGNAL.CANONICAL_AUTHORITY);

  // Canonical not active + legacy positive → legacy still excludes (not cleared).
  const legacyOnly = classifyQaTestIdentity(
    { email: "x@y.com", qaAuthorityActive: false, status: "quarantined" },
    { authorityFilterEnabled: true }
  );
  assert.equal(legacyOnly.excluded, true);
  assert.equal(legacyOnly.source, QA_IDENTITY_SIGNAL.LEGACY_STATUS_QUARANTINED);

  // Canonical active + no legacy → canonical excludes.
  const canonicalOnly = classifyQaTestIdentity(
    { email: "not-qa@gmail.com", qaAuthorityActive: true },
    { authorityFilterEnabled: true }
  );
  assert.equal(canonicalOnly.excluded, true);
  assert.equal(canonicalOnly.source, QA_IDENTITY_SIGNAL.CANONICAL_AUTHORITY);
});

test("8) no profiles.status mutation in WP3 runtime modules", () => {
  const files = [
    "src/features/player/utils/qaTestIdentityFilter.js",
    "src/features/player/utils/qaQuarantineAuthorityRead.js",
    "src/features/player/config/qaQuarantineFilterFlags.js",
    "src/pages/Players.jsx",
  ];
  for (const rel of files) {
    const src = read(rel);
    assert.equal(
      /status\s*:\s*['"]quarantined['"]/.test(src),
      false,
      `${rel} must not write status quarantined`
    );
    assert.equal(
      /\.update\(/.test(src) && /profiles/.test(src),
      false,
      `${rel} must not update profiles`
    );
  }
});

test("9) no auth.users mutation in WP3 runtime modules", () => {
  const files = [
    "src/features/player/utils/qaTestIdentityFilter.js",
    "src/features/player/utils/qaQuarantineAuthorityRead.js",
    "src/pages/Players.jsx",
  ];
  for (const rel of files) {
    const src = read(rel);
    // Allow documentation mentions; forbid mutation call sites.
    assert.equal(
      /\.from\(\s*['"]auth\.users['"]\s*\)/.test(src),
      false,
      rel
    );
    assert.equal(
      /auth\.admin\.(banUser|updateUserById)|banned_until\s*:/.test(src),
      false,
      rel
    );
  }
});

test("10) Players count excludes only quarantined QA identities", async () => {
  const { client } = mockRpcClient((_name, args) => {
    const ids = args.p_profile_ids || [];
    const hit = ids.includes(CANONICAL_QA.authUserId)
      ? [{ profile_id: CANONICAL_QA.authUserId }]
      : [];
    return { data: hit, error: null };
  });

  const roster = [REAL_USER, CANONICAL_QA, CERTIFIED_QA, LOOKALIKE_REAL];
  const result = await excludeQaTestIdentitiesWithAuthority(roster, {
    authorityFilterEnabled: true,
    hasConfig: () => true,
    getClient: () => client,
  });

  // Exclude: canonical authority + certified email. Keep real + lookalike.
  assert.equal(result.rows.length, 2);
  assert.deepEqual(
    result.rows.map((r) => r.email).sort(),
    [LOOKALIKE_REAL.email, REAL_USER.email].sort()
  );
});

test("11) Players search/filter still works for legitimate users", async () => {
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
  assert.equal(searched[0].email, REAL_USER.email);

  const genderFiltered = filterPlayers(result.rows, {
    search: "",
    genderFilter: "female",
    levelRange: [1, 8],
    statusFilter: "all",
  });
  assert.ok(genderFiltered.every((p) => p.email !== CANONICAL_QA.email));
  assert.ok(genderFiltered.some((p) => p.email === LOOKALIKE_REAL.email));
});

test("12) qa_quarantine_list_active is canonical in runtime", () => {
  assert.equal(QA_QUARANTINE_LIST_ACTIVE_RPC, "qa_quarantine_list_active");
  const readSrc = read("src/features/player/utils/qaQuarantineAuthorityRead.js");
  assert.match(readSrc, /qa_quarantine_list_active/);
  assert.match(readSrc, /Canonical RPC/);
  const filterSrc = read("src/features/player/utils/qaTestIdentityFilter.js");
  assert.match(filterSrc, /qa_quarantine_list_active/);
});

test("13) qa_quarantine_list_active_batched remains absent from runtime", async () => {
  assert.equal(
    FORBIDDEN_QA_QUARANTINE_LIST_ACTIVE_BATCHED,
    "qa_quarantine_list_active_batched"
  );
  const runtimeFiles = [
    "src/features/player/utils/qaQuarantineAuthorityRead.js",
    "src/features/player/utils/qaTestIdentityFilter.js",
    "src/features/player/config/qaQuarantineFilterFlags.js",
    "src/pages/Players.jsx",
  ];
  for (const rel of runtimeFiles) {
    const src = read(rel);
    // May mention the forbidden name as a comment/constant, but must never rpc() it.
    assert.equal(
      /\.rpc\s*\(\s*['"]qa_quarantine_list_active_batched['"]/.test(src),
      false,
      rel
    );
  }

  const { client, calls } = mockRpcClient(() => ({ data: [], error: null }));
  await listActiveQaQuarantineMembership([REAL_USER.authUserId], {
    authorityFilterEnabled: true,
    hasConfig: () => true,
    getClient: () => client,
  });
  assert.ok(calls.every((c) => c.name === QA_QUARANTINE_LIST_ACTIVE_RPC));
  assert.ok(calls.every((c) => c.name !== FORBIDDEN_QA_QUARANTINE_LIST_ACTIVE_BATCHED));

  const forward = read(
    "docs/v5/operations/production-qa-identity-operation-b1b-remediation/sql/20_QA_IDENTITY_QUARANTINE_AUTHORITY_FORWARD.sql"
  );
  assert.equal(
    /create\s+or\s+replace\s+function\s+public\.qa_quarantine_list_active_batched\b/i.test(
      forward
    ),
    false
  );
});

test("14) sensitive quarantine fields are not exposed to consumers", () => {
  const projectedIds = projectActiveMembershipIds([
    {
      profile_id: CANONICAL_QA.authUserId,
      expected_email: "secret@qa.example",
      allowlist_sha256: "aaa",
      snapshot_sha256: "bbb",
      reason: "do-not-leak",
      allowlist_label: "batch-label",
      auth_user_id: CANONICAL_QA.authUserId,
      batch_id: "99999999-9999-4999-8999-999999999999",
    },
  ]);
  assert.deepEqual([...projectedIds], [CANONICAL_QA.authUserId]);

  const rows = projectCanonicalAuthorityOntoRows([CANONICAL_QA], projectedIds);
  const enriched = rows[0];
  assert.equal(enriched.qaAuthorityActive, true);
  assert.equal("expected_email" in enriched, false);
  assert.equal("allowlist_sha256" in enriched, false);
  assert.equal("snapshot_sha256" in enriched, false);
  assert.equal("reason" in enriched, false);
  assert.equal("allowlist_label" in enriched, false);
  assert.equal("batch_id" in enriched, false);

  const serialized = JSON.stringify(enriched);
  assert.equal(serialized.includes("secret@qa.example"), false);
  assert.equal(serialized.includes("do-not-leak"), false);
  assert.equal(serialized.includes("allowlist_sha"), false);
});

test("15) feature-flag rollback restores previous filtering behavior", async () => {
  assert.equal(QA_QUARANTINE_AUTHORITY_FILTER_FLAG, "VITE_QA_QUARANTINE_AUTHORITY_FILTER_ENABLED");
  assert.equal(
    isQaQuarantineAuthorityFilterEnabled({
      [QA_QUARANTINE_AUTHORITY_FILTER_FLAG]: "false",
    }),
    false
  );
  assert.equal(
    isQaQuarantineAuthorityFilterEnabled({
      [QA_QUARANTINE_AUTHORITY_FILTER_FLAG]: "true",
    }),
    true
  );

  const { client, calls } = mockRpcClient(() => ({
    data: [{ profile_id: CANONICAL_QA.authUserId }],
    error: null,
  }));

  // Flag OFF: ignore canonical membership even if we could fetch it; no RPC.
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
  // Prior behavior: certified email hidden; non-certified CANONICAL_QA visible.
  assert.deepEqual(
    rolledBack.rows.map((r) => r.email).sort(),
    [CANONICAL_QA.email, REAL_USER.email].sort()
  );

  // Sync path with flag off also ignores projected qaAuthorityActive.
  assert.equal(
    isConfirmedQaTestIdentity(
      { ...CANONICAL_QA, qaAuthorityActive: true },
      { authorityFilterEnabled: false }
    ),
    false
  );
});

test("helpers — profile id collection and error classification", () => {
  const ids = collectProfileIdsForQuarantineLookup([
    REAL_USER,
    { id: "profile-not-uuid", authUserId: CANONICAL_QA.authUserId },
    { id: "not-a-uuid" },
  ]);
  assert.ok(ids.includes(REAL_USER.authUserId));
  assert.ok(ids.includes(CANONICAL_QA.authUserId));
  assert.equal(ids.includes("not-a-uuid"), false);

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
  assert.equal(isCertifiedQaEmail(LOOKALIKE_REAL.email), false);
});

test("Players.jsx wires authority exclusion helper (not sync-only legacy)", () => {
  const src = read("src/pages/Players.jsx");
  assert.match(src, /excludeQaTestIdentitiesWithAuthority/);
  assert.equal(/excludeQaTestIdentities\s*\(/.test(src), false);
});

test("gender hotfix not mixed into WP3 production filter modules", () => {
  const filterSrc = read("src/features/player/utils/qaTestIdentityFilter.js");
  const readSrc = read("src/features/player/utils/qaQuarantineAuthorityRead.js");
  for (const src of [filterSrc, readSrc]) {
    assert.equal(/genderKey|normalizeGender|gender-display/.test(src), false);
  }
});
