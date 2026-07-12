import { DOMAIN_CODES } from "./domainCodes.js";
import { GATE_VERSION } from "./versions.js";

export const DERIVED_METRICS_VERSION = GATE_VERSION;

/** type = derived_metric — NOT in doubles domain weights (no double counting). */
export const DERIVED_METRICS = Object.freeze({
  [DOMAIN_CODES.RALLY_CONSISTENCY]: Object.freeze({
    code: DOMAIN_CODES.RALLY_CONSISTENCY,
    type: "derived_metric",
    source_questions: ["core_gs_03", "core_exp_02", "adp_med_rally_01"],
    source_domains: [DOMAIN_CODES.GROUNDSTROKE, DOMAIN_CODES.CONSISTENCY],
    formula: "mean(anchorToSkillMean per question mapped to rally_consistency domain)",
    used_by_gates: true,
    used_by_confidence: false,
    used_by_explanation: true,
    version: DERIVED_METRICS_VERSION,
  }),
  [DOMAIN_CODES.ERROR_CONTROL]: Object.freeze({
    code: DOMAIN_CODES.ERROR_CONTROL,
    type: "derived_metric",
    source_questions: ["core_dink_03", "adp_med_err_01"],
    source_domains: [DOMAIN_CODES.DINK_SOFT_GAME, DOMAIN_CODES.ERROR_CONTROL],
    formula: "mean(anchorToSkillMean per question mapped to error_control domain)",
    used_by_gates: true,
    used_by_confidence: true,
    used_by_explanation: true,
    version: DERIVED_METRICS_VERSION,
  }),
});

export function isDerivedMetric(code) {
  return Boolean(DERIVED_METRICS[code]);
}

export function getDerivedMetricCodes() {
  return Object.keys(DERIVED_METRICS);
}
