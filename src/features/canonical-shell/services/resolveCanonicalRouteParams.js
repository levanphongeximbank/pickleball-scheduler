/**
 * Resolve parameterized canonical routes for hrefs and Vietnamese labels.
 * Never emits the literal placeholder "active". Never leaks unauthorized labels.
 */

const PARAM_FALLBACKS = Object.freeze({
  tournamentId: "Giải đấu",
  clubId: "CLB",
  courtId: "Sân",
  playerId: "VĐV",
  seasonId: "Mùa giải",
  leagueId: "Giải nội bộ",
  matchId: "Trận đấu",
  bookingId: "Đặt sân",
  userId: "Người dùng",
  publicId: "Công khai",
  moduleKey: "Module",
  category: "Hạng mục",
  token: "Phiên",
  productId: "Sản phẩm",
  id: "Chi tiết",
});

const SAFE_HUBS = Object.freeze({
  tournamentId: "/tournaments",
  clubId: "/clubs",
  courtId: "/courts",
  playerId: "/players",
  matchId: "/tournaments",
  productId: "/marketplace",
});

const UUID_LIKE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const NUMERIC_ID = /^\d{6,}$/;

/**
 * Extract :param names from a route pattern.
 * @param {string} pattern
 * @returns {string[]}
 */
export function listRouteParamNames(pattern = "") {
  const names = [];
  String(pattern || "").replace(/:([A-Za-z_][A-Za-z0-9_]*)/g, (_m, name) => {
    names.push(name);
    return _m;
  });
  return names;
}

/**
 * @param {string} pattern
 * @param {string} pathname
 * @returns {Record<string, string>}
 */
export function extractParamsFromPath(pattern, pathname) {
  const patternParts = String(pattern || "").split("/").filter(Boolean);
  const pathParts = String(pathname || "").split("/").filter(Boolean);
  const params = {};
  if (patternParts.length === 0 || pathParts.length < patternParts.length) return params;

  for (let i = 0; i < patternParts.length; i += 1) {
    const part = patternParts[i];
    if (part.startsWith(":")) {
      params[part.slice(1)] = decodeURIComponent(pathParts[i] || "");
    } else if (part !== pathParts[i]) {
      return {};
    }
  }
  return params;
}

/**
 * @param {string} value
 * @returns {boolean}
 */
export function isUnsafeRawId(value) {
  const raw = String(value || "").trim();
  if (!raw) return true;
  if (raw.toLowerCase() === "active") return true;
  if (UUID_LIKE.test(raw)) return true;
  if (NUMERIC_ID.test(raw)) return true;
  return false;
}

/**
 * Deterministic Vietnamese fallback for a route param.
 * @param {string} paramName
 * @returns {string}
 */
export function getParamFallbackLabel(paramName) {
  return PARAM_FALLBACKS[paramName] || "Chi tiết";
}

/**
 * @param {string} paramName
 * @param {string|undefined} value
 * @param {Record<string, string>} [entityLabels] map paramName -> display label
 */
export function resolveParamLabel(paramName, value, entityLabels = {}) {
  const entity = entityLabels?.[paramName];
  if (entity && String(entity).trim() && String(entity).toLowerCase() !== "active") {
    return String(entity).trim();
  }
  if (value && !isUnsafeRawId(value)) {
    return String(value).trim();
  }
  return getParamFallbackLabel(paramName);
}

/**
 * Build a concrete href for a parameterized menu route.
 * Returns null when required params cannot be resolved (caller should use hub / skip).
 *
 * @param {string} pattern
 * @param {{ params?: Record<string, string>, pathname?: string }} [context]
 * @returns {{ href: string|null, missing: string[], usedParams: Record<string, string> }}
 */
export function resolveCanonicalRouteHref(pattern, context = {}) {
  const route = String(pattern || "");
  if (!route.includes(":")) {
    return { href: route || null, missing: [], usedParams: {} };
  }

  const fromPath = context.pathname
    ? extractParamsFromPath(route, context.pathname)
    : {};
  const params = { ...fromPath, ...(context.params || {}) };
  const missing = [];
  const usedParams = {};

  const href = route.replace(/:([A-Za-z_][A-Za-z0-9_]*)/g, (_m, name) => {
    const value = params[name];
    if (!value || String(value).toLowerCase() === "active") {
      missing.push(name);
      return `:${name}`;
    }
    usedParams[name] = String(value);
    return encodeURIComponent(String(value));
  });

  if (missing.length) {
    return { href: null, missing, usedParams };
  }
  return { href, missing, usedParams };
}

/**
 * Safe hub when a parameterized route cannot be resolved.
 * @param {string} pattern
 */
export function resolveCanonicalRouteHub(pattern) {
  const names = listRouteParamNames(pattern);
  for (const name of names) {
    if (SAFE_HUBS[name]) return SAFE_HUBS[name];
  }
  if (String(pattern || "").startsWith("/tournaments")) return "/tournaments";
  return null;
}

/**
 * Label for breadcrumb / mobile display of a parameterized route leaf.
 * Prefers node.label; never returns "active" or raw internal ids for the path segment.
 *
 * @param {{ label?: string, route?: string, level3?: string }} node
 * @param {{ pathname?: string, params?: Record<string, string>, entityLabels?: Record<string, string>, authorized?: boolean }} [context]
 */
export function resolveCanonicalRouteLabel(node, context = {}) {
  if (context.authorized === false) {
    return "Không có quyền truy cập";
  }

  const baseLabel = String(node?.label || node?.level3 || "").trim();
  if (baseLabel && baseLabel.toLowerCase() !== "active") {
    return baseLabel;
  }

  const pattern = node?.route || "";
  const names = listRouteParamNames(pattern);
  if (!names.length) {
    const segment = String(context.pathname || "")
      .split("/")
      .filter(Boolean)
      .pop();
    if (segment && !isUnsafeRawId(segment) && segment.toLowerCase() !== "active") {
      return segment;
    }
    return "Trang";
  }

  const fromPath = context.pathname
    ? extractParamsFromPath(pattern, context.pathname)
    : {};
  const params = { ...fromPath, ...(context.params || {}) };
  const primary = names[0];
  return resolveParamLabel(primary, params[primary], context.entityLabels);
}

/**
 * Guard: never allow the forbidden placeholder in href or label outputs.
 */
export function assertNoActivePlaceholder(value) {
  return !String(value || "")
    .split("/")
    .some((part) => part.toLowerCase() === "active");
}
