import { DOMAIN_CODES as SKILL_DOMAINS } from "../constants/domainCodes.js";

import { GATE_VERSION } from "../constants/versions.js";

export const CRITICAL_GATES_VERSION = GATE_VERSION;

export const CRITICAL_DOMAINS_DOUBLES = Object.freeze([
  SKILL_DOMAINS.SERVE,
  SKILL_DOMAINS.RETURN,
  SKILL_DOMAINS.RALLY_CONSISTENCY,
  SKILL_DOMAINS.DINK_SOFT_GAME,
  SKILL_DOMAINS.TRANSITION,
  SKILL_DOMAINS.BLOCK_RESET,
  SKILL_DOMAINS.DOUBLES_POSITIONING,
  SKILL_DOMAINS.ERROR_CONTROL,
]);

export const GATE_THRESHOLDS = Object.freeze({
  rating35: { overall: 3.5, criticalMin: 2.8 },
  rating40: {
    overall: 4.0,
    requiredDomains: [
      SKILL_DOMAINS.DINK_SOFT_GAME,
      SKILL_DOMAINS.TRANSITION,
      SKILL_DOMAINS.BLOCK_RESET,
      SKILL_DOMAINS.DOUBLES_POSITIONING,
      SKILL_DOMAINS.CONSISTENCY,
    ],
    requiredMin: 3.2,
  },
  rating45: { overall: 4.5, provisionalCap: 4.5 },
  rating50: { overall: 5.0, verificationRequired: true },
});

export function applyCriticalGates(ratingBeforeGates, skillVector, options = {}) {
  const gates = [];
  const limitingSkills = [];
  let rating = Number(ratingBeforeGates) || 0;
  const vector = { ...skillVector };
  const hasContradiction = Boolean(options.hasContradiction);
  const hasPressure = Number(vector[SKILL_DOMAINS.PRESSURE_EXECUTION] || 0) >= 4;

  if (rating >= GATE_THRESHOLDS.rating35.overall) {
    for (const domain of CRITICAL_DOMAINS_DOUBLES) {
      const value = Number(vector[domain]);
      if (Number.isFinite(value) && value < GATE_THRESHOLDS.rating35.criticalMin) {
        gates.push({
          id: "gate_35_critical_floor",
          domain,
          threshold: GATE_THRESHOLDS.rating35.criticalMin,
          actual: value,
        });
        limitingSkills.push(domain);
        rating = Math.min(rating, GATE_THRESHOLDS.rating35.overall);
      }
    }
  }

  if (rating >= GATE_THRESHOLDS.rating40.overall) {
    for (const domain of GATE_THRESHOLDS.rating40.requiredDomains) {
      const value = Number(vector[domain]);
      if (Number.isFinite(value) && value < GATE_THRESHOLDS.rating40.requiredMin) {
        gates.push({
          id: "gate_40_domain_required",
          domain,
          threshold: GATE_THRESHOLDS.rating40.requiredMin,
          actual: value,
        });
        limitingSkills.push(domain);
        rating = Math.min(rating, GATE_THRESHOLDS.rating40.overall - 0.1);
      }
    }
    if (hasContradiction) {
      gates.push({ id: "gate_40_contradiction", domain: null });
      rating = Math.min(rating, GATE_THRESHOLDS.rating40.overall - 0.1);
    }
    if (!hasPressure) {
      gates.push({ id: "gate_40_pressure", domain: SKILL_DOMAINS.PRESSURE_EXECUTION });
      rating = Math.min(rating, GATE_THRESHOLDS.rating40.overall);
    }
  }

  let verificationRequired = false;
  let statusOverride = null;

  if (rating >= GATE_THRESHOLDS.rating45.overall) {
    rating = Math.min(rating, GATE_THRESHOLDS.rating45.provisionalCap);
    verificationRequired = true;
    statusOverride = "under_review";
    gates.push({ id: "gate_45_cap", cap: GATE_THRESHOLDS.rating45.provisionalCap });
  }

  if (rating >= GATE_THRESHOLDS.rating50.overall) {
    verificationRequired = true;
    gates.push({ id: "gate_50_verification_required" });
  }

  return {
    ratingBeforeGates,
    ratingAfterGates: rating,
    appliedGates: gates,
    limitingSkills: [...new Set(limitingSkills)],
    verificationRequired,
    statusOverride,
  };
}
