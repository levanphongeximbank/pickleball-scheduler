/**
 * EC-02 — Public Portal Presentation Hardening (unit / source contracts).
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import * as ExperienceChannels from "../src/features/experience-channels/index.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const STATE_FILE = "src/components/public/states/PublicPresentationStates.jsx";
const STATE_INDEX = "src/components/public/states/index.js";
const TITLE_HOOK = "src/components/public/usePublicDocumentTitle.js";

const WIRED_PAGES = [
  "src/pages/public/ClubsPage.jsx",
  "src/pages/public/TournamentsPage.jsx",
  "src/pages/public/CourtsPage.jsx",
  "src/pages/public/RankingsPage.jsx",
  "src/pages/public/NewsPage.jsx",
  "src/pages/public/HomePage.jsx",
];

function readSrc(rel) {
  return readFileSync(path.join(ROOT, rel), "utf8");
}

test("EC-02 presentation primitives export the four required states", () => {
  const barrel = readSrc(STATE_INDEX);
  for (const name of [
    "PublicLoadingState",
    "PublicEmptyState",
    "PublicErrorState",
    "PublicUnavailableState",
  ]) {
    assert.match(barrel, new RegExp(name));
  }

  const source = readSrc(STATE_FILE);
  assert.match(source, /role="status"/);
  assert.match(source, /role="alert"/);
  assert.match(source, /aria-live="polite"/);
  assert.match(source, /aria-busy="true"/);
  assert.match(source, /aria-hidden/);
  assert.match(source, /data-testid="public-loading-state"/);
  assert.match(source, /data-testid="public-empty-state"/);
  assert.match(source, /data-testid="public-error-state"/);
  assert.match(source, /data-testid="public-unavailable-state"/);
  assert.match(source, /focus-visible/);
  assert.match(source, /minHeight:\s*44/);
  assert.doesNotMatch(source, /competition-engine/);
  assert.doesNotMatch(source, /getPublicRankings|standings|eligibility/);
  assert.doesNotMatch(source, /fetch\(|supabase|navigate\(/i);
});

test("EC-02 page-local document title hook stays page-scoped", () => {
  const hook = readSrc(TITLE_HOOK);
  assert.match(hook, /document\.title/);
  assert.match(hook, /useEffect/);
  assert.doesNotMatch(hook, /from\s+["']react-helmet/);
  assert.doesNotMatch(hook, /from\s+["'].*router\.jsx/);
  assert.doesNotMatch(hook, /from\s+["'].*main\.jsx/);
  assert.doesNotMatch(hook, /createBrowserRouter|BrowserRouter/);
});

test("safe public pages consume presentation primitives and titles without Competition imports", () => {
  for (const page of WIRED_PAGES) {
    const src = readSrc(page);
    assert.match(src, /usePublicDocumentTitle/);
    assert.doesNotMatch(src, /competition-engine/);
    assert.doesNotMatch(src, /from\s+["'].*TournamentUiState/);
  }

  for (const page of [
    "src/pages/public/ClubsPage.jsx",
    "src/pages/public/TournamentsPage.jsx",
    "src/pages/public/CourtsPage.jsx",
    "src/pages/public/RankingsPage.jsx",
    "src/pages/public/NewsPage.jsx",
  ]) {
    assert.match(readSrc(page), /PublicEmptyState/);
    assert.match(readSrc(page), /component="h1"/);
  }
});

test("EC-02 does not edit global high-collision shells in this slice evidence", () => {
  // Source scan: primitives and pages must not import router registration APIs
  const state = readSrc(STATE_FILE);
  assert.doesNotMatch(state, /PublicLayout|PublicHeader|PublicFooter/);
  assert.doesNotMatch(readSrc(TITLE_HOOK), /PublicLayout|createBrowserRouter/);
});

test("EC-00 and EC-01 certifications remain green after EC-02 presentation updates", () => {
  const ec00 = ExperienceChannels.certifyExperienceChannelRegistry();
  assert.equal(ec00.ok, true, JSON.stringify(ec00.issues, null, 2));

  const ec01 = ExperienceChannels.certifyPublicPortalReadiness();
  assert.equal(ec01.ok, true, JSON.stringify(ec01.issues, null, 2));
  assert.equal(ec01.phase, "EC-01");
  assert.equal(ec01.surfaceCount, 7);

  // Gaps must not be hidden: news stays MOCK overall readiness
  const news = ExperienceChannels.getPublicPortalSurface(
    ExperienceChannels.PUBLIC_PORTAL_SURFACE_ID.PUBLIC_NEWS
  );
  assert.equal(news.dataSource, ExperienceChannels.PUBLIC_PORTAL_DATA_SOURCE.MOCK);
  assert.equal(news.overallReadiness, ExperienceChannels.EXPERIENCE_CHANNEL_READINESS.MOCK);

  // Loading/error remain MISSING on list pages that still use sync mock-backed fetch
  const clubs = ExperienceChannels.getPublicPortalSurface(
    ExperienceChannels.PUBLIC_PORTAL_SURFACE_ID.PUBLIC_CLUBS
  );
  assert.equal(
    clubs.loadingStateReadiness,
    ExperienceChannels.EXPERIENCE_CHANNEL_READINESS.MISSING
  );
  assert.equal(
    clubs.errorStateReadiness,
    ExperienceChannels.EXPERIENCE_CHANNEL_READINESS.MISSING
  );
  assert.equal(
    clubs.emptyStateReadiness,
    ExperienceChannels.EXPERIENCE_CHANNEL_READINESS.PARTIAL
  );
});

test("EC-02 docs and ARCHITECTURE section exist", () => {
  const readme = readSrc("docs/experience-channels/ec-02/README.md");
  assert.match(readme, /EC-02/);
  assert.match(readme, /presentation/i);

  const arch = readSrc("src/features/experience-channels/ARCHITECTURE.md");
  assert.match(arch, /EC-02 — Public Portal Presentation Hardening/);
});
