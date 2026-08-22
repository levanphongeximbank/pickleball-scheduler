/**
 * Canonical App Shell feature flag — exclusive chrome switch (Wave 1 Batch 1A).
 *
 * Production: currently ON (CanonicalAppShell).
 * Code / local default when unset: OFF → LegacyMainLayoutContent (rollback).
 *
 * Keep this single flag for Wave 1. Do not add another shell-decision flag.
 * Do not delete LegacyMainLayoutContent while rollback is required.
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
