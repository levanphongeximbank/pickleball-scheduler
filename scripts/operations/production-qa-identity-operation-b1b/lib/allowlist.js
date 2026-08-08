/**
 * External allowlist load + validate for Operation B1B.
 * Allowlist must live outside Git and contain exactly eight identities.
 * Does not hardcode live Production identity data.
 */

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {
  B2_EXCLUDED_LABELS,
  CERTIFIED_B1_TARGET_LABELS,
  EXPECTED_B1B_COUNT,
  EXPECTED_PRODUCTION_PROJECT_REF,
  FORBIDDEN_REAL_USER_EMAIL,
  OPERATION_ID,
  ZERO_REFERENCE_KEYS,
} from "./constants.js";
import { isCertifiedQaEmail } from "../../../../src/features/player/utils/qaTestIdentityFilter.js";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function normalizeAllowlistLabel(label) {
  return String(label || "").trim().toUpperCase();
}

export function sha256Hex(bufferOrString) {
  return crypto.createHash("sha256").update(bufferOrString).digest("hex");
}

export function assertOutsideGitRepositories(allowlistPath, repoRoots = []) {
  const full = path.resolve(allowlistPath);
  for (const root of repoRoots) {
    const repoFull = path.resolve(root);
    const rel = path.relative(repoFull, full);
    if (rel && !rel.startsWith("..") && !path.isAbsolute(rel)) {
      return {
        ok: false,
        reason: "allowlist_inside_git_repository",
        path: full,
      };
    }
  }
  return { ok: true, path: full };
}

/**
 * Validate allowlist document structure and B1B safety invariants.
 */
export function validateAllowlistDocument(doc) {
  const errors = [];
  if (!doc || typeof doc !== "object") {
    return { ok: false, errors: ["allowlist_not_object"], identities: [] };
  }

  if (doc.operation !== OPERATION_ID) {
    errors.push("wrong_operation_id");
  }
  if (doc.production_project_ref !== EXPECTED_PRODUCTION_PROJECT_REF) {
    errors.push("wrong_production_project_ref");
  }
  if (Number(doc.target_count) !== EXPECTED_B1B_COUNT) {
    errors.push("target_count_not_eight");
  }
  if (!Array.isArray(doc.identities)) {
    errors.push("identities_not_array");
    return { ok: false, errors, identities: [] };
  }
  if (doc.identities.length !== EXPECTED_B1B_COUNT) {
    errors.push("identity_array_length_not_eight");
  }

  const authIds = new Set();
  const profileIds = new Set();
  const emails = new Set();
  const labels = new Set();
  const normalizedIdentities = [];

  for (const row of doc.identities) {
    const label = normalizeAllowlistLabel(row?.label);
    if (!label) {
      errors.push("missing_label");
    } else if (B2_EXCLUDED_LABELS.includes(label)) {
      errors.push(`b2_excluded_label_present:${label}`);
    } else if (!CERTIFIED_B1_TARGET_LABELS.includes(label)) {
      errors.push(`unknown_or_uncertified_label:${label}`);
    }
    if (label && labels.has(label)) errors.push(`duplicate_label:${label}`);
    if (label) labels.add(label);

    const authId = String(row?.auth_user_id || "").trim();
    const profileId = String(row?.profile_id || "").trim();
    const email = String(row?.expected_email || "")
      .trim()
      .toLowerCase();

    if (!UUID_RE.test(authId)) errors.push("invalid_auth_user_id");
    if (!UUID_RE.test(profileId)) errors.push("invalid_profile_id");
    if (authId !== profileId) {
      errors.push("auth_profile_id_mismatch");
    }
    if (authIds.has(authId)) errors.push("duplicate_auth_user_id");
    if (profileIds.has(profileId)) errors.push("duplicate_profile_id");
    authIds.add(authId);
    profileIds.add(profileId);

    if (!email) {
      errors.push("missing_email");
    } else {
      if (email === FORBIDDEN_REAL_USER_EMAIL) {
        errors.push("forbidden_real_user_email");
      }
      if (!isCertifiedQaEmail(email)) {
        errors.push("email_not_certified_qa");
      }
      if (emails.has(email)) errors.push("duplicate_email");
      emails.add(email);
    }

    for (const key of ZERO_REFERENCE_KEYS) {
      if (Number(row?.reference_counts?.[key] || 0) !== 0) {
        errors.push(`nonzero_reference:${key}`);
      }
    }

    normalizedIdentities.push({
      ...row,
      label: label || row?.label,
      auth_user_id: authId,
      profile_id: profileId,
      expected_email: email,
    });
  }

  for (const required of CERTIFIED_B1_TARGET_LABELS) {
    if (!labels.has(required)) {
      errors.push(`missing_certified_label:${required}`);
    }
  }
  if (labels.size !== CERTIFIED_B1_TARGET_LABELS.length) {
    errors.push("certified_labels_not_exact_eight_unique");
  }

  return {
    ok: errors.length === 0,
    errors,
    identities: errors.length === 0 ? normalizedIdentities : doc.identities,
  };
}

export function loadAndValidateAllowlistFile(
  allowlistPath,
  expectedSha256,
  { repoRoots = [] } = {}
) {
  const outside = assertOutsideGitRepositories(allowlistPath, repoRoots);
  if (!outside.ok) {
    return { ok: false, errors: [outside.reason], identities: [] };
  }
  if (!fs.existsSync(outside.path)) {
    return { ok: false, errors: ["allowlist_missing"], identities: [] };
  }
  let bytes;
  try {
    bytes = fs.readFileSync(outside.path);
  } catch {
    return { ok: false, errors: ["allowlist_read_error"], identities: [] };
  }
  const actualSha = sha256Hex(bytes);
  const expected = String(expectedSha256 || "")
    .trim()
    .toLowerCase();
  if (actualSha !== expected) {
    return {
      ok: false,
      errors: ["allowlist_sha256_mismatch"],
      identities: [],
    };
  }
  let doc;
  try {
    // Parse the already-verified bytes — do not re-read the file.
    doc = JSON.parse(bytes.toString("utf8"));
  } catch {
    return { ok: false, errors: ["allowlist_json_parse_error"], identities: [] };
  }
  return validateAllowlistDocument(doc);
}

export function verifySnapshotBytes(snapshotPath, expectedSha256) {
  const snapPath = String(snapshotPath || "").trim();
  const snapSha = String(expectedSha256 || "")
    .trim()
    .toLowerCase();
  if (!snapPath || !/^[0-9a-f]{64}$/.test(snapSha)) {
    return { ok: false, reasons: ["missing_or_invalid_recovery_snapshot"] };
  }
  if (!fs.existsSync(snapPath)) {
    return { ok: false, reasons: ["recovery_snapshot_missing"] };
  }
  try {
    const bytes = fs.readFileSync(snapPath);
    const actualSha = sha256Hex(bytes);
    if (actualSha !== snapSha) {
      return { ok: false, reasons: ["recovery_snapshot_sha256_mismatch"] };
    }
    return { ok: true, snapPath, snapSha, bytes };
  } catch {
    return { ok: false, reasons: ["recovery_snapshot_read_error"] };
  }
}
