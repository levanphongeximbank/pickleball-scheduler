import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  CLUB_ROUTE_PATHS,
  MY_CLUB_MEMBER_VIEWS,
  resolveLegacyMyClubQueryRedirect,
  resolveMyClubMemberView,
  shouldRedirectMyClubToDiscover,
  isClubRouteRedirectLoop,
  markClubRouteRedirect,
  clearClubRouteRedirectLoop,
} from "../src/features/club/routing/clubMembershipRouteLogic.js";
import { resolveInitialView, MY_CLUB_VIEWS } from "../src/pages/player/myClub/myClubViewLogic.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

function readSrc(relativePath) {
  return readFileSync(path.join(root, relativePath), "utf8");
}

function makeSearchParams(view) {
  return {
    get: (key) => (key === "view" ? view : null),
  };
}

test("42J route logic — legacy discover query redirects to discover-clubs", () => {
  assert.equal(resolveLegacyMyClubQueryRedirect(makeSearchParams("discover")), CLUB_ROUTE_PATHS.DISCOVER);
  assert.equal(resolveLegacyMyClubQueryRedirect(makeSearchParams("home")), null);
});

test("42J route logic — my club member views exclude discover", () => {
  assert.ok(!MY_CLUB_MEMBER_VIEWS.includes("discover"));
  assert.equal(resolveMyClubMemberView(makeSearchParams("schedule")), "schedule");
  assert.equal(resolveMyClubMemberView(makeSearchParams(null)), "home");
  assert.equal(resolveInitialView(true, makeSearchParams(null)), "home");
});

test("42J route logic — redirect to discover only without active membership", () => {
  assert.equal(
    shouldRedirectMyClubToDiscover({ loading: true, ok: true, hasActiveMembership: false }),
    false
  );
  assert.equal(
    shouldRedirectMyClubToDiscover({ loading: false, ok: false, hasActiveMembership: false }),
    false
  );
  assert.equal(
    shouldRedirectMyClubToDiscover({ loading: false, ok: true, hasActiveMembership: false }),
    true
  );
  assert.equal(
    shouldRedirectMyClubToDiscover({ loading: false, ok: true, hasActiveMembership: true, clubId: "c1" }),
    false
  );
});

test("42J route logic — redirect loop guard", () => {
  const store = new Map();
  const original = globalThis.sessionStorage;
  globalThis.sessionStorage = {
    setItem: (key, value) => store.set(key, value),
    getItem: (key) => store.get(key) ?? null,
    removeItem: (key) => store.delete(key),
  };

  try {
    clearClubRouteRedirectLoop();
    markClubRouteRedirect("/my-club", "/discover-clubs");
    assert.equal(isClubRouteRedirectLoop("/discover-clubs", "/my-club"), true);
    clearClubRouteRedirectLoop();
    assert.equal(isClubRouteRedirectLoop("/discover-clubs", "/my-club"), false);
  } finally {
    globalThis.sessionStorage = original;
  }
});

test("42J router — canonical routes and legacy redirects", () => {
  const router = readSrc("src/router.jsx");
  assert.match(router, /path="\/discover-clubs"/);
  assert.match(router, /path="\/my-club\/requests"/);
  assert.match(router, /\/clubs\/discover.*\/discover-clubs/);
});

test("42J MyClubPage — guarded active membership only", () => {
  const page = readSrc("src/pages/player/MyClubPage.jsx");
  const actionBar = readSrc("src/pages/player/myClub/MyClubActionBar.jsx");
  const discover = readSrc("src/pages/player/DiscoverClubsPage.jsx");

  assert.match(page, /ClubActiveMembershipGuard/);
  assert.match(page, /CLB của tôi/);
  assert.match(discover, /Khám phá CLB/);
  assert.doesNotMatch(actionBar, /Danh sách CLB/);
  assert.doesNotMatch(actionBar, /Xin gia nhập/);
  assert.doesNotMatch(page, /MyClubDiscoverPanel/);
});

test("42J membership SoT — V2 path does not read profiles.club_id", () => {
  const src = readSrc("src/features/club/services/clubActiveMembershipService.js");
  assert.match(src, /rpcV2GetMyActiveMembership/);
  assert.match(src, /never profiles\.club_id/);
});

test("42J active membership hook — delegates to cloud SSOT resolver", () => {
  const hook = readSrc("src/features/club/hooks/useMyClubMembership.js");
  assert.match(hook, /resolveMyActiveClubMembership/);
  assert.match(hook, /resolveMyActiveClubMembership/);
  assert.match(hook, /cache-first/);
});

test("42J DiscoverPanel — uses activeClubId not profile fields", () => {
  const panel = readSrc("src/pages/player/myClub/MyClubDiscoverPanel.jsx");
  assert.match(panel, /activeClubId/);
  assert.doesNotMatch(panel, /user\?\.clubId === club\.id/);
});
