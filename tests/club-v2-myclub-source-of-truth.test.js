import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";

import { enableRbac } from "../src/auth/authService.js";
import { ROLES } from "../src/auth/roles.js";
import {
  canViewFullClubMembers,
  getGovernanceDisplayLabels,
} from "../src/features/club/services/clubGovernanceService.js";
import {
  buildMyClubSummaryFromClub,
  resolveMyClubHomeMemberCount,
} from "../src/features/club/services/clubActiveMembershipService.js";
import { mapV2ClubToUiClub } from "../src/features/club/services/clubStorageV2RpcService.js";
import { isClubStorageV2Enabled } from "../src/features/club/config/clubRegistryFlags.js";

const PRESIDENT_ID = "4cf24ed0-99f8-4997-b803-3c7ff8e32014";
const CLUB_ID = "club-219e4a7cbd73437eb6271f02a53314c3";

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

describe("club V2 My Club source of truth", () => {
  let previousLocalStorage;
  let previousEnvSnapshot;

  beforeEach(() => {
    previousLocalStorage = globalThis.localStorage;
    previousEnvSnapshot = {
      VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL,
      VITE_SUPABASE_ANON_KEY: process.env.VITE_SUPABASE_ANON_KEY,
      VITE_CLUB_STORAGE_V2: process.env.VITE_CLUB_STORAGE_V2,
      VITE_RBAC_ENABLED: process.env.VITE_RBAC_ENABLED,
    };
    globalThis.localStorage = createLocalStorageMock({});
    process.env.VITE_SUPABASE_URL = "https://expuvcohlcjzvrrauvud.supabase.co";
    process.env.VITE_SUPABASE_ANON_KEY =
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiJ9.test";
    process.env.VITE_CLUB_STORAGE_V2 = "true";
    process.env.VITE_RBAC_ENABLED = "true";
    if (typeof import.meta !== "undefined" && import.meta.env) {
      import.meta.env.VITE_SUPABASE_URL = process.env.VITE_SUPABASE_URL;
      import.meta.env.VITE_SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;
      import.meta.env.VITE_CLUB_STORAGE_V2 = "true";
      import.meta.env.VITE_RBAC_ENABLED = "true";
    }
    enableRbac(true);
  });

  afterEach(() => {
    globalThis.localStorage = previousLocalStorage;
    for (const [key, value] of Object.entries(previousEnvSnapshot)) {
      if (value == null) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  });

  it("enables Club Storage V2 for SoT tests", () => {
    assert.equal(isClubStorageV2Enabled(), true);
  });

  it("allows PLAYER president with null profiles.club_id when active membership matches", () => {
    const user = {
      id: PRESIDENT_ID,
      role: ROLES.PLAYER,
      clubId: null,
      club_id: null,
      displayName: "Huỳnh Văn Anh",
    };
    const club = {
      id: CLUB_ID,
      governance: {
        ownerUserId: PRESIDENT_ID,
        presidentUserId: PRESIDENT_ID,
      },
      source: "v2-rpc",
    };

    // Empty local registry must not matter — membership option is SoT.
    assert.equal(
      canViewFullClubMembers(user, club, { activeMembershipClubId: CLUB_ID }),
      true
    );
  });

  it("denies PLAYER when not active member and not governance officer", () => {
    const user = {
      id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      role: ROLES.PLAYER,
      clubId: null,
    };
    const club = {
      id: CLUB_ID,
      governance: {
        ownerUserId: PRESIDENT_ID,
        presidentUserId: PRESIDENT_ID,
      },
    };
    assert.equal(canViewFullClubMembers(user, club, { activeMembershipClubId: null }), false);
    assert.equal(
      canViewFullClubMembers(user, club, { activeMembershipClubId: "club-other" }),
      false
    );
  });

  it("home member count ignores local zero when V2 summary has cloud count", () => {
    const clubSummary = buildMyClubSummaryFromClub({
      id: CLUB_ID,
      name: "CLB ACCC",
      status: "active",
      activeMemberCount: 10,
      governance: { presidentUserId: PRESIDENT_ID, ownerUserId: PRESIDENT_ID },
      presidentLabel: "Huỳnh Văn Anh",
      ownerLabel: "Huỳnh Văn Anh",
    });
    const localStats = { activeMemberCount: 0, memberCount: 0 };

    assert.equal(clubSummary.memberCount, 10);
    assert.equal(
      resolveMyClubHomeMemberCount({ clubSummary, clubStats: localStats }),
      10
    );
  });

  it("home member count is stable across repeated resolve calls", () => {
    const clubSummary = { memberCount: 10, source: "v2-rpc" };
    const counts = Array.from({ length: 5 }, () =>
      resolveMyClubHomeMemberCount({
        clubSummary,
        clubStats: { activeMemberCount: 0 },
      })
    );
    assert.deepEqual(counts, [10, 10, 10, 10, 10]);
  });

  it("hydrates president_label from mapV2ClubToUiClub / getGovernanceDisplayLabels", () => {
    const mapped = mapV2ClubToUiClub({
      id: CLUB_ID,
      name: "CLB ACCC",
      tenant_id: "venue-prod-main",
      status: "active",
      version: 3,
      owner_user_id: PRESIDENT_ID,
      president_user_id: PRESIDENT_ID,
      owner_label: "Huỳnh Văn Anh",
      president_label: "Huỳnh Văn Anh",
      active_member_count: 10,
      registered_cluster_id: null,
    });

    assert.equal(mapped.presidentLabel, "Huỳnh Văn Anh");
    assert.equal(mapped.ownerLabel, "Huỳnh Văn Anh");
    assert.equal(mapped.activeMemberCount, 10);
    assert.equal(mapped.source, "v2-rpc");

    const labels = getGovernanceDisplayLabels(
      {
        id: mapped.id,
        governance: mapped.governance,
        ownerLabel: mapped.ownerLabel,
        presidentLabel: mapped.presidentLabel,
      },
      "venue-prod-main",
      {}
    );

    assert.equal(labels.combinedOwnerPresident, true);
    assert.match(labels.ownerLabel, /Huỳnh Văn Anh/);
    assert.doesNotMatch(labels.ownerLabel, /User 4cf24ed0/);
  });

  it("does not show User <id> when cloud president_label is present without nameHints", () => {
    const labels = getGovernanceDisplayLabels(
      {
        id: CLUB_ID,
        governance: {
          presidentUserId: PRESIDENT_ID,
          ownerUserId: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
        },
        presidentLabel: "Huỳnh Văn Anh",
        ownerLabel: "Owner Name",
      },
      "venue-prod-main",
      {}
    );

    assert.equal(labels.presidentLabel, "Huỳnh Văn Anh");
    assert.equal(labels.ownerLabel, "Owner Name");
    assert.equal(labels.combinedOwnerPresident, false);
  });
});
