import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { useAuth } from "./AuthContext.jsx";
import { useTenant } from "./TenantContext.jsx";
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

const ClusterContext = createContext(null);

export function ClusterProvider({ children }) {
  const { user } = useAuth();
  const { currentTenantId } = useTenant();
  const [activeClusterId, setActiveClusterIdState] = useState(() =>
    currentTenantId ? getActiveClusterIdForVenue(currentTenantId) : getActiveClusterId()
  );
  const [revision, setRevision] = useState(0);

  const clusters = useMemo(() => {
    if (!isCourtClustersEnabled()) {
      if (!currentTenantId) {
        return listClustersForAssignedUser(user);
      }
      const ensured = ensureDefaultClusterForVenue(currentTenantId);
      return ensured.cluster ? [ensured.cluster] : [];
    }

    return listAccessibleClustersForUser(user, currentTenantId);
  }, [currentTenantId, revision, user]);

  const activeCluster = useMemo(
    () => clusters.find((cluster) => cluster.id === activeClusterId) || clusters[0] || null,
    [activeClusterId, clusters]
  );

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
  }, [user, currentTenantId]);

  useEffect(() => {
    const assigned = listClustersForAssignedUser(user);
    const shouldBootstrapDefault =
      !isCourtClustersEnabled() &&
      currentTenantId &&
      user?.venueId &&
      assigned.length === 0 &&
      isOrgWideClusterRole(user);

    if (shouldBootstrapDefault) {
      ensureDefaultClusterForVenue(currentTenantId);
    }

    const resolved = resolveActiveClusterForUser(user, currentTenantId);
    if (resolved?.id && resolved.id !== activeClusterId) {
      setActiveClusterIdState(resolved.id);
      setActiveClusterId(resolved.id);
    } else if (!resolved && activeClusterId) {
      setActiveClusterIdState(null);
      setActiveClusterId(null);
    }
  }, [activeClusterId, currentTenantId, revision, user]);

  const switchCluster = useCallback(
    (clusterId) => {
      const clusterVenueId =
        clusters.find((cluster) => cluster.id === clusterId)?.venueId || currentTenantId;
      const result = switchActiveCluster(clusterId, {
        user,
        venueId: clusterVenueId,
      });

      if (!result.ok) {
        return result;
      }

      setActiveClusterIdState(clusterId);
      setRevision((value) => value + 1);
      return result;
    },
    [clusters, currentTenantId, user]
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
