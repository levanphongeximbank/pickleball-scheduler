import { CONSTRAINT_MODE, CONSTRAINT_TYPE } from "../constants.js";

const VALID_TYPES = new Set(Object.values(CONSTRAINT_TYPE));
const VALID_MODES = new Set(Object.values(CONSTRAINT_MODE));

export function normalizePairingConstraint(constraint, index = 0) {
  if (!constraint) {
    return null;
  }

  const type = VALID_TYPES.has(constraint.type) ? constraint.type : null;
  if (!type) {
    return null;
  }

  const anchorPlayerId = String(constraint.anchorPlayerId || "").trim();
  if (!anchorPlayerId) {
    return null;
  }

  const targetPlayerIds = Array.isArray(constraint.targetPlayerIds)
    ? constraint.targetPlayerIds.map((id) => String(id).trim()).filter(Boolean)
    : [];

  if (targetPlayerIds.length === 0) {
    return null;
  }

  const mode = VALID_MODES.has(constraint.mode) ? constraint.mode : CONSTRAINT_MODE.SOFT;
  const defaultHard = type !== CONSTRAINT_TYPE.PREFER_PARTNER;

  return {
    id: String(constraint.id || `constraint-${index + 1}-${Date.now()}`),
    type,
    anchorPlayerId,
    targetPlayerIds,
    mode: constraint.mode ? mode : defaultHard ? CONSTRAINT_MODE.HARD : CONSTRAINT_MODE.SOFT,
    enabled: constraint.enabled !== false,
    label: String(constraint.label || "").trim(),
    note: String(constraint.note || "").trim(),
  };
}

export function normalizePairingConstraints(constraints = []) {
  if (!Array.isArray(constraints)) {
    return [];
  }
  return constraints
    .map((item, index) => normalizePairingConstraint(item, index))
    .filter(Boolean);
}

export function createPairingConstraint(options = {}) {
  return normalizePairingConstraint({
    id: options.id || `constraint-${Date.now()}`,
    type: options.type || CONSTRAINT_TYPE.PREFER_PARTNER,
    anchorPlayerId: options.anchorPlayerId,
    targetPlayerIds: options.targetPlayerIds || [],
    mode: options.mode || CONSTRAINT_MODE.SOFT,
    enabled: options.enabled !== false,
    label: options.label || "",
    note: options.note || "",
  });
}
