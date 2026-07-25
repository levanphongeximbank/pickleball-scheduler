/**
 * NEWS-04 — Public Portal UI provenance presentation (source + contract checks).
 * Run: node --test tests/news-public-content-news-04-portal-ui.test.js
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import * as ExperienceChannels from "../src/features/experience-channels/index.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

test("NEWS-04 NewsPage wires loading/error/empty/data + mock/preview badges", () => {
  const page = read("src/pages/public/NewsPage.jsx");
  assert.match(page, /PublicLoadingState/);
  assert.match(page, /PublicErrorState/);
  assert.match(page, /PublicEmptyState/);
  assert.match(page, /public-news-data-state/);
  assert.match(page, /public-news-provenance-\$\{/);
  assert.match(page, /Dữ liệu mẫu \(MOCK\)/);
  assert.match(page, /Bản xem trước \(PREVIEW\)/);
  assert.match(page, /getPublicNews\(/);
  assert.doesNotMatch(page, /MOCK_NEWS/);
  assert.doesNotMatch(page, /service_role/);
});

test("NEWS-04 HomePage loads news asynchronously and does not sync-slice mock", () => {
  const home = read("src/pages/public/HomePage.jsx");
  assert.match(home, /getPublicNews\(/);
  assert.match(home, /useEffect/);
  assert.match(home, /getPublicNewsItemsOrEmpty/);
  assert.doesNotMatch(home, /getPublicNews\(\)\.slice/);
});

test("NEWS-04 EC registry marks /news as LIVE with presentation states", () => {
  const news = ExperienceChannels.getPublicPortalSurface(
    ExperienceChannels.PUBLIC_PORTAL_SURFACE_ID.PUBLIC_NEWS
  );
  assert.equal(news.dataSource, ExperienceChannels.PUBLIC_PORTAL_DATA_SOURCE.LIVE);
  assert.equal(
    news.overallReadiness,
    ExperienceChannels.EXPERIENCE_CHANNEL_READINESS.PARTIAL
  );
  assert.notEqual(
    news.loadingStateReadiness,
    ExperienceChannels.EXPERIENCE_CHANNEL_READINESS.MISSING
  );
  assert.notEqual(
    news.errorStateReadiness,
    ExperienceChannels.EXPERIENCE_CHANNEL_READINESS.MISSING
  );
  assert.equal(news.safeForRemediation, true);
  assert.match(String(news.dataSourceNotes), /NEWS-04/);
});

test("NEWS-04 public portal readiness certification remains green", () => {
  const result = ExperienceChannels.certifyPublicPortalReadiness();
  assert.equal(result.ok, true, JSON.stringify(result.issues, null, 2));
});

test("NEWS-04 security: portal news path uses News barrel, not internals or base tables", () => {
  const service = read("src/features/public-portal/services/publicNewsService.js");
  assert.match(service, /from "\.\.\/\.\.\/news-public-content\/index\.js"/);
  assert.doesNotMatch(service, /news-public-content\/persistence\//);
  assert.doesNotMatch(service, /news-public-content\/application\//);
  assert.doesNotMatch(service, /\.from\(\s*NEWS_TABLE/);
  assert.doesNotMatch(service, /createClient\(/);
  assert.match(service, /getSupabaseAuthClient/);
  assert.match(service, /hasSupabaseConfig/);
  assert.match(service, /loadAuthClientModule/);
  assert.match(service, /return import\(/);
});
