/**
 * Reports workspace controller — pure async orchestration over Reporting facade.
 * No browser durable storage. No service_role. No fake artifact URLs.
 */

import { REPORTING_PERMISSIONS } from "../constants/permissions.js";
import {
  REPORTING_PRESENTATION_SOURCE_STATE,
  createReportingPresentationSourceState,
  mapAvailabilityToPresentationSourceState,
} from "./sourceState.js";
import {
  createUnavailableReportingRuntime,
  resolveReportingAnalyticsRuntime,
} from "./runtime.js";
import {
  createExecutionLifecycleViewModel,
  createExportLifecycleViewModel,
  isValidExportOutputReference,
} from "./lifecycleViewModel.js";
import { resolveReportingPermissionVisibility } from "./permissionVisibility.js";

/**
 * @param {{
 *   facade?: object|null,
 *   actor?: object,
 *   ownerId?: string,
 *   tenantId?: string,
 *   scope?: object,
 * }} deps
 */
export function createReportsWorkspaceController(deps = {}) {
  const runtime = resolveReportingAnalyticsRuntime({ facade: deps.facade || null });
  const visibility = resolveReportingPermissionVisibility(
    deps.actor || deps.actorPermissions || []
  );

  function unavailableResult(reason) {
    return {
      ok: false,
      sourceState: createReportingPresentationSourceState({
        state: REPORTING_PRESENTATION_SOURCE_STATE.UNAVAILABLE,
        reason: reason || runtime.reason || "REPORTING_RUNTIME_NOT_INJECTED",
      }),
      items: [],
      error: reason || runtime.reason || "REPORTING_RUNTIME_NOT_INJECTED",
    };
  }

  function forbiddenResult(permission) {
    return {
      ok: false,
      sourceState: createReportingPresentationSourceState({
        state: REPORTING_PRESENTATION_SOURCE_STATE.ERROR,
        reason: `authorization_denied:${permission}`,
        liveFailed: false,
      }),
      items: [],
      error: `Missing permission ${permission}`,
      forbidden: true,
    };
  }

  return {
    runtime,
    visibility,
    permissions: REPORTING_PERMISSIONS,

    async listReportDefinitions() {
      if (!runtime.available || !runtime.facade) {
        return unavailableResult();
      }
      if (!visibility.canViewDashboard && !visibility.canExecuteReport) {
        return forbiddenResult(REPORTING_PERMISSIONS.DASHBOARD_VIEW);
      }
      const result = await runtime.facade.listReportDefinitions(deps.tenantId);
      if (!result.ok) {
        return {
          ok: false,
          sourceState: createReportingPresentationSourceState({
            state: REPORTING_PRESENTATION_SOURCE_STATE.ERROR,
            reason: result.error?.code || "list_definitions_failed",
            liveFailed: true,
          }),
          items: [],
          error: result.error?.message || "Không tải được danh sách báo cáo",
        };
      }
      const items = Array.isArray(result.value) ? result.value : [];
      if (items.length === 0) {
        return {
          ok: true,
          sourceState: createReportingPresentationSourceState({
            state: REPORTING_PRESENTATION_SOURCE_STATE.EMPTY,
            reason: "no_report_definitions",
          }),
          items: [],
        };
      }
      return {
        ok: true,
        sourceState: createReportingPresentationSourceState({
          state: REPORTING_PRESENTATION_SOURCE_STATE.LIVE,
        }),
        items,
      };
    },

    async listSavedReports() {
      if (!runtime.available || !runtime.facade) {
        return unavailableResult();
      }
      if (!visibility.canViewDashboard && !visibility.canSaveReport) {
        return forbiddenResult(REPORTING_PERMISSIONS.REPORT_SAVE);
      }
      const result = await runtime.facade.listSavedReports(
        deps.ownerId,
        deps.tenantId
      );
      if (!result.ok) {
        return {
          ok: false,
          sourceState: createReportingPresentationSourceState({
            state: REPORTING_PRESENTATION_SOURCE_STATE.ERROR,
            reason: result.error?.code || "list_saved_reports_failed",
            liveFailed: true,
          }),
          items: [],
          error: result.error?.message || "Không tải được báo cáo đã lưu",
        };
      }
      const items = Array.isArray(result.value) ? result.value : [];
      return {
        ok: true,
        sourceState: createReportingPresentationSourceState({
          state:
            items.length === 0
              ? REPORTING_PRESENTATION_SOURCE_STATE.EMPTY
              : REPORTING_PRESENTATION_SOURCE_STATE.LIVE,
          reason: items.length === 0 ? "no_saved_reports" : null,
        }),
        items,
      };
    },

    async saveSavedReport(input) {
      if (!runtime.available || !runtime.facade) {
        return unavailableResult();
      }
      if (!visibility.canSaveReport) {
        return forbiddenResult(REPORTING_PERMISSIONS.REPORT_SAVE);
      }
      const result = await runtime.facade.saveSavedReport(input, deps.actor);
      if (!result.ok) {
        const code = result.error?.code || "";
        const isConflict =
          String(code).includes("VERSION") ||
          String(result.error?.message || "").toLowerCase().includes("version");
        return {
          ok: false,
          conflict: isConflict,
          sourceState: createReportingPresentationSourceState({
            state: REPORTING_PRESENTATION_SOURCE_STATE.ERROR,
            reason: isConflict ? "expected_version_conflict" : code || "save_failed",
            liveFailed: true,
          }),
          error: result.error?.message || "Không lưu được báo cáo",
          item: null,
        };
      }
      return {
        ok: true,
        sourceState: createReportingPresentationSourceState({
          state: REPORTING_PRESENTATION_SOURCE_STATE.LIVE,
        }),
        item: result.value,
      };
    },

    async listSavedFilters() {
      if (!runtime.available || !runtime.facade) {
        return unavailableResult();
      }
      if (!visibility.canViewDashboard && !visibility.canSaveFilter) {
        return forbiddenResult(REPORTING_PERMISSIONS.FILTER_SAVE);
      }
      const result = await runtime.facade.listSavedFilters(
        deps.ownerId,
        deps.tenantId
      );
      if (!result.ok) {
        return {
          ok: false,
          sourceState: createReportingPresentationSourceState({
            state: REPORTING_PRESENTATION_SOURCE_STATE.ERROR,
            reason: result.error?.code || "list_saved_filters_failed",
            liveFailed: true,
          }),
          items: [],
          error: result.error?.message || "Không tải được bộ lọc đã lưu",
        };
      }
      const items = Array.isArray(result.value) ? result.value : [];
      return {
        ok: true,
        sourceState: createReportingPresentationSourceState({
          state:
            items.length === 0
              ? REPORTING_PRESENTATION_SOURCE_STATE.EMPTY
              : REPORTING_PRESENTATION_SOURCE_STATE.LIVE,
          reason: items.length === 0 ? "no_saved_filters" : null,
        }),
        items,
      };
    },

    async saveSavedFilter(input) {
      if (!runtime.available || !runtime.facade) {
        return unavailableResult();
      }
      if (!visibility.canSaveFilter) {
        return forbiddenResult(REPORTING_PERMISSIONS.FILTER_SAVE);
      }
      const result = await runtime.facade.saveSavedFilter(input, deps.actor);
      if (!result.ok) {
        return {
          ok: false,
          sourceState: createReportingPresentationSourceState({
            state: REPORTING_PRESENTATION_SOURCE_STATE.ERROR,
            reason: result.error?.code || "save_filter_failed",
            liveFailed: true,
          }),
          error: result.error?.message || "Không lưu được bộ lọc",
          item: null,
          invalid: String(result.error?.code || "").includes("INVALID"),
        };
      }
      return {
        ok: true,
        sourceState: createReportingPresentationSourceState({
          state: REPORTING_PRESENTATION_SOURCE_STATE.LIVE,
        }),
        item: result.value,
      };
    },

    async executeReport(request) {
      if (!runtime.available || !runtime.facade) {
        return {
          ok: false,
          lifecycle: createExecutionLifecycleViewModel({
            status: "UNAVAILABLE",
            errorMessage: runtime.reason,
          }),
          sourceState: createUnavailableReportingRuntime(runtime.reason).sourceState,
        };
      }
      if (!visibility.canExecuteReport) {
        return {
          ok: false,
          forbidden: true,
          lifecycle: createExecutionLifecycleViewModel({
            status: "FAILED",
            errorMessage: `Missing ${REPORTING_PERMISSIONS.REPORT_EXECUTE}`,
          }),
        };
      }
      const result = await runtime.facade.executeReport({
        ...request,
        actor: request.actor || deps.actor,
        scope: request.scope || deps.scope,
      });
      if (!result.ok) {
        const status =
          String(result.error?.code || "").includes("SOURCE_NOT_CONFIGURED") ||
          result.error?.details?.availability === "SOURCE_NOT_CONFIGURED"
            ? "UNAVAILABLE"
            : "FAILED";
        return {
          ok: false,
          lifecycle: createExecutionLifecycleViewModel({
            status,
            errorMessage: result.error?.message,
            executionId: result.error?.details?.executionId,
          }),
          sourceState: mapAvailabilityToPresentationSourceState(
            result.error?.details?.availability || "SOURCE_FAILED",
            { error: status === "FAILED" }
          ),
        };
      }
      const value = result.value;
      return {
        ok: true,
        lifecycle: createExecutionLifecycleViewModel({
          status: value.status || (value.ok ? "SUCCEEDED" : "FAILED"),
          executionId: value.executionId,
          resultToken: value.executionId,
          errorMessage: value.errorMessage,
        }),
        result: value,
      };
    },

    async exportReport(request) {
      if (!runtime.available || !runtime.facade) {
        return {
          ok: false,
          lifecycle: createExportLifecycleViewModel({
            status: "UNAVAILABLE",
            errorMessage: runtime.reason,
          }),
        };
      }
      if (!visibility.canExportReport) {
        return {
          ok: false,
          forbidden: true,
          lifecycle: createExportLifecycleViewModel({
            status: "FAILED",
            errorMessage: `Missing ${REPORTING_PERMISSIONS.REPORT_EXPORT}`,
          }),
        };
      }
      if (
        request?.includeSensitiveFields === true &&
        !visibility.canViewSensitiveFields
      ) {
        return {
          ok: false,
          forbidden: true,
          lifecycle: createExportLifecycleViewModel({
            status: "FAILED",
            errorMessage: `Missing ${REPORTING_PERMISSIONS.SENSITIVE_FIELD_VIEW}`,
          }),
        };
      }

      const result = await runtime.facade.exportReport({
        ...request,
        actor: request.actor || deps.actor,
        scope: request.scope || deps.scope,
      });
      if (!result.ok) {
        const status =
          String(result.error?.code || "").includes("SOURCE_NOT_CONFIGURED") ||
          String(result.error?.message || "").toLowerCase().includes("unavailable")
            ? "UNAVAILABLE"
            : "FAILED";
        return {
          ok: false,
          lifecycle: createExportLifecycleViewModel({
            status,
            errorMessage: result.error?.message,
            exportJobId: result.error?.details?.exportJobId,
          }),
        };
      }

      const value = result.value;
      const outputReference =
        value.outputReference ||
        value.artifact ||
        value.artifactUri ||
        value.downloadUri ||
        null;
      const status = value.status || (value.ok ? "SUCCEEDED" : "FAILED");
      if (status === "SUCCEEDED" && !isValidExportOutputReference(outputReference)) {
        return {
          ok: false,
          lifecycle: createExportLifecycleViewModel({
            status: "FAILED",
            errorMessage: "Export succeeded without a valid output reference",
            exportJobId: value.exportJobId,
            outputReference: null,
          }),
        };
      }
      return {
        ok: status === "SUCCEEDED",
        lifecycle: createExportLifecycleViewModel({
          status,
          exportJobId: value.exportJobId,
          outputReference,
          errorMessage: value.errorMessage,
        }),
        result: value,
      };
    },
  };
}
