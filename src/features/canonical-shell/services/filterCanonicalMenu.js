import { normalizeRole, rolesEqual, ROLES } from "../../../auth/roles.js";
import { isNavFeatureEnabled } from "../../../config/navigationConfig.js";
import { isApiEnabled, isMarketplaceEnabled } from "../../integrations/config/integrationFlags.js";
import { isPickVnRatingV5Enabled } from "../../pick-vn-rating-v5/config/flags.js";
import { isPrivatePairingRulesEnabled } from "../../private-pairing-rules/constants/codes.js";
import {
  B01_LEGACY_MESSAGES_ROUTE,
  B03_SHADOW_SKILL_ASSESSMENT_V5,
  OWNER_DECISIONS,
} from "../config/ownerDecisions.js";
import { CANONICAL_MENU_DATA } from "../config/canonicalMenuData.js";
import { buildCanonicalMenuTree } from "../config/canonicalMenuRegistry.js";

const FEATURE_FLAG_CHECKERS = Object.freeze({
  VITE_ENABLE_AI_ENGINE: () => isNavFeatureEnabled("ai"),
  VITE_PICK_VN_RATING_V5_ENABLED: isPickVnRatingV5Enabled,
  VITE_PRIVATE_PAIRING_RULES_ENABLED: isPrivatePairingRulesEnabled,
  VITE_API_ENABLED: isApiEnabled,
  VITE_MARKETPLACE_ENABLED: isMarketplaceEnabled,
  VITE_VPR_RANKING_ENABLED: () =>
    String(import.meta.env?.VITE_VPR_RANKING_ENABLED ?? "false").toLowerCase() === "true",
});

const SUPER_ADMIN_ALIASES = new Set([ROLES.SUPER_ADMIN, ROLES.PLATFORM_ADMIN, "SUPER_ADMIN", "PLATFORM_ADMIN"]);

function isSuperAdminRole(role) {
  const normalized = normalizeRole(role);
  return SUPER_ADMIN_ALIASES.has(role) || SUPER_ADMIN_ALIASES.has(normalized);
}

function resolveQaRoleKey(role) {
  if (!role) return null;
  const mapping = CANONICAL_MENU_DATA.canonicalRoleMapping || {};
  const raw = String(role || "").toUpperCase();
  if (mapping[raw] && CANONICAL_MENU_DATA.roleLevel1Access?.[raw]) {
    return raw;
  }
  // Map canonical runtime role back to a QA persona with level1Access.
  const entry = Object.entries(mapping).find(
    ([, canonical]) => canonical === raw || canonical === normalizeRole(role)
  );
  if (entry && CANONICAL_MENU_DATA.roleLevel1Access?.[entry[0]]) {
    return entry[0];
  }
  if (CANONICAL_MENU_DATA.roleLevel1Access?.[raw]) return raw;
  const normalized = normalizeRole(role);
  if (normalized === ROLES.PLATFORM_ADMIN) return "SUPER_ADMIN";
  if (normalized === ROLES.TENANT_OWNER) return "VENUE_OWNER";
  if (normalized === ROLES.CLUB_MANAGER) return "CLUB_MANAGER";
  if (CANONICAL_MENU_DATA.roleLevel1Access?.[normalized]) return normalized;
  // Unknown / unmapped roles fail closed — no invented persona.
  return null;
}

function isKnownMenuPersona(qaRole) {
  return Boolean(qaRole && CANONICAL_MENU_DATA.roleLevel1Access?.[qaRole]);
}

function hasRequiredPermission(auth, requiredPermissions = []) {
  if (!requiredPermissions.length) return true;
  if (!auth?.rbacEnabled) return true;
  if (isSuperAdminRole(auth?.user?.role)) return true;
  const userPerms = new Set(auth?.permissions || auth?.user?.permissions || []);
  if (typeof auth?.hasPermission === "function") {
    return requiredPermissions.some((perm) => auth.hasPermission(perm));
  }
  return requiredPermissions.some((perm) => userPerms.has(perm));
}

function isFeatureEnabled(flags = []) {
  if (!flags?.length) return true;
  return flags.every((flag) => {
    const checker = FEATURE_FLAG_CHECKERS[flag];
    if (typeof checker === "function") return Boolean(checker());
    // Unknown flags default to enabled so Phase 2 does not invent new gates.
    return true;
  });
}

function isHiddenByOwnerDecision(node) {
  const route = node?.route || "";
  if (route === B01_LEGACY_MESSAGES_ROUTE) return true;
  if (route === B03_SHADOW_SKILL_ASSESSMENT_V5) return true;
  if (route.startsWith("/tournament/") && !route.startsWith("/tournaments/")) {
    // B02: legacy tournament hubs must not appear in proposed menu.
    return true;
  }
  if (node?.visibilityStatus === "shadow" || node?.visibilityStatus === "legacy") {
    return true;
  }
  return false;
}

function roleMaySeeLevel1(qaRole, level1Id) {
  // Fail closed: missing/unknown personas see no Level-1 domains.
  if (!isKnownMenuPersona(qaRole)) return false;
  const access = CANONICAL_MENU_DATA.roleLevel1Access[qaRole];
  if (!access) return false;
  if (access.includes("*")) return true;
  return access.includes(String(level1Id));
}

function roleMaySeeNode(node, role, qaRole) {
  const visibility = node.rbacVisibility || [];
  if (visibility.includes("PUBLIC")) return true;

  // Fail closed for missing or unknown roles (non-PUBLIC nodes).
  if (!role || !isKnownMenuPersona(qaRole)) return false;

  if (visibility.includes("SUPER_ADMIN")) {
    return isSuperAdminRole(role);
  }

  if (visibility.includes("AUTHENTICATED")) {
    return isKnownMenuPersona(qaRole);
  }

  if (node.requiredRoles?.length) {
    return node.requiredRoles.some((required) => rolesEqual(required, role) || required === qaRole);
  }

  if (!roleMaySeeLevel1(qaRole, node.level1)) return false;
  return true;
}

/**
 * Private Pairing Rules — 4-layer gate foundation (menu layer).
 * Unauthorized roles never see the node in the canonical menu tree.
 */
export function isPrivatePairingVisible(auth) {
  if (!isPrivatePairingRulesEnabled()) return false;
  return isSuperAdminRole(auth?.user?.role);
}

function isPrivatePairingNode(node) {
  return (
    node?.level2 === "private-pairing" ||
    node?.route === "/admin/ai-pairing/private-rules" ||
    node?.id?.includes("private-pairing")
  );
}

/**
 * @param {object} node
 * @param {object} auth
 * @param {{ viewport?: 'desktop'|'mobile'|'tablet' }} [options]
 */
export function isCanonicalMenuNodeVisible(node, auth, options = {}) {
  if (!node) return false;
  if (isHiddenByOwnerDecision(node)) return false;

  // Contextual parameterized deep-links stay out of general menu / search surfaces.
  if (node.contextualOnly && !options.includeContextual) return false;
  if (String(node.route || "").includes(":") && !options.includeContextual) return false;

  const viewport = options.viewport || "desktop";
  if (viewport === "mobile" && node.mobileVisible === false) return false;
  // Tablet uses the collapsible desktop sidebar contract — apply desktop visibility.
  if ((viewport === "desktop" || viewport === "tablet") && node.desktopVisible === false) {
    return false;
  }

  if (node.visibilityStatus === "coming_soon" && options.hideComingSoon) return false;

  if (isPrivatePairingNode(node) && !isPrivatePairingVisible(auth)) {
    return false;
  }

  if (!isFeatureEnabled(node.featureFlags)) return false;

  const role = auth?.user?.role;
  const qaRole = resolveQaRoleKey(role);
  if (!roleMaySeeNode(node, role, qaRole)) return false;

  if (!hasRequiredPermission(auth, node.requiredPermissions)) return false;

  return true;
}

function filterTree(nodes, auth, options) {
  return (nodes || [])
    .map((node) => {
      const children = filterTree(node.children || [], auth, options);
      const selfVisible = isCanonicalMenuNodeVisible(node, auth, options);
      if (!selfVisible && children.length === 0) return null;
      if (!selfVisible && children.length > 0) {
        return { ...node, children, route: undefined };
      }
      // Prune empty containers (e.g. Level-2 modules whose contextual children were hidden).
      if (selfVisible && children.length === 0 && !node.route) return null;
      return { ...node, children };
    })
    .filter(Boolean);
}

/**
 * Filter the canonical menu tree for a user/viewport.
 * Single registry for desktop + mobile — no duplicated menu sources.
 */
export function filterCanonicalMenu(auth, options = {}) {
  const tree = options.tree || buildCanonicalMenuTree();
  return filterTree(tree, auth, options);
}

/**
 * Flatten visible leaves (useful for breadcrumbs / search foundation).
 */
export function flattenCanonicalMenu(nodes = [], acc = []) {
  for (const node of nodes) {
    if (node.route) acc.push(node);
    if (node.children?.length) flattenCanonicalMenu(node.children, acc);
  }
  return acc;
}

export function assertOwnerDecisionMenuInvariants(nodes = []) {
  const flat = flattenCanonicalMenu(nodes);
  const routes = flat.map((n) => n.route);
  return {
    ownerDecisions: OWNER_DECISIONS,
    hasLegacyMessages: routes.includes(B01_LEGACY_MESSAGES_ROUTE),
    hasCanonicalMessages: routes.includes("/crm/messages"),
    hasShadowSkillV5: routes.includes(B03_SHADOW_SKILL_ASSESSMENT_V5),
    legacyTournamentHubCount: routes.filter(
      (r) => r?.startsWith("/tournament/") && !r.startsWith("/tournaments/")
    ).length,
    canonicalTournamentCount: routes.filter((r) => r?.startsWith("/tournaments/")).length,
    duplicateMessagesEntries:
      routes.filter((r) => r === "/messages" || r === "/crm/messages").length > 1 &&
      routes.includes("/messages"),
  };
}
