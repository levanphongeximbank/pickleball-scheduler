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
