/**
 * Legacy /referee/:token route isolation markers.
 * Kept free of React so unit gates can import without DOM.
 */

export const LEGACY_REFEREE_TOKEN_ROUTE_STATUS = Object.freeze({
  status: "LEGACY_ISOLATED_NON_PRODUCTION",
  productionAuthority: false,
  scoringAuthority: false,
  assignmentAuthority: false,
  canonicalRoutes: Object.freeze(["/referee", "/referee/match/:matchId"]),
});
