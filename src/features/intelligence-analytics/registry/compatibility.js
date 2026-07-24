/**
 * Compatibility classification between metric definition versions.
 * Minimal, deterministic — not a semantic-diff engine.
 *
 * Rules (documented):
 * - IDENTICAL: all semantic fields and definition text match
 * - BREAKING: unit, aggregation, missing-data, metricKind, source core,
 *   tenant-scope removal, granularity removal, or dimension removal
 * - BACKWARD_COMPATIBLE: only additive tenant scopes / granularities / dimensions
 *   (all other semantic fields identical, including definition text)
 * - INDETERMINATE: definition text or optional source.reference differs without
 *   breaking changes; or metricId mismatch
 */

import { ok } from "../contracts/result.js";
import { deepFreeze, isPlainObject } from "../contracts/shared.js";
import { createAnalyticsMetricDefinition } from "../contracts/metricDefinition.js";

export const ANALYTICS_METRIC_COMPATIBILITY = Object.freeze({
  IDENTICAL: "identical",
  BACKWARD_COMPATIBLE: "backward_compatible",
  BREAKING: "breaking",
  INDETERMINATE: "indeterminate",
});

/**
 * @param {unknown} input
 * @returns {import("../contracts/result.js").Result}
 */
function normalizeDefinition(input) {
  if (
    isPlainObject(input) &&
    typeof input.metricId === "string" &&
    typeof input.version === "string" &&
    typeof input.unit === "string" &&
    typeof input.aggregationKind === "string" &&
    typeof input.metricKind === "string" &&
    typeof input.definition === "string" &&
    typeof input.missingDataSemantics === "string" &&
    isPlainObject(input.source) &&
    Array.isArray(input.supportedTenantScopeKinds) &&
    Array.isArray(input.supportedGranularities) &&
    Array.isArray(input.allowedDimensions)
  ) {
    return ok(
      /** @type {import("../contracts/metricDefinition.js").AnalyticsMetricDefinition} */ (
        input
      )
    );
  }
  return createAnalyticsMetricDefinition(input);
}

/**
 * @param {import("../contracts/metricDefinition.js").AnalyticsMetricDefinition} definition
 * @returns {string[]}
 */
function dimensionKeys(definition) {
  return definition.allowedDimensions.map((d) => d.key).slice().sort();
}

/**
 * @param {ReadonlyArray<string>} a
 * @param {ReadonlyArray<string>} b
 */
function setEqual(a, b) {
  if (a.length !== b.length) return false;
  const sa = new Set(a);
  for (const item of b) {
    if (!sa.has(item)) return false;
  }
  return true;
}

/**
 * @param {ReadonlyArray<string>} before
 * @param {ReadonlyArray<string>} after
 * @returns {{ added: boolean, removed: boolean }}
 */
function setDelta(before, after) {
  const beforeSet = new Set(before);
  const afterSet = new Set(after);
  let added = false;
  let removed = false;
  for (const item of afterSet) {
    if (!beforeSet.has(item)) added = true;
  }
  for (const item of beforeSet) {
    if (!afterSet.has(item)) removed = true;
  }
  return { added, removed };
}

/**
 * @param {import("../contracts/source.js").AnalyticsMetricSource} a
 * @param {import("../contracts/source.js").AnalyticsMetricSource} b
 */
function sourceCoreEqual(a, b) {
  return (
    a.sourceId === b.sourceId &&
    a.sourceKind === b.sourceKind &&
    a.ownerModule === b.ownerModule
  );
}

/**
 * Compare two metric definitions for registry compatibility classification.
 *
 * @param {unknown} beforeInput
 * @param {unknown} afterInput
 * @returns {import("../contracts/result.js").Result}
 */
export function compareMetricDefinitions(beforeInput, afterInput) {
  const before = normalizeDefinition(beforeInput);
  if (!before.ok) return before;
  const after = normalizeDefinition(afterInput);
  if (!after.ok) return after;

  const a = before.value;
  const b = after.value;

  if (a.metricId !== b.metricId) {
    return ok(
      deepFreeze({
        classification: ANALYTICS_METRIC_COMPATIBILITY.INDETERMINATE,
        reasons: Object.freeze(["metricId_mismatch"]),
        beforeMetricId: a.metricId,
        beforeVersion: a.version,
        afterMetricId: b.metricId,
        afterVersion: b.version,
      })
    );
  }

  /** @type {string[]} */
  const reasons = [];
  let breaking = false;
  let textOrReferenceDrift = false;

  if (a.unit !== b.unit) {
    breaking = true;
    reasons.push("unit_changed");
  }
  if (a.aggregationKind !== b.aggregationKind) {
    breaking = true;
    reasons.push("aggregation_kind_changed");
  }
  if (a.missingDataSemantics !== b.missingDataSemantics) {
    breaking = true;
    reasons.push("missing_data_semantics_changed");
  }
  if (a.metricKind !== b.metricKind) {
    breaking = true;
    reasons.push("metric_kind_changed");
  }
  if (!sourceCoreEqual(a.source, b.source)) {
    breaking = true;
    reasons.push("source_changed");
  } else if ((a.source.reference || "") !== (b.source.reference || "")) {
    textOrReferenceDrift = true;
    reasons.push("source_reference_changed");
  }

  const scopeDelta = setDelta(
    [...a.supportedTenantScopeKinds],
    [...b.supportedTenantScopeKinds]
  );
  if (scopeDelta.removed) {
    breaking = true;
    reasons.push("tenant_scope_removed");
  } else if (scopeDelta.added) {
    reasons.push("tenant_scope_added");
  }

  const granDelta = setDelta(
    [...a.supportedGranularities],
    [...b.supportedGranularities]
  );
  if (granDelta.removed) {
    breaking = true;
    reasons.push("granularity_removed");
  } else if (granDelta.added) {
    reasons.push("granularity_added");
  }

  const dimDelta = setDelta(dimensionKeys(a), dimensionKeys(b));
  if (dimDelta.removed) {
    breaking = true;
    reasons.push("dimension_removed");
  } else if (dimDelta.added) {
    reasons.push("dimension_added");
  }

  if (a.definition !== b.definition) {
    textOrReferenceDrift = true;
    reasons.push("definition_text_changed");
  }

  const fullyEqual =
    a.unit === b.unit &&
    a.aggregationKind === b.aggregationKind &&
    a.missingDataSemantics === b.missingDataSemantics &&
    a.metricKind === b.metricKind &&
    sourceCoreEqual(a.source, b.source) &&
    (a.source.reference || "") === (b.source.reference || "") &&
    setEqual([...a.supportedTenantScopeKinds], [...b.supportedTenantScopeKinds]) &&
    setEqual([...a.supportedGranularities], [...b.supportedGranularities]) &&
    setEqual(dimensionKeys(a), dimensionKeys(b)) &&
    a.definition === b.definition;

  const additiveOnly =
    !breaking && (scopeDelta.added || granDelta.added || dimDelta.added);

  /** @type {string} */
  let classification;
  if (fullyEqual) {
    classification = ANALYTICS_METRIC_COMPATIBILITY.IDENTICAL;
  } else if (breaking) {
    classification = ANALYTICS_METRIC_COMPATIBILITY.BREAKING;
  } else if (additiveOnly && !textOrReferenceDrift) {
    classification = ANALYTICS_METRIC_COMPATIBILITY.BACKWARD_COMPATIBLE;
  } else {
    classification = ANALYTICS_METRIC_COMPATIBILITY.INDETERMINATE;
  }

  return ok(
    deepFreeze({
      classification,
      reasons: Object.freeze([...reasons]),
      beforeMetricId: a.metricId,
      beforeVersion: a.version,
      afterMetricId: b.metricId,
      afterVersion: b.version,
    })
  );
}
