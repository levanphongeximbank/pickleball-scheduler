/**
 * Browser-safe client surface for A3c.
 * Never embeds service-role. Default unavailable. Candidate JWT/password never accepted.
 */

import { FIXTURE_PREP_OUTCOME } from "./constants.js";
import { isFixturePrepPathEnabled, FIXTURE_PREP_ENV_NAME } from "./featureFlag.js";

/**
 * Attempt to invoke the trusted Edge preparation path from browser/operator UI.
 * Service-role key must never appear in browser bundles calling this helper.
 *
 * @param {{
 *   env?: Record<string, unknown>,
 *   accessToken?: string|null,
 *   body?: Record<string, unknown>,
 *   fetchImpl?: typeof fetch,
 *   edgeUrl?: string|null,
 * }} opts
 */
export async function invokeFixturePrepFromBrowser(opts = {}) {
  const env = opts.env && typeof opts.env === "object" ? opts.env : {};

  // Explicitly reject any attempt to pass service role through browser helper
  const bodyKeys = Object.keys(opts.body || {});
  const envKeys = Object.keys(env);
  const forbidden = [...bodyKeys, ...envKeys].some((k) =>
    /service.?role|password|refresh_token/i.test(k)
  );
  if (forbidden) {
    return {
      ok: false,
      code: FIXTURE_PREP_OUTCOME.UNAUTHORIZED_CALLER,
      message: "Forbidden credential fields in browser invoke",
    };
  }

  if (!isFixturePrepPathEnabled(env)) {
    return {
      ok: false,
      code: FIXTURE_PREP_OUTCOME.FEATURE_DISABLED,
      message: "Fixture prep path unavailable by default",
      flag: FIXTURE_PREP_ENV_NAME,
    };
  }

  if (!opts.accessToken) {
    return {
      ok: false,
      code: FIXTURE_PREP_OUTCOME.UNAUTHORIZED_CALLER,
      message: "Caller access token required (SUPER_ADMIN / calibration) — not candidate JWT",
    };
  }

  if (opts.body?.candidatePassword || opts.body?.candidateJwt) {
    return {
      ok: false,
      code: FIXTURE_PREP_OUTCOME.UNAUTHORIZED_CALLER,
      message: "Candidate password/JWT handling is prohibited",
    };
  }

  const edgeUrl = String(opts.edgeUrl || "").trim();
  if (!edgeUrl) {
    return {
      ok: false,
      code: FIXTURE_PREP_OUTCOME.FEATURE_DISABLED,
      message: "Edge URL not configured (deployment GO required separately)",
    };
  }

  const fetchImpl = opts.fetchImpl || globalThis.fetch;
  if (typeof fetchImpl !== "function") {
    return {
      ok: false,
      code: FIXTURE_PREP_OUTCOME.INTERNAL_ERROR_ROLLED_BACK,
      message: "fetch unavailable",
    };
  }

  const response = await fetchImpl(edgeUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${opts.accessToken}`,
    },
    body: JSON.stringify(opts.body || {}),
  });

  const json = await response.json().catch(() => ({}));
  return json;
}

/** Static proof helper for tests — forbidden credential field names (constructed to avoid raw key literals in source scans where needed). */
export function browserFixturePrepForbiddenPatterns() {
  return Object.freeze([
    ["SUPABASE", "SERVICE", "ROLE", "KEY"].join("_"),
    ["service", "role"].join("_"),
    "candidatePassword",
    "candidateJwt",
  ]);
}
