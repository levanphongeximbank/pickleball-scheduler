/**
 * Resolve club / tournament / tenant ids for live private-pairing loads.
 * Never invents empty scopeId for scoped RPC calls.
 */

function normalizeId(value) {
  const text = String(value ?? "").trim();
  if (!text || text === "undefined" || text === "null") {
    return "";
  }
  return text;
}

/**
 * @param {{
 *   tournamentId?: string|null,
 *   tournament?: { id?: string|null, clubId?: string|null, tenantId?: string|null }|null,
 *   clubId?: string|null,
 *   clubFromQuery?: string|null,
 *   activeClubId?: string|null,
 *   tenantId?: string|null,
 *   currentTenantId?: string|null,
 * }} input
 */
export function resolveLivePairingScope(input = {}) {
  const tournamentId =
    normalizeId(input.tournamentId) ||
    normalizeId(input.tournament?.id) ||
    "";

  const clubId =
    normalizeId(input.tournament?.clubId) ||
    normalizeId(input.clubId) ||
    normalizeId(input.clubFromQuery) ||
    normalizeId(input.activeClubId) ||
    "";

  const tenantId =
    normalizeId(input.tenantId) ||
    normalizeId(input.tournament?.tenantId) ||
    normalizeId(input.currentTenantId) ||
    "";

  const missing = [];
  // Private pairing get_active_for_scope requires tenant (SQL returns SCOPE_ID_REQUIRED).
  if (!tenantId) missing.push("tenantId");
  // At least one of tournament/club needed for a useful scoped load.
  if (!tournamentId && !clubId) {
    missing.push("tournamentId|clubId");
  }

  return {
    tournamentId: tournamentId || null,
    clubId: clubId || null,
    tenantId: tenantId || null,
    ok: missing.length === 0,
    missing,
    diagnosticMessage: missing.length
      ? `Thiếu phạm vi ghép cặp: ${missing.join(", ")}. Kiểm tra giải đã tải (tournamentId), CLB chủ nhà (tournament.clubId / ?club=) và tenant/venue.`
      : null,
  };
}

/**
 * Ensure loaded rules carry a non-empty scopeId before validation.
 * @param {object[]} rules
 * @param {{ scopeType?: string|null, tournamentId?: string|null, clubId?: string|null }} ctx
 */
export function ensureRulesHaveScopeIds(rules = [], ctx = {}) {
  const fallbackScopeId =
    ctx.scopeType === "TOURNAMENT"
      ? normalizeId(ctx.tournamentId)
      : normalizeId(ctx.clubId) || normalizeId(ctx.tournamentId);

  return (rules || []).map((rule) => {
    if (!rule || typeof rule !== "object") return rule;
    const scopeId = normalizeId(rule.scopeId);
    if (scopeId) return rule;
    if (!fallbackScopeId) return rule;
    return { ...rule, scopeId: fallbackScopeId };
  });
}
