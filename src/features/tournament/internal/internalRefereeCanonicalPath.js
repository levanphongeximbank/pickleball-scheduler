/**
 * Authenticated Internal referee path (IT-E2E-BROWSER-017).
 * Reuses Team's /referee/match/:matchId session shape without Team MLP semantics.
 * Public /referee/:token remains compatibility-only.
 */
export const INTERNAL_REFEREE_CANONICAL_MODE = "internal";

export function buildInternalRefereeCanonicalHref({
  tournamentId,
  matchId,
  clubId,
} = {}) {
  const id = String(matchId || "").trim();
  const tournament = String(tournamentId || "").trim();
  if (!id || !tournament) return "";
  const params = new URLSearchParams({
    tournamentId: tournament,
    mode: INTERNAL_REFEREE_CANONICAL_MODE,
  });
  const club = String(clubId || "").trim();
  if (club) params.set("clubId", club);
  return `/referee/match/${encodeURIComponent(id)}?${params.toString()}`;
}

export function buildInternalRefereePortalHref({
  tournamentId,
  matchId,
  clubId,
} = {}) {
  const tournament = String(tournamentId || "").trim();
  if (!tournament) return "";
  const params = new URLSearchParams();
  const club = String(clubId || "").trim();
  if (club) params.set("clubId", club);
  const match = String(matchId || "").trim();
  if (match) params.set("match", match);
  const query = params.toString();
  return `/tournament/internal/${encodeURIComponent(tournament)}/referee${
    query ? `?${query}` : ""
  }`;
}

export function buildInternalRefereeLegacyTokenHref(token) {
  const trimmed = String(token || "").trim();
  if (trimmed.length < 16) return "";
  return `/referee/${encodeURIComponent(trimmed)}`;
}

export function isInternalRefereePortalPath(pathname) {
  return /^\/tournament\/internal\/[^/]+\/referee\/?$/.test(String(pathname || ""));
}

export function isInternalRefereeCanonicalRequest({
  searchParams,
  locationState,
} = {}) {
  const mode = String(
    searchParams?.get?.("mode") || locationState?.mode || ""
  ).trim();
  return mode === INTERNAL_REFEREE_CANONICAL_MODE;
}
