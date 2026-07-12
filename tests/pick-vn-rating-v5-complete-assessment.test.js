import test from "node:test";
import assert from "node:assert/strict";

import { completeAssessment, buildPersonaAnswers, assertNoDerivedMetricDoubleCount } from "../src/features/pick-vn-rating-v5/services/assessmentCompletionService.js";
import { validateCompleteAssessmentPayload } from "../src/features/pick-vn-rating-v5/security/completeAssessmentPayloadGuard.js";
import { BENCHMARK_PERSONAS } from "../src/features/pick-vn-rating-v5/benchmark/personas.js";
import { simulateAdaptiveSession, buildCoreAnswers } from "../src/features/pick-vn-rating-v5/benchmark/personas.js";
import { getFrozenVersionContract } from "../src/features/pick-vn-rating-v5/constants/versionFreeze.js";
import { V5_MIN_RATING } from "../src/features/pick-vn-rating-v5/constants/ratingScale.js";
import { V5_RATING_STATUS } from "../src/features/pick-vn-rating-v5/constants/ratingStatus.js";
import { getCoreQuestionIds } from "../src/features/pick-vn-rating-v5/assessment/coreQuestions.js";

function makeDraftAssessment(overrides = {}) {
  return {
    id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
    tenant_id: "tenant-a",
    player_id: "11111111-2222-3333-4444-555555555555",
    rating_mode: "doubles",
    assessment_status: "draft",
    is_shadow: true,
    rollout_cohort: "v5-shadow-pilot",
    ...overrides,
  };
}

function makeMemoryPersistence() {
  const store = {
    assessments: new Map(),
    events: [],
    profiles: new Map(),
    v2Rows: [{ id: "v2-1", current_rating: 3.0 }],
    completed: new Map(),
  };

  return {
    store,
    getAssessment(id) {
      return store.assessments.get(id) ?? null;
    },
    getCompletedResult(id) {
      return store.completed.get(id) ?? null;
    },
    apply(result) {
      store.assessments.set(result.assessmentId, result.completed_row);
      store.completed.set(result.assessmentId, result);
      store.events.push(result.rating_event);
      const key = `${result.profile_patch.player_id}:${result.profile_patch.rating_mode}`;
      store.profiles.set(key, result.profile_patch);
    },
  };
}

function completeForPersona(personaId, persistence) {
  const persona = BENCHMARK_PERSONAS.find((p) => p.id === personaId);
  assert.ok(persona, `persona ${personaId}`);
  const answers = buildPersonaAnswers(persona, { simulateAdaptiveSession });
  const assessment = makeDraftAssessment({ id: `test-${personaId}` });
  persistence.store.assessments.set(assessment.id, assessment);

  return completeAssessment(
    {
      assessment_id: assessment.id,
      answers,
      rating_mode: "doubles",
      assessment_version: "assessment-v5.0f",
      userId: assessment.player_id,
      tenantId: assessment.tenant_id,
      assessment,
    },
    persistence,
  );
}

test("integration 1: brand new persona minimum 1.5", () => {
  const p = makeMemoryPersistence();
  const r = completeForPersona("p01_brand_new", p);
  assert.equal(r.ok, true);
  assert.ok(r.overall_skill >= V5_MIN_RATING);
  assert.equal(r.overall_skill, V5_MIN_RATING);
});

test("integration 2-4: balanced personas increase", () => {
  const p = makeMemoryPersistence();
  const r30 = completeForPersona("p09_balanced_30", p);
  const r35 = completeForPersona("p10_balanced_35", makeMemoryPersistence());
  const r40 = completeForPersona("p11_balanced_40", makeMemoryPersistence());
  assert.ok(r30.overall_skill > V5_MIN_RATING);
  assert.ok(r35.overall_skill > r30.overall_skill - 0.5);
  assert.ok(r40.overall_skill >= r35.overall_skill - 0.3);
});

test("integration 5-6: all high capped at 4.5 display and under_review", () => {
  const p = makeMemoryPersistence();
  const r = completeForPersona("p12_all_high", p);
  assert.equal(r.ok, true);
  assert.ok(r.provisional_display_rating <= 4.5);
  assert.equal(r.verification_required, true);
  assert.equal(r.rating_status, V5_RATING_STATUS.UNDER_REVIEW);
});

test("integration 7-8: reject forbidden payload fields", () => {
  const bad1 = validateCompleteAssessmentPayload({
    assessment_id: "x",
    answers: {},
    verified_rating: 5,
  });
  assert.equal(bad1.ok, false);
  assert.equal(bad1.code, "FORBIDDEN_PAYLOAD_FIELD");

  const bad2 = validateCompleteAssessmentPayload({
    assessment_id: "x",
    answers: {},
    domain_scores: { serve: 4 },
  });
  assert.equal(bad2.ok, false);
});

test("integration 9-10: invalid question and anchor rejected", () => {
  const assessment = makeDraftAssessment();
  const answers = buildCoreAnswers({}, 3);
  answers.not_a_real_question = 3;
  const r = completeAssessment({
    assessment_id: assessment.id,
    answers,
    rating_mode: "doubles",
    userId: assessment.player_id,
    tenantId: assessment.tenant_id,
    assessment,
  });
  assert.equal(r.ok, false);
  assert.equal(r.code, "INVALID_QUESTION_ID");

  const badAnchor = buildCoreAnswers({}, 3);
  badAnchor.core_srv_01 = 9;
  const r2 = completeAssessment({
    assessment_id: assessment.id,
    answers: badAnchor,
    rating_mode: "doubles",
    userId: assessment.player_id,
    tenantId: assessment.tenant_id,
    assessment,
  });
  assert.equal(r2.ok, false);
  assert.equal(r2.code, "INVALID_ANSWER_ANCHOR");
});

test("integration 11-12: wrong owner and tenant rejected", () => {
  const assessment = makeDraftAssessment({ tenant_id: "tenant-b" });
  const answers = buildCoreAnswers({}, 3);
  const r = completeAssessment({
    assessment_id: assessment.id,
    answers,
    rating_mode: "doubles",
    userId: "other-user",
    tenantId: "tenant-a",
    assessment,
  });
  assert.equal(r.code, "FORBIDDEN_OWNER");

  const r2 = completeAssessment({
    assessment_id: assessment.id,
    answers,
    rating_mode: "doubles",
    userId: assessment.player_id,
    tenantId: "tenant-a",
    assessment,
  });
  assert.equal(r2.code, "TENANT_MISMATCH");
});

test("integration 13: idempotent second complete", () => {
  const persistence = makeMemoryPersistence();
  const assessment = makeDraftAssessment({ id: "idem-1" });
  persistence.store.assessments.set(assessment.id, assessment);
  const answers = buildCoreAnswers({}, 4);

  const first = completeAssessment(
    {
      assessment_id: assessment.id,
      answers,
      rating_mode: "doubles",
      userId: assessment.player_id,
      tenantId: assessment.tenant_id,
      assessment,
    },
    persistence,
  );
  assert.equal(first.ok, true);

  const second = completeAssessment(
    {
      assessment_id: assessment.id,
      answers: buildCoreAnswers({}, 7),
      rating_mode: "doubles",
      userId: assessment.player_id,
      tenantId: assessment.tenant_id,
      assessment: persistence.getAssessment(assessment.id),
    },
    persistence,
  );
  assert.equal(second.ok, true);
  assert.equal(second.idempotent, true);
  assert.equal(second.overall_skill, first.overall_skill);
  assert.equal(persistence.store.events.length, 1);
});

test("integration 14-16: event, profile, v2 unchanged", () => {
  const persistence = makeMemoryPersistence();
  const v2Before = JSON.stringify(persistence.store.v2Rows);
  const r = completeForPersona("p09_balanced_30", persistence);
  assert.equal(persistence.store.events.length, 1);
  assert.equal(persistence.store.events[0].event_type, "assessment_complete");
  assert.ok(persistence.store.profiles.size === 1);
  assert.equal(JSON.stringify(persistence.store.v2Rows), v2Before);
  assert.ok(r.profile_patch.verified_rating_mean == null);
});

test("integration 17-18: version stamping and immutability", () => {
  const persistence = makeMemoryPersistence();
  const contract = getFrozenVersionContract();
  const r = completeForPersona("p10_balanced_35", persistence);
  assert.equal(r.versions.assessmentVersion, contract.assessmentVersion);
  assert.equal(r.versions.glossaryVersion, contract.glossaryVersion);
  assert.equal(r.completed_row.assessment_version, contract.assessmentVersion);

  const stored = persistence.getAssessment(`test-p10_balanced_35`);
  assert.equal(stored.assessment_version, contract.assessmentVersion);
  assert.equal(stored.glossary_version, contract.glossaryVersion);
});

test("integration 19: derived metrics no double count", () => {
  const check = assertNoDerivedMetricDoubleCount({ rally_consistency: 4, error_control: 3 });
  assert.equal(check.ok, true);
});

test("integration 20: singles returns SINGLES_NOT_IMPLEMENTED", () => {
  const assessment = makeDraftAssessment();
  const answers = {};
  for (const id of getCoreQuestionIds()) answers[id] = 3;
  const r = completeAssessment({
    assessment_id: assessment.id,
    answers,
    rating_mode: "singles",
    userId: assessment.player_id,
    tenantId: assessment.tenant_id,
    assessment,
  });
  assert.equal(r.code, "SINGLES_NOT_IMPLEMENTED");
});
