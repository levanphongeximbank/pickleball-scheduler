/**
 * Canonical metric registry entry contract.
 */

import { fail, ok } from "../contracts/result.js";
import { analyticsError, ANALYTICS_ERROR_CODE } from "../contracts/errors.js";
import {
  deepFreeze,
  isNonEmptyString,
  isPlainObject,
  isValidIsoTimestamp,
} from "../contracts/shared.js";
import { validateMetricDefinition } from "./validateMetricDefinition.js";
import {
  ANALYTICS_METRIC_LIFECYCLE_STATE,
  isAnalyticsMetricLifecycleState,
} from "./lifecycle.js";
import { createAnalyticsMetricDeprecation } from "./deprecation.js";
import { compareMetricDefinitions } from "./compatibility.js";

/**
 * @typedef {{
 *   metricId: string,
 *   version: string,
 *   definition: import("../contracts/metricDefinition.js").AnalyticsMetricDefinition,
 *   lifecycleState: string,
 *   displayName?: string,
 *   deprecation?: import("./deprecation.js").AnalyticsMetricDeprecation,
 *   registeredAt?: string,
 * }} AnalyticsMetricRegistryEntry
 */

/**
 * Stable identity key — never display name.
 * @param {string} metricId
 * @param {string} version
 */
export function metricIdentityKey(metricId, version) {
  return `${metricId}::${version}`;
}

/**
 * Deterministic JSON for definition equality (identity fields included).
 * @param {import("../contracts/metricDefinition.js").AnalyticsMetricDefinition} definition
 */
export function stableDefinitionFingerprint(definition) {
  const normalized = {
    metricId: definition.metricId,
    version: definition.version,
    definition: definition.definition,
    unit: definition.unit,
    aggregationKind: definition.aggregationKind,
    metricKind: definition.metricKind,
    source: {
      sourceId: definition.source.sourceId,
      sourceKind: definition.source.sourceKind,
      ownerModule: definition.source.ownerModule,
      ...(definition.source.reference
        ? { reference: definition.source.reference }
        : {}),
    },
    supportedTenantScopeKinds: [...definition.supportedTenantScopeKinds].sort(),
    supportedGranularities: [...definition.supportedGranularities].sort(),
    allowedDimensions: definition.allowedDimensions
      .map((d) => ({
        key: d.key,
        ...(d.label !== undefined ? { label: d.label } : {}),
      }))
      .sort((x, y) => (x.key < y.key ? -1 : x.key > y.key ? 1 : 0)),
    missingDataSemantics: definition.missingDataSemantics,
  };
  return JSON.stringify(normalized);
}

/**
 * @param {unknown} input
 * @returns {import("../contracts/result.js").Result}
 */
export function createAnalyticsMetricRegistryEntry(input) {
  if (!isPlainObject(input)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.REGISTRY_ENTRY_INVALID,
        "AnalyticsMetricRegistryEntry must be a plain object",
        "entry"
      )
    );
  }

  const definitionResult = validateMetricDefinition(
    input.definition !== undefined ? input.definition : input
  );
  if (!definitionResult.ok) return definitionResult;
  const definition = definitionResult.value;

  const lifecycleState = isNonEmptyString(input.lifecycleState)
    ? String(input.lifecycleState).trim()
    : ANALYTICS_METRIC_LIFECYCLE_STATE.ACTIVE;

  if (!isAnalyticsMetricLifecycleState(lifecycleState)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.REGISTRY_LIFECYCLE_INVALID,
        `Unsupported lifecycle state: ${lifecycleState}`,
        "lifecycleState",
        { lifecycleState }
      )
    );
  }

  /** @type {AnalyticsMetricRegistryEntry} */
  const entry = {
    metricId: definition.metricId,
    version: definition.version,
    definition,
    lifecycleState,
  };

  if (input.displayName !== undefined) {
    if (!isNonEmptyString(input.displayName)) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.REGISTRY_ENTRY_INVALID,
          "displayName must be a non-empty string when provided",
          "displayName"
        )
      );
    }
    entry.displayName = String(input.displayName).trim();
  }

  if (input.registeredAt !== undefined) {
    if (!isValidIsoTimestamp(input.registeredAt)) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.REGISTRY_ENTRY_INVALID,
          "registeredAt must be an ISO timestamp",
          "registeredAt"
        )
      );
    }
    entry.registeredAt = String(input.registeredAt).trim();
  }

  const needsDeprecation =
    lifecycleState === ANALYTICS_METRIC_LIFECYCLE_STATE.DEPRECATED;

  if (needsDeprecation && input.deprecation === undefined) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.REGISTRY_ENTRY_INVALID,
        "DEPRECATED metrics require deprecation metadata",
        "deprecation"
      )
    );
  }

  if (
    lifecycleState === ANALYTICS_METRIC_LIFECYCLE_STATE.ACTIVE &&
    input.deprecation !== undefined
  ) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.REGISTRY_LIFECYCLE_INVALID,
        "ACTIVE metrics must not carry deprecation metadata",
        "deprecation"
      )
    );
  }

  if (input.deprecation !== undefined) {
    const deprecationResult = createAnalyticsMetricDeprecation(input.deprecation, {
      metricId: definition.metricId,
      version: definition.version,
    });
    if (!deprecationResult.ok) return deprecationResult;
    entry.deprecation = deprecationResult.value;
  }

  return ok(deepFreeze(entry));
}

/**
 * @param {AnalyticsMetricRegistryEntry} existing
 * @param {AnalyticsMetricRegistryEntry} incoming
 * @returns {import("../contracts/result.js").Result}
 */
export function classifyRegistrationAgainstExisting(existing, incoming) {
  const sameFingerprint =
    stableDefinitionFingerprint(existing.definition) ===
    stableDefinitionFingerprint(incoming.definition);

  const lifecycleEqual = existing.lifecycleState === incoming.lifecycleState;
  const deprecationEqual =
    JSON.stringify(existing.deprecation || null) ===
    JSON.stringify(incoming.deprecation || null);
  const displayEqual = (existing.displayName || "") === (incoming.displayName || "");

  if (sameFingerprint && lifecycleEqual && deprecationEqual && displayEqual) {
    return ok(
      deepFreeze({
        status: "idempotent",
        entry: existing,
      })
    );
  }

  if (sameFingerprint && (!lifecycleEqual || !deprecationEqual || !displayEqual)) {
    // Same definition identity/body but governance metadata differs → conflict.
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.REGISTRY_CONFLICT,
        "Metric ID/version already registered with different governance metadata",
        "entry",
        {
          metricId: existing.metricId,
          version: existing.version,
        }
      )
    );
  }

  const compatibility = compareMetricDefinitions(
    existing.definition,
    incoming.definition
  );
  if (!compatibility.ok) return compatibility;

  return fail(
    analyticsError(
      ANALYTICS_ERROR_CODE.REGISTRY_CONFLICT,
      "Metric ID/version already registered with a different definition",
      "entry",
      {
        metricId: existing.metricId,
        version: existing.version,
        compatibility: compatibility.value.classification,
        reasons: compatibility.value.reasons,
      }
    )
  );
}
