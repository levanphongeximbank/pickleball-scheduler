import { hasSupabaseConfig } from "../../../auth/supabaseClient.js";
import { loadVenues, saveVenues } from "../../../data/venue.js";
import { loadCourtClusters } from "../../../data/courtCluster.js";
import { normalizeCourtCluster } from "../../../models/courtCluster.js";
import { normalizeTenant, TENANT_STATUS } from "../../../models/tenant.js";
import { getTenantById } from "../../tenant/services/tenantService.js";
import { hydrateProfileVenueToLocalRegistry } from "../../tenant/services/profileVenueService.js";
import { mergeClustersIntoLocal } from "./courtClusterCloudSync.js";
import { rpcListRegisterableClusters } from "./courtClaimRequestRpcService.js";

function mapRpcClusterRow(row) {
  return {
    ...normalizeCourtCluster(row),
    venueName: row.venue_name || row.venueName || "",
  };
}

function ensureVenueInLocalRegistry(venueId, venueName = "") {
  const id = String(venueId || "").trim();
  if (!id || getTenantById(id)) {
    return { ok: true, tenantId: id };
  }

  const label = String(venueName || id).trim() || id;
  const tenant = normalizeTenant({
    id,
    name: label,
    status: TENANT_STATUS.ACTIVE,
  });
  const venues = loadVenues().filter((item) => item.id !== id);
  saveVenues([...venues, tenant]);
  return { ok: true, tenantId: id, tenant };
}

function listRegisterableClustersLocal({ search = "" } = {}) {
  const term = String(search || "").trim().toLowerCase();
  return loadCourtClusters().filter((cluster) => {
    if (cluster.status !== "active") {
      return false;
    }
    if (!term) {
      return true;
    }
    const venueName = String(cluster.venueName || "").toLowerCase();
    return (
      String(cluster.name || "").toLowerCase().includes(term) ||
      String(cluster.address || "").toLowerCase().includes(term) ||
      String(cluster.venueId || "").toLowerCase().includes(term) ||
      venueName.includes(term)
    );
  });
}

export async function listRegisterableClusters({ search = "", limit = 100 } = {}) {
  if (hasSupabaseConfig()) {
    const rpcResult = await rpcListRegisterableClusters({ search, limit });
    if (rpcResult.ok) {
      return rpcResult;
    }
    if (rpcResult.code !== "RPC_NOT_DEPLOYED") {
      return rpcResult;
    }
  }

  return {
    ok: true,
    clusters: listRegisterableClustersLocal({ search }),
    provider: "local",
  };
}

/**
 * Mirror selected cluster + venue into localStorage so createClub/governance work offline.
 */
export async function cacheRegisterableClusterLocally(cluster) {
  const normalized = mapRpcClusterRow(cluster);
  if (!normalized.id) {
    return { ok: false, code: "CLUSTER_ID_REQUIRED", error: "Thiếu id cụm sân." };
  }

  mergeClustersIntoLocal([normalized]);

  const venueId = String(normalized.venueId || "").trim();
  if (venueId) {
    const hydrateResult = await hydrateProfileVenueToLocalRegistry(venueId);
    if (!hydrateResult.ok) {
      ensureVenueInLocalRegistry(venueId, normalized.venueName);
    }
  }

  return { ok: true, cluster: normalized };
}

export { mapRpcClusterRow, listRegisterableClustersLocal };
