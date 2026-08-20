/**
 * Wave 4 — tenant_members entitlement adapter (existing schema, no new SQL).
 *
 * Canonical Tenant entitlement evidence. profiles.tenant_id is NOT used here.
 * Secure runtime: query failure / missing table → AUTHORITY_UNAVAILABLE.
 * Local non-secure: memory fixture may be seeded explicitly.
 */

import { ENTITLEMENT_KIND, ENTITLEMENT_STATUS } from "../../../core/platform/authz/decisionCodes.js";

export const TENANT_MEMBERS_TABLE = "tenant_members";

export const TENANT_MEMBER_ROLE_CODE = Object.freeze({
  TENANT_OWNER: "tenant_owner",
  TENANT_STAFF: "tenant_staff",
});

export const TENANT_MEMBER_STATUS = Object.freeze({
  ACTIVE: "active",
  INACTIVE: "inactive",
});

const TENANT_MEMBER_SELECT = "tenant_id, user_id, role_code, status";

function actorKey(actorId) {
  return String(actorId || "").trim();
}

function evidenceKindForRole(roleCode) {
  if (roleCode === TENANT_MEMBER_ROLE_CODE.TENANT_OWNER) {
    return ENTITLEMENT_KIND.TENANT_OWNER;
  }
  return ENTITLEMENT_KIND.TENANT_MEMBER;
}

export function mapTenantMemberRow(row) {
  if (!row || typeof row !== "object") {
    return null;
  }
  const tenantId = String(row.tenant_id || row.tenantId || "").trim();
  const userId = String(row.user_id || row.userId || "").trim();
  if (!tenantId || !userId) {
    return null;
  }
  const roleCode = String(row.role_code || row.roleCode || "").trim();
  const status = String(row.status || "").trim();
  return {
    tenantId,
    userId,
    roleCode,
    status,
    evidenceKind: evidenceKindForRole(roleCode),
  };
}

export function isActiveTenantMembership(entitlement) {
  return Boolean(
    entitlement &&
      entitlement.tenantId &&
      entitlement.status === TENANT_MEMBER_STATUS.ACTIVE
  );
}

export function classifyTenantMembersQueryError(error) {
  if (!error) {
    return null;
  }
  const code = String(error.code || "").trim();
  const message = String(error.message || "").toLowerCase();
  if (
    code === "PGRST205" ||
    code === "42P01" ||
    message.includes("schema cache") ||
    message.includes("does not exist") ||
    message.includes("could not find the table")
  ) {
    return "NOT_CONFIGURED";
  }
  if (
    code === "42501" ||
    code === "PGRST301" ||
    message.includes("permission denied") ||
    message.includes("row-level security")
  ) {
    return "AUTHORITY_UNAVAILABLE";
  }
  return "AUTHORITY_UNAVAILABLE";
}

export function createMemoryTenantEntitlementAdapter(seed = []) {
  /** @type {Map<string, { status: string, entitlements: object[], error: string|null, code: string }>} */
  const snapshots = new Map();

  function write(actorId, patch) {
    const key = actorKey(actorId);
    snapshots.set(key, {
      actorId: key,
      status: patch.status,
      entitlements: Array.isArray(patch.entitlements) ? patch.entitlements : [],
      error: patch.error || null,
      code: patch.code || patch.status,
    });
  }

  for (const row of seed) {
    const mapped = mapTenantMemberRow(row);
    if (!mapped) continue;
    const current = snapshots.get(mapped.userId) || {
      status: ENTITLEMENT_STATUS.READY,
      entitlements: [],
      error: null,
      code: ENTITLEMENT_STATUS.READY,
    };
    current.entitlements.push(mapped);
    write(mapped.userId, current);
  }

  return {
    seedActor(actorId, entitlements, status = ENTITLEMENT_STATUS.READY) {
      write(actorId, {
        status,
        entitlements: (entitlements || []).map(mapTenantMemberRow).filter(Boolean),
        error: status === ENTITLEMENT_STATUS.READY ? null : status,
        code: status,
      });
    },
    setFailure(actorId, code = ENTITLEMENT_STATUS.AUTHORITY_UNAVAILABLE, error = code) {
      write(actorId, {
        status: ENTITLEMENT_STATUS.AUTHORITY_UNAVAILABLE,
        entitlements: [],
        error,
        code,
      });
    },
    setPending(actorId) {
      write(actorId, {
        status: ENTITLEMENT_STATUS.PENDING,
        entitlements: [],
        error: null,
        code: ENTITLEMENT_STATUS.PENDING,
      });
    },
    getSnapshot(actorId) {
      const key = actorKey(actorId);
      if (!key) {
        return {
          actorId: null,
          status: ENTITLEMENT_STATUS.UNBOUND,
          entitlements: [],
          error: null,
          code: ENTITLEMENT_STATUS.UNBOUND,
        };
      }
      return (
        snapshots.get(key) || {
          actorId: key,
          status: ENTITLEMENT_STATUS.READY,
          entitlements: [],
          error: null,
          code: ENTITLEMENT_STATUS.READY,
        }
      );
    },
    async hydrate(actorId) {
      const snap = this.getSnapshot(actorId);
      return {
        ok: snap.status === ENTITLEMENT_STATUS.READY,
        status: snap.status,
        code: snap.code,
        entitlements: snap.entitlements,
        error: snap.error,
      };
    },
  };
}

/**
 * Duck-typed Supabase adapter. Injected client — no Auth import in Platform Core.
 * @param {(() => object|null)|object|null} getClient
 */
export function createSupabaseTenantMembersAdapter(getClient) {
  /** @type {Map<string, object>} */
  const snapshots = new Map();

  function resolveClient() {
    return typeof getClient === "function" ? getClient() : getClient;
  }

  return {
    tableName: TENANT_MEMBERS_TABLE,
    getSnapshot(actorId) {
      const key = actorKey(actorId);
      return (
        snapshots.get(key) || {
          actorId: key || null,
          status: ENTITLEMENT_STATUS.PENDING,
          entitlements: [],
          error: null,
          code: ENTITLEMENT_STATUS.PENDING,
        }
      );
    },
    async hydrate(actorId) {
      const key = actorKey(actorId);
      if (!key) {
        const snap = {
          actorId: null,
          status: ENTITLEMENT_STATUS.AUTHORITY_UNAVAILABLE,
          entitlements: [],
          error: "actorId required",
          code: "IDENTITY_INCOMPLETE",
        };
        return { ok: false, ...snap };
      }

      snapshots.set(key, {
        actorId: key,
        status: ENTITLEMENT_STATUS.PENDING,
        entitlements: [],
        error: null,
        code: ENTITLEMENT_STATUS.PENDING,
      });

      const client = resolveClient();
      if (!client || typeof client.from !== "function") {
        const snap = {
          actorId: key,
          status: ENTITLEMENT_STATUS.NOT_CONFIGURED,
          entitlements: [],
          error: "Supabase client is not bound.",
          code: "NOT_CONFIGURED",
        };
        snapshots.set(key, snap);
        return { ok: false, ...snap };
      }

      const { data, error } = await client
        .from(TENANT_MEMBERS_TABLE)
        .select(TENANT_MEMBER_SELECT)
        .eq("user_id", key);

      if (error) {
        const code = classifyTenantMembersQueryError(error);
        const status =
          code === "NOT_CONFIGURED"
            ? ENTITLEMENT_STATUS.NOT_CONFIGURED
            : ENTITLEMENT_STATUS.AUTHORITY_UNAVAILABLE;
        const snap = {
          actorId: key,
          status,
          entitlements: [],
          error: error.message || String(error),
          code,
        };
        snapshots.set(key, snap);
        return { ok: false, ...snap };
      }

      const entitlements = (data || []).map(mapTenantMemberRow).filter(Boolean);
      const snap = {
        actorId: key,
        status: ENTITLEMENT_STATUS.READY,
        entitlements,
        error: null,
        code: ENTITLEMENT_STATUS.READY,
      };
      snapshots.set(key, snap);
      return { ok: true, ...snap };
    },
  };
}
