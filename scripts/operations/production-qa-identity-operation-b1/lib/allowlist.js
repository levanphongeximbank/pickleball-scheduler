/**
 * External allowlist load + validate for Operation B1.
 * Allowlist must live outside Git and contain exactly eight identities.
 */

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {
  B2_EXCLUDED_LABELS,
  EXPECTED_B1_COUNT,
  EXPECTED_PRODUCTION_PROJECT_REF,
  FORBIDDEN_REAL_USER_EMAIL,
  ZERO_REFERENCE_KEYS,
} from "./constants.js";
import { isCertifiedQaEmail } from "../../../../src/features/player/utils/qaTestIdentityFilter.js";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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
 * Validate allowlist document structure and B1 safety invariants.
 * @param {object} doc
 * @param {{ expectedSha256?: string }} [opts]
 */
export function validateAllowlistDocument(doc, opts = {}) {
  const errors = [];
  if (!doc || typeof doc !== "object") {
    return { ok: false, errors: ["allowlist_not_object"], identities: [] };
  }

  if (doc.operation !== "OPERATION_B1_REVERSIBLE_QA_QUARANTINE") {
    errors.push("wrong_operation_id");
  }
  if (doc.production_project_ref !== EXPECTED_PRODUCTION_PROJECT_REF) {
    errors.push("wrong_production_project_ref");
  }
  if (Number(doc.target_count) !== EXPECTED_B1_COUNT) {
    errors.push("target_count_not_eight");
  }
  if (!Array.isArray(doc.identities)) {
    errors.push("identities_not_array");
    return { ok: false, errors, identities: [] };
  }
  if (doc.identities.length !== EXPECTED_B1_COUNT) {
    errors.push("identity_array_length_not_eight");
  }

  const authIds = new Set();
  const profileIds = new Set();
  const emails = new Set();
  const labels = new Set();

  for (const row of doc.identities) {
    const label = String(row?.label || "").trim();
    if (B2_EXCLUDED_LABELS.includes(label)) {
      errors.push(`b2_excluded_label_present:${label}`);
    }
    if (label && labels.has(label)) errors.push(`duplicate_label:${label}`);
    if (label) labels.add(label);

    const authId = String(row?.auth_user_id || "").trim();
    const profileId = String(row?.profile_id || "").trim();
    const email = String(row?.expected_email || "").trim().toLowerCase();

    if (!UUID_RE.test(authId)) errors.push("invalid_auth_user_id");
    if (!UUID_RE.test(profileId)) errors.push("invalid_profile_id");
    if (authId !== profileId) {
      // In this system profile.id === auth user id for certified QA fixtures.
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

    const refs = row?.reference_counts || {};
    for (const key of ZERO_REFERENCE_KEYS) {
      if (Number(refs?.[key] || 0) !== 0) {
        errors.push(`nonzero_reference:${key}`);
      }
    }
  }

  if (opts.expectedSha256) {
    // Caller validates file bytes separately; optional doc-level echo.
    const claimed = String(doc.allowlist_sha256 || "").toLowerCase();
    if (claimed && claimed !== String(opts.expectedSha256).toLowerCase()) {
      errors.push("embedded_sha_mismatch");
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    identities: doc.identities,
  };
}

/**
 * Load allowlist file, verify SHA-256, validate document.
 */
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
    return { ok: false, errors: ["allowlist_file_missing"], identities: [] };
  }

  const bytes = fs.readFileSync(outside.path);
  const actualSha = sha256Hex(bytes);
  if (actualSha !== String(expectedSha256 || "").trim().toLowerCase()) {
    return {
      ok: false,
      errors: ["allowlist_sha256_mismatch"],
      identities: [],
      actualSha,
    };
  }

  let doc;
  try {
    doc = JSON.parse(bytes.toString("utf8"));
  } catch {
    return { ok: false, errors: ["allowlist_json_parse_error"], identities: [] };
  }

  const validated = validateAllowlistDocument(doc, {
    expectedSha256: actualSha,
  });
  return { ...validated, actualSha, path: outside.path };
}
