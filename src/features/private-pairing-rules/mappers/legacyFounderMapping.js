import { COMPETITION_CONSTRAINT_TYPE } from "../../competition-core/constants/constraintType.js";
import { CONSTRAINT_SEVERITY } from "../../competition-core/constants/constraintSeverity.js";
import { PRIVATE_PAIRING_CONSTRAINT_TYPE } from "../constants/constraintTypes.js";
import { RELATION_MODE, RULE_PRIORITY, RULE_VISIBILITY, REASON_CATEGORY } from "../constants/enums.js";
import { PRIVATE_PAIRING_SCOPE } from "../constants/scopes.js";

/**
 * Legacy founder / AI policy → canonical private pairing type.
 * Intentionally separate from Competition Core LEGACY_CONSTRAINT_TYPE_ALIASES
 * (which maps avoid_same_group → same_club_separation for regulatory draw).
 */
export const LEGACY_TO_PRIVATE_PAIRING_TYPE = Object.freeze({
  prefer_partner: PRIVATE_PAIRING_CONSTRAINT_TYPE.PREFER_PARTNER,
  avoid_partner: PRIVATE_PAIRING_CONSTRAINT_TYPE.AVOID_PARTNER,
  avoid_same_group: PRIVATE_PAIRING_CONSTRAINT_TYPE.DIFFERENT_GROUP,
  prefer_teammate: PRIVATE_PAIRING_CONSTRAINT_TYPE.PREFER_PARTNER,
  avoid_teammate: PRIVATE_PAIRING_CONSTRAINT_TYPE.AVOID_PARTNER,
  must_partner: PRIVATE_PAIRING_CONSTRAINT_TYPE.MUST_PARTNER,
  must_not_partner: PRIVATE_PAIRING_CONSTRAINT_TYPE.MUST_NOT_PARTNER,
});

/**
 * @param {string} legacyType
 * @param {'hard'|'soft'|string} [mode]
 * @returns {{ constraintType: string, severity: string }}
 */
export function mapLegacyTypeAndMode(legacyType, mode) {
  const raw = String(legacyType || "").trim();
  const normalizedMode = mode === CONSTRAINT_SEVERITY.HARD ? CONSTRAINT_SEVERITY.HARD : CONSTRAINT_SEVERITY.SOFT;

  let constraintType = LEGACY_TO_PRIVATE_PAIRING_TYPE[raw] || null;

  if (!constraintType && Object.values(COMPETITION_CONSTRAINT_TYPE).includes(raw)) {
    constraintType = raw;
  }

  if (!constraintType) {
    return { constraintType: null, severity: normalizedMode };
  }

  // Hard prefer_partner / soft defaults → promote hard prefer to MUST for migration fidelity.
  if (
    constraintType === PRIVATE_PAIRING_CONSTRAINT_TYPE.PREFER_PARTNER &&
    normalizedMode === CONSTRAINT_SEVERITY.HARD
  ) {
    return {
      constraintType: PRIVATE_PAIRING_CONSTRAINT_TYPE.MUST_PARTNER,
      severity: CONSTRAINT_SEVERITY.HARD,
    };
  }

  if (
    constraintType === PRIVATE_PAIRING_CONSTRAINT_TYPE.AVOID_PARTNER &&
    normalizedMode === CONSTRAINT_SEVERITY.HARD
  ) {
    return {
      constraintType: PRIVATE_PAIRING_CONSTRAINT_TYPE.MUST_NOT_PARTNER,
      severity: CONSTRAINT_SEVERITY.HARD,
    };
  }

  return { constraintType, severity: normalizedMode };
}

/**
 * @param {Record<string, unknown>} legacy
 * @param {Partial<{ ruleSetId: string, ruleSetVersion: string, scopeType: string, scopeId: string|null }>} [meta]
 * @returns {import('./normalizePrivatePairingRule.js').PrivatePairingRule|null}
 */
export function mapLegacyFounderConstraint(legacy, meta = {}) {
  if (!legacy) {
    return null;
  }

  const { constraintType, severity } = mapLegacyTypeAndMode(legacy.type, legacy.mode);
  if (!constraintType) {
    return null;
  }

  const primaryPlayerId = String(
    legacy.anchorPlayerId || legacy.primaryPlayerId || legacy.playerA || ""
  ).trim();
  const targetPlayerIds = Array.isArray(legacy.targetPlayerIds)
    ? legacy.targetPlayerIds.map(String)
    : legacy.playerB
      ? [String(legacy.playerB)]
      : [];

  return {
    id: String(legacy.id || `legacy-${Date.now()}`),
    ruleSetId: meta.ruleSetId || "legacy-founder-migrated",
    ruleSetVersion: meta.ruleSetVersion || "1",
    constraintType,
    severity,
    weight: severity === CONSTRAINT_SEVERITY.SOFT ? Number(legacy.weight) || 70 : null,
    priority: RULE_PRIORITY.MEDIUM,
    primaryPlayerId,
    targetPlayerIds,
    relationMode: RELATION_MODE.ANY_OF,
    scopeType: meta.scopeType || PRIVATE_PAIRING_SCOPE.CLUB,
    scopeId: meta.scopeId ?? null,
    startAt: legacy.startAt || null,
    endAt: legacy.endAt || null,
    visibility: RULE_VISIBILITY.PRIVATE,
    reasonCategory: REASON_CATEGORY.OTHER,
    reasonText: String(legacy.note || legacy.label || "migrated_from_founder_pairing_constraints"),
    active: legacy.enabled !== false && legacy.active !== false,
    metadata: {
      source: "founderPairingConstraints",
      legacyType: legacy.type,
      legacyMode: legacy.mode,
    },
  };
}
