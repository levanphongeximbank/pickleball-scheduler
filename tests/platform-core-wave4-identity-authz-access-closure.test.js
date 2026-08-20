/**
 * Wave 4 — Identity / Authz / Access canonical closure regression locks.
 * Owner architecture lock: tenant_members entitlement, selected context is
 * never evidence, Super Admin directory vs operational target, SYSTEM_TECHNICIAN
 * is not a second Super Admin.
 */
import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";

import { ROLES } from "../src/auth/roles.js";
import { PERMISSIONS } from "../src/auth/permissions.js";
import {
  can,
  canAccessClub,
  canAccessVenue,
  isRbacConfigurationDenied,
  isRbacEnforced,
  assertCan,
} from "../src/auth/rbac.js";
import { mapProfileRowToUser } from "../src/auth/profileService.js";
import { createUserRecord, isUserActive } from "../src/models/user.js";
import { decideTenantAccess, evaluateTenantContext } from "../src/features/tenant/services/tenantAccessDecision.js";
import { reauthorizePersistedTenantSelection } from "../src/features/tenant/services/tenantSelectionModel.js";
import { listClubsForTenant, guardClubTenant, guardRecordTenant } from "../src/features/tenant/guards/tenantGuard.js";
import { resolveActiveVenueId } from "../src/features/venue/services/venueSelectionService.js";
import { AUTH_SESSION_CLEAR_REASON, shouldClearOperationalContextOnAuthClear } from "../src/auth/authSessionLifecycle.js";
import {
  bindClubEntitlementAuthority,
  bindTenantEntitlementAuthority,
  __resetEntitlementPortsForTests,
} from "../src/core/platform/authz/index.js";
import { createMemoryTenantEntitlementAdapter } from "../src/features/tenant/services/tenantEntitlementAdapter.js";
import { createMemoryClubEntitlementAdapter } from "../src/features/club/services/clubEntitlementAdapter.js";
import { AUTHZ_CODE } from "../src/core/platform/authz/decisionCodes.js";
import { resolvePlatformContextReadiness, PLATFORM_CONTEXT_STATE } from "../src/core/platform/app/platformContextReadiness.js";
import { mapIdentityUserToPlatformUser } from "../src/core/platform/app/runtimeAccess.js";
import { createAccessService } from "../src/core/platform/services/index.js";
import {
  SYSTEM_TECHNICIAN_TECHNICAL_CAPABILITIES,
  isSystemTechnicianBusinessCapability,
  listSystemTechnicianCapabilityMatrix,
  roleHasPermission,
} from "../src/features/identity/matrix/rolePermissions.js";
import { isPlatformWideRole } from "../src/auth/roles.js";
import { canManageCourtClusters } from "../src/features/court-cluster/services/courtClusterService.js";
import { canOperateUnassignedTenant } from "../src/features/tenant/services/tenantSelectionModel.js";
import { isSecureRuntime } from "../src/auth/runtime.js";
import { requiresTenantOperationalEntitlement } from "../src/core/platform/authz/tenantOperationalCapability.js";

const RBAC_ON = { rbacEnabled: true };

function actor(role, extra = {}) {
  return createUserRecord({
    id: extra.id || `actor-${role}`,
    role,
    status: "active",
    ...extra,
  });
}

function withTenantMembership(user, tenantId, roleCode = "tenant_owner") {
  return createUserRecord({
    ...user,
    entitlementEvidence: {
      ...(user.entitlementEvidence || {}),
      tenants: [
        {
          tenant_id: tenantId,
          user_id: user.id,
          role_code: roleCode,
          status: "active",
        },
      ],
    },
  });
}

function withClubMembership(user, clubId) {
  return createUserRecord({
    ...user,
    entitlementEvidence: {
      ...(user.entitlementEvidence || {}),
      clubs: [{ clubId, userId: user.id, status: "active" }],
    },
  });
}

beforeEach(() => {
  __resetEntitlementPortsForTests();
  const store = new Map();
  globalThis.localStorage = {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => {
      store.set(String(key), String(value));
    },
    removeItem: (key) => {
      store.delete(key);
    },
    clear: () => store.clear(),
  };
});

afterEach(() => {
  __resetEntitlementPortsForTests();
  delete globalThis.localStorage;
});

describe("Wave4 4A actor projection", () => {
  it("19/20 missing profile status does not become ACTIVE", () => {
    const user = mapProfileRowToUser({
      id: "u1",
      email: "a@b.c",
      role: "VENUE_MANAGER",
      venue_id: "venue-a",
      tenant_id: "tenant-a",
    });
    assert.equal(user.status, "");
    assert.equal(user.identityIncomplete, true);
    assert.equal(user.identityStatus, "INCOMPLETE");
  });

  it("20 login mapper does not derive tenantId from venueId", () => {
    const user = mapProfileRowToUser({
      id: "u1",
      email: "a@b.c",
      role: "VENUE_MANAGER",
      venue_id: "venue-a",
      status: "active",
    });
    assert.equal(user.venueId, "venue-a");
    assert.equal(user.tenantId, null);
  });

  it("21/23 profiles.tenant_id is home projection only; venue_id is home venue", () => {
    const user = mapProfileRowToUser({
      id: "u1",
      email: "a@b.c",
      role: "VENUE_MANAGER",
      tenant_id: "tenant-home",
      venue_id: "venue-home",
      status: "active",
    });
    assert.equal(user.tenantId, "tenant-home");
    assert.equal(user.venueId, "venue-home");
    assert.notEqual(user.tenantId, user.venueId);
  });
});

describe("Wave4 4B tenant entitlement", () => {
  it("1 actor A cannot access tenant B", () => {
    const a = withTenantMembership(
      actor(ROLES.VENUE_MANAGER, { venueId: "va", tenantId: "tenant-a" }),
      "tenant-a"
    );
    const decision = decideTenantAccess(a, "tenant-b");
    assert.equal(decision.allowed, false);
    assert.equal(decision.code, AUTHZ_CODE.TENANT_OPERATIONAL_ENTITLEMENT_MISSING);
  });

  it("21/22 profiles.tenant_id is not tenant entitlement; tenant_members is", () => {
    const a = actor(ROLES.VENUE_MANAGER, { tenantId: "tenant-b", venueId: "vb" });
    const withoutMembers = decideTenantAccess(a, "tenant-b");
    assert.equal(withoutMembers.allowed, false);

    const withMembers = decideTenantAccess(withTenantMembership(a, "tenant-b"), "tenant-b");
    assert.equal(withMembers.allowed, true);
  });

  it("3 authority query failure does not revive persisted tenant", () => {
    const adapter = createMemoryTenantEntitlementAdapter();
    adapter.setFailure("actor-a", "AUTHORITY_UNAVAILABLE", "query failed");
    bindTenantEntitlementAuthority(adapter);
    const user = actor(ROLES.VENUE_MANAGER, { id: "actor-a", tenantId: "tenant-b" });
    const decision = decideTenantAccess(user, "tenant-b");
    assert.equal(decision.allowed, false);
    assert.equal(decision.code, AUTHZ_CODE.AUTHORITY_UNAVAILABLE);

    const restored = reauthorizePersistedTenantSelection({
      sessionTenantId: "tenant-b",
      catalog: [{ id: "tenant-b", name: "B" }],
      hydrateStatus: "FAILED",
    });
    assert.equal(restored.tenantId, null);
    assert.equal(restored.status, "AUTHORITY_UNAVAILABLE");
  });

  it("2 persisted tenant B cannot restore as authorization evidence for actor A", () => {
    const restored = reauthorizePersistedTenantSelection({
      sessionTenantId: "tenant-b",
      catalog: [{ id: "tenant-a", name: "A" }],
      hydrateStatus: "READY",
      canonicalIds: ["tenant-a"],
    });
    assert.equal(restored.tenantId, null);
    assert.equal(restored.status, "CLEARED");
  });
});

describe("Wave4 venue / club entitlement", () => {
  it("4 VENUE_MANAGER cannot access foreign venue by role alone", () => {
    const manager = actor(ROLES.VENUE_MANAGER, { venueId: "venue-a", tenantId: "tenant-a" });
    assert.equal(canAccessVenue(manager, "venue-b", RBAC_ON), false);
    assert.equal(canAccessVenue(manager, "venue-a", RBAC_ON), true);
  });

  it("5 VENUE_MANAGER cannot view/operate foreign club by role alone", () => {
    const manager = actor(ROLES.VENUE_MANAGER, { venueId: "venue-a" });
    assert.equal(canAccessClub(manager, "club-foreign", { venueId: "venue-b" }, RBAC_ON), false);
  });

  it("6 CLUB_MANAGER cannot access foreign club by role / profile.club_id alone", () => {
    const manager = actor(ROLES.CLUB_MANAGER, { clubId: "club-a", venueId: "venue-a" });
    assert.equal(canAccessClub(manager, "club-a", { venueId: "venue-a" }, RBAC_ON), false);
    const member = withClubMembership(manager, "club-a");
    assert.equal(canAccessClub(member, "club-a", { venueId: "venue-a" }, RBAC_ON), true);
    assert.equal(canAccessClub(member, "club-b", { venueId: "venue-a" }, RBAC_ON), false);
  });

  it("14 club-scoped actor without venueId cannot access arbitrary venue", () => {
    const manager = withClubMembership(
      actor(ROLES.CLUB_MANAGER, { clubId: "club-a", venueId: null }),
      "club-a"
    );
    assert.equal(canAccessVenue(manager, "venue-anywhere", RBAC_ON), false);
  });
});

describe("Wave4 selected context is not evidence", () => {
  it("7/8/9 selected venue/club/tenant do not grant permission", () => {
    const user = actor(ROLES.VENUE_MANAGER, { venueId: "venue-a", tenantId: "tenant-a" });
    const selected = { tenantId: "tenant-b", venueId: "venue-b", clubId: "club-b" };
    assert.equal(canAccessVenue(user, selected.venueId, RBAC_ON), false);
    assert.equal(canAccessClub(user, selected.clubId, { venueId: selected.venueId }, RBAC_ON), false);
    assert.equal(decideTenantAccess(user, selected.tenantId).allowed, false);
  });

  it("24 selected venue remains a preference: home venue is the grant", () => {
    const user = actor(ROLES.VENUE_MANAGER, { venueId: "venue-home" });
    assert.equal(canAccessVenue(user, "venue-home", RBAC_ON), true);
    assert.equal(canAccessVenue(user, "venue-selected-other", RBAC_ON), false);
  });
});

describe("Wave4 Super Admin directory vs operational target", () => {
  it("10/11 SA can globally list directory data and retain global authorization", () => {
    const sa = actor(ROLES.PLATFORM_ADMIN);
    assert.equal(can(sa, PERMISSIONS.USER_MANAGE, {}, RBAC_ON), true);
    assert.equal(can(sa, PERMISSIONS.CLUB_VIEW, {}, RBAC_ON), true);
    assert.equal(can(sa, PERMISSIONS.VENUE_VIEW, {}, RBAC_ON), true);
    assert.equal(decideTenantAccess(sa, null, { requireTarget: false }).allowed, true);
  });

  it("12 SA operational action requires explicit resource/tenant target", () => {
    const sa = actor(ROLES.PLATFORM_ADMIN);
    assert.equal(can(sa, PERMISSIONS.CLUB_UPDATE, {}, RBAC_ON), false);
    assert.equal(can(sa, PERMISSIONS.CLUB_UPDATE, { clubId: "club-1", tenantId: "t1" }, RBAC_ON), true);
    assert.equal(canAccessClub(sa, null, {}, RBAC_ON), false);
    assert.equal(canAccessClub(sa, "club-1", {}, RBAC_ON), true);
    assert.equal(canAccessVenue(sa, null, RBAC_ON), false);
    assert.equal(canAccessVenue(sa, "venue-1", RBAC_ON), true);
    assert.equal(decideTenantAccess(sa, null, { requireTarget: true }).code, AUTHZ_CODE.TARGET_REQUIRED);
    assert.equal(decideTenantAccess(sa, "tenant-1").allowed, true);
  });

  it("13 SA selection is a target not evidence granting authority", () => {
    const sa = actor(ROLES.PLATFORM_ADMIN, { tenantId: null });
    const access = createAccessService();
    const denied = access.authorize(
      { role: "SUPER_ADMIN", user_id: sa.id },
      {},
      "club.manage"
    );
    assert.equal(denied.allowed, false);
    assert.equal(denied.code, "TARGET_REQUIRED");
    const allowed = access.authorize(
      { role: "SUPER_ADMIN", user_id: sa.id },
      { tenant_id: "tenant-1", club_id: "club-1" },
      "club.manage"
    );
    assert.equal(allowed.allowed, true);
  });

  it("14 no silent first-tenant/venue/club synthesis for SA authorization", () => {
    const sa = actor(ROLES.PLATFORM_ADMIN, { id: "sa-1" });
    assert.equal(canOperateUnassignedTenant(sa), true);
    assert.equal(
      resolveActiveVenueId({
        user: sa,
        selectedTenantId: "tenant-1",
        venues: [{ id: "only-venue", tenantId: "tenant-1" }],
      }),
      null
    );
  });
});

describe("Wave4 SYSTEM_TECHNICIAN", () => {
  it("15 technician cannot operate arbitrary clubs/venues/tenants", () => {
    const tech = actor(ROLES.SYSTEM_TECHNICIAN);
    assert.equal(canAccessClub(tech, "club-1", {}, RBAC_ON), false);
    assert.equal(canAccessVenue(tech, "venue-1", RBAC_ON), false);
    assert.equal(decideTenantAccess(tech, "tenant-1").allowed, false);
    assert.equal(canOperateUnassignedTenant(tech), false);
  });

  it("16 technician receives only explicitly defined technical capabilities", () => {
    assert.ok(SYSTEM_TECHNICIAN_TECHNICAL_CAPABILITIES.includes(PERMISSIONS.SYSTEM_HEALTH_VIEW));
    assert.ok(SYSTEM_TECHNICIAN_TECHNICAL_CAPABILITIES.includes(PERMISSIONS.DATA_DIAGNOSTIC_VIEW));
    const tech = actor(ROLES.SYSTEM_TECHNICIAN);
    assert.equal(can(tech, PERMISSIONS.SYSTEM_HEALTH_VIEW, {}, RBAC_ON), true);
    assert.equal(can(tech, PERMISSIONS.CLUB_DELETE, { clubId: "c1" }, RBAC_ON), false);
  });

  it("CLUSTER_MANAGE empty scope is DENY/TARGET_REQUIRED", () => {
    const tech = actor(ROLES.SYSTEM_TECHNICIAN);
    assert.equal(can(tech, PERMISSIONS.CLUSTER_MANAGE, {}, RBAC_ON), false);
    const denied = assertCan(tech, PERMISSIONS.CLUSTER_MANAGE, {}, RBAC_ON);
    assert.equal(denied.ok, false);
    assert.equal(denied.code, "TARGET_REQUIRED");
  });

  it("CLUSTER_MANAGE with arbitrary target and no cluster entitlement is DENY", () => {
    const tech = actor(ROLES.SYSTEM_TECHNICIAN);
    assert.equal(
      can(tech, PERMISSIONS.CLUSTER_MANAGE, { clusterId: "cluster-x", venueId: "venue-x" }, RBAC_ON),
      false
    );
    assert.equal(isSystemTechnicianBusinessCapability(PERMISSIONS.CLUSTER_MANAGE), true);
  });

  it("SKILL_LEVEL_APPROVE / RANKING_MANAGE / TOURNAMENT_CERTIFY are not role-alone business grants", () => {
    const tech = actor(ROLES.SYSTEM_TECHNICIAN);
    assert.equal(can(tech, PERMISSIONS.SKILL_LEVEL_APPROVE, {}, RBAC_ON), false);
    assert.equal(can(tech, PERMISSIONS.RANKING_MANAGE, {}, RBAC_ON), false);
    assert.equal(can(tech, PERMISSIONS.TOURNAMENT_CERTIFY, {}, RBAC_ON), false);
    assert.equal(
      can(tech, PERMISSIONS.RANKING_MANAGE, { tenantId: "t1" }, RBAC_ON),
      false
    );
    assert.equal(
      can(tech, PERMISSIONS.TOURNAMENT_CERTIFY, { tournamentId: "tn1" }, RBAC_ON),
      false
    );
  });

  it("legitimate technical permissions continue to work", () => {
    const tech = actor(ROLES.SYSTEM_TECHNICIAN);
    assert.equal(can(tech, PERMISSIONS.SYSTEM_HEALTH_VIEW, {}, RBAC_ON), true);
    assert.equal(can(tech, PERMISSIONS.CLUSTER_VIEW, {}, RBAC_ON), true);
    assert.equal(can(tech, PERMISSIONS.TENANT_VIEW, {}, RBAC_ON), true);
    assert.equal(can(tech, PERMISSIONS.DATA_DIAGNOSTIC_VIEW, {}, RBAC_ON), true);
  });

  it("PLATFORM_ADMIN / Super Admin global authorization plus explicit target remains", () => {
    const sa = actor(ROLES.PLATFORM_ADMIN);
    assert.equal(can(sa, PERMISSIONS.CLUSTER_MANAGE, {}, RBAC_ON), true);
    assert.equal(
      can(sa, PERMISSIONS.CLUSTER_MANAGE, { clusterId: "c1", venueId: "v1" }, RBAC_ON),
      true
    );
    assert.equal(can(sa, PERMISSIONS.RANKING_MANAGE, {}, RBAC_ON), true);
    assert.equal(decideTenantAccess(sa, "tenant-a").allowed, true);
  });

  it("isPlatformWideRole does not grant SYSTEM_TECHNICIAN business resources", () => {
    assert.equal(isPlatformWideRole(ROLES.SYSTEM_TECHNICIAN), true);
    const tech = actor(ROLES.SYSTEM_TECHNICIAN);
    assert.equal(roleHasPermission(ROLES.SYSTEM_TECHNICIAN, PERMISSIONS.CLUSTER_MANAGE), false);
    assert.equal(canManageCourtClusters(tech), false);
    assert.equal(can(tech, PERMISSIONS.CLUSTER_MANAGE, {}, RBAC_ON), false);
    const matrix = listSystemTechnicianCapabilityMatrix();
    for (const row of matrix.filter((item) => item.businessOrTechnical === "BUSINESS")) {
      assert.equal(row.systemTechnicianDefaultGrant, false);
    }
  });
});

describe("Wave4 architecture amendment — tenant_members is operational only", () => {
  it("PLAYER without tenant_members can authenticate", () => {
    const user = mapProfileRowToUser({
      id: "player-1",
      email: "p@b.c",
      role: "PLAYER",
      status: "active",
    });
    assert.equal(user.identityIncomplete, false);
    assert.equal(isUserActive(user), true);
    assert.equal(decideTenantAccess(user, "tenant-a").allowed, false);
  });

  it("PLAYER without tenant_members can use player domain capability", () => {
    const player = actor(ROLES.PLAYER, { playerId: "p1", clubId: "c1" });
    assert.equal(
      can(player, PERMISSIONS.TOURNAMENT_VIEW, {}, RBAC_ON),
      true
    );
    assert.equal(
      can(player, PERMISSIONS.PLAYER_VIEW, { playerId: "p1" }, RBAC_ON),
      true
    );
  });

  it("PLAYER without tenant_members cannot perform Tenant administration", () => {
    const player = actor(ROLES.PLAYER, { tenantId: "tenant-a", playerId: "p1" });
    assert.equal(decideTenantAccess(player, "tenant-a").allowed, false);
    assert.equal(
      decideTenantAccess(player, "tenant-a").code,
      AUTHZ_CODE.TENANT_OPERATIONAL_ENTITLEMENT_MISSING
    );
    assert.equal(
      can(player, PERMISSIONS.TENANT_ROLE_CUSTOMIZE, { tenantId: "tenant-a" }, RBAC_ON),
      false
    );
  });

  it("REFEREE without tenant_members can authenticate and use referee authority", () => {
    const referee = actor(ROLES.REFEREE, { venueId: "venue-a" });
    assert.equal(isUserActive(referee), true);
    assert.equal(decideTenantAccess(referee, "tenant-a").allowed, false);
    assert.equal(
      can(referee, PERMISSIONS.MATCH_UPDATE, { venueId: "venue-a" }, RBAC_ON),
      true
    );
  });

  it("CLUB actor without tenant_members uses club membership, not tenant_members", () => {
    const manager = withClubMembership(
      actor(ROLES.CLUB_MANAGER, { clubId: "club-a", venueId: "venue-a", tenantId: "tenant-a" }),
      "club-a"
    );
    assert.equal(decideTenantAccess(manager, "tenant-a").allowed, false);
    assert.equal(canAccessClub(manager, "club-a", { venueId: "venue-a" }, RBAC_ON), true);
  });

  it("COACH without tenant_members may use coach domain capability", () => {
    const coach = actor(ROLES.COACH, { venueId: "venue-a", tenantId: "tenant-a" });
    assert.equal(decideTenantAccess(coach, "tenant-a").allowed, false);
    assert.equal(can(coach, PERMISSIONS.CLUB_VIEW, { venueId: "venue-a" }, RBAC_ON), true);
  });

  it("profiles.tenant_id is a context hint and never grants Tenant operation", () => {
    const user = actor(ROLES.VENUE_MANAGER, { tenantId: "tenant-a", venueId: "venue-a" });
    const context = evaluateTenantContext(user, "tenant-a");
    assert.equal(context.allowed, true);
    assert.equal(context.code, AUTHZ_CODE.TENANT_CONTEXT_ONLY);
    assert.equal(decideTenantAccess(user, "tenant-a").allowed, false);
  });

  it("selected Tenant does not grant Tenant operation", () => {
    const user = actor(ROLES.PLAYER, { tenantId: "tenant-a" });
    assert.equal(evaluateTenantContext(user, "tenant-b").allowed, false);
    assert.equal(decideTenantAccess(user, "tenant-b").allowed, false);
  });

  it("non-global Tenant operator with active tenant_members can operate that tenant", () => {
    const owner = withTenantMembership(
      actor(ROLES.TENANT_OWNER, { tenantId: "tenant-a", venueId: "venue-a" }),
      "tenant-a"
    );
    assert.equal(decideTenantAccess(owner, "tenant-a").allowed, true);
  });

  it("missing membership is TENANT_OPERATIONAL_ENTITLEMENT_MISSING only for operational actions", () => {
    const player = actor(ROLES.PLAYER, { tenantId: "tenant-a", playerId: "p1" });
    assert.equal(
      decideTenantAccess(player, "tenant-a").code,
      AUTHZ_CODE.TENANT_OPERATIONAL_ENTITLEMENT_MISSING
    );
    assert.equal(requiresTenantOperationalEntitlement(PERMISSIONS.TOURNAMENT_VIEW), false);
    assert.equal(can(player, PERMISSIONS.TOURNAMENT_VIEW, {}, RBAC_ON), true);
  });

  it("authority query failure fail-closes Tenant operation but not player domain capability", () => {
    const adapter = createMemoryTenantEntitlementAdapter();
    adapter.setFailure("player-fail", "AUTHORITY_UNAVAILABLE", "query failed");
    bindTenantEntitlementAuthority(adapter);
    const player = actor(ROLES.PLAYER, {
      id: "player-fail",
      tenantId: "tenant-a",
      playerId: "p1",
    });
    assert.equal(decideTenantAccess(player, "tenant-a").code, AUTHZ_CODE.AUTHORITY_UNAVAILABLE);
    assert.equal(can(player, PERMISSIONS.TOURNAMENT_VIEW, {}, RBAC_ON), true);
    const restored = reauthorizePersistedTenantSelection({
      sessionTenantId: "tenant-a",
      catalog: [{ id: "tenant-a", name: "A" }],
      hydrateStatus: "FAILED",
      purpose: "context",
      homeTenantId: "tenant-a",
    });
    assert.equal(restored.tenantId, "tenant-a");
    assert.equal(restored.operationalAuthorized, false);
    assert.equal(restored.status, "TENANT_CONTEXT_ONLY");
  });

  it("F5 context rehydrate may restore a home hint without operational entitlement", () => {
    const restored = reauthorizePersistedTenantSelection({
      sessionTenantId: "tenant-home",
      catalog: [{ id: "tenant-home", name: "Home" }],
      hydrateStatus: "PENDING",
      purpose: "context",
      homeTenantId: "tenant-home",
    });
    assert.equal(restored.tenantId, "tenant-home");
    assert.equal(restored.operationalAuthorized, false);
    assert.equal(restored.status, "CONTEXT_UNRESOLVED");
  });

  it("no role synthesizes tenant_members evidence", () => {
    const owner = actor(ROLES.TENANT_OWNER, { tenantId: "tenant-a" });
    assert.equal(decideTenantAccess(owner, "tenant-a").allowed, false);
    const inactive = withTenantMembership(owner, "tenant-a");
    inactive.entitlementEvidence.tenants[0].status = "inactive";
    const stale = createUserRecord(inactive);
    stale.entitlementEvidence = inactive.entitlementEvidence;
    assert.equal(decideTenantAccess(stale, "tenant-a").allowed, false);
  });

  it("Super Admin does not require tenant_members; mutation still needs explicit target", () => {
    const sa = actor(ROLES.PLATFORM_ADMIN);
    assert.equal(decideTenantAccess(sa, "tenant-a").allowed, true);
    assert.equal(decideTenantAccess(sa, null, { requireTarget: true }).code, AUTHZ_CODE.TARGET_REQUIRED);
  });

  it("persisted Tenant restore is not operational entitlement", () => {
    const restored = reauthorizePersistedTenantSelection({
      sessionTenantId: "tenant-home",
      catalog: [{ id: "tenant-home", name: "Home" }],
      hydrateStatus: "READY",
      purpose: "context",
      homeTenantId: "tenant-home",
    });
    assert.equal(restored.tenantId, "tenant-home");
    assert.equal(restored.operationalAuthorized, false);
  });
});

describe("Wave4 access / readiness states", () => {
  it("17 venue-independent readiness works without selected venue", () => {
    const ready = resolvePlatformContextReadiness({
      isAuthenticated: true,
      rbacEnabled: true,
      selectedTenantId: "tenant-1",
      tenantCheck: { ok: true },
      requireClub: false,
      requireVenue: false,
      selectedVenueId: null,
    });
    assert.equal(ready.state, PLATFORM_CONTEXT_STATE.CONTEXT_READY);
  });

  it("18 venue-dependent pages report venue requirement", () => {
    const required = resolvePlatformContextReadiness({
      isAuthenticated: true,
      rbacEnabled: true,
      selectedTenantId: "tenant-1",
      tenantCheck: { ok: true },
      requireClub: false,
      requireVenue: true,
      selectedVenueId: null,
      eligibleVenueCount: 2,
    });
    assert.equal(required.state, PLATFORM_CONTEXT_STATE.VENUE_REQUIRED);
  });

  it("30/31/32/33 unauthenticated != unauthorized != unresolved != empty", () => {
    const unauth = resolvePlatformContextReadiness({ isAuthenticated: false });
    assert.equal(unauth.state, PLATFORM_CONTEXT_STATE.AUTH_REQUIRED);

    const forbidden = resolvePlatformContextReadiness({
      isAuthenticated: true,
      rbacEnabled: true,
      tenantCheck: { ok: false, code: "TENANT_FORBIDDEN" },
      selectedTenantId: "t-b",
    });
    assert.equal(forbidden.state, PLATFORM_CONTEXT_STATE.FORBIDDEN);

    const unresolved = resolvePlatformContextReadiness({
      isAuthenticated: true,
      rbacEnabled: true,
      tenantCheck: { ok: false, code: "CONTEXT_UNRESOLVED" },
      selectedTenantId: "t-b",
    });
    assert.equal(unresolved.state, PLATFORM_CONTEXT_STATE.CONTEXT_UNRESOLVED);

    const unavailable = resolvePlatformContextReadiness({
      isAuthenticated: true,
      rbacEnabled: true,
      tenantCheck: { ok: false, code: "AUTHORITY_UNAVAILABLE" },
      selectedTenantId: "t-b",
    });
    assert.equal(unavailable.state, PLATFORM_CONTEXT_STATE.AUTHORITY_UNAVAILABLE);
    assert.notEqual(unavailable.state, PLATFORM_CONTEXT_STATE.CLUB_EMPTY);
  });

  it("22 missing tenant id does not list all clubs or allow record guards", () => {
    assert.deepEqual(listClubsForTenant(null), []);
    const user = actor(ROLES.VENUE_MANAGER, { venueId: "v1" });
    const clubGuard = guardClubTenant("club-1", null, { user, rbacEnabled: true });
    assert.equal(clubGuard.ok, false);
    const recordGuard = guardRecordTenant({ id: "r1" }, "tenant-1", { user, rbacEnabled: true });
    assert.equal(recordGuard.ok, false);
  });
});

describe("Wave4 session / F5 / logout", () => {
  it("35 logout clears scope hints", () => {
    assert.equal(shouldClearOperationalContextOnAuthClear(AUTH_SESSION_CLEAR_REASON.LOGOUT), true);
  });

  it("36 user switch cannot inherit prior actor scope", () => {
    assert.equal(shouldClearOperationalContextOnAuthClear(AUTH_SESSION_CLEAR_REASON.USER_SWITCH), true);
  });

  it("34 F5 identity replace keeps hints but reauthorization may clear them", () => {
    assert.equal(
      shouldClearOperationalContextOnAuthClear(AUTH_SESSION_CLEAR_REASON.IDENTITY_REPLACE),
      false
    );
    const pending = reauthorizePersistedTenantSelection({
      sessionTenantId: "tenant-b",
      hydrateStatus: "PENDING",
    });
    assert.equal(pending.status, "CONTEXT_UNRESOLVED");
    assert.equal(pending.tenantId, null);
  });
});

describe("Wave4 secure runtime policy", () => {
  it("28/29 RBAC-off allow-all is local-only; secure configuration deny is explicit", () => {
    const player = actor(ROLES.PLAYER, { clubId: "c1", playerId: "p1" });
    if (isSecureRuntime()) {
      assert.equal(isRbacConfigurationDenied({ rbacEnabled: false }), true);
      assert.equal(can(player, PERMISSIONS.CLUB_DELETE, { clubId: "other" }, { rbacEnabled: false }), false);
    } else {
      assert.equal(isRbacConfigurationDenied({ rbacEnabled: false }), false);
      assert.equal(isRbacEnforced({ rbacEnabled: false, user: player }), false);
      assert.equal(can(player, PERMISSIONS.CLUB_DELETE, { clubId: "other" }, { rbacEnabled: false }), true);
    }
  });

  it("runtimeAccess does not invent tenantId from venueId", () => {
    const mapped = mapIdentityUserToPlatformUser(
      { id: "u1", role: ROLES.VENUE_MANAGER, venueId: "venue-a", tenantId: null },
      null
    );
    assert.equal(mapped.tenant_id, null);
  });
});

describe("Wave4 pending authority does not keep stale context", () => {
  it("authority pending is CONTEXT_UNRESOLVED not empty dataset", () => {
    const adapter = createMemoryTenantEntitlementAdapter();
    adapter.setPending("actor-a");
    bindTenantEntitlementAuthority(adapter);
    const user = actor(ROLES.VENUE_MANAGER, { id: "actor-a", tenantId: "tenant-a" });
    const decision = decideTenantAccess(user, "tenant-a");
    assert.equal(decision.code, AUTHZ_CODE.CONTEXT_UNRESOLVED);
    assert.equal(decision.allowed, false);
  });

  it("club membership authority failure is unavailable, not profile.club_id grant", () => {
    const adapter = createMemoryClubEntitlementAdapter();
    adapter.setFailure("actor-c");
    bindClubEntitlementAuthority(adapter);
    const user = actor(ROLES.CLUB_MANAGER, { id: "actor-c", clubId: "club-a" });
    assert.equal(canAccessClub(user, "club-a", {}, RBAC_ON), false);
  });
});
