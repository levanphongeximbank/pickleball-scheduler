import { createHash } from "node:crypto";
import { CORE_QUESTIONS } from "../assessment/coreQuestions.js";
import { ADAPTIVE_QUESTIONS } from "../assessment/adaptiveQuestionBank.js";
import { RATING_GLOSSARY } from "./ratingGlossary.js";
import { DOUBLES_DOMAIN_WEIGHTS } from "./domainWeights.js";
import { DERIVED_METRICS } from "./derivedMetrics.js";
import { CRITICAL_DOMAINS_DOUBLES, GATE_THRESHOLDS } from "../assessment/criticalGates.js";
import {
  ASSESSMENT_VERSION,
  QUESTION_BANK_VERSION,
  SCORING_ENGINE_VERSION,
  CALIBRATION_VERSION,
  GATE_VERSION,
  RELIABILITY_VERSION,
  GLOSSARY_VERSION,
  V5_VERSION_BUNDLE,
} from "./versions.js";

function stableStringify(value) {
  return JSON.stringify(value, Object.keys(value).sort());
}

function sha256(data) {
  return createHash("sha256").update(data, "utf8").digest("hex");
}

export function computeQuestionBankChecksum() {
  const payload = {
    core: CORE_QUESTIONS.map((q) => ({ id: q.id, domain: q.domain, prompt: q.prompt, anchors: q.anchors })),
    adaptive: ADAPTIVE_QUESTIONS.map((q) => ({ id: q.id, domain: q.domain, prompt: q.prompt, anchors: q.anchors })),
    version: QUESTION_BANK_VERSION,
  };
  return sha256(stableStringify(payload));
}

export function computeGlossaryChecksum() {
  const payload = { version: GLOSSARY_VERSION, entries: RATING_GLOSSARY };
  return sha256(stableStringify(payload));
}

export function computeScoringConfigChecksum() {
  const payload = {
    weights: DOUBLES_DOMAIN_WEIGHTS,
    derivedMetrics: DERIVED_METRICS,
    gates: { critical: CRITICAL_DOMAINS_DOUBLES, thresholds: GATE_THRESHOLDS },
    scoringEngineVersion: SCORING_ENGINE_VERSION,
    gateVersion: GATE_VERSION,
    calibrationVersion: CALIBRATION_VERSION,
  };
  return sha256(stableStringify(payload));
}

export const FROZEN_VERSION_BUNDLE = Object.freeze({
  ...V5_VERSION_BUNDLE,
  questionBankChecksum: computeQuestionBankChecksum(),
  glossaryChecksum: computeGlossaryChecksum(),
  scoringConfigChecksum: computeScoringConfigChecksum(),
});

export function getFrozenVersionContract() {
  return {
    assessmentVersion: ASSESSMENT_VERSION,
    questionBankVersion: QUESTION_BANK_VERSION,
    scoringEngineVersion: SCORING_ENGINE_VERSION,
    calibrationVersion: CALIBRATION_VERSION,
    gateVersion: GATE_VERSION,
    reliabilityVersion: RELIABILITY_VERSION,
    glossaryVersion: GLOSSARY_VERSION,
    questionBankChecksum: computeQuestionBankChecksum(),
    glossaryChecksum: computeGlossaryChecksum(),
    scoringConfigChecksum: computeScoringConfigChecksum(),
  };
}
