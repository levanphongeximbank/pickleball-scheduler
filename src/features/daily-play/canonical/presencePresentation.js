/**
 * Presentation-only Daily Play presence overrides.
 * Never use these values for match creation, CAS, busy-player, or persistence.
 */

export function resolvePresentedCheckedSet(canonicalIds = [], override = null) {
  const set = new Set((canonicalIds || []).map((id) => String(id)));
  if (!override?.playerId) {
    return set;
  }
  const id = String(override.playerId);
  if (override.checked) {
    set.add(id);
  } else {
    set.delete(id);
  }
  return set;
}

export function beginPresenceOverride(canonicalIds, playerId) {
  const id = String(playerId || "").trim();
  if (!id) {
    return null;
  }
  const currentlyChecked = (canonicalIds || []).map(String).includes(id);
  return {
    playerId: id,
    checked: !currentlyChecked,
  };
}

export function shouldIgnoreConcurrentPresenceClick({
  lockHeld = false,
  bulkPending = null,
  mutating = false,
  override = null,
} = {}) {
  return Boolean(lockHeld || bulkPending || mutating || override);
}

export function reconcilePresenceOverride(override, canonicalIds) {
  if (!override?.playerId) {
    return null;
  }
  const id = String(override.playerId);
  const canonicalHas = (canonicalIds || []).map(String).includes(id);
  if (canonicalHas === Boolean(override.checked)) {
    return null;
  }
  return override;
}

export function rollbackPresenceOverride() {
  return null;
}

export function isPresenceOverrideAuthoritative() {
  return false;
}
