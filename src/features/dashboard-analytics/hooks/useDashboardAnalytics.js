import { useCallback, useEffect, useMemo, useState } from "react";

import {
  REPORTING_PRESENTATION_SOURCE_STATE,
  resolveDashboardPresentationSourceState,
} from "../../reporting-analytics/index.js";
import {
  TIME_RANGE_PRESETS,
  resolveTimeRange,
} from "../constants/timeRangePresets.js";
import { resolveDashboardAccess } from "../services/dashboardScope.js";
import { getDashboardAnalytics } from "../services/dashboardService.js";

/**
 * @param {{
 *   clubId: string,
 *   user: object,
 *   can: Function,
 *   scope: object,
 *   mode?: 'live'|'demo'|'preview',
 * }} args
 */
export function useDashboardAnalytics({ clubId, user, can, scope, mode = "live" }) {
  const userId = user?.id || null;
  const userRole = user?.role || null;
  const scopeClubId = scope?.clubId || null;
  const scopeVenueId = scope?.venueId || null;
  const scopeTenantId = scope?.tenantId || null;
  const resolvedMode = mode === "demo" || mode === "preview" ? mode : "live";

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
      setLoading(false);
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
        mode: resolvedMode,
      });
      setData(payload);
      setError(null);
    } catch (loadError) {
      setError(loadError?.message || "Không tải được dữ liệu dashboard.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [
    access.allowed,
    sectionsKey,
    clubId,
    timeRange.from,
    timeRange.to,
    resolvedMode,
  ]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const sourceState = useMemo(() => {
    if (loading) {
      return resolveDashboardPresentationSourceState({ loading: true });
    }
    if (error) {
      return resolveDashboardPresentationSourceState({
        errorMessage: error,
        liveFailed: true,
      });
    }
    if (data?.sourceState) return data.sourceState;
    return resolveDashboardPresentationSourceState({
      mode: resolvedMode,
      payload: data,
      isEmpty: Boolean(data?.meta?.isEmpty),
    });
  }, [loading, error, data, resolvedMode]);

  const isEmpty =
    !loading &&
    !error &&
    (data?.meta?.isEmpty === true ||
      sourceState?.state === REPORTING_PRESENTATION_SOURCE_STATE.EMPTY);

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
    isEmpty,
    sourceState,
    mode: resolvedMode,
  };
}
