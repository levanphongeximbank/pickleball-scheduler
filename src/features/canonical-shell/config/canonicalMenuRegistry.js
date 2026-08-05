import { CANONICAL_MENU_DATA } from "./canonicalMenuData.js";

/**
 * Build the Level-1 → Level-2 → Level-3 canonical menu tree from Phase 1 inventory.
 * Single source for desktop and mobile shell navigation foundation.
 */

function sortByLabel(a, b) {
  return String(a.label || "").localeCompare(String(b.label || ""), "vi");
}

export function getCanonicalLevel1Groups() {
  return CANONICAL_MENU_DATA.level1Groups || [];
}

export function getCanonicalMenuNodes() {
  return CANONICAL_MENU_DATA.nodes || [];
}

export function getCanonicalMenuMeta() {
  return CANONICAL_MENU_DATA.meta || {};
}

/**
 * @returns {Array<{
 *   id: string,
 *   label: string,
 *   level1: string,
 *   icon: string,
 *   children: Array,
 *   requiredRoles: string[],
 *   requiredPermissions: string[],
 *   featureFlags: string[],
 *   visibilityStatus: string,
 *   mobileVisible: boolean,
 *   desktopVisible: boolean,
 * }>}
 */
export function buildCanonicalMenuTree() {
  const groups = getCanonicalLevel1Groups();
  const nodes = getCanonicalMenuNodes();

  return groups
    .map((group) => {
      const groupNodes = nodes.filter((node) => String(node.level1) === String(group.id));
      const byLevel2 = new Map();

      for (const node of groupNodes) {
        const key = node.level2 || "misc";
        if (!byLevel2.has(key)) {
          byLevel2.set(key, {
            id: `l2__${group.id}__${key}`,
            label: node.level2Label || key,
            description: node.description || "",
            icon: node.icon || "dashboard",
            route: undefined,
            level1: group.id,
            level1Label: group.label,
            level2: key,
            level2Label: node.level2Label || key,
            level3: undefined,
            children: [],
            requiredRoles: [],
            requiredPermissions: [],
            featureFlags: [],
            visibilityStatus: "live",
            activeMatch: "prefix",
            mobileVisible: true,
            desktopVisible: true,
            badge: null,
            rbacVisibility: ["RBAC_SCOPED"],
          });
        }
        byLevel2.get(key).children.push({
          ...node,
          children: [],
        });
      }

      const modules = [...byLevel2.values()]
        .map((mod) => {
          const children = [...mod.children].sort(sortByLabel);
          // Promote single-leaf modules to a direct Level-2 link when useful.
          if (children.length === 1) {
            const only = children[0];
            return {
              ...mod,
              route: only.route,
              activeMatch: only.activeMatch,
              requiredRoles: only.requiredRoles,
              requiredPermissions: only.requiredPermissions,
              featureFlags: only.featureFlags,
              visibilityStatus: only.visibilityStatus,
              rbacVisibility: only.rbacVisibility,
              mobileVisible: only.mobileVisible,
              desktopVisible: only.desktopVisible,
              badge: only.badge,
              children: [],
              level3: only.level3,
            };
          }
          return { ...mod, children };
        })
        .sort(sortByLabel);

      return {
        id: `l1__${group.id}`,
        label: group.label,
        description: "",
        icon: group.key || "dashboard",
        route: undefined,
        level1: group.id,
        level1Label: group.label,
        level2: undefined,
        level3: undefined,
        children: modules,
        requiredRoles: [],
        requiredPermissions: [],
        featureFlags: [],
        visibilityStatus: "live",
        activeMatch: "prefix",
        mobileVisible: true,
        desktopVisible: true,
        badge: null,
        rbacVisibility: ["RBAC_SCOPED"],
        groupKey: group.key,
      };
    })
    .filter((group) => group.children.length > 0);
}

export function findCanonicalNodeByRoute(route, tree = buildCanonicalMenuTree()) {
  const target = String(route || "");
  let found = null;

  function visit(node) {
    if (!node || found) return;
    if (node.route === target) {
      found = node;
      return;
    }
    (node.children || []).forEach(visit);
  }

  tree.forEach(visit);
  return found;
}
