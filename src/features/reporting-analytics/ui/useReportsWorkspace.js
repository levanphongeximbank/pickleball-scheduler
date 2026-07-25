import { useCallback, useEffect, useMemo, useState } from "react";

import {
  REPORTING_PRESENTATION_SOURCE_STATE,
  createReportsWorkspaceController,
  resolveReportingAnalyticsRuntime,
} from "../presentation/index.js";

/**
 * @param {{
 *   actor?: object,
 *   ownerId?: string,
 *   tenantId?: string,
 *   scope?: object,
 *   facade?: object|null,
 * }} options
 */
export function useReportsWorkspace(options = {}) {
  const runtime = useMemo(
    () => resolveReportingAnalyticsRuntime({ facade: options.facade || null }),
    [options.facade]
  );

  const controller = useMemo(
    () =>
      createReportsWorkspaceController({
        facade: runtime.facade,
        actor: options.actor,
        ownerId: options.ownerId,
        tenantId: options.tenantId,
        scope: options.scope,
      }),
    [runtime.facade, options.actor, options.ownerId, options.tenantId, options.scope]
  );

  const [loading, setLoading] = useState(true);
  const [definitions, setDefinitions] = useState({
    items: [],
    sourceState: null,
    error: null,
  });
  const [savedReports, setSavedReports] = useState({
    items: [],
    sourceState: null,
    error: null,
  });
  const [savedFilters, setSavedFilters] = useState({
    items: [],
    sourceState: null,
    error: null,
  });
  const [execution, setExecution] = useState(null);
  const [exportJob, setExportJob] = useState(null);
  const [actionError, setActionError] = useState(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setActionError(null);
    try {
      const [defs, reports, filters] = await Promise.all([
        controller.listReportDefinitions(),
        controller.listSavedReports(),
        controller.listSavedFilters(),
      ]);
      setDefinitions(defs);
      setSavedReports(reports);
      setSavedFilters(filters);
    } finally {
      setLoading(false);
    }
  }, [controller]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const saveReport = useCallback(
    async (input) => {
      setActionError(null);
      const result = await controller.saveSavedReport(input);
      if (!result.ok) {
        setActionError(result.error || "Không lưu được báo cáo");
        return result;
      }
      await refresh();
      return result;
    },
    [controller, refresh]
  );

  const saveFilter = useCallback(
    async (input) => {
      setActionError(null);
      const result = await controller.saveSavedFilter(input);
      if (!result.ok) {
        setActionError(result.error || "Không lưu được bộ lọc");
        return result;
      }
      await refresh();
      return result;
    },
    [controller, refresh]
  );

  const runExecution = useCallback(
    async (request) => {
      setActionError(null);
      setExecution(null);
      const result = await controller.executeReport(request);
      setExecution(result);
      if (!result.ok) {
        setActionError(result.lifecycle?.errorMessage || result.error || "Execution failed");
      }
      return result;
    },
    [controller]
  );

  const runExport = useCallback(
    async (request) => {
      setActionError(null);
      setExportJob(null);
      const result = await controller.exportReport(request);
      setExportJob(result);
      if (!result.ok) {
        setActionError(result.lifecycle?.errorMessage || result.error || "Export failed");
      }
      return result;
    },
    [controller]
  );

  return {
    loading,
    runtime,
    visibility: controller.visibility,
    definitions,
    savedReports,
    savedFilters,
    execution,
    exportJob,
    actionError,
    refresh,
    saveReport,
    saveFilter,
    runExecution,
    runExport,
    sourceState: !runtime.available
      ? {
          state: REPORTING_PRESENTATION_SOURCE_STATE.UNAVAILABLE,
          label: "Nguồn chưa khả dụng",
          reason: runtime.reason,
        }
      : loading
        ? {
            state: REPORTING_PRESENTATION_SOURCE_STATE.LOADING,
            label: "Đang tải",
          }
        : definitions.sourceState,
  };
}
