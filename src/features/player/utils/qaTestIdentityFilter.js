/**
 * Production / QA test-identity visibility helpers.
 * Quarantine is reversible: hide from user-facing rosters without hard-delete.
 *
 * Positive classification requires BOTH:
 *   1) an approved QA email domain, AND
 *   2) a certified fixture local-part pattern for that domain.
 * Local-part prefix alone (e.g. phase1b-smith@gmail.com) is NEVER enough.
 */

export const APPROVED_QA_EMAIL_DOMAINS = Object.freeze([
  "pickleball-scheduler.qa",
  "prod-qa.local",
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
 * @param {{ email?: string|null, display_name?: string|null, name?: string|null, status?: string|null, quarantined?: boolean, meta?: object }} identity
 */
export function isConfirmedQaTestIdentity(identity = {}) {
  if (identity?.quarantined === true || identity?.meta?.qaQuarantined === true) {
    return true;
  }
  if (String(identity?.status || "").toLowerCase() === "quarantined") {
    return true;
  }
  // Display name / loose prefix alone never classify a real user.
  return isCertifiedQaEmail(identity?.email);
}

/**
 * Filter out quarantined / confirmed QA smoke identities from user-facing lists.
 * Real users are always retained.
 * @template T
 * @param {T[]} rows
 * @param {{ includeQa?: boolean }} [options]
 * @returns {T[]}
 */
export function excludeQaTestIdentities(rows = [], options = {}) {
  if (options.includeQa === true) return Array.isArray(rows) ? [...rows] : [];
  return (rows || []).filter((row) => !isConfirmedQaTestIdentity(row));
}
