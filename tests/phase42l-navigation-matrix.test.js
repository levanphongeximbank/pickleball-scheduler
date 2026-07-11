import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { ROLES } from "../src/auth/roles.js";
import { PERMISSIONS } from "../src/auth/permissions.js";
import { can } from "../src/auth/rbac.js";
import { enableRbac } from "../src/auth/authService.js";
import { filterMenuGroups, isMenuItemVisible } from "../src/auth/menuAccess.js";
import { CLUB_COACHING_MENU_ROOT } from "../src/config/v5Menu/clubCoachingMenu.js";
import { MENU_GROUPS } from "../src/config/navigationConfig.js";
import {
  buildClubNavContext,
  isClubNavItemVisible,
  CLUB_NAV_ITEM_KEYS,
} from "../src/features/club/navigation/clubNavMatrix.js";
import { canApproveClubMembershipRequests, canReviewMembershipForClub } from "../src/features/club/services/clubGovernanceService.js";
import { MEMBERSHIP_PHASE } from "../src/features/club/membership/membershipState.js";
import { isMobileMenuItemVisible } from "../src/features/mobile/services/mobileNavAccess.js";

const RBAC_ON = { rbacEnabled: true };
const TENANT = "venue-prod-main";
const CLUB_ID = "club-test-42l";

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

function makeClub(overrides = {}) {
  return {
    id: CLUB_ID,
    name: "CLB Test 42L",
    tenantId: TENANT,
    governance: {
      presidentUserId: "user-president",
      ownerUserId: "user-owner",
      vicePresidentUserIds: [],
      ...overrides.governance,
    },
    ...overrides,
  };
}

function membership(active, club = null) {
  return {
    phase: active ? MEMBERSHIP_PHASE.ACTIVE : MEMBERSHIP_PHASE.NONE,
    loading: false,
    ok: true,
    hasActiveMembership: active,
    clubId: active ? CLUB_ID : null,
    club: active ? club || makeClub() : null,
  };
}

function menuAuth(user) {
  return {
    can: (perm, scope) => can(user, perm, scope, RBAC_ON),
    rbacEnabled: true,
    isAuthenticated: true,
    user,
  };
}

function scopeFor(user, mem, tenantId = TENANT) {
  const clubNav = buildClubNavContext({
    user,
    membership: mem,
    can: (perm, scope) => can(user, perm, scope, RBAC_ON),
    tenantId,
  });
  return {
    clubId: mem?.clubId || null,
    venueId: tenantId,
    tenantId,
    clubNav,
    membershipClubId: mem?.clubId || null,
  };
}

function clubItem(key) {
  return CLUB_COACHING_MENU_ROOT.children.find((item) => item.key === key);
}

function collectClubLabels(groups) {
  const clubGroup = groups.find((g) => g.id === "club");
  if (!clubGroup) return [];
  const labels = [];
  for (const root of clubGroup.items) {
    if (root.children?.length) {
      for (const child of root.children) {
        labels.push(child.text);
      }
    } else if (root.text) {
      labels.push(root.text);
    }
  }
  return labels;
}

describe("Phase 42L — clubNavMatrix", () => {
  it("PLAYER no membership — discover + create only", () => {
    const player = {
      id: "p-no-club",
      role: ROLES.PLAYER,
      venueId: TENANT,
      status: "active",
    };
    const ctx = buildClubNavContext({
      user: player,
      membership: membership(false),
      can: (perm) => perm === PERMISSIONS.CLUB_CREATE,
      tenantId: TENANT,
    });

    assert.equal(isClubNavItemVisible(CLUB_NAV_ITEM_KEYS.DISCOVER, ctx), true);
    assert.equal(isClubNavItemVisible(CLUB_NAV_ITEM_KEYS.CREATE, ctx), true);
    assert.equal(isClubNavItemVisible(CLUB_NAV_ITEM_KEYS.MY_CLUB, ctx), false);
    assert.equal(isClubNavItemVisible(CLUB_NAV_ITEM_KEYS.CLUB_OPERATIONS, ctx), false);
  });

  it("PLAYER active member — my-club + discover", () => {
    const player = { id: "p-member", role: ROLES.PLAYER, venueId: TENANT, status: "active" };
    const ctx = buildClubNavContext({
      user: player,
      membership: membership(true, makeClub({ governance: { presidentUserId: "other" } })),
      can: () => false,
      tenantId: TENANT,
    });

    assert.equal(isClubNavItemVisible(CLUB_NAV_ITEM_KEYS.MY_CLUB, ctx), true);
    assert.equal(isClubNavItemVisible(CLUB_NAV_ITEM_KEYS.DISCOVER, ctx), true);
    assert.equal(isClubNavItemVisible(CLUB_NAV_ITEM_KEYS.MEMBERSHIP_REQUESTS, ctx), false);
  });

  it("President — governance menu leaves", () => {
    const president = { id: "user-president", role: ROLES.PLAYER, venueId: TENANT, status: "active" };
    const club = makeClub();
    const ctx = buildClubNavContext({
      user: president,
      membership: membership(true, club),
      can: () => true,
      tenantId: TENANT,
    });

    assert.equal(isClubNavItemVisible(CLUB_NAV_ITEM_KEYS.CLUB_OPERATIONS, ctx), true);
    assert.equal(isClubNavItemVisible(CLUB_NAV_ITEM_KEYS.MEMBERSHIP_REQUESTS, ctx), true);
    assert.equal(isClubNavItemVisible(CLUB_NAV_ITEM_KEYS.GOVERNANCE_MANAGE, ctx), true);
  });

  it("Super Admin no membership — platform + manage, no my-club", () => {
    const sa = { id: "sa-1", role: ROLES.SUPER_ADMIN, status: "active" };
    const ctx = buildClubNavContext({
      user: sa,
      membership: membership(false),
      can: () => true,
      tenantId: TENANT,
    });

    assert.equal(isClubNavItemVisible(CLUB_NAV_ITEM_KEYS.MY_CLUB, ctx), false);
    assert.equal(isClubNavItemVisible(CLUB_NAV_ITEM_KEYS.PLATFORM_ALL, ctx), true);
    assert.equal(isClubNavItemVisible(CLUB_NAV_ITEM_KEYS.MANAGE_LIST, ctx), true);
    assert.equal(isClubNavItemVisible(CLUB_NAV_ITEM_KEYS.DISCOVER, ctx), false);
  });

  it("Super Admin with membership — my-club + platform", () => {
    const sa = { id: "sa-2", role: ROLES.SUPER_ADMIN, status: "active" };
    const ctx = buildClubNavContext({
      user: sa,
      membership: membership(true),
      can: () => true,
      tenantId: TENANT,
    });

    assert.equal(isClubNavItemVisible(CLUB_NAV_ITEM_KEYS.MY_CLUB, ctx), true);
    assert.equal(isClubNavItemVisible(CLUB_NAV_ITEM_KEYS.PLATFORM_ALL, ctx), true);
  });

  it("SA without governance cannot review membership", () => {
    const sa = { id: "sa-3", role: ROLES.SUPER_ADMIN, status: "active" };
    const club = makeClub();
    assert.equal(canApproveClubMembershipRequests(sa, club), false);
    assert.equal(canReviewMembershipForClub(sa, club), false);
  });

  it("Tenant owner sees manage list", () => {
    const owner = { id: "owner-1", role: ROLES.VENUE_OWNER, venueId: TENANT, status: "active" };
    const ctx = buildClubNavContext({
      user: owner,
      membership: membership(false),
      can: (perm) => perm === PERMISSIONS.CLUB_VIEW || perm === PERMISSIONS.CLUB_CREATE,
      tenantId: TENANT,
    });

    assert.equal(isClubNavItemVisible(CLUB_NAV_ITEM_KEYS.MANAGE_LIST, ctx), true);
    assert.equal(isClubNavItemVisible(CLUB_NAV_ITEM_KEYS.MY_CLUB, ctx), true);
  });
});

describe("Phase 42L — sidebar + mobile parity", () => {
  it("filterMenuGroups uses same club keys for president", () => {
    globalThis.localStorage = createLocalStorageMock();
    enableRbac();
    const president = { id: "user-president", role: ROLES.PLAYER, venueId: TENANT, status: "active" };
    const mem = membership(true, makeClub());
    const scope = scopeFor(president, mem);
    const auth = menuAuth(president);

    const sidebar = collectClubLabels(filterMenuGroups(MENU_GROUPS, auth, scope));
    const requestsItem = clubItem("club-membership-requests");
    assert.equal(
      isMenuItemVisible(requestsItem, { ...auth, scope }),
      isMobileMenuItemVisible(requestsItem, auth, scope)
    );
    assert.ok(sidebar.includes("Yêu cầu gia nhập"));
    assert.ok(sidebar.includes("Vận hành CLB"));
  });

  it("PLAYER no membership sidebar hides my-club", () => {
    globalThis.localStorage = createLocalStorageMock();
    enableRbac();
    const player = { id: "p0", role: ROLES.PLAYER, venueId: TENANT, status: "active" };
    const scope = scopeFor(player, membership(false));
    const labels = collectClubLabels(filterMenuGroups(MENU_GROUPS, menuAuth(player), scope));
    assert.equal(labels.includes("CLB của tôi"), false);
    assert.ok(labels.includes("Khám phá CLB"));
  });
});
