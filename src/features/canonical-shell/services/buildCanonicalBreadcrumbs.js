import { buildCanonicalMenuTree, findCanonicalNodeByRoute } from "../config/canonicalMenuRegistry.js";
import { findActiveCanonicalNode, normalizePath } from "./matchCanonicalRoute.js";

/**
 * Canonical breadcrumbs foundation — derived from the menu registry + current path.
 * Phase 2 does not migrate every page; pages may still render local breadcrumbs.
 */

function crumb(node, href) {
  return {
    id: node.id,
    label: node.label,
    href: href || node.route || undefined,
    level1: node.level1,
    level2: node.level2,
    level3: node.level3,
  };
}

/**
 * @param {string} pathname
 * @param {{ tree?: Array, homeLabel?: string, homeHref?: string }} [options]
 */
export function buildCanonicalBreadcrumbs(pathname, options = {}) {
  const tree = options.tree || buildCanonicalMenuTree();
  const homeLabel = options.homeLabel || "Tổng quan";
  const homeHref = options.homeHref || "/dashboard";
  const current = normalizePath(pathname);

  const crumbs = [{ id: "home", label: homeLabel, href: homeHref }];

  if (!current || current === homeHref) {
    return crumbs;
  }

  const active = findActiveCanonicalNode(current, tree);
  if (!active) {
    // Invalid / unknown route foundation — keep home + raw segment label.
    const segment = current.split("/").filter(Boolean).pop() || current;
    crumbs.push({
      id: `unknown__${current}`,
      label: segment,
      href: undefined,
      invalid: true,
    });
    return crumbs;
  }

  const level1 = tree.find((g) => String(g.level1) === String(active.level1));
  if (level1) {
    crumbs.push(crumb(level1));
  }

  if (active.level2) {
    const level2 = (level1?.children || []).find((m) => m.level2 === active.level2);
    if (level2 && level2.id !== active.id) {
      crumbs.push(crumb(level2, level2.route));
    }
  }

  if (active.route) {
    const leaf = findCanonicalNodeByRoute(active.route, tree) || active;
    if (!crumbs.some((c) => c.id === leaf.id)) {
      crumbs.push(crumb(leaf, undefined));
    } else {
      // Mark last crumb as current (no href).
      crumbs[crumbs.length - 1] = { ...crumbs[crumbs.length - 1], href: undefined };
    }
  }

  return crumbs;
}
