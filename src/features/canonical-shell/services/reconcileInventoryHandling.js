import { CANONICAL_ROUTE_CATALOG } from "../config/canonicalRouteCatalog.js";
import { CANONICAL_MENU_DATA } from "../config/canonicalMenuData.js";
import {
  B01_LEGACY_MESSAGES_ROUTE,
  B03_SHADOW_SKILL_ASSESSMENT_V5,
} from "../config/ownerDecisions.js";

/**
 * Explicit handling-state reconciliation for all inventoried routes (must total 179).
 *
 * States:
 * - ACTIVE_MENU
 * - CONTEXTUAL_NAVIGATION
 * - HIDDEN_LEGACY
 * - HIDDEN_SHADOW
 * - HIDDEN_ACTIVE
 * - DEAD
 * - REDIRECT_METADATA
 * - TECHNICAL_DIRECT_ACCESS
 * - NOT_APPLICABLE_TO_MENU
 */

const HANDLING_STATES = Object.freeze([
  "ACTIVE_MENU",
  "CONTEXTUAL_NAVIGATION",
  "HIDDEN_LEGACY",
  "HIDDEN_SHADOW",
  "HIDDEN_ACTIVE",
  "DEAD",
  "REDIRECT_METADATA",
  "TECHNICAL_DIRECT_ACCESS",
  "NOT_APPLICABLE_TO_MENU",
]);

function menuNodeForPath(path) {
  return (CANONICAL_MENU_DATA.nodes || []).find((node) => node.route === path) || null;
}

/**
 * @param {{ path: string, classification: string, disposition: string, proposedCanonicalMenu: boolean }} entry
 */
export function resolveInventoryHandlingState(entry) {
  const path = entry?.path || "";
  const classification = entry?.classification || "";
  const disposition = entry?.disposition || "";
  const node = menuNodeForPath(path);

  if (path === B03_SHADOW_SKILL_ASSESSMENT_V5 || classification === "SHADOW") {
    return "HIDDEN_SHADOW";
  }

  if (disposition === "REDIRECT_LEGACY" || classification === "DUPLICATE") {
    return "REDIRECT_METADATA";
  }

  if (classification === "LEGACY") {
    return "HIDDEN_LEGACY";
  }

  if (classification === "HIDDEN_ACTIVE") {
    // Some HIDDEN_ACTIVE are still technical direct-access surfaces.
    if (path.startsWith("/api/") || path.includes("/internal/") || path.includes("/debug")) {
      return "TECHNICAL_DIRECT_ACCESS";
    }
    return "HIDDEN_ACTIVE";
  }

  if (node?.contextualOnly || (entry.proposedCanonicalMenu && String(path).includes(":"))) {
    return "CONTEXTUAL_NAVIGATION";
  }

  if (entry.proposedCanonicalMenu && node && !node.contextualOnly) {
    return "ACTIVE_MENU";
  }

  if (classification === "CANONICAL" && !entry.proposedCanonicalMenu) {
    return "TECHNICAL_DIRECT_ACCESS";
  }

  if (disposition === "CONTROLLED_REDIRECT_AND_INCREMENTAL_MIGRATION") {
    return "REDIRECT_METADATA";
  }

  return "NOT_APPLICABLE_TO_MENU";
}

export function reconcileInventoryHandling(options = {}) {
  const routes = options.routes || CANONICAL_ROUTE_CATALOG.routes;
  const counts = Object.fromEntries(HANDLING_STATES.map((state) => [state, 0]));
  const rows = [];

  for (const entry of routes) {
    const handling = resolveInventoryHandlingState(entry);
    counts[handling] = (counts[handling] || 0) + 1;
    rows.push({
      path: entry.path,
      classification: entry.classification,
      disposition: entry.disposition,
      proposedCanonicalMenu: Boolean(entry.proposedCanonicalMenu),
      handling,
    });
  }

  const total = rows.length;
  const sumStates = Object.values(counts).reduce((a, b) => a + b, 0);

  return {
    ok: total === 179 && sumStates === 179,
    total,
    sumStates,
    counts,
    rows,
    states: HANDLING_STATES,
    notes: {
      B01_legacyMessages: B01_LEGACY_MESSAGES_ROUTE,
      B03_shadow: B03_SHADOW_SKILL_ASSESSMENT_V5,
      redirectMetadataIsPhase4Runtime: true,
    },
  };
}
