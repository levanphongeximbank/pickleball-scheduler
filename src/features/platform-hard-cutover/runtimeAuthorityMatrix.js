/**
 * PLATFORM-HARD-CUTOVER-01 — canonical runtime authority matrix.
 * One active authority per domain. Forbidden fallbacks are explicit.
 */

export const HARD_CUTOVER_FLAG = "VITE_PLATFORM_HARD_CUTOVER_ENABLED";
export const COMPETITION_REMOTE_SSOT_FLAG = "VITE_COMPETITION_REMOTE_SSOT_ENABLED";

/**
 * @param {Record<string, unknown>|undefined|null} [env]
 */
export function readEnvFlag(key, env) {
  const source =
    env && typeof env === "object"
      ? env
      : typeof import.meta !== "undefined"
        ? import.meta.env
        : {};
  return String(source?.[key] ?? "false").toLowerCase() === "true";
}

export function isPlatformHardCutoverEnabled(env) {
  return readEnvFlag(HARD_CUTOVER_FLAG, env);
}

export function isCompetitionRemoteSsotEnabled(env) {
  return readEnvFlag(COMPETITION_REMOTE_SSOT_FLAG, env);
}

/** @typedef {{
 *   domain: string,
 *   productionAdapter: string,
 *   allowedFlag: string|null,
 *   forbiddenFallback: string[],
 *   expectedBackend: string,
 *   failClosedError: string,
 *   verificationTest: string,
 * }} RuntimeAuthorityEntry
 */

/** @type {ReadonlyArray<RuntimeAuthorityEntry>} */
export const RUNTIME_AUTHORITY_MATRIX = Object.freeze([
  {
    domain: "club_cloud",
    productionAdapter: "club_data_v3 sync (cloudSync.syncClubToCloud)",
    allowedFlag: null,
    forbiddenFallback: ["club_ai_data", "pickleball-cloud-db-v1", "mergeLegacyClubAiToV3"],
    expectedBackend: "supabase.club_data_v3",
    failClosedError: "CLUB_CLOUD_AUTHORITY_UNAVAILABLE",
    verificationTest: "tests/platform-hard-cutover-01-phase-04-authority.test.js",
  },
  {
    domain: "club_blob_local",
    productionAdapter: "cache-only under hard cutover (not SoT)",
    allowedFlag: HARD_CUTOVER_FLAG,
    forbiddenFallback: ["localStorage writable SoT"],
    expectedBackend: "supabase.club_data_v3",
    failClosedError: "LOCALSTORAGE_AUTHORITY_FORBIDDEN",
    verificationTest: "tests/platform-hard-cutover-01-phase-04-authority.test.js",
  },
  {
    domain: "court_runtime",
    productionAdapter: "court-engine/runtime durable",
    allowedFlag: "VITE_COURT_RUNTIME_AUTHORITY=durable",
    forbiddenFallback: ["local court store as Prod SoT", "infer local from RPC failure"],
    expectedBackend: "court_engine_stores / court_engine_active_sessions",
    failClosedError: "COURT_RUNTIME_LOCAL_MODE_NOT_EXPLICIT",
    verificationTest: "tests/platform-hard-cutover-01-phase-04-authority.test.js",
  },
  {
    domain: "competition_match_result",
    productionAdapter: "competition_ssot_finalize_match_result",
    allowedFlag: COMPETITION_REMOTE_SSOT_FLAG,
    forbiddenFallback: [
      "direct tournament_match_live write",
      "in-memory Prod claim",
      "team tournament dual finalize",
      "silent blob fallback",
    ],
    expectedBackend: "competition_ssot_finalized_results via RPC",
    failClosedError: "COMPETITION_SSOT_UNAVAILABLE",
    verificationTest: "tests/platform-hard-cutover-01-phase-04-competition-ssot.test.js",
  },
  {
    domain: "player_rating",
    productionAdapter: "player-rating/foundation → V5 durable",
    allowedFlag: "VITE_PICK_VN_RATING_V5_ENABLED",
    forbiddenFallback: [
      "club blob rating verified write",
      "local assessment as SSOT",
      "competition Elo as public rating",
    ],
    expectedBackend: "player_rating_* / rating_v5_idempotency",
    failClosedError: "PLAYER_RATING_DURABLE_UNAVAILABLE",
    verificationTest: "tests/platform-hard-cutover-01-phase-04-rating.test.js",
  },
  {
    domain: "public_news",
    productionAdapter: "news public RPC live",
    allowedFlag: "VITE_PUBLIC_NEWS_SOURCE=live",
    forbiddenFallback: ["MOCK_NEWS silent fallback"],
    expectedBackend: "news_public_content_query_public",
    failClosedError: "PUBLIC_NEWS_LIVE_UNAVAILABLE",
    verificationTest: "tests/platform-hard-cutover-01-phase-04-authority.test.js",
  },
  {
    domain: "private_pairing_rules",
    productionAdapter:
      "privatePairingRulesRepository → security-definer RPC only; live load via private_pairing_get_active_rules_for_scope",
    allowedFlag: HARD_CUTOVER_FLAG,
    forbiddenFallback: [
      "legacy_blob picker (loadPlayersForClub / registry)",
      "localStorage rule SoT",
      "mock rule persistence",
      "direct SPA writes to private_pairing_* tables",
      "silent rating=3.5 default under hard cutover",
    ],
    expectedBackend:
      "private_pairing_rule_sets / private_pairing_rules / private_pairing_rule_targets / private_pairing_rule_audit_logs via RPC",
    failClosedError: "PRIVATE_PAIRING_LEGACY_PICKER_FORBIDDEN",
    verificationTest: "tests/private-pairing-hard-cutover-01.test.js",
  },
]);

export function listRuntimeAuthorityDomains() {
  return RUNTIME_AUTHORITY_MATRIX.map((row) => row.domain);
}

export function getRuntimeAuthorityEntry(domain) {
  return RUNTIME_AUTHORITY_MATRIX.find((row) => row.domain === domain) || null;
}
