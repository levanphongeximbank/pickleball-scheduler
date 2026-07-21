/**
 * Phase 1I-C — testable Public Player Directory list controller.
 *
 * Calls searchPublicDirectoryPlayers only (facade boundary).
 * Opaque cursor pass-through; stale-response discard; dedupe by playerId.
 */
import {
  DIRECTORY_ERROR_CODES,
  DIRECTORY_SEARCH_DEFAULT_LIMIT,
  DIRECTORY_SEARCH_MIN_QUERY_LENGTH,
} from "../constants/directory.js";
import { searchPublicDirectoryPlayers } from "../services/searchPublicDirectoryPlayers.js";
import { mapDirectoryListErrorMessage } from "./publicDirectoryListMessages.js";

export const DIRECTORY_LIST_UI_STATUS = Object.freeze({
  IDLE: "idle",
  INITIAL_LOADING: "initial_loading",
  LOADING_MORE: "loading_more",
  READY: "ready",
  EMPTY_BROWSE: "empty_browse",
  EMPTY_SEARCH: "empty_search",
  ERROR: "error",
  UNAUTHENTICATED: "unauthenticated",
});

export const DIRECTORY_LIST_DEBOUNCE_MS = 300;

/**
 * Resolve effective search query for the API.
 * Empty → browse (null). One character → idle (do not call). Two+ → search string.
 *
 * @param {string} rawInput
 * @returns {{ mode: "browse"|"search"|"idle", query: string|null }}
 */
export function resolveDirectorySearchInput(rawInput) {
  const trimmed = String(rawInput ?? "").trim();
  if (!trimmed) {
    return { mode: "browse", query: null };
  }
  if (trimmed.length < DIRECTORY_SEARCH_MIN_QUERY_LENGTH) {
    return { mode: "idle", query: null };
  }
  return { mode: "search", query: trimmed };
}

/**
 * @param {Array<object>} existing
 * @param {Array<object>} incoming
 * @returns {Array<object>}
 */
export function appendDirectoryItems(existing, incoming) {
  const seen = new Set();
  const out = [];
  for (const item of existing || []) {
    const id = item?.playerId;
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(item);
  }
  for (const item of incoming || []) {
    const id = item?.playerId;
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(item);
  }
  return out;
}

function resolveUiStatus({ items, query, activityRegion }) {
  if (items.length > 0) return DIRECTORY_LIST_UI_STATUS.READY;
  const hasFilter = Boolean(query) || Boolean(activityRegion);
  return hasFilter
    ? DIRECTORY_LIST_UI_STATUS.EMPTY_SEARCH
    : DIRECTORY_LIST_UI_STATUS.EMPTY_BROWSE;
}

/**
 * @param {object} [deps]
 * @param {typeof searchPublicDirectoryPlayers} [deps.searchPublicDirectoryPlayers]
 */
export function createPublicDirectoryListController(deps = {}) {
  const searchFn = deps.searchPublicDirectoryPlayers || searchPublicDirectoryPlayers;

  let state = {
    searchInput: "",
    effectiveQuery: null,
    activityRegion: null,
    items: [],
    nextCursor: null,
    uiStatus: DIRECTORY_LIST_UI_STATUS.IDLE,
    error: null,
    requestSeq: 0,
    loadingMore: false,
  };

  const listeners = new Set();

  function getState() {
    return {
      ...state,
      items: [...state.items],
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
   * @param {object} [options]
   * @param {string|null} [options.query]
   * @param {string|null} [options.activityRegion]
   * @param {string|null} [options.cursor]
   * @param {boolean} [options.append]
   * @param {object} [options.searchOptions] — DI for facade (session, repository, …)
   */
  async function fetchDirectory(options = {}) {
    const append = Boolean(options.append);
    const query =
      options.query !== undefined ? options.query : state.effectiveQuery;
    const activityRegion =
      options.activityRegion !== undefined
        ? options.activityRegion
        : state.activityRegion;
    const cursor =
      options.cursor !== undefined
        ? options.cursor
        : append
          ? state.nextCursor
          : null;

    if (append && !cursor) {
      return getState();
    }

    const seq = state.requestSeq + 1;
    setState({
      requestSeq: seq,
      effectiveQuery: query,
      activityRegion,
      uiStatus: append
        ? DIRECTORY_LIST_UI_STATUS.LOADING_MORE
        : DIRECTORY_LIST_UI_STATUS.INITIAL_LOADING,
      loadingMore: append,
      error: null,
      ...(append
        ? {}
        : {
            items: [],
            nextCursor: null,
          }),
    });

    const result = await searchFn(
      {
        query: query || null,
        activityRegion,
        cursor,
        limit: DIRECTORY_SEARCH_DEFAULT_LIMIT,
      },
      options.searchOptions || {}
    );

    if (seq !== state.requestSeq) {
      return getState();
    }

    if (!result?.ok) {
      const code = result?.code || DIRECTORY_ERROR_CODES.BACKEND_UNAVAILABLE;
      if (code === DIRECTORY_ERROR_CODES.NOT_AUTHENTICATED) {
        return setState({
          uiStatus: DIRECTORY_LIST_UI_STATUS.UNAUTHENTICATED,
          items: [],
          nextCursor: null,
          loadingMore: false,
          error: {
            code,
            message: mapDirectoryListErrorMessage(code, result?.message),
            recoverable: false,
          },
        });
      }

      if (code === DIRECTORY_ERROR_CODES.INVALID_CURSOR) {
        // Clear pagination; do not auto-retry (avoids silent loops).
        return setState({
          uiStatus: DIRECTORY_LIST_UI_STATUS.ERROR,
          items: [],
          nextCursor: null,
          loadingMore: false,
          error: {
            code,
            message: mapDirectoryListErrorMessage(code, result?.message),
            recoverable: true,
            invalidCursor: true,
          },
        });
      }

      return setState({
        uiStatus: DIRECTORY_LIST_UI_STATUS.ERROR,
        items: append ? state.items : [],
        nextCursor: append ? state.nextCursor : null,
        loadingMore: false,
        error: {
          code,
          message: mapDirectoryListErrorMessage(code, result?.message),
          recoverable: true,
        },
      });
    }

    const incoming = Array.isArray(result.items) ? result.items : [];
    const items = append
      ? appendDirectoryItems(state.items, incoming)
      : appendDirectoryItems([], incoming);
    const nextCursor =
      result.nextCursor == null || result.nextCursor === ""
        ? null
        : String(result.nextCursor);

    return setState({
      items,
      nextCursor,
      loadingMore: false,
      error: null,
      uiStatus: resolveUiStatus({ items, query, activityRegion }),
    });
  }

  /**
   * Initial browse or full refresh with current effective filters.
   */
  async function loadInitial(searchOptions) {
    return fetchDirectory({
      query: state.effectiveQuery,
      activityRegion: state.activityRegion,
      cursor: null,
      append: false,
      searchOptions,
    });
  }

  /**
   * Apply search input after debounce. One-character inputs do not call the facade.
   * @param {string} rawInput
   * @param {object} [searchOptions]
   */
  async function applySearchInput(rawInput, searchOptions) {
    const resolved = resolveDirectorySearchInput(rawInput);
    setState({ searchInput: String(rawInput ?? "") });

    if (resolved.mode === "idle") {
      // Preserve existing results; no API call.
      return getState();
    }

    return fetchDirectory({
      query: resolved.query,
      activityRegion: state.activityRegion,
      cursor: null,
      append: false,
      searchOptions,
    });
  }

  /**
   * @param {string|null} region
   * @param {object} [searchOptions]
   */
  async function setActivityRegion(region, searchOptions) {
    const normalized =
      region == null || String(region).trim() === ""
        ? null
        : String(region).trim();
    return fetchDirectory({
      query: state.effectiveQuery,
      activityRegion: normalized,
      cursor: null,
      append: false,
      searchOptions,
    });
  }

  /**
   * Clear search text and return to browse (keeps region unless cleared separately).
   */
  async function clearSearch(searchOptions) {
    setState({ searchInput: "", effectiveQuery: null });
    return fetchDirectory({
      query: null,
      activityRegion: state.activityRegion,
      cursor: null,
      append: false,
      searchOptions,
    });
  }

  async function loadMore(searchOptions) {
    if (!state.nextCursor || state.loadingMore) {
      return getState();
    }
    return fetchDirectory({
      query: state.effectiveQuery,
      activityRegion: state.activityRegion,
      cursor: state.nextCursor,
      append: true,
      searchOptions,
    });
  }

  /**
   * Recoverable retry — always first page (cursor null).
   */
  async function retry(searchOptions) {
    return fetchDirectory({
      query: state.effectiveQuery,
      activityRegion: state.activityRegion,
      cursor: null,
      append: false,
      searchOptions,
    });
  }

  function setSearchInputLocal(value) {
    return setState({ searchInput: String(value ?? "") });
  }

  return {
    getState,
    subscribe,
    loadInitial,
    applySearchInput,
    setActivityRegion,
    clearSearch,
    loadMore,
    retry,
    setSearchInputLocal,
    fetchDirectory,
  };
}
