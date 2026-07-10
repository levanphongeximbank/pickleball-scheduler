import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { enableRbac } from "../src/auth/authService.js";
import { ROLES } from "../src/auth/roles.js";
import { canApproveClubMembershipRequests } from "../src/features/club/index.js";
import { createClubRecord } from "../src/models/club.js";
import { CLUB_STATUSES } from "../src/features/club/constants/clubStatus.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

function createLocalStorageMock(seed = {}) {
  const store = new Map(Object.entries(seed));
  return {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(key, String(value));
    },
    removeItem(key) {
      store.delete(key);
    },
    clear() {
      store.clear();
    },
  };
}

function readSrc(relativePath) {
  return readFileSync(path.join(root, relativePath), "utf8");
}

test.beforeEach(() => {
  globalThis.localStorage = createLocalStorageMock();
});

test.afterEach(() => {
  enableRbac(false);
  delete globalThis.localStorage;
});

test("Phase 42I SQL adds membership review permission and RPC gate", () => {
  const sql = readSrc("docs/v5/PHASE_42I_MEMBERSHIP_REVIEW.sql");
  assert.match(sql, /club\.membership\.review/);
  assert.match(sql, /phase42_can_review_membership/);
  assert.match(sql, /club_list_pending_requests/);
  assert.match(sql, /club_review_membership_request/);
  assert.match(sql, /drop function if exists public\.club_review_membership_request\(uuid, text, text, text, text\)/);
});

test("membership request service wires V2 list/review RPCs", () => {
  const src = readSrc("src/features/club/services/clubMembershipRequestService.js");
  assert.match(src, /rpcV2ClubListPendingRequests/);
  assert.match(src, /rpcV2ClubReviewMembershipRequest/);
  assert.match(src, /isClubStorageV2Enabled\(\)/);
  assert.match(src, /export async function listPendingMembershipRequests/);
  assert.match(src, /export async function rejectClubMembershipRequest/);
});

test("canApprove allows tenant owner with club.membership.review when RBAC on", () => {
  enableRbac();
  const club = createClubRecord("CLB Review", {
    id: "club-review-v2",
    tenantId: "tenant-review",
    venueId: "tenant-review",
    status: CLUB_STATUSES.ACTIVE,
    governance: { presidentUserId: "other-president" },
  });
  const tenantOwner = {
    id: "tenant-owner-review",
    role: ROLES.TENANT_OWNER,
    venueId: "tenant-review",
    tenantId: "tenant-review",
  };
  assert.equal(canApproveClubMembershipRequests(tenantOwner, club), true);
});

test("canApprove still allows club president without global review permission", () => {
  enableRbac();
  const presidentId = "player-president-v2";
  const club = createClubRecord("CLB Officer", {
    id: "club-officer-v2",
    tenantId: "tenant-officer",
    venueId: "tenant-officer",
    status: CLUB_STATUSES.ACTIVE,
    governance: { presidentUserId: presidentId },
  });
  const playerPresident = {
    id: presidentId,
    role: ROLES.PLAYER,
    clubId: club.id,
  };
  assert.equal(canApproveClubMembershipRequests(playerPresident, club), true);
});

test("RBAC matrix includes club.membership.review for tenant owner", () => {
  const matrix = readSrc("src/features/identity/matrix/rolePermissions.js");
  assert.match(matrix, /PERMISSIONS\.CLUB_MEMBERSHIP_REVIEW/);
  assert.match(readSrc("src/features/identity/constants/permissions.js"), /CLUB_MEMBERSHIP_REVIEW: "club\.membership\.review"/);
});
