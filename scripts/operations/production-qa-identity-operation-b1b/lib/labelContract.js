/**
 * Mode-aware exact-eight QA label ↔ email binding contract (Option C).
 * Shared by allowlist validation and preclaim documentation of JS-side rules.
 * SQL20 mirrors the same predicate for prepare + read-only preclaim RPC.
 *
 * Production labels and Staging labels are NEVER interchangeable.
 */

import {
  CERTIFIED_B1_TARGET_LABELS,
  CERTIFIED_STAGING_TARGET_LABELS,
  FORBIDDEN_REAL_USER_EMAIL,
  OPERATION_TARGET_MODE,
} from "./constants.js";
import { isCertifiedQaEmail } from "../../../../src/features/player/utils/qaTestIdentityFilter.js";

export function normalizeContractLabel(label) {
  return String(label || "").trim().toUpperCase();
}

export function certifiedLabelsForOperationMode(mode) {
  return mode === OPERATION_TARGET_MODE.STAGING_REHEARSAL
    ? CERTIFIED_STAGING_TARGET_LABELS
    : CERTIFIED_B1_TARGET_LABELS;
}

export function isProductionCertifiedQaLabel(label) {
  return CERTIFIED_B1_TARGET_LABELS.includes(normalizeContractLabel(label));
}

export function isStagingCertifiedQaLabel(label) {
  return CERTIFIED_STAGING_TARGET_LABELS.includes(
    normalizeContractLabel(label)
  );
}

function normalizeEmail(email) {
  return String(email || "")
    .trim()
    .toLowerCase();
}

/**
 * Staging-certified fixture email (exact domain + local-part family).
 * @param {unknown} email
 */
export function isStagingCertifiedQaEmail(email) {
  const value = normalizeEmail(email);
  if (!value || value === FORBIDDEN_REAL_USER_EMAIL) return false;
  if (!value.endsWith("@staging-qa.local")) return false;
  if (!isCertifiedQaEmail(value)) return false;
  return value.startsWith("phase1c.stg.");
}

/**
 * Production-certified fixture email (never Staging domain).
 * Mirrors allowlist Production rules + isCertifiedQaEmail.
 * @param {unknown} email
 */
export function isProductionCertifiedQaEmail(email) {
  const value = normalizeEmail(email);
  if (!value || value === FORBIDDEN_REAL_USER_EMAIL) return false;
  if (value.endsWith("@staging-qa.local")) return false;
  return isCertifiedQaEmail(value);
}

/**
 * Validate one label/email pair for a declared operation mode.
 * Fail-closed; exact-eight only (no broad regex acceptance).
 *
 * @param {{
 *   operationTargetMode?: string,
 *   label?: unknown,
 *   expectedEmail?: unknown,
 * }} args
 * @returns {{ ok: boolean, reason?: string, label?: string, expectedEmail?: string }}
 */
export function validateCertifiedQaLabelBinding(args = {}) {
  const mode = String(args.operationTargetMode || "")
    .trim()
    .toLowerCase();
  const label = normalizeContractLabel(args.label);
  const expectedEmail = normalizeEmail(args.expectedEmail);

  if (
    mode !== OPERATION_TARGET_MODE.PRODUCTION &&
    mode !== OPERATION_TARGET_MODE.STAGING_REHEARSAL
  ) {
    return { ok: false, reason: "operation_target_mode_required" };
  }
  if (!label) {
    return { ok: false, reason: "missing_label" };
  }
  if (!expectedEmail) {
    return { ok: false, reason: "missing_email" };
  }
  if (expectedEmail === FORBIDDEN_REAL_USER_EMAIL) {
    return {
      ok: false,
      reason: "forbidden_real_user_email",
      label,
      expectedEmail,
    };
  }

  const isStaging = mode === OPERATION_TARGET_MODE.STAGING_REHEARSAL;
  if (isStaging) {
    if (isProductionCertifiedQaLabel(label)) {
      return {
        ok: false,
        reason: `production_label_rejected_in_staging_mode:${label}`,
        label,
        expectedEmail,
      };
    }
    if (!isStagingCertifiedQaLabel(label)) {
      return {
        ok: false,
        reason: `unknown_or_uncertified_label:${label}`,
        label,
        expectedEmail,
      };
    }
    if (!isStagingCertifiedQaEmail(expectedEmail)) {
      return {
        ok: false,
        reason: "staging_email_domain_required",
        label,
        expectedEmail,
      };
    }
    return { ok: true, label, expectedEmail };
  }

  if (isStagingCertifiedQaLabel(label)) {
    return {
      ok: false,
      reason: `staging_label_rejected_in_production_mode:${label}`,
      label,
      expectedEmail,
    };
  }
  if (!isProductionCertifiedQaLabel(label)) {
    return {
      ok: false,
      reason: `unknown_or_uncertified_label:${label}`,
      label,
      expectedEmail,
    };
  }
  if (!isProductionCertifiedQaEmail(expectedEmail)) {
    return {
      ok: false,
      reason: expectedEmail.endsWith("@staging-qa.local")
        ? "staging_qa_email_rejected_in_production_mode"
        : "email_not_certified_qa",
      label,
      expectedEmail,
    };
  }
  return { ok: true, label, expectedEmail };
}

/**
 * Build bindings payload for the read-only SQL preclaim RPC.
 * @param {Array<{ label?: string, expected_email?: string, expectedEmail?: string }>} identities
 */
export function buildPrepareContractBindings(identities) {
  return (identities || []).map((row) => ({
    allowlist_label: normalizeContractLabel(row?.label),
    expected_email: normalizeEmail(row?.expected_email ?? row?.expectedEmail),
  }));
}
