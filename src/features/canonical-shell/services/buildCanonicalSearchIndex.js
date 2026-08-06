import { flattenCanonicalMenu, isCanonicalMenuNodeVisible } from "./filterCanonicalMenu.js";
import { buildCanonicalMenuTree } from "../config/canonicalMenuRegistry.js";
import {
  B01_LEGACY_MESSAGES_ROUTE,
  B03_SHADOW_SKILL_ASSESSMENT_V5,
} from "../config/ownerDecisions.js";
import { resolveCanonicalRouteHref, resolveCanonicalRouteHub } from "./resolveCanonicalRouteParams.js";

/**
 * Canonical global search index — single registry source (desktop + mobile).
 * Respects RBAC / permissions / owner decisions. Never leaks shadow or legacy aliases.
 */

function isSearchableLeaf(node) {
  if (!node?.route) return false;
  if (node.route === B01_LEGACY_MESSAGES_ROUTE) return false;
  if (node.route === B03_SHADOW_SKILL_ASSESSMENT_V5) return false;
  if (node.route.startsWith("/tournament/") && !node.route.startsWith("/tournaments/")) {
    return false;
  }
  if (node.visibilityStatus === "shadow" || node.visibilityStatus === "legacy") return false;
  if (node.contextualOnly) return false;
  // Parameterized deep links need entity context — exclude from normal search.
  if (String(node.route).includes(":")) return false;
  return true;
}

/**
 * @param {object} auth
 * @param {{ viewport?: string, tree?: Array, pathname?: string, params?: Record<string, string> }} [options]
 * @returns {Array<{ key: string, label: string, path: string, group: string, level1: string, level2: string, badge?: object|null }>}
 */
export function buildCanonicalSearchIndex(auth, options = {}) {
  const tree = options.tree || buildCanonicalMenuTree();
  const viewport = options.viewport || "desktop";
  const flat = flattenCanonicalMenu(tree);
  const seen = new Set();
  const results = [];

  for (const node of flat) {
    if (!isSearchableLeaf(node)) continue;
    if (!isCanonicalMenuNodeVisible(node, auth, { viewport })) continue;

    const { href } = resolveCanonicalRouteHref(node.route, {
      pathname: options.pathname,
      params: options.params,
    });
    const path = href || resolveCanonicalRouteHub(node.route) || node.route;
    if (!path || seen.has(path)) continue;
    seen.add(path);

    results.push({
      key: node.id,
      label: node.label,
      path,
      group: node.level1Label || node.level1 || "",
      level1: node.level1,
      level2: node.level2,
      level3: node.level3,
      badge: node.badge || null,
      visibilityStatus: node.visibilityStatus || "live",
    });
  }

  return results;
}

/**
 * Filter search hits by free-text query (label / path / group).
 */
export function filterCanonicalSearchResults(items = [], query = "") {
  const q = String(query || "").trim().toLowerCase();
  if (!q) return items;
  return items.filter((item) => {
    const haystack = `${item.label || ""} ${item.path || ""} ${item.group || ""}`.toLowerCase();
    return haystack.includes(q);
  });
}
