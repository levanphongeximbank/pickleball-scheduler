/**
 * Shared canonical writer: bind a club's registeredClusterId and selected
 * physical courts to one court cluster.
 *
 * Cloud authority: public.bind_club_courts_to_cluster (atomic).
 * Local/legacy path is isolated and never fabricates clusterId from venueId.
 */

import { getSupabaseAuthClient, hasSupabaseConfig } from "../../../auth/supabaseClient.js";
import { getCurrentUser } from "../../../auth/authService.js";
import { getClubById } from "../../../domain/clubService.js";
import { loadCourtsForClub, saveCourtsForClub } from "../../../domain/clubStorage.js";
import { updateClubGovernance, canManageClubGovernance } from "../../club/services/clubGovernanceService.js";
import { getClusterById } from "../../court-cluster/services/courtClusterService.js";
import {
  CLUSTER_BINDING_CODE,
  CLUSTER_BINDING_MESSAGES,
  CLUSTER_BINDING_RPC,
} from "../constants/clusterBindingContract.js";
import { applyCanonicalClusterBinding } from "./clusterBindingCore.js";

const defaultDeps = Object.freeze({
  hasSupabaseConfig,
  getSupabaseAuthClient,
  getCurrentUser,
  getClubById,
  loadCourtsForClub,
  saveCourtsForClub,
  updateClubGovernance,
  canManageClubGovernance,
  getClusterById,
});

let deps = { ...defaultDeps };

/** @internal */
export function __setBindClubCourtsToClusterDepsForTests(next = {}) {
  deps = { ...defaultDeps, ...next };
}

/** @internal */
export function __resetBindClubCourtsToClusterDepsForTests() {
  deps = { ...defaultDeps };
}

function trimId(value) {
  if (value == null) {
    return null;
  }
  const trimmed = String(value).trim();
  return trimmed === "" ? null : trimmed;
}

function deny(code, error, extra = {}) {
  return {
    ok: false,
    code,
    error: error || CLUSTER_BINDING_MESSAGES[code] || code,
    clubRegisteredClusterId: null,
    changedCourtIds: [],
    ...extra,
  };
}

function newRequestId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `req-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function isMissingRpcError(error) {
  const message = String(error?.message || error?.code || "").toLowerCase();
  return (
    message.includes("could not find the function") ||
    (message.includes("function") && message.includes("does not exist")) ||
    error?.code === "PGRST202"
  );
}

function parseRpcJson(data) {
  if (!data) {
    return deny(CLUSTER_BINDING_CODE.RPC_FAILED, "RPC trả về rỗng.");
  }
  if (typeof data === "object" && "ok" in data) {
    return data;
  }
  return { ok: true, data };
}

function validateClusterCatalog(clusterId, venueId) {
  const cluster = deps.getClusterById(clusterId);
  if (!cluster) {
    return deny(CLUSTER_BINDING_CODE.CLUSTER_NOT_FOUND);
  }
  if (String(cluster.status || "active") !== "active") {
    return deny(CLUSTER_BINDING_CODE.CLUSTER_INACTIVE);
  }
  if (venueId && cluster.venueId && String(cluster.venueId) !== venueId) {
    return deny(CLUSTER_BINDING_CODE.CLUSTER_VENUE_MISMATCH);
  }
  return { ok: true, cluster };
}

function applyLocalBinding(params) {
  const clubId = trimId(params.clubId);
  const venueId = trimId(params.venueId);
  const clusterId = trimId(params.clusterId);
  const courtIds = Array.isArray(params.courtIds) ? params.courtIds : [];
  const user = params.user || deps.getCurrentUser();

  const club = deps.getClubById(clubId);
  if (!club) {
    return deny(CLUSTER_BINDING_CODE.CLUB_NOT_FOUND);
  }

  const clubVenue = trimId(club.venueId || club.tenantId);
  if (venueId && clubVenue && clubVenue !== venueId) {
    return deny(CLUSTER_BINDING_CODE.CLUB_TENANT_MISMATCH);
  }

  if (!deps.canManageClubGovernance(user, club)) {
    return deny(CLUSTER_BINDING_CODE.FORBIDDEN);
  }

  const catalog = validateClusterCatalog(clusterId, venueId || clubVenue);
  if (!catalog.ok) {
    return catalog;
  }

  const courts = deps.loadCourtsForClub(clubId);
  const applied = applyCanonicalClusterBinding({
    clubId,
    clusterId,
    courtIds,
    clubRegisteredClusterId: club.governance?.registeredClusterId || null,
    courts,
  });
  if (!applied.ok) {
    return applied;
  }

  if (applied.courtsChanged) {
    deps.saveCourtsForClub(applied.courts, clubId);
  }

  if (applied.clubChanged) {
    const gov = deps.updateClubGovernance(clubId, { registeredClusterId: clusterId }, venueId || clubVenue);
    if (!gov.ok) {
      return deny(gov.code || CLUSTER_BINDING_CODE.FORBIDDEN, gov.error);
    }
  }

  return {
    ok: true,
    code: CLUSTER_BINDING_CODE.OK,
    error: null,
    source: "local",
    clubRegisteredClusterId: applied.clubRegisteredClusterId,
    changedCourtIds: applied.changedCourtIds,
    clubChanged: applied.clubChanged,
    courtsChanged: applied.courtsChanged,
    alreadyBound: applied.alreadyBound,
  };
}

async function applyCloudBinding(params) {
  const client = deps.getSupabaseAuthClient();
  if (!client) {
    return deny(CLUSTER_BINDING_CODE.NO_SUPABASE, "Supabase chưa sẵn sàng.");
  }

  const args = {
    p_request_id: params.requestId || newRequestId(),
    p_club_id: params.clubId,
    p_venue_id: params.venueId,
    p_cluster_id: params.clusterId,
    p_court_ids: params.courtIds,
    p_expected_club_version: Number(params.expectedClubVersion),
    p_expected_blob_version: Number(params.expectedBlobVersion ?? params.expectedVersion ?? 0),
  };

  const { data, error } = await client.rpc(CLUSTER_BINDING_RPC, args);
  if (error) {
    if (isMissingRpcError(error)) {
      return deny(CLUSTER_BINDING_CODE.RPC_NOT_DEPLOYED, error.message);
    }
    return deny(CLUSTER_BINDING_CODE.RPC_FAILED, error.message);
  }
  return parseRpcJson(data);
}

/**
 * Bind club registeredClusterId and selected physical court clusterIds.
 *
 * @param {{
 *   clubId: string,
 *   venueId: string,
 *   clusterId: string,
 *   courtIds?: Array<string|number>,
 *   expectedVersion?: number,
 *   expectedClubVersion?: number,
 *   expectedBlobVersion?: number,
 *   requestId?: string,
 *   allowLocalFallback?: boolean,
 * }} params
 */
export async function bindClubCourtsToCluster(params = {}) {
  const clubId = trimId(params.clubId);
  const venueId = trimId(params.venueId);
  const clusterId = trimId(params.clusterId);
  const courtIds = (Array.isArray(params.courtIds) ? params.courtIds : [])
    .map((id) => String(id).trim())
    .filter(Boolean);

  if (!clubId) {
    return deny(CLUSTER_BINDING_CODE.CLUB_REQUIRED, "Thiếu clubId.");
  }
  if (!venueId) {
    return deny(CLUSTER_BINDING_CODE.VENUE_REQUIRED, "Thiếu venueId.");
  }
  if (!clusterId) {
    return deny(CLUSTER_BINDING_CODE.CLUSTER_REQUIRED, "Thiếu clusterId.");
  }

  if (deps.hasSupabaseConfig()) {
    const expectedClubVersion = params.expectedClubVersion ?? params.expectedVersion;
    if (expectedClubVersion == null || !Number.isFinite(Number(expectedClubVersion))) {
      return deny(CLUSTER_BINDING_CODE.VERSION_CONFLICT, "Thiếu phiên bản CLB (expectedClubVersion).");
    }
    return applyCloudBinding({
      clubId,
      venueId,
      clusterId,
      courtIds,
      expectedClubVersion,
      expectedBlobVersion: params.expectedBlobVersion ?? params.expectedVersion,
      requestId: params.requestId,
    });
  }

  if (params.allowLocalFallback === false) {
    return deny(CLUSTER_BINDING_CODE.NO_SUPABASE);
  }

  return applyLocalBinding({
    clubId,
    venueId,
    clusterId,
    courtIds,
    user: params.user,
  });
}
