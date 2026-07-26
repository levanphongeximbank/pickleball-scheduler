/**
 * CRM Phase 1H-B — one-time / non-replayable Staging apply authorization.
 *
 * Committed Owner decision JSON is NEVER sufficient for mutation.
 * Credentials and --apply-staging alone are NEVER sufficient.
 * Authorization files must remain untracked (e.g. *.local) and are consumed
 * after successful apply or rejected after expiry/replay.
 *
 * Never prints secret values.
 */

import { createHash, randomUUID } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";

import {
  CRM_PRODUCTION_PROJECT_REF_BLOCKLIST,
  CRM_STAGING_PROJECT_REF_ALLOWLIST,
} from "./migrationManifest.js";

export const CRM_PHASE_1H_B_ONE_TIME_AUTH_SCHEMA_VERSION = 1;

export const CRM_PHASE_1H_B_ONE_TIME_OPERATION =
  "crm_phase_1h_b_staging_apply";

/** Separate operation for BM-FINAL-SAFETY-01 Staging grant remediation (DCL only). */
export const CRM_BM_FINAL_SAFETY_01_GRANT_REMEDIATION_OPERATION =
  "crm_bm_final_safety_01_staging_grant_remediation";

export const CRM_ONE_TIME_OPERATIONS = Object.freeze([
  CRM_PHASE_1H_B_ONE_TIME_OPERATION,
  CRM_BM_FINAL_SAFETY_01_GRANT_REMEDIATION_OPERATION,
]);

export const CRM_PHASE_1H_B_ONE_TIME_AUTH_STATUS = Object.freeze({
  ISSUED: "issued",
  CONSUMED: "consumed",
});

export const CRM_PHASE_1H_B_ONE_TIME_AUTH_VERDICTS = Object.freeze({
  BLOCKED_ONE_TIME_AUTHORIZATION_REQUIRED:
    "CRM_PHASE_1H_B_BLOCKED_ONE_TIME_AUTHORIZATION_REQUIRED",
  BLOCKED_ONE_TIME_AUTHORIZATION_INVALID:
    "CRM_PHASE_1H_B_BLOCKED_ONE_TIME_AUTHORIZATION_INVALID",
  BLOCKED_ONE_TIME_AUTHORIZATION_EXPIRED:
    "CRM_PHASE_1H_B_BLOCKED_ONE_TIME_AUTHORIZATION_EXPIRED",
  BLOCKED_ONE_TIME_AUTHORIZATION_REPLAYED:
    "CRM_PHASE_1H_B_BLOCKED_ONE_TIME_AUTHORIZATION_REPLAYED",
  BLOCKED_STALE_OWNER_DECISION:
    "CRM_PHASE_1H_B_BLOCKED_STALE_OWNER_DECISION",
  BLOCKED_MIGRATION_FINGERPRINT_MISMATCH:
    "CRM_PHASE_1H_B_BLOCKED_MIGRATION_FINGERPRINT_MISMATCH",
  BLOCKED_PROJECT_REF_MISMATCH:
    "CRM_PHASE_1H_B_BLOCKED_PROJECT_REF_MISMATCH",
  BLOCKED_PRODUCTION_PROJECT_REF:
    "CRM_PHASE_1H_B_BLOCKED_PRODUCTION_PROJECT_REF",
  BLOCKED_EXECUTION_CONTEXT:
    "CRM_PHASE_1H_B_BLOCKED_EXECUTION_CONTEXT",
});

/** Default max lifetime for issued one-time authorization (2 hours). */
export const CRM_PHASE_1H_B_ONE_TIME_AUTH_MAX_TTL_MS = 2 * 60 * 60 * 1000;

/**
 * Detect audit / test / CI contexts that must fail-closed before mutation.
 * @param {Record<string, string|undefined>} [env]
 * @param {{ forceAuditMode?: boolean }} [options]
 */
export function detectCrmPhase1hBNonMutationContext(env = {}, options = {}) {
  const reasons = [];
  if (options.forceAuditMode === true) reasons.push("audit_mode");
  if (String(env.CRM_STAGING_APPLY_AUDIT_MODE || "").trim() === "1") {
    reasons.push("CRM_STAGING_APPLY_AUDIT_MODE");
  }
  if (String(env.CI || "").trim() !== "") reasons.push("CI");
  if (String(env.GITHUB_ACTIONS || "").trim() !== "") {
    reasons.push("GITHUB_ACTIONS");
  }
  if (String(env.NODE_ENV || "").trim().toLowerCase() === "test") {
    reasons.push("NODE_ENV=test");
  }
  if (String(env.VITEST || "").trim() !== "") reasons.push("VITEST");
  if (String(env.npm_lifecycle_event || "").trim() === "test") {
    reasons.push("npm_lifecycle_event=test");
  }
  return Object.freeze({
    blocked: reasons.length > 0,
    reasons,
  });
}

/**
 * Fingerprint the exact migration plan that an authorization may unlock.
 * @param {Array<{ order: number, path: string, sha256: string }>} applyEntries
 * @returns {string}
 */
export function computeCrmPhase1hBMigrationPlanFingerprint(applyEntries = []) {
  const normalized = [...applyEntries]
    .map((entry) => ({
      order: Number(entry.order),
      path: String(entry.path || "").replace(/\\/g, "/"),
      sha256: String(entry.sha256 || "").toLowerCase(),
    }))
    .sort((a, b) => a.order - b.order);
  const payload = JSON.stringify(normalized);
  return createHash("sha256").update(payload).digest("hex");
}

/**
 * @param {string} absolutePath
 * @returns {object|null}
 */
export function loadCrmPhase1hBOneTimeAuthorizationFile(absolutePath) {
  if (!absolutePath || !existsSync(absolutePath)) return null;
  try {
    return JSON.parse(readFileSync(absolutePath, "utf8"));
  } catch {
    return null;
  }
}

/**
 * Issue a local (untracked) one-time authorization payload.
 * Does not write secrets. Caller must keep the file out of Git.
 *
 * @param {{
 *   migrationPlanFingerprint: string,
 *   stagingProjectRef?: string,
 *   issuedAt?: string,
 *   expiresAt?: string,
 *   ttlMs?: number,
 *   nonce?: string,
 *   operationId?: string,
 * }} options
 */
export function buildCrmPhase1hBOneTimeAuthorization(options = {}) {
  const issuedAt = options.issuedAt || new Date().toISOString();
  const issuedMs = Date.parse(issuedAt);
  if (!Number.isFinite(issuedMs)) {
    throw new Error("issuedAt must be a valid ISO timestamp.");
  }
  const ttlMs =
    options.ttlMs == null
      ? CRM_PHASE_1H_B_ONE_TIME_AUTH_MAX_TTL_MS
      : Number(options.ttlMs);
  if (!Number.isFinite(ttlMs) || ttlMs <= 0 || ttlMs > CRM_PHASE_1H_B_ONE_TIME_AUTH_MAX_TTL_MS) {
    throw new Error("ttlMs must be a positive duration within the maximum TTL.");
  }
  const expiresAt =
    options.expiresAt || new Date(issuedMs + ttlMs).toISOString();
  const stagingProjectRef =
    options.stagingProjectRef || CRM_STAGING_PROJECT_REF_ALLOWLIST[0];
  if (stagingProjectRef !== CRM_STAGING_PROJECT_REF_ALLOWLIST[0]) {
    throw new Error("One-time authorization may only target the Staging allowlist ref.");
  }
  if (CRM_PRODUCTION_PROJECT_REF_BLOCKLIST.includes(stagingProjectRef)) {
    throw new Error("Production project ref is forbidden in one-time authorization.");
  }
  if (!options.migrationPlanFingerprint) {
    throw new Error("migrationPlanFingerprint is required.");
  }
  const operation = options.operation || CRM_PHASE_1H_B_ONE_TIME_OPERATION;
  if (!CRM_ONE_TIME_OPERATIONS.includes(operation)) {
    throw new Error("Unsupported one-time authorization operation.");
  }

  return Object.freeze({
    schemaVersion: CRM_PHASE_1H_B_ONE_TIME_AUTH_SCHEMA_VERSION,
    operation,
    stagingProjectRef,
    migrationPlanFingerprint: String(options.migrationPlanFingerprint).toLowerCase(),
    issuedAt,
    expiresAt,
    nonce: options.nonce || randomUUID(),
    operationId: options.operationId || `crm-1hb-${randomUUID()}`,
    status: CRM_PHASE_1H_B_ONE_TIME_AUTH_STATUS.ISSUED,
    committedDecisionSufficient: false,
    credentialsSufficient: false,
    applyFlagSufficient: false,
    secretsIncluded: false,
  });
}

/**
 * Write one-time authorization to an absolute path (must not be under docs/
 * committed evidence trees). Returns the path written.
 * @param {string} absolutePath
 * @param {object} authorization
 */
export function writeCrmPhase1hBOneTimeAuthorizationFile(
  absolutePath,
  authorization
) {
  const dir = path.dirname(absolutePath);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(
    absolutePath,
    `${JSON.stringify(authorization, null, 2)}\n`,
    "utf8"
  );
  return absolutePath;
}

/**
 * Mark authorization consumed by atomic rename to sibling `.consumed` file.
 * Rejects if already consumed / missing.
 * @param {string} absolutePath
 * @param {{ consumedAt?: string, now?: Date }} [options]
 */
export function consumeCrmPhase1hBOneTimeAuthorization(
  absolutePath,
  options = {}
) {
  if (!absolutePath || !existsSync(absolutePath)) {
    throw new Error("One-time authorization file missing; cannot consume.");
  }
  const raw = loadCrmPhase1hBOneTimeAuthorizationFile(absolutePath);
  if (!raw) throw new Error("One-time authorization file unreadable.");
  if (raw.status === CRM_PHASE_1H_B_ONE_TIME_AUTH_STATUS.CONSUMED) {
    throw new Error("One-time authorization already consumed.");
  }
  const consumedAt = options.consumedAt || new Date().toISOString();
  const consumed = {
    ...raw,
    status: CRM_PHASE_1H_B_ONE_TIME_AUTH_STATUS.CONSUMED,
    consumedAt,
  };
  const consumedPath = `${absolutePath}.consumed`;
  if (existsSync(consumedPath)) {
    throw new Error("One-time authorization replay marker already exists.");
  }
  writeFileSync(consumedPath, `${JSON.stringify(consumed, null, 2)}\n`, "utf8");
  // Atomic retire of the live issued file so the same path cannot be reused.
  const usedMarkerPath = `${absolutePath}.used`;
  renameSync(absolutePath, usedMarkerPath);
  try {
    unlinkSync(usedMarkerPath);
  } catch {
    // Marker may remain if unlink fails; consumed file still blocks replay.
  }
  return Object.freeze({
    ok: true,
    consumedPath,
    consumedAt,
    secretsPrinted: false,
  });
}

/**
 * Evaluate one-time authorization against expected operation/ref/fingerprint.
 *
 * @param {{
 *   authorization?: object|null,
 *   authorizationPath?: string|null,
 *   expectedFingerprint: string,
 *   expectedProjectRef?: string,
 *   now?: Date|string|number,
 *   ownerDecision?: object|null,
 *   allowCommittedDecisionAsSoleAuth?: boolean,
 * }} options
 */
export function evaluateCrmPhase1hBOneTimeAuthorization(options = {}) {
  const expectedProjectRef =
    options.expectedProjectRef || CRM_STAGING_PROJECT_REF_ALLOWLIST[0];
  const expectedFingerprint = String(options.expectedFingerprint || "")
    .trim()
    .toLowerCase();
  const nowMs = Date.parse(
    options.now instanceof Date
      ? options.now.toISOString()
      : options.now || new Date().toISOString()
  );

  /** @type {string[]} */
  const errors = [];
  /** @type {string|null} */
  let verdict = null;

  if (options.allowCommittedDecisionAsSoleAuth === true) {
    errors.push("Committed Owner decision must never be sole apply authorization.");
    verdict =
      CRM_PHASE_1H_B_ONE_TIME_AUTH_VERDICTS.BLOCKED_ONE_TIME_AUTHORIZATION_REQUIRED;
  }

  if (
    CRM_PRODUCTION_PROJECT_REF_BLOCKLIST.includes(expectedProjectRef) ||
    expectedProjectRef === CRM_PRODUCTION_PROJECT_REF_BLOCKLIST[0]
  ) {
    return Object.freeze({
      ok: false,
      verdict:
        CRM_PHASE_1H_B_ONE_TIME_AUTH_VERDICTS.BLOCKED_PRODUCTION_PROJECT_REF,
      errors: ["Production project ref is absolutely blocked."],
      authorizationLoaded: false,
      secretsPrinted: false,
    });
  }

  const auth =
    options.authorization !== undefined
      ? options.authorization
      : options.authorizationPath
        ? loadCrmPhase1hBOneTimeAuthorizationFile(options.authorizationPath)
        : null;

  if (!auth) {
    return Object.freeze({
      ok: false,
      verdict:
        CRM_PHASE_1H_B_ONE_TIME_AUTH_VERDICTS.BLOCKED_ONE_TIME_AUTHORIZATION_REQUIRED,
      errors: [
        "Explicit one-time authorization file is required; committed decision / credentials / --apply-staging are insufficient.",
      ],
      authorizationLoaded: false,
      secretsPrinted: false,
    });
  }

  const expectedOperation =
    options.expectedOperation || CRM_PHASE_1H_B_ONE_TIME_OPERATION;
  if (Number(auth.schemaVersion) !== CRM_PHASE_1H_B_ONE_TIME_AUTH_SCHEMA_VERSION) {
    errors.push("Unsupported one-time authorization schemaVersion.");
  }
  if (auth.operation !== expectedOperation) {
    errors.push("One-time authorization operation mismatch.");
  }
  if (!auth.nonce || String(auth.nonce).trim() === "") {
    errors.push("One-time authorization nonce missing.");
  }
  if (!auth.operationId || String(auth.operationId).trim() === "") {
    errors.push("One-time authorization operationId missing.");
  }
  if (!auth.issuedAt || !Number.isFinite(Date.parse(auth.issuedAt))) {
    errors.push("One-time authorization issuedAt missing or invalid.");
  }
  if (!auth.expiresAt || !Number.isFinite(Date.parse(auth.expiresAt))) {
    errors.push("One-time authorization expiresAt missing or invalid.");
  }

  const authRef = String(auth.stagingProjectRef || "").trim();
  // Production is terminal: no later gate (expiry, replay, fingerprint) may
  // downgrade or overwrite this verdict.
  if (CRM_PRODUCTION_PROJECT_REF_BLOCKLIST.includes(authRef)) {
    return Object.freeze({
      ok: false,
      verdict:
        CRM_PHASE_1H_B_ONE_TIME_AUTH_VERDICTS.BLOCKED_PRODUCTION_PROJECT_REF,
      errors: ["One-time authorization targets Production project ref."],
      authorizationLoaded: true,
      secretsPrinted: false,
    });
  }
  if (!authRef) {
    errors.push("One-time authorization stagingProjectRef missing.");
    verdict =
      verdict ||
      CRM_PHASE_1H_B_ONE_TIME_AUTH_VERDICTS.BLOCKED_PROJECT_REF_MISMATCH;
  } else if (authRef !== expectedProjectRef) {
    errors.push("One-time authorization stagingProjectRef mismatch.");
    verdict =
      CRM_PHASE_1H_B_ONE_TIME_AUTH_VERDICTS.BLOCKED_PROJECT_REF_MISMATCH;
  } else if (authRef !== CRM_STAGING_PROJECT_REF_ALLOWLIST[0]) {
    errors.push("One-time authorization stagingProjectRef not allowlisted.");
    verdict =
      CRM_PHASE_1H_B_ONE_TIME_AUTH_VERDICTS.BLOCKED_PROJECT_REF_MISMATCH;
  }

  const authFingerprint = String(auth.migrationPlanFingerprint || "")
    .trim()
    .toLowerCase();
  if (!expectedFingerprint) {
    errors.push("Expected migration plan fingerprint missing.");
    verdict =
      verdict ||
      CRM_PHASE_1H_B_ONE_TIME_AUTH_VERDICTS.BLOCKED_MIGRATION_FINGERPRINT_MISMATCH;
  } else if (authFingerprint !== expectedFingerprint) {
    errors.push("One-time authorization migrationPlanFingerprint mismatch.");
    verdict =
      CRM_PHASE_1H_B_ONE_TIME_AUTH_VERDICTS.BLOCKED_MIGRATION_FINGERPRINT_MISMATCH;
  }

  if (auth.status === CRM_PHASE_1H_B_ONE_TIME_AUTH_STATUS.CONSUMED) {
    errors.push("One-time authorization already consumed (replay rejected).");
    verdict =
      CRM_PHASE_1H_B_ONE_TIME_AUTH_VERDICTS.BLOCKED_ONE_TIME_AUTHORIZATION_REPLAYED;
  } else if (
    auth.status &&
    auth.status !== CRM_PHASE_1H_B_ONE_TIME_AUTH_STATUS.ISSUED
  ) {
    errors.push("One-time authorization status is not issued.");
    verdict =
      verdict ||
      CRM_PHASE_1H_B_ONE_TIME_AUTH_VERDICTS.BLOCKED_ONE_TIME_AUTHORIZATION_INVALID;
  }

  const expiresMs = Date.parse(auth.expiresAt);
  const issuedMs = Date.parse(auth.issuedAt);
  if (Number.isFinite(expiresMs) && Number.isFinite(nowMs) && nowMs > expiresMs) {
    errors.push("One-time authorization expired.");
    verdict =
      CRM_PHASE_1H_B_ONE_TIME_AUTH_VERDICTS.BLOCKED_ONE_TIME_AUTHORIZATION_EXPIRED;
  }
  if (
    Number.isFinite(issuedMs) &&
    Number.isFinite(expiresMs) &&
    expiresMs - issuedMs > CRM_PHASE_1H_B_ONE_TIME_AUTH_MAX_TTL_MS
  ) {
    errors.push("One-time authorization TTL exceeds maximum allowed lifetime.");
    verdict =
      verdict ||
      CRM_PHASE_1H_B_ONE_TIME_AUTH_VERDICTS.BLOCKED_ONE_TIME_AUTHORIZATION_INVALID;
  }
  if (Number.isFinite(issuedMs) && Number.isFinite(nowMs) && issuedMs > nowMs + 60_000) {
    errors.push("One-time authorization issuedAt is in the future.");
    verdict =
      verdict ||
      CRM_PHASE_1H_B_ONE_TIME_AUTH_VERDICTS.BLOCKED_ONE_TIME_AUTHORIZATION_INVALID;
  }

  // Stale committed Owner decision must never unlock mutation by itself.
  // If a decision is loaded and claims umbrella approval without one-time auth
  // fields, mark stale for reporting (one-time auth is still required above).
  const decision = options.ownerDecision || null;
  if (
    decision &&
    decision.limitedStagingApplyUmbrellaApproved === true &&
    !decision.oneTimeAuthorizationId &&
    !decision.nonReplayableAuthorizationId
  ) {
    // Soft signal: decision alone is stale for mutation reuse.
    if (!auth || errors.length > 0) {
      // keep primary missing/invalid verdict; append stale note
      errors.push(
        "Committed Owner decision is stale for mutation and cannot authorize apply."
      );
      if (!verdict) {
        verdict =
          CRM_PHASE_1H_B_ONE_TIME_AUTH_VERDICTS.BLOCKED_STALE_OWNER_DECISION;
      }
    }
  }

  if (errors.length > 0 && !verdict) {
    verdict =
      CRM_PHASE_1H_B_ONE_TIME_AUTH_VERDICTS.BLOCKED_ONE_TIME_AUTHORIZATION_INVALID;
  }

  const ok = errors.length === 0;
  return Object.freeze({
    ok,
    verdict: ok ? null : verdict,
    errors: ok ? [] : errors,
    authorizationLoaded: true,
    operationId: auth.operationId || null,
    noncePresent: Boolean(auth.nonce),
    status: auth.status || null,
    stagingProjectRef: authRef || null,
    migrationPlanFingerprint: authFingerprint || null,
    issuedAt: auth.issuedAt || null,
    expiresAt: auth.expiresAt || null,
    secretsPrinted: false,
  });
}
