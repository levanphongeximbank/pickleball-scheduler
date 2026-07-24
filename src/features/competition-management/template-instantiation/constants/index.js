export {
  COMPETITION_TEMPLATE_SCOPE,
  COMPETITION_TEMPLATE_SCOPE_VALUES,
  isCompetitionTemplateScope,
} from "./templateScope.js";

export {
  COMPETITION_TEMPLATE_AVAILABILITY,
  COMPETITION_TEMPLATE_AVAILABILITY_VALUES,
  isCompetitionTemplateAvailability,
  isTemplateSelectable,
} from "./templateAvailability.js";

export {
  COMPETITION_TEMPLATE_PARTICIPANT_MODE,
  COMPETITION_TEMPLATE_PARTICIPANT_MODE_VALUES,
  isCompetitionTemplateParticipantMode,
} from "./participantMode.js";

export {
  COMPETITION_TEMPLATE_OWNERSHIP_TARGET,
  COMPETITION_TEMPLATE_OWNERSHIP_TARGET_VALUES,
  isCompetitionTemplateOwnershipTarget,
} from "./ownershipTargets.js";

export {
  COMPETITION_TEMPLATE_COMPATIBILITY_STATUS,
  COMPETITION_TEMPLATE_ISSUE_SEVERITY,
  COMPETITION_TEMPLATE_INSTANTIATION_STATUS,
} from "./compatibility.js";

/** Canonical template name length bound. */
export const COMPETITION_TEMPLATE_NAME_MAX_LENGTH = 200;

/** Canonical template description length bound. */
export const COMPETITION_TEMPLATE_DESCRIPTION_MAX_LENGTH = 4000;

/** Initial template version baseline (integer >= 1). */
export const COMPETITION_TEMPLATE_INITIAL_VERSION = 1;
