import { isValidGoogleMapsUrl } from "../utils/clusterMapsUtils.js";
import {
  buildDefaultClusterId,
  createCourtClusterRecord,
  normalizeClusterAssignment,
  normalizeCourtCluster,
  slugifyClusterName,
} from "../../../models/courtCluster.js";
import { ROLES, normalizeRole } from "../../../auth/roles.js";
import { isGlobalRole, isPlatformScopedRole, isVenueScopedRole } from "../../../auth/roles.js";
import { isCourtClustersEnabled } from "../config/clusterFlags.js";
import {
  getActiveClusterId,
  getActiveClusterIdForVenue,
  loadClusterAssignments,
  loadCourtClusters,
  saveClusterAssignments,
  saveCourtClusters,
  setActiveClusterId,
} from "../../../data/courtCluster.js";

function upsertClusterList(cluster) {
  const normalized = normalizeCourtCluster(cluster);
  const clusters = loadCourtClusters().filter((item) => item.id !== normalized.id);
  clusters.push(normalized);
  saveCourtClusters(clusters);
  return normalized;
}

const MANAGED_CLUSTER_PATCH_KEYS = new Set([
  "name",
  "slug",
  "status",
  "address",
  "googleMapsUrl",
  "ownerUserId",
]);

export function canManageCourtClusters(user) {
  if (!user) {
    return false;
  }

  const role = normalizeRole(user.role);
  return (
    role === ROLES.PLATFORM_ADMIN ||
    role === ROLES.SUPER_ADMIN ||
    role === ROLES.SYSTEM_TECHNICIAN ||
    isGlobalRole(user.role) ||
    isPlatformScopedRole(user.role)
  );
}

function assertClusterManageAccess(user) {
  if (!canManageCourtClusters(user)) {
    return { ok: false, error: "Không có quyền quản lý cụm sân" };
  }

  return { ok: true };
}

function assertGoogleMapsUrl(googleMapsUrl) {
  if (!isValidGoogleMapsUrl(googleMapsUrl)) {
    return { ok: false, error: "Link Google Maps không hợp lệ" };
  }

  return { ok: true };
}

export function listClustersForVenue(venueId) {
  if (!venueId) {
    return loadCourtClusters();
  }

  return loadCourtClusters().filter((cluster) => cluster.venueId === venueId);
}

export function getClusterById(clusterId) {
  if (!clusterId) {
    return null;
  }

  return loadCourtClusters().find((cluster) => cluster.id === clusterId) || null;
}

export function getDefaultClusterIdForVenue(venueId) {
  return buildDefaultClusterId(venueId);
}

export function ensureDefaultClusterForVenue(venueId, { name = "Cụm chính", ownerUserId = null } = {}) {
  if (!venueId) {
    return { ok: false, error: "Thiếu venueId" };
  }

  const clusterId = buildDefaultClusterId(venueId);
  const existing = getClusterById(clusterId);
  if (existing) {
    return { ok: true, cluster: existing, created: false };
  }

  const cluster = upsertClusterList(
    createCourtClusterRecord({
      id: clusterId,
      venueId,
      name,
      slug: "main",
      ownerUserId,
    })
  );

  return { ok: true, cluster, created: true };
}

export function createCourtCluster({
  venueId,
  name,
  slug,
  ownerUserId = null,
  address = "",
  googleMapsUrl = "",
  user = null,
}) {
  const access = assertClusterManageAccess(user);
  if (!access.ok) {
    return access;
  }

  if (!venueId || !String(name || "").trim()) {
    return { ok: false, error: "Thiếu venueId hoặc tên cụm sân" };
  }

  const mapsCheck = assertGoogleMapsUrl(googleMapsUrl);
  if (!mapsCheck.ok) {
    return mapsCheck;
  }

  const normalizedSlug = slug || slugifyClusterName(name);
  const existingSlug = listClustersForVenue(venueId).find((item) => item.slug === normalizedSlug);
  if (existingSlug) {
    return { ok: false, error: "Slug cụm sân đã tồn tại trong tổ chức này" };
  }

  const cluster = upsertClusterList(
    createCourtClusterRecord({
      venueId,
      name: String(name).trim(),
      slug: normalizedSlug,
      ownerUserId,
      address: String(address || "").trim(),
      googleMapsUrl: String(googleMapsUrl || "").trim(),
    })
  );

  if (ownerUserId) {
    assignUserToCluster(ownerUserId, cluster.id, { role: "CLUSTER_OWNER", user });
  }

  return { ok: true, cluster };
}

export function updateCourtCluster(clusterId, patch = {}, { user = null } = {}) {
  const cluster = getClusterById(clusterId);
  if (!cluster) {
    return { ok: false, error: "Không tìm thấy cụm sân" };
  }

  const managedKeys = Object.keys(patch).filter((key) => MANAGED_CLUSTER_PATCH_KEYS.has(key));
  if (managedKeys.length > 0) {
    const access = assertClusterManageAccess(user);
    if (!access.ok) {
      return access;
    }
  }

  if (Object.prototype.hasOwnProperty.call(patch, "googleMapsUrl")) {
    const mapsCheck = assertGoogleMapsUrl(patch.googleMapsUrl);
    if (!mapsCheck.ok) {
      return mapsCheck;
    }
  }

  const next = upsertClusterList({
    ...cluster,
    ...patch,
    id: cluster.id,
    venueId: cluster.venueId,
    updatedAt: new Date().toISOString(),
  });

  return { ok: true, cluster: next };
}

export function deleteCourtCluster(clusterId, { user = null } = {}) {
  const access = assertClusterManageAccess(user);
  if (!access.ok) {
    return access;
  }

  const cluster = getClusterById(clusterId);
  if (!cluster) {
    return { ok: false, error: "Không tìm thấy cụm sân" };
  }

  const clusters = loadCourtClusters().filter((item) => item.id !== clusterId);
  saveCourtClusters(clusters);

  const assignments = loadClusterAssignments().filter((item) => item.clusterId !== clusterId);
  saveClusterAssignments(assignments);

  if (getActiveClusterId() === clusterId) {
    setActiveClusterId(null);
  }

  return { ok: true };
}

export function listAssignmentsForUser(userId) {
  if (!userId) {
    return [];
  }

  return loadClusterAssignments().filter((item) => item.userId === userId);
}

export function listAssignmentsForCluster(clusterId) {
  if (!clusterId) {
    return [];
  }

  return loadClusterAssignments().filter((item) => item.clusterId === clusterId);
}

export function assignUserToCluster(userId, clusterId, { role = "CLUSTER_OWNER", user: actor = null } = {}) {
  const access = assertClusterManageAccess(actor);
  if (!access.ok) {
    return access;
  }

  if (!userId || !clusterId) {
    return { ok: false, error: "Thiếu userId hoặc clusterId" };
  }

  const cluster = getClusterById(clusterId);
  if (!cluster) {
    return { ok: false, error: "Không tìm thấy cụm sân" };
  }

  const assignment = normalizeClusterAssignment({ userId, clusterId, role });
  const assignments = loadClusterAssignments().filter(
    (item) => !(item.userId === userId && item.clusterId === clusterId)
  );
  assignments.push(assignment);
  saveClusterAssignments(assignments);

  return { ok: true, assignment };
}

export function unassignUserFromCluster(userId, clusterId, { user: actor = null } = {}) {
  const access = assertClusterManageAccess(actor);
  if (!access.ok) {
    return access;
  }

  const assignments = loadClusterAssignments().filter(
    (item) => !(item.userId === userId && item.clusterId === clusterId)
  );
  saveClusterAssignments(assignments);
  return { ok: true };
}

export function setUserClusterAssignments(userId, clusterIds = [], { role = "CLUSTER_OWNER", user: actor = null } = {}) {
  const access = assertClusterManageAccess(actor);
  if (!access.ok) {
    return access;
  }

  if (!userId) {
    return { ok: false, error: "Thiếu userId" };
  }

  const ids = new Set((clusterIds || []).map((id) => String(id).trim()).filter(Boolean));
  const kept = loadClusterAssignments().filter((item) => item.userId !== userId);
  const next = [
    ...kept,
    ...[...ids].map((clusterId) => normalizeClusterAssignment({ userId, clusterId, role })),
  ];
  saveClusterAssignments(next);
  return { ok: true, assignments: next.filter((item) => item.userId === userId) };
}

export function resolveAssignedClusterIdsForUser(user) {
  if (!user?.id) {
    return [];
  }

  if (Array.isArray(user.assignedClusterIds) && user.assignedClusterIds.length > 0) {
    return user.assignedClusterIds;
  }

  return listAssignmentsForUser(user.id).map((item) => item.clusterId);
}

export function isOrgWideClusterRole(user) {
  const role = normalizeRole(user?.role);
  return role === ROLES.TENANT_OWNER || role === ROLES.VENUE_MANAGER;
}

export function isVenueWideClusterManagerRole(user) {
  return normalizeRole(user?.role) === ROLES.VENUE_MANAGER;
}

export function isClusterUnassigned(clusterId) {
  if (!clusterId) {
    return false;
  }
  const cluster = getClusterById(clusterId);
  if (!cluster || cluster.status !== "active") {
    return false;
  }
  if (cluster.ownerUserId) {
    return false;
  }
  return !listAssignmentsForCluster(clusterId).some((item) => item.role === "CLUSTER_OWNER");
}

export function listUnassignedClusters({ search = "" } = {}) {
  const term = String(search || "").trim().toLowerCase();
  return loadCourtClusters().filter((cluster) => {
    if (!isClusterUnassigned(cluster.id)) {
      return false;
    }
    if (!term) {
      return true;
    }
    return (
      cluster.name.toLowerCase().includes(term) ||
      cluster.address.toLowerCase().includes(term) ||
      cluster.venueId.toLowerCase().includes(term)
    );
  });
}

export function listClustersForAssignedUser(user) {
  const assignedIds = new Set(resolveAssignedClusterIdsForUser(user));
  if (assignedIds.size === 0) {
    return [];
  }
  return loadCourtClusters().filter((cluster) => assignedIds.has(cluster.id));
}

export function listAccessibleClustersForUser(user, venueId) {
  if (!isCourtClustersEnabled()) {
    if (!venueId) {
      const assigned = listClustersForAssignedUser(user);
      if (assigned.length > 0) {
        return assigned;
      }
      return [];
    }

    const ensured = ensureDefaultClusterForVenue(venueId);
    return ensured.cluster ? [ensured.cluster] : [];
  }

  const assignedClusters = listClustersForAssignedUser(user);
  if (assignedClusters.length > 0) {
    if (!venueId) {
      return assignedClusters;
    }
    return assignedClusters.filter((cluster) => cluster.venueId === venueId);
  }

  if (!venueId) {
    return [];
  }

  const venueClusters = listClustersForVenue(venueId);
  if (!user) {
    return venueClusters;
  }

  if (isGlobalRole(user.role)) {
    return venueClusters;
  }

  if (isVenueWideClusterManagerRole(user) && user.venueId === venueId) {
    return venueClusters;
  }

  return [];
}

export function canUserAccessCluster(user, clusterId, options = {}) {
  const cluster = getClusterById(clusterId);
  if (!cluster) {
    return false;
  }

  if (!isCourtClustersEnabled()) {
    if (!user?.venueId) {
      return false;
    }
    return user.venueId === cluster.venueId;
  }

  if (!user) {
    return true;
  }

  if (isGlobalRole(user.role)) {
    return true;
  }

  const assignedIds = resolveAssignedClusterIdsForUser(user);
  if (assignedIds.length > 0) {
    return assignedIds.includes(clusterId);
  }

  if (user.venueId && user.venueId !== cluster.venueId) {
    return false;
  }

  if (isVenueWideClusterManagerRole(user) && user.venueId === cluster.venueId) {
    return true;
  }

  return false;
}

export function switchActiveCluster(clusterId, { user = null, venueId = null } = {}) {
  const cluster = getClusterById(clusterId);
  if (!cluster) {
    return { ok: false, error: "Không tìm thấy cụm sân" };
  }

  if (user && !canUserAccessCluster(user, clusterId, { venueId: venueId || user.venueId })) {
    return { ok: false, error: "Không có quyền truy cập cụm sân này", code: "FORBIDDEN" };
  }

  if (venueId && cluster.venueId !== venueId) {
    return { ok: false, error: "Cụm sân không thuộc tổ chức hiện tại", code: "TENANT_FORBIDDEN" };
  }

  setActiveClusterId(clusterId);
  return { ok: true, cluster };
}

export function resolveActiveClusterForUser(user, venueId) {
  const accessible = listAccessibleClustersForUser(user, venueId);
  if (accessible.length === 0) {
    return null;
  }

  const storedId = venueId
    ? getActiveClusterIdForVenue(venueId)
    : getActiveClusterId();
  if (storedId && accessible.some((cluster) => cluster.id === storedId)) {
    return getClusterById(storedId);
  }

  return accessible[0];
}

export function syncClusterCourtCount(clusterId, courtCount) {
  const cluster = getClusterById(clusterId);
  if (!cluster) {
    return { ok: false };
  }

  return updateCourtCluster(clusterId, {
    courtCount: Number.isFinite(Number(courtCount)) ? Number(courtCount) : 0,
  });
}

export function stampCourtWithCluster(court, clusterId) {
  if (!court || !clusterId) {
    return court;
  }

  return {
    ...court,
    clusterId,
  };
}

export function filterCourtsByCluster(courts = [], clusterId) {
  if (!isCourtClustersEnabled() || !clusterId) {
    return courts;
  }

  return courts.filter((court) => court.clusterId === clusterId);
}

export function ensureCourtsHaveClusterId(courts = [], venueId) {
  if (!isCourtClustersEnabled() || !venueId) {
    return courts;
  }

  const defaultClusterId = buildDefaultClusterId(venueId);
  ensureDefaultClusterForVenue(venueId);

  return courts.map((court) =>
    court?.clusterId ? court : stampCourtWithCluster(court, defaultClusterId)
  );
}
