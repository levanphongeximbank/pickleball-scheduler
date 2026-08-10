/**
 * Captain access cloud contracts (W1).
 *
 * W2 applies SQL that creates:
 *   team_tournament_set_captain_access
 *   team_tournament_get_captain_portal
 *
 * Until then, mutations fail closed — no client invent authority.
 */

import { getSupabaseAuthClient } from "../../../auth/supabaseClient.js";

export const CAPTAIN_ACCESS_SET_RPC = "team_tournament_set_captain_access";
export const CAPTAIN_PORTAL_GET_RPC = "team_tournament_get_captain_portal";
export const CAPTAIN_ACCESS_SET_COMMAND = "captainAccess.set";

export const CAPTAIN_ACCESS_RPC_DEPLOYED = false;

/**
 * @returns {boolean}
 */
export function isCaptainAccessCloudWriterDeployed() {
  return CAPTAIN_ACCESS_RPC_DEPLOYED === true;
}

/**
 * @returns {boolean}
 */
export function isCaptainPortalScopedReaderDeployed() {
  return CAPTAIN_ACCESS_RPC_DEPLOYED === true;
}

/**
 * Manage-only setter contract.
 * @param {{
 *   tournamentId: string,
 *   enabled: boolean,
 *   expectedVersion?: number|null,
 *   idempotencyKey?: string|null,
 * }} params
 * @returns {Promise<{ ok: boolean, code?: string, error?: string, captainAccessEnabled?: boolean, version?: number }>}
 */
export async function setCaptainAccess(params = {}) {
  const tournamentId = String(params.tournamentId || "").trim();
  if (!tournamentId) {
    return { ok: false, code: "VALIDATION_ERROR", error: "Thiếu tournamentId." };
  }

  if (!isCaptainAccessCloudWriterDeployed()) {
    return {
      ok: false,
      code: "CAPTAIN_ACCESS_WRITER_UNAVAILABLE",
      error: "Chưa áp dụng SQL staging (W2). Không lưu toggle trên máy khách.",
    };
  }

  const client = getSupabaseAuthClient();
  if (!client?.rpc) {
    return { ok: false, code: "NOT_CONFIGURED", error: "Supabase chưa sẵn sàng." };
  }

  const { data, error } = await client.rpc(CAPTAIN_ACCESS_SET_RPC, {
    p_tournament_id: tournamentId,
    p_enabled: Boolean(params.enabled),
    p_expected_version: params.expectedVersion ?? null,
    p_idempotency_key: params.idempotencyKey ?? null,
  });

  if (error) {
    return {
      ok: false,
      code: "RPC_ERROR",
      error: error.message || "Không thể cập nhật Portal đội trưởng.",
    };
  }

  if (data && typeof data === "object" && data.ok === false) {
    return data;
  }

  return data && typeof data === "object"
    ? data
    : { ok: true, captainAccessEnabled: Boolean(params.enabled) };
}

/**
 * Scoped captain portal reader contract (wired in W3 — not live in W1).
 * @param {{ tournamentId: string, schemaVersion?: number }} params
 * @returns {Promise<{ ok: boolean, code?: string, error?: string }>}
 */
export async function getCaptainPortalSetup(params = {}) {
  const tournamentId = String(params.tournamentId || "").trim();
  if (!tournamentId) {
    return { ok: false, code: "VALIDATION_ERROR", error: "Thiếu tournamentId." };
  }

  if (!isCaptainPortalScopedReaderDeployed()) {
    return {
      ok: false,
      code: "CAPTAIN_PORTAL_READER_UNAVAILABLE",
      error: "Scoped reader chưa bật (W3). Tiếp tục dùng get_setup tạm thời.",
    };
  }

  const client = getSupabaseAuthClient();
  if (!client?.rpc) {
    return { ok: false, code: "NOT_CONFIGURED", error: "Supabase chưa sẵn sàng." };
  }

  const { data, error } = await client.rpc(CAPTAIN_PORTAL_GET_RPC, {
    p_tournament_id: tournamentId,
    p_schema_version: params.schemaVersion ?? 7,
  });

  if (error) {
    return {
      ok: false,
      code: "RPC_ERROR",
      error: error.message || "Không thể tải Portal đội trưởng.",
    };
  }

  return data && typeof data === "object" ? data : { ok: false, code: "EMPTY_RESPONSE" };
}
