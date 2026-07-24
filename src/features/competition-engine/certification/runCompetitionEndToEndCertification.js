/**
 * E2E-07 certification thin entry point.
 */

import { createCompetitionEndToEndCertificationHarness } from "./createCompetitionEndToEndCertificationHarness.js";

/**
 * @param {object} [input]
 */
export async function runCompetitionEndToEndCertification(input = {}) {
  const harness = createCompetitionEndToEndCertificationHarness(input);
  return harness.runFullCertification(input);
}

export { createCompetitionEndToEndCertificationHarness };
