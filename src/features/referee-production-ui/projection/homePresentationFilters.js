/**
 * Presentation-only Home filters (tournament + competition mode).
 * Does not change CORE-13 assignment authority or query scope.
 */

import { formatCompetitionModeLabel } from "./formatRefereeUiLabels.js";

export const HOME_TOURNAMENT_FILTER_ALL = "ALL";
export const HOME_MODE_FILTER_ALL = "ALL";

/**
 * Unique tournament options from already-loaded assignment cards.
 * @param {object[]} assignments
 */
export function buildHomeTournamentOptions(assignments = []) {
  const list = Array.isArray(assignments) ? assignments : [];
  const byId = new Map();
  for (const card of list) {
    const id = String(card?.competitionId || "").trim();
    if (!id) continue;
    const label =
      String(card?.competitionName || "").trim() ||
      `Giải ${id.slice(0, 8)}`;
    if (!byId.has(id)) {
      byId.set(id, Object.freeze({ id, label }));
    }
  }
  return Object.freeze([
    Object.freeze({ id: HOME_TOURNAMENT_FILTER_ALL, label: "Tất cả giải" }),
    ...[...byId.values()].sort((a, b) => a.label.localeCompare(b.label, "vi")),
  ]);
}

/**
 * Unique competition-mode options from already-loaded assignment cards.
 * @param {object[]} assignments
 */
export function buildHomeModeOptions(assignments = []) {
  const list = Array.isArray(assignments) ? assignments : [];
  const byMode = new Map();
  for (const card of list) {
    const mode = String(card?.competitionMode || "").trim().toUpperCase();
    if (!mode) continue;
    if (!byMode.has(mode)) {
      byMode.set(
        mode,
        Object.freeze({
          id: mode,
          label:
            card.competitionModeLabel ||
            formatCompetitionModeLabel(mode) ||
            mode,
        })
      );
    }
  }
  return Object.freeze([
    Object.freeze({ id: HOME_MODE_FILTER_ALL, label: "Tất cả hình thức" }),
    ...[...byMode.values()].sort((a, b) => a.label.localeCompare(b.label, "vi")),
  ]);
}

/**
 * @param {object[]} assignments
 * @param {string} tournamentId
 */
export function filterAssignmentsByTournament(
  assignments = [],
  tournamentId = HOME_TOURNAMENT_FILTER_ALL
) {
  const list = Array.isArray(assignments) ? assignments : [];
  const key = String(tournamentId || HOME_TOURNAMENT_FILTER_ALL).trim();
  if (!key || key === HOME_TOURNAMENT_FILTER_ALL) return list;
  return list.filter((card) => String(card?.competitionId || "").trim() === key);
}

/**
 * @param {object[]} assignments
 * @param {string} mode
 */
export function filterAssignmentsByCompetitionMode(
  assignments = [],
  mode = HOME_MODE_FILTER_ALL
) {
  const list = Array.isArray(assignments) ? assignments : [];
  const key = String(mode || HOME_MODE_FILTER_ALL).trim().toUpperCase();
  if (!key || key === HOME_MODE_FILTER_ALL) return list;
  return list.filter(
    (card) => String(card?.competitionMode || "").trim().toUpperCase() === key
  );
}
