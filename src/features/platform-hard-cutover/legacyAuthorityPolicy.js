/**
 * Legacy authority policy — fail-closed helpers for hard cutover.
 */

import { isSecureRuntime } from "../../auth/runtime.js";
import {
  isPlatformHardCutoverEnabled,
  isCompetitionRemoteSsotEnabled,
} from "./runtimeAuthorityMatrix.js";

export const LEGACY_AUTHORITY_ERROR = Object.freeze({
  CLUB_AI_DATA_LOCKED: "CLUB_AI_DATA_LOCKED",
  LOCAL_CLOUD_DB_FORBIDDEN: "LOCAL_CLOUD_DB_FORBIDDEN",
  LOCALSTORAGE_AUTHORITY_FORBIDDEN: "LOCALSTORAGE_AUTHORITY_FORBIDDEN",
  MATCH_LIVE_DIRECT_WRITE_FORBIDDEN: "MATCH_LIVE_DIRECT_WRITE_FORBIDDEN",
  COMPETITION_INMEMORY_PROD_FORBIDDEN: "COMPETITION_INMEMORY_PROD_FORBIDDEN",
  SILENT_FALLBACK_FORBIDDEN: "SILENT_FALLBACK_FORBIDDEN",
  MOCK_PERSISTENCE_FORBIDDEN: "MOCK_PERSISTENCE_FORBIDDEN",
  PRIVATE_PAIRING_LEGACY_PICKER_FORBIDDEN: "PRIVATE_PAIRING_LEGACY_PICKER_FORBIDDEN",
  PRIVATE_PAIRING_SILENT_RATING_DEFAULT_FORBIDDEN:
    "PRIVATE_PAIRING_SILENT_RATING_DEFAULT_FORBIDDEN",
  COACHING_LOCALSTORAGE_AUTHORITY_FORBIDDEN: "COACHING_LOCALSTORAGE_AUTHORITY_FORBIDDEN",
  MESSAGING_DEMO_AUTHORITY_FORBIDDEN: "MESSAGING_DEMO_AUTHORITY_FORBIDDEN",
  DASHBOARD_ANALYTICS_MOCK_FORBIDDEN: "DASHBOARD_ANALYTICS_MOCK_FORBIDDEN",
  DASHBOARD_ANALYTICS_LOCALSTORAGE_FORBIDDEN: "DASHBOARD_ANALYTICS_LOCALSTORAGE_FORBIDDEN",
  FINANCE_LOCALSTORAGE_AUTHORITY_FORBIDDEN: "FINANCE_LOCALSTORAGE_AUTHORITY_FORBIDDEN",
  FINANCE_DEMO_CLUB_FALLBACK_FORBIDDEN: "FINANCE_DEMO_CLUB_FALLBACK_FORBIDDEN",
  CRM_LOCALSTORAGE_AUTHORITY_FORBIDDEN: "CRM_LOCALSTORAGE_AUTHORITY_FORBIDDEN",
  CRM_DEMO_CLUB_FALLBACK_FORBIDDEN: "CRM_DEMO_CLUB_FALLBACK_FORBIDDEN",
  BILLING_LOCALSTORAGE_AUTHORITY_FORBIDDEN: "BILLING_LOCALSTORAGE_AUTHORITY_FORBIDDEN",
  PUBLIC_PORTAL_LOCALSTORAGE_AUTHORITY_FORBIDDEN:
    "PUBLIC_PORTAL_LOCALSTORAGE_AUTHORITY_FORBIDDEN",
  PUBLIC_PORTAL_MOCK_FALLBACK_FORBIDDEN: "PUBLIC_PORTAL_MOCK_FALLBACK_FORBIDDEN",
});

export function createLegacyAuthorityError(code, message) {
  return {
    ok: false,
    code,
    error: message || code,
    legacyBlocked: true,
  };
}

/** True when Production-like runtime must not use legacy writers. */
export function mustBlockLegacyWriters(env) {
  return isSecureRuntime() || isPlatformHardCutoverEnabled(env);
}

export function assertNoClubAiDataAccess() {
  return createLegacyAuthorityError(
    LEGACY_AUTHORITY_ERROR.CLUB_AI_DATA_LOCKED,
    "club_ai_data is retired. Use club_data_v3 only."
  );
}

export function assertLocalCloudDbAllowed(env) {
  if (mustBlockLegacyWriters(env)) {
    return createLegacyAuthorityError(
      LEGACY_AUTHORITY_ERROR.LOCAL_CLOUD_DB_FORBIDDEN,
      "pickleball-cloud-db-v1 is forbidden under secure/hard-cutover runtime."
    );
  }
  return { ok: true };
}

export function assertMatchLiveDirectWriteAllowed(env) {
  // Keep legacy referee/director path until M8 SQL + remote SSOT flag are activated.
  if (isPlatformHardCutoverEnabled(env) || isCompetitionRemoteSsotEnabled(env)) {
    return createLegacyAuthorityError(
      LEGACY_AUTHORITY_ERROR.MATCH_LIVE_DIRECT_WRITE_FORBIDDEN,
      "Direct tournament_match_live writes forbidden. Use competition SSOT / referee RPC pipeline."
    );
  }
  return { ok: true };
}

export function assertInMemoryCompetitionProdAllowed(env) {
  if (mustBlockLegacyWriters(env) && isCompetitionRemoteSsotEnabled(env)) {
    return createLegacyAuthorityError(
      LEGACY_AUTHORITY_ERROR.COMPETITION_INMEMORY_PROD_FORBIDDEN,
      "In-memory competition store is not Production authority when remote SSOT is enabled."
    );
  }
  return { ok: true };
}

export function assertMockPersistenceAllowed(source, env) {
  const normalized = String(source || "").toLowerCase();
  if (normalized === "mock" && mustBlockLegacyWriters(env)) {
    return createLegacyAuthorityError(
      LEGACY_AUTHORITY_ERROR.MOCK_PERSISTENCE_FORBIDDEN,
      "Mock persistence is forbidden under secure/hard-cutover runtime."
    );
  }
  return { ok: true };
}

export function rejectSilentFallback(reason) {
  return createLegacyAuthorityError(
    LEGACY_AUTHORITY_ERROR.SILENT_FALLBACK_FORBIDDEN,
    reason || "Silent fallback is forbidden."
  );
}

/**
 * Private Pairing admin picker may use legacy_blob only when hard cutover is OFF.
 * Under hard cutover, canonical club/player repositories are required.
 */
export function assertPrivatePairingLegacyPickerAllowed(env) {
  if (isPlatformHardCutoverEnabled(env)) {
    return createLegacyAuthorityError(
      LEGACY_AUTHORITY_ERROR.PRIVATE_PAIRING_LEGACY_PICKER_FORBIDDEN,
      "Private Pairing legacy_blob picker is forbidden under hard cutover. Use canonical club/player repositories."
    );
  }
  return { ok: true };
}

/** Silent rating=3.5 defaults are forbidden for Private Pairing under hard cutover. */
export function assertPrivatePairingSilentRatingDefaultAllowed(env) {
  if (isPlatformHardCutoverEnabled(env)) {
    return createLegacyAuthorityError(
      LEGACY_AUTHORITY_ERROR.PRIVATE_PAIRING_SILENT_RATING_DEFAULT_FORBIDDEN,
      "Silent rating default 3.5 is forbidden under hard cutover. Provide an explicit rating or exclude the player."
    );
  }
  return { ok: true };
}

/** Coaching legacy/localStorage SoT is forbidden under hard cutover. */
export function assertCoachingLegacyAuthorityAllowed(env) {
  if (isPlatformHardCutoverEnabled(env)) {
    return createLegacyAuthorityError(
      LEGACY_AUTHORITY_ERROR.COACHING_LOCALSTORAGE_AUTHORITY_FORBIDDEN,
      "Coaching localStorage/legacy authority is forbidden under hard cutover. Use durable coaching_* RPC or UNAVAILABLE."
    );
  }
  return { ok: true };
}

/** Messaging DEMO / in-memory community SoT is forbidden under hard cutover. */
export function assertMessagingDemoAuthorityAllowed(env) {
  if (isPlatformHardCutoverEnabled(env)) {
    return createLegacyAuthorityError(
      LEGACY_AUTHORITY_ERROR.MESSAGING_DEMO_AUTHORITY_FORBIDDEN,
      "Messaging DEMO authority is forbidden under hard cutover. Use PRODUCTION trusted backend or UNAVAILABLE."
    );
  }
  return { ok: true };
}

/** Dashboard mock/demo/preview invention is forbidden under hard cutover. */
export function assertDashboardAnalyticsMockAllowed(env) {
  if (isPlatformHardCutoverEnabled(env)) {
    return createLegacyAuthorityError(
      LEGACY_AUTHORITY_ERROR.DASHBOARD_ANALYTICS_MOCK_FORBIDDEN,
      "Dashboard mock/demo/preview payloads are forbidden under hard cutover. Use reporting projections or typed UNAVAILABLE."
    );
  }
  return { ok: true };
}

/** Dashboard must not treat localStorage club blob as Prod analytics SoT under hard cutover. */
export function assertDashboardAnalyticsLocalStorageAllowed(env) {
  if (isPlatformHardCutoverEnabled(env)) {
    return createLegacyAuthorityError(
      LEGACY_AUTHORITY_ERROR.DASHBOARD_ANALYTICS_LOCALSTORAGE_FORBIDDEN,
      "Dashboard localStorage analytics authority is forbidden under hard cutover."
    );
  }
  return { ok: true };
}

/** Finance ledger localStorage SoT is forbidden under hard cutover. */
export function assertFinanceLocalStorageAuthorityAllowed(env) {
  if (isPlatformHardCutoverEnabled(env)) {
    return createLegacyAuthorityError(
      LEGACY_AUTHORITY_ERROR.FINANCE_LOCALSTORAGE_AUTHORITY_FORBIDDEN,
      "Finance localStorage ledger authority is forbidden under hard cutover. Use finance_* RPC or UNAVAILABLE."
    );
  }
  return { ok: true };
}

/** demo-club must never be an operational Finance club scope. */
export function assertFinanceDemoClubFallbackAllowed(clubId, env) {
  const normalized = String(clubId || "").trim();
  if (normalized === "demo-club") {
    if (isPlatformHardCutoverEnabled(env)) {
      return createLegacyAuthorityError(
        LEGACY_AUTHORITY_ERROR.FINANCE_DEMO_CLUB_FALLBACK_FORBIDDEN,
        "Finance demo-club fallback is forbidden under hard cutover."
      );
    }
    return createLegacyAuthorityError(
      LEGACY_AUTHORITY_ERROR.FINANCE_DEMO_CLUB_FALLBACK_FORBIDDEN,
      "Finance demo-club fallback is not an operational club scope."
    );
  }
  return { ok: true };
}

/** CRM localStorage / mock SoT is forbidden under hard cutover. */
export function assertCrmLocalStorageAuthorityAllowed(env) {
  if (isPlatformHardCutoverEnabled(env)) {
    return createLegacyAuthorityError(
      LEGACY_AUTHORITY_ERROR.CRM_LOCALSTORAGE_AUTHORITY_FORBIDDEN,
      "CRM localStorage/mock authority is forbidden under hard cutover. Use crm_* RPC or UNAVAILABLE."
    );
  }
  return { ok: true };
}

/** demo-club must never be an operational CRM club scope. */
export function assertCrmDemoClubFallbackAllowed(clubId, env) {
  const normalized = String(clubId || "").trim();
  if (normalized === "demo-club") {
    if (isPlatformHardCutoverEnabled(env)) {
      return createLegacyAuthorityError(
        LEGACY_AUTHORITY_ERROR.CRM_DEMO_CLUB_FALLBACK_FORBIDDEN,
        "CRM demo-club fallback is forbidden under hard cutover."
      );
    }
    return createLegacyAuthorityError(
      LEGACY_AUTHORITY_ERROR.CRM_DEMO_CLUB_FALLBACK_FORBIDDEN,
      "CRM demo-club fallback is not an operational club scope."
    );
  }
  return { ok: true };
}

/** Billing local/memory fallback is forbidden under hard cutover. */
export function assertBillingLocalAuthorityAllowed(env) {
  if (isPlatformHardCutoverEnabled(env)) {
    return createLegacyAuthorityError(
      LEGACY_AUTHORITY_ERROR.BILLING_LOCALSTORAGE_AUTHORITY_FORBIDDEN,
      "Billing localStorage/demo authority is forbidden under hard cutover. Use durable billing backend or typed UNAVAILABLE."
    );
  }
  return { ok: true };
}

/** Public Portal must not treat localStorage club blobs as public catalog SoT under HC. */
export function assertPublicPortalLocalAuthorityAllowed(env) {
  if (isPlatformHardCutoverEnabled(env)) {
    return createLegacyAuthorityError(
      LEGACY_AUTHORITY_ERROR.PUBLIC_PORTAL_LOCALSTORAGE_AUTHORITY_FORBIDDEN,
      "Public Portal localStorage/club-blob authority is forbidden under hard cutover. Use public_catalog_* RPC or typed EMPTY/UNAVAILABLE."
    );
  }
  return { ok: true };
}

/** Public Portal must not mock-on-empty or silently substitute demo catalog under HC. */
export function assertPublicPortalMockFallbackAllowed(env) {
  if (isPlatformHardCutoverEnabled(env)) {
    return createLegacyAuthorityError(
      LEGACY_AUTHORITY_ERROR.PUBLIC_PORTAL_MOCK_FALLBACK_FORBIDDEN,
      "Public Portal mock/demo catalog fallback is forbidden under hard cutover. Fail closed with typed EMPTY/UNAVAILABLE/ERROR."
    );
  }
  return { ok: true };
}
