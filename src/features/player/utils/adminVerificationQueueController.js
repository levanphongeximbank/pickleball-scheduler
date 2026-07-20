/**
 * Phase 1H-C — testable admin verification queue controller.
 *
 * Orchestrates listPlayerVerificationQueue + updatePlayerVerificationStatus.
 * Does not call a database client directly, write audit, or use the generic profile writer.
 */
import {
  VERIFICATION_QUEUE_DEFAULT_STATUS,
  VERIFICATION_QUEUE_ERROR_CODES,
} from "../constants/verificationQueue.js";
import { WRITE_ERROR_CODES } from "../constants/writableFields.js";
import { listPlayerVerificationQueue } from "../services/listPlayerVerificationQueue.js";
import { updatePlayerVerificationStatus } from "../services/updatePlayerVerificationStatus.js";
import {
  buildVerificationConfirmation,
  getAvailableVerificationActions,
} from "./verificationAdminActions.js";

export const VERIFICATION_QUEUE_UI_STATUS = Object.freeze({
  IDLE: "idle",
  LOADING: "loading",
  READY: "ready",
  EMPTY: "empty",
  DENIED: "denied",
  ERROR: "error",
});

function isDeniedCode(code) {
  return (
    code === VERIFICATION_QUEUE_ERROR_CODES.NOT_AUTHENTICATED ||
    code === VERIFICATION_QUEUE_ERROR_CODES.UNAUTHORIZED ||
    code === WRITE_ERROR_CODES.NOT_AUTHENTICATED ||
    code === WRITE_ERROR_CODES.UNAUTHORIZED ||
    code === WRITE_ERROR_CODES.SELF_VERIFICATION_FORBIDDEN
  );
}

function normalizeErrorMessage(result) {
  if (!result) return "Unknown error";
  return (
    result.message ||
    result.errors?.[0]?.message ||
    result.error ||
    "Request failed"
  );
}

/**
 * @param {object} [deps]
 * @param {typeof listPlayerVerificationQueue} [deps.listPlayerVerificationQueue]
 * @param {typeof updatePlayerVerificationStatus} [deps.updatePlayerVerificationStatus]
 */
export function createAdminVerificationQueueController(deps = {}) {
  const listQueue = deps.listPlayerVerificationQueue || listPlayerVerificationQueue;
  const updateStatus =
    deps.updatePlayerVerificationStatus || updatePlayerVerificationStatus;

  /** @type {object} */
  let state = {
    uiStatus: VERIFICATION_QUEUE_UI_STATUS.IDLE,
    items: [],
    meta: null,
    loadError: null,
    mutationError: null,
    successMessage: null,
    statusFilter: VERIFICATION_QUEUE_DEFAULT_STATUS,
    searchQuery: "",
    pendingConfirm: null,
    mutating: false,
  };

  const listeners = new Set();

  function getState() {
    return {
      ...state,
      items: [...state.items],
      pendingConfirm: state.pendingConfirm ? { ...state.pendingConfirm } : null,
    };
  }

  function setState(patch) {
    state = { ...state, ...patch };
    for (const listener of listeners) {
      try {
        listener(getState());
      } catch {
        /* ignore listener errors */
      }
    }
    return getState();
  }

  function subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  /**
   * @param {object} [options]
   * @param {string} [options.status]
   * @param {string} [options.query]
   * @param {object} [options.listOptions] — extra list API options (user, etc.)
   */
  async function load(options = {}) {
    const status =
      options.status !== undefined ? options.status : state.statusFilter;
    const query =
      options.query !== undefined ? options.query : state.searchQuery;

    setState({
      uiStatus: VERIFICATION_QUEUE_UI_STATUS.LOADING,
      loadError: null,
      mutationError: null,
      successMessage:
        options.preserveSuccessMessage !== undefined
          ? options.preserveSuccessMessage
          : null,
      statusFilter: status || VERIFICATION_QUEUE_DEFAULT_STATUS,
      searchQuery: query || "",
      pendingConfirm: null,
    });

    const listOptions = {
      ...(options.listOptions || {}),
      status: status || undefined,
      query: query || undefined,
    };

    const result = await listQueue(listOptions);

    if (!result?.ok) {
      if (isDeniedCode(result?.code)) {
        return setState({
          uiStatus: VERIFICATION_QUEUE_UI_STATUS.DENIED,
          items: [],
          meta: result.meta || null,
          loadError: {
            code: result.code,
            message: normalizeErrorMessage(result),
          },
        });
      }
      return setState({
        uiStatus: VERIFICATION_QUEUE_UI_STATUS.ERROR,
        items: [],
        meta: result?.meta || null,
        loadError: {
          code: result?.code || VERIFICATION_QUEUE_ERROR_CODES.PERSISTENCE_ERROR,
          message: normalizeErrorMessage(result),
        },
      });
    }

    const items = Array.isArray(result.data) ? result.data : [];
    return setState({
      uiStatus:
        items.length === 0
          ? VERIFICATION_QUEUE_UI_STATUS.EMPTY
          : VERIFICATION_QUEUE_UI_STATUS.READY,
      items,
      meta: result.meta || null,
      loadError: null,
    });
  }

  /**
   * Open confirmation for a valid action. Does not write.
   * @param {object} item
   * @param {string} nextStatus
   */
  function requestAction(item, nextStatus) {
    if (state.mutating) {
      return {
        ok: false,
        code: "MUTATION_IN_PROGRESS",
        message: "A verification update is already in progress",
      };
    }
    const built = buildVerificationConfirmation({ item, nextStatus });
    if (!built.ok) {
      return built;
    }
    setState({
      pendingConfirm: built.payload,
      mutationError: null,
      successMessage: null,
    });
    return { ok: true, payload: built.payload };
  }

  function cancelConfirm() {
    setState({ pendingConfirm: null });
    return { ok: true, wrote: false };
  }

  /**
   * Confirm pending mutation. Requires an open confirmation.
   * @param {object} [options] — forwarded to updatePlayerVerificationStatus
   */
  async function confirmAction(options = {}) {
    if (!state.pendingConfirm) {
      return {
        ok: false,
        code: "CONFIRMATION_REQUIRED",
        message: "Confirmation is required before updating verification status",
        wrote: false,
      };
    }
    if (state.mutating) {
      return {
        ok: false,
        code: "DUPLICATE_SUBMISSION",
        message: "Duplicate submission blocked",
        wrote: false,
      };
    }

    const confirm = state.pendingConfirm;
    const playerId = confirm.playerId || confirm.authUserId;
    const nextStatus = confirm.toStatus;
    const previousItems = [...state.items];

    setState({
      mutating: true,
      mutationError: null,
      successMessage: null,
    });

    const result = await updateStatus(playerId, nextStatus, {
      ...(options.updateOptions || {}),
      authUserId: confirm.authUserId || undefined,
    });

    if (!result?.ok) {
      setState({
        mutating: false,
        items: previousItems,
        mutationError: {
          code: result?.code || WRITE_ERROR_CODES.PERSISTENCE_ERROR,
          message: normalizeErrorMessage(result),
        },
        // Keep confirm open so admin can retry or cancel explicitly.
      });
      return {
        ok: false,
        code: result?.code,
        message: normalizeErrorMessage(result),
        wrote: false,
        itemsUnchanged: true,
      };
    }

    const successMessage = `Đã cập nhật xác minh: ${confirm.fromStatus} → ${confirm.toStatus}`;

    setState({
      mutating: false,
      pendingConfirm: null,
      successMessage,
      mutationError: null,
    });

    // Deterministic refresh via authorized queue API (not optimistic row invent).
    await load({
      status: state.statusFilter,
      query: state.searchQuery,
      listOptions: options.listOptions,
      preserveSuccessMessage: successMessage,
    });

    return {
      ok: true,
      wrote: true,
      fromStatus: result.fromStatus,
      toStatus: result.toStatus,
      playerId: result.playerId,
    };
  }

  function getActionsForItem(item) {
    return getAvailableVerificationActions(item?.verificationStatus);
  }

  return {
    getState,
    subscribe,
    load,
    requestAction,
    cancelConfirm,
    confirmAction,
    getActionsForItem,
    /** @internal test helper */
    _setStateForTests: setState,
  };
}
