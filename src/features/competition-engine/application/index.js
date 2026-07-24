/**
 * E2E-02 application barrel — CM wiring + instantiation facade.
 * E2E-03 Organizer Operations live under ../operations/ (re-exported here for discovery).
 */

export {
  ensureIndividualPoolKnockoutTemplateRegistered,
  instantiateIndividualPoolKnockoutTemplate,
  createIndividualPoolKnockoutTemplateDefinition,
} from "./instantiateIndividualPoolKnockout.js";

export {
  createPoolKnockoutRuntimeComposition,
  resolveIndividualPoolKnockoutTemplate,
} from "./createPoolKnockoutRuntimeComposition.js";

export {
  createOrganizerOperationsFacade,
  getOrganizerCompetitionOperationsState,
} from "../operations/createOrganizerOperationsFacade.js";
