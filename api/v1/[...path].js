import { invokeEdgeApi } from "../../src/features/api/router/edgeApiRouter.js";

function parseBody(req) {
  if (!req.body) return {};
  if (typeof req.body === "object") return req.body;
  try {
    return JSON.parse(req.body);
  } catch {
    return {};
  }
}

function buildPath(req) {
  const url = new URL(req.url || "/", "http://localhost");
  const segments = req.query?.path;
  if (Array.isArray(segments) && segments.length > 0) {
    return `/api/v1/${segments.join("/")}`;
  }
  return url.pathname;
}

/**
 * Vercel serverless entry — Phase 11C Edge API (/api/v1/*).
 * Raw API keys are never logged.
 */
export default async function handler(req, res) {
  const method = req.method || "GET";
  const path = buildPath(req);
  const body = method === "GET" || method === "HEAD" ? {} : parseBody(req);

  const result = await invokeEdgeApi({
    method,
    path,
    body,
    query: req.query || {},
    headers: req.headers || {},
  });

  if (result.headers) {
    for (const [name, value] of Object.entries(result.headers)) {
      res.setHeader(name, value);
    }
  }

  res.status(result.statusCode).json(result.body);
}
