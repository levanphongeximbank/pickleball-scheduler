/**
 * Frozen 2.2 Court Operations ownership for Court Resource.
 * Do not reassign these owners without an Owner GO.
 */
export const COURT_RESOURCE_OWNER = "2.2_COURT_OPERATIONS";
export const COURT_RESOURCE_GATEWAY_OWNER = "2.2_COURT_OPERATIONS";
export const COURT_MASTER_OWNER = "2.2_COURT_OPERATIONS";
export const COURT_ACCESS_AUTHORITY_OWNER = "2.2_COURT_OPERATIONS";
export const COMPETITION_PROVIDER_BINDING_OWNER = "2.2_COURT_OPERATIONS";
export const BOOKING_BUSINESS_OWNER = "2.2_COURT_OPERATIONS";
export const RESOURCE_BLOCK_BUSINESS_OWNER = "2.2_COURT_OPERATIONS";
export const COURT_LIVE_RESOURCE_RUNTIME_OWNER = "2.2_COURT_OPERATIONS";
export const COMPETITION_MATCH_ASSIGNMENT_OWNER = "2.13_COMPETITION_ENGINE";
export const COMPETITION_MATCH_LIFECYCLE_OWNER = "2.13_COMPETITION_ENGINE";
export const COMPETITION_SCORING_OWNER = "2.13_COMPETITION_ENGINE";

/** Distinct id owners — tenant ≠ venue ≠ club (Batch 5). */
export const TENANT_ID_OWNER = "PLATFORM_CANONICAL_ORGANIZATION";
export const VENUE_ID_OWNER = "2.1_VENUE_MANAGEMENT";
export const CLUB_ID_OWNER = "2.3_CLUB_MANAGEMENT";
export const CLUSTER_ID_OWNER = "2.2_COURT_OPERATIONS";
export const PHYSICAL_COURT_ID_OWNER = "2.2_COURT_OPERATIONS";
export const CLUB_OPERATIONAL_COURT_ACCESS_OWNER = "2.2_COURT_OPERATIONS";

export const TENANT_ID_EQUALS_VENUE_ID_ASSUMPTION = "NO";
export const COURT_CLUSTERS_VENUE_ID_SEMANTICS = "organization_parent_id_debt";
export const D4_VENUE_BOUNDARY_STATUS = "COUPLED_TO_VENUES_AS_TENANT_OUT_OF_SCOPE";
export const NEW_SQL_REQUIRED = "YES";
export const NEW_DUPLICATE_IDENTITY_CONTRACTS_CREATED = "NO";

export const COURT_MASTER_TABLE = "court_resource_physical_courts";
export const COURT_CLUSTER_TOPOLOGY_TABLE = "court_clusters";
export const COURT_ACCESS_AUTHORITY_TABLE = "court_resource_club_operational_access";
export const CANONICAL_BOOKING_BUSINESS_TABLE = "court_operations_bookings";
export const CANONICAL_RESOURCE_BLOCK_BUSINESS_TABLE =
  "court_operations_resource_blocks";
export const CANONICAL_LIVE_STATE_TABLE = "court_operations_court_live_states";
export const CANONICAL_RESOURCE_SESSION_TABLE =
  "court_operations_resource_sessions";
export const CANONICAL_LIVE_BEGIN_SESSION_RPC =
  "court_operations_live_begin_resource_session";
export const CANONICAL_LIST_ELIGIBLE_RPC = "court_resource_list_eligible_courts";
export const CANONICAL_LIST_OWNER_RESERVATIONS_RPC =
  "court_resource_list_owner_reservations";
export const CANONICAL_BOOKING_CREATE_RPC = "court_operations_booking_create";
export const CANONICAL_RESOURCE_BLOCK_CREATE_RPC =
  "court_operations_resource_block_create";

export const PHYSICAL_COURT_ID_IS_IDENTITY = true;
export const CLUSTER_ID_IS_IDENTITY = false;
export const COURT_COUNT_IS_IDENTITY = false;
export const DISPLAY_LABEL_IS_IDENTITY = false;
