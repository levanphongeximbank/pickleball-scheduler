/**
 * Presentation intent, filter/parameter, drill-down, export/schedule contracts (I&A-04).
 */

import { fail, ok } from "../contracts/result.js";
import { analyticsError, ANALYTICS_ERROR_CODE } from "../contracts/errors.js";
import { createAnalyticsTenantScope } from "../contracts/tenantScope.js";
import {
  deepFreeze,
  isFiniteNumber,
  isNonEmptyString,
  isPlainObject,
} from "../contracts/shared.js";
import {
  ANALYTICS_EXPORT_FORMAT,
  ANALYTICS_PARAMETER_TYPE,
  ANALYTICS_PRESENTATION_INTENT,
  isEnumValue,
} from "./enums.js";
import { assertNoForbiddenContractContent } from "./forbidden.js";

/**
 * @typedef {{
 *   intent: string,
 *   preferredFormat?: string,
 *   unitDisplay?: string,
 *   decimalPrecision?: number,
 *   percentageDisplay?: boolean,
 *   dateTimeDisplayIntent?: string,
 *   sortIntent?: string,
 *   directionMeaning?: string,
 *   accessibilityLabelIntent?: string,
 * }} AnalyticsPresentationIntent
 *
 * @typedef {{
 *   filterId: string,
 *   parameterType: string,
 *   required: boolean,
 *   defaultValue?: unknown,
 *   allowedValues?: ReadonlyArray<unknown>,
 *   validationRule?: string,
 *   tenantSafe: boolean,
 *   label?: string,
 * }} AnalyticsFilterDefinition
 *
 * @typedef {AnalyticsFilterDefinition} AnalyticsParameterDefinition
 *
 * @typedef {{
 *   targetIntentId: string,
 *   sourceContextId: string,
 *   parameterMappings: ReadonlyArray<{
 *     sourceParameterId: string,
 *     targetParameterId: string,
 *   }>,
 *   allowedDimensions: ReadonlyArray<string>,
 *   tenantScope: import("../contracts/tenantScope.js").AnalyticsTenantScope,
 * }} AnalyticsDrillDownDescriptor
 *
 * @typedef {{
 *   formats: ReadonlyArray<string>,
 *   includeProvenance?: boolean,
 *   includeWarnings?: boolean,
 * }} AnalyticsExportIntent
 *
 * @typedef {{
 *   enabled: boolean,
 *   cadence?: string,
 *   timezone?: string,
 *   recipientPolicyRef?: string,
 * }} AnalyticsScheduleIntent
 */

/**
 * @param {unknown} input
 * @returns {import("../contracts/result.js").Result}
 */
export function createAnalyticsPresentationIntent(input) {
  if (!isPlainObject(input)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.PRESENTATION_INTENT_INVALID,
        "AnalyticsPresentationIntent must be a plain object",
        "presentationIntent"
      )
    );
  }

  const forbidden = assertNoForbiddenContractContent(input, "presentationIntent");
  if (!forbidden.ok) return forbidden;

  if (!isEnumValue(input.intent, ANALYTICS_PRESENTATION_INTENT)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.PRESENTATION_INTENT_INVALID,
        `Unsupported presentation intent: ${input.intent}`,
        "presentationIntent.intent",
        { intent: input.intent }
      )
    );
  }

  /** @type {AnalyticsPresentationIntent} */
  const intent = { intent: String(input.intent) };

  if (input.preferredFormat !== undefined) {
    if (!isNonEmptyString(input.preferredFormat)) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.PRESENTATION_INTENT_INVALID,
          "preferredFormat must be a non-empty string",
          "presentationIntent.preferredFormat"
        )
      );
    }
    intent.preferredFormat = String(input.preferredFormat).trim();
  }

  if (input.unitDisplay !== undefined) {
    if (!isNonEmptyString(input.unitDisplay)) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.PRESENTATION_INTENT_INVALID,
          "unitDisplay must be a non-empty string",
          "presentationIntent.unitDisplay"
        )
      );
    }
    intent.unitDisplay = String(input.unitDisplay).trim();
  }

  if (input.decimalPrecision !== undefined) {
    if (
      !isFiniteNumber(input.decimalPrecision) ||
      !Number.isInteger(input.decimalPrecision) ||
      input.decimalPrecision < 0
    ) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.PRESENTATION_INTENT_INVALID,
          "decimalPrecision must be a non-negative integer",
          "presentationIntent.decimalPrecision"
        )
      );
    }
    intent.decimalPrecision = input.decimalPrecision;
  }

  if (input.percentageDisplay !== undefined) {
    if (typeof input.percentageDisplay !== "boolean") {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.PRESENTATION_INTENT_INVALID,
          "percentageDisplay must be a boolean",
          "presentationIntent.percentageDisplay"
        )
      );
    }
    intent.percentageDisplay = input.percentageDisplay;
  }

  for (const key of [
    "dateTimeDisplayIntent",
    "sortIntent",
    "directionMeaning",
    "accessibilityLabelIntent",
  ]) {
    if (input[key] !== undefined) {
      if (!isNonEmptyString(input[key])) {
        return fail(
          analyticsError(
            ANALYTICS_ERROR_CODE.PRESENTATION_INTENT_INVALID,
            `${key} must be a non-empty string when provided`,
            `presentationIntent.${key}`
          )
        );
      }
      intent[/** @type {keyof AnalyticsPresentationIntent} */ (key)] = String(
        input[key]
      ).trim();
    }
  }

  return ok(deepFreeze(intent));
}

/**
 * @param {unknown} input
 * @returns {import("../contracts/result.js").Result}
 */
export function createAnalyticsFilterDefinition(input) {
  if (!isPlainObject(input)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.FILTER_DEFINITION_INVALID,
        "AnalyticsFilterDefinition must be a plain object",
        "filter"
      )
    );
  }

  const forbidden = assertNoForbiddenContractContent(input, "filter");
  if (!forbidden.ok) return forbidden;

  if (!isNonEmptyString(input.filterId)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.FILTER_DEFINITION_INVALID,
        "filterId is required",
        "filter.filterId"
      )
    );
  }

  if (!isEnumValue(input.parameterType, ANALYTICS_PARAMETER_TYPE)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.FILTER_DEFINITION_INVALID,
        `Unsupported parameter type: ${input.parameterType}`,
        "filter.parameterType"
      )
    );
  }

  if (typeof input.required !== "boolean") {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.FILTER_DEFINITION_INVALID,
        "required must be a boolean",
        "filter.required"
      )
    );
  }

  if (typeof input.tenantSafe !== "boolean") {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.FILTER_DEFINITION_INVALID,
        "tenantSafe must be an explicit boolean",
        "filter.tenantSafe"
      )
    );
  }

  if (
    input.required === true &&
    input.defaultValue === undefined &&
    input.allowedValues === undefined &&
    input.validationRule === undefined
  ) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.FILTER_DEFINITION_INVALID,
        "Required filter must declare defaultValue, allowedValues, or validationRule",
        "filter.defaultValue"
      )
    );
  }

  /** @type {AnalyticsFilterDefinition} */
  const filter = {
    filterId: String(input.filterId).trim(),
    parameterType: String(input.parameterType),
    required: input.required,
    tenantSafe: input.tenantSafe,
  };

  if (input.defaultValue !== undefined) {
    filter.defaultValue = deepFreeze(
      typeof input.defaultValue === "object" && input.defaultValue !== null
        ? JSON.parse(JSON.stringify(input.defaultValue))
        : input.defaultValue
    );
  }

  if (input.allowedValues !== undefined) {
    if (!Array.isArray(input.allowedValues)) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.FILTER_DEFINITION_INVALID,
          "allowedValues must be an array",
          "filter.allowedValues"
        )
      );
    }
    filter.allowedValues = Object.freeze(
      input.allowedValues.map((v) =>
        typeof v === "object" && v !== null
          ? deepFreeze(JSON.parse(JSON.stringify(v)))
          : v
      )
    );
  }

  if (input.validationRule !== undefined) {
    if (!isNonEmptyString(input.validationRule)) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.FILTER_DEFINITION_INVALID,
          "validationRule must be a non-empty declarative string",
          "filter.validationRule"
        )
      );
    }
    filter.validationRule = String(input.validationRule).trim();
  }

  if (input.label !== undefined) {
    if (!isNonEmptyString(input.label)) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.FILTER_DEFINITION_INVALID,
          "label must be a non-empty string when provided",
          "filter.label"
        )
      );
    }
    filter.label = String(input.label).trim();
  }

  return ok(deepFreeze(filter));
}

/**
 * Parameter definition reuses filter semantics with parameterId alias.
 * @param {unknown} input
 * @returns {import("../contracts/result.js").Result}
 */
export function createAnalyticsParameterDefinition(input) {
  if (!isPlainObject(input)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.PARAMETER_DEFINITION_INVALID,
        "AnalyticsParameterDefinition must be a plain object",
        "parameter"
      )
    );
  }

  const filterId =
    input.filterId !== undefined
      ? input.filterId
      : input.parameterId !== undefined
        ? input.parameterId
        : undefined;

  const result = createAnalyticsFilterDefinition({
    ...input,
    filterId,
  });
  if (!result.ok) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.PARAMETER_DEFINITION_INVALID,
        result.error.message,
        result.error.field?.replace(/^filter/, "parameter") || "parameter",
        result.error.details
      )
    );
  }
  return result;
}

/**
 * @param {unknown} input
 * @returns {import("../contracts/result.js").Result}
 */
export function createAnalyticsDrillDownDescriptor(input) {
  if (!isPlainObject(input)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.DRILL_DOWN_INVALID,
        "AnalyticsDrillDownDescriptor must be a plain object",
        "drillDown"
      )
    );
  }

  const forbidden = assertNoForbiddenContractContent(input, "drillDown");
  if (!forbidden.ok) return forbidden;

  if (!isNonEmptyString(input.targetIntentId)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.DRILL_DOWN_INVALID,
        "targetIntentId is required",
        "drillDown.targetIntentId"
      )
    );
  }
  if (!isNonEmptyString(input.sourceContextId)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.DRILL_DOWN_INVALID,
        "sourceContextId is required",
        "drillDown.sourceContextId"
      )
    );
  }

  const tenantScopeResult = createAnalyticsTenantScope(input.tenantScope);
  if (!tenantScopeResult.ok) return tenantScopeResult;

  if (!Array.isArray(input.parameterMappings)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.DRILL_DOWN_INVALID,
        "parameterMappings must be an array",
        "drillDown.parameterMappings"
      )
    );
  }

  /** @type {{ sourceParameterId: string, targetParameterId: string }[]} */
  const mappings = [];
  for (const mapping of input.parameterMappings) {
    if (
      !isPlainObject(mapping) ||
      !isNonEmptyString(mapping.sourceParameterId) ||
      !isNonEmptyString(mapping.targetParameterId)
    ) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.DRILL_DOWN_INVALID,
          "parameterMappings entries require sourceParameterId and targetParameterId",
          "drillDown.parameterMappings"
        )
      );
    }
    mappings.push({
      sourceParameterId: String(mapping.sourceParameterId).trim(),
      targetParameterId: String(mapping.targetParameterId).trim(),
    });
  }

  if (!Array.isArray(input.allowedDimensions)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.DRILL_DOWN_INVALID,
        "allowedDimensions must be an array",
        "drillDown.allowedDimensions"
      )
    );
  }
  if (!input.allowedDimensions.every(isNonEmptyString)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.DRILL_DOWN_INVALID,
        "allowedDimensions must contain non-empty strings",
        "drillDown.allowedDimensions"
      )
    );
  }

  return ok(
    deepFreeze({
      targetIntentId: String(input.targetIntentId).trim(),
      sourceContextId: String(input.sourceContextId).trim(),
      parameterMappings: Object.freeze(mappings),
      allowedDimensions: Object.freeze(
        input.allowedDimensions.map((d) => String(d).trim())
      ),
      tenantScope: tenantScopeResult.value,
    })
  );
}

/**
 * @param {unknown} input
 * @returns {import("../contracts/result.js").Result}
 */
export function createAnalyticsExportIntent(input) {
  if (!isPlainObject(input)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.EXPORT_INTENT_INVALID,
        "AnalyticsExportIntent must be a plain object",
        "exportIntent"
      )
    );
  }

  const forbidden = assertNoForbiddenContractContent(input, "exportIntent");
  if (!forbidden.ok) return forbidden;

  if (!Array.isArray(input.formats) || input.formats.length === 0) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.EXPORT_INTENT_INVALID,
        "formats must be a non-empty array",
        "exportIntent.formats"
      )
    );
  }

  /** @type {string[]} */
  const formats = [];
  for (const format of input.formats) {
    if (!isEnumValue(format, ANALYTICS_EXPORT_FORMAT)) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.EXPORT_INTENT_INVALID,
          `Unsupported export format: ${format}`,
          "exportIntent.formats",
          { format }
        )
      );
    }
    const normalized = String(format);
    if (!formats.includes(normalized)) formats.push(normalized);
  }

  /** @type {AnalyticsExportIntent} */
  const intent = { formats: Object.freeze(formats) };

  if (input.includeProvenance !== undefined) {
    if (typeof input.includeProvenance !== "boolean") {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.EXPORT_INTENT_INVALID,
          "includeProvenance must be a boolean",
          "exportIntent.includeProvenance"
        )
      );
    }
    intent.includeProvenance = input.includeProvenance;
  }

  if (input.includeWarnings !== undefined) {
    if (typeof input.includeWarnings !== "boolean") {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.EXPORT_INTENT_INVALID,
          "includeWarnings must be a boolean",
          "exportIntent.includeWarnings"
        )
      );
    }
    intent.includeWarnings = input.includeWarnings;
  }

  return ok(deepFreeze(intent));
}

/**
 * Schedule intent is metadata only — never starts a runtime or job.
 * @param {unknown} input
 * @returns {import("../contracts/result.js").Result}
 */
export function createAnalyticsScheduleIntent(input) {
  if (!isPlainObject(input)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.SCHEDULE_INTENT_INVALID,
        "AnalyticsScheduleIntent must be a plain object",
        "scheduleIntent"
      )
    );
  }

  const forbidden = assertNoForbiddenContractContent(input, "scheduleIntent");
  if (!forbidden.ok) return forbidden;

  if (typeof input.enabled !== "boolean") {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.SCHEDULE_INTENT_INVALID,
        "enabled must be a boolean",
        "scheduleIntent.enabled"
      )
    );
  }

  /** @type {AnalyticsScheduleIntent} */
  const intent = {
    enabled: input.enabled,
    // Explicit marker: metadata only — no scheduler runtime is created.
    runtimeInitialized: false,
  };

  if (input.cadence !== undefined) {
    if (!isNonEmptyString(input.cadence)) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.SCHEDULE_INTENT_INVALID,
          "cadence must be a non-empty string when provided",
          "scheduleIntent.cadence"
        )
      );
    }
    intent.cadence = String(input.cadence).trim();
  }

  if (input.timezone !== undefined) {
    if (!isNonEmptyString(input.timezone)) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.SCHEDULE_INTENT_INVALID,
          "timezone must be a non-empty string when provided",
          "scheduleIntent.timezone"
        )
      );
    }
    intent.timezone = String(input.timezone).trim();
  }

  if (input.recipientPolicyRef !== undefined) {
    if (!isNonEmptyString(input.recipientPolicyRef)) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.SCHEDULE_INTENT_INVALID,
          "recipientPolicyRef must be a non-empty string when provided",
          "scheduleIntent.recipientPolicyRef"
        )
      );
    }
    intent.recipientPolicyRef = String(input.recipientPolicyRef).trim();
  }

  if (input.enabled && !intent.cadence) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.SCHEDULE_INTENT_INVALID,
        "enabled schedule intent requires cadence metadata",
        "scheduleIntent.cadence"
      )
    );
  }

  return ok(deepFreeze(intent));
}
