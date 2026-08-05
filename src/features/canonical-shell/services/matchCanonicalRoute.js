/**
 * Canonical active-route matching foundation.
 * Prefers canonical path metadata (B02); does not delete legacy routes.
 */

export function stripQuery(path = "") {
  return String(path).split("?")[0];
}

export function normalizePath(path = "") {
  const cleaned = stripQuery(path);
  if (cleaned.length > 1 && cleaned.endsWith("/")) {
    return cleaned.slice(0, -1);
  }
  return cleaned || "/";
}

/**
 * Convert `/tournaments/:tournamentId/engine` → regex matcher.
 * @param {string} pattern
 */
export function patternToRegExp(pattern) {
  const escaped = normalizePath(pattern)
    .split("/")
    .map((segment) => {
      if (!segment) return "";
      if (segment.startsWith(":")) return "[^/]+";
      return segment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    })
    .join("/");
  return new RegExp(`^${escaped}(?:/.*)?$`);
}

/**
 * @param {string} currentPath
 * @param {{ route?: string, activeMatch?: string }} node
 */
export function isCanonicalRouteActive(currentPath, node) {
  if (!node?.route) return false;
  const current = normalizePath(currentPath);
  const target = normalizePath(node.route);

  if (node.activeMatch === "exact" || target === "/dashboard") {
    return current === target;
  }

  if (node.activeMatch === "pattern" || target.includes(":")) {
    return patternToRegExp(target).test(current);
  }

  if (target === "/") {
    return current === "/";
  }

  return current === target || current.startsWith(`${target}/`);
}

/**
 * Walk a menu tree and return the deepest active leaf, if any.
 * @param {string} currentPath
 * @param {Array} nodes
 */
export function findActiveCanonicalNode(currentPath, nodes = []) {
  let best = null;
  let bestScore = -1;

  function visit(node) {
    if (!node) return;
    if (node.children?.length) {
      node.children.forEach(visit);
    }
    if (node.route && isCanonicalRouteActive(currentPath, node)) {
      const score = normalizePath(node.route).length;
      if (score > bestScore) {
        best = node;
        bestScore = score;
      }
    }
  }

  nodes.forEach(visit);
  return best;
}
