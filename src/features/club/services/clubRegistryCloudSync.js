import { loadClubs, saveClubs } from "../../../data/club.js";
import { normalizeClub } from "../../../models/club.js";
import { getCurrentUser, isDevAuthAllowed } from "../../../auth/authService.js";
import { hasSupabaseConfig } from "../../../auth/supabaseClient.js";
import { isGlobalRole, isPlatformScopedRole } from "../../../auth/roles.js";
import { sanitizeBillingTenantId } from "../../billing/services/billingTenantResolver.js";
import { isValidProfileUserId } from "../../court-cluster/utils/profileUserId.js";
import {
  isClubRegistryCloudEnabled,
  isClubStorageV2Enabled,
} from "../config/clubRegistryFlags.js";
import { syncClubsForVenueToCloud } from "./clubRegistryCloudService.js";
import {
  rpcClubListDiscoverable,
  rpcClubListRegistry,
} from "./clubRegistryRpcService.js";
import {
  invalidateAllClubRegistryCache,
  invalidateClubRegistryCache,
} from "../registry/clubRegistryCache.js";

function sameUserId(a, b) {
  return String(a || "").trim() === String(b || "").trim();
}

export function listLocalClubsEligibleForCloudPush(user) {
  if (!user?.id) {
    return [];
  }

  const canPushAll = isGlobalRole(user.role) || isPlatformScopedRole(user.role);

  return loadClubs().filter((club) => {
    if (club.isDefault) {
      return false;
    }
    if (!isValidProfileUserId(club.governance?.presidentUserId)) {
      return false;
    }
    if (canPushAll) {
      return true;
    }
    return sameUserId(club.governance.presidentUserId, user.id);
  });
}

export async function pushPendingLocalClubsToCloud(user = getCurrentUser()) {
  // Phase 42F: không background full registry push.
  if (isClubStorageV2Enabled()) {
    return { ok: true, skipped: true, synced: 0, provider: "v2-no-push" };
  }

  if (!user?.id || !isClubRegistryCloudEnabled()) {
    return { ok: true, skipped: true, synced: 0 };
  }

  const pending = listLocalClubsEligibleForCloudPush(user);
  if (pending.length === 0) {
    return { ok: true, synced: 0, skipped: 0, provider: "none" };
  }

  return syncClubsForVenueToCloud({
    clubs: pending,
    venueId: null,
    actor: user,
  });
}

/**
 * Pull cloud registry + đẩy CLB local (chủ tịch / admin) lên Supabase.
 */
export async function syncClubRegistryForUser(user = getCurrentUser()) {
  if (!user?.id) {
    return { ok: false, code: "NO_USER", error: "Thiếu user." };
  }

  if (isClubStorageV2Enabled()) {
    // Phase 42K — registry read via clubRegistryService; no discover hydrate / local merge.
    return {
      ok: true,
      skipped: true,
      pulled: 0,
      pushed: 0,
      provider: "v2-registry-service",
    };
  }

  if (!isClubRegistryCloudEnabled()) {
    return { ok: true, skipped: true, provider: "disabled" };
  }

  // Pull trước để máy local nhận owner/president mới từ cloud,
  // tránh push bản local cũ (owner null) ghi đè cloud.
  const pullResult = await pullClubRegistryForUser(user);
  const pushResult = await pushPendingLocalClubsToCloud(user);

  const pullFailed =
    !pullResult.ok &&
    pullResult.code !== "RPC_NOT_DEPLOYED" &&
    pullResult.code !== "NO_SUPABASE";
  const pushFailed =
    !pushResult.ok &&
    pushResult.code !== "RPC_NOT_DEPLOYED" &&
    pushResult.code !== "NO_SUPABASE" &&
    pushResult.code !== "NO_CLUBS";

  if (pullFailed) {
    return pullResult;
  }
  if (pushFailed) {
    return pushResult;
  }

  return {
    ok: true,
    pulled: pullResult.count ?? 0,
    pushed: pushResult.synced ?? 0,
    skipped: pushResult.skipped ?? 0,
    provider: "rpc",
  };
}

export function cloudRowToClubRecord(row) {
  if (!row?.club_id) {
    return null;
  }

  const registeredCourtIds = Array.isArray(row.registered_court_ids)
    ? row.registered_court_ids
    : [];

  return normalizeClub({
    id: row.club_id,
    name: row.name || row.club_id,
    code: row.code || null,
    description: row.description || "",
    status: row.status || "active",
    venueId: row.venue_id,
    tenantId: row.venue_id,
    governance: {
      ownerUserId: row.owner_user_id || null,
      presidentUserId: row.president_user_id || null,
      vicePresidentUserId: row.vice_president_user_id || null,
      registeredClusterId: row.registered_cluster_id || null,
      registeredCourtIds,
    },
    updatedAt: row.updated_at || new Date().toISOString(),
  });
}

export function mergeClubsIntoLocal(incomingClubs = []) {
  const byId = new Map(loadClubs().map((club) => [club.id, club]));

  for (const row of incomingClubs || []) {
    const normalized = cloudRowToClubRecord(row);
    if (!normalized?.id || normalized.isDefault) {
      continue;
    }

    const existing = byId.get(normalized.id);
    byId.set(normalized.id, {
      ...existing,
      ...normalized,
      governance: {
        ...existing?.governance,
        ...normalized.governance,
      },
      createdAt: existing?.createdAt || normalized.createdAt,
    });
  }

  saveClubs([...byId.values()]);
}

/**
 * Pull club registry from Supabase into localStorage (single source for list/discover).
 */
export async function pullClubRegistryForUser(user = getCurrentUser()) {
  if (!user?.id) {
    return { ok: false, code: "NO_USER", error: "Thiếu user." };
  }

  if (!isClubRegistryCloudEnabled()) {
    return { ok: false, code: "FEATURE_DISABLED" };
  }

  if (!hasSupabaseConfig()) {
    return { ok: false, code: "NO_SUPABASE" };
  }

  const canListAll =
    isGlobalRole(user.role) || isPlatformScopedRole(user.role);
  const venueId = sanitizeBillingTenantId(
    user.venueId || user.tenantId || null
  );

  const result = canListAll
    ? await rpcClubListRegistry({
        venueId: null,
        includeInactive: true,
      })
    : venueId
      ? await rpcClubListRegistry({ venueId, includeInactive: true })
      : await rpcClubListDiscoverable({ limit: 200 });

  if (!result.ok) {
    if (result.code === "RPC_NOT_DEPLOYED" && isDevAuthAllowed()) {
      return { ok: true, skipped: true, provider: "local" };
    }
    return result;
  }

  mergeClubsIntoLocal(result.clubs || []);

  return {
    ok: true,
    count: (result.clubs || []).length,
    provider: result.provider || "rpc",
  };
}
