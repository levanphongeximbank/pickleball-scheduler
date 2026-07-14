import { resolveServeDirection } from "../selectors/serveContextSelector.js";
import { RefereeV5EdgeCommandHandler } from "../persistence/RefereeV5EdgeCommandHandler.js";
import { RefereeV5SupabaseRepository } from "../persistence/RefereeV5SupabaseRepository.js";
import { RefereeV5RpcAtomicCommitService } from "../persistence/RefereeV5RpcAtomicCommitService.js";
import { deserializeMatchState } from "../persistence/matchStateSerializer.js";
import { REFEREE_V5_ERROR, REFEREE_V5_ERROR_VI } from "../persistence/errors.js";

export const REFEREE_V5_INTERNAL_RPC = Object.freeze({
  COMMIT_TRANSITION: "referee_v5_commit_match_transition",
  COMMIT_FINALIZATION: "referee_v5_commit_match_finalization",
  GET_STATE: "referee_v5_get_match_state",
});

export async function verifyBearerToken(supabaseUserClient) {
  const { data, error } = await supabaseUserClient.auth.getUser();
  if (error || !data?.user?.id) {
    return { ok: false, code: "TENANT_ACCESS_DENIED", error: "Invalid or expired token." };
  }
  return { ok: true, userId: data.user.id };
}

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function mapHttpStatus(code) {
  switch (code) {
    case REFEREE_V5_ERROR.TENANT_ACCESS_DENIED:
      return 401;
    case REFEREE_V5_ERROR.REFEREE_NOT_ASSIGNED:
    case REFEREE_V5_ERROR.ASSIGNMENT_REVOKED:
    case REFEREE_V5_ERROR.ASSIGNMENT_EXPIRED:
      return 403;
    case REFEREE_V5_ERROR.MATCH_STATE_CONFLICT:
    case REFEREE_V5_ERROR.EVENT_SEQUENCE_CONFLICT:
    case REFEREE_V5_ERROR.IDEMPOTENCY_KEY_REUSE_MISMATCH:
    case REFEREE_V5_ERROR.MATCH_LOCKED:
      return 409;
    case REFEREE_V5_ERROR.MATCH_NOT_FOUND:
      return 404;
    default:
      return 400;
  }
}

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

function enrichError(result) {
  return {
    ...result,
    messageVi: REFEREE_V5_ERROR_VI[result.code] || result.error || result.code,
  };
}

export function createRefereeV5EdgeRuntime({
  serviceClient,
  repository: repositoryOverride = null,
  atomicCommit: atomicCommitOverride = null,
  handler: handlerOverride = null,
} = {}) {
  const repository =
    repositoryOverride || new RefereeV5SupabaseRepository(serviceClient);
  const atomicCommit =
    atomicCommitOverride ||
    new RefereeV5RpcAtomicCommitService(
      repository,
      serviceClient,
      REFEREE_V5_INTERNAL_RPC,
    );
  const handler =
    handlerOverride || new RefereeV5EdgeCommandHandler(repository, atomicCommit);
  return { repository, handler, atomicCommit };
}

export async function handleRefereeV5MatchAction({
  action,
  body,
  userClient,
  serviceClient,
  runtime = null,
}) {
  const verified = await verifyBearerToken(userClient);
  if (!verified.ok) {
    return { httpStatus: 401, body: enrichError(verified) };
  }

  const token = `jwt:${verified.userId}`;
  const { handler, repository } =
    runtime || createRefereeV5EdgeRuntime({ serviceClient });

  if (action === "get-state") {
    const { tournamentId, matchId } = body;
    const assignment = await repository.findAssignmentByUserAndMatch({
      userId: verified.userId,
      tournamentId,
      matchId,
    });
    if (!assignment) {
      return {
        httpStatus: 403,
        body: enrichError({ ok: false, code: REFEREE_V5_ERROR.REFEREE_NOT_ASSIGNED }),
      };
    }

    // Reads must enforce the same assignment validity checks as commands.
    if (assignment.status === "revoked") {
      return {
        httpStatus: 403,
        body: enrichError({ ok: false, code: REFEREE_V5_ERROR.ASSIGNMENT_REVOKED }),
      };
    }
    if (assignment.expiresAt && new Date(assignment.expiresAt).getTime() < Date.now()) {
      return {
        httpStatus: 403,
        body: enrichError({ ok: false, code: REFEREE_V5_ERROR.ASSIGNMENT_EXPIRED }),
      };
    }

    const live = await repository.getLiveState(
      `${assignment.tenantId}::${tournamentId}::${matchId}`,
    );
    if (!live) {
      return {
        httpStatus: 404,
        body: enrichError({ ok: false, code: REFEREE_V5_ERROR.MATCH_NOT_FOUND }),
      };
    }

    const state = deserializeMatchState(live.statePayload);
    const events = await repository.getEvents(`${assignment.tenantId}::${tournamentId}::${matchId}`);

    return {
      httpStatus: 200,
      body: {
        ok: true,
        state,
        stateVersion: live.stateVersion,
        lastEventSequence: live.lastEventSequence,
        recentEvents: events.slice(-10),
        serveDirection: resolveServeDirection(state),
        tenantId: assignment.tenantId,
      },
    };
  }

  if (action === "apply-command") {
    const result = await handler.processMatchCommand({
      accessToken: token,
      tournamentId: body.tournamentId,
      matchId: body.matchId,
      commandType: body.commandType,
      payload: body.payload || {},
      expectedVersion: body.expectedVersion,
      expectedSequence: body.expectedSequence,
      clientMutationId: body.clientMutationId,
      idempotencyKey: body.idempotencyKey,
      requestBody: body,
    });

    return {
      httpStatus: result.ok ? 200 : mapHttpStatus(result.code),
      body: result.ok ? result : enrichError(result),
    };
  }

  if (action === "finalize") {
    const result = await handler.processFinalize({
      accessToken: token,
      tournamentId: body.tournamentId,
      matchId: body.matchId,
      expectedVersion: body.expectedVersion,
      idempotencyKey: body.idempotencyKey,
      overrideReason: body.overrideReason || null,
      isOverride: Boolean(body.isOverride),
      forceComplete: Boolean(body.forceComplete),
      requestBody: body,
    });

    return {
      httpStatus: result.ok ? 200 : mapHttpStatus(result.code),
      body: result.ok ? result : enrichError(result),
    };
  }

  return {
    httpStatus: 400,
    body: enrichError({ ok: false, code: REFEREE_V5_ERROR.VALIDATION_FAILED, error: "Unknown action" }),
  };
}

export async function handleRefereeV5MatchHttpRequest(req, { createSupabaseClients }) {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  if (req.method !== "POST") {
    return jsonResponse({ ok: false, code: "METHOD_NOT_ALLOWED" }, 405);
  }

  const authHeader = req.headers.get("Authorization") || "";
  if (!authHeader.startsWith("Bearer ")) {
    return jsonResponse(enrichError({ ok: false, code: REFEREE_V5_ERROR.TENANT_ACCESS_DENIED }), 401);
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return jsonResponse(enrichError({ ok: false, code: REFEREE_V5_ERROR.VALIDATION_FAILED }), 400);
  }

  const action = String(body.action || "").trim();
  if (!action) {
    return jsonResponse(enrichError({ ok: false, code: REFEREE_V5_ERROR.VALIDATION_FAILED }), 400);
  }

  const { user, service } = createSupabaseClients(authHeader);
  const result = await handleRefereeV5MatchAction({
    action,
    body,
    userClient: user,
    serviceClient: service,
  });

  return jsonResponse(result.body, result.httpStatus);
}

export { CORS_HEADERS, mapHttpStatus };
