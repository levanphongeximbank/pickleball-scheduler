/**
 * Core-02 shadow compatibility adapters (read-map / fail-closed).
 * Deep-import this module — do not rely on competition-core mega-barrel.
 */

export { inferCompetitionEntryType } from "./inferEntryType.js";

export {
  mapLegacyIndividualStatusToEntryStatus,
  mapLegacyIndividualEntryToCompetitionEntry,
} from "./mapLegacyIndividualEntry.js";

export { mapTeamTournamentTeamToOptionalEntry } from "./mapTeamTournamentTeamToEntry.js";

export {
  mapDailyPlayPlayerWithoutEntry,
  assertDailyPlayMapsWithoutEntries,
} from "./mapDailyPlayNoEntry.js";

export {
  mapPlayerProfileToParticipantReference,
  mapClubScopeToEntryTenantScope,
} from "./mapPlayerClubRead.js";
