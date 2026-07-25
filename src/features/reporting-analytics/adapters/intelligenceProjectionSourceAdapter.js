/**
 * REPORTING-03 — Intelligence projection data-source adapter (application boundary).
 *
 * Maps Reporting INTELLIGENCE_PROJECTION source references through the public
 * I&A facade entry only. Does NOT own an analytical query runtime.
 * Does NOT deep-import I&A internals.
 * Does NOT invent LIVE provenance when no deployed execute-by-projectionId
 * contract exists on the public I&A surface.
 */

import {
  createAnalyticsQueryRuntime,
  createReadOnlyAnalyticsFacade,
  executeAnalyticsProjection,
} from "../../intelligence-analytics/index.js";
import { REPORT_AVAILABILITY } from "../constants/availability.js";
import { REPORT_PROVENANCE } from "../constants/provenance.js";
import { REPORT_SOURCE_KIND } from "../constants/sourceKinds.js";
import { REPORTING_ERROR_CODE } from "../errors/errorCodes.js";
import { ReportingError } from "../errors/ReportingError.js";
import { createProvenanceMetadata } from "../contracts/provenance.js";
import { reportScopesEqual } from "../contracts/scope.js";
import { deepFreeze, isPlainObject } from "../contracts/shared.js";
import { createUnavailableIntelligenceProjectionResult } from "./dashboardProvenance.js";

/**
 * Documented probe of public I&A surface relevant to Reporting mapping.
 * execute-by-projectionId is NOT available on the public barrel today.
 */
export const IA_PUBLIC_PROJECTION_EXECUTION_CONTRACT = Object.freeze({
  publicEntry: "src/features/intelligence-analytics/index.js",
  hasCreateAnalyticsQueryRuntime: typeof createAnalyticsQueryRuntime === "function",
  hasCreateReadOnlyAnalyticsFacade: typeof createReadOnlyAnalyticsFacade === "function",
  hasExecuteAnalyticsProjection: typeof executeAnalyticsProjection === "function",
  /**
   * I&A public runtime keys on metricId/version + injected adapters/observations.
   * Reporting projectionId has no canonical public executeByProjectionId.
   */
  executeByProjectionId: false,
  deployedRemoteProjectionObject: false,
  mappingStatus: "PROJECTION_SOURCE_NOT_DEPLOYED",
});

/**
 * @param {unknown} definition
 * @param {unknown} request
 */
function assertIntelligenceProjectionInput(definition, request) {
  if (!isPlainObject(definition) || !isPlainObject(definition.source)) {
    throw new ReportingError(
      REPORTING_ERROR_CODE.INVALID_SOURCE_REFERENCE,
      "Intelligence projection adapter requires definition.source",
      { field: "definition.source" }
    );
  }
  const source = definition.source;
  if (source.kind !== REPORT_SOURCE_KIND.INTELLIGENCE_PROJECTION) {
    throw new ReportingError(
      REPORTING_ERROR_CODE.INVALID_SOURCE_REFERENCE,
      `Expected INTELLIGENCE_PROJECTION, got ${source.kind || "(empty)"}`,
      { field: "source.kind", value: source.kind }
    );
  }
  const projectionId = String(source.projectionId || "").trim();
  if (!projectionId) {
    throw new ReportingError(
      REPORTING_ERROR_CODE.INVALID_SOURCE_REFERENCE,
      "INTELLIGENCE_PROJECTION requires projectionId",
      { field: "projectionId" }
    );
  }
  if (!isPlainObject(request) || !isPlainObject(request.scope)) {
    throw new ReportingError(
      REPORTING_ERROR_CODE.MISSING_SCOPE,
      "Intelligence projection adapter requires request.scope",
      { field: "request.scope" }
    );
  }
  if (
    isPlainObject(definition.scope) &&
    !reportScopesEqual(definition.scope, request.scope)
  ) {
    throw new ReportingError(
      REPORTING_ERROR_CODE.FORBIDDEN_SCOPE,
      "Request scope does not match report definition scope",
      { field: "scope" }
    );
  }
  return { source, projectionId, scope: request.scope };
}

/**
 * Optional future injector: must expose executeByProjectionId(input) returning
 * presentation rows + provenance. Until I&A publishes that public contract,
 * callers must omit this (default) so the adapter stays fail-closed.
 *
 * @param {{
 *   iaProjectionExecutor?: {
 *     executeByProjectionId: (input: object) => Promise<object>|object
 *   }|null
 * }} [options]
 */
export function createIntelligenceProjectionDataSourcePort(options = {}) {
  const executor =
    options && isPlainObject(options.iaProjectionExecutor)
      ? options.iaProjectionExecutor
      : null;

  return {
    /**
     * ReportDataSourcePort.execute
     * @param {{ definition: object, request: object, selectedColumns?: unknown, executionId?: string }} args
     */
    async execute(args) {
      const definition = args?.definition;
      const request = args?.request;
      const { source, projectionId, scope } = assertIntelligenceProjectionInput(
        definition,
        request
      );

      const contract = IA_PUBLIC_PROJECTION_EXECUTION_CONTRACT;
      const canDelegate =
        executor &&
        typeof executor.executeByProjectionId === "function" &&
        contract.hasCreateAnalyticsQueryRuntime;

      if (!canDelegate) {
        const unavailable = createUnavailableIntelligenceProjectionResult(
          "projection_source_not_deployed"
        );
        return deepFreeze({
          availability: REPORT_AVAILABILITY.SOURCE_NOT_CONFIGURED,
          errorCode: REPORTING_ERROR_CODE.PROJECTION_SOURCE_NOT_DEPLOYED,
          errorMessage:
            "No deployed public I&A execute-by-projectionId contract; Reporting does not own analytical runtime",
          rows: [],
          warnings: [
            "PROJECTION_SOURCE_NOT_DEPLOYED",
            "consume_public_ia_facade_only",
          ],
          sourceReferences: [source],
          provenance: unavailable.provenance,
          payload: deepFreeze({
            projectionId,
            tenantId: scope.tenantId || null,
            clubId: scope.clubId || null,
            venueId: scope.venueId || null,
            scopeKind: scope.kind || null,
            mappingStatus: contract.mappingStatus,
            iaPublicContract: {
              executeByProjectionId: contract.executeByProjectionId,
              deployedRemoteProjectionObject:
                contract.deployedRemoteProjectionObject,
            },
            // Never persist raw I&A internal responses here.
          }),
        });
      }

      let raw;
      try {
        raw = await executor.executeByProjectionId({
          projectionId,
          scope,
          definition,
          request,
          selectedColumns: args?.selectedColumns,
          executionId: args?.executionId,
        });
      } catch (err) {
        const message =
          err && typeof err.message === "string"
            ? err.message
            : "I&A projection executor failed";
        return deepFreeze({
          availability: REPORT_AVAILABILITY.SOURCE_FAILED,
          errorCode: REPORTING_ERROR_CODE.SOURCE_FAILED,
          errorMessage: message,
          liveFailed: true,
          rows: [],
          warnings: ["ia_projection_executor_failed"],
          sourceReferences: [source],
          provenance: createProvenanceMetadata({
            state: REPORT_PROVENANCE.UNAVAILABLE,
            sourceKind: REPORT_SOURCE_KIND.INTELLIGENCE_PROJECTION,
            fallbackReason: "ia_projection_executor_failed",
            warnings: ["I&A public executor failure normalized; no mock fallback"],
          }),
          payload: deepFreeze({
            projectionId,
            tenantId: scope.tenantId || null,
            mappingStatus: "IA_EXECUTOR_FAILED",
          }),
        });
      }

      if (!isPlainObject(raw)) {
        throw new ReportingError(
          REPORTING_ERROR_CODE.INVALID_CONTRACT,
          "I&A projection executor returned a non-object result",
          { field: "iaResult" }
        );
      }

      const provenanceState = String(raw.provenance?.state || "").trim();
      if (provenanceState === REPORT_PROVENANCE.LIVE) {
        // Only accept LIVE when the injected public contract explicitly proves it.
        if (raw.provenance?.liveProvenanceProved !== true) {
          throw new ReportingError(
            REPORTING_ERROR_CODE.PROVENANCE_MISMATCH,
            "LIVE provenance rejected without liveProvenanceProved from public I&A contract",
            { field: "provenance" }
          );
        }
      }

      if (raw.liveFailed === true && provenanceState === REPORT_PROVENANCE.MOCK) {
        throw new ReportingError(
          REPORTING_ERROR_CODE.SILENT_FALLBACK_REJECTED,
          "Silent live-to-mock fallback rejected for intelligence projection",
          { field: "provenance" }
        );
      }

      return deepFreeze({
        availability: raw.availability || REPORT_AVAILABILITY.AVAILABLE,
        errorCode: raw.errorCode,
        errorMessage: raw.errorMessage,
        liveFailed: raw.liveFailed === true,
        rows: Array.isArray(raw.rows) ? raw.rows : [],
        warnings: Array.isArray(raw.warnings) ? raw.warnings : [],
        sourceReferences: [source],
        provenance: createProvenanceMetadata(
          raw.provenance || {
            state: REPORT_PROVENANCE.UNAVAILABLE,
            sourceKind: REPORT_SOURCE_KIND.INTELLIGENCE_PROJECTION,
            fallbackReason: "ia_result_missing_provenance",
          }
        ),
        payload: deepFreeze({
          projectionId,
          tenantId: scope.tenantId || null,
          clubId: scope.clubId || null,
          venueId: scope.venueId || null,
          scopeKind: scope.kind || null,
          mappingStatus: "DELEGATED_PUBLIC_IA_EXECUTOR",
          freshness: raw.freshness || raw.provenance || null,
        }),
      });
    },
  };
}
