/**
 * NEWS-05 — Final integration certification (deterministic; no network).
 * Run: node --test tests/news-public-content-news-05-final-certification.test.js
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

import * as news from "../src/features/news-public-content/index.js";
import * as ExperienceChannels from "../src/features/experience-channels/index.js";
import {
  getPublicNews,
  PUBLIC_NEWS_ERROR_CODE,
  PUBLIC_NEWS_SOURCE,
  PUBLIC_NEWS_STATUS,
  resolvePublicNewsSource,
} from "../src/features/public-portal/services/publicNewsService.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

function sha256File(rel) {
  const buf = fs.readFileSync(path.join(ROOT, rel));
  return createHash("sha256").update(buf).digest("hex");
}

test("NEWS-05 phase flags: implementation complete, Production not deployed", () => {
  assert.equal(news.NEWS_PUBLIC_CONTENT_PHASE.id, "NEWS-05");
  assert.equal(news.NEWS_PUBLIC_CONTENT_PHASE.priorPhase, "NEWS-04");
  assert.equal(news.NEWS_PUBLIC_CONTENT_PHASE.wiredToPublicPortal, true);
  assert.equal(news.NEWS_PUBLIC_CONTENT_PHASE.hasStaging, true);
  assert.equal(news.NEWS_PUBLIC_CONTENT_PHASE.hasProduction, false);
  assert.equal(news.NEWS_PUBLIC_CONTENT_PHASE.productionBlocked, true);
  assert.equal(news.NEWS_PUBLIC_CONTENT_PHASE.productionDeployed, false);
  assert.equal(news.NEWS_PUBLIC_CONTENT_PHASE.implementationComplete, true);
  assert.equal(news.NEWS_PUBLIC_CONTENT_PHASE.hasSchedulerWorker, false);
  assert.equal(news.NEWS_PUBLIC_CONTENT_PHASE.hasMediaUpload, false);
});

test("NEWS-05 certification docs exist and do not overclaim Production deploy", () => {
  const cert = read(
    "docs/news-public-content/news-05/NEWS_05_FINAL_INTEGRATION_CERTIFICATION.md"
  );
  const decision = read(
    "docs/news-public-content/news-05/NEWS_05_PRODUCTION_READINESS_DECISION.md"
  );
  const closure = read(
    "docs/news-public-content/news-05/NEWS_05_MODULE_CLOSURE_CHECKLIST.md"
  );
  assert.match(cert, /NEWS_05_FINAL_ARCHITECTURE_AUDIT/);
  assert.match(decision, /PRODUCTION_GO_WITH_CONDITIONS/);
  assert.match(decision, /\*\*B\. PRODUCTION_GO_WITH_CONDITIONS\*\*/);
  assert.doesNotMatch(decision, /\*\*A\. PRODUCTION_GO\*\*/);
  assert.doesNotMatch(decision, /\*\*C\. PRODUCTION_NO_GO\*\*/);
  assert.match(closure, /MODULE_IMPLEMENTATION_COMPLETE/);
  assert.match(closure, /MODULE_PRODUCTION_DEPLOYED[\s\S]*NO/);
  assert.match(closure, /MODULE_100_PERCENT_CLOSED[\s\S]*NO/);
  assert.match(
    closure,
    /NEWS_PUBLIC_CONTENT_MODULE_IMPLEMENTATION_CLOSED_PRODUCTION_NOT_DEPLOYED/
  );
  assert.doesNotMatch(cert, /Production deployed/i);
  assert.match(decision, /OWNER_GO_REQUIRED_BEFORE_DATABASE_WRITE/);
});

test("NEWS-05 Production inventory harness is read-only and blocks Staging", () => {
  const script = read("scripts/news/news-05-production-readonly-inventory.mjs");
  assert.match(script, /expuvcohlcjzvrrauvud/);
  assert.match(script, /qyewbxjsiiyufanzcjcq/);
  assert.match(script, /MUTATION_RE/);
  assert.match(script, /assertReadOnlySql/);
  assert.match(script, /PRODUCTION_INVENTORY/);
  assert.doesNotMatch(script, /--execute/);
  assert.doesNotMatch(script, /CREATE OR REPLACE/i);
  assert.doesNotMatch(script, /service_role/);
});

test("NEWS-05 canonical public path contract remains wired", () => {
  const service = read("src/features/public-portal/services/publicNewsService.js");
  assert.match(service, /createNewsPublicContentFacade/);
  assert.match(service, /createSupabaseContentRepository/);
  assert.match(service, /preferRpc:\s*true/);
  assert.match(service, /getSupabaseAuthClient/);
  assert.doesNotMatch(service, /service_role/);
  assert.doesNotMatch(service, /VITE_SUPABASE_SERVICE/);
  const schema = read(
    "src/features/news-public-content/persistence/schema.js"
  );
  assert.match(schema, /news_public_content_query_public/);
});

test("NEWS-05 retained boundary: LIVE success/empty; live error & missing config no MOCK", async () => {
  assert.equal(resolvePublicNewsSource({}), PUBLIC_NEWS_SOURCE.LIVE);

  const liveOk = await getPublicNews({
    source: PUBLIC_NEWS_SOURCE.LIVE,
    now: "2026-07-25T12:00:00.000Z",
    deps: {
      facade: {
        async queryPublicCandidates() {
          return news.newsOk([
            {
              contentId: "c1",
              title: "Live title",
              summary: "s",
              provenance: news.CONTENT_PROVENANCE.LIVE,
              categoryReferences: [],
              mediaReferences: [],
              publishedAt: "2026-07-01T00:00:00.000Z",
              contentType: "NEWS",
            },
          ]);
        },
      },
    },
  });
  assert.equal(liveOk.status, PUBLIC_NEWS_STATUS.OK);
  assert.equal(liveOk.provenance, news.CONTENT_PROVENANCE.LIVE);

  const liveEmpty = await getPublicNews({
    source: PUBLIC_NEWS_SOURCE.LIVE,
    deps: {
      facade: {
        async queryPublicCandidates() {
          return news.newsOk([]);
        },
      },
    },
  });
  assert.equal(liveEmpty.status, PUBLIC_NEWS_STATUS.EMPTY);
  assert.equal(liveEmpty.provenance, news.CONTENT_PROVENANCE.LIVE);

  const liveErr = await getPublicNews({
    source: PUBLIC_NEWS_SOURCE.LIVE,
    deps: {
      facade: {
        async queryPublicCandidates() {
          throw new Error("network down");
        },
      },
    },
  });
  assert.equal(liveErr.status, PUBLIC_NEWS_STATUS.ERROR);
  assert.equal(liveErr.items.length, 0);
  assert.notEqual(liveErr.provenance, news.CONTENT_PROVENANCE.MOCK);
  assert.equal(liveErr.error.code, PUBLIC_NEWS_ERROR_CODE.NETWORK_FAILURE);

  const missing = await getPublicNews({
    source: PUBLIC_NEWS_SOURCE.LIVE,
    deps: {
      hasConfig: () => false,
      getConfigError: () => "missing",
    },
  });
  assert.equal(missing.status, PUBLIC_NEWS_STATUS.ERROR);
  assert.equal(missing.error.code, PUBLIC_NEWS_ERROR_CODE.CONFIG_MISSING);
  assert.notEqual(missing.provenance, news.CONTENT_PROVENANCE.MOCK);
});

test("NEWS-05 explicit MOCK/PREVIEW; unknown provenance fail-closed", async () => {
  const mock = await getPublicNews({ source: PUBLIC_NEWS_SOURCE.MOCK });
  assert.equal(mock.source, PUBLIC_NEWS_SOURCE.MOCK);
  assert.equal(mock.provenance, news.CONTENT_PROVENANCE.MOCK);

  const preview = await getPublicNews({
    source: PUBLIC_NEWS_SOURCE.PREVIEW,
    deps: {
      facade: {
        async queryPublicCandidates() {
          return news.newsOk([
            {
              contentId: "p1",
              title: "Preview",
              summary: "s",
              provenance: news.CONTENT_PROVENANCE.PREVIEW,
              categoryReferences: [],
              mediaReferences: [],
              publishedAt: "2026-07-01T00:00:00.000Z",
              contentType: "NEWS",
            },
          ]);
        },
      },
    },
  });
  assert.equal(preview.source, PUBLIC_NEWS_SOURCE.PREVIEW);
  assert.equal(preview.provenance, news.CONTENT_PROVENANCE.PREVIEW);

  const unknown = await getPublicNews({
    source: PUBLIC_NEWS_SOURCE.LIVE,
    deps: {
      facade: {
        async queryPublicCandidates() {
          return news.newsOk([
            {
              contentId: "u1",
              title: "Bad",
              summary: "s",
              provenance: "WEIRD",
              categoryReferences: [],
              mediaReferences: [],
              publishedAt: "2026-07-01T00:00:00.000Z",
              contentType: "NEWS",
            },
          ]);
        },
      },
    },
  });
  assert.equal(unknown.status, PUBLIC_NEWS_STATUS.ERROR);
  assert.equal(
    unknown.error.code,
    PUBLIC_NEWS_ERROR_CODE.UNSUPPORTED_PROVENANCE
  );
});

test("NEWS-05 EC ownership: /news LIVE; HOME notes no longer claim news mock-only", () => {
  const newsSurface = ExperienceChannels.getPublicPortalSurface(
    ExperienceChannels.PUBLIC_PORTAL_SURFACE_ID.PUBLIC_NEWS
  );
  assert.equal(
    newsSurface.dataSource,
    ExperienceChannels.PUBLIC_PORTAL_DATA_SOURCE.LIVE
  );
  const home = ExperienceChannels.getPublicPortalSurface(
    ExperienceChannels.PUBLIC_PORTAL_SURFACE_ID.PUBLIC_HOME
  );
  // Post-merge main tip: HOME notes project NEWS-04 typed result (not raw getPublicNews name).
  assert.match(String(home.dataSourceNotes), /NEWS-04 typed result/);
  assert.match(String(home.dataSourceNotes), /without silent empty-on-error/);
  assert.doesNotMatch(
    String(home.dataSourceNotes),
    /news, sponsors, upcoming events are mock-only/
  );
  const ready = ExperienceChannels.certifyPublicPortalReadiness();
  assert.equal(ready.ok, true, JSON.stringify(ready.issues, null, 2));
});

test("NEWS-05 package/lockfile hashes remain baseline", () => {
  assert.equal(
    sha256File("package.json").toUpperCase(),
    "CF0361BF8FC7F4AE6AA39587AB8489F4C1D3489C04B2E980EEC8E6EB396AFE0E"
  );
  assert.equal(
    sha256File("package-lock.json").toUpperCase(),
    "844840CA58B3EADCC4A1D090ABDCFCD057B7562F48BB1450D4A8AD1A1763B448"
  );
});

test("NEWS-05 no import-time network on news barrels", async () => {
  const before = performance.now();
  await import("../src/features/news-public-content/index.js");
  await import("../src/features/public-portal/services/publicPortalService.js");
  const elapsed = performance.now() - before;
  assert.ok(elapsed < 5000, `import too slow / suspicious: ${elapsed}`);
  const portal = read("src/features/public-portal/services/publicNewsService.js");
  assert.match(portal, /loadAuthClientModule/);
  assert.match(portal, /return import\(/);
});
