/**
 * COMMS-ACT-03 — SQL package manifest + static inventory (no remote apply).
 */

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  COMMUNICATION_TABLE_NAME_VALUES,
  COMMUNICATION_RPC,
} from "../persistence/schema.js";
import { sha256Hex, stripSqlComments } from "./sqlPackageManifest.js";

const MODULE_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../.."
);

export const COMMS_ACT_03_FORWARD_SQL_RELATIVE =
  "docs/supabase-communication-comms-act-03-authorization-client-rls.sql";
export const COMMS_ACT_03_ROLLBACK_SQL_RELATIVE =
  "docs/supabase-communication-comms-act-03-authorization-client-rls-rollback.sql";

export const COMMS_ACT_03_EXPECTED_HELPERS = Object.freeze([
  "communication_auth_uid_text",
  "communication_auth_is_active_club_member",
  "communication_auth_can_select_club_conversation",
  "communication_auth_reject_conversation_ownership_mutation",
  "communication_auth_reject_message_identity_mutation",
  "communication_auth_reject_participant_identity_mutation",
]);

export const COMMS_ACT_03_CLUB_SELECT_POLICIES = Object.freeze([
  "communication_conversations_club_select",
  "communication_participants_club_select",
  "communication_messages_club_select",
  "communication_reactions_club_select",
  "communication_pinned_messages_club_select",
  "communication_read_cursors_club_own_select",
]);

export const COMMS_ACT_03_SELECT_GRANT_TABLES = Object.freeze([
  "communication_conversations",
  "communication_conversation_participants",
  "communication_messages",
  "communication_message_reactions",
  "communication_pinned_messages",
  "communication_read_cursors",
]);

/**
 * @param {string} [repoRoot]
 */
export function getCommsAct03RepoRoot(repoRoot) {
  return repoRoot || MODULE_ROOT;
}

/**
 * @param {{ repoRoot?: string }} [opts]
 */
export function loadCommsAct03SqlPackageManifest(opts = {}) {
  const root = getCommsAct03RepoRoot(opts.repoRoot);
  const forwardRelative = COMMS_ACT_03_FORWARD_SQL_RELATIVE;
  const rollbackRelative = COMMS_ACT_03_ROLLBACK_SQL_RELATIVE;
  const forwardPath = path.join(root, forwardRelative);
  const rollbackPath = path.join(root, rollbackRelative);

  const forwardExists = existsSync(forwardPath);
  const rollbackExists = existsSync(rollbackPath);
  const forwardSql = forwardExists ? readFileSync(forwardPath, "utf8") : "";
  const rollbackSql = rollbackExists ? readFileSync(rollbackPath, "utf8") : "";
  const body = stripSqlComments(forwardSql);
  const rollbackBody = stripSqlComments(rollbackSql);

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

  const helpersFound = COMMS_ACT_03_EXPECTED_HELPERS.filter((name) =>
    new RegExp(
      `create\\s+or\\s+replace\\s+function\\s+public\\.${name}\\b`,
      "i"
    ).test(body)
  );
  if (helpersFound.length !== COMMS_ACT_03_EXPECTED_HELPERS.length) {
    findings.push({
      level: "error",
      code: "HELPER_INVENTORY_MISMATCH",
      message: `Expected ${COMMS_ACT_03_EXPECTED_HELPERS.length} helpers, found ${helpersFound.length}.`,
    });
  }

  const clubPoliciesFound = COMMS_ACT_03_CLUB_SELECT_POLICIES.filter((name) =>
    new RegExp(`create\\s+policy\\s+${name}\\b`, "i").test(body)
  );
  if (clubPoliciesFound.length !== COMMS_ACT_03_CLUB_SELECT_POLICIES.length) {
    findings.push({
      level: "error",
      code: "CLUB_SELECT_POLICY_INCOMPLETE",
      message: "Club SELECT Client RLS policies incomplete.",
    });
  }

  const securityDefinerHelpers = COMMS_ACT_03_EXPECTED_HELPERS.filter((name) => {
    const re = new RegExp(
      `create\\s+or\\s+replace\\s+function\\s+public\\.${name}\\b[\\s\\S]*?security\\s+definer[\\s\\S]*?set\\s+search_path\\s*=\\s*public`,
      "i"
    );
    return re.test(body);
  });
  if (securityDefinerHelpers.length !== COMMS_ACT_03_EXPECTED_HELPERS.length) {
    findings.push({
      level: "error",
      code: "HELPER_SECURITY_PATH_INCOMPLETE",
      message: "Every ACT-03 helper must be SECURITY DEFINER with search_path=public.",
    });
  }

  if (!/phase42_active_club_member_id/i.test(body)) {
    findings.push({
      level: "error",
      code: "CLUB_HELPER_DEPENDENCY_MISSING",
      message: "Forward SQL must bind to phase42_active_club_member_id.",
    });
  }

  if (!/to_regprocedure\s*\(\s*'public\.phase42_active_club_member_id\(text\)'/i.test(body)) {
    findings.push({
      level: "error",
      code: "CLUB_HELPER_PREREQUISITE_CHECK_MISSING",
      message: "Forward SQL must refuse apply when Club helper is missing.",
    });
  }

  if (/using\s*\(\s*true\s*\)/i.test(body) || /with\s+check\s*\(\s*true\s*\)/i.test(body)) {
    findings.push({
      level: "error",
      code: "PERMISSIVE_TRUE_POLICY",
      message: "ACT-03 must not use USING (true) / WITH CHECK (true).",
    });
  }

  if (/alter\s+publication\s+supabase_realtime/i.test(body)) {
    findings.push({
      level: "error",
      code: "REALTIME_IN_APPLY_PACKAGE",
      message: "ACT-03 must not alter supabase_realtime publication.",
    });
  }

  if (/grant\s+(insert|update|delete|all)\b/i.test(body)) {
    findings.push({
      level: "error",
      code: "BROAD_OR_WRITE_GRANT",
      message: "ACT-03 must not GRANT INSERT/UPDATE/DELETE/ALL to clients.",
    });
  }

  for (const table of COMMS_ACT_03_SELECT_GRANT_TABLES) {
    if (
      !new RegExp(
        `grant\\s+select\\s+on\\s+public\\.${table}\\s+to\\s+authenticated`,
        "i"
      ).test(body)
    ) {
      findings.push({
        level: "error",
        code: "SELECT_GRANT_MISSING",
        message: `Missing narrow SELECT grant for ${table}`,
      });
    }
  }

  for (const rpc of Object.values(COMMUNICATION_RPC)) {
    if (
      !new RegExp(
        `revoke\\s+all\\s+on\\s+function\\s+public\\.${rpc}\\b`,
        "i"
      ).test(body)
    ) {
      findings.push({
        level: "error",
        code: "RPC_REVOKE_MISSING",
        message: `RPC execute must remain revoked: ${rpc}`,
      });
    }
  }

  // Direct/Community/System must not receive dedicated client open policies
  if (/create\s+policy\s+\w*direct\w*_select/i.test(body)) {
    findings.push({
      level: "error",
      code: "DIRECT_CLIENT_POLICY_OPENED",
      message: "DIRECT Client RLS must remain trusted-backend only.",
    });
  }
  if (/create\s+policy\s+\w*community\w*_select/i.test(body)) {
    findings.push({
      level: "error",
      code: "COMMUNITY_CLIENT_POLICY_OPENED",
      message: "COMMUNITY Client RLS must remain blocked.",
    });
  }
  if (/create\s+policy\s+\w*system\w*_select/i.test(body)) {
    findings.push({
      level: "error",
      code: "SYSTEM_CLIENT_POLICY_OPENED",
      message: "SYSTEM Client RLS must remain trusted-backend only.",
    });
  }

  if (forwardExists && !/DO NOT APPLY/i.test(forwardSql)) {
    findings.push({
      level: "error",
      code: "DO_NOT_APPLY_MARKER_MISSING",
      message: "Forward SQL must retain DO NOT APPLY / AUTHORED_NOT_APPLIED.",
    });
  }

  // Rollback must restore deny-all and drop club select policies / helpers
  if (rollbackExists) {
    for (const name of COMMS_ACT_03_CLUB_SELECT_POLICIES) {
      if (!new RegExp(`drop\\s+policy\\s+if\\s+exists\\s+${name}\\b`, "i").test(rollbackBody)) {
        findings.push({
          level: "error",
          code: "ROLLBACK_POLICY_DROP_MISSING",
          message: `Rollback must drop ${name}`,
        });
      }
    }
    const denyAllRestored = COMMUNICATION_TABLE_NAME_VALUES.filter((table) =>
      new RegExp(
        `create\\s+policy\\s+\\w+_deny_all\\s+on\\s+public\\.${table}[\\s\\S]*?using\\s*\\(\\s*false\\s*\\)`,
        "i"
      ).test(rollbackBody)
    );
    if (denyAllRestored.length !== COMMUNICATION_TABLE_NAME_VALUES.length) {
      findings.push({
        level: "error",
        code: "ROLLBACK_DENY_ALL_INCOMPLETE",
        message: "Rollback must restore deny-all on all communication_* tables.",
      });
    }
    if (/drop\s+table\s+/i.test(rollbackBody)) {
      findings.push({
        level: "error",
        code: "ROLLBACK_DROPS_DATA",
        message: "ACT-03 rollback must not DROP tables (data-preserving).",
      });
    }
    if (/alter\s+publication\s+supabase_realtime/i.test(rollbackBody)) {
      findings.push({
        level: "error",
        code: "ROLLBACK_TOUCHES_REALTIME",
        message: "Rollback must not alter realtime publication.",
      });
    }
  }

  const errors = findings.filter((f) => f.level === "error");
  return Object.freeze({
    forwardRelative,
    rollbackRelative,
    forwardExists,
    rollbackExists,
    forwardSha256: forwardExists ? sha256Hex(forwardSql) : null,
    rollbackSha256: rollbackExists ? sha256Hex(rollbackSql) : null,
    helpersFound,
    clubPoliciesFound,
    selectGrantTables: COMMS_ACT_03_SELECT_GRANT_TABLES,
    realtimeInPackage: /alter\s+publication\s+supabase_realtime/i.test(body),
    status: errors.length === 0 ? "PASS" : "FAIL",
    findings,
    authoredNotApplied: /AUTHORED_NOT_APPLIED/i.test(forwardSql),
    executionBoundary: "STAGING_ONLY_AFTER_OWNER_GO_AND_BACKUP",
  });
}

/**
 * @param {{ repoRoot?: string }} [opts]
 */
export function verifyCommsAct03SqlPackage(opts = {}) {
  return loadCommsAct03SqlPackageManifest(opts);
}
