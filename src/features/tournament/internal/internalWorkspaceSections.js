/**
 * Internal operator workspace sections — local UI state, not route identity.
 * Canonical version is concurrency metadata, never a React remount key.
 */

import { INTERNAL_LIFECYCLE_STEPS } from "./internalTournamentLifecycleResolver.js";
import {
  hasBracketGenerated,
  isGroupStageComplete,
} from "../../../tournament/engines/bracketEngine.js";

export const INTERNAL_WORKSPACE_SECTIONS = Object.freeze({
  SETUP: "setup",
  DRAW: "draw",
  SCHEDULE: "schedule",
  REFEREE: "referee",
  RESULTS: "results",
  BRACKET: "bracket",
});

export const INTERNAL_WORKSPACE_SECTION_LABELS = Object.freeze({
  [INTERNAL_WORKSPACE_SECTIONS.SETUP]: "Thiết lập",
  [INTERNAL_WORKSPACE_SECTIONS.DRAW]: "Bốc thăm",
  [INTERNAL_WORKSPACE_SECTIONS.SCHEDULE]: "Lịch thi đấu",
  [INTERNAL_WORKSPACE_SECTIONS.REFEREE]: "Trọng tài",
  [INTERNAL_WORKSPACE_SECTIONS.RESULTS]: "Kết quả",
  [INTERNAL_WORKSPACE_SECTIONS.BRACKET]: "Bracket",
});

export const INTERNAL_WORKSPACE_SECTION_QUERY = "section";

export function parseInternalWorkspaceSection(raw) {
  const value = String(raw || "").trim().toLowerCase();
  return Object.values(INTERNAL_WORKSPACE_SECTIONS).includes(value) ? value : "";
}

export function mapLifecycleStepToWorkspaceSection(stepId) {
  switch (String(stepId || "")) {
    case INTERNAL_LIFECYCLE_STEPS.SETUP:
    case INTERNAL_LIFECYCLE_STEPS.PARTICIPANTS:
      return INTERNAL_WORKSPACE_SECTIONS.SETUP;
    case INTERNAL_LIFECYCLE_STEPS.DRAW:
      return INTERNAL_WORKSPACE_SECTIONS.DRAW;
    case INTERNAL_LIFECYCLE_STEPS.SCHEDULE:
      return INTERNAL_WORKSPACE_SECTIONS.SCHEDULE;
    case INTERNAL_LIFECYCLE_STEPS.REFEREE:
      return INTERNAL_WORKSPACE_SECTIONS.REFEREE;
    case INTERNAL_LIFECYCLE_STEPS.RESULTS:
    case INTERNAL_LIFECYCLE_STEPS.STANDINGS_OR_KNOCKOUT:
    case INTERNAL_LIFECYCLE_STEPS.AWARDS:
    case INTERNAL_LIFECYCLE_STEPS.COMPLETED:
      return INTERNAL_WORKSPACE_SECTIONS.RESULTS;
    case INTERNAL_LIFECYCLE_STEPS.CHAMPION:
      return INTERNAL_WORKSPACE_SECTIONS.BRACKET;
    default:
      return INTERNAL_WORKSPACE_SECTIONS.SETUP;
  }
}

export function isInternalBracketDefaultAllowed({ lifecycle, event } = {}) {
  if (lifecycle?.oneGroup || lifecycle?.skipKnockout) {
    return false;
  }
  if (hasBracketGenerated(event)) {
    return true;
  }
  return Boolean(event && isGroupStageComplete(event));
}

export function resolveLifecycleDefaultWorkspaceSection({ lifecycle, event } = {}) {
  const step = String(lifecycle?.CURRENT_STEP || "");
  if (
    step === INTERNAL_LIFECYCLE_STEPS.STANDINGS_OR_KNOCKOUT &&
    isInternalBracketDefaultAllowed({ lifecycle, event })
  ) {
    return INTERNAL_WORKSPACE_SECTIONS.BRACKET;
  }
  if (step === INTERNAL_LIFECYCLE_STEPS.CHAMPION) {
    return isInternalBracketDefaultAllowed({ lifecycle, event })
      ? INTERNAL_WORKSPACE_SECTIONS.BRACKET
      : INTERNAL_WORKSPACE_SECTIONS.RESULTS;
  }
  return mapLifecycleStepToWorkspaceSection(step);
}

export function isInternalWorkspaceSectionAvailable(section, { lifecycle, event } = {}) {
  const parsed = parseInternalWorkspaceSection(section);
  if (!parsed) return false;
  if (parsed !== INTERNAL_WORKSPACE_SECTIONS.BRACKET) return true;
  return isInternalBracketDefaultAllowed({ lifecycle, event });
}

/**
 * F5 / fresh mount: URL section if valid and available, else lifecycle-safe default.
 * Never defaults to an unavailable downstream section (e.g. Bracket during group results).
 */
export function resolveInternalWorkspaceSection({
  requestedSection = "",
  lifecycle = null,
  event = null,
} = {}) {
  const fallback = resolveLifecycleDefaultWorkspaceSection({ lifecycle, event });
  const requested = parseInternalWorkspaceSection(requestedSection);
  if (!requested) {
    return {
      section: fallback,
      source: String(requestedSection || "").trim() ? "invalid-url" : "lifecycle",
    };
  }
  if (!isInternalWorkspaceSectionAvailable(requested, { lifecycle, event })) {
    return { section: fallback, source: "unavailable-fallback" };
  }
  return { section: requested, source: "url" };
}

export function resolveInternalWorkspaceKey(tournament) {
  return String(tournament?.id || "internal-workspace");
}

export function resolveCanonicalLoadPresentation({ hasTournament } = {}) {
  if (hasTournament) {
    return { initialLoading: false, backgroundRefresh: true };
  }
  return { initialLoading: true, backgroundRefresh: false };
}

/**
 * Tab-return / club-scope flicker must not blank a loaded Internal workspace.
 */
export function resolveCanonicalScopeGapPolicy({
  hasTournament = false,
  tournamentId = "",
} = {}) {
  if (hasTournament && String(tournamentId || "").trim()) {
    return {
      keepRenderedTournament: true,
      clearTournament: false,
      initialLoading: false,
      backgroundRefresh: false,
    };
  }
  return {
    keepRenderedTournament: false,
    clearTournament: true,
    initialLoading: Boolean(String(tournamentId || "").trim()),
    backgroundRefresh: false,
  };
}

/**
 * Hard identity change (different tournament / club / tenant) must drop the
 * last row. A transient empty club/tenant during tab-return refresh must not.
 */
export function resolveCanonicalIdentityChangePolicy({
  previousClubId = "",
  nextClubId = "",
  previousTenantId = "",
  nextTenantId = "",
  previousTournamentId = "",
  nextTournamentId = "",
} = {}) {
  const prevTournament = String(previousTournamentId || "").trim();
  const nextTournament = String(nextTournamentId || "").trim();
  if (prevTournament && nextTournament && prevTournament !== nextTournament) {
    return { clearTournament: true, reason: "tournament-id" };
  }

  const prevClub = String(previousClubId || "").trim();
  const nextClub = String(nextClubId || "").trim();
  const prevTenant = String(previousTenantId || "").trim();
  const nextTenant = String(nextTenantId || "").trim();

  if (prevClub && !nextClub) {
    return { clearTournament: false, reason: "club-scope-gap" };
  }
  if (prevClub && nextClub && prevClub !== nextClub) {
    return { clearTournament: true, reason: "club-id" };
  }
  if (prevTenant && nextTenant && prevTenant !== nextTenant) {
    return { clearTournament: true, reason: "tenant-id" };
  }
  return { clearTournament: false, reason: "stable" };
}

export function resolveInternalPageLoadingGate({
  clubScopeOk = false,
  tournamentLoading = false,
  tournament = null,
} = {}) {
  if (tournament) {
    return { showFullPageLoading: false, keepWorkspace: true, reason: "has-tournament" };
  }
  if (!clubScopeOk) {
    return { showFullPageLoading: true, keepWorkspace: false, reason: "club-not-ready" };
  }
  if (tournamentLoading) {
    return { showFullPageLoading: true, keepWorkspace: false, reason: "initial-load" };
  }
  return { showFullPageLoading: false, keepWorkspace: false, reason: "not-found" };
}

export function resolveTournamentManageGatePresentation({
  tournamentId = "",
  loading = false,
  tournament = null,
  activeClubId = "",
} = {}) {
  if (!String(tournamentId || "").trim()) {
    return { showFullPageLoading: false, keepChildren: true, assertAccess: false };
  }
  if (tournament) {
    const clubId = String(activeClubId || "").trim();
    return {
      showFullPageLoading: false,
      keepChildren: !clubId,
      assertAccess: Boolean(clubId),
    };
  }
  if (loading) {
    return { showFullPageLoading: true, keepChildren: false, assertAccess: false };
  }
  return { showFullPageLoading: false, keepChildren: false, assertAccess: true };
}
