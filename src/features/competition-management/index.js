/**
 * Competition Management — root barrel (CM-01 + CM-02 + CM-03 + CM-04).
 *
 * Safe re-export only. No runtime wiring.
 * Later CM-05..CM-08 modules may be added here without changing prior ownership.
 */

export {
  COMPETITION_DEFINITION_PHASE,
} from "./competition-definition/index.js";

export * from "./competition-definition/index.js";

export {
  COMPETITION_TEMPLATE_INSTANTIATION_PHASE,
} from "./template-instantiation/index.js";

export * from "./template-instantiation/index.js";

export {
  COMPETITION_VERSIONING_PHASE,
} from "./competition-versioning/index.js";

export * from "./competition-versioning/index.js";

export {
  COMPETITION_CONFIGURATION_PHASE,
} from "./competition-configuration/index.js";

export * from "./competition-configuration/index.js";
