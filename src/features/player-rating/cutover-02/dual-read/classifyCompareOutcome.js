/**
 * Classify dual-read compare outcomes. Does not mutate ratings.
 */

import { DUAL_READ_COMPARE_OUTCOME } from "../constants/compareOutcomes.js";
import { V2_SCALE_BOUNDS, V5_SCALE_BOUNDS } from "../constants/scaleIds.js";
import { isRatingInScaleBounds } from "./scaleMapping.js";

/**
 * @param {{
 *   v2?: {
 *     present?: boolean,
 *     rating?: number|null,
 *     error?: string|null,
 *     tenantId?: string|null,
 *     playerId?: string|null,
 *     updatedAt?: string|null,
 *     stale?: boolean,
 *   }|null,
 *   v5?: {
 *     present?: boolean,
 *     rating?: number|null,
 *     error?: string|null,
 *     tenantId?: string|null,
 *     playerId?: string|null,
 *     updatedAt?: string|null,
 *     stale?: boolean,
 *     invalidated?: boolean,
 *     isShadow?: boolean,
 *   }|null,
 *   expectedTenantId?: string|null,
 *   expectedPlayerId?: string|null,
 *   mappingApproved?: boolean,
 * }} input
 * @returns {{ primary: string, secondary: string[], notes: string[] }}
 */
export function classifyDualReadCompareOutcome(input = {}) {
  const v2 = input.v2 && typeof input.v2 === "object" ? input.v2 : {};
  const v5 = input.v5 && typeof input.v5 === "object" ? input.v5 : {};
  /** @type {string[]} */
  const secondary = [];
  /** @type {string[]} */
  const notes = [];

  if (v2.error) {
    return {
      primary: DUAL_READ_COMPARE_OUTCOME.READ_ERROR_V2,
      secondary,
      notes: ["V2_READ_FAILED_NO_V5_PROMOTION", String(v2.error)],
    };
  }
  if (v5.error) {
    secondary.push(DUAL_READ_COMPARE_OUTCOME.READ_ERROR_V5);
  }

  const v2Present = v2.present === true && v2.rating != null && Number.isFinite(Number(v2.rating));
  const v5Present = v5.present === true && v5.rating != null && Number.isFinite(Number(v5.rating));

  if (v5.invalidated === true) {
    return {
      primary: DUAL_READ_COMPARE_OUTCOME.V5_INVALIDATED,
      secondary: v2Present ? [DUAL_READ_COMPARE_OUTCOME.V2_PRESENT_V5_PRESENT] : secondary,
      notes: ["V5_PROFILE_INVALIDATED"],
    };
  }

  const expectedTenant = input.expectedTenantId != null ? String(input.expectedTenantId) : null;
  const expectedPlayer = input.expectedPlayerId != null ? String(input.expectedPlayerId) : null;

  const tenantMismatch =
    (expectedTenant &&
      ((v2.tenantId != null && String(v2.tenantId) !== expectedTenant) ||
        (v5.tenantId != null && String(v5.tenantId) !== expectedTenant))) ||
    (v2.tenantId != null &&
      v5.tenantId != null &&
      String(v2.tenantId) !== String(v5.tenantId));

  const identityMismatch =
    (expectedPlayer &&
      ((v2.playerId != null && String(v2.playerId) !== expectedPlayer) ||
        (v5.playerId != null && String(v5.playerId) !== expectedPlayer))) ||
    (v2.playerId != null &&
      v5.playerId != null &&
      String(v2.playerId) !== String(v5.playerId));

  if (tenantMismatch || identityMismatch) {
    return {
      primary: DUAL_READ_COMPARE_OUTCOME.TENANT_OR_IDENTITY_MISMATCH,
      secondary,
      notes: [
        tenantMismatch ? "TENANT_MISMATCH" : null,
        identityMismatch ? "IDENTITY_MISMATCH" : null,
      ].filter(Boolean),
    };
  }

  if (v2Present && !isRatingInScaleBounds(v2.rating, V2_SCALE_BOUNDS)) {
    return {
      primary: DUAL_READ_COMPARE_OUTCOME.VALUE_OUT_OF_RANGE,
      secondary: [DUAL_READ_COMPARE_OUTCOME.V2_PRESENT_V5_PRESENT],
      notes: ["V2_OUT_OF_RANGE"],
    };
  }
  if (v5Present && !isRatingInScaleBounds(v5.rating, V5_SCALE_BOUNDS)) {
    return {
      primary: DUAL_READ_COMPARE_OUTCOME.VALUE_OUT_OF_RANGE,
      secondary: [
        v2Present
          ? DUAL_READ_COMPARE_OUTCOME.V2_PRESENT_V5_PRESENT
          : DUAL_READ_COMPARE_OUTCOME.V2_MISSING_V5_PRESENT,
      ],
      notes: ["V5_OUT_OF_RANGE"],
    };
  }

  if (v2.stale === true && v2Present) {
    secondary.push(DUAL_READ_COMPARE_OUTCOME.STALE_V2);
  }
  if (v5.stale === true && v5Present) {
    secondary.push(DUAL_READ_COMPARE_OUTCOME.STALE_V5);
  }

  let primary;
  if (v2Present && v5Present) {
    primary = DUAL_READ_COMPARE_OUTCOME.V2_PRESENT_V5_PRESENT;
    if (input.mappingApproved !== true) {
      secondary.push(DUAL_READ_COMPARE_OUTCOME.SCALE_MAPPING_UNAPPROVED);
      notes.push("NO_EQUIVALENCE_MAPPING_UNAPPROVED");
    }
  } else if (v2Present && !v5Present) {
    primary = v5.error
      ? DUAL_READ_COMPARE_OUTCOME.READ_ERROR_V5
      : DUAL_READ_COMPARE_OUTCOME.V2_PRESENT_V5_MISSING;
  } else if (!v2Present && v5Present) {
    primary = DUAL_READ_COMPARE_OUTCOME.V2_MISSING_V5_PRESENT;
  } else if (v5.error) {
    primary = DUAL_READ_COMPARE_OUTCOME.READ_ERROR_V5;
  } else {
    primary = DUAL_READ_COMPARE_OUTCOME.BOTH_MISSING;
  }

  if (secondary.includes(DUAL_READ_COMPARE_OUTCOME.STALE_V2) && primary === DUAL_READ_COMPARE_OUTCOME.V2_PRESENT_V5_PRESENT) {
    // Prefer stale as primary when explicitly marked and both present.
    return {
      primary: DUAL_READ_COMPARE_OUTCOME.STALE_V2,
      secondary: [primary, ...secondary.filter((c) => c !== DUAL_READ_COMPARE_OUTCOME.STALE_V2)],
      notes,
    };
  }
  if (secondary.includes(DUAL_READ_COMPARE_OUTCOME.STALE_V5) && primary === DUAL_READ_COMPARE_OUTCOME.V2_PRESENT_V5_PRESENT) {
    return {
      primary: DUAL_READ_COMPARE_OUTCOME.STALE_V5,
      secondary: [primary, ...secondary.filter((c) => c !== DUAL_READ_COMPARE_OUTCOME.STALE_V5)],
      notes,
    };
  }

  return { primary, secondary, notes };
}
