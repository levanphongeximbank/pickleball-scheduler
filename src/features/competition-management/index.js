/**
 * Competition Management — root barrel (CM-01 only in this workstream).
 *
 * Safe re-export of competition-definition. No runtime wiring.
 * Later CM-02..CM-08 modules may be added here without changing CM-01 ownership.
 */

export {
  COMPETITION_DEFINITION_PHASE,
} from "./competition-definition/index.js";

export * from "./competition-definition/index.js";
