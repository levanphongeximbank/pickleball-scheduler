import { normalizeVenue } from "../models/venue.js";

const VENUES_KEY = "pickleball-venues-v1";
const SUBSCRIPTIONS_KEY = "pickleball-subscriptions-v1";

function safeParseArray(raw, fallback = []) {
  if (!raw) {
    return fallback;
  }

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

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

export function loadVenues() {
  return safeParseArray(localStorage.getItem(VENUES_KEY), []).map(normalizeVenue);
}

export function saveVenues(venues) {
  localStorage.setItem(
    VENUES_KEY,
    JSON.stringify((venues || []).map(normalizeVenue))
  );
}

export function loadSubscriptions() {
  return safeParseObject(localStorage.getItem(SUBSCRIPTIONS_KEY), {});
}

export function saveSubscriptions(map) {
  localStorage.setItem(SUBSCRIPTIONS_KEY, JSON.stringify(map || {}));
}
