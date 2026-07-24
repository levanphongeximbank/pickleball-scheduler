/**
 * E2E-02 application barrel — CM wiring + instantiation facade.
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
