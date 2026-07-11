import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";

import { ROLES } from "../src/auth/roles.js";
import { enableRbac, signInAs } from "../src/auth/authService.js";
import { saveClubs } from "../src/data/club.js";
import { saveVenues } from "../src/data/venue.js";
import { createClubRecord } from "../src/models/club.js";
import { createTenantRecord, TENANT_STATUS } from "../src/models/tenant.js";
import { saveClubData, getDefaultClubData } from "../src/domain/clubStorage.js";
import { invokeApi } from "../src/features/api/router/apiRouter.js";
import {
  assertClubInScope,
  resolveAllowedClubIds,
} from "../src/features/api/services/clubScopeService.js";
import {
  invalidateMyActiveClubMembershipCache,
  resetMyActiveClubMembershipCache,
  getCachedMembershipSnapshot,
} from "../src/features/club/services/clubActiveMembershipService.js";

const TENANT_A = "tenant-43a-api-a";
const CLUB_A = "club-43a-a";
const CLUB_B = "club-43a-b";

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

function resetClubs() {
  saveVenues([
    createTenantRecord({ id: TENANT_A, name: "Tenant 43A", status: TENANT_STATUS.ACTIVE }),
  ]);
  saveClubs([
    createClubRecord("Club A", { id: CLUB_A, tenantId: TENANT_A, venueId: TENANT_A }),
    createClubRecord("Club B", { id: CLUB_B, tenantId: TENANT_A, venueId: TENANT_A }),
  ]);
  saveClubData(CLUB_A, { ...getDefaultClubData(CLUB_A), tenantId: TENANT_A });
  saveClubData(CLUB_B, { ...getDefaultClubData(CLUB_B), tenantId: TENANT_A });
}

beforeEach(() => {
  process.env.VITE_API_ENABLED = "true";
  process.env.VITE_RBAC_ENABLED = "true";
  globalThis.localStorage = createLocalStorageMock();
  globalThis.sessionStorage = createLocalStorageMock();
  enableRbac(true);
  resetClubs();
});

afterEach(() => {
  delete globalThis.localStorage;
  delete globalThis.sessionStorage;
  delete process.env.VITE_API_ENABLED;
  delete process.env.VITE_RBAC_ENABLED;
  resetMyActiveClubMembershipCache();
});

describe("Phase 43A — API club scope", () => {
  it("T7: client clubId outside allowed scope returns 403", async () => {
    signInAs({
      id: "player-43a",
      role: ROLES.PLAYER,
      venueId: TENANT_A,
      tenantId: TENANT_A,
      clubId: CLUB_A,
      status: "active",
    });

    const allowed = resolveAllowedClubIds({
      tenantId: TENANT_A,
      user: {
        id: "player-43a",
        role: ROLES.PLAYER,
        venueId: TENANT_A,
        clubId: CLUB_A,
        status: "active",
      },
      rbacEnabled: true,
    });
    assert.equal(allowed.has(CLUB_A), true);
    assert.equal(allowed.has(CLUB_B), false);

    const result = await invokeApi({
      method: "GET",
      path: "/api/v1/players",
      query: { clubId: CLUB_B },
    });

    assert.equal(result.statusCode, 403);
    assert.match(result.response.error.message, /phạm vi/i);
  });

  it("allows in-scope clubId for players list", async () => {
    signInAs({
      id: "player-43a-ok",
      role: ROLES.PLAYER,
      venueId: TENANT_A,
      tenantId: TENANT_A,
      clubId: CLUB_A,
      status: "active",
    });

    const result = await invokeApi({
      method: "GET",
      path: "/api/v1/players",
      query: { clubId: CLUB_A },
    });

    assert.equal(result.statusCode, 200);
    assert.equal(result.response.data.clubId, CLUB_A);
  });

  it("assertClubInScope throws CLUB_OUT_OF_SCOPE for foreign club", () => {
    signInAs({
      id: "player-43a-guard",
      role: ROLES.PLAYER,
      venueId: TENANT_A,
      tenantId: TENANT_A,
      clubId: CLUB_A,
      status: "active",
    });

    assert.throws(
      () =>
        assertClubInScope(CLUB_B, {
          auth: {
            tenantId: TENANT_A,
            user: {
              id: "player-43a-guard",
              role: ROLES.PLAYER,
              venueId: TENANT_A,
              clubId: CLUB_A,
            },
          },
        }),
      (error) => error.statusCode === 403 && error.code === "CLUB_OUT_OF_SCOPE"
    );
  });
});

describe("Phase 43A — membership cache invalidation", () => {
  it("T6: invalidateMyActiveClubMembershipCache clears cached snapshot", () => {
    const userId = "user-43a-cache";
    globalThis.sessionStorage.setItem(
      `pb-membership-cache-v1:local:${userId}`,
      JSON.stringify({
        at: Date.now(),
        result: { ok: true, membership: { clubId: CLUB_A } },
      })
    );

    assert.ok(getCachedMembershipSnapshot(userId));
    invalidateMyActiveClubMembershipCache(userId);
    assert.equal(getCachedMembershipSnapshot(userId), null);
  });
});
