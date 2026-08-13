/**
 * Internal operator workspace sections — local UI state, not route identity.
 * Canonical version is concurrency metadata, never a React remount key.
 */

import { INTERNAL_LIFECYCLE_STEPS } from "./internalTournamentLifecycleResolver.js";

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
      return INTERNAL_WORKSPACE_SECTIONS.RESULTS;
    default:
      return INTERNAL_WORKSPACE_SECTIONS.BRACKET;
  }
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
