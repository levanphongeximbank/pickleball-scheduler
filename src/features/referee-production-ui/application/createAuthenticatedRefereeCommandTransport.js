/**
 * Browser → authenticated `/api/referee/command` transport.
 * Sends only user JWT + command intent + expectedVersion + idempotencyKey.
 * Never embeds service_role or privileged RPC composition.
 */

import { REFEREE_UI_ERROR_CODE } from "../constants.js";

export const REFEREE_COMMAND_API_PATH = "/api/referee/command";

/**
 * @param {{
 *   getAccessToken: () => Promise<string|null>,
 *   fetchImpl?: typeof fetch,
 *   apiPath?: string,
 * }} options
 */
export function createAuthenticatedRefereeCommandTransport(options = {}) {
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  const apiPath = options.apiPath || REFEREE_COMMAND_API_PATH;

  if (typeof options.getAccessToken !== "function") {
    throw new Error("getAccessToken is required for authenticated referee transport");
  }
  if (typeof fetchImpl !== "function") {
    throw new Error("fetch is required for authenticated referee transport");
  }

  async function invoke(command, payload = {}) {
    const clickStarted = Date.now();
    const tToken0 = Date.now();
    const accessToken = await options.getAccessToken();
    const TOKEN_MS = Date.now() - tToken0;
    if (!accessToken) {
      const err = new Error("Phiên đăng nhập hết hạn — đăng nhập lại để tiếp tục.");
      err.code = REFEREE_UI_ERROR_CODE.COMMAND_UNAVAILABLE;
      err.failClosed = true;
      err.silentLegacyFallback = false;
      throw err;
    }

    const tFetch0 = Date.now();
    const response = await fetchImpl(apiPath, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        command,
        ...payload,
      }),
    });

    const json = await response.json().catch(() => ({
      ok: false,
      code: REFEREE_UI_ERROR_CODE.COMMAND_UNAVAILABLE,
      error: "Phản hồi server không hợp lệ",
    }));
    const FETCH_RTT_MS = Date.now() - tFetch0;
    const TOTAL_CLICK_TO_ACK_MS = Date.now() - clickStarted;

    if (!response.ok || json.ok === false) {
      const err = new Error(json.error || json.message || "Lệnh trọng tài thất bại");
      err.code = json.code || REFEREE_UI_ERROR_CODE.COMMAND_UNAVAILABLE;
      err.failClosed = true;
      err.silentLegacyFallback = false;
      err.stale = json.stale === true;
      err.view = json.view || json.result?.view || null;
      err.httpStatus = response.status;
      err.serviceRoleInBrowser = false;
      err.directPrivilegedRpcFromBrowser = false;
      err.serverTiming = json.serverTiming || null;
      throw err;
    }

    const result = json.result != null ? json.result : json;
    const browserTiming = Object.freeze({
      TOKEN_MS,
      FETCH_RTT_MS,
      TOTAL_CLICK_TO_ACK_MS,
      NETWORK_POST_COUNT: 1,
    });
    if (json.serverTiming && typeof console !== "undefined" && console.info) {
      console.info("[referee-command-timing]", {
        command,
        browserTiming,
        serverTiming: json.serverTiming,
      });
    }
    if (result && typeof result === "object") {
      return Object.freeze({
        ...result,
        browserTiming,
        serverTiming: json.serverTiming || null,
      });
    }
    return result;
  }

  return Object.freeze({
    kind: "authenticated-referee-command-transport",
    apiPath,
    serviceRoleInBrowser: false,
    directPrivilegedRpcFromBrowser: false,
    invoke,
    listMyAssignments: (payload) => invoke("listMyAssignments", payload),
    getMatchView: (payload) => invoke("getMatchView", payload),
    acknowledgeAssignment: (payload) => invoke("acknowledgeAssignment", payload),
    openAssignedMatch: (payload) => invoke("openAssignedMatch", payload),
    startScoreSession: (payload) => invoke("startScoreSession", payload),
    startMatch: (payload) => invoke("startMatch", payload),
    submitPoint: (payload) => invoke("submitPoint", payload),
    undoLastScoringAction: (payload) =>
      invoke("UNDO_LAST_SCORING_ACTION", payload),
    suspendMatch: (payload) => invoke("suspendMatch", payload),
    resumeMatch: (payload) => invoke("resumeMatch", payload),
    confirmChangeEnds: (payload) => invoke("confirmChangeEnds", payload),
    switchPositions: (payload) => invoke("switchPositions", payload),
    configureLineup: (payload) => invoke("configureLineup", payload),
    submitResult: (payload) => invoke("submitResult", payload),
    correctResult: (payload) => invoke("correctResult", payload),
  });
}
