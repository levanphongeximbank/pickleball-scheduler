export const CANONICAL_IDENTITY_CONTRACT_VERSION =
  "court-resource.canonical-identity.v1";

export const CANONICAL_PHYSICAL_COURT_MASTER_TARGET =
  "court_resource_physical_courts";

export const DURABLE_CLUSTER_SOURCE = "public.court_clusters.id";
export const CANONICAL_RESERVATION_CUTOVER = false;

export const LEGACY_COURT_MAPPING_STATUS = Object.freeze({
  DETERMINISTIC: "deterministic",
  CANDIDATE_REVIEW: "candidate_review",
  AMBIGUOUS: "ambiguous",
  UNRESOLVED_CLUSTER: "unresolved_cluster",
  INVALID_SCOPE: "invalid_scope",
});

export const CANONICAL_COURT_IDENTITY = Object.freeze({
  contractVersion: CANONICAL_IDENTITY_CONTRACT_VERSION,
  canonicalMasterTarget: CANONICAL_PHYSICAL_COURT_MASTER_TARGET,
  durableClusterSource: DURABLE_CLUSTER_SOURCE,
  reservationCutover: CANONICAL_RESERVATION_CUTOVER,
  labelIsIdentity: false,
});
