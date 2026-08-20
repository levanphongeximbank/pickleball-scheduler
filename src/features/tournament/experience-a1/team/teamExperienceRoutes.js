/**
 * Canonical Team Tournament Experience routes (Wave T1).
 * Family: /tournaments/:tournamentId/*
 * Engine tabs (draw/schedule/courts/…) stay on TournamentEnginePage — do not collide.
 */
import { TOURNAMENT_MODE, TOURNAMENT_STATUS } from "../../../../models/tournament/constants.js";
import {
  isTeamTournament,
  teamTournamentPath,
  TEAM_TAB_QUERY,
} from "../../../../config/tournamentRoutes.js";

/** Adopted this wave — safe to open from list / center. */
export const TEAM_EXPERIENCE_ADOPTED_SCREENS = Object.freeze({
  overview: "overview",
});

/** Future IA slots — not mounted as fake screens. */
export const TEAM_EXPERIENCE_SCREEN_KEYS = Object.freeze([
  "overview",
  "settings",
  "participants",
  "formation",
  "draw",
  "groups",
  "schedule",
  "matches",
  "standings",
  "knockout",
  "bracket",
  "director",
  "courts",
  "referees",
  "exceptions",
  "communications",
  "media",
  "awards",
  "complete",
]);

export const TEAM_EXPERIENCE_CONTEXT_MODE = TOURNAMENT_MODE.TEAM_TOURNAMENT;

function encodeId(tournamentId) {
  return encodeURIComponent(String(tournamentId || "").trim());
}

export function teamOverviewPath(tournamentId) {
  const id = String(tournamentId || "").trim();
  return id ? `/tournaments/${encodeId(id)}/overview` : "/tournament";
}

export function teamExperiencePath(tournamentId, screen = "overview") {
  const id = String(tournamentId || "").trim();
  if (!id) return "/tournament";
  const key = String(screen || "overview").trim() || "overview";
  if (key === "overview") return teamOverviewPath(id);
  return `/tournaments/${encodeId(id)}/${encodeURIComponent(key)}`;
}

/**
 * Open path for Team Tournament — status-agnostic (no DRAFT/ACTIVE split).
 */
export function resolveTeamExperienceOpenPath(tournament) {
  const id = String(tournament?.teamDomainId || tournament?.id || "").trim();
  if (!id) return "/tournament";
  if (tournament && !isTeamTournament(tournament) && tournament.mode) {
    return "/tournament";
  }
  return teamOverviewPath(id);
}

/**
 * Compatibility map: legacy ?tab= → canonical screen intent.
 * Wave T1/T2: only overview is adopted; other tabs stay on legacy setup.
 */
export const TEAM_LEGACY_TAB_COMPAT = Object.freeze({
  [TEAM_TAB_QUERY.format]: {
    canonicalScreen: "settings",
    adopted: false,
    legacyFallback: TEAM_TAB_QUERY.format,
  },
  [TEAM_TAB_QUERY.teams]: {
    canonicalScreen: "participants",
    adopted: false,
    legacyFallback: TEAM_TAB_QUERY.teams,
  },
  [TEAM_TAB_QUERY.disciplines]: {
    canonicalScreen: "settings",
    adopted: false,
    legacyFallback: TEAM_TAB_QUERY.disciplines,
  },
  [TEAM_TAB_QUERY.matchups]: {
    canonicalScreen: "schedule",
    adopted: false,
    legacyFallback: TEAM_TAB_QUERY.matchups,
  },
  [TEAM_TAB_QUERY.standings]: {
    canonicalScreen: "standings",
    adopted: false,
    legacyFallback: TEAM_TAB_QUERY.standings,
  },
  [TEAM_TAB_QUERY.awards]: {
    canonicalScreen: "awards",
    adopted: false,
    legacyFallback: TEAM_TAB_QUERY.awards,
  },
  [TEAM_TAB_QUERY.diagram]: {
    canonicalScreen: "bracket",
    adopted: false,
    legacyFallback: TEAM_TAB_QUERY.diagram,
  },
});

/**
 * Resolve legacy Team setup URL for a tab. Never loops into incomplete canonical pages.
 */
export function resolveTeamLegacyCompatPath(tournamentId, tab) {
  const id = String(tournamentId || "").trim();
  if (!id) return "/tournament";
  const normalized = String(tab || "").trim() || TEAM_TAB_QUERY.teams;
  const entry = TEAM_LEGACY_TAB_COMPAT[normalized];
  if (entry?.adopted) {
    return teamExperiencePath(id, entry.canonicalScreen);
  }
  return teamTournamentPath(id, entry?.legacyFallback || normalized);
}

/**
 * Safe redirect target from legacy Team URL. Only overview is auto-canonical this wave.
 * Unknown / non-adopted tabs → stay on legacy (caller should not Navigate).
 */
export function resolveSafeTeamLegacyRedirect({ tournamentId, tab } = {}) {
  const id = String(tournamentId || "").trim();
  if (!id) return null;
  const normalized = String(tab || "").trim();
  if (!normalized) {
    return null;
  }
  const entry = TEAM_LEGACY_TAB_COMPAT[normalized];
  if (entry?.adopted) {
    return teamExperiencePath(id, entry.canonicalScreen);
  }
  return null;
}

export function buildTeamExperienceContext({
  tournamentId,
  tenantId = null,
  clubId = null,
  eventId = null,
  disciplineId = null,
} = {}) {
  return Object.freeze({
    tournamentId: String(tournamentId || "").trim() || null,
    tenantId: tenantId != null ? String(tenantId).trim() || null : null,
    clubId: clubId != null ? String(clubId).trim() || null : null,
    mode: TEAM_EXPERIENCE_CONTEXT_MODE,
    /** Event = nội dung / discipline — never a second Tournament. */
    selectedEventId:
      String(eventId || disciplineId || "").trim() || null,
  });
}

export function isTeamDraftStatus(status) {
  return String(status || "").trim().toLowerCase() === TOURNAMENT_STATUS.DRAFT;
}
