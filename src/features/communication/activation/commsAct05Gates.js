/**
 * COMMS-ACT-05 — Trusted backend Staging smoke gates (static / fail-closed).
 * Never connects to a database. Never mutates remote.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  COMMS_PRODUCTION_PROJECT_REF,
  COMMS_STAGING_PROJECT_REF,
  evaluateCommsStagingTargetIdentity,
  isEnvTokenPresent,
} from "./stagingTarget.js";
import {
  COMMUNICATION_ACT05_CAPABILITY_STATE,
  COMMUNICATION_SMOKE_FIXTURE_MARKER,
  COMMUNICATION_TRUSTED_BACKEND_ENV,
  COMMUNICATION_TRUSTED_BACKEND_HOST,
} from "../trustedBackend/constants.js";

export const COMMS_ACT_05_VERDICTS = Object.freeze({
  READY_FOR_STAGING_SMOKE_OWNER_GO:
    "COMMS_ACT_05_READY_FOR_STAGING_SMOKE_OWNER_GO",
  BACKUP_OWNER_ACTION_REQUIRED: "COMMS_ACT_05_BACKUP_OWNER_ACTION_REQUIRED",
  BLOCKED_TRUSTED_BACKEND_HOST: "COMMS_ACT_05_BLOCKED_TRUSTED_BACKEND_HOST",
  BLOCKED_RUNTIME_WIRING: "COMMS_ACT_05_BLOCKED_RUNTIME_WIRING",
  BLOCKED_TEST_IDENTITIES: "COMMS_ACT_05_BLOCKED_TEST_IDENTITIES",
  STOPPED_SAFETY_BASELINE: "COMMS_ACT_05_STOPPED_SAFETY_BASELINE",
  BLOCKED_REMOTE_MUTATION_WITHOUT_GO:
    "COMMS_ACT_05_BLOCKED_REMOTE_MUTATION_WITHOUT_GO",
});

export const COMMS_ACT_05_DOCS_RELATIVE =
  "docs/communication-foundation/activation/comms-act-05";

export const COMMS_ACT_05_REQUIRED_DOCS = Object.freeze([
  "05_TRUSTED_BACKEND_ARCHITECTURE.md",
  "05_HOST_RUNTIME_DECISION.md",
  "05_AUTHORIZATION_MATRIX.md",
  "05_SERVER_ONLY_SECRET_BOUNDARY.md",
  "05_PRODUCTION_GATEWAY_WIRING.md",
  "05_STAGING_READINESS.md",
  "05_BACKUP_PLAN.md",
  "05_SMOKE_MATRIX.md",
  "05_FIXTURE_CLEANUP_PLAN.md",
  "05_ROLLBACK_RECOVERY_PLAN.md",
  "05_REMAINING_BLOCKED_CAPABILITIES.md",
]);

export function getCommsAct05RepoRoot(repoRoot) {
  if (repoRoot) return repoRoot;
  return path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../../../.."
  );
}

export function getCommsAct05CapabilityState() {
  return Object.freeze({ ...COMMUNICATION_ACT05_CAPABILITY_STATE });
}

/**
 * Static host selection proof — Vercel api/ family present.
 * @param {{ repoRoot?: string }} [options]
 */
export function evaluateCommsAct05TrustedBackendHost(options = {}) {
  const root = getCommsAct05RepoRoot(options.repoRoot);
  const required = [
    "api/communication/command.js",
    "api/communication/system-produce.js",
    "api/communication/authorizeCommunicationActor.js",
    "api/communication/authorizeSystemProducer.js",
    "api/identity/authorizeUserManage.js",
  ];
  /** @type {Array<{ code: string, level: string, message: string }>} */
  const findings = [];
  for (const rel of required) {
    if (!fs.existsSync(path.join(root, rel))) {
      findings.push({
        level: "error",
        code: "HOST_FILE_MISSING",
        message: `Missing trusted backend host file: ${rel}`,
      });
    }
  }

  // Reject browser service-role bypass pattern in Communication experience/runtime.
  const leakPattern =
    /SUPABASE_SERVICE_ROLE_KEY|VITE_.*SERVICE_ROLE|sb_secret_/i;
  for (const rel of [
    "src/features/communication/experience",
    "src/features/communication/runtime",
  ]) {
    const dir = path.join(root, rel);
    if (!fs.existsSync(dir)) continue;
    for (const name of fs.readdirSync(dir)) {
      const fp = path.join(dir, name);
      if (!fs.statSync(fp).isFile()) continue;
      if (leakPattern.test(fs.readFileSync(fp, "utf8"))) {
        findings.push({
          level: "error",
          code: "BROWSER_SERVICE_ROLE_LEAK",
          message: `Service-role leak in ${rel}/${name}`,
        });
      }
    }
  }

  const pass = findings.filter((f) => f.level === "error").length === 0;
  return Object.freeze({
    pass,
    hostFamily: COMMUNICATION_TRUSTED_BACKEND_HOST.family,
    basePath: COMMUNICATION_TRUSTED_BACKEND_HOST.basePath,
    stagingRef: COMMS_STAGING_PROJECT_REF,
    productionRefBlocked: COMMS_PRODUCTION_PROJECT_REF,
    findings,
  });
}

/**
 * @param {object} [input]
 */
export function evaluateCommsAct05OwnerGoGate(input = {}) {
  const token = String(
    input.ownerGo ||
      input[COMMUNICATION_TRUSTED_BACKEND_ENV.OWNER_GO] ||
      ""
  ).trim();
  const expected = COMMUNICATION_TRUSTED_BACKEND_ENV.OWNER_GO_TOKEN;
  const pass = token === expected;
  return Object.freeze({
    pass,
    expectedToken: expected,
    present: isEnvTokenPresent(token),
    matched: pass,
  });
}

/**
 * @param {object} [input]
 */
export function evaluateCommsAct05BackupGate(input = {}) {
  const evidence = String(input.backupEvidence || "").trim();
  const pathHint = String(input.backupEvidencePath || "").trim();
  // ACT-04 backup must not be primary — require ACT-05 marker in evidence text/path.
  const mentionsAct04Only =
    /ACT.?04|comms-act-04/i.test(evidence + pathHint) &&
    !/ACT.?05|comms-act-05/i.test(evidence + pathHint);
  const hasAct05Marker = /ACT.?05|comms-act-05|COMMS_ACT_05/i.test(
    evidence + pathHint
  );
  const present = isEnvTokenPresent(evidence) || isEnvTokenPresent(pathHint);

  /** @type {Array<{ code: string, level: string, message: string }>} */
  const findings = [];
  if (!present) {
    findings.push({
      level: "error",
      code: "BACKUP_EVIDENCE_MISSING",
      message: "ACT-05 Staging backup evidence missing.",
    });
  }
  if (mentionsAct04Only) {
    findings.push({
      level: "error",
      code: "ACT04_BACKUP_NOT_PRIMARY",
      message: "ACT-04 backup cannot be the primary ACT-05 backup.",
    });
  }
  if (present && !hasAct05Marker) {
    findings.push({
      level: "error",
      code: "BACKUP_NOT_ACT05_MARKED",
      message: "Backup evidence must be explicitly marked for ACT-05.",
    });
  }

  return Object.freeze({
    pass: findings.length === 0,
    findings,
    fixtureMarker: COMMUNICATION_SMOKE_FIXTURE_MARKER,
  });
}

/**
 * Full static preflight for Owner GO readiness (no remote mutation).
 * @param {object} [input]
 */
export function evaluateCommsAct05Preflight(input = {}) {
  const root = getCommsAct05RepoRoot(input.repoRoot);
  const docsDir = path.join(root, COMMS_ACT_05_DOCS_RELATIVE);
  /** @type {Array<{ code: string, level: string, message: string }>} */
  const findings = [];

  for (const name of COMMS_ACT_05_REQUIRED_DOCS) {
    if (!fs.existsSync(path.join(docsDir, name))) {
      findings.push({
        level: "error",
        code: "DOC_MISSING",
        message: `Missing ACT-05 doc: ${name}`,
      });
    }
  }

  const host = evaluateCommsAct05TrustedBackendHost({ repoRoot: root });
  if (!host.pass) {
    findings.push(...host.findings);
  }

  const target = evaluateCommsStagingTargetIdentity({
    url: input.url,
    dbUrl: input.dbUrl,
    targetConfirm: input.targetConfirm || COMMS_STAGING_PROJECT_REF,
    environment: input.environment || "staging",
  });
  if (target.status === "FAIL") {
    findings.push(...target.findings);
  }

  const backup = evaluateCommsAct05BackupGate({
    backupEvidence: input.backupEvidence,
    backupEvidencePath: input.backupEvidencePath,
  });

  const ownerGo = evaluateCommsAct05OwnerGoGate({ ownerGo: input.ownerGo });
  const mutateRequested = input.remoteMutateRequested === true;

  if (mutateRequested && !ownerGo.pass) {
    findings.push({
      level: "error",
      code: "OWNER_GO_REQUIRED",
      message: "Remote mutation requires exact ACT-05 Owner GO token.",
    });
  }

  const errors = findings.filter((f) => f.level === "error");
  let verdict = COMMS_ACT_05_VERDICTS.READY_FOR_STAGING_SMOKE_OWNER_GO;
  let pass = errors.length === 0;

  if (!host.pass) {
    verdict = COMMS_ACT_05_VERDICTS.BLOCKED_TRUSTED_BACKEND_HOST;
    pass = false;
  } else if (!backup.pass && input.requireBackupEvidence === true) {
    verdict = COMMS_ACT_05_VERDICTS.BACKUP_OWNER_ACTION_REQUIRED;
    pass = false;
    findings.push(...backup.findings);
  } else if (mutateRequested && !ownerGo.pass) {
    verdict = COMMS_ACT_05_VERDICTS.BLOCKED_REMOTE_MUTATION_WITHOUT_GO;
    pass = false;
  } else if (errors.length > 0) {
    verdict = COMMS_ACT_05_VERDICTS.STOPPED_SAFETY_BASELINE;
    pass = false;
  }

  // Default local readiness: docs+host PASS; backup is Owner action before live smoke.
  if (
    pass &&
    !backup.pass &&
    input.requireBackupEvidence !== true &&
    !mutateRequested
  ) {
    verdict = COMMS_ACT_05_VERDICTS.READY_FOR_STAGING_SMOKE_OWNER_GO;
  }

  return Object.freeze({
    pass,
    verdict,
    remoteMutateAllowed: false,
    ownerGoRequired: true,
    ownerGoToken: COMMUNICATION_TRUSTED_BACKEND_ENV.OWNER_GO_TOKEN,
    host,
    target,
    backup,
    ownerGo,
    capabilityState: getCommsAct05CapabilityState(),
    findings,
    secretsPrinted: false,
  });
}
