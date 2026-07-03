const ACTIVE_VENUE_KEY = "pickleball-active-venue-v1";

export function loadActiveVenueId() {
  const raw = localStorage.getItem(ACTIVE_VENUE_KEY);
  return raw ? String(raw).trim() : null;
}

export function saveActiveVenueId(venueId) {
  if (!venueId) {
    localStorage.removeItem(ACTIVE_VENUE_KEY);
    return;
  }

  localStorage.setItem(ACTIVE_VENUE_KEY, String(venueId).trim());
}

export function clearActiveVenueId() {
  localStorage.removeItem(ACTIVE_VENUE_KEY);
}
