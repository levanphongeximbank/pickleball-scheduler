import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  resolveClubAwarePlayerHomePath,
  resolvePostAuthClubPath,
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

test("42J.2 — loading home path is null (wait for RPC)", () => {
  assert.equal(resolveClubAwarePlayerHomePath({ loading: true }), null);
});

test("42J.2 — post-auth no membership lands discover once", () => {
  const membership = { loading: false, hasActiveMembership: false, ok: true };
  assert.equal(resolvePostAuthClubPath("/login", membership), "/discover-clubs");
  assert.equal(resolvePostAuthClubPath("/my-club", membership), "/discover-clubs");
  assert.equal(resolvePostAuthClubPath("/dashboard", membership), "/discover-clubs");
});

test("42J.2 — post-auth active member lands my-club", () => {
  const membership = { loading: false, hasActiveMembership: true, ok: true };
  assert.equal(resolvePostAuthClubPath("/login", membership), "/my-club");
  assert.equal(resolvePostAuthClubPath("/my-club", membership), "/my-club");
});

test("42J.2 — membership cache snapshot by user", () => {
  resetMyActiveClubMembershipCache();
  assert.equal(getCachedMembershipSnapshot("user-a"), null);
});

test("42J.2 — single root provider in router", () => {
  const router = readSrc("src/router.jsx");
  assert.match(router, /MyClubMembershipRootProvider/);
});

test("42J.2 — guards use shared context not duplicate hook", () => {
  const activeGuard = readSrc("src/pages/player/guards/ClubActiveMembershipGuard.jsx");
  const discover = readSrc("src/pages/player/DiscoverClubsPage.jsx");
  assert.match(activeGuard, /useRequiredMyClubMembership/);
  assert.doesNotMatch(activeGuard, /useMyClubMembership\(/);
  assert.match(discover, /useRequiredMyClubMembership/);
  assert.doesNotMatch(discover, /useMyClubMembership\(/);
});

test("42J.2 — login uses ClubPostAuthRedirect for V2 PLAYER", () => {
  const login = readSrc("src/pages/LoginPage.jsx");
  assert.match(login, /ClubPostAuthRedirect/);
  assert.match(login, /isClubStorageV2Enabled/);
});

test("42J.2 — RouteAccessGate dashboard uses ClubPlayerHomeRedirect", () => {
  const gate = readSrc("src/components/auth/RouteAccessGate.jsx");
  assert.match(gate, /ClubPlayerHomeRedirect/);
});

test("42J.2 — cache TTL extended to 30s", () => {
  const svc = readSrc("src/features/club/services/clubActiveMembershipService.js");
  assert.match(svc, /MEMBERSHIP_CACHE_MS = 30000/);
});

test("42J.2 — guard redirects use replace", () => {
  const guard = readSrc("src/pages/player/guards/ClubActiveMembershipGuard.jsx");
  assert.match(guard, /Navigate to=\{target\} replace/);
});
