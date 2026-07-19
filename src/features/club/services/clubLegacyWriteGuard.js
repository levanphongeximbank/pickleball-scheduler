/**
 * Phase 45A.3E — gate for retired Club entity blob / dual-write authority.
 *
 * When Club Storage V2 is ON and Supabase is configured, public.clubs via
 * club_create / club_update is the only Club entity write plane. Legacy writers
 * may run only as offline / V2-OFF / no-Supabase rollback adapters.
 *
 * Phase 45A.4C.5 — same authority posture for Membership roster add/remove:
 * public.club_members via club_add_member / club_remove_member is SSOT under V2.
 */
import { hasSupabaseConfig } from "../../../auth/supabaseClient.js";
import { API_ERROR_CODES } from "../../api/constants/apiErrors.js";
import { isClubStorageV2Enabled } from "../config/clubRegistryFlags.js";

/** True when Production cloud Club storage owns Club entity create/update. */
export function isClubCloudCommandAuthoritative() {
  return Boolean(isClubStorageV2Enabled() && hasSupabaseConfig());
}

/**
 * True when cloud Membership commands own roster add/remove.
 * V2 flag alone is enough (matches clubMemberService V2 early-return).
 * Offline / no-Supabase callers still keep the flag OFF in practice.
 */
export function isClubMembershipCloudAuthoritative() {
  return Boolean(isClubStorageV2Enabled());
}

/**
 * @param {{ operation: string, deferred?: boolean }} options
 * @returns {{ ok: true } | { ok: false, code: string, error: string }}
 */
export function assertLegacyClubEntityWriteAllowed({
  operation,
  deferred = false,
} = {}) {
  if (!isClubCloudCommandAuthoritative()) {
    return { ok: true };
  }

  const label = String(operation || "legacy Club write").trim();
  if (deferred) {
    return {
      ok: false,
      code: API_ERROR_CODES.FEATURE_DISABLED,
      error: `${label} bị khóa khi Club Storage V2 bật (chờ phase archive/delete / governance commands).`,
    };
  }

  return {
    ok: false,
    code: API_ERROR_CODES.FEATURE_DISABLED,
    error: `${label} đã nghỉ hưu khi Club Storage V2 bật. Dùng clubTenantService → club_create/club_update.`,
  };
}

/**
 * Phase 45A.4C.5 — hard-block blob Membership roster writers under V2.
 * Offline / V2-OFF adapters remain the only allowed blob add/remove path.
 *
 * @param {{ operation: string }} options
 * @returns {{ ok: true } | { ok: false, code: string, error: string }}
 */
export function assertLegacyMembershipRosterWriteAllowed({ operation } = {}) {
  if (!isClubMembershipCloudAuthoritative()) {
    return { ok: true };
  }

  const label = String(operation || "legacy Membership roster write").trim();
  return {
    ok: false,
    code: API_ERROR_CODES.FEATURE_DISABLED,
    error: `${label} đã nghỉ hưu khi Club Storage V2 bật. Membership SSOT = public.club_members (club_add_member / club_remove_member).`,
  };
}

/**
 * Phase 2D — hard-block blob / registry governance role writers under V2.
 * Owner / president / VP SoT = club_governance_assignments via assign/clear/transfer RPCs.
 *
 * @param {{ operation: string }} options
 * @returns {{ ok: true } | { ok: false, code: string, error: string }}
 */
export function assertLegacyGovernanceRoleWriteAllowed({ operation } = {}) {
  if (!isClubMembershipCloudAuthoritative()) {
    return { ok: true };
  }

  const label = String(operation || "legacy governance role write").trim();
  return {
    ok: false,
    code: API_ERROR_CODES.FEATURE_DISABLED,
    error: `${label} đã nghỉ hưu khi Club Storage V2 bật. Governance SSOT = club_assign_owner / club_clear_owner / club_transfer_president / VP RPCs.`,
  };
}
