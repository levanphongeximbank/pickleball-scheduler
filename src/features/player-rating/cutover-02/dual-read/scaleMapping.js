/**
 * Scale mapping for dual-read compare.
 * Default: UNAPPROVED / RAW_ONLY — no equivalence verdict.
 * Owner must approve before any non-RAW strategy is treated as authoritative.
 */

import {
  RATING_SCALE_ID,
  SCALE_MAPPING_STATUS,
  SCALE_MAPPING_STRATEGY,
  V2_SCALE_BOUNDS,
  V5_SCALE_BOUNDS,
} from "../constants/scaleIds.js";

/**
 * @param {unknown} value
 * @param {{ min: number, max: number }} bounds
 */
export function isRatingInScaleBounds(value, bounds) {
  const n = Number(value);
  if (!Number.isFinite(n)) return false;
  return n >= bounds.min && n <= bounds.max;
}

/**
 * Documented alternatives only — never auto-selected as approved equivalence.
 */
export const SCALE_MAPPING_ALTERNATIVES = Object.freeze({
  [SCALE_MAPPING_STRATEGY.LINEAR]: Object.freeze({
    id: SCALE_MAPPING_STRATEGY.LINEAR,
    formula:
      "v5 = 1.5 + (v2 - 1.0) * (6.0 - 1.5) / (8.0 - 1.0) ; inverse: v2 = 1.0 + (v5 - 1.5) * (8.0 - 1.0) / (6.0 - 1.5)",
    rounding: "display round to 0.1 after conversion",
    boundaryBehavior: "clamp to destination bounds after conversion",
    informationLoss: "compresses V2 upper band 6.0–8.0 into V5 ≤6.0",
    tournamentSeedingImpact: "high — top-band seeds compress",
    pairingImpact: "high — strength gaps near top shrink",
    migrationImpact: "reversible only with stored raw + provenance",
    rollbackRisk: "medium — remapped published values need V2 restore",
  }),
  [SCALE_MAPPING_STRATEGY.BOUNDED_PIECEWISE]: Object.freeze({
    id: SCALE_MAPPING_STRATEGY.BOUNDED_PIECEWISE,
    formula:
      "map [1.0–4.0]→[1.5–4.0] linear; [4.0–6.0]→[4.0–5.5]; [6.0–8.0]→[5.5–6.0] compressed",
    rounding: "0.1 after each segment",
    boundaryBehavior: "segment endpoints inclusive; clamp outside",
    informationLoss: "severe above 6.0",
    tournamentSeedingImpact: "medium–high for advanced brackets",
    pairingImpact: "medium — recreational band preserved better",
    migrationImpact: "needs segment table + Owner sign-off",
    rollbackRisk: "medium",
  }),
  [SCALE_MAPPING_STRATEGY.CATEGORY_BAND]: Object.freeze({
    id: SCALE_MAPPING_STRATEGY.CATEGORY_BAND,
    formula:
      "band labels only (beginner/intermediate/advanced/elite); no numeric equivalence",
    rounding: "n/a — categorical",
    boundaryBehavior: "band edges Owner-defined",
    informationLoss: "full numeric precision lost",
    tournamentSeedingImpact: "cannot seed by continuous rating alone",
    pairingImpact: "coarse matching only",
    migrationImpact: "safe for display compare; unsafe for numeric cutover",
    rollbackRisk: "low for compare-only; high if used as published",
  }),
});

/**
 * @param {{
 *   status?: string,
 *   strategy?: string,
 * }} [options]
 */
export function resolveScaleMappingPolicy(options = {}) {
  const status = String(options.status || SCALE_MAPPING_STATUS.UNAPPROVED).toUpperCase();
  const strategy = String(options.strategy || SCALE_MAPPING_STRATEGY.RAW_ONLY).toUpperCase();
  const approved =
    status === SCALE_MAPPING_STATUS.APPROVED &&
    strategy !== SCALE_MAPPING_STRATEGY.RAW_ONLY;

  return Object.freeze({
    status: Object.values(SCALE_MAPPING_STATUS).includes(status)
      ? status
      : SCALE_MAPPING_STATUS.UNAPPROVED,
    strategy: Object.values(SCALE_MAPPING_STRATEGY).includes(strategy)
      ? strategy
      : SCALE_MAPPING_STRATEGY.RAW_ONLY,
    approvedEquivalence: approved === true,
    v2ScaleId: RATING_SCALE_ID.PICK_VN_V2_1_TO_8,
    v5ScaleId: RATING_SCALE_ID.PICK_VN_V5_1_5_TO_6,
    OWNER_APPROVAL_REQUIRED: approved ? "NO" : "YES",
  });
}

/**
 * Raw compare only unless mapping approved. Never invents equivalence when UNAPPROVED.
 * @param {number|null|undefined} v2Raw
 * @param {number|null|undefined} v5Raw
 * @param {ReturnType<typeof resolveScaleMappingPolicy>} policy
 */
export function compareRawRatingPair(v2Raw, v5Raw, policy) {
  const v2 = Number(v2Raw);
  const v5 = Number(v5Raw);
  const bothFinite = Number.isFinite(v2) && Number.isFinite(v5);

  const v2InRange = bothFinite
    ? isRatingInScaleBounds(v2, V2_SCALE_BOUNDS)
    : false;
  const v5InRange = bothFinite
    ? isRatingInScaleBounds(v5, V5_SCALE_BOUNDS)
    : false;

  if (!policy?.approvedEquivalence) {
    return Object.freeze({
      rawExactMatch: bothFinite && v2 === v5,
      normalizedEquivalence: null,
      equivalenceVerdict: "NO_EQUIVALENCE_MAPPING_UNAPPROVED",
      v2Raw: bothFinite ? v2 : null,
      v5Raw: bothFinite ? v5 : null,
      v2InRange,
      v5InRange,
      scaleIds: Object.freeze({
        v2: RATING_SCALE_ID.PICK_VN_V2_1_TO_8,
        v5: RATING_SCALE_ID.PICK_VN_V5_1_5_TO_6,
      }),
      mappingStatus: policy?.status || SCALE_MAPPING_STATUS.UNAPPROVED,
      mappingStrategy: policy?.strategy || SCALE_MAPPING_STRATEGY.RAW_ONLY,
    });
  }

  // Approved path reserved for future Owner GO — still requires explicit strategy impl.
  return Object.freeze({
    rawExactMatch: bothFinite && v2 === v5,
    normalizedEquivalence: null,
    equivalenceVerdict: "APPROVED_STRATEGY_NOT_IMPLEMENTED_IN_CUTOVER_02",
    v2Raw: bothFinite ? v2 : null,
    v5Raw: bothFinite ? v5 : null,
    v2InRange,
    v5InRange,
    scaleIds: Object.freeze({
      v2: RATING_SCALE_ID.PICK_VN_V2_1_TO_8,
      v5: RATING_SCALE_ID.PICK_VN_V5_1_5_TO_6,
    }),
    mappingStatus: policy.status,
    mappingStrategy: policy.strategy,
  });
}
