/**
 * CORE-13 disposable Staging fixture receipt — provenance SSOT.
 * Test/acceptance tooling only. Not product/browser runtime.
 * UUIDs stay canonical; ownership is receipt + runId, not ID substring.
 */

import { readFileSync } from "node:fs";
import { CORE13_FIXTURE_NAMESPACE } from "./core13-staging-acceptance-proofs.mjs";

export const FIXTURE_RECEIPT_SCHEMA_VERSION = 1;
export const FIXTURE_PROVISIONER_ID = "core13-staging-fixture-provisioner-v1";
export const STAGING_PROJECT_REF = "qyewbxjsiiyufanzcjcq";
export const PRODUCTION_PROJECT_REF = "expuvcohlcjzvrrauvud";
export const RECEIPT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export const REQUIRED_USER_KEYS = Object.freeze([
  "userA",
  "userB",
  "refereeA",
  "replacementReferee",
  "inactiveReferee",
  "nonCanonicalSubject",
]);

export const REQUIRED_MATCH_KEYS = Object.freeze([
  "preMatch",
  "overlapA",
  "overlapB",
  "nonOverlap",
  "inProgress",
  "scoringActive",
  "locked",
  "completed",
  "dailyEnabled",
  "dailyDisabled",
]);

export const REQUIRED_TOURNAMENT_KEYS = Object.freeze([
  "primary",
  "crossTournament",
  "dailyEnabled",
  "dailyDisabled",
]);

const SECRET_KEY_RE =
  /password|passwd|secret|token|jwt|service[_-]?role|anon[_-]?key|access[_-]?token|authorization|bearer/i;
const JWT_LIKE_RE = /eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]+\./;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function proof(ok, detail) {
  return Object.freeze({ ok: ok === true, detail: String(detail || "") });
}

function entityId(entity) {
  if (entity == null) return "";
  if (typeof entity === "string") return entity.trim();
  return String(entity.id || entity.userId || entity.matchId || entity.tournamentId || "").trim();
}

export function isCanonicalUuid(value) {
  return UUID_RE.test(String(value || "").trim());
}

export function receiptContainsSecrets(value) {
  if (Array.isArray(value)) return value.some((item) => receiptContainsSecrets(item));
  if (value && typeof value === "object") {
    return Object.entries(value).some(
      ([key, child]) => SECRET_KEY_RE.test(key) || receiptContainsSecrets(child)
    );
  }
  return typeof value === "string" && JWT_LIKE_RE.test(value);
}

export function projectRefFromSupabaseUrl(url) {
  const match = String(url || "").match(/https?:\/\/([a-z0-9]+)\.supabase\.co/i);
  return match ? match[1] : "";
}

export function evaluatePhysicalEnvironment(receipt, envMap = {}) {
  const receiptOk = evaluateFixtureReceipt(receipt);
  if (!receiptOk.ok) return receiptOk;
  const url = String(envMap.STAGING_SUPABASE_URL || envMap.SUPABASE_URL || "").trim();
  if (url) {
    const extracted = projectRefFromSupabaseUrl(url);
    if (extracted && extracted !== receipt.projectRef) {
      return proof(false, "physical projectRef mismatch");
    }
    if (PRODUCTION_PROJECT_REF && url.includes(PRODUCTION_PROJECT_REF)) {
      return proof(false, "Production URL denied");
    }
  }
  const envName = String(envMap.PICK_VN_ENV || "").trim().toLowerCase();
  if (envName && envName !== "staging") {
    return proof(false, "PICK_VN_ENV must be staging");
  }
  return proof(true, receipt.projectRef);
}

export function stripReceiptSecrets(value, trail = "") {
  if (Array.isArray(value)) {
    return value.map((item, index) => stripReceiptSecrets(item, `${trail}[${index}]`));
  }
  if (!value || typeof value !== "object") return value;
  const out = {};
  for (const [key, child] of Object.entries(value)) {
    if (SECRET_KEY_RE.test(key)) continue;
    out[key] = stripReceiptSecrets(child, `${trail}.${key}`);
  }
  return out;
}

export function listReceiptOwnedIds(receipt = {}) {
  const ids = new Set();
  const push = (entity) => {
    const id = entityId(entity);
    if (id) ids.add(id);
  };
  push(receipt.tenantA);
  push(receipt.tenantB);
  for (const key of REQUIRED_USER_KEYS) push(receipt.users?.[key]);
  for (const key of REQUIRED_TOURNAMENT_KEYS) push(receipt.tournaments?.[key]);
  for (const key of REQUIRED_MATCH_KEYS) push(receipt.matches?.[key]);
  return ids;
}

export function createValidFixtureReceipt(overrides = {}) {
  const runId = overrides.runId || `run-${Date.now()}`;
  const base = {
    schemaVersion: FIXTURE_RECEIPT_SCHEMA_VERSION,
    namespace: CORE13_FIXTURE_NAMESPACE,
    runId,
    disposable: true,
    createdAt: new Date().toISOString(),
    environment: "staging",
    projectRef: STAGING_PROJECT_REF,
    provisioner: FIXTURE_PROVISIONER_ID,
    tenantA: {
      id: "core13-qa-tenant-a",
      name: `${CORE13_FIXTURE_NAMESPACE} Tenant A ${runId}`,
      marker: CORE13_FIXTURE_NAMESPACE,
    },
    tenantB: {
      id: "core13-qa-tenant-b",
      name: `${CORE13_FIXTURE_NAMESPACE} Tenant B ${runId}`,
      marker: CORE13_FIXTURE_NAMESPACE,
    },
    users: {
      userA: { id: "11111111-1111-4111-8111-111111111111", role: "TENANT_OWNER" },
      userB: { id: "22222222-2222-4222-8222-222222222222", role: "TENANT_OWNER" },
      refereeA: { id: "33333333-3333-4333-8333-333333333333", role: "REFEREE", status: "ACTIVE" },
      replacementReferee: {
        id: "44444444-4444-4444-8444-444444444444",
        role: "REFEREE",
        status: "ACTIVE",
      },
      inactiveReferee: {
        id: "55555555-5555-4555-8555-555555555555",
        role: "REFEREE",
        status: "INACTIVE",
      },
      nonCanonicalSubject: {
        id: "66666666-6666-4666-8666-666666666666",
        role: "PLAYER",
        status: "ACTIVE",
      },
    },
    tournaments: {
      primary: {
        id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
        tenantId: "core13-qa-tenant-a",
        mode: "INTERNAL",
        name: `${CORE13_FIXTURE_NAMESPACE} primary ${runId}`,
      },
      crossTournament: {
        id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2",
        tenantId: "core13-qa-tenant-a",
        mode: "INTERNAL",
        name: `${CORE13_FIXTURE_NAMESPACE} cross ${runId}`,
      },
      dailyEnabled: {
        id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3",
        tenantId: "core13-qa-tenant-a",
        mode: "DAILY_PLAY",
        name: `${CORE13_FIXTURE_NAMESPACE} daily-on ${runId}`,
      },
      dailyDisabled: {
        id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4",
        tenantId: "core13-qa-tenant-a",
        mode: "DAILY_PLAY",
        name: `${CORE13_FIXTURE_NAMESPACE} daily-off ${runId}`,
      },
    },
    matches: {
      preMatch: {
        id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1",
        tournamentId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
        lifecycle: "PRE_MATCH",
      },
      overlapA: {
        id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2",
        tournamentId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
        lifecycle: "PRE_MATCH",
      },
      overlapB: {
        id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb3",
        tournamentId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
        lifecycle: "PRE_MATCH",
      },
      nonOverlap: {
        id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb4",
        tournamentId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
        lifecycle: "PRE_MATCH",
      },
      inProgress: {
        id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb5",
        tournamentId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
        lifecycle: "IN_PROGRESS",
      },
      scoringActive: {
        id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb6",
        tournamentId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
        lifecycle: "SCORING_ACTIVE",
      },
      locked: {
        id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb7",
        tournamentId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
        lifecycle: "LOCKED",
      },
      completed: {
        id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb8",
        tournamentId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
        lifecycle: "COMPLETED",
      },
      dailyEnabled: {
        id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb9",
        tournamentId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3",
        lifecycle: "PRE_MATCH",
      },
      dailyDisabled: {
        id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbba",
        tournamentId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4",
        lifecycle: "PRE_MATCH",
      },
    },
    provenance: {
      ownershipModel: "PROVISIONER_RECEIPT",
      disposableOwnership: true,
      remoteMarker: "name/description where canonical fields already allow metadata",
      uuidNamespaceTextRequired: false,
    },
    cleanupPlan: {
      unknownBaselineAutoClean: false,
      receiptScopedOnly: true,
      unassignViaTrustedServer: true,
      immutableAuditDelete: false,
    },
  };
  return stripReceiptSecrets({ ...base, ...overrides, provenance: { ...base.provenance, ...(overrides.provenance || {}) } });
}

export function evaluateFixtureReceipt(receipt, nowMs = Date.now()) {
  if (!receipt || typeof receipt !== "object") {
    return proof(false, "receipt missing");
  }
  if (Number(receipt.schemaVersion) !== FIXTURE_RECEIPT_SCHEMA_VERSION) {
    return proof(false, `schemaVersion=${receipt.schemaVersion}`);
  }
  if (receipt.namespace !== CORE13_FIXTURE_NAMESPACE) {
    return proof(false, `namespace=${receipt.namespace || "missing"}`);
  }
  if (receipt.disposable !== true) {
    return proof(false, "disposable must be true");
  }
  if (String(receipt.environment || "").toLowerCase() !== "staging") {
    return proof(false, "environment must be staging");
  }
  if (receipt.projectRef === PRODUCTION_PROJECT_REF) {
    return proof(false, "Production projectRef denied");
  }
  if (receipt.projectRef !== STAGING_PROJECT_REF) {
    return proof(false, `projectRef=${receipt.projectRef || "missing"}`);
  }
  if (!String(receipt.runId || "").trim()) {
    return proof(false, "runId required");
  }
  if (receipt.provisioner !== FIXTURE_PROVISIONER_ID) {
    return proof(false, `provisioner=${receipt.provisioner || "missing"}`);
  }
  const created = Date.parse(receipt.createdAt || "");
  if (!Number.isFinite(created) || nowMs - created > RECEIPT_MAX_AGE_MS) {
    return proof(false, "receipt expired or missing createdAt");
  }
  const tenantA = entityId(receipt.tenantA);
  const tenantB = entityId(receipt.tenantB);
  if (!tenantA || !tenantB) return proof(false, "tenant fixtures missing");
  if (tenantA === tenantB) return proof(false, "Tenant A == Tenant B");

  for (const key of REQUIRED_USER_KEYS) {
    const id = entityId(receipt.users?.[key]);
    if (!id) return proof(false, `missing user ${key}`);
    if (!isCanonicalUuid(id)) return proof(false, `user ${key} is not a canonical UUID`);
  }
  if (entityId(receipt.users.userA) === entityId(receipt.users.userB)) {
    return proof(false, "User A == User B");
  }
  if (entityId(receipt.users.refereeA) === entityId(receipt.users.replacementReferee)) {
    return proof(false, "Referee A == replacement Referee");
  }

  for (const key of REQUIRED_TOURNAMENT_KEYS) {
    const row = receipt.tournaments?.[key];
    const id = entityId(row);
    if (!id) return proof(false, `missing tournament ${key}`);
    if (key !== "crossTournament" && String(row.tenantId || tenantA) !== tenantA) {
      return proof(false, `tournament ${key} not owned by Tenant A`);
    }
  }
  if (entityId(receipt.tournaments.primary) === entityId(receipt.tournaments.crossTournament)) {
    return proof(false, "cross-tournament must be distinct");
  }

  for (const key of REQUIRED_MATCH_KEYS) {
    const row = receipt.matches?.[key];
    const id = entityId(row);
    if (!id) return proof(false, `missing match ${key}`);
    if (!String(row.tournamentId || "").trim()) {
      return proof(false, `match ${key} missing tournamentId`);
    }
  }

  if (receiptContainsSecrets(receipt)) {
    return proof(false, "receipt contains secrets");
  }
  return proof(true, receipt.runId);
}

export function evaluateManualFixtureOverride(receipt, envMap = {}) {
  const receiptOk = evaluateFixtureReceipt(receipt);
  if (!receiptOk.ok) return receiptOk;
  const pairs = [
    ["STAGING_TENANT_A", entityId(receipt.tenantA)],
    ["STAGING_TENANT_B", entityId(receipt.tenantB)],
    ["STAGING_TOURNAMENT_A", entityId(receipt.tournaments.primary)],
    ["STAGING_TOURNAMENT_B", entityId(receipt.tournaments.crossTournament)],
    ["STAGING_MATCH_A", entityId(receipt.matches.preMatch)],
    ["STAGING_REFEREE_USER_ID", entityId(receipt.users.refereeA)],
    ["STAGING_REPLACE_REFEREE_USER_ID", entityId(receipt.users.replacementReferee)],
    ["STAGING_INACTIVE_REFEREE_ID", entityId(receipt.users.inactiveReferee)],
    ["STAGING_NON_CANONICAL_REFEREE_ID", entityId(receipt.users.nonCanonicalSubject)],
    ["STAGING_MATCH_OVERLAP_A", entityId(receipt.matches.overlapA)],
    ["STAGING_MATCH_OVERLAP_B", entityId(receipt.matches.overlapB)],
    ["STAGING_MATCH_NONOVERLAP", entityId(receipt.matches.nonOverlap)],
    ["STAGING_MATCH_IN_PROGRESS", entityId(receipt.matches.inProgress)],
    ["STAGING_MATCH_SCORING", entityId(receipt.matches.scoringActive)],
    ["STAGING_MATCH_LOCKED", entityId(receipt.matches.locked)],
    ["STAGING_MATCH_COMPLETED", entityId(receipt.matches.completed)],
    ["STAGING_DAILY_PLAY_ENABLED_TOURNAMENT", entityId(receipt.tournaments.dailyEnabled)],
    ["STAGING_DAILY_PLAY_DISABLED_TOURNAMENT", entityId(receipt.tournaments.dailyDisabled)],
    ["STAGING_DAILY_PLAY_ENABLED_MATCH", entityId(receipt.matches.dailyEnabled)],
  ];
  for (const [name, expected] of pairs) {
    const actual = String(envMap[name] || "").trim();
    if (actual && actual !== expected) {
      return proof(false, `manual ${name} bypasses receipt`);
    }
  }
  return proof(true, "receipt-owned");
}

export function evaluateReceiptRemoteReconciliation(receipt, remote = {}) {
  const receiptOk = evaluateFixtureReceipt(receipt);
  if (!receiptOk.ok) return receiptOk;
  if (remote.projectRef && remote.projectRef !== receipt.projectRef) {
    return proof(false, "remote projectRef mismatch");
  }
  if (remote.environment && String(remote.environment).toLowerCase() !== "staging") {
    return proof(false, "remote environment mismatch");
  }
  if (remote.signedInUserA && remote.signedInUserA !== entityId(receipt.users.userA)) {
    return proof(false, "signed-in User A does not match receipt");
  }
  if (remote.signedInUserB && remote.signedInUserB !== entityId(receipt.users.userB)) {
    return proof(false, "signed-in User B does not match receipt");
  }
  if (remote.reconcile === true) {
    const tournamentTenant = String(remote.primaryTournamentTenantId || "").trim();
    if (!tournamentTenant || tournamentTenant !== entityId(receipt.tenantA)) {
      return proof(false, "receipt tenantId does not match canonical tournament tenant");
    }
    const matchTournament = String(remote.preMatchTournamentId || "").trim();
    if (!matchTournament || matchTournament !== entityId(receipt.tournaments.primary)) {
      return proof(false, "receipt matchId does not resolve to receipt tournament");
    }
    const expectedLifecycle = String(remote.preMatchLifecycle || "").toUpperCase();
    if (expectedLifecycle && expectedLifecycle !== "PRE_MATCH") {
      return proof(false, `receipt lifecycle mismatch remote=${expectedLifecycle}`);
    }
    if (remote.requireRefereeEvidence === true) {
      const refereeRole = String(remote.refereeARole || "").toUpperCase();
      if (!refereeRole || refereeRole !== "REFEREE") {
        return proof(false, `referee identity mismatch role=${refereeRole || "missing"}`);
      }
    }
    return proof(true, "receipt-remote-reconciled");
  }
  const tournamentTenant = String(remote.primaryTournamentTenantId || "").trim();
  if (tournamentTenant && tournamentTenant !== entityId(receipt.tenantA)) {
    return proof(false, "receipt tenantId does not match canonical tournament tenant");
  }
  const matchTournament = String(remote.preMatchTournamentId || "").trim();
  if (matchTournament && matchTournament !== entityId(receipt.tournaments.primary)) {
    return proof(false, "receipt matchId does not resolve to receipt tournament");
  }
  const expectedLifecycle = String(remote.preMatchLifecycle || "").toUpperCase();
  if (expectedLifecycle && expectedLifecycle !== "PRE_MATCH") {
    return proof(false, `receipt lifecycle mismatch remote=${expectedLifecycle}`);
  }
  const refereeRole = String(remote.refereeARole || "").toUpperCase();
  if (remote.refereeARole && refereeRole !== "REFEREE") {
    return proof(false, `referee identity mismatch role=${refereeRole}`);
  }
  return proof(true, "receipt-remote-reconciled");
}

export function evaluateTeardownScope(receipt, requestedIds = []) {
  const owned = listReceiptOwnedIds(receipt);
  const unknown = (requestedIds || []).filter((id) => id && !owned.has(String(id)));
  if (unknown.length) {
    return proof(false, `teardown targets not receipt-owned: ${unknown.join(",")}`);
  }
  return proof(true, "receipt-scoped");
}

export function hydrateHarnessFixtures(receipt) {
  return Object.freeze({
    tenantA: entityId(receipt.tenantA),
    tenantB: entityId(receipt.tenantB),
    tournamentA: entityId(receipt.tournaments.primary),
    tournamentB: entityId(receipt.tournaments.crossTournament),
    matchA: entityId(receipt.matches.preMatch),
    refereeId: entityId(receipt.users.refereeA),
    replaceRefereeId: entityId(receipt.users.replacementReferee),
    overlapA: entityId(receipt.matches.overlapA),
    overlapB: entityId(receipt.matches.overlapB),
    nonOverlap: entityId(receipt.matches.nonOverlap),
    inactiveReferee: entityId(receipt.users.inactiveReferee),
    nonCanonicalReferee: entityId(receipt.users.nonCanonicalSubject),
    dailyDisabled: entityId(receipt.tournaments.dailyDisabled),
    dailyEnabled: entityId(receipt.tournaments.dailyEnabled),
    dailyEnabledMatch: entityId(receipt.matches.dailyEnabled),
    matchInProgress: entityId(receipt.matches.inProgress),
    matchScoring: entityId(receipt.matches.scoringActive),
    matchLocked: entityId(receipt.matches.locked),
    matchCompleted: entityId(receipt.matches.completed),
    runId: receipt.runId,
  });
}

export function loadFixtureReceiptFromPath(filePath) {
  const raw = JSON.parse(readFileSync(filePath, "utf8"));
  if (receiptContainsSecrets(raw)) {
    return { ok: false, detail: "receipt contains secrets", receipt: null };
  }
  const receipt = stripReceiptSecrets(raw);
  const proof = evaluateFixtureReceipt(receipt);
  return { ok: proof.ok, detail: proof.detail, receipt };
}
