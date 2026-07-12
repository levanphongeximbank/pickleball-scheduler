import {
  RECENCY_HALF_LIFE_DAYS,
  RELIABILITY_WEIGHTS,
  VOLUME_SATURATION_MATCHES,
} from "../constants/reliabilityConfig.js";
import { EVIDENCE_LEVEL } from "../constants/evidenceLevels.js";
import { RELIABILITY_VERSION } from "../constants/versions.js";

function saturateVolume(count) {
  const n = Math.max(0, Number(count) || 0);
  return 1 - Math.exp(-n / VOLUME_SATURATION_MATCHES);
}

function recencyComponent(daysSinceLastVerified) {
  const days = Math.max(0, Number(daysSinceLastVerified) || 9999);
  return Math.exp(-days / RECENCY_HALF_LIFE_DAYS);
}

function evidenceQualityComponent({
  verifiedMatchCount = 0,
  openMatchCount = 0,
  assessmentCount = 0,
  maxEvidenceLevel = EVIDENCE_LEVEL.NONE,
}) {
  const verified = Math.max(0, Number(verifiedMatchCount) || 0);
  const open = Math.max(0, Number(openMatchCount) || 0);
  const assessments = Math.max(0, Number(assessmentCount) || 0);
  const levelBoost = Math.min(1, Number(maxEvidenceLevel) / EVIDENCE_LEVEL.PICK_VN_VERIFIED);
  const volume = verified * 3 + open + assessments * 0.5;
  return Math.min(1, (volume / 20) * 0.7 + levelBoost * 0.3);
}

/**
 * V5 reliability — rating and reliability are independent dimensions.
 * Pilot calibration will tune coefficients via rating_calibration_versions.
 */
export function computeReliabilityScore(input = {}) {
  const domainCoverage = Math.max(0, Math.min(1, Number(input.domainCoverage) || 0));
  const consistency = Math.max(0, Math.min(1, Number(input.consistency) || 0));

  const volume = saturateVolume(input.verifiedMatchCount);
  const recency = recencyComponent(input.daysSinceLastVerifiedMatch);
  const evidence = evidenceQualityComponent(input);

  const raw =
    RELIABILITY_WEIGHTS.domainCoverage * domainCoverage
    + RELIABILITY_WEIGHTS.evidenceQuality * evidence
    + RELIABILITY_WEIGHTS.matchVolume * volume
    + RELIABILITY_WEIGHTS.recency * recency
    + RELIABILITY_WEIGHTS.consistency * consistency;

  return {
    reliabilityScore: Math.round(raw * 100),
    components: {
      domainCoverage: Math.round(domainCoverage * 100),
      evidenceQuality: Math.round(evidence * 100),
      matchVolume: Math.round(volume * 100),
      recency: Math.round(recency * 100),
      consistency: Math.round(consistency * 100),
    },
    engineVersion: RELIABILITY_VERSION,
  };
}
