/**
 * COMMS-05 persistence package exports (internal to Communication module).
 * Public barrel re-exports only safe factories / gates — not raw row types.
 */

export {
  COMMUNICATION_SCHEMA,
  COMMUNICATION_TABLES,
  COMMUNICATION_TABLE_NAME_VALUES,
  COMMUNICATION_RPC,
  ACTIVATION_GATES,
} from "./schema.js";

export {
  COMMUNICATION_ACTIVATION_STATUS,
  assertActivationAllowed,
  getCommunicationActivationSnapshot,
} from "./activationGates.js";

export {
  assertSupabaseCommunicationClient,
  assertCommunicationTableName,
  createFakeSupabaseCommunicationClient,
} from "./supabase/clientContract.js";

export {
  mapSupabaseCommunicationError,
  sanitizePersistenceErrorContext,
  malformedRowError,
  notFoundError,
} from "./supabase/errorMapping.js";

export { createSupabaseCommunicationRepositories } from "./supabase/createSupabaseCommunicationRepositories.js";

export {
  COMMUNICATION_REALTIME_EVENT_TYPE,
  COMMUNICATION_REALTIME_EVENT_TYPE_VALUES,
  createCommunicationRealtimeEventEnvelope,
} from "./realtime/eventEnvelope.js";

export { createConversationRealtimeSubscriptionDescriptor } from "./realtime/subscriptionDescriptor.js";

export {
  createInMemoryRealtimeDeliveryAdapter,
  createScopedRealtimeDeliveryAdapter,
} from "./realtime/createRealtimeDeliveryAdapter.js";

export {
  COMMUNICATION_DELIVERY_INTENT,
  COMMUNICATION_OUTBOX_INTEGRATION_GATES,
  createCommunicationPersistenceEventIntent,
  createCommunicationPersistenceEventRepository,
} from "./outbox/persistenceEventBoundary.js";
