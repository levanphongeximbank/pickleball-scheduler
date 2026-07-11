import { API_ERROR_CODES } from "../constants/apiErrors.js";
import { isApiEnabled } from "../../integrations/config/integrationFlags.js";
import { apiError, apiSuccess } from "../utils/apiResponse.js";
import { createRequestId } from "../utils/requestId.js";
import { authenticateApiKey, assertApiScope } from "../services/apiKeyService.js";
import { logApiRequest } from "../services/apiLogService.js";
import { getCurrentUser } from "../../../auth/authService.js";
import { playersRoutes } from "./handlers/playersHandler.js";
import { clubsRoutes } from "./handlers/clubsHandler.js";
import { courtsRoutes } from "./handlers/courtsHandler.js";
import { marketplaceRoutes } from "./handlers/marketplaceHandler.js";
import { paymentsRoutes } from "./handlers/paymentsHandler.js";
import { notificationsRoutes } from "./handlers/notificationsHandler.js";

const API_BASE = "/api/v1";

const ROUTES = [
  ...playersRoutes,
  ...clubsRoutes,
  ...courtsRoutes,
  ...marketplaceRoutes,
  ...paymentsRoutes,
  ...notificationsRoutes,
  {
    method: "GET",
    path: "/health",
    scope: null,
    public: true,
    handler: () => ({ status: "ok", version: "v1" }),
  },
];

function normalizePath(path) {
  const cleaned = String(path || "").split("?")[0];
  if (!cleaned.startsWith(API_BASE)) {
    return cleaned.startsWith("/") ? `${API_BASE}${cleaned}` : `${API_BASE}/${cleaned}`;
  }
  return cleaned;
}

function matchRoute(method, path) {
  const fullPath = normalizePath(path).replace(API_BASE, "") || "/";

  for (const route of ROUTES) {
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

async function resolveAuth(ctx) {
  if (ctx.sessionAuth?.ok) {
    return {
      ok: true,
      tenantId: ctx.sessionAuth.tenantId,
      scopes: ctx.sessionAuth.scopes || [],
      mode: "session",
    };
  }

  const apiKey = ctx.headers?.["x-api-key"] || ctx.headers?.["X-API-Key"];
  if (apiKey) {
    return authenticateApiKey(apiKey);
  }

  const user = getCurrentUser();
  if (user) {
    return {
      ok: true,
      tenantId: user.tenantId || user.venueId,
      scopes: [],
      mode: "session",
      user,
    };
  }

  return {
    ok: false,
    code: API_ERROR_CODES.UNAUTHORIZED,
    message: "Thiếu xác thực API.",
  };
}

export async function invokeApi({
  method = "GET",
  path,
  body = {},
  query = {},
  headers = {},
  sessionAuth = null,
} = {}) {
  const requestId = createRequestId();
  const started = Date.now();

  if (!isApiEnabled()) {
    const response = apiError(
      API_ERROR_CODES.FEATURE_DISABLED,
      "API layer chưa được bật (VITE_API_ENABLED).",
      null,
      { requestId }
    );
    logApiRequest({
      requestId,
      method,
      path: normalizePath(path),
      statusCode: 503,
      durationMs: Date.now() - started,
      userAgent: headers["user-agent"],
    });
    return { statusCode: 503, response };
  }

  const matched = matchRoute(method, path);
  if (!matched) {
    const response = apiError(
      API_ERROR_CODES.NOT_FOUND,
      "Route không tồn tại.",
      { path: normalizePath(path) },
      { requestId }
    );
    logApiRequest({
      requestId,
      method,
      path: normalizePath(path),
      statusCode: 404,
      durationMs: Date.now() - started,
      userAgent: headers["user-agent"],
    });
    return { statusCode: 404, response };
  }

  const { route, params } = matched;
  let auth = { ok: true, mode: "public" };

  if (!route.public) {
    auth = await resolveAuth({ headers, sessionAuth });
    if (!auth.ok) {
      const response = apiError(auth.code, auth.message, null, { requestId });
      logApiRequest({
        requestId,
        tenantId: auth.tenantId,
        method,
        path: normalizePath(path),
        statusCode: 401,
        durationMs: Date.now() - started,
        userAgent: headers["user-agent"],
      });
      return { statusCode: 401, response };
    }

    if (route.scope) {
      const scopeCheck = assertApiScope(auth, route.scope);
      if (!scopeCheck.ok && auth.mode !== "session") {
        const response = apiError(scopeCheck.code, scopeCheck.message, null, { requestId });
        logApiRequest({
          requestId,
          tenantId: auth.tenantId,
          apiClientId: auth.client?.id,
          method,
          path: normalizePath(path),
          statusCode: 403,
          durationMs: Date.now() - started,
          userAgent: headers["user-agent"],
        });
        return { statusCode: 403, response };
      }
    }
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
    const response = apiSuccess(data, { requestId });
    logApiRequest({
      requestId,
      tenantId: auth.tenantId,
      apiClientId: auth.client?.id,
      method,
      path: normalizePath(path),
      statusCode: 200,
      durationMs: Date.now() - started,
      userAgent: headers["user-agent"],
    });
    return { statusCode: 200, response };
  } catch (error) {
    const statusCode = error.statusCode || 500;
    const code = error.code || API_ERROR_CODES.INTERNAL_ERROR;
    const response = apiError(
      code,
      error.message || "Internal error",
      null,
      { requestId }
    );
    logApiRequest({
      requestId,
      tenantId: auth.tenantId,
      apiClientId: auth.client?.id,
      method,
      path: normalizePath(path),
      statusCode,
      durationMs: Date.now() - started,
      userAgent: headers["user-agent"],
    });
    return { statusCode, response };
  }
}

export function listApiRoutes() {
  return ROUTES.map(({ method, path, scope, public: isPublic }) => ({
    method,
    path: `${API_BASE}${path}`,
    scope,
    public: Boolean(isPublic),
  }));
}

export { API_BASE };
