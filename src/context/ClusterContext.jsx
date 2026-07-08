import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { useAuth } from "./AuthContext.jsx";
import { useTenant } from "./TenantContext.jsx";
import { isCourtClustersEnabled } from "../features/court-cluster/config/clusterFlags.js";
import {
  ensureDefaultClusterForVenue,
  listAccessibleClustersForUser,
  resolveActiveClusterForUser,
  switchActiveCluster,
} from "../features/court-cluster/services/courtClusterService.js";
import { getActiveClusterIdForVenue, setActiveClusterId } from "../data/courtCluster.js";

const ClusterContext = createContext(null);

export function ClusterProvider({ children }) {
  const { user } = useAuth();
  const { currentTenantId } = useTenant();
  const [activeClusterId, setActiveClusterIdState] = useState(() =>
    getActiveClusterIdForVenue(currentTenantId)
  );
  const [revision, setRevision] = useState(0);

  const clusters = useMemo(() => {
    if (!isCourtClustersEnabled()) {
      if (!currentTenantId) {
        return [];
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

  useEffect(() => {
    if (!currentTenantId) {
      return;
    }

    ensureDefaultClusterForVenue(currentTenantId, {
      ownerUserId: user?.id || null,
    });

    const resolved = resolveActiveClusterForUser(user, currentTenantId);
    if (resolved?.id && resolved.id !== activeClusterId) {
      setActiveClusterIdState(resolved.id);
      setActiveClusterId(resolved.id);
    } else if (!resolved && activeClusterId) {
      setActiveClusterIdState(null);
      setActiveClusterId(null);
    }
  }, [activeClusterId, currentTenantId, user]);

  const switchCluster = useCallback(
    (clusterId) => {
      const result = switchActiveCluster(clusterId, {
        user,
        venueId: currentTenantId,
      });

      if (!result.ok) {
        return result;
      }

      setActiveClusterIdState(clusterId);
      setRevision((value) => value + 1);
      return result;
    },
    [currentTenantId, user]
  );

  const refreshClusters = useCallback(() => {
    setRevision((value) => value + 1);
  }, []);

  const value = useMemo(
    () => ({
      clusters,
      activeCluster,
      activeClusterId: activeCluster?.id || null,
      clustersEnabled: isCourtClustersEnabled(),
      switchCluster,
      refreshClusters,
      revision,
    }),
    [activeCluster, clusters, refreshClusters, revision, switchCluster]
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
