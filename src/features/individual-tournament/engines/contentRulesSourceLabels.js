/**
 * Display labels for Content rules bootstrap source (G2-G diagnostics).
 * ASCII-only helpers — keep presentation honest without redesign.
 */

import { CONTENT_RULES_SOURCE } from "./officialContentCompetitionRules.js";

export function formatContentRulesBootstrapSource(raw) {
  const value = String(raw || "").trim();
  if (
    value === CONTENT_RULES_SOURCE.CONTENT_EXPLICIT ||
    value === "CONTENT_EXPLICIT"
  ) {
    return "CONTENT_EXPLICIT (events[].competitionRules)";
  }
  if (
    value === CONTENT_RULES_SOURCE.LEGACY_COMPATIBILITY_DRAFT ||
    value === "LEGACY_COMPATIBILITY_DRAFT" ||
    /officialCompetition/i.test(value)
  ) {
    return "LEGACY_COMPATIBILITY_DRAFT (bootstrap only, not runtime authority)";
  }
  if (
    value === CONTENT_RULES_SOURCE.CANONICAL_SYSTEM_DEFAULT ||
    value === "CANONICAL_SYSTEM_DEFAULT" ||
    value === "canonical.system.default"
  ) {
    return "CANONICAL_SYSTEM_DEFAULT";
  }
  return value || "CANONICAL_SYSTEM_DEFAULT";
}
