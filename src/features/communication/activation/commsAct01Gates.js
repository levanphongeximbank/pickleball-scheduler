/**
 * COMMS-ACT-01 — fail-closed Staging activation readiness gates.
 * Does not apply SQL. Does not print secrets. Does not connect by itself.
 */

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { ACTIVATION_GATES } from "../persistence/schema.js";
import { getCommunicationActivationSnapshot } from "../persistence/activationGates.js";
import {
  COMMS_ACT_01_ENV_NAMES,
  COMMS_ACT_01_EVIDENCE_DIR_RELATIVE,
  evaluateCommsStagingTargetIdentity,
  isEnvTokenPresent,
} from "./stagingTarget.js";
import {
  getCommsAct01RepoRoot,
  verifyCommsAct01SqlPackage,
} from "./sqlPackageManifest.js";

export const COMMS_ACT_01_VERDICTS = Object.freeze({
  READY_FOR_OWNER_GO: "COMMS_ACT_01_READY_FOR_OWNER_GO",
  BLOCKED_OWNER_GO: "COMMS_ACT_01_BLOCKED_OWNER_GO",
  BLOCKED_BACKUP: "COMMS_ACT_01_BLOCKED_BACKUP",
  BLOCKED_TARGET_IDENTITY: "COMMS_ACT_01_BLOCKED_TARGET_IDENTITY",
  BLOCKED_SQL_PACKAGE: "COMMS_ACT_01_BLOCKED_SQL_PACKAGE",
  BLOCKED_APPLY_REFUSED: "COMMS_ACT_01_BLOCKED_APPLY_REFUSED",
  BLOCKED_LIVE_MODE_WITHOUT_GATES: "COMMS_ACT_01_BLOCKED_LIVE_MODE_WITHOUT_GATES",
  PACKAGE_STATIC_PASS: "COMMS_ACT_01_PACKAGE_STATIC_PASS",
});

export const COMMS_ACT_01_RLS_CAPABILITY_VERDICTS = Object.freeze({
  READY: "READY",
  READY_BACKEND_TRUSTED_ONLY: "READY_BACKEND_TRUSTED_ONLY",
  BLOCKED_FAIL_CLOSED: "BLOCKED_FAIL_CLOSED",
});

/**
 * Read process.env without referencing the Node `process` free global
 * (ESLint src languageOptions use browser globals only).
 * @returns {Record<string, string|undefined>}
 */
function readProcessEnv() {
  return typeof globalThis.process !== "undefined" && globalThis.process.env
    ? globalThis.process.env
    : {};
}

/**
 * Capability matrix for COMMS-ACT-01 (client vs trusted backend).
 * Client Club/Community remain fail-closed until helpers certified.
 */
export function getCommsAct01RlsReadinessMatrix() {
  const snap = getCommunicationActivationSnapshot();
  return Object.freeze({
    direct: {
      client: COMMS_ACT_01_RLS_CAPABILITY_VERDICTS.READY_BACKEND_TRUSTED_ONLY,
      reason:
        "Deny-all client RLS authored; Direct participant client policy deferred until Staging RLS review. Trusted backend path READY for Staging after SQL apply.",
      gate: snap.CLIENT_RLS_POLICY,
    },
    club: {
      client: COMMS_ACT_01_RLS_CAPABILITY_VERDICTS.BLOCKED_FAIL_CLOSED,
      backend: COMMS_ACT_01_RLS_CAPABILITY_VERDICTS.READY_BACKEND_TRUSTED_ONLY,
      reason:
        "Club client RLS requires Owner-approved reuse of phase42_active_club_member_id. Do not open client policies.",
      gate: snap.CLUB_MEMBERSHIP_SQL_HELPER,
    },
    community: {
      client: COMMS_ACT_01_RLS_CAPABILITY_VERDICTS.BLOCKED_FAIL_CLOSED,
      backend: COMMS_ACT_01_RLS_CAPABILITY_VERDICTS.READY_BACKEND_TRUSTED_ONLY,
      reason:
        "Community membership SQL helper not published (ACTIVATION_BLOCKER). Keep deny-all.",
      gate: snap.COMMUNITY_MEMBERSHIP_SQL_HELPER,
    },
    report: {
      client: COMMS_ACT_01_RLS_CAPABILITY_VERDICTS.READY_BACKEND_TRUSTED_ONLY,
      reason: "Report tables deny-all; trusted backend after application authorization.",
    },
    moderation: {
      client: COMMS_ACT_01_RLS_CAPABILITY_VERDICTS.READY_BACKEND_TRUSTED_ONLY,
      reason: "Moderation tables deny-all; trusted backend after application authorization.",
    },
    attachments: {
      client: COMMS_ACT_01_RLS_CAPABILITY_VERDICTS.BLOCKED_FAIL_CLOSED,
      reason: "Attachment storage bucket RLS deferred (refs only).",
      gate: snap.ATTACHMENT_STORAGE_BUCKET_RLS,
    },
    realtimeSubscription: {
      client: COMMS_ACT_01_RLS_CAPABILITY_VERDICTS.BLOCKED_FAIL_CLOSED,
      reason: "Realtime publication deferred; authorize-before-subscribe foundation only.",
      gate: snap.REALTIME_PUBLICATION,
    },
    overallClientRls: COMMS_ACT_01_RLS_CAPABILITY_VERDICTS.BLOCKED_FAIL_CLOSED,
    overallTrustedBackendAfterApply:
      COMMS_ACT_01_RLS_CAPABILITY_VERDICTS.READY_BACKEND_TRUSTED_ONLY,
    activationGates: { ...ACTIVATION_GATES },
  });
}

/**
 * @param {string|undefined|null} flag
 * @param {string|undefined|null} expected
 */
export function tokensMatch(flag, expected) {
  if (!isEnvTokenPresent(flag) || !isEnvTokenPresent(expected)) return false;
  return String(flag).trim() === String(expected).trim();
}

/**
 * Evaluate backup evidence gate (presence only; never prints token values).
 * @param {Record<string, string|undefined>} [env]
 * @param {{ repoRoot?: string }} [opts]
 */
export function evaluateCommsAct01BackupGate(env = readProcessEnv(), opts = {}) {
  const root = getCommsAct01RepoRoot(opts.repoRoot);
  const token = env?.[COMMS_ACT_01_ENV_NAMES.BACKUP_EVIDENCE];
  const evidencePathRaw = env?.[COMMS_ACT_01_ENV_NAMES.BACKUP_EVIDENCE_PATH];
  const evidencePath = String(evidencePathRaw || "").trim();
  const abs =
    evidencePath &&
    (path.isAbsolute(evidencePath)
      ? evidencePath
      : path.join(root, evidencePath));

  /** @type {Array<{ code: string, level: string, message: string }>} */
  const findings = [];
  const tokenPresent = isEnvTokenPresent(token);
  const pathPresent = isEnvTokenPresent(evidencePath);
  const pathExists = Boolean(abs && existsSync(abs));

  if (!tokenPresent) {
    findings.push({
      level: "error",
      code: "BACKUP_TOKEN_MISSING",
      message:
        "COMMS_STAGING_BACKUP_EVIDENCE not set. Capture Staging backup/PITR or documented logical backup evidence before apply.",
    });
  }
  if (!pathPresent) {
    findings.push({
      level: "error",
      code: "BACKUP_PATH_MISSING",
      message:
        "COMMS_STAGING_BACKUP_EVIDENCE_PATH not set. Point at filled evidence note under activation/comms-act-01/evidence/.",
    });
  } else if (!pathExists) {
    findings.push({
      level: "error",
      code: "BACKUP_PATH_NOT_FOUND",
      message: "Backup evidence path does not exist.",
    });
  }

  let evidenceDocOk = false;
  if (pathExists) {
    try {
      const text = readFileSync(abs, "utf8");
      const requiredMarkers = [
        "backupTimestamp",
        "targetProjectRef",
        "backupMechanism",
        "backupStatus",
        "restoreCapability",
        "retention",
        "confirmedBy",
        "evidenceLocation",
      ];
      const missing = requiredMarkers.filter(
        (m) => !new RegExp(m, "i").test(text)
      );
      if (missing.length) {
        findings.push({
          level: "error",
          code: "BACKUP_EVIDENCE_INCOMPLETE",
          message: `Backup evidence missing fields: ${missing.join(", ")}`,
        });
      } else {
        evidenceDocOk = true;
      }
      if (/expuvcohlcjzvrrauvud/i.test(text)) {
        findings.push({
          level: "error",
          code: "BACKUP_EVIDENCE_PRODUCTION_REF",
          message: "Backup evidence must not target Production project ref.",
        });
      }
    } catch {
      findings.push({
        level: "error",
        code: "BACKUP_EVIDENCE_UNREADABLE",
        message: "Backup evidence file unreadable.",
      });
    }
  }

  const errors = findings.filter((f) => f.level === "error");
  return Object.freeze({
    status: errors.length === 0 && tokenPresent && evidenceDocOk ? "PASS" : "FAIL",
    tokenPresent,
    pathPresent,
    pathExists,
    evidenceDocOk,
    evidenceDirRelative: COMMS_ACT_01_EVIDENCE_DIR_RELATIVE,
    disposableResetAllowed:
      "ONLY_STAGING_PROJECT_RECREATE_PER_PLATFORM_CHECKLIST_NOT_PRODUCTION",
    findings,
    secretsPrinted: false,
  });
}

/**
 * @param {Record<string, string|undefined>} [env]
 */
export function evaluateCommsAct01OwnerGoGate(env = readProcessEnv()) {
  const present = isEnvTokenPresent(env?.[COMMS_ACT_01_ENV_NAMES.OWNER_GO]);
  return Object.freeze({
    status: present ? "PASS" : "FAIL",
    tokenPresent: present,
    note: "Owner GO for remote Staging apply is NOT granted in COMMS-ACT-01 by default.",
    findings: present
      ? []
      : [
          {
            level: "error",
            code: "OWNER_GO_MISSING",
            message:
              "COMMS_STAGING_OWNER_GO not set. COMMS-ACT-01 must not perform remote apply.",
          },
        ],
    secretsPrinted: false,
  });
}

/**
 * Full preflight evaluation.
 * @param {{
 *   repoRoot?: string,
 *   env?: Record<string, string|undefined>,
 *   mode?: 'offline'|'live-gates',
 *   applyRequested?: boolean,
 *   environment?: string,
 * }} [opts]
 */
export function evaluateCommsAct01Preflight(opts = {}) {
  const root = getCommsAct01RepoRoot(opts.repoRoot);
  const env = opts.env || readProcessEnv();
  const mode = opts.mode || "offline";
  const environment = String(opts.environment || "staging").toLowerCase();
  /** @type {Array<{ code: string, level: string, message: string }>} */
  const findings = [];

  if (opts.applyRequested) {
    findings.push({
      level: "error",
      code: "APPLY_REFUSED",
      message:
        "COMMS-ACT-01 preflight refuses --apply. Remote apply belongs to COMMS-ACT-02 after Owner GO.",
    });
  }

  const sql = verifyCommsAct01SqlPackage({ repoRoot: root });
  findings.push(...sql.findings);

  const target = evaluateCommsStagingTargetIdentity({
    environment,
    url:
      env[COMMS_ACT_01_ENV_NAMES.STAGING_SUPABASE_URL] ||
      env[COMMS_ACT_01_ENV_NAMES.SUPABASE_URL] ||
      env[COMMS_ACT_01_ENV_NAMES.SUPABASE_URL_ALT],
    dbUrl: env[COMMS_ACT_01_ENV_NAMES.STAGING_DB_URL],
    targetConfirm: env[COMMS_ACT_01_ENV_NAMES.TARGET_CONFIRM],
  });

  const ownerGo = evaluateCommsAct01OwnerGoGate(env);
  const backup = evaluateCommsAct01BackupGate(env, { repoRoot: root });
  const rls = getCommsAct01RlsReadinessMatrix();
  const activationSnapshot = getCommunicationActivationSnapshot();

  if (mode === "offline") {
    // Offline package validation: SQL must PASS; target/backup/owner are reported
    // but do not fail the static package gate (they block live apply).
    if (target.status === "FAIL") {
      findings.push(
        ...target.findings.map((f) => ({
          ...f,
          level: f.level === "error" ? "warning" : f.level,
          code: `OFFLINE_${f.code}`,
        }))
      );
    }
  } else if (mode === "live-gates") {
    if (target.status !== "PASS") {
      findings.push(...target.findings);
      if (target.status === "UNVERIFIED") {
        findings.push({
          level: "error",
          code: "TARGET_UNVERIFIED",
          message:
            "Live mode requires Staging URL/DB URL or COMMS_STAGING_TARGET_CONFIRM matching Staging ref.",
        });
      }
    }
    findings.push(...ownerGo.findings);
    findings.push(...backup.findings);
  } else {
    findings.push({
      level: "error",
      code: "UNKNOWN_MODE",
      message: `Unknown preflight mode: ${mode}`,
    });
  }

  const errors = findings.filter((f) => f.level === "error");

  let verdict = COMMS_ACT_01_VERDICTS.PACKAGE_STATIC_PASS;
  if (opts.applyRequested) {
    verdict = COMMS_ACT_01_VERDICTS.BLOCKED_APPLY_REFUSED;
  } else if (sql.status !== "PASS") {
    verdict = COMMS_ACT_01_VERDICTS.BLOCKED_SQL_PACKAGE;
  } else if (mode === "live-gates" && target.status !== "PASS") {
    verdict = COMMS_ACT_01_VERDICTS.BLOCKED_TARGET_IDENTITY;
  } else if (mode === "live-gates" && backup.status !== "PASS") {
    verdict = COMMS_ACT_01_VERDICTS.BLOCKED_BACKUP;
  } else if (mode === "live-gates" && ownerGo.status !== "PASS") {
    verdict = COMMS_ACT_01_VERDICTS.BLOCKED_OWNER_GO;
  } else if (mode === "offline" && sql.status === "PASS") {
    verdict = COMMS_ACT_01_VERDICTS.READY_FOR_OWNER_GO;
  } else if (mode === "live-gates" && errors.length === 0) {
    verdict = COMMS_ACT_01_VERDICTS.READY_FOR_OWNER_GO;
  }

  const remoteApplyAllowed = false; // COMMS-ACT-01 never allows remote apply

  return Object.freeze({
    phase: "COMMS-ACT-01",
    mode,
    environment,
    verdict,
    remoteApplyAllowed,
    sql,
    target,
    ownerGo,
    backup,
    rls,
    activationSnapshot,
    findings,
    pass: errors.length === 0 && sql.status === "PASS",
    secretsPrinted: false,
    nextWorkstream: "COMMS-ACT-02 Staging Apply (Owner GO required; not opened by this script)",
  });
}
