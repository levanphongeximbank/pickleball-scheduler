import {
  DURABLE_CLUSTER_SOURCE,
  LEGACY_COURT_MAPPING_STATUS,
} from "../constants/canonicalIdentity.js";

function text(value) {
  return value == null ? "" : String(value).trim();
}

function result(classification, evidence, clusterId = null) {
  return Object.freeze({
    ok: classification === LEGACY_COURT_MAPPING_STATUS.DETERMINISTIC,
    classification,
    clusterId,
    ...(clusterId ? { source: DURABLE_CLUSTER_SOURCE } : {}),
    evidence: Object.freeze(evidence),
  });
}

export function reconcileClusterIdentity(input = {}) {
  const tenantId = text(input.tenantId);
  const venueId = text(input.venueId);
  const sourceSystem = text(input.sourceSystem);
  const sourceVersion = text(input.sourceVersion);
  const legacyClusterId = text(input.legacyClusterId);
  if (!tenantId || !venueId || !sourceSystem || !sourceVersion || !legacyClusterId) {
    return result(LEGACY_COURT_MAPPING_STATUS.INVALID_SCOPE, [
      { type: "INVALID_CLUSTER_PROVENANCE_OR_SCOPE" },
    ]);
  }

  const durableClusters = Array.isArray(input.durableClusters) ? input.durableClusters : [];
  const durableIds = new Set(
    durableClusters
      .filter(
        (cluster) =>
          text(cluster.tenantId ?? cluster.venue_id) === tenantId &&
          text(cluster.venueId ?? cluster.venue_id) === venueId
      )
      .map((cluster) => text(cluster.clusterId ?? cluster.id))
      .filter(Boolean)
  );

  const mappings = (Array.isArray(input.clusterMappings) ? input.clusterMappings : []).filter(
    (mapping) =>
      text(mapping.sourceSystem) === sourceSystem &&
      text(mapping.sourceVersion) === sourceVersion &&
      text(mapping.legacyClusterId ?? mapping.sourceClusterId) === legacyClusterId
  );
  if (
    mappings.some(
      (mapping) =>
        text(mapping.tenantId) !== tenantId
    )
  ) {
    return result(LEGACY_COURT_MAPPING_STATUS.INVALID_SCOPE, [
      { type: "CROSS_SCOPE_CLUSTER_MAPPING" },
    ]);
  }

  const candidates = new Set();
  if (durableIds.has(legacyClusterId)) candidates.add(legacyClusterId);
  for (const mapping of mappings) {
    const target = text(mapping.clusterId ?? mapping.durableClusterId);
    if (durableIds.has(target)) candidates.add(target);
  }
  if (candidates.size > 1) {
    return result(LEGACY_COURT_MAPPING_STATUS.AMBIGUOUS, [
      { type: "MULTIPLE_DURABLE_CLUSTER_CANDIDATES", clusterIds: Object.freeze([...candidates]) },
    ]);
  }
  if (candidates.size === 1) {
    const clusterId = [...candidates][0];
    return result(
      LEGACY_COURT_MAPPING_STATUS.DETERMINISTIC,
      [{
        type: clusterId === legacyClusterId ? "DURABLE_CLUSTER_ID" : "EXPLICIT_CLUSTER_MAPPING",
        legacyClusterId,
        clusterId,
      }],
      clusterId
    );
  }
  if (mappings.length > 0) {
    return result(LEGACY_COURT_MAPPING_STATUS.CANDIDATE_REVIEW, [
      { type: "MAPPED_CLUSTER_NOT_DURABLE" },
    ]);
  }
  return result(LEGACY_COURT_MAPPING_STATUS.UNRESOLVED_CLUSTER, [
    { type: "NO_DURABLE_CLUSTER_EVIDENCE" },
  ]);
}

export const classifyClusterIdentity = reconcileClusterIdentity;
