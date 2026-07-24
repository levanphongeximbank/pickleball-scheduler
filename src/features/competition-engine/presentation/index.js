/**
 * Competition Engine presentation helpers
 * (E2E-03 Organizer + E2E-04 Player/Referee + E2E-05 Public Experience).
 * No global router/shell changes — view-model only.
 */

export { buildOrganizerPortalSections } from "./organizerOperationsViewModel.js";
export { buildPlayerPortalSections } from "./player/playerOperationsViewModel.js";
export { buildRefereePortalSections } from "./referee/refereeOperationsViewModel.js";

// E2E-05 Public Experience view-model
export { buildPublicCompetitionExperienceSections } from "./public/index.js";
