/**
 * Finance repository exports (Phase 1C).
 *
 * In-memory repositories are for capability proof and tests only —
 * not production persistence.
 */

export { FINANCE_REPOSITORY_PORTS } from "./ports.js";
export {
  createInMemoryFinanceRepositories,
  cloneFrozen,
} from "./inMemory.js";
