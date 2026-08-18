/**
 * CORE-13 disposable Staging fixture receipt — provenance SSOT.
 * Test/acceptance tooling only. Not product/browser runtime.
 * UUIDs stay canonical; ownership is receipt + runId, not ID substring.
 */

import { readFileSync } from "node:fs";
import { CORE13_FIXTURE_NAMESPACE } from "./core13-staging-acceptance-proofs.mjs";
import { evaluateInactiveRefereeFixture } from "./core13-staging-qa-auth.mjs";
import { resolveSubjectIdentityRecord } from "../../src/features/identity/services/subjectIdentityLookupService.js";

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
  "completedLifecycle",
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
  for (const row of receipt.assignments || []) push(row);
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
        status: "suspended",
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
      completedLifecycle: {
        id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa5",
        tenantId: "core13-qa-tenant-a",
        mode: "INTERNAL",
        name: `${CORE13_FIXTURE_NAMESPACE} completed-only ${runId}`,
        terminal: true,
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
        tournamentId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa5",
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
      typedByResource: true,
      genericUnassignOverAllReceiptIds: false,
      immutableAuditDelete: false,
      immutableIdempotencyDelete: false,
    },
    identityMode: "EXISTING_QA_IDENTITY_MODE",
    assignments: [],
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
  if (entityId(receipt.tournaments.primary) === entityId(receipt.tournaments.completedLifecycle)) {
    return proof(false, "completedLifecycle tournament must be distinct from primary");
  }
  if (receipt.tournaments.primary?.terminal === true) {
    return proof(false, "primary tournament must remain non-terminal");
  }
  const completedTournamentId = entityId(receipt.tournaments.completedLifecycle);
  if (String(receipt.matches.completed?.tournamentId || "") !== completedTournamentId) {
    return proof(false, "completed match must bind to completedLifecycle tournament");
  }
  for (const key of [
    "preMatch",
    "overlapA",
    "overlapB",
    "nonOverlap",
    "inProgress",
    "scoringActive",
    "locked",
  ]) {
    if (String(receipt.matches[key]?.tournamentId || "") !== entityId(receipt.tournaments.primary)) {
      return proof(false, `${key} must bind to primary tournament`);
    }
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
  if (remote.hardcodedLifecycleProof === true) {
    return proof(false, "HARDCODED_PREMATCH_LIFECYCLE_REMOTE_PROOF denied");
  }
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

  if (remote.reconcile !== true) {
    return proof(true, "receipt-local-only");
  }

  if (remote.receiptClaimOverridesRemote === true) {
    return proof(false, "manual receipt claim cannot override remote truth");
  }

  const primaryTenant = String(remote.primaryTournamentTenantId || "").trim();
  if (!primaryTenant || primaryTenant !== entityId(receipt.tenantA)) {
    return proof(false, "receipt tenantId does not match canonical tournament tenant");
  }
  const crossTenant = String(remote.crossTournamentTenantId || "").trim();
  if (!crossTenant || crossTenant !== entityId(receipt.tenantA)) {
    return proof(false, "cross-tournament tenant binding mismatch");
  }
  const completedTenant = String(remote.completedLifecycleTournamentTenantId || "").trim();
  if (!completedTenant || completedTenant !== entityId(receipt.tenantA)) {
    return proof(false, "completedLifecycle tournament tenant binding mismatch");
  }
  const primaryStatus = String(remote.primaryTournamentStatus || "").toLowerCase();
  if (primaryStatus === "completed" || primaryStatus === "cancelled") {
    return proof(false, "primary tournament is terminal; PRIMARY_TOURNAMENT_REMAINS_NON_TERMINAL violated");
  }

  const matchKeys = [
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
  ];
  for (const key of matchKeys) {
    const expected = String(receipt.matches[key]?.lifecycle || "").toUpperCase();
    const evidence = remote.matches?.[key];
    if (!evidence || evidence.exists !== true) {
      return proof(false, `remote match evidence missing for ${key}`);
    }
    const actualLifecycle = String(evidence.lifecycle || "").toUpperCase();
    if (!actualLifecycle) {
      return proof(false, `remote lifecycle unproven for ${key}`);
    }
    if (actualLifecycle !== expected) {
      return proof(false, `remote lifecycle mismatch ${key} expected=${expected} actual=${actualLifecycle}`);
    }
    const expectedTournament = entityId(receipt.matches[key].tournamentId);
    if (String(evidence.tournamentId || "") !== expectedTournament) {
      return proof(false, `remote match tournament binding mismatch ${key}`);
    }
  }

  const identityKeys = ["refereeA", "replacementReferee", "inactiveReferee", "nonCanonicalSubject"];
  for (const key of identityKeys) {
    const expected = receipt.users[key];
    const evidence = remote.identities?.[key];
    const absentNonCanonical =
      key === "nonCanonicalSubject" &&
      String(expected?.classification || "") === "NON_CANONICAL_EXPECTED_ABSENT";
    if (absentNonCanonical) {
      if (evidence?.exists === true && String(evidence.role || "").toUpperCase() === "REFEREE") {
        return proof(false, "non-canonical subject must not be REFEREE");
      }
      continue;
    }
    if (!evidence || evidence.exists !== true) {
      return proof(false, `remote identity evidence missing for ${key}`);
    }
    if (String(evidence.role || "").toUpperCase() !== String(expected.role || "").toUpperCase()) {
      return proof(false, `remote identity role mismatch ${key}`);
    }
    if (
      expected.status &&
      String(evidence.status || "").toUpperCase() !== String(expected.status || "").toUpperCase()
    ) {
      return proof(false, `remote identity status mismatch ${key}`);
    }
    if (
      evidence.tenantId != null &&
      String(evidence.tenantId) !== entityId(receipt.tenantA)
    ) {
      return proof(false, `remote identity tenant mismatch ${key}`);
    }
  }
  if (String(remote.identities?.refereeA?.role || "").toUpperCase() !== "REFEREE") {
    return proof(false, "referee A must be REFEREE");
  }
  if (String(remote.identities?.nonCanonicalSubject?.role || "").toUpperCase() === "REFEREE") {
    return proof(false, "non-canonical subject must not be REFEREE");
  }
  const inactiveRemote = remote.identities?.inactiveReferee || {};
  const inactiveProof = evaluateInactiveRefereeFixture(
    {
      userId: inactiveRemote.subjectId || inactiveRemote.userId || inactiveRemote.id,
      contract01Evidence: inactiveRemote.contract01Evidence || null,
    },
    { requiredTenantId: entityId(receipt.tenantA) }
  );
  if (!inactiveProof.ok) {
    return proof(false, inactiveProof.detail || "inactive referee requires Contract #01 active=false");
  }

  const schedule = remote.schedule || {};
  if (schedule.required === true) {
    if (schedule.overlapConflict !== true) {
      return proof(false, "schedule overlap evidence mismatch");
    }
    if (schedule.nonOverlapConflict !== false) {
      return proof(false, "schedule non-overlap evidence mismatch");
    }
  }

  return proof(true, "receipt-remote-reconciled");
}

export function mapAuthoritativeLifecycle({ liveRow = null, tournamentStatus = "" } = {}) {
  const tournament = String(tournamentStatus || "").toLowerCase();
  if (tournament === "completed" || tournament === "cancelled") return "COMPLETED";
  if (!liveRow) return "PRE_MATCH";
  const scoringActive =
    Number(liveRow.last_event_sequence || 0) > 0 ||
    Number(liveRow.team_a_score || 0) > 0 ||
    Number(liveRow.team_b_score || 0) > 0;
  if (scoringActive) return "SCORING_ACTIVE";
  const raw = String(liveRow.status || "").toLowerCase();
  if (["paused", "suspended", "locked"].includes(raw)) return "LOCKED";
  if (["in_progress", "started", "active", "live", "playing"].includes(raw)) return "IN_PROGRESS";
  if (["completed", "final", "finished"].includes(raw)) return "COMPLETED";
  if (["not_started", "scheduled", "pending", "ready"].includes(raw)) return "PRE_MATCH";
  return "PRE_MATCH";
}

export function classifyReceiptOwnedResources(receipt = {}) {
  const nonCanonicalId = entityId(receipt.users?.nonCanonicalSubject);
  const existingQa = String(receipt.identityMode || "") === "EXISTING_QA_IDENTITY_MODE";
  const authUsers = existingQa
    ? []
    : REQUIRED_USER_KEYS.map((key) => entityId(receipt.users?.[key]))
        .filter(Boolean)
        .filter((id) => {
          const classification = receipt.users?.nonCanonicalSubject?.classification;
          if (classification === "NON_CANONICAL_EXPECTED_ABSENT" && id === nonCanonicalId) {
            return false;
          }
          return true;
        });
  return Object.freeze({
    tenants: [entityId(receipt.tenantA), entityId(receipt.tenantB)].filter(Boolean),
    authUsers,
    tournaments: REQUIRED_TOURNAMENT_KEYS.map((key) => entityId(receipt.tournaments?.[key])).filter(
      Boolean
    ),
    matches: REQUIRED_MATCH_KEYS.map((key) => entityId(receipt.matches?.[key])).filter(Boolean),
    assignments: Array.isArray(receipt.assignments)
      ? receipt.assignments.map((row) => entityId(row)).filter(Boolean)
      : [],
    retainedImmutableArtifacts: ["competition_referee_assignment_audit", "competition_referee_assignment_idempotency"],
    liveExecutionArtifacts: ["match_live_states", "match_events", "match_sync_mutations"],
    liveBackedMatchIds: listLiveBackedMatchIds(receipt),
  });
}

export const RETAINED_FIXTURE_CLEANUP_GAP = "SEPARATE_WORKSTREAM";
export const LIVE_BACKED_LIFECYCLES = Object.freeze([
  "IN_PROGRESS",
  "SCORING_ACTIVE",
  "LOCKED",
  "COMPLETED",
]);

export function listLiveBackedMatchIds(receipt = {}) {
  return REQUIRED_MATCH_KEYS.map((key) => receipt.matches?.[key])
    .filter((row) => row && LIVE_BACKED_LIFECYCLES.includes(String(row.lifecycle || "")))
    .map((row) => entityId(row))
    .filter(Boolean);
}

export function receiptHasLiveBackedFixtures(receipt = {}) {
  return listLiveBackedMatchIds(receipt).length > 0;
}

export function buildTypedCleanupPlan(receipt = {}) {
  const resources = classifyReceiptOwnedResources(receipt);
  const liveBacked = resources.liveBackedMatchIds.length > 0;
  return Object.freeze({
    ok: true,
    typedByResource: true,
    genericUnassignOverAllReceiptIds: false,
    immutableHistoryDelete: false,
    liveStateTeardownDirectDelete: false,
    liveBackedFixtureRetentionFailClosed: liveBacked,
    retainedFixtureCleanupGap: liveBacked ? RETAINED_FIXTURE_CLEANUP_GAP : null,
    steps: [
      {
        resource: "assignments",
        command: "unassignViaTrustedServer",
        ids: resources.assignments,
        policy: "CORE13 trusted-server unassign only for active assignment rows",
      },
      {
        resource: "authUsers",
        command: String(receipt.identityMode || "") === "EXISTING_QA_IDENTITY_MODE"
          ? "retain"
          : "deleteAuthUser",
        ids: resources.authUsers,
        policy:
          String(receipt.identityMode || "") === "EXISTING_QA_IDENTITY_MODE"
            ? "existing QA identities are not disposable and must not be deleted"
            : "authorized test Identity Admin delete of provisioner-created users",
        retain: String(receipt.identityMode || "") === "EXISTING_QA_IDENTITY_MODE",
      },
      {
        resource: "matches",
        command: "retainOrCanonicalMatchInverse",
        ids: resources.matches,
        policy: "retain unless a canonical match cancel/delete exists; never DML live execution",
        retainIfUnsupported: true,
      },
      {
        resource: "tournaments",
        command: liveBacked ? "retain" : "deleteTournament",
        ids: resources.tournaments,
        policy: liveBacked
          ? "canonical_tournament_delete does not cascade match_live_states/match_sync_mutations; retain live-backed fixtures"
          : "canonical delete/archive/cancel if supported; else retain disposable artifact",
        retainIfUnsupported: true,
        retain: liveBacked,
      },
      {
        resource: "tenants",
        command: "retainOrCanonicalTenantDeactivate",
        ids: resources.tenants,
        policy: "retain unless canonical delete/deactivate is supported and safe",
        retainIfUnsupported: true,
      },
      {
        resource: "liveExecutionArtifacts",
        command: "retain",
        ids: resources.liveExecutionArtifacts,
        policy: "NEVER direct-delete match_live_states / match_events / match_sync_mutations",
        retain: true,
      },
      {
        resource: "retainedImmutableArtifacts",
        command: "retain",
        ids: resources.retainedImmutableArtifacts,
        policy: "NEVER force-delete audit/idempotency history",
        retain: true,
      },
    ],
  });
}

export function evaluateTypedTeardownTargets(receipt, requested = []) {
  const resources = classifyReceiptOwnedResources(receipt);
  const assignmentSet = new Set(resources.assignments);
  const authSet = new Set(resources.authUsers);
  const matchSet = new Set(resources.matches);
  const tournamentSet = new Set(resources.tournaments);
  const tenantSet = new Set(resources.tenants);
  const owned = listReceiptOwnedIds(receipt);
  for (const item of requested) {
    const id = entityId(item.id || item);
    const resource = String(item.resource || "").trim();
    if (!id || !owned.has(id)) {
      return proof(false, `teardown target not receipt-owned: ${id || "missing"}`);
    }
    if (resource === "assignments" && !assignmentSet.has(id) && resources.assignments.length) {
      return proof(false, `assignment teardown id not typed as assignment: ${id}`);
    }
    if (resource === "assignments" && (tenantSet.has(id) || authSet.has(id) || tournamentSet.has(id))) {
      return proof(false, `GENERIC_UNASSIGN_OVER_ALL_RECEIPT_IDS denied for ${id}`);
    }
    if (resource === "unassignViaTrustedServer") {
      if (tenantSet.has(id) || authSet.has(id) || tournamentSet.has(id) || matchSet.has(id)) {
        return proof(false, `unassign cannot target non-assignment resource ${id}`);
      }
    }
  }
  return proof(true, "typed-teardown");
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
    completedLifecycleTournament: entityId(receipt.tournaments.completedLifecycle),
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

export function evaluateLifecycleAssignmentBaselines(receipt = {}) {
  const assignments = Array.isArray(receipt.assignments) ? receipt.assignments : [];
  const byMatch = (matchId) =>
    assignments.filter(
      (row) => String(row.matchId || "") === String(matchId || "") && row.active !== false
    );
  const matchA = entityId(receipt.matches?.preMatch);
  const matchInProgress = entityId(receipt.matches?.inProgress);
  const matchScoring = entityId(receipt.matches?.scoringActive);
  return Object.freeze({
    ok:
      byMatch(matchA).length === 0 &&
      byMatch(matchInProgress).length === 1 &&
      byMatch(matchScoring).length === 1,
    primaryMatchActiveAssignments: byMatch(matchA).length,
    matchInProgressActiveAssignments: byMatch(matchInProgress).length,
    matchScoringActiveAssignments: byMatch(matchScoring).length,
    PRIMARY_TOURNAMENT_REMAINS_NON_TERMINAL: receipt.tournaments?.primary?.terminal !== true,
    COMPLETED_FIXTURE_ISOLATED:
      String(receipt.matches?.completed?.tournamentId || "") ===
      entityId(receipt.tournaments?.completedLifecycle),
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

function payloadContainsMatchId(payload, matchId) {
  const target = String(matchId || "");
  if (!target) return false;
  const walk = (value) => {
    if (value == null) return false;
    if (typeof value === "string") return value === target;
    if (Array.isArray(value)) return value.some((item) => walk(item));
    if (typeof value === "object") {
      if (String(value.id || value.matchId || "") === target) return true;
      return Object.values(value).some((child) => walk(child));
    }
    return false;
  };
  return walk(payload);
}

/**
 * Read-only Staging evidence for receipt reconciliation (test harness only).
 * Does not mutate. Does not invent lifecycle when evidence is missing.
 */
export async function loadAuthoritativeRemoteFixtureEvidence(service, receipt) {
  async function loadTournament(id) {
    const { data, error } = await service
      .from("canonical_tournaments")
      .select("id, tenant_id, status, mode, name, payload")
      .eq("id", id)
      .maybeSingle();
    if (error) throw new Error(`tournament evidence failed: ${error.message}`);
    return data || null;
  }

  async function loadLive(matchId) {
    const { data, error } = await service
      .from("match_live_states")
      .select("match_id, status, last_event_sequence, team_a_score, team_b_score")
      .eq("match_id", matchId)
      .maybeSingle();
    if (error) throw new Error(`match live evidence failed: ${error.message}`);
    return data || null;
  }

  async function loadIdentity(userId) {
    const { data, error } = await service
      .from("profiles")
      .select("id, role, status, tenant_id, venue_id")
      .eq("id", userId)
      .maybeSingle();
    if (error) throw new Error(`identity evidence failed: ${error.message}`);
    return data || null;
  }

  const primary = await loadTournament(entityId(receipt.tournaments.primary));
  const cross = await loadTournament(entityId(receipt.tournaments.crossTournament));
  const completedLifecycle = await loadTournament(entityId(receipt.tournaments.completedLifecycle));
  const dailyEnabled = await loadTournament(entityId(receipt.tournaments.dailyEnabled));
  const dailyDisabled = await loadTournament(entityId(receipt.tournaments.dailyDisabled));

  const matches = {};
  for (const key of REQUIRED_MATCH_KEYS) {
    const matchId = entityId(receipt.matches[key]);
    const tournamentId = String(receipt.matches[key].tournamentId || "");
    const tournamentRow =
      tournamentId === entityId(receipt.tournaments.primary)
        ? primary
        : tournamentId === entityId(receipt.tournaments.completedLifecycle)
          ? completedLifecycle
          : tournamentId === entityId(receipt.tournaments.dailyEnabled)
            ? dailyEnabled
            : tournamentId === entityId(receipt.tournaments.dailyDisabled)
              ? dailyDisabled
              : null;
    const live = await loadLive(matchId);
    const inPayload = tournamentRow ? payloadContainsMatchId(tournamentRow.payload, matchId) : false;
    const exists = Boolean(live) || inPayload || (key === "preMatch" && inPayload);
    // PRE_MATCH may exist as payload-only (missing live row). Other lifecycles need proof.
    const lifecycle = mapAuthoritativeLifecycle({
      liveRow: live,
      tournamentStatus: tournamentRow?.status || "",
    });
    matches[key] = {
      exists: exists === true,
      tournamentId,
      lifecycle,
      livePresent: Boolean(live),
      payloadPresent: inPayload,
    };
  }

  const identities = {};
  const requestedTenantId = entityId(receipt.tenantA);
  for (const key of REQUIRED_USER_KEYS) {
    const id = entityId(receipt.users[key]);
    const row = await loadIdentity(id);
    let contract01Evidence = null;
    if (row?.id) {
      const lookup = await resolveSubjectIdentityRecord(
        { subjectId: String(row.id), requestedTenantId },
        {
          loadIdentitySubjectById: async () => ({
            id: String(row.id),
            role: row.role,
            status: row.status,
            tenantId: row.tenant_id,
            venueId: row.venue_id,
          }),
        }
      );
      contract01Evidence = lookup.ok ? lookup.evidence : null;
    }
    identities[key] = {
      exists: Boolean(row),
      role: contract01Evidence?.role || row?.role || "",
      status: contract01Evidence?.status || row?.status || "",
      tenantId: contract01Evidence?.tenantId ?? row?.tenant_id ?? null,
      venueId: contract01Evidence?.venueId ?? row?.venue_id ?? null,
      contract01Evidence,
    };
  }

  const overlapAWindow = extractMatchWindow(primary?.payload, entityId(receipt.matches.overlapA));
  const overlapBWindow = extractMatchWindow(primary?.payload, entityId(receipt.matches.overlapB));
  const nonOverlapWindow = extractMatchWindow(primary?.payload, entityId(receipt.matches.nonOverlap));
  let overlapConflict;
  let nonOverlapConflict;
  if (overlapAWindow && overlapBWindow) {
    overlapConflict = windowsOverlap(overlapAWindow, overlapBWindow) === true;
  }
  if (overlapAWindow && nonOverlapWindow) {
    nonOverlapConflict = windowsOverlap(overlapAWindow, nonOverlapWindow) === true;
  }

  return {
    primaryTournamentTenantId: primary?.tenant_id || "",
    crossTournamentTenantId: cross?.tenant_id || "",
    completedLifecycleTournamentTenantId: completedLifecycle?.tenant_id || "",
    primaryTournamentStatus: primary?.status || "",
    dailyEnabledTournamentId: dailyEnabled?.id || "",
    dailyDisabledTournamentId: dailyDisabled?.id || "",
    matches,
    identities,
    schedule: {
      required: true,
      overlapConflict,
      nonOverlapConflict,
      overlapAWindow: overlapAWindow || null,
      overlapBWindow: overlapBWindow || null,
      nonOverlapWindow: nonOverlapWindow || null,
    },
  };
}

function extractMatchWindow(payload, matchId) {
  const target = String(matchId || "");
  if (!target || !payload) return null;
  let found = null;
  const walk = (value) => {
    if (!value || typeof value !== "object") return;
    if (Array.isArray(value)) {
      value.forEach(walk);
      return;
    }
    if (String(value.id || value.matchId || "") === target) {
      const start = value.startAt || value.startsAt || value.scheduledStart || value.start;
      const end = value.endAt || value.endsAt || value.scheduledEnd || value.end;
      if (start && end) found = { start: String(start), end: String(end) };
    }
    Object.values(value).forEach(walk);
  };
  walk(payload);
  return found;
}

function windowsOverlap(a, b) {
  const aStart = Date.parse(a.start);
  const aEnd = Date.parse(a.end);
  const bStart = Date.parse(b.start);
  const bEnd = Date.parse(b.end);
  if (![aStart, aEnd, bStart, bEnd].every(Number.isFinite)) return null;
  return aStart < bEnd && bStart < aEnd;
}

export function buildAlignedRemoteEvidenceForTests(receipt, overrides = {}) {
  const matches = {};
  for (const key of REQUIRED_MATCH_KEYS) {
    matches[key] = {
      exists: true,
      tournamentId: String(receipt.matches[key].tournamentId),
      lifecycle: String(receipt.matches[key].lifecycle).toUpperCase(),
    };
  }
  const identities = {};
  for (const key of REQUIRED_USER_KEYS) {
    const status = receipt.users[key].status || "ACTIVE";
    const role = receipt.users[key].role;
    const tenantId = entityId(receipt.tenantA);
    const subjectId = entityId(receipt.users[key]);
    identities[key] = {
      exists: true,
      id: subjectId,
      role,
      status,
      tenantId,
      contract01Active: key === "inactiveReferee" ? false : String(status).toLowerCase() === "active",
      contract01Evidence: {
        subjectId,
        canonicalSubjectId: subjectId,
        role,
        status: String(status || "").toLowerCase(),
        active: key === "inactiveReferee" ? false : String(status).toLowerCase() === "active",
        tenantId,
        venueId: receipt.users[key].venueId ?? null,
        source: "identity",
      },
    };
  }
  if (overrides.matches) {
    for (const [key, value] of Object.entries(overrides.matches)) {
      matches[key] = { ...matches[key], ...value };
    }
  }
  if (overrides.identities) {
    for (const [key, value] of Object.entries(overrides.identities)) {
      identities[key] = { ...identities[key], ...value };
    }
  }
  const {
    matches: _m,
    identities: _i,
    schedule: scheduleOverride,
    ...rest
  } = overrides;
  return {
    reconcile: true,
    hardcodedLifecycleProof: false,
    projectRef: receipt.projectRef,
    environment: "staging",
    primaryTournamentTenantId: entityId(receipt.tenantA),
    crossTournamentTenantId: entityId(receipt.tenantA),
    completedLifecycleTournamentTenantId: entityId(receipt.tenantA),
    primaryTournamentStatus: "active",
    matches,
    identities,
    schedule: {
      required: true,
      overlapConflict: true,
      nonOverlapConflict: false,
      ...(scheduleOverride || {}),
    },
    ...rest,
  };
}
