/**
 * Wave 4 — Club entitlement adapter.
 *
 * Canonical Club membership evidence is club_members / membership RPC.
 * profiles.club_id is never the sole grant.
 * Bound at composition root so Platform Core / Auth do not import Club internals
 * for the decision kernel (the kernel reads the bound snapshot).
 */

import { ENTITLEMENT_KIND, ENTITLEMENT_STATUS } from "../../../core/platform/authz/decisionCodes.js";

function actorKey(actorId) {
  return String(actorId || "").trim();
}

export function mapClubMemberEntitlement(row) {
  if (!row || typeof row !== "object") {
    return null;
  }
  const clubId = String(row.club_id || row.clubId || "").trim();
  const userId = String(row.user_id || row.userId || actorKey(row.actorId) || "").trim();
  if (!clubId) {
    return null;
  }
  const status = String(row.status || "active").trim();
  const governance = Boolean(row.governance || row.evidenceKind === ENTITLEMENT_KIND.CLUB_GOVERNANCE);
  return {
    clubId,
    userId: userId || null,
    tenantId: String(row.tenant_id || row.tenantId || "").trim() || null,
    status,
    evidenceKind: governance ? ENTITLEMENT_KIND.CLUB_GOVERNANCE : ENTITLEMENT_KIND.CLUB_MEMBER,
  };
}

export function isActiveClubMembership(entitlement) {
  return Boolean(
    entitlement &&
      entitlement.clubId &&
      (entitlement.status === "active" || entitlement.status === "ACTIVE")
  );
}

export function createMemoryClubEntitlementAdapter(seed = []) {
  /** @type {Map<string, object>} */
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
    const mapped = mapClubMemberEntitlement(row);
    if (!mapped?.userId) continue;
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
        entitlements: (entitlements || []).map(mapClubMemberEntitlement).filter(Boolean),
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
 * @param {{
 *   getClient?: (() => object|null)|object|null,
 *   getMyActiveMembership?: () => Promise<object>,
 * }} options
 */
export function createSupabaseClubEntitlementAdapter({
  getClient = null,
  getMyActiveMembership = null,
} = {}) {
  /** @type {Map<string, object>} */
  const snapshots = new Map();

  function resolveClient() {
    return typeof getClient === "function" ? getClient() : getClient;
  }

  return {
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
      if (client && typeof client.from === "function") {
        const { data, error } = await client
          .from("club_members")
          .select("club_id, tenant_id, user_id, status")
          .eq("user_id", key);

        if (!error) {
          const entitlements = (data || []).map(mapClubMemberEntitlement).filter(Boolean);
          const snap = {
            actorId: key,
            status: ENTITLEMENT_STATUS.READY,
            entitlements,
            error: null,
            code: ENTITLEMENT_STATUS.READY,
          };
          snapshots.set(key, snap);
          return { ok: true, ...snap };
        }

        const message = String(error.message || "").toLowerCase();
        const missing =
          error.code === "PGRST205" ||
          error.code === "42P01" ||
          message.includes("does not exist") ||
          message.includes("schema cache");
        if (!missing) {
          const snap = {
            actorId: key,
            status: ENTITLEMENT_STATUS.AUTHORITY_UNAVAILABLE,
            entitlements: [],
            error: error.message || String(error),
            code: "AUTHORITY_UNAVAILABLE",
          };
          snapshots.set(key, snap);
          return { ok: false, ...snap };
        }
      }

      if (typeof getMyActiveMembership === "function") {
        const rpc = await getMyActiveMembership();
        if (rpc?.ok && rpc.hasActiveMembership && rpc.clubId) {
          const entitlements = [
            mapClubMemberEntitlement({
              club_id: rpc.clubId,
              user_id: key,
              tenant_id: rpc.club?.tenantId || rpc.club?.tenant_id || null,
              status: "active",
            }),
          ].filter(Boolean);
          const snap = {
            actorId: key,
            status: ENTITLEMENT_STATUS.READY,
            entitlements,
            error: null,
            code: ENTITLEMENT_STATUS.READY,
          };
          snapshots.set(key, snap);
          return { ok: true, ...snap };
        }
        if (rpc && rpc.ok === false && rpc.code && rpc.code !== "RPC_NOT_DEPLOYED") {
          const snap = {
            actorId: key,
            status: ENTITLEMENT_STATUS.AUTHORITY_UNAVAILABLE,
            entitlements: [],
            error: rpc.error || rpc.code,
            code: rpc.code === "RPC_NOT_DEPLOYED" ? "RPC_NOT_CONFIGURED" : "AUTHORITY_UNAVAILABLE",
          };
          snapshots.set(key, snap);
          return { ok: false, ...snap };
        }
        if (rpc?.ok && !rpc.hasActiveMembership) {
          const snap = {
            actorId: key,
            status: ENTITLEMENT_STATUS.READY,
            entitlements: [],
            error: null,
            code: ENTITLEMENT_STATUS.READY,
          };
          snapshots.set(key, snap);
          return { ok: true, ...snap };
        }
      }

      const snap = {
        actorId: key,
        status: ENTITLEMENT_STATUS.NOT_CONFIGURED,
        entitlements: [],
        error: "Club membership authority is not configured.",
        code: "NOT_CONFIGURED",
      };
      snapshots.set(key, snap);
      return { ok: false, ...snap };
    },
  };
}
