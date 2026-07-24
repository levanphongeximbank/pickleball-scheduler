/**
 * Competition Management — root barrel (CM-01 + CM-02).
 *
 * Safe re-export only. No runtime wiring.
 * Later CM-03..CM-08 modules may be added here without changing prior ownership.
 */

export {
  COMPETITION_DEFINITION_PHASE,
} from "./competition-definition/index.js";

export * from "./competition-definition/index.js";

export {
  COMPETITION_TEMPLATE_INSTANTIATION_PHASE,
} from "./template-instantiation/index.js";

export * from "./template-instantiation/index.js";
