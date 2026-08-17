import {
  COURT_CANONICAL_VITE_FLAGS,
  readCourtCanonicalViteFlag,
} from "../../../court-resource/constants/courtCanonicalViteFlags.js";

/**
 * Adoption control for Competition Mode Court Adapter B (Batch 6).
 *
 * Default OFF — no Staging/Production activation in this batch.
 * When ON: canonical mode paths use Mode Adapter B → Head A only (fail closed).
 */
export const CANONICAL_COMPETITION_COURT_ADAPTERS_DEFAULT = false;

export const CANONICAL_COMPETITION_COURT_ADAPTERS_FLAG =
  COURT_CANONICAL_VITE_FLAGS.COMPETITION_COURT_ADAPTERS;

let override = null;

export function isCanonicalCompetitionCourtAdaptersEnabled() {
  if (override === true) return true;
  if (override === false) return false;
  if (readCourtCanonicalViteFlag(CANONICAL_COMPETITION_COURT_ADAPTERS_FLAG)) {
    return true;
  }
  return CANONICAL_COMPETITION_COURT_ADAPTERS_DEFAULT;
}

/** @internal */
export function __setCanonicalCompetitionCourtAdaptersForTests(enabled) {
  override = enabled === true;
}

/** @internal */
export function __resetCanonicalCompetitionCourtAdaptersForTests() {
  override = null;
}
