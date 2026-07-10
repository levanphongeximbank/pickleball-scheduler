import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { isNavItemActive } from "../src/components/nav/navPathMatchers.js";
import {
  resetMyActiveClubMembershipCache,
  shouldFetchMembership,
  getCachedMembershipSnapshot,
} from "../src/features/club/services/clubActiveMembershipService.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

function readSrc(relativePath) {
  return readFileSync(path.join(root, relativePath), "utf8");
}

const discoverItem = { match: "discover-clubs", path: "/discover-clubs", text: "Khám phá CLB" };
const myClubItem = { match: "my-club", path: "/my-club", text: "CLB của tôi" };

test("42J.2.2 — discover route highlights only discover item", () => {
  assert.equal(isNavItemActive("/discover-clubs", discoverItem, "/discover-clubs"), true);
  assert.equal(isNavItemActive("/discover-clubs", myClubItem, "/my-club"), false);
});

test("42J.2.2 — my-club routes highlight only my-club item", () => {
  assert.equal(isNavItemActive("/my-club", myClubItem, "/my-club"), true);
  assert.equal(isNavItemActive("/my-club/requests", myClubItem, "/my-club"), true);
  assert.equal(isNavItemActive("/my-club", discoverItem, "/discover-clubs"), false);
});

test("42J.2.2 — shouldFetchMembership respects force flag", () => {
  resetMyActiveClubMembershipCache();
  const userId = "user-cache-test";
  assert.equal(shouldFetchMembership(userId, { force: false }), true);
  assert.equal(shouldFetchMembership(null, { force: false }), false);
  assert.equal(getCachedMembershipSnapshot(userId), null);
});

test("42J.2.2 — nav menu sets aria-current page", () => {
  const flat = readSrc("src/components/nav/NavMenuFlat.jsx");
  const tree = readSrc("src/components/nav/NavMenuTree.jsx");
  assert.match(flat, /aria-current=\{selected \? "page" : undefined\}/);
  assert.match(tree, /aria-current=\{selected \? "page" : undefined\}/);
});

test("42J.2.2 — session cache mirror not localStorage SoT", () => {
  const svc = readSrc("src/features/club/services/clubActiveMembershipService.js");
  assert.match(svc, /sessionStorage/);
  assert.doesNotMatch(svc, /localStorage/);
});

test("42J.2.2 — bumpRevision invalidates cache before refetch", () => {
  const ctx = readSrc("src/features/club/hooks/MyClubMembershipContext.jsx");
  assert.match(ctx, /invalidateMyActiveClubMembershipCache\(userId\)/);
});
