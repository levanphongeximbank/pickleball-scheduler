/**
 * Wave 3 — user-scoped active venue preference (SAFE_PREFERENCE_HINT).
 * Not venue master-data authority. Not interchangeable with tenant preference.
 */

const ACTIVE_VENUE_KEY = "pickleball-active-venue-v1";

function normalizeUserId(userId) {
  const id = String(userId || "").trim();
  return id || null;
}

function readRecord() {
  const raw = localStorage.getItem(ACTIVE_VENUE_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      const venueId = String(parsed.venueId || "").trim();
      if (!venueId) {
        return null;
      }
      return {
        venueId,
        userId: normalizeUserId(parsed.userId),
        tenantId: String(parsed.tenantId || "").trim() || null,
      };
    }
  } catch {
    // Legacy plain string — fail closed across users.
  }

  return null;
}

/**
 * @param {string|null|undefined} userId
 * @returns {string|null}
 */
export function loadActiveVenueId(userId) {
  const record = readRecord();
  if (!record?.venueId) {
    return null;
  }
  const expectedUserId = normalizeUserId(userId);
  if (expectedUserId && record.userId && record.userId !== expectedUserId) {
    return null;
  }
  if (expectedUserId && !record.userId) {
    // Unscoped legacy/object without user — do not restore.
    return null;
  }
  return record.venueId;
}

/**
 * @param {string|null|undefined} venueId
 * @param {string|null|undefined} userId
 * @param {{ tenantId?: string|null }} [meta]
 */
export function saveActiveVenueId(venueId, userId, meta = {}) {
  const id = String(venueId || "").trim();
  const uid = normalizeUserId(userId);
  if (!id || !uid) {
    localStorage.removeItem(ACTIVE_VENUE_KEY);
    return;
  }
  localStorage.setItem(
    ACTIVE_VENUE_KEY,
    JSON.stringify({
      venueId: id,
      userId: uid,
      tenantId: String(meta.tenantId || "").trim() || null,
    })
  );
}

export function clearActiveVenueId() {
  localStorage.removeItem(ACTIVE_VENUE_KEY);
}
