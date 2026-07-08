export const CLUSTER_STATUSES = Object.freeze(["active", "inactive"]);

export const CLUSTER_ASSIGNMENT_ROLES = Object.freeze([
  "CLUSTER_OWNER",
  "CLUSTER_MANAGER",
]);

export function slugifyClusterName(name) {
  return String(name || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

export function buildDefaultClusterId(venueId) {
  const base = String(venueId || "").trim();
  return base ? `${base}-main` : "default-main";
}

export function normalizeCourtCluster(cluster) {
  const venueId = String(cluster?.venueId || cluster?.venue_id || "").trim();
  const id = String(cluster?.id || "").trim();
  const name = String(cluster?.name || "").trim();
  const slug = String(cluster?.slug || slugifyClusterName(name) || id).trim();

  return {
    id,
    venueId,
    name: name || id,
    slug,
    status: CLUSTER_STATUSES.includes(cluster?.status) ? cluster.status : "active",
    courtCount: Number.isFinite(Number(cluster?.courtCount ?? cluster?.court_count))
      ? Number(cluster.courtCount ?? cluster.court_count)
      : 0,
    address: String(cluster?.address || "").trim(),
    googleMapsUrl: String(cluster?.googleMapsUrl || cluster?.google_maps_url || "").trim(),
    ownerUserId: cluster?.ownerUserId || cluster?.owner_user_id || null,
    createdAt: cluster?.createdAt || cluster?.created_at || new Date().toISOString(),
    updatedAt: cluster?.updatedAt || cluster?.updated_at || new Date().toISOString(),
  };
}

export function normalizeClusterAssignment(assignment) {
  return {
    userId: String(assignment?.userId || assignment?.user_id || "").trim(),
    clusterId: String(assignment?.clusterId || assignment?.cluster_id || "").trim(),
    role: CLUSTER_ASSIGNMENT_ROLES.includes(assignment?.role)
      ? assignment.role
      : "CLUSTER_OWNER",
    createdAt: assignment?.createdAt || assignment?.created_at || new Date().toISOString(),
  };
}

export function createCourtClusterRecord({
  id,
  venueId,
  name,
  slug,
  ownerUserId = null,
  address = "",
  googleMapsUrl = "",
}) {
  const normalizedName = String(name || "").trim();
  const clusterId = String(id || `${venueId}-${slugifyClusterName(normalizedName) || "cluster"}`).trim();

  return normalizeCourtCluster({
    id: clusterId,
    venueId,
    name: normalizedName,
    slug: slug || slugifyClusterName(normalizedName),
    ownerUserId,
    address,
    googleMapsUrl,
    courtCount: 0,
    status: "active",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
}
