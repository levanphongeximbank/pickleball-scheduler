import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  MEMBERSHIP_PHASE,
  isMembershipPhasePending,
  resolveMembershipPhase,
} from "../src/features/club/membership/membershipState.js";
import {
  resolveClubAwarePlayerHomePath,
  resolveDirectMyClubPath,
  resolvePostAuthClubPath,
  resolvePostLoginClubPath,
} from "../src/features/club/routing/clubLandingResolver.js";
import {
  getCachedMembershipSnapshot,
  resetMyActiveClubMembershipCache,
} from "../src/features/club/services/clubActiveMembershipService.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

function readSrc(relativePath) {
  return readFileSync(path.join(root, relativePath), "utf8");
}

test("42J.2.1 — pending phase does not default to NONE", () => {
  assert.equal(resolveMembershipPhase({ loading: true }), MEMBERSHIP_PHASE.LOADING);
  assert.equal(resolveMembershipPhase({ ok: false, loading: false }), MEMBERSHIP_PHASE.ERROR);
  assert.equal(
    resolveMembershipPhase({ ok: true, hasActiveMembership: false, loading: false }),
    MEMBERSHIP_PHASE.NONE
  );
});

test("42J.2.1 — no redirect while pending", () => {
  assert.equal(resolvePostLoginClubPath({ loading: true }), null);
  assert.equal(resolveDirectMyClubPath({ loading: true }), null);
  assert.equal(resolveClubAwarePlayerHomePath({ loading: true }), null);
});

test("42J.2.1 — post-login active → my-club (ignores stale from path)", () => {
  const active = { loading: false, ok: true, hasActiveMembership: true, clubId: "c1" };
  assert.equal(resolvePostLoginClubPath(active), "/my-club");
  assert.equal(resolvePostAuthClubPath("/discover-clubs", active), "/my-club");
});

test("42J.2.1 — post-login none → discover", () => {
  const none = { loading: false, ok: true, hasActiveMembership: false, clubId: null };
  assert.equal(resolvePostLoginClubPath(none), "/discover-clubs");
});

test("42J.2.1 — direct /my-club none → discover once", () => {
  const none = { loading: false, ok: true, hasActiveMembership: false, clubId: null };
  assert.equal(resolveDirectMyClubPath(none), "/discover-clubs");
  assert.equal(resolveDirectMyClubPath({ loading: false, ok: true, hasActiveMembership: true, clubId: "c1" }), null);
});

test("42J.2.1 — provider ignores TOKEN_REFRESHED cache clear", () => {
  const provider = readSrc("src/features/club/hooks/MyClubMembershipContext.jsx");
  assert.match(provider, /TOKEN_REFRESHED/);
  assert.match(provider, /return;\s*\}/);
  assert.match(provider, /SIGNED_OUT/);
});

test("42J.2.1 — ClubPostAuthRedirect sole post-login landing", () => {
  const login = readSrc("src/pages/LoginPage.jsx");
  const postAuth = readSrc("src/pages/player/guards/ClubPostAuthRedirect.jsx");
  assert.match(login, /<ClubPostAuthRedirect\s*\/>/);
  assert.match(postAuth, /resolvePostLoginClubPath/);
  assert.doesNotMatch(postAuth, /requestedPath/);
});

test("42J.2.1 — guard uses direct path resolver only", () => {
  const guard = readSrc("src/pages/player/guards/ClubActiveMembershipGuard.jsx");
  assert.match(guard, /resolveDirectMyClubPath/);
  assert.match(guard, /Navigate to=\{directTarget\} replace/);
});

test("42J.2.1 — hook stable fetch gen (no user object dep)", () => {
  const hook = readSrc("src/features/club/hooks/useMyClubMembership.js");
  assert.match(hook, /fetchGenRef/);
  assert.doesNotMatch(hook, /\[user,/);
});

test("42J.2.1 — cache scoped by project + user", () => {
  const svc = readSrc("src/features/club/services/clubActiveMembershipService.js");
  assert.match(svc, /buildMembershipCacheKey/);
  assert.match(svc, /MEMBERSHIP_CACHE_MS = 30000/);
});

test("42J.2.1 — membership cache snapshot by user", () => {
  resetMyActiveClubMembershipCache();
  assert.equal(getCachedMembershipSnapshot("user-a"), null);
});
