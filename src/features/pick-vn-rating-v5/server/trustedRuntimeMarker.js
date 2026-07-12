/** @typedef {'pick-vn-rating-v5-trusted-server'} TrustedRuntimeMarker */

export const TRUSTED_RUNTIME_ID = "pick-vn-rating-v5-trusted-server";

export const TRUSTED_RUNTIME_FORBIDDEN_IN_BROWSER = true;

/**
 * Trusted runtimes: Supabase Edge Function `rating-v5-complete-assessment`,
 * Node staging runners (scripts/verify-v5b1p-*.mjs). NOT Vite client bundle.
 */
export function assertTrustedRuntime(context = "unknown") {
  if (typeof globalThis !== "undefined" && globalThis.document?.createElement) {
    throw new Error(
      `Pick_VN Rating V5 trusted server runtime must not execute in browser (${context})`,
    );
  }
  return TRUSTED_RUNTIME_ID;
}
