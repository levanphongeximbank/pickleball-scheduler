/**
 * Phase 45A.2 — Membership canonical READ model (pure, framework-free).
 *
 * Encapsulates the decision + snapshot logic that the Membership read surfaces
 * (MyClubMembersPanel, ClubMembersTab, …) use in canonical read mode. Keeping it
 * pure makes the behavior unit-testable without a React render harness and keeps
 * a single source of truth for the gate + the loading/error/ready contract.
 *
 * This module reads NO storage and performs NO RPC — it only transforms inputs.
 */
import { API_ERROR_CODES } from "../../api/constants/apiErrors.js";

/** Explicit read states surfaced to the Membership UI. */
export const MEMBERSHIP_READ_STATE = Object.freeze({
  IDLE: "idle",
  LOADING: "loading",
  READY: "ready",
  ERROR: "error",
});

/**
 * Canonical (cloud-authoritative) Membership read mode.
 *
 * Production baseline: `VITE_CLUB_STORAGE_V2=true` (member SSOT = public.club_members
 * via the V2 RPC gateway) while `VITE_CANONICAL_CLUB_REPOSITORY_ENABLED` may still be
 * OFF. So the membership roster is already cloud-authoritative whenever Club Storage V2
 * is on, and it is ALSO authoritative when the canonical repository flag is on. Reusing
 * both existing flags (no new flag) keeps the read cutover regression-free:
 *
 *   - canonical flag ON  → canonicalMembershipRepository authoritative (no blob fallback)
 *   - V2 storage ON      → canonicalMembershipRepository authoritative (no blob fallback)
 *   - neither / offline  → legacy blob roster (rollback / explicit no-Supabase mode)
 *
 * V2 storage already implies a configured Supabase backend; the canonical flag additionally
 * requires one so a broken cloud RPC is never the read path in local/offline mode.
 *
 * @param {{ canonicalEnabled?: boolean, v2StorageEnabled?: boolean, hasSupabase?: boolean }} params
 * @returns {boolean}
 */
export function isCanonicalMembershipReadEnabled({
  canonicalEnabled,
  v2StorageEnabled,
  hasSupabase,
} = {}) {
  if (v2StorageEnabled) {
    return true;
  }
  return Boolean(canonicalEnabled) && Boolean(hasSupabase);
}

/**
 * Map a canonical repository result code → a registered canonical API error code.
 * Prevents ad-hoc string error codes leaking into the UI contract (Phase 45A.2 §8).
 *
 * @param {string|null|undefined} code
 * @returns {string}
 */
export function mapRepoCodeToMembershipError(code) {
  switch (code) {
    case "CLUB_OUT_OF_SCOPE":
      return API_ERROR_CODES.CLUB_OUT_OF_SCOPE;
    case "CLUB_REQUIRED":
    case "CLUB_ID_REQUIRED":
      return API_ERROR_CODES.CLUB_REQUIRED;
    case "NOT_FOUND":
      return API_ERROR_CODES.NOT_FOUND;
    case "FORBIDDEN":
    case "TENANT_FORBIDDEN":
    case "CROSS_TENANT_ACCESS":
    case "INSUFFICIENT_SCOPE":
      return API_ERROR_CODES.FORBIDDEN;
    default:
      // MEMBERSHIP_RPC_FAILED / RPC_FAILED / RPC_NOT_DEPLOYED / NO_SUPABASE / unknown
      return API_ERROR_CODES.INTERNAL_ERROR;
  }
}

/**
 * Map a canonical membership read result → an explicit UI snapshot.
 * A cloud error/loading NEVER silently exposes legacy blob members (members = []).
 *
 * @param {object|null} result canonical repo result ({ ok, data, code })
 * @returns {{ state: string, members: Array, errorCode: string|null }}
 */
export function toMembershipReadSnapshot(result) {
  if (!result) {
    return {
      state: MEMBERSHIP_READ_STATE.ERROR,
      members: [],
      errorCode: API_ERROR_CODES.INTERNAL_ERROR,
    };
  }
  if (result.ok) {
    return {
      state: MEMBERSHIP_READ_STATE.READY,
      members: Array.isArray(result.data) ? result.data : [],
      errorCode: null,
    };
  }
  return {
    state: MEMBERSHIP_READ_STATE.ERROR,
    members: [],
    errorCode: mapRepoCodeToMembershipError(result.code),
  };
}
