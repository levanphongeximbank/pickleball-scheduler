import { ASSESSMENT_VERSION } from "../constants/versions.js";
import { RATING_MODE } from "../constants/ratingModes.js";
import { validateCompleteAssessmentPayload } from "../security/completeAssessmentPayloadGuard.js";

export const RATING_V5_EDGE_FUNCTION = "rating-v5-complete-assessment";

export function buildCompleteAssessmentPayload({ assessmentId, answers, ratingMode = RATING_MODE.DOUBLES }) {
  const payload = {
    assessment_id: assessmentId,
    answers,
    rating_mode: ratingMode,
    assessment_version: ASSESSMENT_VERSION,
  };
  const check = validateCompleteAssessmentPayload(payload);
  if (!check.ok) {
    return check;
  }
  return { ok: true, payload };
}

export function ratingV5EdgeUrl(edgeBaseUrl) {
  return `${edgeBaseUrl}/functions/v1/${RATING_V5_EDGE_FUNCTION}`;
}

export async function completeRatingV5Assessment({
  accessToken,
  edgeBaseUrl,
  assessmentId,
  answers,
  ratingMode = RATING_MODE.DOUBLES,
}) {
  if (!accessToken) {
    return { ok: false, code: "UNAUTHORIZED" };
  }
  if (!edgeBaseUrl) {
    return { ok: false, code: "NETWORK_ERROR", error: "Edge Function URL chưa cấu hình." };
  }

  const built = buildCompleteAssessmentPayload({ assessmentId, answers, ratingMode });
  if (!built.ok) {
    return built;
  }

  let response;
  try {
    response = await fetch(ratingV5EdgeUrl(edgeBaseUrl), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(built.payload),
    });
  } catch {
    return { ok: false, code: "NETWORK_ERROR" };
  }

  const body = await response.json().catch(() => ({
    ok: false,
    error: { code: "NETWORK_ERROR" },
  }));

  if (!response.ok) {
    const code = body?.error?.code ?? body?.code ?? "PERSISTENCE_FAILED";
    return { ok: false, code, error: body?.error, httpStatus: response.status, requestId: body?.request_id };
  }

  return { ...body, httpStatus: response.status };
}
