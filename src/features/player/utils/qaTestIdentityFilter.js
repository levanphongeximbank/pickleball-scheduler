/**
 * Production / QA test-identity visibility helpers.
 * Quarantine is reversible: hide from user-facing rosters without hard-delete.
 *
 * OPERATION_B1B WP3 — bounded dual-read migration:
 *   Canonical authority: qa_quarantine_list_active → qaAuthorityActive
 *   Legacy signals (TEMPORARY — remove after WP5/WP6 canonical proofs):
 *     quarantined / meta.qaQuarantined / status==='quarantined'
 *   Defense-in-depth: certified QA email domains+patterns
 *
 * Positive email classification still requires BOTH:
 *   1) an approved QA email domain, AND
 *   2) a certified fixture local-part pattern for that domain.
 * Local-part prefix alone (e.g. phase1b-smith@gmail.com) is NEVER enough.
 *
 * Never persist profiles.status='quarantined'. Never mutate auth.users here.
 * Legacy dual-read is transitional only — not a permanent silent fallback SSOT.
 */

import { isQaQuarantineAuthorityFilterEnabled } from "../config/qaQuarantineFilterFlags.js";
import {
  collectProfileIdsForQuarantineLookup,
  listActiveQaQuarantineMembership,
  observeQaQuarantineAuthorityAvailability,
  projectCanonicalAuthorityOntoRows,
} from "./qaQuarantineAuthorityRead.js";

export const APPROVED_QA_EMAIL_DOMAINS = Object.freeze([
  "pickleball-scheduler.qa",
  "prod-qa.local",
  "staging-qa.local",
]);

/**
 * Distinguishable identity-exclusion signal sources.
 * Canonical and legacy must remain separately identifiable.
 */
export const QA_IDENTITY_SIGNAL = Object.freeze({
  CANONICAL_AUTHORITY: "canonical_authority",
  LEGACY_QUARANTINED_FLAG: "legacy_quarantined_flag",
  LEGACY_META_QA_QUARANTINED: "legacy_meta_qaQuarantined",
  LEGACY_STATUS_QUARANTINED: "legacy_status_quarantined",
  CERTIFIED_QA_EMAIL: "certified_qa_email",
  NONE: "none",
});

/**
 * Dual-read precedence for *source labeling* (first match wins as reported source):
 *   1. canonical_authority   (qaAuthorityActive === true) — only when authority flag ON
 *   2. legacy_quarantined_flag
 *   3. legacy_meta_qaQuarantined
 *   4. legacy_status_quarantined
 *   5. certified_qa_email
 *
 * Exclusion uses OR (union) of positive signals. Canonical "not active" does NOT
 * clear a positive legacy signal during dual-read (legacy remains compatible).
 * Feature flag OFF ignores canonical_authority even if projected on the row.
 */
export const QA_IDENTITY_DUAL_READ_PRECEDENCE = Object.freeze([
  QA_IDENTITY_SIGNAL.CANONICAL_AUTHORITY,
  QA_IDENTITY_SIGNAL.LEGACY_QUARANTINED_FLAG,
  QA_IDENTITY_SIGNAL.LEGACY_META_QA_QUARANTINED,
  QA_IDENTITY_SIGNAL.LEGACY_STATUS_QUARANTINED,
  QA_IDENTITY_SIGNAL.CERTIFIED_QA_EMAIL,
]);

/** Domain → certified local-part patterns (evidence-backed smoke fixtures). */
const CERTIFIED_QA_EMAIL_RULES = Object.freeze([
  {
    domain: "pickleball-scheduler.qa",
    localPatterns: [
      /^phase1b-/i,
      /^qa42l-prod/i,
    ],
  },
  {
    domain: "prod-qa.local",
    localPatterns: [/^phase1c\.prod\./i],
  },
  {
    domain: "staging-qa.local",
    localPatterns: [/^phase1c\.stg\./i],
  },
]);

/**
 * Strict certified QA email predicate (shared with smoke hygiene).
 * @param {unknown} email
 * @returns {boolean}
 */
export function isCertifiedQaEmail(email) {
  const value = String(email || "").trim().toLowerCase();
  if (!value.includes("@")) return false;
  const at = value.lastIndexOf("@");
  const local = value.slice(0, at);
  const domain = value.slice(at + 1);
  if (!APPROVED_QA_EMAIL_DOMAINS.includes(domain)) return false;
  const rule = CERTIFIED_QA_EMAIL_RULES.find((entry) => entry.domain === domain);
  if (!rule) return false;
  return rule.localPatterns.some((re) => re.test(local));
}

/**
 * Classify whether an identity should be excluded from user-facing lists.
 * Returns distinguishable signal source for observability / dual-read proofs.
 *
 * @param {{
 *   email?: string|null,
 *   display_name?: string|null,
 *   name?: string|null,
 *   status?: string|null,
 *   quarantined?: boolean,
 *   qaAuthorityActive?: boolean,
 *   meta?: object
 * }} identity
 * @param {{ authorityFilterEnabled?: boolean, envSource?: Record<string, unknown>|null }} [options]
 * @returns {{ excluded: boolean, source: string }}
 */
export function classifyQaTestIdentity(identity = {}, options = {}) {
  const authorityEnabled =
    typeof options.authorityFilterEnabled === "boolean"
      ? options.authorityFilterEnabled
      : isQaQuarantineAuthorityFilterEnabled(options.envSource);

  // 1) Canonical authority (flag ON only) — distinguishable from legacy.
  if (authorityEnabled && identity?.qaAuthorityActive === true) {
    return {
      excluded: true,
      source: QA_IDENTITY_SIGNAL.CANONICAL_AUTHORITY,
    };
  }

  // 2–4) Legacy dual-read signals (temporary compatibility).
  if (identity?.quarantined === true) {
    return {
      excluded: true,
      source: QA_IDENTITY_SIGNAL.LEGACY_QUARANTINED_FLAG,
    };
  }
  if (identity?.meta?.qaQuarantined === true) {
    return {
      excluded: true,
      source: QA_IDENTITY_SIGNAL.LEGACY_META_QA_QUARANTINED,
    };
  }
  if (String(identity?.status || "").toLowerCase() === "quarantined") {
    return {
      excluded: true,
      source: QA_IDENTITY_SIGNAL.LEGACY_STATUS_QUARANTINED,
    };
  }

  // 5) Certified QA email defense-in-depth.
  if (isCertifiedQaEmail(identity?.email)) {
    return {
      excluded: true,
      source: QA_IDENTITY_SIGNAL.CERTIFIED_QA_EMAIL,
    };
  }

  return { excluded: false, source: QA_IDENTITY_SIGNAL.NONE };
}

/**
 * @param {{ email?: string|null, display_name?: string|null, name?: string|null, status?: string|null, quarantined?: boolean, qaAuthorityActive?: boolean, meta?: object }} identity
 * @param {{ authorityFilterEnabled?: boolean, envSource?: Record<string, unknown>|null }} [options]
 */
export function isConfirmedQaTestIdentity(identity = {}, options = {}) {
  return classifyQaTestIdentity(identity, options).excluded;
}

/**
 * Sync filter. Honors projected qaAuthorityActive when authority flag is ON.
 * Real users without any positive signal are always retained.
 *
 * @template T
 * @param {T[]} rows
 * @param {{ includeQa?: boolean, authorityFilterEnabled?: boolean, envSource?: Record<string, unknown>|null }} [options]
 * @returns {T[]}
 */
export function excludeQaTestIdentities(rows = [], options = {}) {
  if (options.includeQa === true) return Array.isArray(rows) ? [...rows] : [];
  return (rows || []).filter(
    (row) => !isConfirmedQaTestIdentity(row, options)
  );
}

/**
 * Dual-read exclusion with one set-based canonical authority lookup.
 * RPC absence/error → explicit bounded fallback to legacy signals only
 * (never invents quarantine membership for real users).
 *
 * @template T
 * @param {T[]} rows
 * @param {{
 *   includeQa?: boolean,
 *   authorityFilterEnabled?: boolean,
 *   envSource?: Record<string, unknown>|null,
 *   getClient?: () => { rpc: Function }|null,
 *   hasConfig?: () => boolean,
 * }} [options]
 * @returns {Promise<{ rows: T[], authority: object, mode: string }>}
 */
export async function excludeQaTestIdentitiesWithAuthority(rows = [], options = {}) {
  if (options.includeQa === true) {
    return {
      rows: Array.isArray(rows) ? [...rows] : [],
      authority: {
        ok: true,
        status: "skipped_include_qa",
        activeProfileIds: new Set(),
        queryCount: 0,
      },
      mode: "include_qa",
    };
  }

  const authorityEnabled =
    typeof options.authorityFilterEnabled === "boolean"
      ? options.authorityFilterEnabled
      : isQaQuarantineAuthorityFilterEnabled(options.envSource);

  // Rollback boundary: flag OFF → prior sync filter (legacy + certified email only).
  if (!authorityEnabled) {
    return {
      rows: excludeQaTestIdentities(rows, {
        ...options,
        authorityFilterEnabled: false,
      }),
      authority: {
        ok: true,
        status: "flag_off",
        activeProfileIds: new Set(),
        queryCount: 0,
        reason: "feature_flag_off",
      },
      mode: "legacy_only",
    };
  }

  const profileIds = collectProfileIdsForQuarantineLookup(rows);
  const authority = await listActiveQaQuarantineMembership(profileIds, {
    getClient: options.getClient,
    hasConfig: options.hasConfig,
    envSource: options.envSource,
    authorityFilterEnabled: true,
  });

  // Absence/error: do not mark anyone from canonical path; keep transitional legacy dual-read.
  const canonicalOk = authority.ok && authority.status === "ok";
  if (!canonicalOk) {
    observeQaQuarantineAuthorityAvailability(authority, {
      forceLog: options.forceAuthorityLog === true,
      logger: options.logger,
    });
  }

  const projected = canonicalOk
    ? projectCanonicalAuthorityOntoRows(rows, authority.activeProfileIds)
    : rows;

  const filtered = excludeQaTestIdentities(projected, {
    ...options,
    authorityFilterEnabled: true,
  });

  return {
    rows: filtered,
    authority,
    mode: canonicalOk
      ? "dual_read_canonical_plus_legacy"
      : "dual_read_legacy_fallback",
  };
}
