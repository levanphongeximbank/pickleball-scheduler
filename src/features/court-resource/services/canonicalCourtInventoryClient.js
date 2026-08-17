/**
 * Canonical eligible-court RPC client.
 * Fail closed. No Club V3 blob or browser storage fallback.
 */
import { getSupabaseAuthClient, hasSupabaseConfig } from "../../../auth/supabaseClient.js";
import { COURT_RESOURCE_CODE } from "../constants/courtResourceContract.js";
import { CANONICAL_LIST_ELIGIBLE_RPC } from "../constants/courtOperationsOwnership.js";
import { listEligiblePhysicalCourts } from "./canonicalCourtInventoryService.js";

let testClientOverride = null;

/** @internal */
export function __setCanonicalInventoryRpcClientForTests(client) {
  testClientOverride = client;
}

/** @internal */
export function __resetCanonicalInventoryRpcClientForTests() {
  testClientOverride = null;
}

function resolveClient() {
  return testClientOverride || getSupabaseAuthClient();
}

function isMissingRpcError(error) {
  const message = String(error?.message || error?.code || "").toLowerCase();
  return (
    message.includes("could not find the function")
    || (message.includes("function") && message.includes("does not exist"))
    || error?.code === "PGRST202"
  );
}

function parseRpcJson(data) {
  if (!data) {
    return {
      ok: false,
      code: COURT_RESOURCE_CODE.CANONICAL_PATH_UNAVAILABLE,
      error: "Canonical inventory RPC returned empty.",
      courts: [],
    };
  }
  if (typeof data === "object" && "ok" in data) {
    return data;
  }
  return { ok: true, code: COURT_RESOURCE_CODE.OK, ...data };
}

function toCanonicalCourt(row, tenantId) {
  return {
    physicalCourtId: row.physicalCourtId,
    tenantId,
    clusterId: row.clusterId,
    displayName: row.displayName,
    displayCode: row.displayCode ?? null,
    displayNumber: row.displayNumber ?? null,
    sortOrder: row.sortOrder ?? 0,
    lifecycleStatus: row.status || row.lifecycleStatus || "active",
  };
}

export async function rpcListEligibleCourts(input = {}) {
  if (!testClientOverride && !hasSupabaseConfig()) {
    return {
      ok: false,
      code: COURT_RESOURCE_CODE.SUPABASE_NOT_CONFIGURED,
      error: "Supabase is not configured.",
      courts: [],
    };
  }
  const client = resolveClient();
  if (!client) {
    return {
      ok: false,
      code: COURT_RESOURCE_CODE.CANONICAL_PATH_UNAVAILABLE,
      error: "Canonical inventory RPC client is unavailable.",
      courts: [],
    };
  }
  const { data, error } = await client.rpc(CANONICAL_LIST_ELIGIBLE_RPC, {
    p_tenant_id: input.tenantId,
    p_club_id: input.clubId,
    p_cluster_id: input.clusterId ?? null,
  });
  if (error) {
    if (isMissingRpcError(error)) {
      return {
        ok: false,
        code: COURT_RESOURCE_CODE.CANONICAL_PATH_UNAVAILABLE,
        error: error.message,
        courts: [],
      };
    }
    return {
      ok: false,
      code: COURT_RESOURCE_CODE.DATA_UNAVAILABLE,
      error: error.message,
      courts: [],
    };
  }
  return parseRpcJson(data);
}

/**
 * Production runtime: secure RPC read, then native physicalCourtId projection.
 * Never falls back to Club V3 blob or browser storage.
 */
export async function productionListEligiblePhysicalCourts(request = {}) {
  const listed = await rpcListEligibleCourts({
    tenantId: request.tenantId,
    clubId: request.clubId,
    clusterId: request.clusterId,
  });
  if (!listed?.ok) {
    return listed?.courts ? listed : { ...listed, courts: [] };
  }
  const courts = Array.isArray(listed.courts) ? listed.courts : [];
  const tenantId = String(request.tenantId || "").trim();
  const clubId = String(request.clubId || "").trim();
  const clusterIds = [...new Set(courts.map((row) => row.clusterId).filter(Boolean))];
  return listEligiblePhysicalCourts(request, {
    physicalCourts: courts.map((row) => toCanonicalCourt(row, tenantId)),
    clubOperationalAccess: courts.map((row) => ({
      tenantId,
      clubId,
      physicalCourtId: row.physicalCourtId,
      status: "enabled",
    })),
    clusters: request.clusterId
      ? [{ id: request.clusterId, tenantId }]
      : clusterIds.map((id) => ({ id, tenantId })),
    clubs: [{ id: clubId, tenantId }],
  });
}
