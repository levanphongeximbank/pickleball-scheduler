/**
 * Browser transport for the Competition assignment trusted server endpoint.
 *
 * Client-side CORE-13 is pre-validation only. Canonical mutation is the
 * Edge Function result. Browser actorId is never treated as authority.
 */

import {
  ASSIGNMENT_COMMAND_ERROR_CODE,
  COMPETITION_REFEREE_ASSIGNMENT_EDGE_FUNCTION,
} from "../constants.js";

export const COMPETITION_REFEREE_ASSIGNMENT_ACTIONS = Object.freeze({
  ASSIGN: "assignReferee",
  REPLACE: "replaceReferee",
  UNASSIGN: "unassignReferee",
  GET_VERSION: "getMatchAssignmentVersion",
  GET_ACTIVE: "getActiveAssignment",
  LIST_ACTIVE: "listActiveAssignments",
});

export function resolveCompetitionAssignmentEdgeBaseUrl() {
  const env =
    typeof import.meta !== "undefined" && import.meta.env ? import.meta.env : {};
  const nodeEnv =
    typeof globalThis.process !== "undefined" ? globalThis.process.env : {};
  return String(env.VITE_SUPABASE_URL || nodeEnv.VITE_SUPABASE_URL || "").trim();
}

export function competitionRefereeAssignmentEdgeUrl(edgeBaseUrl) {
  const base = String(edgeBaseUrl || "").replace(/\/+$/, "");
  return `${base}/functions/v1/${COMPETITION_REFEREE_ASSIGNMENT_EDGE_FUNCTION}`;
}

const MUTATION_ACTIONS = new Set([
  COMPETITION_REFEREE_ASSIGNMENT_ACTIONS.ASSIGN,
  COMPETITION_REFEREE_ASSIGNMENT_ACTIONS.REPLACE,
  COMPETITION_REFEREE_ASSIGNMENT_ACTIONS.UNASSIGN,
]);

function stripUntrustedActor(command = {}) {
  const safe = { ...command };
  delete safe.actorId;
  delete safe.actor;
  delete safe.actorRef;
  delete safe.clientGrantedPermissions;
  delete safe.authorizedTenantId;
  delete safe.authorizedTournamentId;
  delete safe.lifecycleState;
  delete safe.directorySnapshot;
  delete safe.qualificationSnapshot;
  delete safe.availabilitySnapshot;
  return safe;
}

export function extractCanonicalAssignmentId(payload) {
  if (!payload || typeof payload !== "object") return "";
  return String(
    payload.assignmentId ||
      payload.assignment?.assignmentId ||
      payload.assignment?.id ||
      payload.id ||
      ""
  ).trim();
}

export function normalizeCompetitionAssignmentResult(action, payload) {
  if (!payload || typeof payload !== "object") {
    return {
      ok: false,
      code: ASSIGNMENT_COMMAND_ERROR_CODE.MALFORMED_ASSIGNMENT_RESULT,
      error: "Invalid assignment response",
    };
  }
  if (payload.ok === false) return payload;
  if (!MUTATION_ACTIONS.has(action)) return payload;
  const assignmentId = extractCanonicalAssignmentId(payload);
  if (!assignmentId) {
    return {
      ok: false,
      code: ASSIGNMENT_COMMAND_ERROR_CODE.MALFORMED_ASSIGNMENT_RESULT,
      error: "malformed Edge success response: assignmentId required",
    };
  }
  return {
    ...payload,
    ok: true,
    assignmentId,
    assignment: {
      ...(payload.assignment && typeof payload.assignment === "object"
        ? payload.assignment
        : {}),
      assignmentId,
    },
  };
}

async function postEdge({ accessToken, edgeBaseUrl, body }) {
  if (!accessToken) {
    return {
      ok: false,
      code: ASSIGNMENT_COMMAND_ERROR_CODE.UNAUTHORIZED_ACTOR,
      error: "Missing access token",
    };
  }
  if (!edgeBaseUrl) {
    return {
      ok: false,
      code: ASSIGNMENT_COMMAND_ERROR_CODE.NOT_CONFIGURED,
      error: "Competition assignment Edge Function URL is not configured",
    };
  }

  const response = await fetch(competitionRefereeAssignmentEdgeUrl(edgeBaseUrl), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({
    ok: false,
    code: ASSIGNMENT_COMMAND_ERROR_CODE.INVALID_INPUT,
    error: "Invalid JSON response",
  }));
  return { ...payload, httpStatus: response.status };
}

/**
 * @param {{
 *   getAccessToken: () => Promise<string|null>|string|null,
 *   edgeBaseUrl: string,
 * }} options
 */
export function createCompetitionRefereeAssignmentTrustedClient(options = {}) {
  const getAccessToken = options.getAccessToken;
  const edgeBaseUrl = options.edgeBaseUrl;

  async function invoke(action, command = {}) {
    const token =
      typeof getAccessToken === "function"
        ? await getAccessToken()
        : getAccessToken;
    const payload = await postEdge({
      accessToken: token,
      edgeBaseUrl,
      body: {
        action,
        command: stripUntrustedActor(command),
      },
    });
    return normalizeCompetitionAssignmentResult(action, payload);
  }

  return Object.freeze({
    kind: "competition-referee-assignment-trusted-client",
    endpoint: COMPETITION_REFEREE_ASSIGNMENT_EDGE_FUNCTION,
    core13Role: "PRE_VALIDATION_ONLY",
    authoritativeExecutionLocation: "TRUSTED_SERVER",
    assignReferee: (command) =>
      invoke(COMPETITION_REFEREE_ASSIGNMENT_ACTIONS.ASSIGN, command),
    replaceReferee: (command) =>
      invoke(COMPETITION_REFEREE_ASSIGNMENT_ACTIONS.REPLACE, command),
    unassignReferee: (command) =>
      invoke(COMPETITION_REFEREE_ASSIGNMENT_ACTIONS.UNASSIGN, command),
    getMatchAssignmentVersion: (command) =>
      invoke(COMPETITION_REFEREE_ASSIGNMENT_ACTIONS.GET_VERSION, command),
    getActiveAssignment: (command) =>
      invoke(COMPETITION_REFEREE_ASSIGNMENT_ACTIONS.GET_ACTIVE, command),
    listActiveAssignments: (command) =>
      invoke(COMPETITION_REFEREE_ASSIGNMENT_ACTIONS.LIST_ACTIVE, command),
  });
}

export { stripUntrustedActor as stripUntrustedAssignmentActorFields };
