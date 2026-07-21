/**
 * CORE-06 Phase 1F — persistence barrel.
 * Contract is canonical; in-memory implementation is TEST_ONLY.
 */

export const LINEUP_PERSISTENCE_TX_IMPL_KIND = "TEST_ONLY_IN_MEMORY";

export { createInMemoryLineupPersistenceTransactionPort } from "./createInMemoryPersistenceTransaction.js";
