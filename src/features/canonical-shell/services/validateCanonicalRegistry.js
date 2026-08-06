import { buildCanonicalMenuTree } from "../config/canonicalMenuRegistry.js";
import { CANONICAL_ROUTE_CATALOG } from "../config/canonicalRouteCatalog.js";
import { flattenCanonicalMenu, assertOwnerDecisionMenuInvariants } from "./filterCanonicalMenu.js";
import {
  B01_MESSAGING_EXPERIENCE_ROUTE,
  B01_CRM_MESSAGES_ROUTE,
  B01_LEGACY_MESSAGES_ROUTE,
  B01_CANONICAL_MESSAGES_ROUTE,
  B02_LEGACY_TOURNAMENT_PREFIX,
  B02_CANONICAL_TOURNAMENT_PREFIX,
  B03_SHADOW_SKILL_ASSESSMENT_V5,
} from "../config/ownerDecisions.js";

/**
 * Registry validation for Phase 3 menu completion.
 */

export function validateCanonicalRegistry(options = {}) {
  const tree = options.tree || buildCanonicalMenuTree();
  const flat = flattenCanonicalMenu(tree);
  const routes = flat.map((n) => n.route).filter(Boolean);
  const routeSet = new Set();
  const duplicateActiveEntries = [];

  for (const route of routes) {
    if (routeSet.has(route)) duplicateActiveEntries.push(route);
    else routeSet.add(route);
  }

  const level1Groups = new Set(tree.map((g) => String(g.level1)));
  const level2Modules = new Set();
  const level3Actions = new Set();

  for (const node of flat) {
    if (node.level2) level2Modules.add(`${node.level1}::${node.level2}`);
    if (node.level3) level3Actions.add(`${node.level1}::${node.level2}::${node.level3}`);
  }

  // Also count L2 modules that are direct links (promoted, no level3 children in tree).
  for (const group of tree) {
    for (const mod of group.children || []) {
      if (mod.level2) level2Modules.add(`${mod.level1}::${mod.level2}`);
    }
  }

  const owner = assertOwnerDecisionMenuInvariants(tree);
  const catalog = CANONICAL_ROUTE_CATALOG;
  const legacyHidden = catalog.routes.filter((r) => r.classification === "LEGACY").length;
  const shadowHidden = catalog.routes.filter((r) => r.classification === "SHADOW").length;
  const menuSurfaceLeaves = flat.filter((n) => !n.contextualOnly && !String(n.route || "").includes(":"));
  const unfinishedInMenu = menuSurfaceLeaves.filter(
    (n) => n.visibilityStatus === "coming_soon" || n.visibilityStatus === "shadow"
  );
  const partialInMenu = menuSurfaceLeaves.filter((n) => n.visibilityStatus === "partial");

  const blockers = [];
  if (duplicateActiveEntries.length) {
    blockers.push({ id: "DUPLICATE_ACTIVE", routes: duplicateActiveEntries });
  }
  // OD-B01 Phase 4: dual-canonical required — both /messages and /crm/messages.
  if (!owner.hasMessagingExperience || !owner.hasCrmMessages) {
    blockers.push({
      id: "B01_DUAL_CANONICAL_MESSAGES_MISSING",
      hasMessagingExperience: owner.hasMessagingExperience,
      hasCrmMessages: owner.hasCrmMessages,
    });
  }
  if (owner.duplicateMessagesEntries) {
    blockers.push({ id: "B01_DUPLICATE_SAME_PATH_MESSAGES" });
  }
  if (owner.hasShadowSkillV5) {
    blockers.push({ id: "B03_SHADOW_IN_MENU" });
  }
  if (owner.legacyTournamentHubCount > 0) {
    blockers.push({ id: "B02_LEGACY_TOURNAMENT_IN_MENU" });
  }
  if (level1Groups.size !== 13) {
    blockers.push({ id: "LEVEL1_COUNT", actual: level1Groups.size, expected: 13 });
  }
  if (unfinishedInMenu.some((n) => n.visibilityStatus === "shadow")) {
    blockers.push({ id: "SHADOW_IN_ACTIVE_MENU" });
  }

  // Active menu surface excludes contextual parameterized deep-links.
  const activeMenuRoutes = menuSurfaceLeaves.map((n) => n.route).filter(Boolean);
  const activeRouteSet = new Set();
  const duplicateMenuSurface = [];
  for (const route of activeMenuRoutes) {
    if (activeRouteSet.has(route)) duplicateMenuSurface.push(route);
    else activeRouteSet.add(route);
  }
  if (duplicateMenuSurface.length) {
    blockers.push({ id: "DUPLICATE_MENU_SURFACE", routes: duplicateMenuSurface });
  }

  return {
    ok: blockers.length === 0,
    blockers,
    counts: {
      level1Groups: level1Groups.size,
      level2Modules: level2Modules.size,
      level3Actions: level3Actions.size,
      activeMenuNodes: menuSurfaceLeaves.length,
      registryLeafNodes: flat.length,
      proposedCanonicalMenu: catalog.meta.proposedCanonicalMenuCount,
      inventoriedRoutes: catalog.meta.totalRoutes,
      legacyRoutesHidden: legacyHidden,
      shadowRoutesHidden: shadowHidden,
      partialMenuNodes: partialInMenu.length,
      contextualNodesHiddenFromMenu: flat.length - menuSurfaceLeaves.length,
      duplicateActiveEntries: duplicateActiveEntries.length + duplicateMenuSurface.length,
    },
    ownerDecisions: {
      B01: {
        messagingExperience: B01_MESSAGING_EXPERIENCE_ROUTE,
        crmMessages: B01_CRM_MESSAGES_ROUTE,
        canonical: B01_CANONICAL_MESSAGES_ROUTE,
        legacy: B01_LEGACY_MESSAGES_ROUTE,
        hasMessagingExperience: owner.hasMessagingExperience,
        hasCrmMessages: owner.hasCrmMessages,
        hasCanonical: owner.hasCanonicalMessages,
        hasLegacy: false,
        dualCanonical: owner.dualCanonicalMessages,
      },
      B02: {
        canonicalPrefix: B02_CANONICAL_TOURNAMENT_PREFIX,
        legacyPrefix: B02_LEGACY_TOURNAMENT_PREFIX,
        canonicalCount: owner.canonicalTournamentCount,
        legacyHubCount: owner.legacyTournamentHubCount,
      },
      B03: {
        shadow: B03_SHADOW_SKILL_ASSESSMENT_V5,
        hasShadow: owner.hasShadowSkillV5,
      },
    },
    classificationCounts: catalog.meta.classificationCounts,
  };
}
