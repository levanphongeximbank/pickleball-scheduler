export const API_SCOPES = Object.freeze({
  PLAYERS_READ: "players:read",
  PLAYERS_WRITE: "players:write",
  COURTS_READ: "courts:read",
  BOOKINGS_READ: "bookings:read",
  BOOKINGS_WRITE: "bookings:write",
  TOURNAMENTS_READ: "tournaments:read",
  TOURNAMENTS_WRITE: "tournaments:write",
  PAYMENTS_READ: "payments:read",
  PAYMENTS_WRITE: "payments:write",
  MARKETPLACE_READ: "marketplace:read",
  MARKETPLACE_WRITE: "marketplace:write",
  CLUBS_READ: "clubs:read",
  NOTIFICATIONS_READ: "notifications:read",
  NOTIFICATIONS_WRITE: "notifications:write",
  INTEGRATIONS_READ: "integrations:read",
  INTEGRATIONS_WRITE: "integrations:write",
  WEBHOOKS_READ: "webhooks:read",
  WEBHOOKS_WRITE: "webhooks:write",
  TENANT_READ: "tenant:read",
});

/** Phase 11C edge foundation scopes. */
export const EDGE_FOUNDATION_SCOPES = Object.freeze([
  API_SCOPES.INTEGRATIONS_READ,
  API_SCOPES.INTEGRATIONS_WRITE,
  API_SCOPES.WEBHOOKS_READ,
  API_SCOPES.WEBHOOKS_WRITE,
  API_SCOPES.TENANT_READ,
]);

export const ALL_API_SCOPES = Object.freeze(Object.values(API_SCOPES));

export function isValidApiScope(scope) {
  return ALL_API_SCOPES.includes(scope);
}

export function parseScopes(scopes) {
  if (!scopes) return [];
  if (Array.isArray(scopes)) {
    return scopes.filter(isValidApiScope);
  }
  if (typeof scopes === "string") {
    return scopes
      .split(",")
      .map((s) => s.trim())
      .filter(isValidApiScope);
  }
  return [];
}

export function hasApiScope(grantedScopes, requiredScope) {
  const granted = parseScopes(grantedScopes);
  return granted.includes(requiredScope);
}
