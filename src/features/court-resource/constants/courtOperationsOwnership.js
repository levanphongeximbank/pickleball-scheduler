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

export const COURT_MASTER_TABLE = "court_resource_physical_courts";
export const COURT_CLUSTER_TOPOLOGY_TABLE = "court_clusters";
export const COURT_ACCESS_AUTHORITY_TABLE = "court_resource_club_operational_access";
export const CANONICAL_BOOKING_BUSINESS_TABLE = "court_operations_bookings";
export const CANONICAL_LIST_ELIGIBLE_RPC = "court_resource_list_eligible_courts";
export const CANONICAL_LIST_OWNER_RESERVATIONS_RPC =
  "court_resource_list_owner_reservations";
export const CANONICAL_BOOKING_CREATE_RPC = "court_operations_booking_create";

export const PHYSICAL_COURT_ID_IS_IDENTITY = true;
export const CLUSTER_ID_IS_IDENTITY = false;
export const COURT_COUNT_IS_IDENTITY = false;
export const DISPLAY_LABEL_IS_IDENTITY = false;
