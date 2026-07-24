/**
 * COMMS-ACT-01 — SQL package manifest + static inventory (no remote apply).
 */

import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  COMMUNICATION_RPC,
  COMMUNICATION_TABLE_NAME_VALUES,
} from "../persistence/schema.js";
import {
  COMMS_ACT_01_FORWARD_SQL_RELATIVE,
  COMMS_ACT_01_ROLLBACK_SQL_RELATIVE,
} from "./stagingTarget.js";

const MODULE_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../.."
);

export const COMMS_ACT_01_EXPECTED_TABLE_COUNT =
  COMMUNICATION_TABLE_NAME_VALUES.length;

export const COMMS_ACT_01_EXPECTED_RPC = Object.freeze([
  COMMUNICATION_RPC.allocateMessagePosition,
  COMMUNICATION_RPC.advanceReadCursor,
]);

export const COMMS_ACT_01_EXPECTED_TRIGGERS = Object.freeze([
  "communication_messages_reply_same_conversation_trg",
  "communication_pinned_same_conversation_trg",
]);

export const COMMS_ACT_01_DEPENDENCY_HELPERS = Object.freeze({
  /** Present on Staging if prior RBAC SQL applied — not opened by COMMS-05. */
  documentedPrerequisites: Object.freeze([
    "public.profiles",
    "public.user_venue_id()",
  ]),
  clubClientRlsHelper: "public.phase42_active_club_member_id(club_id)",
  clubClientRlsGate: "OWNER_APPROVAL_REQUIRED",
  communityMembershipHelper: null,
  communityMembershipGate: "ACTIVATION_BLOCKER",
});

/**
 * @param {string} [repoRoot]
 */
export function getCommsAct01RepoRoot(repoRoot) {
  return repoRoot || MODULE_ROOT;
}

/**
 * @param {string} sql
 */
export function stripSqlComments(sql) {
  return String(sql || "")
    .replace(/--[^\n]*/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "");
}

/**
 * @param {string} content
 */
export function sha256Hex(content) {
  return createHash("sha256").update(String(content || ""), "utf8").digest("hex");
}

/**
 * Static inventory of the authored forward SQL package.
 * @param {{ repoRoot?: string }} [opts]
 */
export function loadCommsAct01SqlPackageManifest(opts = {}) {
  const root = getCommsAct01RepoRoot(opts.repoRoot);
  const forwardRelative = COMMS_ACT_01_FORWARD_SQL_RELATIVE;
  const rollbackRelative = COMMS_ACT_01_ROLLBACK_SQL_RELATIVE;
  const forwardPath = path.join(root, forwardRelative);
  const rollbackPath = path.join(root, rollbackRelative);

  const forwardExists = existsSync(forwardPath);
  const rollbackExists = existsSync(rollbackPath);
  const forwardSql = forwardExists ? readFileSync(forwardPath, "utf8") : "";
  const rollbackSql = rollbackExists ? readFileSync(rollbackPath, "utf8") : "";
  const body = stripSqlComments(forwardSql);

  const tablesFound = COMMUNICATION_TABLE_NAME_VALUES.filter((table) =>
    new RegExp(
      `create\\s+table\\s+if\\s+not\\s+exists\\s+public\\.${table}\\b`,
      "i"
    ).test(body)
  );

  const rlsEnabled = COMMUNICATION_TABLE_NAME_VALUES.filter((table) =>
    new RegExp(
      `alter\\s+table\\s+public\\.${table}\\s+enable\\s+row\\s+level\\s+security`,
      "i"
    ).test(body)
  );

  const denyAllPolicies = COMMUNICATION_TABLE_NAME_VALUES.filter((table) =>
    new RegExp(
      `create\\s+policy\\s+\\w+_deny_all\\s+on\\s+public\\.${table}[\\s\\S]*?using\\s*\\(\\s*false\\s*\\)[\\s\\S]*?with\\s+check\\s*\\(\\s*false\\s*\\)`,
      "i"
    ).test(body)
  );

  const rpcFound = COMMS_ACT_01_EXPECTED_RPC.filter((name) =>
    new RegExp(
      `create\\s+or\\s+replace\\s+function\\s+public\\.${name}\\b`,
      "i"
    ).test(body)
  );

  const triggersFound = COMMS_ACT_01_EXPECTED_TRIGGERS.filter((name) =>
    new RegExp(`create\\s+trigger\\s+${name}\\b`, "i").test(body)
  );

  const destructiveOutsideScope = (() => {
    const drops = [...body.matchAll(/drop\s+table\s+(?:if\s+exists\s+)?public\.([a-z0-9_]+)/gi)].map(
      (m) => m[1].toLowerCase()
    );
    return drops.filter((t) => !t.startsWith("communication_"));
  })();

  const realtimeEnabledInBody = /alter\s+publication\s+supabase_realtime/i.test(
    body
  );
  const permissiveTrue =
    /using\s*\(\s*true\s*\)/i.test(body) || /with\s+check\s*\(\s*true\s*\)/i.test(body);
  const grantsToClient = /grant\s+.*(anon|authenticated)/i.test(body);
  const revokePresent = /revoke\s+all\s+on\s+public\.communication_/i.test(body);

  const repeatedRunSafe =
    /create\s+table\s+if\s+not\s+exists/i.test(body) &&
    /create\s+unique\s+index\s+if\s+not\s+exists/i.test(body) &&
    /drop\s+policy\s+if\s+exists/i.test(body);

  /** @type {Array<{ code: string, level: string, message: string }>} */
  const findings = [];

  if (!forwardExists) {
    findings.push({
      level: "error",
      code: "FORWARD_SQL_MISSING",
      message: `Missing ${forwardRelative}`,
    });
  }
  if (!rollbackExists) {
    findings.push({
      level: "error",
      code: "ROLLBACK_SQL_MISSING",
      message: `Missing ${rollbackRelative}`,
    });
  }
  if (tablesFound.length !== COMMS_ACT_01_EXPECTED_TABLE_COUNT) {
    findings.push({
      level: "error",
      code: "TABLE_INVENTORY_MISMATCH",
      message: `Expected ${COMMS_ACT_01_EXPECTED_TABLE_COUNT} tables, found ${tablesFound.length}.`,
    });
  }
  if (rlsEnabled.length !== COMMS_ACT_01_EXPECTED_TABLE_COUNT) {
    findings.push({
      level: "error",
      code: "RLS_ENABLE_INCOMPLETE",
      message: "Not all communication_* tables enable RLS.",
    });
  }
  if (denyAllPolicies.length !== COMMS_ACT_01_EXPECTED_TABLE_COUNT) {
    findings.push({
      level: "error",
      code: "DENY_ALL_INCOMPLETE",
      message: "Not all communication_* tables have deny-all policies.",
    });
  }
  if (rpcFound.length !== COMMS_ACT_01_EXPECTED_RPC.length) {
    findings.push({
      level: "error",
      code: "RPC_INVENTORY_MISMATCH",
      message: "Expected Communication RPCs missing from forward SQL.",
    });
  }
  if (triggersFound.length !== COMMS_ACT_01_EXPECTED_TRIGGERS.length) {
    findings.push({
      level: "error",
      code: "TRIGGER_INVENTORY_MISMATCH",
      message: "Expected Communication invariant triggers missing.",
    });
  }
  if (destructiveOutsideScope.length > 0) {
    findings.push({
      level: "error",
      code: "DESTRUCTIVE_OUTSIDE_SCOPE",
      message: `Forward SQL drops non-communication tables: ${destructiveOutsideScope.join(", ")}`,
    });
  }
  if (realtimeEnabledInBody) {
    findings.push({
      level: "error",
      code: "REALTIME_IN_APPLY_PACKAGE",
      message: "Forward SQL must not alter supabase_realtime publication.",
    });
  }
  if (permissiveTrue) {
    findings.push({
      level: "error",
      code: "PERMISSIVE_TRUE_POLICY",
      message: "Forward SQL must not use USING (true) / WITH CHECK (true).",
    });
  }
  if (grantsToClient) {
    findings.push({
      level: "error",
      code: "CLIENT_GRANT_PRESENT",
      message: "Forward SQL must not GRANT to anon/authenticated.",
    });
  }
  if (forwardExists && !revokePresent) {
    findings.push({
      level: "error",
      code: "CLIENT_REVOKE_MISSING",
      message: "Forward SQL must REVOKE from anon/authenticated.",
    });
  }
  if (forwardExists && !/DO NOT APPLY/i.test(forwardSql)) {
    findings.push({
      level: "warning",
      code: "DO_NOT_APPLY_MARKER_MISSING",
      message: "Forward SQL should retain DO NOT APPLY / AUTHORED_NOT_APPLIED markers until activation.",
    });
  }
  if (forwardExists && !repeatedRunSafe) {
    findings.push({
      level: "warning",
      code: "REPEATED_RUN_NOT_IDEMPOTENT",
      message: "Repeated-run safety markers incomplete (IF NOT EXISTS / DROP POLICY IF EXISTS).",
    });
  }

  const errors = findings.filter((f) => f.level === "error");

  return Object.freeze({
    forwardRelative,
    rollbackRelative,
    forwardExists,
    rollbackExists,
    forwardSha256: forwardExists ? sha256Hex(forwardSql) : null,
    rollbackSha256: rollbackExists ? sha256Hex(rollbackSql) : null,
    expectedTableCount: COMMS_ACT_01_EXPECTED_TABLE_COUNT,
    tablesFound,
    rlsEnabledCount: rlsEnabled.length,
    denyAllPolicyCount: denyAllPolicies.length,
    rpcFound,
    triggersFound,
    dependencyHelpers: COMMS_ACT_01_DEPENDENCY_HELPERS,
    applyOrder: Object.freeze([
      "static_validation",
      "schema_tables_constraints_indexes",
      "rpc_triggers",
      "deny_all_rls_and_revokes",
      "NO_realtime_publication",
    ]),
    repeatedRunBehavior: repeatedRunSafe
      ? "IF_NOT_EXISTS_AND_DROP_POLICY_IF_EXISTS"
      : "REVIEW_REQUIRED",
    estimatedRisk: "MEDIUM_SCHEMA_ADDITIVE_FAIL_CLOSED_RLS",
    executionBoundary: "STAGING_ONLY_AFTER_OWNER_GO_AND_BACKUP",
    realtimeInPackage: realtimeEnabledInBody,
    status: errors.length === 0 ? "PASS" : "FAIL",
    findings,
  });
}

/**
 * @param {{ repoRoot?: string }} [opts]
 */
export function verifyCommsAct01SqlPackage(opts = {}) {
  return loadCommsAct01SqlPackageManifest(opts);
}
