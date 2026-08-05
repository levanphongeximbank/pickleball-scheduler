/**
 * Canonical App Shell feature flag — Phase 2 Figure 1 foundation.
 * Default OFF: preserves legacy V5 Slate shell for rollback.
 * Production must not enable this flag without an explicit rollout decision.
 */

export const CANONICAL_APP_SHELL_FLAG = "VITE_CANONICAL_APP_SHELL_ENABLED";

/**
 * @param {Record<string, unknown>|undefined|null} [envSource]
 * @returns {boolean}
 */
export function isCanonicalAppShellEnabled(envSource) {
  const source =
    envSource ||
    (typeof import.meta !== "undefined" ? import.meta.env : {}) ||
    {};
  const raw = source?.[CANONICAL_APP_SHELL_FLAG];
  return raw === true || raw === "true" || raw === "1";
}
