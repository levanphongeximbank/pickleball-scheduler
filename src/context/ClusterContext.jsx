import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { useAuth } from "./AuthContext.jsx";
import { useTenant } from "./TenantContext.jsx";
import { useVenue } from "./VenueContext.jsx";
import { isCourtClustersEnabled } from "../features/court-cluster/config/clusterFlags.js";
import { pullClusterContextForUser } from "../features/court-cluster/services/courtClusterCloudSync.js";
import {
  ensureDefaultClusterForVenue,
  isOrgWideClusterRole,
  listAccessibleClustersForUser,
  listClustersForAssignedUser,
  resolveActiveClusterForUser,
  switchActiveCluster,
} from "../features/court-cluster/services/courtClusterService.js";
import { getActiveClusterId, getActiveClusterIdForVenue, setActiveClusterId } from "../data/courtCluster.js";
import { clusterBelongsToVenue } from "../core/platform/app/tenantVenueIdentity.js";

const ClusterContext = createContext(null);

/**
 * Wave 3 — Cluster is scoped by Venue (not Tenant identity, not Club).
 */
export function ClusterProvider({ children }) {
  const { user } = useAuth();
  const { currentTenantId } = useTenant();
  const { currentVenueId } = useVenue();
  const [activeClusterId, setActiveClusterIdState] = useState(() =>
    currentVenueId ? getActiveClusterIdForVenue(currentVenueId) : getActiveClusterId()
  );
  const [revision, setRevision] = useState(0);

  const clusters = useMemo(() => {
    if (!isCourtClustersEnabled()) {
      if (!currentVenueId) {
        return listClustersForAssignedUser(user);
      }
      // LEGACY local-only compatibility: synthesize a default cluster catalog
      // row when the cloud cluster feature is off. Canonical cloud inventory
      // never uses this path.
      const ensured = ensureDefaultClusterForVenue(currentVenueId);
      return ensured.cluster ? [ensured.cluster] : [];
    }

    return listAccessibleClustersForUser(user, currentVenueId);
  }, [currentVenueId, revision, user]);

  const activeCluster = useMemo(() => {
    const found = clusters.find((cluster) => cluster.id === activeClusterId) || null;
    if (!found) return null;
    if (!clusterBelongsToVenue(found, currentVenueId, currentTenantId)) {
      return null;
    }
    return found;
  }, [activeClusterId, clusters, currentTenantId, currentVenueId]);

  const refreshClusters = useCallback(() => {
    setRevision((value) => value + 1);
  }, []);

  const syncClustersFromCloud = useCallback(async () => {
    if (!user?.id || !isCourtClustersEnabled()) {
      return { ok: false, code: "SKIPPED" };
    }

    const result = await pullClusterContextForUser(user);
    if (result.ok) {
      setRevision((value) => value + 1);
    }
    return result;
  }, [user]);

  useEffect(() => {
    if (!user?.id || !isCourtClustersEnabled()) {
      return undefined;
    }

    let cancelled = false;
    const run = async () => {
      const result = await pullClusterContextForUser(user);
      if (!cancelled && result.ok) {
        setRevision((value) => value + 1);
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [user, currentVenueId, currentTenantId]);

  useEffect(() => {
    const assigned = listClustersForAssignedUser(user);
    const shouldBootstrapDefault =
      !isCourtClustersEnabled() &&
      currentVenueId &&
      user?.venueId &&
      assigned.length === 0 &&
      isOrgWideClusterRole(user);

    if (shouldBootstrapDefault) {
      ensureDefaultClusterForVenue(currentVenueId);
    }

    const resolved = resolveActiveClusterForUser(user, currentVenueId);
    if (resolved?.id && resolved.id !== activeClusterId) {
      if (clusterBelongsToVenue(resolved, currentVenueId, currentTenantId)) {
        setActiveClusterIdState(resolved.id);
        setActiveClusterId(resolved.id);
      } else {
        setActiveClusterIdState(null);
        setActiveClusterId(null);
      }
    } else if (!resolved && activeClusterId) {
      setActiveClusterIdState(null);
      setActiveClusterId(null);
    } else if (
      activeClusterId &&
      !clusterBelongsToVenue(
        clusters.find((c) => c.id === activeClusterId),
        currentVenueId,
        currentTenantId
      )
    ) {
      setActiveClusterIdState(null);
      setActiveClusterId(null);
    }
  }, [activeClusterId, clusters, currentTenantId, currentVenueId, revision, user]);

  const switchCluster = useCallback(
    (clusterId) => {
      const cluster = clusters.find((row) => row.id === clusterId) || null;
      const clusterVenueId = cluster?.venueId || currentVenueId;
      if (!currentVenueId || clusterVenueId !== currentVenueId) {
        return {
          ok: false,
          error: "Cluster không thuộc Venue đang chọn.",
          code: "CLUSTER_VENUE_MISMATCH",
        };
      }

      const result = switchActiveCluster(clusterId, {
        user,
        venueId: currentVenueId,
      });

      if (!result.ok) {
        return result;
      }

      setActiveClusterIdState(clusterId);
      setRevision((value) => value + 1);
      return result;
    },
    [clusters, currentVenueId, user]
  );

  const value = useMemo(
    () => ({
      clusters,
      activeCluster,
      activeClusterId: activeCluster?.id || null,
      clustersEnabled: isCourtClustersEnabled(),
      switchCluster,
      refreshClusters,
      syncClustersFromCloud,
      revision,
    }),
    [activeCluster, clusters, refreshClusters, revision, switchCluster, syncClustersFromCloud]
  );

  return <ClusterContext.Provider value={value}>{children}</ClusterContext.Provider>;
}

export function useCluster() {
  const context = useContext(ClusterContext);
  if (!context) {
    throw new Error("useCluster must be used within ClusterProvider");
  }
  return context;
}
