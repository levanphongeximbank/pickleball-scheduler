/**
 * Strict allowlist for complete-assessment HTTP payload.
 * Canonical contract: snake_case top-level fields only.
 */
export const STRICT_COMPLETE_ASSESSMENT_ALLOWED_FIELDS = Object.freeze([
  "assessment_id",
  "answers",
  "rating_mode",
  "assessment_version",
]);

/** @deprecated use STRICT_COMPLETE_ASSESSMENT_ALLOWED_FIELDS */
export const COMPLETE_ASSESSMENT_ALLOWED_FIELDS = STRICT_COMPLETE_ASSESSMENT_ALLOWED_FIELDS;

/** Legacy alias — allowlist supersedes blocklist */
export const COMPLETE_ASSESSMENT_FORBIDDEN_FIELDS = Object.freeze([]);

export function validateCompleteAssessmentPayload(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return { ok: false, code: "INVALID_PAYLOAD", message: "Payload must be an object." };
  }

  const allowed = new Set(STRICT_COMPLETE_ASSESSMENT_ALLOWED_FIELDS);
  const receivedFields = Object.keys(payload);
  const forbiddenFields = receivedFields.filter((field) => !allowed.has(field));
  if (forbiddenFields.length > 0) {
    return {
      ok: false,
      code: "FORBIDDEN_PAYLOAD_FIELD",
      forbiddenFields,
      message: "Payload chứa trường không được phép.",
    };
  }

  const assessmentId = payload.assessment_id;
  if (!assessmentId || typeof assessmentId !== "string") {
    return { ok: false, code: "MISSING_ASSESSMENT_ID", message: "assessment_id is required." };
  }

  const answers = payload.answers;
  if (!answers || typeof answers !== "object" || Array.isArray(answers)) {
    return { ok: false, code: "INVALID_ANSWERS", message: "answers must be an object." };
  }

  const ratingMode = payload.rating_mode ?? "doubles";
  if (ratingMode !== "doubles" && ratingMode !== "singles") {
    return { ok: false, code: "INVALID_MODE", message: "rating_mode must be singles or doubles." };
  }

  return { ok: true, code: "OK", assessmentId, answers, ratingMode };
}
