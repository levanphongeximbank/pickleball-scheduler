import { buildCanonicalMenuTree, findCanonicalNodeByRoute } from "../config/canonicalMenuRegistry.js";
import { findActiveCanonicalNode, normalizePath } from "./matchCanonicalRoute.js";
import { isCanonicalMenuNodeVisible } from "./filterCanonicalMenu.js";
import {
  resolveCanonicalRouteLabel,
  resolveCanonicalRouteHref,
  isUnsafeRawId,
} from "./resolveCanonicalRouteParams.js";

/**
 * Canonical breadcrumbs — registry-driven trail with parameterized label safety.
 */

function safeHref(route, context = {}) {
  if (!route) return undefined;
  if (!String(route).includes(":")) return route;
  const resolved = resolveCanonicalRouteHref(route, context);
  return resolved.href || undefined;
}

function crumb(node, href, label) {
  return {
    id: node.id,
    label: label || node.label,
    // Never fall back to unresolved ":param" patterns.
    href: href || undefined,
    level1: node.level1,
    level2: node.level2,
    level3: node.level3,
  };
}

/**
 * @param {string} pathname
 * @param {{
 *   tree?: Array,
 *   homeLabel?: string,
 *   homeHref?: string,
 *   auth?: object,
 *   entityLabels?: Record<string, string>,
 *   params?: Record<string, string>,
 * }} [options]
 */
export function buildCanonicalBreadcrumbs(pathname, options = {}) {
  const tree = options.tree || buildCanonicalMenuTree();
  const homeLabel = options.homeLabel || "Tổng quan";
  const homeHref = options.homeHref || "/dashboard";
  const current = normalizePath(pathname);
  const paramContext = {
    pathname: current,
    params: options.params,
  };

  const crumbs = [{ id: "home", label: homeLabel, href: homeHref }];

  if (!current || current === homeHref) {
    return crumbs;
  }

  const active = findActiveCanonicalNode(current, tree);
  if (!active) {
    const segment = current.split("/").filter(Boolean).pop() || current;
    const safeLabel =
      segment && !isUnsafeRawId(segment) && segment.toLowerCase() !== "active"
        ? segment
        : "Trang";
    crumbs.push({
      id: `unknown__${current}`,
      label: safeLabel,
      href: undefined,
      invalid: true,
    });
    return crumbs;
  }

  // Unauthorized hidden routes must not leak labels.
  if (options.auth) {
    const authorized = isCanonicalMenuNodeVisible(
      { ...active, desktopVisible: true, mobileVisible: true },
      options.auth,
      { viewport: "desktop", includeContextual: true }
    );
    if (!authorized) {
      crumbs.push({
        id: `denied__${active.id}`,
        label: "Không có quyền truy cập",
        href: undefined,
        denied: true,
      });
      return crumbs;
    }
  }

  const level1 = tree.find((g) => String(g.level1) === String(active.level1));
  if (level1) {
    crumbs.push(crumb(level1));
  }

  if (active.level2) {
    const level2 = (level1?.children || []).find((m) => m.level2 === active.level2);
    if (level2 && level2.id !== active.id) {
      crumbs.push(crumb(level2, safeHref(level2.route, paramContext)));
    }
  }

  if (active.route) {
    const leaf = findCanonicalNodeByRoute(active.route, tree) || active;
    const label = resolveCanonicalRouteLabel(leaf, {
      pathname: current,
      params: options.params,
      entityLabels: options.entityLabels,
      authorized: true,
    });
    if (!crumbs.some((c) => c.id === leaf.id)) {
      // Current page crumb has no href.
      crumbs.push(crumb(leaf, undefined, label));
    } else {
      crumbs[crumbs.length - 1] = {
        ...crumbs[crumbs.length - 1],
        href: undefined,
        label,
      };
    }
  }

  return crumbs;
}
