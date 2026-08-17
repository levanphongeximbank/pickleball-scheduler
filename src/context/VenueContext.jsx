import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { useAuth } from "./AuthContext.jsx";
import { useTenant } from "./TenantContext.jsx";
import {
  commitVenueSwitch,
  listVenuesForTenant,
  resolveActiveVenueId,
} from "../features/venue/services/venueSelectionService.js";
import { ensureTenantVenueLocalBootstrap } from "../features/venue/services/tenantVenueBootstrap.js";
import { loadActiveVenueId } from "../data/venueSession.js";
import { venueBelongsToTenant } from "../core/platform/app/tenantVenueIdentity.js";

const VenueContext = createContext(null);

/**
 * Wave 3 — Physical facility context. Child of Tenant. Parent of Cluster.
 * Must not rewrite Tenant or Club identity.
 */
export function VenueProvider({ children }) {
  const { user } = useAuth();
  const { currentTenantId } = useTenant();
  const userId = user?.id || null;
  const userVenueId = user?.venueId || null;

  const [revision, setRevision] = useState(0);
  const [activeVenueIdState, setActiveVenueIdState] = useState(() =>
    userId ? loadActiveVenueId(userId) : null
  );

  useEffect(() => {
    ensureTenantVenueLocalBootstrap();
    setRevision((value) => value + 1);
  }, [currentTenantId]);

  const venues = useMemo(() => {
    void revision;
    ensureTenantVenueLocalBootstrap();
    return listVenuesForTenant(currentTenantId);
  }, [currentTenantId, revision]);

  const currentVenueId = useMemo(() => {
    void revision;
    void activeVenueIdState;
    return resolveActiveVenueId({
      user: userId ? { id: userId, venueId: userVenueId } : null,
      selectedTenantId: currentTenantId,
      venues,
    });
  }, [userId, userVenueId, currentTenantId, venues, activeVenueIdState, revision]);

  const currentVenue = useMemo(() => {
    if (!currentVenueId) return null;
    return venues.find((row) => row.id === currentVenueId) || null;
  }, [currentVenueId, venues]);

  useEffect(() => {
    // Keep React state aligned when tenant invalidates venue preference.
    const preferred = userId ? loadActiveVenueId(userId) : null;
    if (preferred && currentTenantId && venues.some((v) => v.id === preferred)) {
      setActiveVenueIdState(preferred);
      return;
    }
    if (currentVenueId) {
      setActiveVenueIdState(currentVenueId);
      return;
    }
    setActiveVenueIdState(null);
  }, [currentTenantId, currentVenueId, userId, venues]);

  const switchVenue = useCallback(
    (venueId) => {
      const result = commitVenueSwitch({
        venueId,
        tenantId: currentTenantId,
        user,
        catalog: venues,
      });
      if (result.ok) {
        setActiveVenueIdState(result.venueId);
        setRevision((value) => value + 1);
      }
      return result;
    },
    [currentTenantId, user, venues]
  );

  const refreshVenues = useCallback(() => {
    ensureTenantVenueLocalBootstrap();
    setRevision((value) => value + 1);
  }, []);

  const venueCheck = useMemo(() => {
    if (!currentTenantId) {
      return { ok: true, code: "TENANT_UNRESOLVED" };
    }
    if (!currentVenueId) {
      if (venues.length === 0) {
        return { ok: true, code: "VENUE_EMPTY", empty: true };
      }
      return {
        ok: false,
        error: "Cần chọn cơ sở (Venue) trong tenant đang chọn.",
        code: "VENUE_REQUIRED",
      };
    }
    if (!currentVenue || !venueBelongsToTenant(currentVenue, currentTenantId)) {
      return {
        ok: false,
        error: "Venue không thuộc tenant đang chọn.",
        code: "VENUE_TENANT_MISMATCH",
      };
    }
    return { ok: true };
  }, [currentTenantId, currentVenue, currentVenueId, venues]);

  const value = useMemo(
    () => ({
      currentVenue,
      currentVenueId,
      venues,
      venueCheck,
      switchVenue,
      refreshVenues,
      revision,
    }),
    [currentVenue, currentVenueId, venues, venueCheck, switchVenue, refreshVenues, revision]
  );

  return <VenueContext.Provider value={value}>{children}</VenueContext.Provider>;
}

export function useVenue() {
  const context = useContext(VenueContext);
  if (!context) {
    throw new Error("useVenue must be used within VenueProvider");
  }
  return context;
}

export function useCurrentVenueId() {
  return useVenue().currentVenueId;
}
