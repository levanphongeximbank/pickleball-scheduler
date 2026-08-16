/**
 * Team Tournament → canonical Contract A context translator.
 * tenantId, organizationId, clubId, and venueId are distinct. Never collapse.
 */

import {
  COMPETITION_ADAPTER_CONTRACT_VERSION_V1,
  SHARED_ADAPTER_ERROR_CODE,
  distinguishScopeIds,
  failCompetitionAdapter,
  isNonEmptyString,
  looksLikeFuzzyIdentity,
  requireCanonicalTenantId,
} from "../../../competition-engine/integration/contracts/index.js";

function trimId(value) {
  if (value == null) return null;
  const trimmed = String(value).trim();
  return trimmed === "" ? null : trimmed;
}

export function readDistinctTeamScope(input = {}) {
  return distinguishScopeIds({
    tenantId: trimId(input.tenantId),
    organizationId: trimId(input.organizationId),
    clubId: trimId(input.clubId),
    venueId: trimId(input.venueId),
    collapseScopeIds: input.collapseScopeIds === true,
    tenantIdIsVenueId: input.tenantIdIsVenueId === true,
  });
}

/**
 * Translate Team Tournament request state into Contract A context.
 * Does not invent organizationId. Does not use venueId as tenantId.
 */
export function toCanonicalAdapterContext(input = {}, extras = {}) {
  if (input.tenantIdIsVenueId === true || input.collapseScopeIds === true) {
    failCompetitionAdapter(
      SHARED_ADAPTER_ERROR_CODE.MALFORMED_ADAPTER,
      "tenantId, organizationId, clubId, and venueId must remain distinct",
      {}
    );
  }

  const tenantId = requireCanonicalTenantId(input);
  const actorId = trimId(input.actorId) || trimId(input.userId);
  if (actorId && looksLikeFuzzyIdentity(actorId)) {
    failCompetitionAdapter(
      SHARED_ADAPTER_ERROR_CODE.FUZZY_IDENTITY_FORBIDDEN,
      "Canonical actor identity is auth.uid / actorId — never name/email/phone",
      { actorId }
    );
  }
  if (input.useDisplayNameAsIdentity === true) {
    failCompetitionAdapter(
      SHARED_ADAPTER_ERROR_CODE.DISPLAY_NAME_IS_NOT_IDENTITY,
      "Display name is never identity authority",
      {}
    );
  }

  const scope = readDistinctTeamScope({ ...input, tenantId });
  const competitionId =
    trimId(input.competitionId) || trimId(input.tournamentId) || null;
  const participantId =
    trimId(input.participantId) ||
    trimId(input.playerId) ||
    trimId(input.canonicalPlayerId) ||
    null;

  return Object.freeze({
    contractVersion:
      trimId(input.contractVersion) || COMPETITION_ADAPTER_CONTRACT_VERSION_V1,
    tenantId: scope.tenantId,
    organizationId: scope.organizationId,
    clubId: scope.clubId,
    venueId: scope.venueId,
    competitionId,
    actorId,
    correlationId:
      trimId(input.correlationId) ||
      trimId(input.requestId) ||
      `team-b-${Date.now()}`,
    participantId,
    playerId: participantId,
    teamId: trimId(input.teamId),
    matchId: trimId(input.matchId) || trimId(input.matchupId),
    role: trimId(input.role),
    effectiveAt: input.effectiveAt || null,
    idempotencyKey: trimId(input.idempotencyKey),
    ...extras,
  });
}

export function requireCanonicalActorId(value) {
  const actorId = trimId(value);
  if (!actorId) {
    failCompetitionAdapter(
      SHARED_ADAPTER_ERROR_CODE.MISSING_CANONICAL_IDENTITY,
      "Canonical actorId is required",
      {}
    );
  }
  if (looksLikeFuzzyIdentity(actorId)) {
    failCompetitionAdapter(
      SHARED_ADAPTER_ERROR_CODE.FUZZY_IDENTITY_FORBIDDEN,
      "Canonical actor identity is auth.uid / actorId",
      { actorId }
    );
  }
  return actorId;
}

export function isNonEmptyCanonicalId(value) {
  return isNonEmptyString(value) && !looksLikeFuzzyIdentity(value);
}
