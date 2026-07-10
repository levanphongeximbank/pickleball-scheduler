/**
 * Phase 42K — Cloud registry read model (tenant + platform). Discover stays separate.
 */
import { isGlobalRole, isPlatformScopedRole } from "../../../auth/roles.js";
import { isClubStorageV2Enabled } from "../config/clubRegistryFlags.js";
import {
  CLUB_REGISTRY_SCOPE,
  buildClubRegistryCacheKey,
  cancelClubRegistryInflight,
  clearClubRegistryInflight,
  readClubRegistryCache,
  registerClubRegistryInflight,
  writeClubRegistryCache,
} from "../registry/clubRegistryCache.js";
import { rpcV2ClubListRegistry } from "./clubStorageV2RpcService.js";

export function normalizeRegistryRow(row) {
  if (!row?.id) {
    return null;
  }
  return {
    id: row.id,
    tenantId: row.tenantId || row.tenant_id || null,
    name: row.name || row.id,
    code: row.code || row.slug || null,
    status: row.status || "active",
    memberCount: row.activeMemberCount ?? row.active_member_count ?? row.memberCount ?? 0,
    ownerName: row.ownerLabel || row.owner_label || row.ownerName || null,
    presidentName: row.presidentLabel || row.president_label || row.presidentName || null,
    pendingRequestCount: row.pendingRequestCount ?? row.pending_request_count ?? null,
    createdAt: row.createdAt || row.created_at || null,
    updatedAt: row.updatedAt || row.updated_at || null,
    version: row.version ?? null,
    _raw: row,
  };
}

export function filterRegistryRows(rows, filters = {}) {
  let list = [...(rows || [])];
  const search = String(filters.search || "").trim().toLowerCase();
  const status = String(filters.status || "all");
  const tenantFilter = String(filters.tenantFilter || "").trim();

  if (tenantFilter) {
    list = list.filter((r) => String(r.tenantId || "") === tenantFilter);
  }

  if (status !== "all") {
    list = list.filter((r) => String(r.status || "") === status);
  }

  if (search) {
    list = list.filter((r) => {
      const name = String(r.name || "").toLowerCase();
      const code = String(r.code || "").toLowerCase();
      return name.includes(search) || code.includes(search);
    });
  }

  const ownerQ = String(filters.ownerSearch || "").trim().toLowerCase();
  if (ownerQ) {
    list = list.filter((r) => {
      const o = String(r.ownerName || "").toLowerCase();
      const p = String(r.presidentName || "").toLowerCase();
      return o.includes(ownerQ) || p.includes(ownerQ);
    });
  }

  return list;
}

export function assertTenantRegistryAccess(user, tenantId) {
  if (!user?.id) {
    return { ok: false, code: "NOT_AUTHENTICATED", error: "Chưa đăng nhập." };
  }
  const tid = String(tenantId || "").trim();
  if (!tid) {
    return { ok: false, code: "TENANT_REQUIRED", error: "Chọn tenant trước khi xem sổ đăng ký CLB." };
  }
  const platform = isGlobalRole(user.role) || isPlatformScopedRole(user.role);
  if (platform) {
    return { ok: true, platform: true };
  }
  const userTenant = String(user.tenantId || user.venueId || "").trim();
  if (userTenant && userTenant !== tid) {
    return { ok: false, code: "TENANT_FORBIDDEN", error: "Không có quyền xem CLB tenant khác." };
  }
  return { ok: true, platform: false };
}

export function assertPlatformRegistryAccess(user) {
  if (!user?.id) {
    return { ok: false, code: "NOT_AUTHENTICATED", error: "Chưa đăng nhập." };
  }
  if (!isGlobalRole(user.role) && !isPlatformScopedRole(user.role)) {
    return { ok: false, code: "FORBIDDEN", error: "Chỉ Platform Admin / Super Admin." };
  }
  return { ok: true };
}

async function fetchRegistryRpc({ tenantId, includeInactive, signal }) {
  if (signal?.aborted) {
    return { ok: false, code: "ABORTED", error: "Đã hủy." };
  }
  const result = await rpcV2ClubListRegistry({
    tenantId: tenantId || null,
    includeInactive: Boolean(includeInactive),
  });
  if (!result.ok) {
    return result;
  }
  const clubs = (result.clubs || []).map(normalizeRegistryRow).filter(Boolean);
  return { ok: true, clubs };
}

/**
 * Tenant-scoped registry for /manage/clubs.
 */
export async function fetchTenantClubRegistry({
  user,
  tenantId,
  filters = {},
  signal = null,
  force = false,
} = {}) {
  if (!isClubStorageV2Enabled()) {
    return { ok: false, code: "V2_DISABLED", error: "VITE_CLUB_STORAGE_V2 chưa bật." };
  }
  const access = assertTenantRegistryAccess(user, tenantId);
  if (!access.ok) {
    return access;
  }

  const cacheKey = buildClubRegistryCacheKey(CLUB_REGISTRY_SCOPE.TENANT, tenantId, filters);
  if (!force) {
    const cached = readClubRegistryCache(cacheKey);
    if (cached) {
      return { ok: true, clubs: cached.clubs, cacheKey, fromCache: true };
    }
  } else {
    cancelClubRegistryInflight(cacheKey);
  }

  const controller = new AbortController();
  if (signal) {
    signal.addEventListener("abort", () => controller.abort(), { once: true });
  }
  registerClubRegistryInflight(cacheKey, controller);

  const includeInactive =
    filters.includeInactive ?? (filters.status === "all" || Boolean(filters.showInactive));
  const rpcResult = await fetchRegistryRpc({
    tenantId,
    includeInactive,
    signal: controller.signal,
  });

  clearClubRegistryInflight(cacheKey);

  if (!rpcResult.ok) {
    return rpcResult;
  }

  const filtered = filterRegistryRows(rpcResult.clubs, filters);
  writeClubRegistryCache(cacheKey, filtered);
  return { ok: true, clubs: filtered, cacheKey, fromCache: false };
}

/**
 * Platform cross-tenant registry for /platform/clubs.
 */
export async function fetchPlatformClubRegistry({
  user,
  filters = {},
  signal = null,
  force = false,
} = {}) {
  if (!isClubStorageV2Enabled()) {
    return { ok: false, code: "V2_DISABLED", error: "VITE_CLUB_STORAGE_V2 chưa bật." };
  }
  const access = assertPlatformRegistryAccess(user);
  if (!access.ok) {
    return access;
  }

  const cacheKey = buildClubRegistryCacheKey(CLUB_REGISTRY_SCOPE.PLATFORM, null, filters);
  if (!force) {
    const cached = readClubRegistryCache(cacheKey);
    if (cached) {
      return { ok: true, clubs: cached.clubs, cacheKey, fromCache: true };
    }
  } else {
    cancelClubRegistryInflight(cacheKey);
  }

  const controller = new AbortController();
  if (signal) {
    signal.addEventListener("abort", () => controller.abort(), { once: true });
  }
  registerClubRegistryInflight(cacheKey, controller);

  const includeInactive = filters.includeInactive ?? filters.status === "all";
  const rpcResult = await fetchRegistryRpc({
    tenantId: filters.tenantFilter || null,
    includeInactive,
    signal: controller.signal,
  });

  clearClubRegistryInflight(cacheKey);

  if (!rpcResult.ok) {
    return rpcResult;
  }

  const filtered = filterRegistryRows(rpcResult.clubs, filters);
  writeClubRegistryCache(cacheKey, filtered);
  return { ok: true, clubs: filtered, cacheKey, fromCache: false };
}

export function paginateRegistryRows(rows, { page = 1, pageSize = 25 } = {}) {
  const size = Math.max(1, Math.min(100, Number(pageSize) || 25));
  const p = Math.max(1, Number(page) || 1);
  const start = (p - 1) * size;
  return {
    rows: rows.slice(start, start + size),
    page: p,
    pageSize: size,
    total: rows.length,
    totalPages: Math.max(1, Math.ceil(rows.length / size)),
  };
}
