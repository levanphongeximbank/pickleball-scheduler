/**
 * NEWS-04 — Public Portal live provenance adoption (deterministic; no network).
 * Run: node --test tests/news-public-content-news-04-public-portal-live.test.js
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import * as news from "../src/features/news-public-content/index.js";
import {
  getPublicNews,
  mapPublicCandidateToPortalItem,
  mapPublicNewsFailure,
  PUBLIC_NEWS_ERROR_CODE,
  PUBLIC_NEWS_SOURCE,
  PUBLIC_NEWS_STATUS,
  resolvePublicNewsSource,
} from "../src/features/public-portal/services/publicNewsService.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const NOW = "2026-07-25T12:00:00.000Z";

function liveCandidate(overrides = {}) {
  return {
    contentId: "cnt_live_1",
    contentType: news.CONTENT_TYPE.NEWS,
    contentScope: news.CONTENT_SCOPE.TENANT,
    title: "Live pickleball open",
    summary: "Canonical live summary",
    slug: "live-pickleball-open",
    locale: "vi-VN",
    categoryReferences: [
      {
        categoryId: "cat_1",
        slug: "tin-tuc",
        displayLabel: "Tin tức",
        locale: "vi-VN",
      },
    ],
    tagReferences: [],
    mediaReferences: [],
    seoMetadata: {},
    publishedAt: "2026-07-20T00:00:00.000Z",
    publicationWindow: {
      publishAt: null,
      unpublishAt: null,
      timezone: null,
    },
    revisionId: "rev_1",
    version: 2,
    provenance: news.CONTENT_PROVENANCE.LIVE,
    editorialStatus: "PUBLISHED",
    publicVisibility: "PUBLIC",
    tenantId: "tenant-1",
    venueId: null,
    clubId: null,
    competitionId: null,
    banner: null,
    sponsor: null,
    archivedAt: null,
    // Must never leak into portal cards:
    approval: { secret: true },
    review: { secret: true },
    authorId: "author-secret",
    editorialOwnerId: "editor-secret",
    ...overrides,
  };
}

function facadeReturning(valueOrError) {
  return {
    async queryPublicCandidates() {
      if (valueOrError && valueOrError.__fail) {
        return news.newsFail(valueOrError.error);
      }
      return news.newsOk(Object.freeze([...(valueOrError || [])]));
    },
  };
}

test("NEWS-04 resolvePublicNewsSource defaults to live; honors explicit modes", () => {
  assert.equal(resolvePublicNewsSource({}), PUBLIC_NEWS_SOURCE.LIVE);
  assert.equal(
    resolvePublicNewsSource({ source: "mock" }),
    PUBLIC_NEWS_SOURCE.MOCK
  );
  assert.equal(
    resolvePublicNewsSource({ source: "PREVIEW" }),
    PUBLIC_NEWS_SOURCE.PREVIEW
  );
});

test("NEWS-04 live success with items preserves LIVE provenance", async () => {
  const result = await getPublicNews({
    now: NOW,
    source: PUBLIC_NEWS_SOURCE.LIVE,
    deps: { facade: facadeReturning([liveCandidate()]) },
  });
  assert.equal(result.status, PUBLIC_NEWS_STATUS.OK);
  assert.equal(result.provenance, news.CONTENT_PROVENANCE.LIVE);
  assert.equal(result.source, PUBLIC_NEWS_SOURCE.LIVE);
  assert.equal(result.isEmpty, false);
  assert.equal(result.error, null);
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].id, "cnt_live_1");
  assert.equal(result.items[0].title, "Live pickleball open");
  assert.equal(result.items[0].excerpt, "Canonical live summary");
  assert.equal(result.items[0].category, "Tin tức");
  assert.equal(result.items[0].provenance, news.CONTENT_PROVENANCE.LIVE);
  assert.equal(result.items[0].locale, "vi-VN");
  assert.equal(result.items[0].contentScope, news.CONTENT_SCOPE.TENANT);
  assert.equal("approval" in result.items[0], false);
  assert.equal("review" in result.items[0], false);
  assert.equal("authorId" in result.items[0], false);
  assert.equal("editorialOwnerId" in result.items[0], false);
});

test("NEWS-04 live success empty returns empty LIVE result (not mock)", async () => {
  const result = await getPublicNews({
    now: NOW,
    source: PUBLIC_NEWS_SOURCE.LIVE,
    deps: { facade: facadeReturning([]) },
  });
  assert.equal(result.status, PUBLIC_NEWS_STATUS.EMPTY);
  assert.equal(result.provenance, news.CONTENT_PROVENANCE.LIVE);
  assert.equal(result.isEmpty, true);
  assert.equal(result.items.length, 0);
  assert.equal(result.error, null);
});

test("NEWS-04 live failure does not fall back to MOCK", async () => {
  const result = await getPublicNews({
    now: NOW,
    source: PUBLIC_NEWS_SOURCE.LIVE,
    deps: {
      facade: facadeReturning({
        __fail: true,
        error: {
          code: news.NEWS_PUBLIC_CONTENT_ERROR_CODE.PERSISTENCE_UNAVAILABLE,
          message: "rpc down",
        },
      }),
    },
  });
  assert.equal(result.status, PUBLIC_NEWS_STATUS.ERROR);
  assert.equal(result.provenance, null);
  assert.equal(result.items.length, 0);
  assert.equal(result.error.code, PUBLIC_NEWS_ERROR_CODE.NETWORK_FAILURE);
  assert.notEqual(result.provenance, news.CONTENT_PROVENANCE.MOCK);
});

test("NEWS-04 missing config returns typed error without mock fallback", async () => {
  const result = await getPublicNews({
    now: NOW,
    source: PUBLIC_NEWS_SOURCE.LIVE,
    deps: {
      hasConfig: () => false,
      getConfigError: () => "missing vite supabase config",
    },
  });
  assert.equal(result.status, PUBLIC_NEWS_STATUS.ERROR);
  assert.equal(result.error.code, PUBLIC_NEWS_ERROR_CODE.CONFIG_MISSING);
  assert.equal(result.items.length, 0);
  assert.equal(result.provenance, null);
});

test("NEWS-04 explicit mock mode returns MOCK and never claims LIVE", async () => {
  const result = await getPublicNews({
    now: NOW,
    source: PUBLIC_NEWS_SOURCE.MOCK,
  });
  assert.ok(
    result.status === PUBLIC_NEWS_STATUS.OK ||
      result.status === PUBLIC_NEWS_STATUS.EMPTY
  );
  assert.equal(result.provenance, news.CONTENT_PROVENANCE.MOCK);
  assert.equal(result.source, PUBLIC_NEWS_SOURCE.MOCK);
  for (const item of result.items) {
    assert.equal(item.provenance, news.CONTENT_PROVENANCE.MOCK);
  }
});

test("NEWS-04 explicit preview returns PREVIEW and does not relabel LIVE", async () => {
  const result = await getPublicNews({
    now: NOW,
    source: PUBLIC_NEWS_SOURCE.PREVIEW,
    deps: {
      facade: facadeReturning([
        liveCandidate({
          contentId: "cnt_preview",
          provenance: news.CONTENT_PROVENANCE.PREVIEW,
        }),
      ]),
    },
  });
  assert.equal(result.status, PUBLIC_NEWS_STATUS.OK);
  assert.equal(result.provenance, news.CONTENT_PROVENANCE.PREVIEW);
  assert.equal(result.source, PUBLIC_NEWS_SOURCE.PREVIEW);
  assert.equal(result.items[0].provenance, news.CONTENT_PROVENANCE.PREVIEW);
});

test("NEWS-04 live public path defense-in-depth filters PREVIEW; unknown provenance rejected", async () => {
  // Primary boundary is News RPC/adapter (LIVE-only). Portal filter remains defense-in-depth
  // if a stale backend or injected facade still surfaces PREVIEW.
  const filtered = await getPublicNews({
    now: NOW,
    source: PUBLIC_NEWS_SOURCE.LIVE,
    deps: {
      facade: facadeReturning([
        liveCandidate({
          contentId: "cnt_preview_leak",
          provenance: news.CONTENT_PROVENANCE.PREVIEW,
        }),
        liveCandidate({ contentId: "cnt_live_ok" }),
      ]),
    },
  });
  assert.equal(filtered.status, PUBLIC_NEWS_STATUS.OK);
  assert.equal(filtered.items.length, 1);
  assert.equal(filtered.items[0].id, "cnt_live_ok");

  const rejected = await getPublicNews({
    now: NOW,
    source: PUBLIC_NEWS_SOURCE.LIVE,
    deps: {
      facade: facadeReturning([
        liveCandidate({ provenance: "LEGACY_UNVERIFIED" }),
      ]),
    },
  });
  assert.equal(rejected.status, PUBLIC_NEWS_STATUS.ERROR);
  assert.equal(
    rejected.error.code,
    PUBLIC_NEWS_ERROR_CODE.UNSUPPORTED_PROVENANCE
  );
});

test("NEWS-04 malformed RPC response rejected", async () => {
  const result = await getPublicNews({
    now: NOW,
    source: PUBLIC_NEWS_SOURCE.LIVE,
    deps: {
      facade: {
        async queryPublicCandidates() {
          return news.newsOk({ not: "an-array" });
        },
      },
    },
  });
  assert.equal(result.status, PUBLIC_NEWS_STATUS.ERROR);
  assert.equal(result.error.code, PUBLIC_NEWS_ERROR_CODE.MALFORMED_RESPONSE);
});

test("NEWS-04 mapping preserves publication fields and blocks editorial leak", () => {
  const item = mapPublicCandidateToPortalItem(
    liveCandidate({
      mediaReferences: [{ mediaId: "m1", mediaKind: "VIDEO" }],
    })
  );
  assert.equal(item.type, "video");
  assert.equal(item.publishedAt, "2026-07-20T00:00:00.000Z");
  assert.equal(item.slug, "live-pickleball-open");
  assert.equal(Object.hasOwn(item, "approval"), false);
  assert.equal(Object.hasOwn(item, "review"), false);
});

test("NEWS-04 permission/RLS failure maps to typed permission error (not mock)", () => {
  const mapped = mapPublicNewsFailure({
    code: news.NEWS_PUBLIC_CONTENT_ERROR_CODE.FORBIDDEN,
    message: "RLS denied",
  });
  assert.equal(mapped.code, PUBLIC_NEWS_ERROR_CODE.PERMISSION_DENIED);
});

test("NEWS-04 no import-time network / no service_role / no hardcoded secrets", () => {
  const servicePath = path.join(
    ROOT,
    "src/features/public-portal/services/publicNewsService.js"
  );
  const portalServicePath = path.join(
    ROOT,
    "src/features/public-portal/services/publicPortalService.js"
  );
  const text = [
    fs.readFileSync(servicePath, "utf8"),
    fs.readFileSync(portalServicePath, "utf8"),
  ].join("\n");

  assert.equal(text.includes("service_role"), false);
  assert.equal(text.includes("SERVICE_ROLE"), false);
  assert.doesNotMatch(text, /eyJ[A-Za-z0-9_-]{20,}/);
  assert.doesNotMatch(text, /sb_secret_/);
  assert.equal(text.includes(".from("), false);
  assert.ok(text.includes("queryPublicCandidates"));
  assert.ok(text.includes("createSupabaseContentRepository"));
  assert.ok(text.includes("preferRpc: true"));
});

test("NEWS-04 module import does not invoke getPublicNews network path", async () => {
  let called = false;
  const facade = {
    async queryPublicCandidates() {
      called = true;
      return news.newsOk([]);
    },
  };
  // Import already happened at top; ensure we only call when requested.
  assert.equal(called, false);
  await getPublicNews({
    now: NOW,
    source: PUBLIC_NEWS_SOURCE.LIVE,
    deps: { facade },
  });
  assert.equal(called, true);
});

test("NEWS-04 phase flags: portal wired, staging known, production blocked", () => {
  assert.equal(news.NEWS_PUBLIC_CONTENT_PHASE.id, "NEWS-04");
  assert.equal(news.NEWS_PUBLIC_CONTENT_PHASE.wiredToPublicPortal, true);
  assert.equal(news.NEWS_PUBLIC_CONTENT_PHASE.hasStaging, true);
  assert.equal(news.NEWS_PUBLIC_CONTENT_PHASE.hasProduction, false);
  assert.equal(news.NEWS_PUBLIC_CONTENT_PHASE.productionBlocked, true);
});

test("NEWS-04 docs and ownership boundary: News does not own NewsPage", () => {
  const decision = path.join(
    ROOT,
    "docs/news-public-content/news-04/00_NEWS_04_ARCHITECTURE_DECISION.md"
  );
  assert.ok(fs.existsSync(decision));
  const moduleFiles = [];
  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith(".js")) moduleFiles.push(full);
    }
  }
  walk(path.join(ROOT, "src/features/news-public-content"));
  for (const file of moduleFiles) {
    const text = fs.readFileSync(file, "utf8");
    assert.doesNotMatch(
      text,
      /from\s+["'][^"']*pages\/public\//,
      file
    );
    assert.doesNotMatch(
      text,
      /import\s+.*NewsPage/,
      file
    );
  }
});
