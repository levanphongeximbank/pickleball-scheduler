/**
 * Minimal Public Competition Experience view-model for portal wiring.
 * Presentation-only — no commands, no publication bypass.
 */

import { PUBLIC_AVAILABILITY } from "../../operations/public/constants.js";

/**
 * @param {object} experienceProjection
 * @returns {ReadonlyArray<{ id: string, title: string, available: boolean, detail: string }>}
 */
export function buildPublicCompetitionExperienceSections(experienceProjection) {
  const p =
    experienceProjection && typeof experienceProjection === "object"
      ? experienceProjection
      : {};
  const overview = p.overview || {};
  const participants = p.participants || {};
  const schedule = p.schedule || {};
  const pools = p.pools || {};
  const standings = p.standings || {};
  const qualification = p.qualification || {};
  const bracket = p.bracket || {};
  const matchCenter = p.matchCenter || {};
  const finalResults = p.finalResults || {};
  const archive = p.archive || {};

  return Object.freeze([
    Object.freeze({
      id: "overview",
      title: "Overview",
      available: overview.available === true,
      detail: String(
        overview.availability ||
          overview.reasonCode ||
          PUBLIC_AVAILABILITY.UNAVAILABLE
      ),
    }),
    Object.freeze({
      id: "participants",
      title: "Participants / Divisions",
      available: participants.available === true,
      detail: `count=${participants.count ?? 0}`,
    }),
    Object.freeze({
      id: "schedule",
      title: "Schedule",
      available: schedule.available === true,
      detail: `matches=${schedule.matches?.length ?? 0}`,
    }),
    Object.freeze({
      id: "pools",
      title: "Pools",
      available: pools.available === true,
      detail: `groups=${pools.groups?.length ?? 0}`,
    }),
    Object.freeze({
      id: "standings",
      title: "Standings",
      available: standings.available === true,
      detail: standings.unresolvedTie
        ? "unresolved-tie"
        : `rows=${standings.rows?.length ?? 0}`,
    }),
    Object.freeze({
      id: "qualification",
      title: "Qualification",
      available: qualification.available === true,
      detail: qualification.unresolvedTie
        ? "unresolved-tie"
        : `qualifiers=${qualification.qualifiers?.length ?? 0}`,
    }),
    Object.freeze({
      id: "bracket",
      title: "Bracket",
      available: bracket.available === true,
      detail: `slots=${bracket.slots?.length ?? 0}`,
    }),
    Object.freeze({
      id: "match-center",
      title: "Match Center",
      available: matchCenter.available === true,
      detail: `matches=${matchCenter.matches?.length ?? 0}`,
    }),
    Object.freeze({
      id: "final-results",
      title: "Final Results",
      available: finalResults.available === true,
      detail: `ranking=${finalResults.ranking?.length ?? 0}`,
    }),
    Object.freeze({
      id: "archive",
      title: "Archive",
      available: archive.available === true,
      detail: String(archive.status || archive.reasonCode || "NOT_ARCHIVED"),
    }),
  ]);
}
