/**
 * Coaching durable persistence exports (COACHING-02).
 * Not wired as application runtime default.
 */

export {
  requireCoachingDatabaseClientPort,
  COACHING_02_TABLES,
  COACHING_02_RPC,
} from "./databaseClientPort.js";

export {
  translateCoachingPersistenceError,
  withCoachingPersistenceErrors,
} from "./errorTranslation.js";

export { createFakeCoachingDatabaseClient } from "./createFakeCoachingDatabaseClient.js";

export { createDurableCoachingRepositories } from "./durable/createDurableCoachingRepositories.js";

export * from "./mapping/coachingMapping.js";

export const COACHING_DURABLE_PERSISTENCE_PHASE = "COACHING-02";

export const COACHING_DURABLE_RUNTIME_DEFAULT = false;
