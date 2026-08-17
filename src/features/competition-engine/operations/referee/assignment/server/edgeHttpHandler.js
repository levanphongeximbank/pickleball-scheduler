/**
 * Competition-owned trusted server HTTP handler for CORE-13 assignment.
 *
 * Browser / Competition Experience
 *   → authenticated Competition assignment server endpoint
 *   → canonical actor / tenant / tournament authz
 *   → SERVER-SIDE CORE-13 (same runtime)
 *   → shared assignment command
 *   → service-role persistence adapter
 *   → competition_* SQL RPC
 */

import {
  ASSIGNMENT_COMMAND,
  ASSIGNMENT_COMMAND_ERROR_CODE,
  ASSIGNMENT_COMPETITION_MODE,
  COMPETITION_REFEREE_ASSIGNMENT_EDGE_FUNCTION,
} from "../constants.js";
import {
  createCompetitionRefereeAssignmentCommandService,
  isCompetitionRefereeAssignmentCommandError,
} from "../createCompetitionRefereeAssignmentCommandService.js";
import { createRpcCanonicalAssignmentPersistence } from "../persistence/createRpcCanonicalAssignmentPersistence.js";
import { assertTrustedAssignmentAuthz } from "./assertTrustedAssignmentAuthz.js";
import { createTrustedServerIdentityAccessAdapter } from "./createTrustedServerIdentityAccessAdapter.js";
import { loadAuthoritativeAssignmentEvidence } from "./loadAuthoritativeAssignmentEvidence.js";

export const COMPETITION_ASSIGNMENT_CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export async function verifyBearerToken(supabaseUserClient) {
  const { data, error } = await supabaseUserClient.auth.getUser();
  if (error || !data?.user?.id) {
    return {
      ok: false,
      code: ASSIGNMENT_COMMAND_ERROR_CODE.UNAUTHORIZED_ACTOR,
      error: "Invalid or expired token.",
    };
  }
  return { ok: true, userId: data.user.id };
}

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...COMPETITION_ASSIGNMENT_CORS_HEADERS, "Content-Type": "application/json" },
  });
}

function mapHttpStatus(code) {
  switch (code) {
    case ASSIGNMENT_COMMAND_ERROR_CODE.UNAUTHORIZED_ACTOR:
      return 401;
    case ASSIGNMENT_COMMAND_ERROR_CODE.CROSS_TENANT_DENIED:
    case ASSIGNMENT_COMMAND_ERROR_CODE.CROSS_TOURNAMENT_DENIED:
    case ASSIGNMENT_COMMAND_ERROR_CODE.FOREIGN_REFEREE_DENIED:
    case ASSIGNMENT_COMMAND_ERROR_CODE.CLIENT_GRANT_TRUST_REJECTED:
      return 403;
    case ASSIGNMENT_COMMAND_ERROR_CODE.STALE_WRITE:
    case ASSIGNMENT_COMMAND_ERROR_CODE.IDEMPOTENCY_CONFLICT:
      return 409;
    case ASSIGNMENT_COMMAND_ERROR_CODE.LIFECYCLE_DENIED:
    case ASSIGNMENT_COMMAND_ERROR_CODE.CORE13_VALIDATION_REJECTED:
    case ASSIGNMENT_COMMAND_ERROR_CODE.CANONICAL_REFEREE_EVIDENCE_REQUIRED:
    case ASSIGNMENT_COMMAND_ERROR_CODE.NOT_CONFIGURED:
      return 422;
    default:
      return 400;
  }
}

function toErrorBody(err) {
  if (isCompetitionRefereeAssignmentCommandError(err)) {
    return {
      ok: false,
      code: err.code,
      error: err.message,
      details: err.details || {},
    };
  }
  return {
    ok: false,
    code: ASSIGNMENT_COMMAND_ERROR_CODE.INVALID_INPUT,
    error: String(err?.message || err),
  };
}

function stripBrowserAuthority(command = {}) {
  const next = { ...command };
  delete next.actorId;
  delete next.actor;
  delete next.actorRef;
  delete next.clientGrantedPermissions;
  delete next.authorizedTenantId;
  delete next.authorizedTournamentId;
  delete next.lifecycleState;
  delete next.matchStatus;
  delete next.scoringActive;
  delete next.directorySnapshot;
  delete next.qualificationSnapshot;
  delete next.availabilitySnapshot;
  delete next.scheduleSnapshot;
  delete next.candidates;
  delete next.emergencyAuthorized;
  return next;
}

export function createTrustedCompetitionAssignmentRuntime({ serviceClient }) {
  const persistence = createRpcCanonicalAssignmentPersistence({ serviceClient });
  const commandService = createCompetitionRefereeAssignmentCommandService({
    persistence,
    production: true,
    authorize: () => true,
    authorizeEmergency: (cmd) => cmd.emergencyReplacement === true,
  });
  return { persistence, commandService };
}

export async function handleCompetitionRefereeAssignmentAction({
  action,
  body,
  userClient,
  serviceClient,
  identityAccessAdapter,
}) {
  try {
    return await executeCompetitionRefereeAssignmentAction({
      action,
      body,
      userClient,
      serviceClient,
      identityAccessAdapter,
    });
  } catch (err) {
    const payload = toErrorBody(err);
    return { httpStatus: mapHttpStatus(payload.code), body: payload };
  }
}

async function executeCompetitionRefereeAssignmentAction({
  action,
  body,
  userClient,
  serviceClient,
  identityAccessAdapter,
}) {
  const verified = await verifyBearerToken(userClient);
  if (!verified.ok) {
    return { httpStatus: 401, body: verified };
  }

  const incoming = body?.command && typeof body.command === "object" ? body.command : body || {};
  const command = stripBrowserAuthority(incoming);
  command.actorId = verified.userId;
  command.competitionMode = String(
    command.competitionMode || ASSIGNMENT_COMPETITION_MODE.INTERNAL
  ).toUpperCase();

  const authz = await assertTrustedAssignmentAuthz({
    userClient,
    tenantId: command.tenantId,
    tournamentId: command.tournamentId || command.competitionId,
    actorId: verified.userId,
    canonicalBound: false,
  });

  const evidence = await loadAuthoritativeAssignmentEvidence({
    serviceClient,
    tenantId: authz.tenantId,
    tournamentId: authz.tournamentId,
    matchId: command.matchId,
    refereeId: command.refereeId || command.newRefereeId || null,
    actorId: verified.userId,
    roleCode: command.roleCode || command.role,
    competitionMode: command.competitionMode,
    requireQualification: command.requireQualification === true,
    requireAvailability: command.requireAvailability === true,
    identityAccessAdapter:
      identityAccessAdapter ||
      createTrustedServerIdentityAccessAdapter({
        tenantId: authz.tenantId,
        getAuthClient: () => serviceClient,
      }),
  });

  await assertTrustedAssignmentAuthz({
    userClient,
    tenantId: authz.tenantId,
    tournamentId: authz.tournamentId,
    actorId: verified.userId,
    clubId: evidence.clubId || command.clubId,
    canonicalId: evidence.canonicalId,
    canonicalBound: evidence.canonicalBound,
    teamBound: evidence.teamBound,
  });

  const prepared = {
    ...command,
    tenantId: authz.tenantId,
    tournamentId: authz.tournamentId,
    actorId: verified.userId,
    authorizedTenantId: authz.tenantId,
    authorizedTournamentId: authz.tournamentId,
    actorAuthorized: true,
    lifecycleState: evidence.lifecycleState,
    scoringActive: evidence.scoringActive,
    directorySnapshot: evidence.directorySnapshot,
    qualificationSnapshot: evidence.qualificationSnapshot,
    availabilitySnapshot: evidence.availabilitySnapshot,
    scheduleSnapshot: evidence.scheduleSnapshot,
    startAt: evidence.startAt,
    endAt: evidence.endAt,
    courtId: evidence.courtId,
    scheduled: evidence.scheduled,
    requireQualification: evidence.requireQualification,
    requireAvailability: evidence.requireAvailability,
    requireScheduleWindowForMandatoryRoles:
      evidence.requireScheduleWindowForMandatoryRoles,
    policy: {
      policyId: "core13-trusted-server-assignment",
      policyVersion: "1",
      requireScheduleWindowForMandatoryRoles:
        evidence.requireScheduleWindowForMandatoryRoles,
      allowSoftOverride: command.allowSoftOverride === true,
    },
  };

  const { commandService } = createTrustedCompetitionAssignmentRuntime({
    serviceClient,
  });

  if (action === "getMatchAssignmentVersion") {
    const version = await commandService.getMatchAssignmentVersion({
      tenantId: prepared.tenantId,
      tournamentId: prepared.tournamentId,
      matchId: prepared.matchId,
      role: prepared.roleCode || prepared.role || "PRIMARY",
    });
    return { httpStatus: 200, body: { ok: true, version, action } };
  }
  if (action === "getActiveAssignment") {
    const assignment = await commandService.getActiveAssignment({
      tenantId: prepared.tenantId,
      tournamentId: prepared.tournamentId,
      matchId: prepared.matchId,
      role: prepared.roleCode || prepared.role || "PRIMARY",
    });
    return { httpStatus: 200, body: { ok: true, assignment, action } };
  }
  if (action === "listActiveAssignments") {
    const assignments = await commandService.listActiveAssignments?.({
      tenantId: prepared.tenantId,
      tournamentId: prepared.tournamentId,
    });
    const list = Array.isArray(assignments)
      ? assignments
      : await createTrustedCompetitionAssignmentRuntime({
          serviceClient,
        }).persistence.listActiveAssignments({
          tenantId: prepared.tenantId,
          tournamentId: prepared.tournamentId,
        });
    return { httpStatus: 200, body: { ok: true, assignments: list, action } };
  }

  const method =
    action === ASSIGNMENT_COMMAND.ASSIGN || action === "assignReferee"
      ? "assignReferee"
      : action === ASSIGNMENT_COMMAND.REPLACE || action === "replaceReferee"
        ? "replaceReferee"
        : action === ASSIGNMENT_COMMAND.UNASSIGN || action === "unassignReferee"
          ? "unassignReferee"
          : null;
  if (!method) {
    return {
      httpStatus: 400,
      body: {
        ok: false,
        code: ASSIGNMENT_COMMAND_ERROR_CODE.INVALID_INPUT,
        error: `Unknown action ${action}`,
      },
    };
  }

  const result = await commandService[method](prepared);
  return {
    httpStatus: 200,
    body: {
      ...result,
      ok: true,
      authoritativeExecutionLocation: "TRUSTED_SERVER",
      endpoint: COMPETITION_REFEREE_ASSIGNMENT_EDGE_FUNCTION,
      originatingActorId: verified.userId,
      core13Executed: true,
    },
  };
}

export async function handleCompetitionRefereeAssignmentHttpRequest(
  req,
  { createSupabaseClients }
) {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: COMPETITION_ASSIGNMENT_CORS_HEADERS });
  }
  if (req.method !== "POST") {
    return jsonResponse({ ok: false, code: "METHOD_NOT_ALLOWED" }, 405);
  }

  const authHeader = req.headers.get("Authorization") || "";
  if (!authHeader.startsWith("Bearer ")) {
    return jsonResponse(
      {
        ok: false,
        code: ASSIGNMENT_COMMAND_ERROR_CODE.UNAUTHORIZED_ACTOR,
        error: "Missing bearer token",
      },
      401
    );
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return jsonResponse(
      { ok: false, code: ASSIGNMENT_COMMAND_ERROR_CODE.INVALID_INPUT },
      400
    );
  }

  const action = String(body.action || "").trim();
  if (!action) {
    return jsonResponse(
      { ok: false, code: ASSIGNMENT_COMMAND_ERROR_CODE.INVALID_INPUT, error: "action required" },
      400
    );
  }

  const { user, service } = createSupabaseClients(authHeader);
  try {
    const result = await handleCompetitionRefereeAssignmentAction({
      action,
      body,
      userClient: user,
      serviceClient: service,
    });
    return jsonResponse(result.body, result.httpStatus);
  } catch (err) {
    const payload = toErrorBody(err);
    return jsonResponse(payload, mapHttpStatus(payload.code));
  }
}

export { mapHttpStatus, stripBrowserAuthority };
