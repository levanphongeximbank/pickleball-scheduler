import { normalizeUser } from "../models/user.js";

const STAFF_KEY = "pickleball-venue-staff-v1";

function safeParseObject(raw, fallback = {}) {
  if (!raw) {
    return fallback;
  }

  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : fallback;
  } catch {
    return fallback;
  }
}

export function loadStaffRegistry() {
  return safeParseObject(localStorage.getItem(STAFF_KEY), {});
}

export function saveStaffRegistry(registry) {
  localStorage.setItem(STAFF_KEY, JSON.stringify(registry || {}));
}

export function loadStaffForVenue(venueId) {
  const registry = loadStaffRegistry();
  const list = registry[venueId];
  return Array.isArray(list) ? list.map(normalizeUser) : [];
}

export function saveStaffForVenue(venueId, staffList) {
  const registry = loadStaffRegistry();
  registry[venueId] = (staffList || []).map(normalizeUser);
  saveStaffRegistry(registry);
}
