/**
 * Trusted server backend for canonical Referee commands.
 * Hosts Adapter B → E2E-04 → durable runtime with injected service-role rpcClient.
 * Browser never receives service_role.
 */

import { createDefaultCompetitionRefereeRuntime } from "../../competition-engine/integration/referee/createDefaultCompetitionRefereeRuntime.js";
import { CANONICAL_UI_COMMAND } from "../constants.js";
import { createCanonicalRefereeApplicationClient } from "./createCanonicalRefereeApplicationClient.js";
import {
  detectCompetitionModeHint,
  resolveCanonicalRefereeModeState,
} from "./resolveCanonicalRefereeModeState.js";

const COMMAND_MAP = Object.freeze({
  listMyAssignments: "listMyAssignments",
  getMatchView: "getMatchView",
  [CANONICAL_UI_COMMAND.ACKNOWLEDGE]: "acknowledgeAssignment",
  acknowledgeAssignment: "acknowledgeAssignment",
  [CANONICAL_UI_COMMAND.OPEN]: "openAssignedMatch",
  openAssignedMatch: "openAssignedMatch",
  [CANONICAL_UI_COMMAND.START_SCORE_SESSION]: "startScoreSession",
  startScoreSession: "startScoreSession",
  startMatch: "startMatch",
  [CANONICAL_UI_COMMAND.SUBMIT_POINT]: "submitPoint",
  submitPoint: "submitPoint",
  [CANONICAL_UI_COMMAND.SUSPEND]: "suspendMatch",
  suspendMatch: "suspendMatch",
  [CANONICAL_UI_COMMAND.RESUME]: "resumeMatch",
  resumeMatch: "resumeMatch",
  [CANONICAL_UI_COMMAND.CHANGE_ENDS]: "confirmChangeEnds",
  confirmChangeEnds: "confirmChangeEnds",
  [CANONICAL_UI_COMMAND.SWITCH_POSITIONS]: "switchPositions",
  switchPositions: "switchPositions",
  configureLineup: "configureLineup",
  [CANONICAL_UI_COMMAND.SUBMIT_RESULT]: "submitResult",
  submitResult: "submitResult",
  [CANONICAL_UI_COMMAND.CORRECT_RESULT]: "correctResult",
  correctResult: "correctResult",
});

/**
 * @param {{
 *   rpcClient: { rpc: Function, from: Function },
 *   actorId: string,
 *   tenantId?: string|null,
 *   clockIso?: string,
 * }} options
 */
export function createTrustedRefereeBackend(options = {}) {
  const rpcClient = options.rpcClient;
  if (!rpcClient || typeof rpcClient.rpc !== "function" || typeof rpcClient.from !== "function") {
    throw Object.assign(new Error("Trusted referee backend requires service-role rpcClient"), {
      code: "SERVICE_ROLE_MISSING",
    });
  }

  const actor = Object.freeze({
    actorId: options.actorId,
    authUid: options.actorId,
    refereeId: options.actorId,
    role: "REFEREE",
  });

  const runtime = createDefaultCompetitionRefereeRuntime({
    rpcClient,
    clockIso: options.clockIso,
  });

  const modeStateCache = new Map();

  async function modeStateResolver(assignment) {
    const key = `${assignment?.tenantId || ""}::${assignment?.competitionId || ""}::${assignment?.matchId || ""}`;
    if (modeStateCache.has(key)) return modeStateCache.get(key);
    const resolved = await resolveCanonicalRefereeModeState(rpcClient, assignment);
    modeStateCache.set(key, resolved);
    return resolved;
  }

  async function participantNameResolver(assignment, modeState) {
    return modeState?.participantNames || assignment?.participantNames || {};
  }

  const client = createCanonicalRefereeApplicationClient({
    runtime,
    actor,
    modeStateResolver,
    participantNameResolver,
  });

  // Enrich assignment rows from live driver with mode hints for Adapter B selection.
  const originalList = client.listMyAssignments.bind(client);
  async function listMyAssignments(command = {}) {
    const result = await originalList({
      ...command,
      tenantId: command.tenantId || options.tenantId,
      actor: command.actor || actor,
    });
    return result;
  }

  async function execute(commandName, payload = {}) {
    const method = COMMAND_MAP[commandName] || COMMAND_MAP[String(commandName || "").trim()];
    if (!method || typeof client[method] !== "function") {
      const err = new Error(`Unknown referee command: ${commandName}`);
      err.code = "UNKNOWN_COMMAND";
      throw err;
    }

    const body = {
      ...payload,
      tenantId: payload.tenantId || options.tenantId,
      actor,
    };
    delete body.command;
    delete body.actorId;
    delete body.authUid;
    delete body.role;
    delete body.serviceRole;
    delete body.rpcClient;

    if (!body.competitionMode && body.matchId) {
      const hintAssignment = {
        tenantId: body.tenantId,
        competitionId: body.competitionId,
        matchId: body.matchId,
        matchupId: body.matchupId,
        externalMatchupId: body.externalMatchupId,
        subMatchId: body.subMatchId,
        refereeUserId: actor.actorId,
      };
      const modeState = await modeStateResolver(hintAssignment);
      const modeHint = detectCompetitionModeHint(hintAssignment, modeState);
      if (modeHint) body.competitionMode = modeHint;
      if (modeState) body.modeState = modeState;
      if (!body.competitionId && modeState?.competitionId) {
        body.competitionId = modeState.competitionId;
      }
    }

    if (method === "listMyAssignments") {
      return listMyAssignments(body);
    }
    return client[method](body);
  }

  return Object.freeze({
    kind: "trusted-referee-backend",
    usesAdapterB: true,
    serviceRoleInBrowser: false,
    execute,
    getPublicDiagnostic() {
      return Object.freeze({
        usesAdapterB: true,
        silentLegacyFallback: false,
        productionFixtureFallback: false,
        locationStateRequired: false,
        serviceRoleInBrowser: false,
        directPrivilegedRpcFromBrowser: false,
      });
    },
  });
}
