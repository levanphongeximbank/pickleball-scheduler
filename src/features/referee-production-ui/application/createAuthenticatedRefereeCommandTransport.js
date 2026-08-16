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
    const accessToken = await options.getAccessToken();
    if (!accessToken) {
      const err = new Error("Phiên đăng nhập hết hạn — đăng nhập lại để tiếp tục.");
      err.code = REFEREE_UI_ERROR_CODE.COMMAND_UNAVAILABLE;
      err.failClosed = true;
      err.silentLegacyFallback = false;
      throw err;
    }

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
      throw err;
    }

    return json.result != null ? json.result : json;
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
    suspendMatch: (payload) => invoke("suspendMatch", payload),
    resumeMatch: (payload) => invoke("resumeMatch", payload),
    confirmChangeEnds: (payload) => invoke("confirmChangeEnds", payload),
    switchPositions: (payload) => invoke("switchPositions", payload),
    configureLineup: (payload) => invoke("configureLineup", payload),
    submitResult: (payload) => invoke("submitResult", payload),
    correctResult: (payload) => invoke("correctResult", payload),
  });
}
