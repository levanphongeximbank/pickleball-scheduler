/**
 * Shared Vite env read for Court Operations Staging cutover controls.
 * Defaults remain OFF. Production stays OFF unless env is explicitly set.
 */
export function readCourtCanonicalViteFlag(key, envSource) {
  const source =
    envSource ||
    (typeof import.meta !== "undefined" ? import.meta.env : {});
  const raw = source?.[key];
  return raw === true || raw === "true" || raw === "1";
}

export const COURT_CANONICAL_VITE_FLAGS = Object.freeze({
  RESERVATION_CUTOVER: "VITE_CANONICAL_RESERVATION_CUTOVER",
  BOOKING_LIFECYCLE: "VITE_CANONICAL_BOOKING_LIFECYCLE",
  RESOURCE_BLOCKS: "VITE_CANONICAL_RESOURCE_BLOCKS",
  COMPETITION_COURT_ADAPTERS: "VITE_CANONICAL_COMPETITION_COURT_ADAPTERS",
  COURT_LIVE_RUNTIME: "VITE_CANONICAL_COURT_LIVE_RUNTIME",
});
