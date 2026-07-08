import { getSupabaseAuthClient } from "../../../auth/supabaseClient.js";
import { rebuildLeaderboardFromLedger } from "./vprLeaderboardService.js";
import {
  appendLedgerEntries,
  listCertifications,
  upsertCertification,
} from "../storage/vprLocalStore.js";

let testRpcClientOverride = null;

export function __setVprRpcClientForTests(client) {
  testRpcClientOverride = client;
}

export function __resetVprRpcClientForTests() {
  testRpcClientOverride = null;
}

function resolveRpcClient() {
  return testRpcClientOverride || getSupabaseAuthClient();
}

function parseRpcJson(data) {
  if (!data) {
    return { ok: false, code: "EMPTY_RESPONSE", error: "RPC trả về rỗng." };
  }
  if (typeof data === "object" && "ok" in data) {
    return data;
  }
  return { ok: true, ...data };
}

export function isVprRpcNotFoundError(error) {
  const message = String(error?.message || error?.code || "").toLowerCase();
  return (
    message.includes("could not find the function") ||
    (message.includes("function") && message.includes("does not exist")) ||
    error?.code === "PGRST202"
  );
}

async function callVprRpc(rpcName, args = {}) {
  const client = resolveRpcClient();
  if (!client) {
    return { ok: false, code: "NO_SUPABASE", error: "Supabase chưa sẵn sàng." };
  }

  const { data, error } = await client.rpc(rpcName, args);
  if (error) {
    if (isVprRpcNotFoundError(error)) {
      return { ok: false, code: "RPC_NOT_DEPLOYED", error: error.message };
    }
    return { ok: false, code: "RPC_FAILED", error: error.message };
  }

  return parseRpcJson(data);
}

export async function rpcVprSyncCertification(row) {
  return callVprRpc("vpr_sync_certification", { p_row: row });
}

export async function rpcVprListPendingCertifications() {
  return callVprRpc("vpr_list_pending_certifications", {});
}

export async function rpcVprApproveCertification(certId, payload) {
  return callVprRpc("vpr_approve_certification", {
    p_cert_id: certId,
    p_notes: payload.notes || "",
  });
}

export async function rpcVprRejectCertification(certId, payload) {
  return callVprRpc("vpr_reject_certification", {
    p_cert_id: certId,
    p_reason: payload.reason || "",
  });
}

export async function rpcVprToggleRanking(certId, enabled) {
  return callVprRpc("vpr_toggle_ranking", {
    p_cert_id: certId,
    p_enabled: enabled === true,
  });
}

export async function rpcVprListPublicLeaderboard(filters) {
  return callVprRpc("vpr_list_public_leaderboard", {
    p_category: filters.category || null,
    p_region: filters.region || null,
    p_gender: filters.gender || null,
    p_year: filters.year || null,
    p_search: filters.search || "",
  });
}

export async function rpcVprAwardTournament({ clubId, tournamentId, tournamentSnapshot }) {
  const result = await callVprRpc("vpr_award_tournament", {
    p_club_id: clubId,
    p_tournament_id: String(tournamentId),
    p_snapshot: tournamentSnapshot,
  });
  if (result.ok && Array.isArray(result.entries)) {
    appendLedgerEntries(result.entries);
    rebuildLeaderboardFromLedger();
  }
  return result;
}

export async function rpcVprRecalculateTournament({ clubId, tournamentId }) {
  return callVprRpc("vpr_recalculate_tournament", {
    p_club_id: clubId,
    p_tournament_id: String(tournamentId),
  });
}

export async function rpcVprListLedger(filters = {}) {
  return callVprRpc("vpr_list_ledger", {
    p_category: filters.category || null,
    p_tournament_id: filters.tournamentId || null,
    p_club_id: filters.clubId || null,
  });
}

/** Dev fallback when RPC returns certifications — hydrate local store. */
export function hydrateCertificationsFromRpc(items = []) {
  items.forEach((row) => upsertCertification(row));
  return listCertifications();
}
