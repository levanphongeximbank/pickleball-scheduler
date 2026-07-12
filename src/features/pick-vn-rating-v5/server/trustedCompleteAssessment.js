import { assertTrustedRuntime } from "./trustedRuntimeMarker.js";
import { scoreAssessmentForPersistence } from "./scoreAssessmentCompletion.js";

function isServiceRoleClient(client) {
  return Boolean(client?.__ratingV5ServiceRole);
}

/**
 * Trusted completion orchestrator — Edge Function and Node staging runners only.
 * Scores with full V5 engine, persists via service_role RPC.
 */
export async function trustedCompleteAssessment(input, deps = {}) {
  assertTrustedRuntime("trustedCompleteAssessment");

  const {
    supabaseUser,
    supabaseService,
    fetchAssessment,
    invokePersist = defaultPersist,
  } = deps;

  if (!supabaseUser || !supabaseService) {
    return { ok: false, code: "TRUSTED_RUNTIME_MISCONFIGURED" };
  }
  if (!isServiceRoleClient(supabaseService)) {
    return { ok: false, code: "SERVICE_ROLE_REQUIRED" };
  }

  const userId = input.userId ?? input.user_id ?? (await supabaseUser.auth.getUser()).data.user?.id;
  const tenantId = input.tenantId ?? input.tenant_id;
  const assessmentId = input.assessment_id ?? input.assessmentId;

  let assessment = input.assessment;
  if (!assessment && fetchAssessment) {
    assessment = await fetchAssessment(assessmentId, { supabaseUser, userId, tenantId });
  }

  const scored = scoreAssessmentForPersistence(
    { ...input, userId, tenantId, assessment_id: assessmentId },
    assessment,
  );

  if (!scored.ok) return scored;
  if (scored.code === "ALREADY_COMPLETED") {
    return { ok: true, idempotent: true, ...scored.response, code: "ALREADY_COMPLETED" };
  }
  if (scored.code !== "SCORED") return scored;

  const persistResult = await invokePersist({
    supabaseService,
    assessmentId,
    payload: scored.persistence,
    testFault: input.__test_fault ?? input.testFault ?? null,
  });

  if (!persistResult.ok) return persistResult;

  return {
    ok: true,
    code: persistResult.code ?? "COMPLETED",
    idempotent: persistResult.idempotent ?? false,
    ...scored.response,
    ...persistResult,
  };
}

async function defaultPersist({ supabaseService, assessmentId, payload, testFault }) {
  const { data, error } = await supabaseService.rpc("rating_v5_service_persist_assessment_completion", {
    p_assessment_id: assessmentId,
    p_payload: payload,
    p_test_fault: testFault,
  });

  if (error) {
    return { ok: false, code: "PERSISTENCE_RPC_ERROR", message: error.message, details: error };
  }
  if (!data?.ok) {
    return { ok: false, ...(typeof data === "object" ? data : { code: "PERSISTENCE_FAILED" }) };
  }
  return data;
}

export function markServiceRoleClient(client) {
  Object.defineProperty(client, "__ratingV5ServiceRole", { value: true, enumerable: false });
  return client;
}
