import { isApiEnabled } from "../../integrations/config/integrationFlags.js";
import { EDGE_API_ERROR_CODES, edgeErrorStatus } from "../constants/edgeApiErrors.js";
import { edgeError, edgeSuccess } from "../utils/edgeApiResponse.js";
import { createRequestId } from "../utils/requestId.js";
import { guardApiKey, assertEdgeTenant } from "../guards/apiKeyGuard.js";
import { checkRateLimit } from "../guards/rateLimitGuard.js";
import { logApiRequest } from "../services/apiLogService.js";
import { recordIntegrationAuditFromRequest } from "../services/integrationAuditService.js";
import { getAuditInsertTimeoutMs } from "../config/auditStoreConfig.js";
import { tenantRoutes } from "./handlers/tenantHandler.js";
import { integrationsRoutes } from "./handlers/integrationsHandler.js";
import { webhooksRoutes } from "./handlers/webhooksHandler.js";

export const EDGE_API_BASE = "/api/v1";

const EDGE_ROUTES = [
  {
    method: "GET",
    path: "/health",
    scope: null,
    public: true,
    handler: () => ({
      status: "ok",
      version: "v1",
      layer: "edge",
    }),
  },
  ...tenantRoutes,
  ...integrationsRoutes,
  ...webhooksRoutes,
];

function normalizePath(path) {
  const cleaned = String(path || "").split("?")[0];
  if (!cleaned.startsWith(EDGE_API_BASE)) {
    return cleaned.startsWith("/") ? `${EDGE_API_BASE}${cleaned}` : `${EDGE_API_BASE}/${cleaned}`;
  }
  return cleaned;
}

function matchEdgeRoute(method, path) {
  const fullPath = normalizePath(path).replace(EDGE_API_BASE, "") || "/";

  for (const route of EDGE_ROUTES) {
    if (route.method !== method) continue;

    const pattern = route.path.replace(/:([A-Za-z0-9_]+)/g, "([^/]+)");
    const regex = new RegExp(`^${pattern}$`);
    const match = fullPath.match(regex);
    if (!match) continue;

    const paramNames = [...route.path.matchAll(/:([A-Za-z0-9_]+)/g)].map((m) => m[1]);
    const params = paramNames.reduce((acc, name, index) => {
      acc[name] = match[index + 1];
      return acc;
    }, {});

    return { route, params };
  }

  return null;
}

function readApiKeyHeader(headers = {}) {
  return headers["x-api-key"] || headers["X-API-Key"] || headers["X-Api-Key"] || null;
}

function readRequestedTenant(query = {}, params = {}) {
  return query.tenantId || params.tenantId || null;
}

/**
 * Phase 11C — Edge API router foundation (staging/internal).
 * Enforces API key guard + rate limit before route handlers.
 */
export async function invokeEdgeApi({
  method = "GET",
  path,
  body = {},
  query = {},
  headers = {},
  rateLimits = null,
} = {}) {
  const requestId = createRequestId();
  const started = Date.now();
  const normalizedPath = normalizePath(path);
  let rateHeaders = {};

  let matchedRoute = null;
  let finishAuth = null;

  const finish = async (statusCode, response, { auditAuth = null } = {}) => {
    logApiRequest({
      requestId,
      tenantId: response?.data?.tenantId || null,
      method,
      path: normalizedPath,
      statusCode,
      durationMs: Date.now() - started,
      userAgent: headers["user-agent"],
    });

    if (matchedRoute && !matchedRoute.public) {
      try {
        await recordIntegrationAuditFromRequest(
          {
            requestId,
            route: normalizedPath,
            method,
            statusCode,
            resultCode: response?.code || null,
            scopeRequired: matchedRoute.scope,
            routePath: matchedRoute.path,
            auth: auditAuth ?? finishAuth,
          },
          { timeoutMs: getAuditInsertTimeoutMs() }
        );
      } catch (error) {
        console.warn(
          "[integrationAudit] finish audit failed:",
          error?.message || String(error)
        );
      }
    }

    return { statusCode, body: response, headers: rateHeaders };
  };

  const matched = matchEdgeRoute(method, path);
  if (!matched) {
    return await finish(
      edgeErrorStatus(EDGE_API_ERROR_CODES.NOT_FOUND),
      edgeError(EDGE_API_ERROR_CODES.NOT_FOUND, "Route không tồn tại.", {
        requestId,
        data: { path: normalizedPath },
      })
    );
  }

  const { route, params } = matched;
  matchedRoute = route;

  if (!route.public && !isApiEnabled()) {
    return await finish(
      edgeErrorStatus(EDGE_API_ERROR_CODES.FEATURE_DISABLED),
      edgeError(EDGE_API_ERROR_CODES.FEATURE_DISABLED, "API layer chưa được bật (VITE_API_ENABLED).", {
        requestId,
      })
    );
  }

  let auth = { ok: true, mode: "public" };

  if (!route.public) {
    const apiKey = readApiKeyHeader(headers);
    const requestedTenant = readRequestedTenant(query, params);

    auth = await guardApiKey(apiKey, {
      requiredScope: route.scope,
      tenantId: requestedTenant || null,
    });
    finishAuth = auth;

    if (!auth.ok) {
      return await finish(
        auth.statusCode || edgeErrorStatus(auth.code),
        edgeError(auth.code, auth.message, { requestId }),
        { auditAuth: auth }
      );
    }

    const tenantCheck = assertEdgeTenant(auth, requestedTenant);
    if (!tenantCheck.ok) {
      finishAuth = { ...auth, ...tenantCheck };
      return await finish(
        tenantCheck.statusCode || edgeErrorStatus(tenantCheck.code),
        edgeError(tenantCheck.code, tenantCheck.message, { requestId }),
        { auditAuth: finishAuth }
      );
    }
    finishAuth = tenantCheck;

    const rate = checkRateLimit(
      {
        tenantId: auth.tenantId,
        clientId: auth.client?.id,
        limits: rateLimits ?? {},
      },
      Date.now()
    );

    if (!rate.ok) {
      rateHeaders = rate.headers || {};
      return await finish(
        rate.statusCode || 429,
        edgeError(rate.code || EDGE_API_ERROR_CODES.RATE_LIMITED, rate.message, { requestId }),
        { auditAuth: finishAuth }
      );
    }
    rateHeaders = rate.headers || {};
  }

  try {
    const ctx = {
      auth,
      params,
      query,
      body,
      headers,
      requestId,
    };
    const data = await route.handler(ctx);
    return await finish(
      200,
      edgeSuccess(data, { requestId })
    );
  } catch (error) {
    return await finish(
      error.statusCode || 500,
      edgeError(EDGE_API_ERROR_CODES.INTERNAL_ERROR, error.message || "Internal error", {
        requestId,
      })
    );
  }
}

export function listEdgeApiRoutes() {
  return EDGE_ROUTES.map(({ method, path, scope, public: isPublic }) => ({
    method,
    path: `${EDGE_API_BASE}${path}`,
    scope,
    public: Boolean(isPublic),
  }));
}

export { EDGE_ROUTES };
