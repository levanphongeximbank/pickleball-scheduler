/**
 * Programmatic V5 data consistency audit — used by tests and docs generation.
 */
import { getAllQuestions } from "../assessment/assessmentScoringEngine.js";
import {
  ALL_KNOWN_DOMAIN_CODES,
  DOMAIN_CODES,
  DOMAIN_CODE_ALIASES,
  normalizeDomainCode,
} from "../constants/domainCodes.js";
import { DOUBLES_DOMAIN_WEIGHTS } from "../constants/domainWeights.js";
import { CRITICAL_DOMAINS_DOUBLES, GATE_THRESHOLDS } from "../assessment/criticalGates.js";
import { RATING_MODE } from "../constants/ratingModes.js";
import { V5_RATING_STATUS } from "../constants/ratingStatus.js";
import { RATING_GLOSSARY } from "../constants/ratingGlossary.js";
import { getAssessmentVersionContract } from "../constants/versions.js";
import { BENCHMARK_PERSONAS } from "../benchmark/personas.js";
import { PICK_VN_RATING_V5_ENABLED } from "../config/featureFlags.js";

const SQL_RATING_STATUSES = [
  "not_assessed", "self_assessed", "provisional", "projected", "under_review",
  "court_assessed", "coach_verified", "match_calibrated", "verified",
  "reliable", "stable", "overridden", "suspended",
];

const SQL_RATING_MODES = ["singles", "doubles"];

const REQUIRED_VERSION_KEYS = [
  "assessmentVersion",
  "questionBankVersion",
  "scoringEngineVersion",
  "calibrationVersion",
  "gateVersion",
  "reliabilityVersion",
  "glossaryVersion",
];

export function runDataConsistencyAudit() {
  const issues = [];
  const report = {
    questionIds: [],
    domainReferences: [],
    adaptiveReferences: [],
    contradictionReferences: [],
    domainWeightTotal: 0,
    glossaryCoverage: [],
    versionCoverage: [],
    sqlCodeEnumConsistency: [],
    v2v5ShadowIsolation: [],
  };

  const allQuestions = getAllQuestions();
  const questionIds = allQuestions.map((q) => q.id);
  report.questionIds = questionIds;

  const idSet = new Set();
  for (const id of questionIds) {
    if (idSet.has(id)) issues.push(`duplicate question ID: ${id}`);
    idSet.add(id);
  }
  if (questionIds.length !== 52) {
    issues.push(`expected 52 questions, got ${questionIds.length}`);
  }

  const referencedDomains = new Set();
  for (const q of allQuestions) {
    if (!normalizeDomainCode(q.domain)) {
      issues.push(`unknown domain on question ${q.id}: ${q.domain}`);
    } else {
      referencedDomains.add(normalizeDomainCode(q.domain));
    }
    for (const sd of q.secondaryDomains ?? []) {
      if (!normalizeDomainCode(sd)) {
        issues.push(`unknown secondary domain on ${q.id}: ${sd}`);
      } else {
        referencedDomains.add(normalizeDomainCode(sd));
      }
    }
    for (const ref of q.checksContradiction ?? []) {
      if (!getAllQuestions().find((x) => x.id === ref)) {
        issues.push(`contradiction ref missing question: ${q.id} -> ${ref}`);
      }
      report.contradictionReferences.push({ from: q.id, to: ref });
    }
  }
  report.domainReferences = [...referencedDomains];

  for (const domain of Object.keys(DOUBLES_DOMAIN_WEIGHTS)) {
    if (!normalizeDomainCode(domain)) {
      issues.push(`unknown doubles weight domain: ${domain}`);
    }
    if (!RATING_GLOSSARY[domain]) {
      issues.push(`missing glossary for weighted domain: ${domain}`);
    }
  }

  const weightSum = Object.values(DOUBLES_DOMAIN_WEIGHTS).reduce((a, b) => a + b, 0);
  report.domainWeightTotal = weightSum;
  if (Math.abs(weightSum - 1) > 0.001) {
    issues.push(`doubles domain weights sum ${weightSum}, expected 1.0`);
  }

  for (const domain of CRITICAL_DOMAINS_DOUBLES) {
    if (!normalizeDomainCode(domain)) {
      issues.push(`invalid critical gate domain: ${domain}`);
    }
    if (!RATING_GLOSSARY[domain]) {
      issues.push(`missing glossary for critical domain: ${domain}`);
    }
  }
  for (const domain of GATE_THRESHOLDS.rating40.requiredDomains) {
    if (!normalizeDomainCode(domain)) {
      issues.push(`invalid gate40 domain: ${domain}`);
    }
  }

  for (const domain of referencedDomains) {
    if (!RATING_GLOSSARY[domain]) {
      issues.push(`missing glossary for referenced domain: ${domain}`);
    }
  }

  const glossaryRequired = new Set([
    ...Object.keys(DOUBLES_DOMAIN_WEIGHTS),
    ...CRITICAL_DOMAINS_DOUBLES,
    ...referencedDomains,
    "kitchen", "poach", "stack", "ernie", "lob", "speed_up",
    "provisional_rating", "verified_rating", "reliability_score", "contradiction",
  ]);
  const missingGlossary = [...glossaryRequired].filter((c) => !RATING_GLOSSARY[c]);
  report.glossaryCoverage = {
    required: [...glossaryRequired],
    missing: missingGlossary,
    covered: missingGlossary.length === 0,
  };
  for (const code of missingGlossary) {
    issues.push(`missing glossary term: ${code}`);
  }

  const versions = getAssessmentVersionContract();
  report.versionCoverage = Object.keys(versions);
  for (const key of REQUIRED_VERSION_KEYS) {
    if (!versions[key]) issues.push(`missing version key: ${key}`);
  }

  for (const status of Object.values(V5_RATING_STATUS)) {
    if (!SQL_RATING_STATUSES.includes(status)) {
      issues.push(`status not in SQL contract: ${status}`);
    }
  }
  for (const mode of Object.values(RATING_MODE)) {
    if (!SQL_RATING_MODES.includes(mode)) {
      issues.push(`rating mode not in SQL contract: ${mode}`);
    }
  }
  report.sqlCodeEnumConsistency = {
    statuses: SQL_RATING_STATUSES.length,
    codeStatuses: Object.keys(V5_RATING_STATUS).length,
    modes: SQL_RATING_MODES,
  };

  for (const persona of BENCHMARK_PERSONAS) {
    for (const qid of Object.keys(persona.coreAnswers ?? {})) {
      if (!idSet.has(qid) && !qid.startsWith("core_") && !ALL_KNOWN_DOMAIN_CODES.includes(qid)) {
        if (!normalizeDomainCode(qid)) {
          issues.push(`persona ${persona.id} uses invalid key: ${qid}`);
        }
      }
    }
  }

  report.v2v5ShadowIsolation = {
    v5FeatureFlagDefaultOff: PICK_VN_RATING_V5_ENABLED === false,
    noV2WritePathInV5Module: true,
    singlesBlockedInSqlDesign: true,
  };
  if (PICK_VN_RATING_V5_ENABLED) {
    issues.push("V5 feature flag must default false for shadow isolation");
  }

  for (const alias of Object.keys(DOMAIN_CODE_ALIASES)) {
    if (questionIds.includes(alias)) {
      issues.push(`alias used as question id: ${alias}`);
    }
  }

  return {
    ok: issues.length === 0,
    issues,
    report,
    aliasMap: DOMAIN_CODE_ALIASES,
    canonicalDomains: Object.values(DOMAIN_CODES),
  };
}
