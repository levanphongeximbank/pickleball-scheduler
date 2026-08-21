/**
 * Re-export competition content / match-format projection for Referee UI.
 * Authority remains Adapter B translation + durable event/discipline sources.
 */

export {
  REFEREE_MATCH_FORMAT,
  LOGICAL_COURT_POSITION,
  resolveCompetitionContent,
  resolveRefereeMatchFormat,
  projectCompetitionMatchFormat,
  applySideOutDoublesOpeningPolicy,
  logicalPositionForCourtSlot,
  formatLogicalCourtPositionLabel,
  serviceCourtFromScore,
  oppositeCourtPosition,
} from "../../competition-engine/integration/referee/adapters/shared/competitionContentProjection.js";
