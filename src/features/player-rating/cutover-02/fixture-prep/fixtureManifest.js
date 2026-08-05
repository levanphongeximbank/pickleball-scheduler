/**
 * Fixed Wave-A fixture allowlist — redacted hashes only (no email/name/UUID in docs).
 * Answer recipes deterministically produce the raw V5 display targets via canonical scorer.
 */

import { createHash } from "node:crypto";
import { buildCoreAnswers } from "../../../pick-vn-rating-v5/benchmark/personas.js";
import { scoreAssessment } from "../../../pick-vn-rating-v5/assessment/assessmentScoringEngine.js";
import { toDisplayRating } from "../../../pick-vn-rating-v5/constants/ratingScale.js";
import { APPROVED_ID_HASHES, FIXTURE_MANIFEST_META } from "./fixtureManifestMeta.js";

export { APPROVED_ID_HASHES, FIXTURE_MANIFEST_META };

/**
 * @typedef {{
 *   label: string,
 *   idHash: string,
 *   v2Raw: number,
 *   v5TargetDisplay: number,
 *   answerRecipe: { defaultAnchor: number, domainOverride: string, overrideValue: number },
 *   fixtureDomainEvidence: 'rating.wave1.@staging.local',
 * }} FixtureCandidateSpec
 */

/** @type {readonly FixtureCandidateSpec[]} */
export const FIXTURE_CANDIDATES = Object.freeze([
  Object.freeze({
    label: "CANDIDATE-01",
    idHash: "e97fa28f4a36",
    v2Raw: 2.0,
    v5TargetDisplay: 2.2,
    answerRecipe: Object.freeze({
      defaultAnchor: 1,
      domainOverride: "groundstroke",
      overrideValue: 6,
    }),
    fixtureDomainEvidence: "rating.wave1.@staging.local",
  }),
  Object.freeze({
    label: "CANDIDATE-02",
    idHash: "0b464be6cbba",
    v2Raw: 3.0,
    v5TargetDisplay: 2.8,
    answerRecipe: Object.freeze({
      defaultAnchor: 2,
      domainOverride: "groundstroke",
      overrideValue: 7,
    }),
    fixtureDomainEvidence: "rating.wave1.@staging.local",
  }),
  Object.freeze({
    label: "CANDIDATE-03",
    idHash: "9154af71ee16",
    v2Raw: 3.5,
    v5TargetDisplay: 3.1,
    answerRecipe: Object.freeze({
      defaultAnchor: 3,
      domainOverride: "consistency",
      overrideValue: 0,
    }),
    fixtureDomainEvidence: "rating.wave1.@staging.local",
  }),
  Object.freeze({
    label: "CANDIDATE-04",
    idHash: "d678d828c636",
    v2Raw: 4.0,
    v5TargetDisplay: 3.6,
    answerRecipe: Object.freeze({
      defaultAnchor: 4,
      domainOverride: "groundstroke",
      overrideValue: 0,
    }),
    fixtureDomainEvidence: "rating.wave1.@staging.local",
  }),
  Object.freeze({
    label: "CANDIDATE-05",
    idHash: "3d644a31b486",
    v2Raw: 5.0,
    v5TargetDisplay: 4.2,
    answerRecipe: Object.freeze({
      defaultAnchor: 5,
      domainOverride: "groundstroke",
      overrideValue: 1,
    }),
    fixtureDomainEvidence: "rating.wave1.@staging.local",
  }),
]);

/**
 * MD5 hex — matches PostgreSQL `md5(text)` for uuid::text (lowercase hyphenated).
 * Uses node:crypto (trusted Node / Edge runners only — not a browser secret).
 * @param {string} input
 */
export function md5Hex(input) {
  // Lazy require pattern avoided — static ESM import of node:crypto is fine in unit/Edge Node.
  return createHash("md5").update(String(input), "utf8").digest("hex");
}

export function profileIdHash12(profileId) {
  const raw = String(profileId || "").trim().toLowerCase();
  if (!raw) return null;
  return md5Hex(raw).slice(0, 12);
}

export function getFixtureByHash(idHash) {
  const hash = String(idHash || "").trim().toLowerCase();
  return FIXTURE_CANDIDATES.find((c) => c.idHash === hash) || null;
}

export function getFixtureByLabel(label) {
  const key = String(label || "").trim().toUpperCase();
  return FIXTURE_CANDIDATES.find((c) => c.label === key) || null;
}

export function isApprovedFixtureHash(idHash) {
  return Boolean(getFixtureByHash(idHash));
}

/**
 * Build deterministic core answers for a fixture candidate.
 * @param {FixtureCandidateSpec} fixture
 */
export function buildFixtureAnswers(fixture) {
  const recipe = fixture.answerRecipe;
  return buildCoreAnswers(
    { [recipe.domainOverride]: recipe.overrideValue },
    recipe.defaultAnchor
  );
}

/**
 * Score fixture answers with canonical V5 engine; compare to declared target.
 * @param {FixtureCandidateSpec} fixture
 */
export function scoreFixtureAnswers(fixture) {
  const answers = buildFixtureAnswers(fixture);
  const scored = scoreAssessment(answers, { ratingMode: "doubles" });
  const display = Math.min(toDisplayRating(scored.ratingAfterGates), 4.5);
  const matches =
    Number.isFinite(display) &&
    Math.abs(display - fixture.v5TargetDisplay) < 1e-9;
  return {
    answers,
    scored,
    display,
    expectedDisplay: fixture.v5TargetDisplay,
    matches,
  };
}

export function assertAllFixtureScoresMatchTargets() {
  const mismatches = [];
  for (const fixture of FIXTURE_CANDIDATES) {
    const result = scoreFixtureAnswers(fixture);
    if (!result.matches) {
      mismatches.push({
        label: fixture.label,
        expected: fixture.v5TargetDisplay,
        actual: result.display,
      });
    }
  }
  return { ok: mismatches.length === 0, mismatches };
}
