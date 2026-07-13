/**
 * Edge Function HTTP entry — bundled for Supabase Deno runtime.
 */
import { assertTrustedRuntime } from "./trustedRuntimeMarker.js";
import { scoreAssessmentForPersistence } from "./scoreAssessmentCompletion.js";
import { validateCompleteAssessmentPayload } from "../security/completeAssessmentPayloadGuard.js";
import {
  buildCorsHeaders,
  buildErrorResponse,
  buildSuccessResponse,
  createRequestId,
  isStagingFaultInjectionEnabled,
  logEdgeRequest,
  mapHttpStatus,
  normalizeErrorCode,
  sanitizeErrorMessage,
  STAGING_FAULT_HEADER,
} from "./edgeHttpHelpers.js";
import { resolveRatingV5CorsAllowlistFromEnv } from "../config/ratingV5EdgeCorsConfig.js";

export async function handleCompleteAssessmentHttpRequest(request, env = {}) {
  assertTrustedRuntime("edgeHttp");
  const started = Date.now();
  const requestId = createRequestId();
  const origin = request.headers.get("Origin") ?? "";
  const allowedOrigins = resolveRatingV5CorsAllowlistFromEnv(env);
  const { headers: corsHeaders, allowed: corsAllowed } = buildCorsHeaders(origin, allowedOrigins);

  const finish = (payload, status, meta = {}) => {
    logEdgeRequest({
      request_id: requestId,
      assessment_id: meta.assessment_id,
      authenticated_user_id: meta.user_id,
      tenant_id: meta.tenant_id,
      engine_version: meta.engine_version,
      result_status: meta.result_status ?? String(status),
      duration_ms: Date.now() - started,
      answer_count: meta.answer_count,
    });
    return jsonResponse(payload, status, corsHeaders);
  };

  if (request.method === "OPTIONS") {
    if (!corsAllowed && origin) {
      return finish(buildErrorResponse("FORBIDDEN", requestId), 403);
    }
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return finish(buildErrorResponse("METHOD_NOT_ALLOWED", requestId), 405);
  }

  if (!corsAllowed && origin) {
    return finish(buildErrorResponse("FORBIDDEN", requestId), 403);
  }

  const authHeader = request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return finish(buildErrorResponse("UNAUTHORIZED", requestId), 401);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return finish(buildErrorResponse("INVALID_JSON", requestId), 400);
  }

  const payloadCheck = validateCompleteAssessmentPayload(body);
  if (!payloadCheck.ok) {
    const code = normalizeErrorCode(payloadCheck.code);
    return finish(
      buildErrorResponse(code, requestId, {
        fields: payloadCheck.forbiddenFields,
      }),
      mapHttpStatus(code),
      { result_status: code },
    );
  }

  const { assessmentId, answers, ratingMode } = payloadCheck;

  const { createSupabaseClients, resolveTenantId, fetchAssessmentRow, supabaseUrl } = env;
  if (!createSupabaseClients) {
    return finish(buildErrorResponse("EDGE_MISCONFIGURED", requestId), 500);
  }

  const clients = createSupabaseClients(authHeader);
  const userResult = await clients.user.auth.getUser();
  const user = userResult.data?.user;
  if (!user) {
    return finish(buildErrorResponse("UNAUTHORIZED", requestId), 401, { user_id: null });
  }

  const tenantId = await resolveTenantId(clients.user, user.id);
  if (!tenantId) {
    return finish(buildErrorResponse("TENANT_UNRESOLVED", requestId), 403, { user_id: user.id });
  }

  const assessment = await fetchAssessmentRow(clients.user, assessmentId);
  const scored = scoreAssessmentForPersistence(
    {
      assessment_id: assessmentId,
      answers,
      rating_mode: ratingMode,
      assessment_version: body.assessment_version,
      userId: user.id,
      tenantId,
    },
    assessment,
  );

  const answerCount = Object.keys(answers).length;
  const baseMeta = {
    assessment_id: assessmentId,
    user_id: user.id,
    tenant_id: tenantId,
    answer_count: answerCount,
  };

  if (!scored.ok) {
    const code = normalizeErrorCode(scored.code);
    const status = mapHttpStatus(code);
    return finish(buildErrorResponse(code, requestId, { code: scored.code }), status, {
      ...baseMeta,
      result_status: code,
    });
  }

  if (scored.code === "ALREADY_COMPLETED") {
    return finish(
      buildSuccessResponse(
        {
          code: "ASSESSMENT_ALREADY_COMPLETED",
          idempotent: true,
          ...scored.response,
        },
        requestId,
      ),
      200,
      { ...baseMeta, result_status: "ASSESSMENT_ALREADY_COMPLETED" },
    );
  }

  const stagingFaultHeader = request.headers.get(STAGING_FAULT_HEADER);
  if (stagingFaultHeader === "after_scoring" && isStagingFaultInjectionEnabled(supabaseUrl)) {
    return finish(buildErrorResponse("PERSISTENCE_FAILED", requestId), 500, {
      ...baseMeta,
      result_status: "STAGING_FAULT_AFTER_SCORING",
    });
  }

  const sqlFault =
    isStagingFaultInjectionEnabled(supabaseUrl) && stagingFaultHeader
      ? stagingFaultHeader
      : null;

  const { data, error } = await clients.service.rpc("rating_v5_service_persist_assessment_completion", {
    p_assessment_id: assessmentId,
    p_payload: scored.persistence,
    p_test_fault: sqlFault,
  });

  if (error) {
    const code = normalizeErrorCode(error.message?.includes("test_fault") ? "PERSISTENCE_FAILED" : "PERSISTENCE_FAILED");
    return finish(
      buildErrorResponse(code, requestId, { message: sanitizeErrorMessage(error.message) }),
      mapHttpStatus(code),
      { ...baseMeta, result_status: code },
    );
  }

  if (!data?.ok) {
    const code = normalizeErrorCode(data?.code ?? "PERSISTENCE_FAILED");
    return finish(
      buildErrorResponse(code, requestId),
      mapHttpStatus(code),
      { ...baseMeta, result_status: code },
    );
  }

  return finish(
    buildSuccessResponse(
      {
        code: data.code === "ALREADY_COMPLETED" ? "ASSESSMENT_ALREADY_COMPLETED" : "COMPLETED",
        idempotent: data.idempotent ?? false,
        ...scored.response,
        profileId: data.profileId ?? data.profile_id,
        shadow: true,
      },
      requestId,
    ),
    200,
    { ...baseMeta, result_status: "COMPLETED" },
  );
}

function jsonResponse(payload, status, corsHeaders) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
