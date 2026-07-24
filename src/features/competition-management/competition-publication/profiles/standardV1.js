/**
 * CM06_STANDARD_V1 publication profile descriptor (CM-06).
 *
 * The single explicit profile in this phase. No hidden default exists —
 * callers must pass `publicationProfileId: "CM06_STANDARD_V1"` explicitly.
 *
 * Requirements:
 * - explicit immutable CompetitionVersion (CM-03)
 * - explicit definition matching that version's content/tenant/competition/revision
 * - branding required, evaluated at the "publication_facing" CM-05 readiness profile
 * - configuration OPTIONAL, but its presence/absence must be explicit
 *   (`configurationPresence: "PRESENT" | "ABSENT"`)
 */

import { COMPETITION_PUBLICATION_PROFILE_ID } from "../constants/profiles.js";
import { deepFreeze } from "../contracts/shared.js";

export const CM06_STANDARD_V1_PROFILE = deepFreeze({
  id: COMPETITION_PUBLICATION_PROFILE_ID.CM06_STANDARD_V1,
  version: 1,
  requiresCompetitionVersion: true,
  requiresDefinitionMatch: true,
  requiresBranding: true,
  brandingReadinessProfile: "publication_facing",
  configurationOptional: true,
  requiresExplicitConfigurationPresence: true,
});
