/**
 * COMMS-ACT-03 — Authorization & Client RLS foundation (static tests only).
 * Does not connect to Supabase. Does not apply SQL. Does not deploy.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  COMMUNICATION_AUTH_ACTOR,
  COMMUNICATION_AUTH_CAPABILITY,
  COMMUNICATION_AUTH_POLICY_CELL,
  COMMUNICATION_AUTHORIZATION_DECISION,
  COMMUNICATION_FOUNDATION_ERROR_CODE,
  assertCommunicationAuthorizationAllowed,
  createCommunicationAuthorizationDecision,
  evaluateCommsAct03PolicyCell,
  evaluateCommsAct03Preflight,
  getCommsAct03AuthorizationSnapshot,
  getCommsAct03CapabilityMatrix,
  getCommsAct03MembershipDependencyMap,
  getCommsAct03PolicyMatrix,
  loadCommsAct03SqlPackageManifest,
  resolveClientRlsSelectCapability,
  COMMS_ACT_03_VERDICTS,
  COMMS_ACT_03_FORWARD_SQL_RELATIVE,
  COMMS_ACT_03_ROLLBACK_SQL_RELATIVE,
  ACTIVATION_GATES,
  getCommunicationActivationSnapshot,
  assertActivationAllowed,
  isCommunicationFoundationError,
} from "../src/features/communication/index.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const docsDir = path.join(
  root,
  "docs/communication-foundation/activation/comms-act-03"
);
const forwardPath = path.join(root, COMMS_ACT_03_FORWARD_SQL_RELATIVE);
const rollbackPath = path.join(root, COMMS_ACT_03_ROLLBACK_SQL_RELATIVE);

const REQUIRED_DOCS = [
  "03_AUTHORIZATION_ARCHITECTURE.md",
  "03_MEMBERSHIP_DEPENDENCY_MAP.md",
  "03_POLICY_MATRIX.md",
  "03_SQL_APPLY_READINESS.md",
  "03_ROLLBACK_PLAN.md",
  "03_STAGING_TEST_PLAN.md",
  "03_UNRESOLVED_BLOCKERS.md",
  "03_CAPABILITY_MATRIX.md",
];

function stripSqlComments(sql) {
  return String(sql || "")
    .replace(/--[^\n]*/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "");
}

test("COMMS-ACT-03 docs exist", () => {
  for (const name of REQUIRED_DOCS) {
    assert.ok(fs.existsSync(path.join(docsDir, name)), name);
  }
});

test("COMMS-ACT-03 SQL package static inventory PASS", () => {
  const manifest = loadCommsAct03SqlPackageManifest({ repoRoot: root });
  assert.equal(manifest.status, "PASS", JSON.stringify(manifest.findings, null, 2));
  assert.equal(manifest.realtimeInPackage, false);
  assert.equal(manifest.authoredNotApplied, true);
  assert.ok(manifest.forwardSha256);
  assert.equal(manifest.clubPoliciesFound.length, 6);
  assert.equal(manifest.helpersFound.length, 6);
});

test("COMMS-ACT-03 preflight ready for Owner staging apply GO and refuses apply", () => {
  const ok = evaluateCommsAct03Preflight({ repoRoot: root });
  assert.equal(ok.pass, true);
  assert.equal(ok.remoteApplyAllowed, false);
  assert.equal(
    ok.verdict,
    COMMS_ACT_03_VERDICTS.READY_FOR_OWNER_STAGING_APPLY_GO
  );
  assert.equal(ok.nextGate, "CLIENT_RLS_READY_FOR_STAGING_APPLY");

  const refused = evaluateCommsAct03Preflight({
    repoRoot: root,
    applyRequested: true,
  });
  assert.equal(refused.pass, false);
  assert.equal(refused.verdict, COMMS_ACT_03_VERDICTS.BLOCKED_APPLY_REFUSED);
});

test("COMMS-ACT-03 capability matrix decisions", () => {
  const matrix = getCommsAct03CapabilityMatrix();
  assert.equal(
    matrix.capabilities.direct.read,
    COMMUNICATION_AUTH_CAPABILITY.TRUSTED_BACKEND_ONLY
  );
  assert.equal(
    matrix.capabilities.system.read,
    COMMUNICATION_AUTH_CAPABILITY.TRUSTED_BACKEND_ONLY
  );
  assert.equal(
    matrix.capabilities.club.readSelect,
    COMMUNICATION_AUTH_CAPABILITY.CLIENT_RLS_READY
  );
  assert.equal(
    matrix.capabilities.club.sendMessage,
    COMMUNICATION_AUTH_CAPABILITY.TRUSTED_BACKEND_ONLY
  );
  assert.equal(
    matrix.capabilities.community.read,
    COMMUNICATION_AUTH_CAPABILITY.BLOCKED_FAIL_CLOSED
  );
  assert.equal(
    matrix.realtimePublication,
    COMMUNICATION_AUTH_CAPABILITY.BLOCKED_FAIL_CLOSED
  );
  assert.equal(matrix.authoredSqlApplied, false);
});

test("COMMS-ACT-03 policy matrix positive and negative cases", () => {
  const A = COMMUNICATION_AUTH_ACTOR;
  assert.equal(
    evaluateCommsAct03PolicyCell("conversations_club_select", A.ACTIVE_CLUB_MEMBER),
    COMMUNICATION_AUTH_POLICY_CELL.ALLOW
  );
  assert.equal(
    evaluateCommsAct03PolicyCell("conversations_club_select", A.CLUB_MANAGER_OWNER),
    COMMUNICATION_AUTH_POLICY_CELL.ALLOW
  );
  assert.equal(
    evaluateCommsAct03PolicyCell(
      "conversations_club_select",
      A.AUTHENTICATED_UNRELATED
    ),
    COMMUNICATION_AUTH_POLICY_CELL.DENY
  );
  assert.equal(
    evaluateCommsAct03PolicyCell(
      "conversations_club_select",
      A.INACTIVE_CLUB_MEMBER
    ),
    COMMUNICATION_AUTH_POLICY_CELL.DENY
  );
  assert.equal(
    evaluateCommsAct03PolicyCell("conversations_club_select", A.CROSS_CLUB_USER),
    COMMUNICATION_AUTH_POLICY_CELL.DENY
  );
  assert.equal(
    evaluateCommsAct03PolicyCell("conversations_club_select", A.ANON),
    COMMUNICATION_AUTH_POLICY_CELL.DENY
  );
  assert.equal(
    evaluateCommsAct03PolicyCell(
      "conversations_community",
      A.ACTIVE_COMMUNITY_MEMBER
    ),
    COMMUNICATION_AUTH_POLICY_CELL.DENY
  );
  assert.equal(
    evaluateCommsAct03PolicyCell(
      "conversations_community",
      A.CROSS_COMMUNITY_USER
    ),
    COMMUNICATION_AUTH_POLICY_CELL.DENY
  );
  assert.equal(
    evaluateCommsAct03PolicyCell(
      "conversations_direct",
      A.DIRECT_PARTICIPANT
    ),
    COMMUNICATION_AUTH_POLICY_CELL.TRUSTED_BACKEND
  );
  assert.equal(
    evaluateCommsAct03PolicyCell("participants_forge_insert", A.ACTIVE_CLUB_MEMBER),
    COMMUNICATION_AUTH_POLICY_CELL.DENY
  );
  assert.equal(
    evaluateCommsAct03PolicyCell("messages_send_or_spoof", A.ACTIVE_CLUB_MEMBER),
    COMMUNICATION_AUTH_POLICY_CELL.TRUSTED_BACKEND
  );
  assert.equal(
    evaluateCommsAct03PolicyCell("read_cursors_other_user", A.ACTIVE_CLUB_MEMBER),
    COMMUNICATION_AUTH_POLICY_CELL.DENY
  );
  assert.equal(
    evaluateCommsAct03PolicyCell("read_cursors_own_club_select", A.ACTIVE_CLUB_MEMBER),
    COMMUNICATION_AUTH_POLICY_CELL.ALLOW
  );
  assert.equal(
    evaluateCommsAct03PolicyCell("moderation_actions", A.COMMUNITY_MODERATOR),
    COMMUNICATION_AUTH_POLICY_CELL.DENY
  );
  assert.equal(
    evaluateCommsAct03PolicyCell("reports", A.ACTIVE_CLUB_MEMBER),
    COMMUNICATION_AUTH_POLICY_CELL.TRUSTED_BACKEND
  );
  assert.equal(
    evaluateCommsAct03PolicyCell("rpc_execution", A.ACTIVE_CLUB_MEMBER),
    COMMUNICATION_AUTH_POLICY_CELL.DENY
  );
  assert.equal(
    evaluateCommsAct03PolicyCell("idempotency_keys", A.TRUSTED_BACKEND),
    COMMUNICATION_AUTH_POLICY_CELL.ALLOW
  );
  assert.equal(
    evaluateCommsAct03PolicyCell("conversations_club_select", A.SAME_TENANT_UNRELATED),
    COMMUNICATION_AUTH_POLICY_CELL.DENY
  );
});

test("COMMS-ACT-03 typed authorization decision fail-closed", () => {
  const allow = createCommunicationAuthorizationDecision({
    resource: "conversations_club_select",
    actor: COMMUNICATION_AUTH_ACTOR.ACTIVE_CLUB_MEMBER,
  });
  assert.equal(allow.decision, COMMUNICATION_AUTHORIZATION_DECISION.ALLOW);
  assert.equal(assertCommunicationAuthorizationAllowed(allow), allow);

  const deny = createCommunicationAuthorizationDecision({
    resource: "conversations_club_select",
    actor: COMMUNICATION_AUTH_ACTOR.AUTHENTICATED_UNRELATED,
  });
  assert.equal(deny.decision, COMMUNICATION_AUTHORIZATION_DECISION.DENY);
  assert.throws(
    () => assertCommunicationAuthorizationAllowed(deny),
    (err) =>
      isCommunicationFoundationError(err) &&
      err.code === COMMUNICATION_FOUNDATION_ERROR_CODE.AUTHORIZATION_DENIED
  );

  const missing = createCommunicationAuthorizationDecision({});
  assert.equal(missing.decision, COMMUNICATION_AUTHORIZATION_DECISION.DENY);
});

test("COMMS-ACT-03 membership dependency map uses canonical Club helper only", () => {
  const map = getCommsAct03MembershipDependencyMap();
  assert.equal(map.club.table, "public.club_members");
  assert.match(map.club.helper, /phase42_active_club_member_id/);
  assert.equal(map.club.inventedByCommunication, false);
  assert.equal(map.community.helper, null);
  assert.equal(
    map.community.clientRls,
    COMMUNICATION_AUTH_CAPABILITY.BLOCKED_FAIL_CLOSED
  );
  assert.ok(map.identity.notAuthority.includes("localStorage"));
});

test("COMMS-ACT-03 resolveClientRlsSelectCapability by conversation type", () => {
  assert.equal(
    resolveClientRlsSelectCapability("CLUB"),
    COMMUNICATION_AUTH_CAPABILITY.CLIENT_RLS_READY
  );
  assert.equal(
    resolveClientRlsSelectCapability("DIRECT"),
    COMMUNICATION_AUTH_CAPABILITY.TRUSTED_BACKEND_ONLY
  );
  assert.equal(
    resolveClientRlsSelectCapability("SYSTEM"),
    COMMUNICATION_AUTH_CAPABILITY.TRUSTED_BACKEND_ONLY
  );
  assert.equal(
    resolveClientRlsSelectCapability("COMMUNITY"),
    COMMUNICATION_AUTH_CAPABILITY.BLOCKED_FAIL_CLOSED
  );
  assert.equal(
    resolveClientRlsSelectCapability("UNKNOWN"),
    COMMUNICATION_AUTH_CAPABILITY.BLOCKED_FAIL_CLOSED
  );
});

test("COMMS-ACT-03 forward SQL: Club SELECT helpers, no realtime, no write grants", () => {
  const sql = fs.readFileSync(forwardPath, "utf8");
  const body = stripSqlComments(sql);
  assert.match(sql, /DO NOT APPLY/i);
  assert.match(sql, /AUTHORED_NOT_APPLIED/);
  assert.match(body, /phase42_active_club_member_id/);
  assert.match(body, /communication_auth_is_active_club_member/);
  assert.match(body, /security\s+definer/i);
  assert.match(body, /set\s+search_path\s*=\s*public/i);
  assert.match(body, /communication_conversations_club_select/);
  assert.match(body, /participant_id\s*=\s*public\.communication_auth_uid_text\(\)/);
  assert.doesNotMatch(body, /alter\s+publication\s+supabase_realtime/i);
  assert.doesNotMatch(body, /using\s*\(\s*true\s*\)/i);
  assert.doesNotMatch(body, /with\s+check\s*\(\s*true\s*\)/i);
  assert.doesNotMatch(body, /grant\s+(insert|update|delete|all)\b/i);
  assert.match(
    body,
    /revoke\s+all\s+on\s+function\s+public\.communication_allocate_message_position/i
  );
  assert.match(
    body,
    /communication_auth_reject_message_identity_mutation/i
  );
  assert.match(
    body,
    /communication_auth_reject_conversation_ownership_mutation/i
  );
});

test("COMMS-ACT-03 rollback restores deny-all without dropping tables", () => {
  const sql = fs.readFileSync(rollbackPath, "utf8");
  const body = stripSqlComments(sql);
  assert.match(body, /communication_conversations_deny_all/);
  assert.match(body, /drop\s+policy\s+if\s+exists\s+communication_conversations_club_select/i);
  assert.match(body, /drop\s+function\s+if\s+exists\s+public\.communication_auth_is_active_club_member/i);
  assert.doesNotMatch(body, /drop\s+table\s+/i);
  assert.doesNotMatch(body, /alter\s+publication\s+supabase_realtime/i);
  assert.match(sql, /DATA_PRESERVED\s*=\s*true/i);
});

test("COMMS-ACT-03 activation gates remain fail-closed until Owner apply", () => {
  assert.equal(
    ACTIVATION_GATES.CLIENT_RLS_POLICY,
    "CLUB_SELECT_ACTIVE_ON_STAGING"
  );
  assert.equal(
    ACTIVATION_GATES.CLUB_MEMBERSHIP_SQL_HELPER,
    "CERTIFIED_PHASE42_ACTIVE_CLUB_MEMBER_ID"
  );
  assert.equal(
    ACTIVATION_GATES.COMMUNITY_MEMBERSHIP_SQL_HELPER,
    "ACTIVATION_BLOCKER"
  );
  assert.equal(ACTIVATION_GATES.REALTIME_PUBLICATION, "DEFERRED_NOT_ENABLED");

  const snap = getCommunicationActivationSnapshot();
  assert.equal(snap.STAGING_MIGRATION_READY, false);
  assert.equal(snap.PRODUCTION_READY, false);

  assert.throws(
    () => assertActivationAllowed("CLIENT_RLS_POLICY"),
    (err) =>
      err.code === COMMUNICATION_FOUNDATION_ERROR_CODE.ACTIVATION_GATE_BLOCKED
  );
  assert.throws(
    () => assertActivationAllowed("COMMUNITY_MEMBERSHIP_SQL_HELPER"),
    (err) =>
      err.code === COMMUNICATION_FOUNDATION_ERROR_CODE.ACTIVATION_GATE_BLOCKED
  );
});

test("COMMS-ACT-03 authorization snapshot lists unresolved blockers", () => {
  const snap = getCommsAct03AuthorizationSnapshot();
  assert.equal(snap.authoredSqlApplied, false);
  assert.equal(snap.remoteMutationAllowed, false);
  assert.equal(snap.realtimePublicationEnabled, false);
  assert.ok(
    snap.unresolvedBlockers.some((b) => b.id === "COMMUNITY_MEMBERSHIP_SQL_HELPER")
  );
  assert.ok(snap.unresolvedBlockers.some((b) => b.id === "REALTIME_PUBLICATION"));
  assert.ok(getCommsAct03PolicyMatrix().resources.conversations_club_select);
});

test("COMMS-ACT-03 package/lockfile scope markers present in SQL paths only under docs/", () => {
  assert.equal(
    COMMS_ACT_03_FORWARD_SQL_RELATIVE.replace(/\\/g, "/"),
    "docs/supabase-communication-comms-act-03-authorization-client-rls.sql"
  );
  assert.equal(
    COMMS_ACT_03_ROLLBACK_SQL_RELATIVE.replace(/\\/g, "/"),
    "docs/supabase-communication-comms-act-03-authorization-client-rls-rollback.sql"
  );
  assert.ok(fs.existsSync(forwardPath));
  assert.ok(fs.existsSync(rollbackPath));
});
