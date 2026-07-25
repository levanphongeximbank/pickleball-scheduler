/**
 * COMMS-ACT-03 — Authorization & Client RLS foundation gates (no remote apply).
 */

import { ACTIVATION_GATES } from "../persistence/schema.js";
import { getCommunicationActivationSnapshot } from "../persistence/activationGates.js";
import {
  COMMUNICATION_AUTH_CAPABILITY,
  getCommsAct03CapabilityMatrix,
  getCommsAct03MembershipDependencyMap,
  getCommsAct03PolicyMatrix,
} from "../authorization/index.js";
import {
  getCommsAct03RepoRoot,
  verifyCommsAct03SqlPackage,
} from "./commsAct03SqlManifest.js";

export const COMMS_ACT_03_VERDICTS = Object.freeze({
  PACKAGE_STATIC_PASS: "COMMS_ACT_03_PACKAGE_STATIC_PASS",
  BLOCKED_SQL_PACKAGE: "COMMS_ACT_03_BLOCKED_SQL_PACKAGE",
  BLOCKED_APPLY_REFUSED: "COMMS_ACT_03_BLOCKED_APPLY_REFUSED",
  READY_FOR_OWNER_STAGING_APPLY_GO:
    "COMMS_ACT_03_READY_FOR_OWNER_STAGING_APPLY_GO",
});

/**
 * Explicit ACT-03 capability posture (authoritative for this workstream).
 */
export function getCommsAct03AuthorizationSnapshot() {
  const capabilities = getCommsAct03CapabilityMatrix();
  const membership = getCommsAct03MembershipDependencyMap();
  const policy = getCommsAct03PolicyMatrix();
  const activation = getCommunicationActivationSnapshot();

  return Object.freeze({
    phase: "COMMS-ACT-03",
    authoredSqlApplied: false,
    remoteMutationAllowed: false,
    realtimePublicationEnabled: false,
    capabilityMatrix: capabilities,
    membershipDependencyMap: membership,
    policyMatrixSummary: Object.freeze({
      resourceCount: Object.keys(policy.resources).length,
      failClosedRuleCount: policy.failClosedRules.length,
      capabilityAlignment: policy.capabilityAlignment,
    }),
    activationGates: Object.freeze({ ...activation }),
    unresolvedBlockers: Object.freeze([
      Object.freeze({
        id: "COMMUNITY_MEMBERSHIP_SQL_HELPER",
        status: COMMUNICATION_AUTH_CAPABILITY.BLOCKED_FAIL_CLOSED,
        detail: "Platform has not published a Community membership SQL helper.",
      }),
      Object.freeze({
        id: "DIRECT_CLIENT_RLS",
        status: COMMUNICATION_AUTH_CAPABILITY.TRUSTED_BACKEND_ONLY,
        detail: "Direct participant Client RLS deferred by architecture default.",
      }),
      Object.freeze({
        id: "CLIENT_WRITES",
        status: COMMUNICATION_AUTH_CAPABILITY.TRUSTED_BACKEND_ONLY,
        detail: "Message send / participant admin / moderation remain trusted-backend.",
      }),
      Object.freeze({
        id: "REALTIME_PUBLICATION",
        status: COMMUNICATION_AUTH_CAPABILITY.BLOCKED_FAIL_CLOSED,
        detail: "Realtime publication not enabled in ACT-03.",
      }),
      Object.freeze({
        id: "STAGING_APPLY_OWNER_GO",
        status: "REQUIRED_BEFORE_REMOTE_ACTIVATION",
        detail:
          "Authored ACT-03 SQL is not applied. Current remote Staging remains COMMS-05 deny-all until Owner GO.",
      }),
    ]),
    schemaGates: Object.freeze({ ...ACTIVATION_GATES }),
  });
}

/**
 * @param {{
 *   repoRoot?: string,
 *   applyRequested?: boolean,
 * }} [opts]
 */
export function evaluateCommsAct03Preflight(opts = {}) {
  const root = getCommsAct03RepoRoot(opts.repoRoot);
  /** @type {Array<{ code: string, level: string, message: string }>} */
  const findings = [];

  if (opts.applyRequested) {
    findings.push({
      level: "error",
      code: "APPLY_REFUSED",
      message:
        "COMMS-ACT-03 refuses remote SQL apply. Authored package only; Owner GO required in a later activation gate.",
    });
  }

  const sql = verifyCommsAct03SqlPackage({ repoRoot: root });
  findings.push(...sql.findings);

  const snapshot = getCommsAct03AuthorizationSnapshot();
  const errors = findings.filter((f) => f.level === "error");

  let verdict;
  if (opts.applyRequested) {
    verdict = COMMS_ACT_03_VERDICTS.BLOCKED_APPLY_REFUSED;
  } else if (sql.status !== "PASS") {
    verdict = COMMS_ACT_03_VERDICTS.BLOCKED_SQL_PACKAGE;
  } else {
    verdict = COMMS_ACT_03_VERDICTS.READY_FOR_OWNER_STAGING_APPLY_GO;
  }

  return Object.freeze({
    phase: "COMMS-ACT-03",
    verdict,
    remoteApplyAllowed: false,
    sql,
    snapshot,
    findings,
    pass: errors.length === 0 && sql.status === "PASS" && !opts.applyRequested,
    secretsPrinted: false,
    nextGate: snapshot.capabilityMatrix.nextGate,
    nextGateScope: snapshot.capabilityMatrix.nextGateScope,
  });
}
