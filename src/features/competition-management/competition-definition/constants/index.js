export {
  COMPETITION_TYPE,
  COMPETITION_TYPE_VALUES,
  isCompetitionType,
} from "./competitionTypes.js";

export {
  COMPETITION_SCOPE,
  COMPETITION_SCOPE_VALUES,
  isCompetitionScope,
} from "./competitionScope.js";

export {
  COMPETITION_VISIBILITY,
  COMPETITION_VISIBILITY_VALUES,
  isCompetitionVisibility,
} from "./competitionVisibility.js";

export {
  COMPETITION_DEFINITION_STATUS,
  COMPETITION_DEFINITION_STATUS_VALUES,
  COMPETITION_DEFINITION_EDITABLE_STATUSES,
  isCompetitionDefinitionStatus,
  isDraftEditableStatus,
} from "./competitionStatus.js";

export {
  COMPETITION_DEFINITION_INITIAL_REVISION,
  nextCompetitionDefinitionRevision,
  isValidCompetitionDefinitionRevision,
} from "./revision.js";

export {
  COMPETITION_OWNER_TYPE,
  COMPETITION_OWNER_TYPE_VALUES,
  isCompetitionOwnerType,
} from "./ownerTypes.js";

/** Canonical name length bound (characters after trim). */
export const COMPETITION_DEFINITION_NAME_MAX_LENGTH = 200;

/** Canonical description length bound (characters; empty allowed). */
export const COMPETITION_DEFINITION_DESCRIPTION_MAX_LENGTH = 4000;
