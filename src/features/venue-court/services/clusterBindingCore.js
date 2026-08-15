/**
 * Pure transitional cluster-membership rules shared by the SQL RPC contract
 * and the local/legacy application path.
 *
 * Stamps Club operational inventory clusterId values. This is not Physical
 * Court UUID identity, not Club operational-access authorization, and not
 * reservation. This is not a Team Tournament helper. It does not create
 * courts, delete courts, or mutate bookings.
 */

import {
  CLUSTER_BINDING_CODE,
  CLUSTER_BINDING_MESSAGES,
} from "../constants/clusterBindingContract.js";

function trimId(value) {
  if (value == null) {
    return null;
  }
  const trimmed = String(value).trim();
  return trimmed === "" ? null : trimmed;
}

function deny(code, error) {
  return {
    ok: false,
    code,
    error: error || CLUSTER_BINDING_MESSAGES[code] || code,
    clubRegisteredClusterId: null,
    courts: [],
    changedCourtIds: [],
    clubChanged: false,
    courtsChanged: false,
  };
}

export function normalizeClusterIdValue(value) {
  return trimId(value);
}

export function isUnstampedCourt(court) {
  return normalizeClusterIdValue(court?.clusterId ?? court?.cluster_id) == null;
}

export function listUnstampedCourts(courts = []) {
  return (Array.isArray(courts) ? courts : [])
    .filter((court) => isUnstampedCourt(court))
    .map((court) => ({ ...court }));
}

function courtIdOf(court) {
  if (court?.id == null) {
    return null;
  }
  const id = String(court.id).trim();
  return id === "" ? null : id;
}

function uniqueIds(ids = []) {
  const seen = new Set();
  const out = [];
  for (const raw of Array.isArray(ids) ? ids : []) {
    const id = trimId(raw);
    if (!id || seen.has(id)) {
      continue;
    }
    seen.add(id);
    out.push(id);
  }
  return out;
}

function readCourtClusterId(court) {
  return normalizeClusterIdValue(court?.clusterId ?? court?.cluster_id);
}

function stampCourtCluster(court, clusterId) {
  const next = { ...court, clusterId };
  if (Object.prototype.hasOwnProperty.call(court, "cluster_id")) {
    next.cluster_id = clusterId;
  }
  return next;
}

/**
 * Fail-closed bind of club registeredClusterId + selected physical courts.
 *
 * A. NULL club/court cluster → bind to target
 * B. already target → idempotent no-op for that entity
 * C. different non-null cluster → FOREIGN_CLUSTER (no silent move)
 *
 * @param {{
 *   clubId: string,
 *   clusterId: string,
 *   courtIds?: Array<string|number>,
 *   clubRegisteredClusterId?: string|null,
 *   courts?: object[],
 * }} input
 */
export function applyCanonicalClusterBinding(input = {}) {
  const clubId = trimId(input.clubId);
  const clusterId = trimId(input.clusterId);
  const requestedIds = uniqueIds(input.courtIds);

  if (!clubId) {
    return deny(CLUSTER_BINDING_CODE.CLUB_REQUIRED, "Thiếu clubId.");
  }
  if (!clusterId) {
    return deny(CLUSTER_BINDING_CODE.CLUSTER_REQUIRED, "Thiếu clusterId.");
  }

  const currentClubCluster = normalizeClusterIdValue(input.clubRegisteredClusterId);
  if (currentClubCluster && currentClubCluster !== clusterId) {
    return deny(CLUSTER_BINDING_CODE.FOREIGN_CLUSTER);
  }

  const courts = Array.isArray(input.courts) ? input.courts.map((court) => ({ ...court })) : [];
  const byId = new Map();
  for (const court of courts) {
    const id = courtIdOf(court);
    if (id) {
      byId.set(id, court);
    }
  }

  for (const courtId of requestedIds) {
    const court = byId.get(courtId);
    if (!court) {
      return deny(CLUSTER_BINDING_CODE.COURT_NOT_FOUND);
    }
    if (court.clubId && trimId(court.clubId) && trimId(court.clubId) !== clubId) {
      return deny(CLUSTER_BINDING_CODE.CROSS_CLUB_COURT);
    }
    const current = readCourtClusterId(court);
    if (current && current !== clusterId) {
      return deny(CLUSTER_BINDING_CODE.FOREIGN_CLUSTER);
    }
  }

  const requested = new Set(requestedIds);
  const changedCourtIds = [];
  const nextCourts = courts.map((court) => {
    const id = courtIdOf(court);
    if (!id || !requested.has(id)) {
      return { ...court };
    }
    const current = readCourtClusterId(court);
    if (current === clusterId) {
      return { ...court };
    }
    changedCourtIds.push(id);
    return stampCourtCluster(court, clusterId);
  });

  const clubChanged = currentClubCluster !== clusterId;

  return {
    ok: true,
    code: CLUSTER_BINDING_CODE.OK,
    error: null,
    clubRegisteredClusterId: clusterId,
    courts: nextCourts,
    changedCourtIds,
    clubChanged,
    courtsChanged: changedCourtIds.length > 0,
    alreadyBound: !clubChanged && changedCourtIds.length === 0,
  };
}

/**
 * Extract the courts array + JSON path from a club_data_v3.data payload.
 * Nested `data.data.courts` wins over flat `data.courts` (same as cloud reader).
 */
export function resolveClubDataV3CourtsPath(rowData) {
  if (!rowData || typeof rowData !== "object") {
    return { courts: [], path: null, nested: false };
  }
  if (rowData.data && typeof rowData.data === "object" && Array.isArray(rowData.data.courts)) {
    return { courts: rowData.data.courts, path: "data.courts", nested: true };
  }
  if (Array.isArray(rowData.courts)) {
    return { courts: rowData.courts, path: "courts", nested: false };
  }
  return { courts: [], path: null, nested: false };
}

export function writeClubDataV3Courts(rowData, nextCourts) {
  const source = rowData && typeof rowData === "object" ? rowData : {};
  const resolved = resolveClubDataV3CourtsPath(source);
  if (resolved.nested) {
    return {
      ...source,
      data: {
        ...(source.data && typeof source.data === "object" ? source.data : {}),
        courts: nextCourts,
      },
    };
  }
  return {
    ...source,
    courts: nextCourts,
  };
}
