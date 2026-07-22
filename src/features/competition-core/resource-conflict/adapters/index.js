/**
 * CORE-14 Phase 1F — adapters barrel.
 */

export { createAdapterOccupancyId } from "./occupancyIdentity.js";
export { createAdapterResult, createRejectedAdapterResult } from "./adapterResult.js";
export { adaptScheduleAssignmentsToResourceOccupancies } from "./adaptScheduleAssignments.js";
export { adaptCourtAssignmentsToResourceOccupancies } from "./adaptCourtAssignments.js";
export { adaptRefereeAssignmentsToResourceOccupancies } from "./adaptRefereeAssignments.js";
export { combineResourceOccupancies } from "./combineOccupancies.js";
export { adaptAvailabilityAnswersToFacts } from "./adaptAvailabilityFacts.js";
