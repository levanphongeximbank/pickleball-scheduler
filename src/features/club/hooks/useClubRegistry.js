import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useAuth } from "../../../context/AuthContext.jsx";
import { CLUB_REGISTRY_SCOPE, invalidateClubRegistryCache } from "../registry/clubRegistryCache.js";
import {
  fetchPlatformClubRegistry,
  fetchTenantClubRegistry,
} from "../services/clubRegistryService.js";

/**
 * Phase 42K — Registry read hook.
 * Cache key shape: ['club-registry', scope, tenantId, filters]
 */
export function useClubRegistry({
  scope = CLUB_REGISTRY_SCOPE.TENANT,
  tenantId = null,
  filters = {},
  enabled = true,
} = {}) {
  const { user } = useAuth();
  const [clubs, setClubs] = useState([]);
  const [loading, setLoading] = useState(Boolean(enabled));
  const [error, setError] = useState(null);
  const [fromCache, setFromCache] = useState(false);
  const genRef = useRef(0);
  const abortRef = useRef(null);

  const cacheKeyLabel = useMemo(
    () => ["club-registry", scope, tenantId || null, filters],
    [scope, tenantId, filters]
  );

  const load = useCallback(
    async ({ force = false } = {}) => {
      if (!enabled || !user?.id) {
        setClubs([]);
        setLoading(false);
        return;
      }

      if (abortRef.current) {
        abortRef.current.abort();
      }
      const controller = new AbortController();
      abortRef.current = controller;

      const gen = genRef.current + 1;
      genRef.current = gen;
      setLoading(true);
      setError(null);

      const fetcher =
        scope === CLUB_REGISTRY_SCOPE.PLATFORM ? fetchPlatformClubRegistry : fetchTenantClubRegistry;

      const args =
        scope === CLUB_REGISTRY_SCOPE.PLATFORM
          ? { user, filters, signal: controller.signal, force }
          : { user, tenantId, filters, signal: controller.signal, force };

      const result = await fetcher(args);

      if (genRef.current !== gen) {
        return;
      }

      if (!result.ok) {
        setError(result.error || result.code || "REGISTRY_FETCH_FAILED");
        setClubs([]);
        setLoading(false);
        return;
      }

      setClubs(result.clubs || []);
      setFromCache(Boolean(result.fromCache));
      setLoading(false);
    },
    [enabled, filters, scope, tenantId, user]
  );

  useEffect(() => {
    void load({ force: false });
    return () => {
      if (abortRef.current) {
        abortRef.current.abort();
      }
    };
  }, [load]);

  const reload = useCallback(() => load({ force: true }), [load]);

  const invalidate = useCallback(() => {
    invalidateClubRegistryCache({
      tenantId: scope === CLUB_REGISTRY_SCOPE.TENANT ? tenantId : filters.tenantFilter || null,
      scope,
    });
    return reload();
  }, [filters.tenantFilter, reload, scope, tenantId]);

  return {
    clubs,
    loading,
    error,
    fromCache,
    cacheKey: cacheKeyLabel,
    reload,
    invalidate,
  };
}
