import { RELIABILITY_VERSION } from "./versions.js";

export const RELIABILITY_CONFIG_VERSION = RELIABILITY_VERSION;

/** Component weights — must sum to 1.0 */
export const RELIABILITY_WEIGHTS = Object.freeze({
  domainCoverage: 0.20,
  evidenceQuality: 0.30,
  matchVolume: 0.25,
  recency: 0.15,
  consistency: 0.10,
});

export const RELIABILITY_THRESHOLDS = Object.freeze({
  vprRankingEligibility: 70,
  tournamentSeeding: 60,
  stableRating: 85,
  verifiedDisplayMin: 70,
});

export const RELIABILITY_BANDS = Object.freeze([
  { min: 0, max: 29, label: "Rất thấp" },
  { min: 30, max: 49, label: "Thấp" },
  { min: 50, max: 69, label: "Trung bình" },
  { min: 70, max: 84, label: "Cao" },
  { min: 85, max: 100, label: "Rất cao" },
]);

export const VOLUME_SATURATION_MATCHES = 8;
export const RECENCY_HALF_LIFE_DAYS = 180;

export function getReliabilityBandLabel(score) {
  const value = Math.max(0, Math.min(100, Number(score) || 0));
  const band = RELIABILITY_BANDS.find((b) => value >= b.min && value <= b.max);
  return band?.label ?? "Không xác định";
}
