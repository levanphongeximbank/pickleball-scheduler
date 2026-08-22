/**
 * Official → canonical Tournament Experience open / compatibility helpers (Wave O1).
 *
 * Keep this module free of imports from experience-a1/routes.js to avoid cycles.
 */

import { TOURNAMENT_MODE, TOURNAMENT_STATUS } from "../../../models/tournament/constants.js";

export const OFFICIAL_LEGACY_EXPERIENCE_QUERY = "legacy";
export const OFFICIAL_EXPERIENCE_QUERY_KEY = "experience";

function withEventQuery(path, eventId = "") {
  const selected = String(eventId || "").trim();
  if (!selected) return path;
  const join = path.includes("?") ? "&" : "?";
  return `${path}${join}eventId=${encodeURIComponent(selected)}`;
}

function officialOverviewPath(tournamentId) {
  const id = String(tournamentId || "").trim();
  return id ? `/tournament/${encodeURIComponent(id)}/overview` : "/tournament";
}

/**
 * Primary Official/Open open path — always canonical Overview.
 * Lifecycle status must not select a legacy setup route.
 *
 * @param {string|{id?: string, status?: string}|null|undefined} tournamentOrId
 * @param {{ eventId?: string, event?: string }} [options]
 */
export function resolveOfficialCanonicalOpenPath(tournamentOrId, options = {}) {
  const id =
    typeof tournamentOrId === "string" || typeof tournamentOrId === "number"
      ? String(tournamentOrId).trim()
      : String(tournamentOrId?.id || "").trim();
  if (!id) return "/tournament";

  // Prove lifecycle does not fork the open path.
  void tournamentOrId?.status;
  void TOURNAMENT_STATUS;

  const eventId = String(options.eventId || options.event || "").trim();
  return withEventQuery(officialOverviewPath(id), eventId);
}

/**
 * Compatibility-only legacy Official setup surface.
 * Requires explicit ?experience=legacy (or call sites that opt in).
 */
export function officialLegacySetupPath(tournamentId, options = {}) {
  const id = String(tournamentId || "").trim();
  if (!id) return "/tournament";
  const params = new URLSearchParams();
  params.set(OFFICIAL_EXPERIENCE_QUERY_KEY, OFFICIAL_LEGACY_EXPERIENCE_QUERY);
  const eventId = String(options.eventId || options.event || "").trim();
  if (eventId) params.set("event", eventId);
  return `/tournament/official/${encodeURIComponent(id)}?${params.toString()}`;
}

export function isOfficialLegacyExperienceRequested(searchParams) {
  const value = String(
    searchParams?.get?.(OFFICIAL_EXPERIENCE_QUERY_KEY) || ""
  )
    .trim()
    .toLowerCase();
  return value === OFFICIAL_LEGACY_EXPERIENCE_QUERY;
}

/**
 * Prepared mapping — not auto-activated when behavior parity is incomplete.
 * Blocker: legacy TournamentBracketPage is live/ops; canonical bracket is projection UX.
 */
export function mapOfficialLegacyBracketToCanonical(tournamentId, options = {}) {
  const id = String(tournamentId || "").trim();
  if (!id) return "/tournament";
  const eventId = String(options.eventId || options.event || "").trim();
  return withEventQuery(`/tournament/${encodeURIComponent(id)}/bracket`, eventId);
}

/**
 * Prepared mapping — not auto-activated when behavior parity is incomplete.
 * Blocker: legacy TournamentDirectorMode remains operator-critical vs canonical Director Ops.
 */
export function mapOfficialLegacyDirectorToCanonical(tournamentId, options = {}) {
  const id = String(tournamentId || "").trim();
  if (!id) return "/tournament";
  const eventId = String(options.eventId || options.event || "").trim();
  return withEventQuery(`/tournament/${encodeURIComponent(id)}/director`, eventId);
}

export const OFFICIAL_LEGACY_ROUTE_ACTIVATION = Object.freeze({
  setupRedirectToOverview: true,
  bracketRedirectToCanonical: false,
  directorRedirectToCanonical: false,
  bracketBlocker:
    "Legacy /tournament/official/:id/bracket uses live TournamentBracketScreen; canonical /bracket is read projection — retain compatibility bridge in O1.",
  directorBlocker:
    "Legacy /tournament/director/:id is full Director Mode; canonical /director is Director Ops projection — retain compatibility bridge in O1.",
});

export function isOfficialTournamentRecord(tournament) {
  return tournament?.mode === TOURNAMENT_MODE.OFFICIAL_TOURNAMENT;
}

/**
 * Engine route family classification (Wave O1 — demote as primary UX, do not delete).
 */
export const ENGINE_ROUTE_CLASSIFICATION = Object.freeze({
  engine: "A", // technical/operator tooling to retain
  seed: "A",
  draw: "C", // legacy UX to retire later (canonical pair-draw / group-draw)
  schedule: "B", // canonical redirect candidate → /tournament/:id/schedule
  courts: "B", // canonical redirect candidate → /tournament/:id/courts
  ranking: "B", // canonical redirect candidate → /tournament/:id/standings
  logs: "A",
});
