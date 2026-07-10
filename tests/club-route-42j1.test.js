import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  CLUB_LANDING_STATE,
  resolveClubLandingRedirect,
  resolveClubLandingState,
  resolveClubAwarePlayerHomePath,
} from "../src/features/club/routing/clubLandingResolver.js";
import {
  CLUB_ROUTE_PATHS,
  shouldRedirectMyClubToDiscover,
  resolveClubLandingState as resolveFromLogic,
} from "../src/features/club/routing/clubMembershipRouteLogic.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

function readSrc(relativePath) {
  return readFileSync(path.join(root, relativePath), "utf8");
}

test("42J.1 landing resolver — state machine", () => {
  assert.equal(
    resolveClubLandingState({ loading: true, ok: false, hasActiveMembership: false }),
    CLUB_LANDING_STATE.LOADING
  );
  assert.equal(
    resolveClubLandingState({ loading: false, ok: false, hasActiveMembership: false }),
    CLUB_LANDING_STATE.ERROR
  );
  assert.equal(
    resolveClubLandingState({ loading: false, ok: true, hasActiveMembership: false, clubId: null }),
    CLUB_LANDING_STATE.NO_MEMBERSHIP
  );
  assert.equal(
    resolveClubLandingState({ loading: false, ok: true, hasActiveMembership: true, clubId: "c1" }),
    CLUB_LANDING_STATE.ACTIVE_MEMBERSHIP
  );
});

test("42J.1 landing resolver — no redirect while loading or error", () => {
  assert.equal(
    resolveClubLandingRedirect({
      landingState: CLUB_LANDING_STATE.LOADING,
      pathname: "/my-club",
      requiresActiveMembership: true,
    }),
    null
  );
  assert.equal(
    resolveClubLandingRedirect({
      landingState: CLUB_LANDING_STATE.ERROR,
      pathname: "/my-club",
      requiresActiveMembership: true,
    }),
    null
  );
});

test("42J.1 landing resolver — no membership redirects my-club to discover", () => {
  assert.equal(
    resolveClubLandingRedirect({
      landingState: CLUB_LANDING_STATE.NO_MEMBERSHIP,
      pathname: "/my-club",
    }),
    "/discover-clubs"
  );
  assert.equal(
    resolveClubLandingRedirect({
      landingState: CLUB_LANDING_STATE.ACTIVE_MEMBERSHIP,
      pathname: "/my-club",
    }),
    null
  );
});

test("42J.1 landing resolver — V2 player home defers to route guards", () => {
  assert.equal(resolveClubAwarePlayerHomePath({ loading: true }), null);
  assert.equal(
    resolveClubAwarePlayerHomePath({ ok: true, hasActiveMembership: true, clubId: "c1", loading: false }),
    "/my-club"
  );
  assert.equal(
    resolveClubAwarePlayerHomePath({ ok: true, hasActiveMembership: false, clubId: null, loading: false }),
    "/discover-clubs"
  );
});

test("42J.1 route logic — shouldRedirect uses landing state only", () => {
  assert.equal(shouldRedirectMyClubToDiscover({ loading: true, ok: true, hasActiveMembership: false }), false);
  assert.equal(shouldRedirectMyClubToDiscover({ loading: false, ok: false, hasActiveMembership: false }), false);
  assert.equal(shouldRedirectMyClubToDiscover({ loading: false, ok: true, hasActiveMembership: false }), true);
  assert.equal(shouldRedirectMyClubToDiscover({ loading: false, ok: true, hasActiveMembership: true, clubId: "c1" }), false);
});

test("42J.1 menuAccess — V2 PLAYER default home is discover-clubs", () => {
  const src = readSrc("src/auth/menuAccess.js");
  assert.match(src, /isClubStorageV2Enabled/);
  assert.match(src, /discover-clubs/);
});

test("42J.1 requests guard — 403 not my-club bounce", () => {
  const guard = readSrc("src/pages/player/guards/ClubMembershipRequestsGuard.jsx");
  assert.match(guard, /Navigate to="\/403"/);
  assert.doesNotMatch(guard, /Navigate to=\{CLUB_ROUTE_PATHS\.MY_CLUB\}/);
});

test("42J.1 MyClubPage — V2 summary fallback from RPC club", () => {
  const page = readSrc("src/pages/player/MyClubPage.jsx");
  assert.match(page, /buildMyClubSummaryFromClub/);
  assert.match(page, /isClubStorageV2Enabled/);
});

test("42J.1 nav — discover-clubs menu item with matcher", () => {
  const menu = readSrc("src/config/v5Menu/clubCoachingMenu.js");
  const matchers = readSrc("src/components/nav/navPathMatchers.js");
  assert.match(menu, /discover-clubs/);
  assert.match(menu, /Khám phá CLB/);
  assert.match(matchers, /match === "discover-clubs"/);
  assert.match(matchers, /match === "my-club"/);
});

test("42J.1 guard — loading skeleton not blank shell", () => {
  const guard = readSrc("src/pages/player/guards/ClubActiveMembershipGuard.jsx");
  assert.match(guard, /ClubRouteLoadingShell/);
  assert.match(guard, /Skeleton/);
});

test("42J.1 exports — landing resolver re-exported from route logic", () => {
  assert.equal(
    resolveFromLogic({ loading: false, ok: true, hasActiveMembership: true, clubId: "c1" }),
    CLUB_LANDING_STATE.ACTIVE_MEMBERSHIP
  );
  assert.equal(CLUB_ROUTE_PATHS.DISCOVER, "/discover-clubs");
});
