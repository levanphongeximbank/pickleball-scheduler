/**
 * Phase 1I-D — testable Public Player Directory detail controller.
 *
 * Calls getPublicDirectoryPlayer only (facade boundary).
 * Stale-response discard via request sequence; clears player on each new load.
 */
import { DIRECTORY_ERROR_CODES } from "../constants/directory.js";
import { getPublicDirectoryPlayer } from "../services/getPublicDirectoryPlayer.js";
import {
  DIRECTORY_DETAIL_NOT_FOUND_MESSAGE,
  mapDirectoryDetailErrorMessage,
} from "./publicDirectoryDetailMessages.js";

export const DIRECTORY_DETAIL_UI_STATUS = Object.freeze({
  IDLE: "idle",
  LOADING: "loading",
  READY: "ready",
  NOT_FOUND: "not_found",
  ERROR: "error",
  UNAUTHENTICATED: "unauthenticated",
  INVALID_REQUEST: "invalid_request",
});

/**
 * @param {object} [deps]
 * @param {typeof getPublicDirectoryPlayer} [deps.getPublicDirectoryPlayer]
 */
export function createPublicDirectoryDetailController(deps = {}) {
  const getPlayer = deps.getPublicDirectoryPlayer || getPublicDirectoryPlayer;

  let state = {
    playerId: null,
    player: null,
    uiStatus: DIRECTORY_DETAIL_UI_STATUS.IDLE,
    error: null,
    requestSeq: 0,
  };

  const listeners = new Set();

  function getState() {
    return {
      ...state,
      player: state.player ? { ...state.player } : null,
      error: state.error ? { ...state.error } : null,
    };
  }

  function setState(patch) {
    state = { ...state, ...patch };
    for (const listener of listeners) {
      try {
        listener(getState());
      } catch {
        /* ignore */
      }
    }
    return getState();
  }

  function subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  /**
   * @param {unknown} playerId
   * @param {object} [getOptions] — DI for facade (session, repository, …)
   */
  async function load(playerId, getOptions) {
    const raw =
      playerId == null || playerId === undefined ? "" : String(playerId);
    if (!raw) {
      return setState({
        playerId: null,
        player: null,
        uiStatus: DIRECTORY_DETAIL_UI_STATUS.NOT_FOUND,
        error: {
          code: null,
          message: DIRECTORY_DETAIL_NOT_FOUND_MESSAGE,
          recoverable: false,
        },
      });
    }

    const seq = state.requestSeq + 1;
    setState({
      requestSeq: seq,
      playerId: raw,
      player: null,
      uiStatus: DIRECTORY_DETAIL_UI_STATUS.LOADING,
      error: null,
    });

    const result = await getPlayer(raw, getOptions || {});

    if (seq !== state.requestSeq) {
      return getState();
    }

    if (!result?.ok) {
      const code = result?.code || DIRECTORY_ERROR_CODES.BACKEND_UNAVAILABLE;

      if (code === DIRECTORY_ERROR_CODES.NOT_AUTHENTICATED) {
        return setState({
          player: null,
          uiStatus: DIRECTORY_DETAIL_UI_STATUS.UNAUTHENTICATED,
          error: {
            code,
            message: mapDirectoryDetailErrorMessage(code, result?.message),
            recoverable: false,
          },
        });
      }

      if (code === DIRECTORY_ERROR_CODES.INVALID_REQUEST) {
        return setState({
          player: null,
          uiStatus: DIRECTORY_DETAIL_UI_STATUS.INVALID_REQUEST,
          error: {
            code,
            message: mapDirectoryDetailErrorMessage(code, result?.message),
            recoverable: false,
          },
        });
      }

      return setState({
        player: null,
        uiStatus: DIRECTORY_DETAIL_UI_STATUS.ERROR,
        error: {
          code,
          message: mapDirectoryDetailErrorMessage(code, result?.message),
          recoverable: true,
        },
      });
    }

    if (result.player == null) {
      return setState({
        player: null,
        uiStatus: DIRECTORY_DETAIL_UI_STATUS.NOT_FOUND,
        error: {
          code: null,
          message: DIRECTORY_DETAIL_NOT_FOUND_MESSAGE,
          recoverable: false,
        },
      });
    }

    return setState({
      player: result.player,
      uiStatus: DIRECTORY_DETAIL_UI_STATUS.READY,
      error: null,
    });
  }

  /**
   * Recoverable retry for the current playerId.
   * @param {object} [getOptions]
   */
  async function retry(getOptions) {
    return load(state.playerId, getOptions);
  }

  return {
    getState,
    subscribe,
    load,
    retry,
  };
}
