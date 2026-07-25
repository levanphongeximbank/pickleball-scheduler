/**
 * NEWS-01 test doubles — test scope only. Not a production source of truth.
 */

import * as news from "../../src/features/news-public-content/index.js";

/**
 * @param {string} [startNow]
 */
export function createNewsTestDeps(startNow = "2026-07-25T00:00:00.000Z") {
  /** @type {Map<string, any>} */
  const store = new Map();
  let now = startNow;
  let seq = 0;

  const repository = {
    async getByContentId(contentId) {
      return store.get(contentId) || null;
    },
    async save(content) {
      store.set(content.contentId, content);
      return content;
    },
    async queryPublicCandidates() {
      return [...store.values()].filter(
        (c) => c.editorialStatus === news.EDITORIAL_STATUS.PUBLISHED
      );
    },
    async findSlugCollision({ slug, locale, excludeContentId }) {
      for (const c of store.values()) {
        if (excludeContentId && c.contentId === excludeContentId) continue;
        if (c.slug === slug && c.locale === locale) return c;
      }
      return null;
    },
    async detectVersionConflict({ contentId, expectedVersion }) {
      const c = store.get(contentId);
      if (!c) return null;
      return c.version !== expectedVersion
        ? { contentId, expectedVersion, actualVersion: c.version }
        : null;
    },
  };

  return {
    repository,
    clock: {
      now() {
        return now;
      },
    },
    idProvider: {
      nextId(prefix = "id") {
        seq += 1;
        return `${prefix}_${seq}`;
      },
    },
    setNow(iso) {
      now = iso;
    },
    store,
  };
}

/**
 * @param {Record<string, unknown>} [overrides]
 */
export function baseDraftInput(overrides = {}) {
  return {
    contentType: news.CONTENT_TYPE.NEWS,
    contentScope: news.CONTENT_SCOPE.TENANT,
    tenantId: "tenant-1",
    authorId: "author-1",
    editorialOwnerId: "editor-1",
    title: "Pickleball Open Announcement",
    summary: "Summary of the news item",
    slug: "pickleball-open-announcement",
    locale: "vi-VN",
    provenance: news.CONTENT_PROVENANCE.PREVIEW,
    ...overrides,
  };
}
