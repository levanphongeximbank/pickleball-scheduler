/**
 * Browser production composition.
 *
 * Authenticated user JWT → /api/referee/command (trusted server)
 *   → Adapter B → competition.referee.adapter.v1 → E2E-04 → durable runtime
 *
 * Never constructs privileged live RPC composition in the browser.
 * Optional injected `runtime` remains for tests only.
 */

import { REFEREE_UI_ERROR_CODE } from "../constants.js";
import {
  assertRefereeUiSecurity,
  rejectProductionFixtureFallback,
} from "./assertProductionUiSecurity.js";
import { createAuthenticatedRefereeCommandTransport } from "./createAuthenticatedRefereeCommandTransport.js";
import { createCanonicalRefereeApplicationClient } from "./createCanonicalRefereeApplicationClient.js";

async function failClosedCommand(message) {
  const err = new Error(
    message ||
      "Canonical Referee command requires authenticated server transport; silent legacy/V5 scoring fallback is forbidden"
  );
  err.code = REFEREE_UI_ERROR_CODE.COMMAND_UNAVAILABLE;
  err.failClosed = true;
  err.silentLegacyFallback = false;
  err.serviceRoleInBrowser = false;
  err.directPrivilegedRpcFromBrowser = false;
  throw err;
}

async function defaultGetAccessToken(userClient) {
  if (!userClient?.auth?.getSession) return null;
  const { data } = await userClient.auth.getSession();
  return data?.session?.access_token || null;
}

/**
 * @param {{
 *   runtime?: object,
 *   actor?: object,
 *   env?: Record<string, unknown>,
 *   userClient?: { from: Function, auth?: { getSession: Function } }|null,
 *   transport?: object,
 *   getAccessToken?: () => Promise<string|null>,
 *   modeStateResolver?: Function,
 *   participantNameResolver?: Function,
 * }} [options]
 */
export function createBrowserRefereeApplicationClient(options = {}) {
  assertRefereeUiSecurity(options.env);
  rejectProductionFixtureFallback(options);

  if (options.runtime) {
    return createCanonicalRefereeApplicationClient(options);
  }

  const userClient = options.userClient || null;
  const actor = options.actor || null;
  const transport =
    options.transport ||
    (typeof options.getAccessToken === "function" || userClient
      ? createAuthenticatedRefereeCommandTransport({
          getAccessToken:
            options.getAccessToken ||
            (() => defaultGetAccessToken(userClient)),
          fetchImpl: options.fetchImpl,
          apiPath: options.apiPath,
        })
      : null);

  function withActor(command = {}) {
    return {
      ...command,
      actor: command.actor || actor,
    };
  }

  async function viaTransport(method, command = {}) {
    if (!transport || typeof transport[method] !== "function") {
      return failClosedCommand(
        "Canonical Referee requires authenticated /api/referee/command transport"
      );
    }
    return transport[method](withActor(command));
  }

  return Object.freeze({
    kind: "browser-referee-application-client",
    usesAdapterB: true,
    silentLegacyFallback: false,
    productionFixtureFallback: false,
    locationStateRequired: false,
    serviceRoleInBrowser: false,
    directPrivilegedRpcFromBrowser: false,
    commandTransport: "authenticated-api-referee-command",
    readOnly: false,
    listMyAssignments: (command) => viaTransport("listMyAssignments", command),
    getMatchView: (command) => viaTransport("getMatchView", command),
    acknowledgeAssignment: (command) =>
      viaTransport("acknowledgeAssignment", command),
    openAssignedMatch: (command) => viaTransport("openAssignedMatch", command),
    startScoreSession: (command) => viaTransport("startScoreSession", command),
    startMatch: (command) => viaTransport("startMatch", command),
    submitPoint: (command) => viaTransport("submitPoint", command),
    undoLastScoringAction: (command) =>
      viaTransport("undoLastScoringAction", command),
    suspendMatch: (command) => viaTransport("suspendMatch", command),
    resumeMatch: (command) => viaTransport("resumeMatch", command),
    confirmChangeEnds: (command) => viaTransport("confirmChangeEnds", command),
    switchPositions: (command) => viaTransport("switchPositions", command),
    configureLineup: (command) => viaTransport("configureLineup", command),
    submitResult: (command) => viaTransport("submitResult", command),
    correctResult: (command) => viaTransport("correctResult", command),
  });
}
