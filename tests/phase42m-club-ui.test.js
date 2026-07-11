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
import { MEMBERSHIP_PHASE } from "../src/features/club/membership/membershipState.js";
import { CLUB_MEMBERSHIP_REQUEST_STATUSES } from "../src/features/club/constants/clubMembershipRequestStatuses.js";
import { resolveClubCardCta } from "../src/features/club/ui/clubCardCtaLogic.js";
import { CLUB_PAGE_MAX_WIDTH, clubCardSx } from "../src/features/club/ui/clubUiTokens.js";

const UI_EXPORT_NAMES = [
  "ClubAvatar",
  "ClubCard",
  "ClubConfirmDialog",
  "ClubDiscoverSkeleton",
  "ClubEmptyState",
  "ClubFeedbackAlert",
  "ClubPageShell",
  "ClubRegistrySkeleton",
  "ClubStatusBadge",
  "GovernanceRoleChip",
  "MembershipRequestBadge",
  "MyClubHomeInsights",
  "resolveClubCardCta",
  "clubUiTokens",
];

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

const RBAC_ON = { rbacEnabled: true };
const TENANT = "venue-prod-main";
const CLUB_ID = "club-test-42m";

function membership(active) {
  return {
    phase: active ? MEMBERSHIP_PHASE.ACTIVE : MEMBERSHIP_PHASE.NONE,
    hasActiveMembership: active,
    clubId: active ? CLUB_ID : null,
    loading: false,
    ok: true,
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

describe("Phase 42M — Club UI design system exports", () => {
  it("ui barrel re-exports expected symbols (source contract)", async () => {
    const source = await import("node:fs/promises").then((fs) =>
      fs.readFile(new URL("../src/features/club/ui/index.js", import.meta.url), "utf8")
    );
    for (const key of UI_EXPORT_NAMES) {
      assert.match(source, new RegExp(key));
    }
  });

  it("defines layout tokens", () => {
    assert.equal(typeof CLUB_PAGE_MAX_WIDTH, "number");
    assert.ok(clubCardSx.borderRadius);
  });
});

describe("Phase 42M — ClubCard CTA contract (no wrong-state buttons)", () => {
  it("shows join only for joinable without request", () => {
    assert.deepEqual(resolveClubCardCta({ variant: "joinable" }), {
      showJoin: true,
      showCancel: false,
    });
  });

  it("hides join for your-club, pending, rejected, disabled", () => {
    assert.deepEqual(resolveClubCardCta({ variant: "your-club" }), {
      showJoin: false,
      showCancel: false,
    });
    assert.deepEqual(
      resolveClubCardCta({
        variant: "pending",
        requestStatus: CLUB_MEMBERSHIP_REQUEST_STATUSES.PENDING,
      }),
      { showJoin: false, showCancel: true }
    );
    assert.deepEqual(
      resolveClubCardCta({
        variant: "rejected",
        requestStatus: CLUB_MEMBERSHIP_REQUEST_STATUSES.REJECTED,
      }),
      { showJoin: false, showCancel: false }
    );
    assert.deepEqual(resolveClubCardCta({ variant: "joinable", disabled: true }), {
      showJoin: false,
      showCancel: false,
    });
  });

  it("never shows join when pending request status is set on joinable variant", () => {
    assert.deepEqual(
      resolveClubCardCta({
        variant: "joinable",
        requestStatus: CLUB_MEMBERSHIP_REQUEST_STATUSES.PENDING,
      }),
      { showJoin: false, showCancel: true }
    );
  });
});

describe("Phase 42M — 42L navigation matrix unchanged", () => {
  it("PLAYER without membership still sees Discover, not manage registry", () => {
    globalThis.localStorage = createLocalStorageMock();
    enableRbac();
    const user = {
      id: "u-player",
      role: ROLES.PLAYER,
      tenantId: TENANT,
      venueId: TENANT,
      status: "active",
    };
    const ctx = buildClubNavContext({
      user,
      membership: membership(false),
      can: (perm, scope) => can(user, perm, scope, RBAC_ON),
      tenantId: TENANT,
    });
    assert.equal(isClubNavItemVisible(CLUB_NAV_ITEM_KEYS.DISCOVER, ctx), true);
    assert.equal(isClubNavItemVisible(CLUB_NAV_ITEM_KEYS.MANAGE_LIST, ctx), false);
  });

  it("club coaching menu still exposes discover for player without club", () => {
    globalThis.localStorage = createLocalStorageMock();
    enableRbac();
    const user = {
      id: "u-player",
      role: ROLES.PLAYER,
      tenantId: TENANT,
      venueId: TENANT,
      status: "active",
    };
    const discoverItem = CLUB_COACHING_MENU_ROOT.children.find(
      (item) => item.key === CLUB_NAV_ITEM_KEYS.DISCOVER
    );
    assert.ok(discoverItem);
    const auth = menuAuth(user);
    const scope = {
      tenantId: TENANT,
      venueId: TENANT,
      clubNav: buildClubNavContext({
        user,
        membership: membership(false),
        can: auth.can,
        tenantId: TENANT,
      }),
    };
    assert.equal(isMenuItemVisible(discoverItem, { ...auth, scope }), true);
  });

  it("sidebar menu groups still include CLB entry", () => {
    globalThis.localStorage = createLocalStorageMock();
    enableRbac();
    const user = {
      id: "u-player",
      role: ROLES.PLAYER,
      tenantId: TENANT,
      venueId: TENANT,
      status: "active",
    };
    const auth = menuAuth(user);
    const groups = filterMenuGroups(MENU_GROUPS, auth, { tenantId: TENANT });
    const labels = groups.flatMap((g) => g.items.map((i) => i.label || i.text)).filter(Boolean);
    assert.ok(labels.some((l) => String(l).includes("CLB")));
  });
});
