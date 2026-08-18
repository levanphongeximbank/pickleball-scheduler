import { loadClubs } from "../../../data/club.js";
import { getCurrentUser, isRbacEnabled } from "../../../auth/authService.js";
import { isGlobalRole, isPlatformWideRole } from "../../../auth/roles.js";
import { tenantIdFromRecord } from "../../../models/tenant.js";
import { listClubsForTenant as legacyListClubsForTenant } from "../../tenant/guards/tenantGuard.js";
import { isCanonicalClubRepositoryEnabled } from "../config/canonicalRepositoryFlags.js";
import {
  rpcV2ClubGet,
  rpcV2ClubListRegistry,
  rpcV2GetMyActiveMembership,
} from "../services/clubStorageV2RpcService.js";
import {
  CANONICAL_SOURCE,
  CANONICAL_WARNING_CODE,
  LOCAL_DEFAULT_CLUB_ID,
  buildRepoError,
  buildRepoResult,
  isLocalDefaultClub,
} from "./canonicalRepositoryTypes.js";
import { projectClubTenantVenueIdentities } from "../compat/legacyClubVenueScope.js";

function normalizeClub(row, { resolveVenue } = {}) {
  if (!row) return null;
  const id = String(row.id || "").trim();
  if (!id) return null;
  const identities = projectClubTenantVenueIdentities(row, { resolveVenue });
  return {
    id,
    name: row.name || id,
    code: row.code || null,
    status: String(row.status || "active").toLowerCase(),
    tenantId: identities.tenantId,
    venueId: identities.venueId,
    scopeSemantics: identities.scopeSemantics,
    legacyVenueScopeId: identities.legacyVenueScopeId,
    isDefault: Boolean(row.isDefault) || id === LOCAL_DEFAULT_CLUB_ID,
    activeMemberCount: row.activeMemberCount ?? row.active_member_count ?? null,
    // Preserve UI-shape fields so ClubContext/Switcher consumers keep the same
    // public club shape when reading through the canonical gateway (governance
    // org-chart, timestamps, description). Additive: legacy consumers unaffected.
    governance: row.governance ?? null,
    description: row.description ?? null,
    createdAt: row.createdAt ?? row.created_at ?? null,
    updatedAt: row.updatedAt ?? row.updated_at ?? null,
    version: row.version ?? null,
    ownerLabel: row.ownerLabel ?? null,
    presidentLabel: row.presidentLabel ?? null,
    source: row.source || null,
    raw: row,
  };
}

function filterClubsForTenant(
  clubs,
  tenantId,
  { includeInactive = false, excludeDefault = true, resolveVenue } = {}
) {
  const tid = String(tenantId || "").trim();
  const warnings = [];
  const out = [];

  for (const club of clubs || []) {
    const normalized = normalizeClub(club, { resolveVenue });
    if (!normalized) continue;

    if (excludeDefault && isLocalDefaultClub(normalized)) {
      warnings.push({
        code: CANONICAL_WARNING_CODE.DEFAULT_CLUB_EXCLUDED,
        message: "Excluded local default-club from canonical registry.",
        meta: { clubId: normalized.id },
      });
      continue;
    }

    if (!includeInactive && normalized.status !== "active") {
      continue;
    }

    if (tid) {
      const clubTenant = String(normalized.tenantId || "").trim();
      if (clubTenant && clubTenant !== tid) {
        continue;
      }
      // V2 clubs must carry tenant; reject tenant-less local ghosts when V2 consumer asks for tenant
      if (!clubTenant && excludeDefault) {
        continue;
      }
    }

    out.push(normalized);
  }

  return { clubs: out, warnings };
}

function assertTenantAccess({ requestedTenantId, userContext }) {
  const user = userContext?.user || getCurrentUser();
  const rbac = userContext?.rbacEnabled ?? isRbacEnabled();
  if (!rbac || !user) {
    return { ok: true };
  }
  if (isGlobalRole(user.role) || userContext?.isPlatformAdmin) {
    return { ok: true };
  }
  const userTenant = String(
    userContext?.tenantId || tenantIdFromRecord(user) || user.tenantId || ""
  ).trim();
  const requested = String(requestedTenantId || "").trim();
  if (requested && userTenant && requested !== userTenant) {
    return {
      ok: false,
      code: "TENANT_FORBIDDEN",
      message: "Cross-tenant club access is not allowed.",
    };
  }
  return { ok: true };
}

/**
 * @param {object} [deps]
 */
export function createCanonicalClubRepository(deps = {}) {
  const {
    envSource = null,
    isV2Enabled = () => isCanonicalClubRepositoryEnabled(envSource),
    listRegistryRpc = rpcV2ClubListRegistry,
    getClubRpc = rpcV2ClubGet,
    getMyActiveMembershipRpc = rpcV2GetMyActiveMembership,
    loadLocalClubs = loadClubs,
    listLocalClubsForTenant = legacyListClubsForTenant,
    resolveVenueById = null,
  } = deps;

  async function listClubsForTenant(tenantId, options = {}) {
    const includeInactive = Boolean(options.includeInactive);
    const userContext = options.userContext || {};
    const tid = String(tenantId || "").trim() || null;

    const access = assertTenantAccess({ requestedTenantId: tid, userContext });
    if (!access.ok) {
      return buildRepoError({
        code: access.code,
        message: access.message,
        source: CANONICAL_SOURCE.V2_REGISTRY,
      });
    }

    const resolveVenue = options.resolveVenueById || resolveVenueById;

    if (!isV2Enabled()) {
      const legacy = tid ? listLocalClubsForTenant(tid) : loadLocalClubs();
      const filtered = filterClubsForTenant(legacy, tid, {
        includeInactive,
        excludeDefault: Boolean(options.excludeDefault),
        resolveVenue,
      });
      return buildRepoResult({
        data: filtered.clubs.map((c) => ({ ...c, source: CANONICAL_SOURCE.LEGACY_BLOB })),
        source: CANONICAL_SOURCE.LEGACY_BLOB,
        warnings: filtered.warnings,
        execution: { mode: "legacy", tenantId: tid },
      });
    }

    const rpc = await listRegistryRpc({
      tenantId: tid,
      includeInactive,
    });
    if (!rpc?.ok) {
      return buildRepoError({
        code: rpc?.code || "CLUB_RPC_FAILED",
        message: rpc?.error || rpc?.message || "Failed to list clubs.",
        source: CANONICAL_SOURCE.V2_REGISTRY,
      });
    }

    const filtered = filterClubsForTenant(rpc.clubs || [], tid, {
      includeInactive,
      excludeDefault: true,
      resolveVenue,
    });

    return buildRepoResult({
      data: filtered.clubs.map((c) => ({ ...c, source: CANONICAL_SOURCE.V2_REGISTRY })),
      source: CANONICAL_SOURCE.V2_REGISTRY,
      warnings: filtered.warnings,
      execution: {
        mode: "v2",
        tenantId: tid,
        // ClubContext hydration must not gate V2 reads
        independentOfClubContext: true,
      },
    });
  }

  /**
   * Resolve the Club-entity list for the current user/tenant scope.
   *
   * Wave 1 — AUTHORIZED_SCOPE ≠ SELECTED_OPERATIONAL_CONTEXT:
   * - Platform-wide roles MAY be authorized across tenants.
   * - When an operational tenantId is selected, club options MUST be scoped to it.
   * - Platform-wide without a selected tenant still reads the whole registry
   *   (tenantId=null) for admin catalog paths that opt in; ClubContext must not
   *   treat that catalog as a ready operational selection set.
   */
  async function listClubsForCurrentScope(options = {}) {
    const user = options.user ?? getCurrentUser();
    const rbacEnabled = options.rbacEnabled ?? isRbacEnabled();
    const platformWide =
      options.isPlatformWide ?? (user ? isPlatformWideRole(user.role) : false);
    const selectedOperationalTenantId =
      String(options.tenantId || "").trim() || null;
    const profileTenantId =
      String(tenantIdFromRecord(user) || user?.tenantId || "").trim() || null;
    const operationalOnly = options.operationalOnly !== false;

    // GLOBAL DIRECTORY ≠ OPERATIONAL TARGET.
    // Super Admin without a selected Tenant has no operational Club list.
    if (operationalOnly && platformWide && !selectedOperationalTenantId) {
      return buildRepoResult({
        data: [],
        source: CANONICAL_SOURCE.V2_REGISTRY,
        execution: {
          mode: "operational_unscoped_denied",
          tenantId: null,
          independentOfClubContext: true,
        },
      });
    }

    const effectiveTenantId = selectedOperationalTenantId
      ? selectedOperationalTenantId
      : platformWide
        ? null
        : profileTenantId;

    return listClubsForTenant(effectiveTenantId, {
      includeInactive: Boolean(options.includeInactive),
      resolveVenueById: options.resolveVenueById || resolveVenueById,
      userContext: {
        user,
        rbacEnabled,
        tenantId: effectiveTenantId,
        isPlatformAdmin: platformWide,
        selectedOperationalTenantId,
      },
    });
  }

  async function getClubById(clubId, options = {}) {
    const id = String(clubId || "").trim();
    if (!id) {
      return buildRepoError({ code: "CLUB_ID_REQUIRED", message: "clubId is required." });
    }

    if (isLocalDefaultClub(id) && isV2Enabled()) {
      return buildRepoError({
        code: "DEFAULT_CLUB_NOT_ALLOWED",
        message: "Local default-club is not a Production V2 registry club.",
        source: CANONICAL_SOURCE.V2_REGISTRY,
        warnings: [
          {
            code: CANONICAL_WARNING_CODE.DEFAULT_CLUB_EXCLUDED,
            message: "default-club rejected under V2 canonical club repository.",
          },
        ],
      });
    }

    if (!isV2Enabled()) {
      const hit = (loadLocalClubs() || []).find((c) => String(c.id) === id) || null;
      if (!hit) {
        return buildRepoError({
          code: "NOT_FOUND",
          message: "Club not found in legacy registry.",
          source: CANONICAL_SOURCE.LEGACY_BLOB,
        });
      }
      return buildRepoResult({
        data: normalizeClub(
          { ...hit, source: CANONICAL_SOURCE.LEGACY_BLOB },
          { resolveVenue: options.resolveVenueById || resolveVenueById }
        ),
        source: CANONICAL_SOURCE.LEGACY_BLOB,
      });
    }

    const rpc = await getClubRpc(id);
    if (!rpc?.ok || !rpc.club) {
      return buildRepoError({
        code: rpc?.code || "NOT_FOUND",
        message: rpc?.error || rpc?.message || "Club not found.",
        source: CANONICAL_SOURCE.V2_REGISTRY,
      });
    }

    const club = normalizeClub(
      { ...rpc.club, source: CANONICAL_SOURCE.V2_REGISTRY },
      { resolveVenue: options.resolveVenueById || resolveVenueById }
    );
    const access = assertTenantAccess({
      requestedTenantId: club.tenantId,
      userContext: options.userContext || {},
    });
    if (!access.ok) {
      return buildRepoError({
        code: access.code,
        message: access.message,
        source: CANONICAL_SOURCE.V2_REGISTRY,
      });
    }

    return buildRepoResult({
      data: club,
      source: CANONICAL_SOURCE.V2_REGISTRY,
    });
  }

  async function getMyActiveClubMembership() {
    if (!isV2Enabled()) {
      return buildRepoResult({
        data: null,
        source: CANONICAL_SOURCE.LEGACY_BLOB,
        execution: { mode: "legacy" },
      });
    }
    const rpc = await getMyActiveMembershipRpc();
    if (!rpc?.ok) {
      return buildRepoError({
        code: rpc?.code || "MEMBERSHIP_RPC_FAILED",
        message: rpc?.error || rpc?.message || "Failed to resolve membership.",
        source: CANONICAL_SOURCE.MEMBERSHIP_SSOT,
      });
    }
    return buildRepoResult({
      data: {
        clubId: rpc.clubId || null,
        memberId: rpc.memberId || null,
        hasActiveMembership: Boolean(rpc.hasActiveMembership),
        club: rpc.club
          ? normalizeClub(rpc.club, { resolveVenue: resolveVenueById })
          : null,
      },
      source: CANONICAL_SOURCE.MEMBERSHIP_SSOT,
    });
  }

  async function resolveActiveClubForUser(options = {}) {
    const membership = await getMyActiveClubMembership();
    if (membership.ok && membership.data?.clubId) {
      return buildRepoResult({
        data: membership.data.club || { id: membership.data.clubId },
        source: membership.source,
        warnings: membership.warnings,
        execution: { resolvedVia: "active_membership" },
      });
    }

    const tenantId = options.tenantId || null;
    const listed = await listClubsForTenant(tenantId, {
      userContext: options.userContext,
    });
    if (!listed.ok) return listed;
    const first = (listed.data || [])[0] || null;
    return buildRepoResult({
      data: first,
      source: listed.source,
      warnings: listed.warnings,
      execution: { resolvedVia: first ? "tenant_club_list" : "none" },
    });
  }

  async function isClubAccessible(clubId, userContext = {}) {
    const clubResult = await getClubById(clubId, { userContext });
    if (!clubResult.ok) {
      return buildRepoResult({
        data: false,
        source: clubResult.source,
        warnings: clubResult.warnings,
        execution: { reason: clubResult.code },
      });
    }
    return buildRepoResult({
      data: true,
      source: clubResult.source,
      execution: { clubId: clubResult.data.id, tenantId: clubResult.data.tenantId },
    });
  }

  return {
    listClubsForTenant,
    listClubsForCurrentScope,
    getClubById,
    getMyActiveClubMembership,
    resolveActiveClubForUser,
    isClubAccessible,
  };
}

export const canonicalClubRepository = createCanonicalClubRepository();
