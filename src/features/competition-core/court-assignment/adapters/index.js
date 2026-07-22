/**
 * CORE-12 Phase 1B — test doubles / stubs only (not production APIs).
 *
 * Import from here in tests. Do not treat these as the normal runtime surface.
 * The pure assigner never invokes audit ports.
 *
 * Phase 1C TE anti-corruption adapter is NOT re-exported here.
 * Import it from `./te-compat/` or `../compatibility/` (dedicated compatibility surface).
 */

export {
  createFailClosedCourtAssignmentPort,
  createFixedCourtAssignmentPort,
} from "../ports/courtAssignmentPort.js";

export {
  createFailClosedCourtAvailabilityPort,
  createFixedCourtAvailabilityPort,
} from "../ports/courtAvailabilityPort.js";

export {
  createEmptyCourtAssignmentRulePort,
  createFixedCourtAssignmentRulePort,
} from "../ports/courtAssignmentRulePort.js";

export { createInMemoryCourtAssignmentAuditPort } from "../ports/courtAssignmentAuditPort.js";

/** Optional safe wrapper reserved for integration hosts — not used by Phase 1B pure path. */
export { assignCourtsSafe } from "../services/assignCourtsDeterministic.js";
