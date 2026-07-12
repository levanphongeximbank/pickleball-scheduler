/** Pick_VN Rating V5 — FROZEN at V5-B.0F (2026-07-12). Do not edit without version bump. */
export const SYSTEM_VERSION = "pick-vn-rating-v5";
export const ASSESSMENT_VERSION = "assessment-v5.0f";
export const QUESTION_BANK_VERSION = "qbank-v5.0f";
export const SCORING_ENGINE_VERSION = "scoring-v5.0f";
export const GATE_VERSION = "gates-v5.0f";
export const MATCH_ENGINE_VERSION = "match-v5.0";
export const RELIABILITY_VERSION = "reliability-v5.0";
export const CALIBRATION_VERSION = "calibration-v5.0f";
export const GLOSSARY_VERSION = "glossary-v5.0f";

/** Full reproducibility contract — persisted on each assessment. */
export const V5_VERSION_BUNDLE = Object.freeze({
  systemVersion: SYSTEM_VERSION,
  assessmentVersion: ASSESSMENT_VERSION,
  questionBankVersion: QUESTION_BANK_VERSION,
  scoringEngineVersion: SCORING_ENGINE_VERSION,
  gateVersion: GATE_VERSION,
  matchEngineVersion: MATCH_ENGINE_VERSION,
  reliabilityVersion: RELIABILITY_VERSION,
  calibrationVersion: CALIBRATION_VERSION,
  glossaryVersion: GLOSSARY_VERSION,
});

export function getAssessmentVersionContract() {
  return { ...V5_VERSION_BUNDLE };
}
