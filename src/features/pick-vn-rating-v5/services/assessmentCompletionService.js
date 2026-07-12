/**
 * Server-side assessment completion — delegates scoring to trusted server modules.
 * Used by unit/integration tests with in-memory persistence.
 * Production path: Edge Function rating-v5-complete-assessment → persistence RPC.
 */
import { getActiveVersionContract } from "../server/activeVersionContract.js";
import {
  scoreAssessmentForPersistence,
  assertNoDerivedMetricDoubleCount,
} from "../server/scoreAssessmentCompletion.js";

export { assertNoDerivedMetricDoubleCount };

function applyPersistenceResult(persistence, scored) {
  const result = {
    assessmentId: scored.assessmentId,
    ...scored.response,
    rating_event: scored.persistence.rating_event,
    profile_patch: scored.persistence.profile_patch,
    completed_row: {
      ...scored.persistence.completed_row,
      completed_at: new Date().toISOString(),
    },
  };
  persistence.apply?.(result);
  return result;
}

/**
 * Complete assessment in one logical transaction (caller provides persistence hooks).
 */
export function completeAssessment(input, persistence = {}) {
  const userId = input.userId ?? input.user_id;
  const tenantId = input.tenantId ?? input.tenant_id;
  const assessmentId = input.assessment_id ?? input.assessmentId;

  let assessment = input.assessment ?? persistence.getAssessment?.(assessmentId);

  const scored = scoreAssessmentForPersistence({ ...input, userId, tenantId, assessment_id: assessmentId }, assessment);
  if (!scored.ok) return scored;

  if (scored.code === "ALREADY_COMPLETED") {
    const existing = persistence.getCompletedResult?.(assessmentId);
    if (existing) {
      return { ok: true, code: "ALREADY_COMPLETED", idempotent: true, ...existing };
    }
    return { ok: false, code: "ALREADY_COMPLETED", idempotent: true };
  }

  if (scored.code !== "SCORED") return scored;

  const applied = applyPersistenceResult(persistence, scored);
  return { ok: true, code: "COMPLETED", ...applied };
}

export function buildPersonaAnswers(persona, options = {}) {
  const { simulateAdaptiveSession } = options;
  if (!simulateAdaptiveSession) {
    throw new Error("simulateAdaptiveSession required");
  }
  const session = simulateAdaptiveSession(persona.coreAnswers, {
    contradictionDetected: persona.contradictionDetected ?? false,
  });
  return session.answers;
}

/** @deprecated use getActiveVersionContract in server runtime */
export function getFrozenVersionContractForTests() {
  return getActiveVersionContract();
}
