/**
 * Public Portal news — live-first, provenance-honest (NEWS-04).
 *
 * Canonical path:
 *   getPublicNews → News facade.queryPublicCandidates →
 *   createSupabaseContentRepository → news_public_content_query_public RPC
 *
 * No silent mock fallback. No import-time network. Anon client only.
 */

import { MOCK_NEWS } from "../../../data/public/mockPublicData.js";
import {
  CONTENT_PROVENANCE,
  NEWS_PUBLIC_CONTENT_ERROR_CODE,
  createFixedClockPort,
  createNewsPublicContentFacade,
  createSequentialIdProviderPort,
  createSupabaseContentRepository,
  isContentProvenance,
  isFail,
  isNewsPublicContentError,
  isOk,
} from "../../news-public-content/index.js";

/** Lazy auth import — avoids loading @supabase/supabase-js at module import time. */
async function loadAuthClientModule() {
  return import("../../../auth/supabaseClient.js");
}

export const PUBLIC_NEWS_SOURCE = Object.freeze({
  LIVE: "live",
  MOCK: "mock",
  PREVIEW: "preview",
});

export const PUBLIC_NEWS_STATUS = Object.freeze({
  OK: "ok",
  EMPTY: "empty",
  ERROR: "error",
});

export const PUBLIC_NEWS_ERROR_CODE = Object.freeze({
  CONFIG_MISSING: "PUBLIC_NEWS_CONFIG_MISSING",
  NETWORK_FAILURE: "PUBLIC_NEWS_NETWORK_FAILURE",
  RPC_FAILURE: "PUBLIC_NEWS_RPC_FAILURE",
  PERMISSION_DENIED: "PUBLIC_NEWS_PERMISSION_DENIED",
  MALFORMED_RESPONSE: "PUBLIC_NEWS_MALFORMED_RESPONSE",
  UNSUPPORTED_PROVENANCE: "PUBLIC_NEWS_UNSUPPORTED_PROVENANCE",
  PREVIEW_LEAK_BLOCKED: "PUBLIC_NEWS_PREVIEW_LEAK_BLOCKED",
  CLIENT_UNAVAILABLE: "PUBLIC_NEWS_CLIENT_UNAVAILABLE",
  UNKNOWN: "PUBLIC_NEWS_UNKNOWN",
});

const USER_MESSAGES = Object.freeze({
  [PUBLIC_NEWS_ERROR_CODE.CONFIG_MISSING]:
    "Tin tức công khai chưa được cấu hình. Vui lòng thử lại sau.",
  [PUBLIC_NEWS_ERROR_CODE.NETWORK_FAILURE]:
    "Không kết nối được máy chủ tin tức. Vui lòng thử lại sau.",
  [PUBLIC_NEWS_ERROR_CODE.RPC_FAILURE]:
    "Không tải được tin tức công khai. Vui lòng thử lại sau.",
  [PUBLIC_NEWS_ERROR_CODE.PERMISSION_DENIED]:
    "Không có quyền xem tin tức công khai lúc này.",
  [PUBLIC_NEWS_ERROR_CODE.MALFORMED_RESPONSE]:
    "Dữ liệu tin tức không hợp lệ. Vui lòng thử lại sau.",
  [PUBLIC_NEWS_ERROR_CODE.UNSUPPORTED_PROVENANCE]:
    "Nguồn tin tức không được hỗ trợ trên cổng công khai.",
  [PUBLIC_NEWS_ERROR_CODE.PREVIEW_LEAK_BLOCKED]:
    "Nội dung xem trước không khả dụng trên cổng công khai.",
  [PUBLIC_NEWS_ERROR_CODE.CLIENT_UNAVAILABLE]:
    "Dịch vụ tin tức tạm thời không khả dụng.",
  [PUBLIC_NEWS_ERROR_CODE.UNKNOWN]:
    "Đã xảy ra lỗi khi tải tin tức. Vui lòng thử lại sau.",
});

/**
 * @param {unknown} value
 * @returns {string|null}
 */
function readEnvNewsSource(value) {
  const raw = String(value || "")
    .trim()
    .toLowerCase();
  if (raw === PUBLIC_NEWS_SOURCE.MOCK) return PUBLIC_NEWS_SOURCE.MOCK;
  if (raw === PUBLIC_NEWS_SOURCE.PREVIEW) return PUBLIC_NEWS_SOURCE.PREVIEW;
  if (raw === PUBLIC_NEWS_SOURCE.LIVE) return PUBLIC_NEWS_SOURCE.LIVE;
  return null;
}

/**
 * Explicit source selection. Default is live (never silent mock).
 * @param {{ source?: string }} [options]
 * @returns {"live"|"mock"|"preview"}
 */
export function resolvePublicNewsSource(options = {}) {
  const explicit = readEnvNewsSource(options.source);
  if (explicit) return explicit;

  const env =
    typeof import.meta !== "undefined" && import.meta.env
      ? import.meta.env.VITE_PUBLIC_NEWS_SOURCE
      : undefined;
  const nodeEnv =
    typeof globalThis.process !== "undefined"
      ? globalThis.process.env?.VITE_PUBLIC_NEWS_SOURCE
      : undefined;
  const fromEnv = readEnvNewsSource(env || nodeEnv);
  if (fromEnv) return fromEnv;

  return PUBLIC_NEWS_SOURCE.LIVE;
}

/**
 * @param {object} partial
 */
function freezeResult(partial) {
  const items = Object.freeze([...(partial.items || [])]);
  const isEmpty = items.length === 0;
  const status =
    partial.status ||
    (partial.error
      ? PUBLIC_NEWS_STATUS.ERROR
      : isEmpty
        ? PUBLIC_NEWS_STATUS.EMPTY
        : PUBLIC_NEWS_STATUS.OK);

  return Object.freeze({
    status,
    items,
    provenance: partial.provenance ?? null,
    source: partial.source,
    error: partial.error ? Object.freeze({ ...partial.error }) : null,
    fetchedAt: partial.fetchedAt || new Date().toISOString(),
    isEmpty: status === PUBLIC_NEWS_STATUS.ERROR ? true : isEmpty,
    diagnostics: Object.freeze({
      itemCount: items.length,
      source: partial.source,
      provenance: partial.provenance ?? null,
      errorCode: partial.error?.code ?? null,
      ...(partial.diagnostics || {}),
    }),
  });
}

/**
 * @param {string} code
 * @param {string} message
 * @param {Record<string, unknown>} [details]
 */
function typedError(code, message, details = {}) {
  return Object.freeze({
    code,
    message,
    userMessage: USER_MESSAGES[code] || USER_MESSAGES[PUBLIC_NEWS_ERROR_CODE.UNKNOWN],
    details: Object.freeze({ ...details }),
  });
}

/**
 * Map News public candidate → Public Portal card model.
 * Does not leak editorial approval/review/author fields.
 * @param {Record<string, unknown>} candidate
 */
export function mapPublicCandidateToPortalItem(candidate) {
  if (!candidate || typeof candidate !== "object") {
    throw typedError(
      PUBLIC_NEWS_ERROR_CODE.MALFORMED_RESPONSE,
      "Public news candidate must be an object"
    );
  }

  const contentId = candidate.contentId;
  if (!contentId || typeof contentId !== "string") {
    throw typedError(
      PUBLIC_NEWS_ERROR_CODE.MALFORMED_RESPONSE,
      "Public news candidate missing contentId"
    );
  }

  const provenance = candidate.provenance;
  if (!isContentProvenance(provenance)) {
    throw typedError(
      PUBLIC_NEWS_ERROR_CODE.UNSUPPORTED_PROVENANCE,
      "Public news candidate has unsupported provenance",
      { contentId, provenance }
    );
  }

  const title = String(candidate.title || "").trim();
  if (!title) {
    throw typedError(
      PUBLIC_NEWS_ERROR_CODE.MALFORMED_RESPONSE,
      "Public news candidate missing title",
      { contentId }
    );
  }

  const categories = Array.isArray(candidate.categoryReferences)
    ? candidate.categoryReferences
    : [];
  const firstCategory = categories[0];
  const category =
    (firstCategory &&
      (firstCategory.displayLabel || firstCategory.label || firstCategory.slug)) ||
    mapContentTypeLabel(candidate.contentType);

  const media = Array.isArray(candidate.mediaReferences)
    ? candidate.mediaReferences
    : [];
  const isVideo = media.some(
    (m) =>
      m &&
      (m.mediaKind === "VIDEO" || m.kind === "VIDEO" || m.type === "video")
  );

  const publishedAt = candidate.publishedAt || null;
  const date = formatPublicDate(publishedAt);

  return Object.freeze({
    id: contentId,
    title,
    excerpt: String(candidate.summary || "").trim(),
    category: String(category),
    date,
    type: isVideo ? "video" : "article",
    image: null,
    slug: candidate.slug || null,
    locale: candidate.locale || null,
    contentScope: candidate.contentScope || null,
    contentType: candidate.contentType || null,
    publishedAt,
    provenance,
  });
}

/**
 * @param {unknown} contentType
 */
function mapContentTypeLabel(contentType) {
  switch (contentType) {
    case "NEWS":
      return "Tin tức";
    case "ARTICLE":
      return "Bài viết";
    case "ANNOUNCEMENT":
      return "Thông báo";
    case "TOURNAMENT_CONTENT":
      return "Giải đấu";
    case "VENUE_CONTENT":
      return "Sân";
    case "CLUB_CONTENT":
      return "CLB";
    default:
      return "Tin tức";
  }
}

/**
 * @param {unknown} value
 */
function formatPublicDate(value) {
  if (!value) return "—";
  const date = new Date(/** @type {string} */ (value));
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString("vi-VN");
}

/**
 * @param {unknown} row
 */
function mapMockRowToPortalItem(row) {
  return Object.freeze({
    id: row.id,
    title: row.title,
    excerpt: row.excerpt,
    category: row.category,
    date: row.date,
    type: row.type === "video" ? "video" : "article",
    image: row.image ?? null,
    slug: null,
    locale: null,
    contentScope: null,
    contentType: null,
    publishedAt: null,
    provenance: CONTENT_PROVENANCE.MOCK,
  });
}

/**
 * Map News / Supabase typed errors → portal error codes (no secrets).
 * @param {unknown} err
 */
export function mapPublicNewsFailure(err) {
  if (err && typeof err === "object" && "code" in err && "userMessage" in err) {
    return /** @type {{ code: string, message: string, userMessage: string, details?: object }} */ (
      err
    );
  }

  const code =
    (err && typeof err === "object" && /** @type {{ code?: string }} */ (err).code) ||
    null;
  const message =
    err instanceof Error
      ? err.message
      : err && typeof err === "object" && "message" in err
        ? String(/** @type {{ message: unknown }} */ (err).message)
        : "Public news failure";

  if (
    code === NEWS_PUBLIC_CONTENT_ERROR_CODE.FORBIDDEN ||
    code === "42501" ||
    /permission|rls|forbidden|jwt/i.test(message)
  ) {
    return typedError(PUBLIC_NEWS_ERROR_CODE.PERMISSION_DENIED, message, {
      upstreamCode: code,
    });
  }

  if (
    code === NEWS_PUBLIC_CONTENT_ERROR_CODE.PERSISTENCE_UNAVAILABLE ||
    code === "408" ||
    code === "503" ||
    code === "504" ||
    /network|timeout|fetch failed|failed to fetch/i.test(message)
  ) {
    return typedError(PUBLIC_NEWS_ERROR_CODE.NETWORK_FAILURE, message, {
      upstreamCode: code,
    });
  }

  if (
    code === NEWS_PUBLIC_CONTENT_ERROR_CODE.PROVENANCE_MISMATCH ||
    code === PUBLIC_NEWS_ERROR_CODE.UNSUPPORTED_PROVENANCE
  ) {
    return typedError(PUBLIC_NEWS_ERROR_CODE.UNSUPPORTED_PROVENANCE, message, {
      upstreamCode: code,
    });
  }

  if (
    code === NEWS_PUBLIC_CONTENT_ERROR_CODE.INVALID_CONTRACT ||
    code === PUBLIC_NEWS_ERROR_CODE.MALFORMED_RESPONSE
  ) {
    return typedError(PUBLIC_NEWS_ERROR_CODE.MALFORMED_RESPONSE, message, {
      upstreamCode: code,
    });
  }

  if (isNewsPublicContentError(err) || code) {
    return typedError(PUBLIC_NEWS_ERROR_CODE.RPC_FAILURE, message, {
      upstreamCode: code,
    });
  }

  return typedError(PUBLIC_NEWS_ERROR_CODE.UNKNOWN, message);
}

/**
 * @param {Record<string, unknown>[]} candidates
 * @param {"live"|"preview"} mode
 */
function projectCandidatesForMode(candidates, mode) {
  if (!Array.isArray(candidates)) {
    throw typedError(
      PUBLIC_NEWS_ERROR_CODE.MALFORMED_RESPONSE,
      "queryPublicCandidates must return an array"
    );
  }

  /** @type {ReturnType<typeof mapPublicCandidateToPortalItem>[]} */
  const items = [];

  for (const candidate of candidates) {
    const provenance = candidate?.provenance;

    if (!isContentProvenance(provenance)) {
      throw typedError(
        PUBLIC_NEWS_ERROR_CODE.UNSUPPORTED_PROVENANCE,
        "Rejecting unknown provenance on public news path",
        { provenance }
      );
    }

    if (mode === PUBLIC_NEWS_SOURCE.LIVE) {
      if (provenance === CONTENT_PROVENANCE.MOCK) {
        throw typedError(
          PUBLIC_NEWS_ERROR_CODE.UNSUPPORTED_PROVENANCE,
          "MOCK provenance must not appear on live public path",
          { contentId: candidate.contentId }
        );
      }
      // Public production route: never surface PREVIEW (no relabel to LIVE).
      if (provenance === CONTENT_PROVENANCE.PREVIEW) {
        continue;
      }
      if (provenance !== CONTENT_PROVENANCE.LIVE) {
        throw typedError(
          PUBLIC_NEWS_ERROR_CODE.UNSUPPORTED_PROVENANCE,
          "Unexpected provenance on live public path",
          { provenance }
        );
      }
    }

    if (mode === PUBLIC_NEWS_SOURCE.PREVIEW) {
      if (provenance === CONTENT_PROVENANCE.MOCK) {
        throw typedError(
          PUBLIC_NEWS_ERROR_CODE.UNSUPPORTED_PROVENANCE,
          "MOCK provenance is not valid in preview mode",
          { contentId: candidate.contentId }
        );
      }
      if (
        provenance !== CONTENT_PROVENANCE.PREVIEW &&
        provenance !== CONTENT_PROVENANCE.LIVE
      ) {
        throw typedError(
          PUBLIC_NEWS_ERROR_CODE.UNSUPPORTED_PROVENANCE,
          "Unexpected provenance in preview mode",
          { provenance }
        );
      }
    }

    items.push(mapPublicCandidateToPortalItem(candidate));
  }

  return items;
}

/**
 * @param {object} [options]
 * @param {string} [options.source] explicit live|mock|preview
 * @param {number} [options.limit]
 * @param {string} [options.locale]
 * @param {string} [options.contentScope]
 * @param {string} [options.now]
 * @param {{
 *   hasConfig?: () => boolean,
 *   getConfigError?: () => string|null,
 *   getClient?: () => object|null,
 *   facade?: { queryPublicCandidates: Function },
 *   createFacade?: Function,
 * }} [options.deps]
 */
export async function getPublicNews(options = {}) {
  const fetchedAt = options.now || new Date().toISOString();
  const source = resolvePublicNewsSource(options);
  const deps = options.deps || {};

  if (source === PUBLIC_NEWS_SOURCE.MOCK) {
    const items = (MOCK_NEWS || []).map(mapMockRowToPortalItem);
    return freezeResult({
      status: items.length ? PUBLIC_NEWS_STATUS.OK : PUBLIC_NEWS_STATUS.EMPTY,
      items,
      provenance: CONTENT_PROVENANCE.MOCK,
      source: PUBLIC_NEWS_SOURCE.MOCK,
      error: null,
      fetchedAt,
      diagnostics: { mode: "explicit_mock" },
    });
  }

  let hasConfig = deps.hasConfig;
  let getConfigError = deps.getConfigError;
  let getClient = deps.getClient;

  // Fail closed on missing config before loading auth client module.
  if (typeof hasConfig === "function" && !hasConfig()) {
    return freezeResult({
      status: PUBLIC_NEWS_STATUS.ERROR,
      items: [],
      provenance: null,
      source,
      error: typedError(
        PUBLIC_NEWS_ERROR_CODE.CONFIG_MISSING,
        (typeof getConfigError === "function" && getConfigError()) ||
          "Missing Supabase public configuration"
      ),
      fetchedAt,
      diagnostics: { mode: source, configPresent: false },
    });
  }

  try {
    let facade = deps.facade;
    if (!facade) {
      if (!getClient || !hasConfig || !getConfigError) {
        const auth = await loadAuthClientModule();
        hasConfig = hasConfig || auth.hasSupabaseConfig;
        getConfigError = getConfigError || auth.getSupabaseConfigError;
        getClient = getClient || auth.getSupabaseAuthClient;
      }

      if (typeof hasConfig === "function" && !hasConfig()) {
        return freezeResult({
          status: PUBLIC_NEWS_STATUS.ERROR,
          items: [],
          provenance: null,
          source,
          error: typedError(
            PUBLIC_NEWS_ERROR_CODE.CONFIG_MISSING,
            (typeof getConfigError === "function" && getConfigError()) ||
              "Missing Supabase public configuration"
          ),
          fetchedAt,
          diagnostics: { mode: source, configPresent: false },
        });
      }

      if (typeof getClient !== "function") {
        return freezeResult({
          status: PUBLIC_NEWS_STATUS.ERROR,
          items: [],
          provenance: null,
          source,
          error: typedError(
            PUBLIC_NEWS_ERROR_CODE.CLIENT_UNAVAILABLE,
            "Supabase anon client resolver unavailable"
          ),
          fetchedAt,
        });
      }
      const client = getClient();
      if (!client) {
        return freezeResult({
          status: PUBLIC_NEWS_STATUS.ERROR,
          items: [],
          provenance: null,
          source,
          error: typedError(
            PUBLIC_NEWS_ERROR_CODE.CLIENT_UNAVAILABLE,
            "Supabase anon client unavailable"
          ),
          fetchedAt,
        });
      }

      const repository = createSupabaseContentRepository({
        client,
        preferRpc: true,
      });
      const createFacade = deps.createFacade || createNewsPublicContentFacade;
      facade = createFacade({
        repository,
        clock: createFixedClockPort(fetchedAt),
        idProvider: createSequentialIdProviderPort("portal-news"),
      });
    }

    const queryResult = await facade.queryPublicCandidates({
      now: fetchedAt,
      locale: options.locale ?? null,
      contentScope: options.contentScope ?? null,
      limit: options.limit ?? 50,
    });

    if (isFail(queryResult)) {
      return freezeResult({
        status: PUBLIC_NEWS_STATUS.ERROR,
        items: [],
        provenance: null,
        source,
        error: mapPublicNewsFailure(queryResult.error),
        fetchedAt,
      });
    }

    if (!isOk(queryResult)) {
      return freezeResult({
        status: PUBLIC_NEWS_STATUS.ERROR,
        items: [],
        provenance: null,
        source,
        error: typedError(
          PUBLIC_NEWS_ERROR_CODE.MALFORMED_RESPONSE,
          "Unexpected facade result shape"
        ),
        fetchedAt,
      });
    }

    const candidates = queryResult.value;
    const items = projectCandidatesForMode(
      /** @type {Record<string, unknown>[]} */ (candidates),
      source === PUBLIC_NEWS_SOURCE.PREVIEW
        ? PUBLIC_NEWS_SOURCE.PREVIEW
        : PUBLIC_NEWS_SOURCE.LIVE
    );

    const resultProvenance =
      source === PUBLIC_NEWS_SOURCE.PREVIEW
        ? CONTENT_PROVENANCE.PREVIEW
        : CONTENT_PROVENANCE.LIVE;

    return freezeResult({
      status: items.length ? PUBLIC_NEWS_STATUS.OK : PUBLIC_NEWS_STATUS.EMPTY,
      items,
      provenance: resultProvenance,
      source,
      error: null,
      fetchedAt,
      diagnostics: {
        mode: source,
        candidateCount: Array.isArray(candidates) ? candidates.length : 0,
      },
    });
  } catch (err) {
    return freezeResult({
      status: PUBLIC_NEWS_STATUS.ERROR,
      items: [],
      provenance: null,
      source,
      error: mapPublicNewsFailure(err),
      fetchedAt,
    });
  }
}

/**
 * Convenience for sync call sites that only need items after await.
 * @param {Awaited<ReturnType<typeof getPublicNews>>} result
 */
export function getPublicNewsItemsOrEmpty(result) {
  if (!result || result.status === PUBLIC_NEWS_STATUS.ERROR) return [];
  return result.items;
}
