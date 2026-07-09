import { getCurrentUser, isDevAuthAllowed } from "../../../auth/authService.js";
import { hasSupabaseConfig } from "../../../auth/supabaseClient.js";
import { normalizeClub } from "../../../models/club.js";
import { sanitizeBillingTenantId } from "../../billing/services/billingTenantResolver.js";
import { resolveCloudVenueIdForClusterOps } from "../../court-cluster/utils/clusterCloudResolver.js";
import { isValidProfileUserId } from "../../court-cluster/utils/profileUserId.js";
import { updateClubMeta } from "../../../domain/clubService.js";
import { rpcClubUpsertRegistry } from "./clubRegistryRpcService.js";
import { syncClubRegistryForUser } from "./clubRegistryCloudSync.js";

function clubToRpcPayload(club, cloudVenueId) {
  const normalized = normalizeClub(club);
  const governance = normalized.governance || {};

  return {
    club_id: normalized.id,
    venue_id: cloudVenueId,
    name: normalized.name,
    code: normalized.code || null,
    description: normalized.description || "",
    status: normalized.status || "active",
    owner_user_id: governance.ownerUserId || null,
    president_user_id: governance.presidentUserId || null,
    vice_president_user_id: governance.vicePresidentUserId || null,
    registered_cluster_id: governance.registeredClusterId || null,
    registered_court_ids: governance.registeredCourtIds || [],
  };
}

export async function persistClubToCloud(club, { venueId = null, actor = getCurrentUser() } = {}) {
  if (!club?.id) {
    return { ok: false, code: "CLUB_ID_REQUIRED", error: "Thiếu id CLB." };
  }

  if (!hasSupabaseConfig()) {
    if (!isDevAuthAllowed()) {
      return { ok: false, code: "NO_SUPABASE", error: "Supabase chưa cấu hình." };
    }
    return { ok: true, provider: "local" };
  }

  const presidentUserId = club.governance?.presidentUserId;
  if (!isValidProfileUserId(presidentUserId)) {
    return {
      ok: false,
      code: "PRESIDENT_REQUIRED",
      error: "CLB cần Chủ tịch có UUID hợp lệ trước khi đồng bộ cloud.",
    };
  }

  const cloudVenueId = await resolveCloudVenueIdForClusterOps({
    selectedVenueId: venueId || club.venueId || club.tenantId,
    actor,
    assigneeUserId: presidentUserId,
  });

  if (!cloudVenueId || !sanitizeBillingTenantId(cloudVenueId)) {
    return {
      ok: false,
      code: "VENUE_ID_REQUIRED",
      error: "Không xác định được venue cloud hợp lệ cho CLB.",
    };
  }

  if (cloudVenueId !== club.venueId) {
    updateClubMeta(club.id, { venueId: cloudVenueId, tenantId: cloudVenueId });
  }

  const latestClub = normalizeClub({
    ...club,
    venueId: cloudVenueId,
    tenantId: cloudVenueId,
  });

  const rpcResult = await rpcClubUpsertRegistry({
    club: clubToRpcPayload(latestClub, cloudVenueId),
  });

  if (!rpcResult.ok) {
    if (rpcResult.code === "RPC_NOT_DEPLOYED" && isDevAuthAllowed()) {
      return { ok: true, provider: "local", clubId: club.id };
    }
    return rpcResult;
  }

  if (actor?.id) {
    await syncClubRegistryForUser(actor);
  }

  return { ok: true, clubId: club.id, venueId: cloudVenueId, provider: "rpc" };
}

export async function syncClubsForVenueToCloud({
  clubs = [],
  venueId = null,
  actor = getCurrentUser(),
} = {}) {
  const scoped = (clubs || []).filter((club) => club?.id && !club.isDefault);
  if (scoped.length === 0) {
    return { ok: false, code: "NO_CLUBS", error: "Không có CLB để đồng bộ." };
  }

  if (!hasSupabaseConfig()) {
    if (!isDevAuthAllowed()) {
      return { ok: false, code: "NO_SUPABASE", error: "Supabase chưa cấu hình." };
    }
    return { ok: true, synced: 0, provider: "local" };
  }

  const syncedClubIds = [];
  const skippedClubs = [];

  for (const club of scoped) {
    const result = await persistClubToCloud(club, {
      venueId: venueId || club.venueId || club.tenantId,
      actor,
    });

    if (!result.ok) {
      if (result.code === "PRESIDENT_REQUIRED") {
        skippedClubs.push({ clubId: club.id, name: club.name, error: result.error });
        continue;
      }
      return {
        ...result,
        synced: syncedClubIds.length,
        syncedClubIds,
        skippedClubs,
      };
    }

    syncedClubIds.push(result.clubId || club.id);
  }

  if (actor?.id) {
    await syncClubRegistryForUser(actor);
  }

  return {
    ok: true,
    synced: syncedClubIds.length,
    skipped: skippedClubs.length,
    syncedClubIds,
    skippedClubs,
    provider: "rpc",
  };
}
