/**
 * Generic shadow result comparator (Phase 3A.2).
 * Fixture / injected results only — no executor calls.
 */

import { cloneJsonSafe, isPlainObject } from "../../contracts/jsonSafe.js";
import { createShadowResultEnvelope } from "../contracts/shadowResultEnvelope.js";
import { createShadowComparisonResult } from "../contracts/shadowComparison.js";
import { createShadowDifference } from "../contracts/shadowDifference.js";
import { createShadowNormalizationPolicy } from "../contracts/shadowNormalization.js";
import { normalizeShadowPayload } from "./normalizeShadowPayload.js";
import { SHADOW_COMPARISON_STATUS } from "../constants/shadowComparisonStatuses.js";
import { SHADOW_REASON_CODE } from "../constants/shadowReasonCodes.js";
import {
  SHADOW_DIFFERENCE_KIND,
  SHADOW_DIFFERENCE_SEVERITY,
} from "../constants/shadowDifferenceKinds.js";
import { SHADOW_COMPARATOR_VERSION } from "../constants/shadowExecutors.js";

/**
 * Stable fingerprint without using RNG / Date.
 * @param {unknown} value
 * @returns {string}
 */
function fingerprint(value) {
  try {
    return JSON.stringify(value);
  } catch {
    return "[unserializable]";
  }
}

/**
 * @param {unknown} legacy
 * @param {unknown} canonical
 * @param {string} path
 * @param {import('../contracts/shadowDifference.js').ShadowDifference[]} differences
 */
function walkDiff(legacy, canonical, path, differences) {
  if (legacy === canonical) {
    return;
  }

  const legacyType = legacy === null ? "null" : Array.isArray(legacy) ? "array" : typeof legacy;
  const canonicalType =
    canonical === null ? "null" : Array.isArray(canonical) ? "array" : typeof canonical;

  if (legacy === undefined && canonical !== undefined) {
    differences.push(
      createShadowDifference({
        path,
        kind: SHADOW_DIFFERENCE_KIND.MISSING_IN_LEGACY,
        legacyValue: undefined,
        canonicalValue: redactValue(canonical),
        severity: SHADOW_DIFFERENCE_SEVERITY.HIGH,
        message: `Missing in legacy at ${path || "$"}`,
      })
    );
    return;
  }

  if (canonical === undefined && legacy !== undefined) {
    differences.push(
      createShadowDifference({
        path,
        kind: SHADOW_DIFFERENCE_KIND.MISSING_IN_CANONICAL,
        legacyValue: redactValue(legacy),
        canonicalValue: undefined,
        severity: SHADOW_DIFFERENCE_SEVERITY.HIGH,
        message: `Missing in canonical at ${path || "$"}`,
      })
    );
    return;
  }

  if (legacyType !== canonicalType) {
    differences.push(
      createShadowDifference({
        path,
        kind: SHADOW_DIFFERENCE_KIND.TYPE_MISMATCH,
        legacyValue: legacyType,
        canonicalValue: canonicalType,
        severity: SHADOW_DIFFERENCE_SEVERITY.HIGH,
        message: `Type mismatch at ${path || "$"}: ${legacyType} vs ${canonicalType}`,
      })
    );
    return;
  }

  if (Array.isArray(legacy) && Array.isArray(canonical)) {
    if (legacy.length !== canonical.length) {
      differences.push(
        createShadowDifference({
          path,
          kind: SHADOW_DIFFERENCE_KIND.ORDER_MISMATCH,
          legacyValue: legacy.length,
          canonicalValue: canonical.length,
          severity: SHADOW_DIFFERENCE_SEVERITY.MEDIUM,
          message: `Array length mismatch at ${path || "$"}`,
        })
      );
    }
    const len = Math.max(legacy.length, canonical.length);
    for (let i = 0; i < len; i += 1) {
      walkDiff(
        legacy[i],
        canonical[i],
        path ? `${path}[${i}]` : `[${i}]`,
        differences
      );
    }
    return;
  }

  if (isPlainObject(legacy) && isPlainObject(canonical)) {
    const keys = new Set([...Object.keys(legacy), ...Object.keys(canonical)]);
    for (const key of [...keys].sort()) {
      walkDiff(
        legacy[key],
        canonical[key],
        path ? `${path}.${key}` : key,
        differences
      );
    }
    return;
  }

  if (legacy !== canonical) {
    differences.push(
      createShadowDifference({
        path,
        kind: SHADOW_DIFFERENCE_KIND.VALUE_MISMATCH,
        legacyValue: redactValue(legacy),
        canonicalValue: redactValue(canonical),
        severity: SHADOW_DIFFERENCE_SEVERITY.MEDIUM,
        message: `Value mismatch at ${path || "$"}`,
      })
    );
  }
}

/**
 * Keep diagnostics free of large/sensitive blobs by truncating strings.
 * @param {unknown} value
 * @returns {unknown}
 */
function redactValue(value) {
  if (typeof value === "string" && value.length > 120) {
    return `${value.slice(0, 117)}...`;
  }
  if (isPlainObject(value) || Array.isArray(value)) {
    try {
      const raw = JSON.stringify(value);
      if (raw.length > 200) {
        return { _redacted: true, size: raw.length };
      }
      return cloneJsonSafe(value);
    } catch {
      return { _redacted: true };
    }
  }
  return value;
}

/**
 * @param {object} [input]
 * @param {object} [input.envelope]
 * @param {object} [input.normalizationPolicy]
 * @param {boolean} [input.skip]
 * @returns {import('../contracts/shadowComparison.js').ShadowComparisonResult}
 */
export function compareShadowResults(input = {}) {
  if (input.skip === true) {
    return createShadowComparisonResult({
      status: SHADOW_COMPARISON_STATUS.SKIPPED,
      reasonCode: SHADOW_REASON_CODE.COMPARISON_SKIPPED,
      metadata: { skipped: true },
    });
  }

  const envelope = createShadowResultEnvelope(
    isPlainObject(input.envelope) ? input.envelope : {}
  );

  const hasLegacyError = Boolean(envelope.legacyError);
  const hasCanonicalError = Boolean(envelope.canonicalError);

  if (hasLegacyError && hasCanonicalError) {
    const sameCode = envelope.legacyError.code === envelope.canonicalError.code;
    return createShadowComparisonResult({
      status: sameCode
        ? SHADOW_COMPARISON_STATUS.EQUIVALENT
        : SHADOW_COMPARISON_STATUS.ERROR,
      reasonCode: SHADOW_REASON_CODE.BOTH_ERROR,
      differences: sameCode
        ? []
        : [
            createShadowDifference({
              path: "error.code",
              kind: SHADOW_DIFFERENCE_KIND.ERROR_MISMATCH,
              legacyValue: envelope.legacyError.code,
              canonicalValue: envelope.canonicalError.code,
              severity: SHADOW_DIFFERENCE_SEVERITY.CRITICAL,
              message: "Both paths errored with different codes",
            }),
          ],
      legacyFingerprint: fingerprint(envelope.legacyError),
      canonicalFingerprint: fingerprint(envelope.canonicalError),
      comparatorVersion: SHADOW_COMPARATOR_VERSION,
      metadata: { bothError: true },
    });
  }

  if (hasLegacyError) {
    return createShadowComparisonResult({
      status: SHADOW_COMPARISON_STATUS.ERROR,
      reasonCode: SHADOW_REASON_CODE.LEGACY_ERROR,
      differences: [
        createShadowDifference({
          path: "legacyError",
          kind: SHADOW_DIFFERENCE_KIND.ERROR_MISMATCH,
          legacyValue: envelope.legacyError.code,
          canonicalValue: null,
          severity: SHADOW_DIFFERENCE_SEVERITY.CRITICAL,
          message: "Legacy path errored",
        }),
      ],
      legacyFingerprint: fingerprint(envelope.legacyError),
      canonicalFingerprint: fingerprint(envelope.canonicalResult),
      metadata: { legacyOnlyError: true },
    });
  }

  if (hasCanonicalError) {
    return createShadowComparisonResult({
      status: SHADOW_COMPARISON_STATUS.ERROR,
      reasonCode: SHADOW_REASON_CODE.CANONICAL_ERROR,
      differences: [
        createShadowDifference({
          path: "canonicalError",
          kind: SHADOW_DIFFERENCE_KIND.ERROR_MISMATCH,
          legacyValue: null,
          canonicalValue: envelope.canonicalError.code,
          severity: SHADOW_DIFFERENCE_SEVERITY.CRITICAL,
          message: "Canonical path errored",
        }),
      ],
      legacyFingerprint: fingerprint(envelope.legacyResult),
      canonicalFingerprint: fingerprint(envelope.canonicalError),
      metadata: { canonicalOnlyError: true },
    });
  }

  if (envelope.legacyResult === null && envelope.canonicalResult === null) {
    return createShadowComparisonResult({
      status: SHADOW_COMPARISON_STATUS.NOT_COMPARABLE,
      reasonCode: SHADOW_REASON_CODE.COMPARISON_NOT_COMPARABLE,
      metadata: { bothNull: true },
    });
  }

  if (
    (envelope.legacyResult === null) !== (envelope.canonicalResult === null)
  ) {
    return createShadowComparisonResult({
      status: SHADOW_COMPARISON_STATUS.NOT_COMPARABLE,
      reasonCode: SHADOW_REASON_CODE.COMPARISON_NOT_COMPARABLE,
      differences: [
        createShadowDifference({
          path: "$",
          kind:
            envelope.legacyResult === null
              ? SHADOW_DIFFERENCE_KIND.MISSING_IN_LEGACY
              : SHADOW_DIFFERENCE_KIND.MISSING_IN_CANONICAL,
          legacyValue: redactValue(envelope.legacyResult),
          canonicalValue: redactValue(envelope.canonicalResult),
          severity: SHADOW_DIFFERENCE_SEVERITY.HIGH,
          message: "One side has null result",
        }),
      ],
      metadata: { nullMismatch: true },
    });
  }

  const policy = createShadowNormalizationPolicy(
    isPlainObject(input.normalizationPolicy) ? input.normalizationPolicy : {}
  );
  const normalized = normalizeShadowPayload({
    legacy: envelope.legacyResult,
    canonical: envelope.canonicalResult,
    policy,
  });

  /** @type {import('../contracts/shadowDifference.js').ShadowDifference[]} */
  const differences = [];
  walkDiff(
    normalized.legacyNormalized,
    normalized.canonicalNormalized,
    "",
    differences
  );

  if (differences.length === 0) {
    return createShadowComparisonResult({
      status: SHADOW_COMPARISON_STATUS.EQUIVALENT,
      reasonCode: SHADOW_REASON_CODE.COMPARISON_EQUIVALENT,
      differences: [],
      ignoredDifferences: [],
      legacyFingerprint: fingerprint(normalized.legacyNormalized),
      canonicalFingerprint: fingerprint(normalized.canonicalNormalized),
      comparatorVersion: SHADOW_COMPARATOR_VERSION,
      metadata: {
        appliedRules: normalized.appliedRules,
      },
    });
  }

  const onlyOrder = differences.every(
    (d) => d.kind === SHADOW_DIFFERENCE_KIND.ORDER_MISMATCH
  );

  return createShadowComparisonResult({
    status: onlyOrder
      ? SHADOW_COMPARISON_STATUS.PARTIAL
      : SHADOW_COMPARISON_STATUS.NON_EQUIVALENT,
    reasonCode: onlyOrder
      ? SHADOW_REASON_CODE.COMPARISON_PARTIAL
      : SHADOW_REASON_CODE.COMPARISON_DIVERGED,
    differences,
    ignoredDifferences: [],
    legacyFingerprint: fingerprint(normalized.legacyNormalized),
    canonicalFingerprint: fingerprint(normalized.canonicalNormalized),
    comparatorVersion: SHADOW_COMPARATOR_VERSION,
    metadata: {
      appliedRules: normalized.appliedRules,
      differenceCount: differences.length,
    },
  });
}
