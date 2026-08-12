/**
 * Canonical Team Tournament lifecycle + visibility.
 * Reuses existing TOURNAMENT_STATUS. Does not invent a second status taxonomy.
 *
 * DRAFT = saved canonically; not broadly athlete-visible.
 * Draft Dashboard access is ROLE-SCOPED (organizer OR assigned captain/deputy
 * OR assigned referee). Ordinary participants / nonparticipants stay denied.
 * Athlete/public visibility for non-draft starts at registration|ready|active|completed.
 * Server authority: team_tournament_get_dashboard / team_tournament_can_view_dashboard.
 */
import { TOURNAMENT_MODE, TOURNAMENT_STATUS } from "../../../models/tournament/constants.js";

export const TEAM_TOURNAMENT_LIFECYCLE = Object.freeze({
  DRAFT: TOURNAMENT_STATUS.DRAFT,
  REGISTRATION: TOURNAMENT_STATUS.REGISTRATION,
  READY: TOURNAMENT_STATUS.READY,
  ACTIVE: TOURNAMENT_STATUS.ACTIVE,
  COMPLETED: TOURNAMENT_STATUS.COMPLETED,
  CANCELLED: TOURNAMENT_STATUS.CANCELLED,
});

export const ATHLETE_VISIBLE_STATUSES = Object.freeze([
  TOURNAMENT_STATUS.REGISTRATION,
  TOURNAMENT_STATUS.READY,
  TOURNAMENT_STATUS.ACTIVE,
  TOURNAMENT_STATUS.COMPLETED,
]);

export const ORGANIZER_LIST_STATUSES = Object.freeze([
  TOURNAMENT_STATUS.DRAFT,
  TOURNAMENT_STATUS.REGISTRATION,
  TOURNAMENT_STATUS.READY,
  TOURNAMENT_STATUS.ACTIVE,
  TOURNAMENT_STATUS.COMPLETED,
  TOURNAMENT_STATUS.CANCELLED,
]);

export const REGISTRATION_READY_STATUSES = Object.freeze([
  TOURNAMENT_STATUS.DRAFT,
  TOURNAMENT_STATUS.REGISTRATION,
]);

export function normalizeTournamentStatus(status) {
  const value = String(status || "").trim().toLowerCase();
  return Object.values(TOURNAMENT_STATUS).includes(value)
    ? value
    : TOURNAMENT_STATUS.DRAFT;
}

export function isTeamTournamentMode(tournament) {
  return String(tournament?.mode || "") === TOURNAMENT_MODE.TEAM_TOURNAMENT;
}

export function isDraftTournament(tournament) {
  return normalizeTournamentStatus(tournament?.status) === TOURNAMENT_STATUS.DRAFT;
}

export function isAthleteVisibleStatus(status) {
  return ATHLETE_VISIBLE_STATUSES.includes(normalizeTournamentStatus(status));
}

export function isOrganizerVisibleStatus(status) {
  return ORGANIZER_LIST_STATUSES.includes(normalizeTournamentStatus(status));
}

/**
 * Visibility is not mutation authority.
 * Draft: organizer OR draft operational role (captain/deputy/assigned referee).
 * Visible statuses: authenticated same-tenant viewers.
 * Cross-tenant: denied by caller (tenant assert) UNLESS the payload was already
 * authorized by team_tournament_get_dashboard (serverVisibilityAuthorized).
 * Local activeClub/selected-tenant guesses must never override that RPC.
 * hasDraftOperationalRole must come from server capabilities (or local derive
 * after role resolution) — never grant tournament.update to athletes.
 */
export function canViewTournamentDashboard({
  tournament,
  isAuthenticated = false,
  canOrganize = false,
  sameTenant = false,
  serverVisibilityAuthorized = false,
  hasDraftOperationalRole = false,
} = {}) {
  if (!tournament) {
    return { ok: false, code: "NOT_FOUND" };
  }
  if (!isAuthenticated) {
    return { ok: false, code: "NOT_AUTHENTICATED" };
  }
  if (!serverVisibilityAuthorized && !sameTenant) {
    return { ok: false, code: "CROSS_TENANT_DENIED" };
  }
  if (canOrganize) {
    return { ok: true, reason: "organizer" };
  }
  if (isDraftTournament(tournament)) {
    if (hasDraftOperationalRole) {
      return { ok: true, reason: "draft_operational_role" };
    }
    return { ok: false, code: "DRAFT_NOT_VISIBLE" };
  }
  if (!isAthleteVisibleStatus(tournament.status)) {
    return { ok: false, code: "NOT_VISIBLE" };
  }
  return { ok: true, reason: "athlete_visible" };
}

export function resolveOrganizerPrimaryAction(tournament) {
  const status = normalizeTournamentStatus(tournament?.status);
  if (status === TOURNAMENT_STATUS.DRAFT) {
    return { id: "continue_setup", label: "Tiếp tục thiết lập" };
  }
  if (status === TOURNAMENT_STATUS.REGISTRATION) {
    return { id: "manage_registration", label: "Quản lý đăng ký" };
  }
  if (status === TOURNAMENT_STATUS.READY) {
    return { id: "operate", label: "Điều hành giải" };
  }
  if (status === TOURNAMENT_STATUS.ACTIVE) {
    return { id: "enter", label: "Vào giải" };
  }
  if (status === TOURNAMENT_STATUS.COMPLETED) {
    return { id: "view_results", label: "Xem kết quả" };
  }
  return { id: "view", label: "Xem giải" };
}

export function isRegistrationFoundationReady(tournament) {
  return REGISTRATION_READY_STATUSES.includes(normalizeTournamentStatus(tournament?.status));
}

export function resolveTeamDomainId(tournament) {
  return String(
    tournament?.teamDomainId ||
      tournament?.externalKey ||
      (isTeamTournamentMode(tournament) ? tournament?.id : "") ||
      ""
  ).trim();
}

export function resolveCanonicalTournamentId(tournament) {
  return String(tournament?.canonicalId || tournament?.id || "").trim();
}
