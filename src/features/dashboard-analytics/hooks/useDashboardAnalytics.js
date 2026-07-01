import { useCallback, useEffect, useMemo, useState } from "react";

import {
  TIME_RANGE_PRESETS,
  resolveTimeRange,
} from "../constants/timeRangePresets.js";
import { resolveDashboardAccess } from "../services/dashboardScope.js";
import { getDashboardAnalytics } from "../services/dashboardService.js";

export function useDashboardAnalytics({ clubId, user, can, scope }) {
  const userId = user?.id || null;
  const userRole = user?.role || null;
  const scopeClubId = scope?.clubId || null;
  const scopeVenueId = scope?.venueId || null;
  const scopeTenantId = scope?.tenantId || null;

  const access = useMemo(
    () =>
      resolveDashboardAccess(user, can, {
        clubId: scopeClubId,
        venueId: scopeVenueId,
        tenantId: scopeTenantId,
      }),
    [user, userId, userRole, can, scopeClubId, scopeVenueId, scopeTenantId]
  );

  const sectionsKey = useMemo(
    () => JSON.stringify(access.sections),
    [access.sections]
  );

  const [preset, setPreset] = useState(TIME_RANGE_PRESETS.LAST_30_DAYS);
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);

  const timeRange = useMemo(
    () => resolveTimeRange(preset, customFrom, customTo),
    [preset, customFrom, customTo]
  );

  const loadData = useCallback(() => {
    if (!access.allowed || !clubId) {
      setLoading((current) => (current ? false : current));
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const payload = getDashboardAnalytics({
        clubId,
        from: timeRange.from,
        to: timeRange.to,
        sections: access.sections,
      });
      setData(payload);
    } catch (loadError) {
      setError(loadError?.message || "Không tải được dữ liệu dashboard.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [access.allowed, sectionsKey, clubId, timeRange.from, timeRange.to]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  return {
    access,
    preset,
    setPreset,
    customFrom,
    setCustomFrom,
    customTo,
    setCustomTo,
    timeRange,
    loading,
    error,
    data,
    reload: loadData,
    isEmpty: !loading && !error && data && data.topPlayers?.length === 0 && data.topCourts?.length === 0,
  };
}
