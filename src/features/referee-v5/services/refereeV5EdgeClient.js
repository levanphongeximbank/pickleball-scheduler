import { REFEREE_V5_ERROR } from "../persistence/errors.js";

export const REFEREE_V5_EDGE_FUNCTION = "referee-v5-match";

export const REFEREE_V5_ACTIONS = Object.freeze({
  GET_STATE: "get-state",
  APPLY_COMMAND: "apply-command",
  FINALIZE: "finalize",
});

function edgeUrl(edgeBaseUrl) {
  return `${edgeBaseUrl}/functions/v1/${REFEREE_V5_EDGE_FUNCTION}`;
}

async function postEdge({ accessToken, edgeBaseUrl, body }) {
  if (!accessToken) {
    return { ok: false, code: REFEREE_V5_ERROR.TENANT_ACCESS_DENIED };
  }
  if (!edgeBaseUrl) {
    return {
      ok: false,
      code: REFEREE_V5_ERROR.VALIDATION_FAILED,
      error: "Edge Function URL chưa cấu hình.",
    };
  }

  const response = await fetch(edgeUrl(edgeBaseUrl), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const payload = await response.json().catch(() => ({
    ok: false,
    code: REFEREE_V5_ERROR.VALIDATION_FAILED,
    error: "Invalid JSON response",
  }));

  return { ...payload, httpStatus: response.status };
}

export async function refereeV5EdgeGetState({
  accessToken,
  tournamentId,
  matchId,
  edgeBaseUrl = "",
}) {
  return postEdge({
    accessToken,
    edgeBaseUrl,
    body: { action: REFEREE_V5_ACTIONS.GET_STATE, tournamentId, matchId },
  });
}

export async function refereeV5EdgeApplyCommand({
  accessToken,
  tournamentId,
  matchId,
  commandType,
  payload = {},
  expectedVersion,
  expectedSequence,
  clientMutationId,
  idempotencyKey,
  edgeBaseUrl = "",
}) {
  return postEdge({
    accessToken,
    edgeBaseUrl,
    body: {
      action: REFEREE_V5_ACTIONS.APPLY_COMMAND,
      tournamentId,
      matchId,
      commandType,
      payload,
      expectedVersion,
      expectedSequence,
      clientMutationId,
      idempotencyKey,
    },
  });
}

export async function refereeV5EdgeFinalize({
  accessToken,
  tournamentId,
  matchId,
  expectedVersion,
  idempotencyKey,
  overrideReason = null,
  isOverride = false,
  forceComplete = false,
  edgeBaseUrl = "",
}) {
  return postEdge({
    accessToken,
    edgeBaseUrl,
    body: {
      action: REFEREE_V5_ACTIONS.FINALIZE,
      tournamentId,
      matchId,
      expectedVersion,
      idempotencyKey,
      overrideReason,
      isOverride,
      forceComplete,
    },
  });
}

export { edgeUrl as refereeV5EdgeUrl };
